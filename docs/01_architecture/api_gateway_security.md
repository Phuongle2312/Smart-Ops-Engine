# API Gateway (YARP) & Bảo vệ API

> Tiêu chí: “Sử dụng API — công nghệ .NET có bảo vệ API an toàn”. Tài liệu này là nguồn chuẩn cho mọi yêu cầu bảo mật phía backend; test case tương ứng nằm ở `04_test_cases/security_tests.md` (Đợt 3).

---

## 1. Vai trò của Gateway

Gateway (`SOE.Gateway`, ASP.NET Core 8 + YARP 2.x) là **điểm vào duy nhất** từ bên ngoài:

1. Chấm dứt TLS (hoặc nhận từ Ingress), ép HTTPS + HSTS.
2. Xác thực JWT (RS256, khóa lấy từ JWKS của Identity, cache 10 phút).
3. Phân quyền thô theo route (role/scope) — service vẫn tự kiểm tra lại (defense in depth).
4. Rate limiting & chống lạm dụng (Redis, theo IP và theo user).
5. CORS whitelist, security headers, giới hạn kích thước body.
6. Sinh/nhận `X-Correlation-Id`, chuyển tiếp `X-User-Id`, `X-User-Role`, loại bỏ mọi header giả mạo từ client.
7. Passthrough WebSocket cho SignalR.
8. Che giấu topology nội bộ (không lộ tên service, cổng, stack trace).

## 2. Bảng định tuyến

| Route (public) | Cluster | Method | Quyền tối thiểu | Rate limit |
|---|---|---|---|---|
| `/api/v1/auth/login` | identity | POST | Ẩn danh | 5 req/phút/IP + 10/giờ/username |
| `/api/v1/auth/refresh` | identity | POST | Cookie refresh | 30 req/giờ/IP |
| `/api/v1/auth/logout` | identity | POST | Đã đăng nhập | 60/phút/user |
| `/api/v1/users/**` | identity | * | ADMIN | 120/phút/user |
| `/api/v1/me`, `/api/v1/me/password` | identity | GET/PUT | Đã đăng nhập | 20/phút/user |
| `/api/v1/nodes/**` | inventory | GET | VIEWER+ | 300/phút/user |
| `/api/v1/nodes/**` | inventory | POST/PUT/DELETE | ADMIN | 60/phút/user |
| `/api/v1/nodes/{id}/test-connection` | inventory | POST | ADMIN | 10/phút/user |
| `/api/v1/nodes/{id}/check-now` | monitoring | POST | OPERATOR+ | 5/phút/user, 1/30s/node |
| `/api/v1/nodes/{id}/metrics/**` | metrics | GET | VIEWER+ | 300/phút/user |
| `/api/v1/metrics/latest` | metrics | GET | VIEWER+ | 600/phút/user |
| `/api/v1/incidents/**` | incident | GET | VIEWER+ | 300/phút/user |
| `/api/v1/incidents/{id}/acknowledge|resolve` | incident | PUT | OPERATOR+ | 60/phút/user |
| `/api/v1/threshold-policies/**` | incident | GET / PUT | VIEWER+ / ADMIN | 60/phút/user |
| `/api/v1/alert-channels/**` | notification | GET / * | ADMIN | 60/phút/user |
| `/api/v1/alert-channels/{id}/test` | notification | POST | ADMIN | 5/phút/user |
| `/api/v1/audit-logs/**` | audit | GET | ADMIN | 120/phút/user |
| `/api/v1/system-config/**` | (aggregate) | GET / PUT | ADMIN | 30/phút/user |
| `/hubs/monitoring` | realtime | WS | VIEWER+ | 10 kết nối/user |

**Không định tuyến ra ngoài:** `/internal/**`, `/health/**`, `/metrics`, `/swagger` (production), mọi endpoint quản trị của RabbitMQ/Seq.

```jsonc
// appsettings.json (trích)
"ReverseProxy": {
  "Routes": {
    "inventory-read": {
      "ClusterId": "inventory",
      "AuthorizationPolicy": "ViewerOrAbove",
      "RateLimiterPolicy": "per-user-read",
      "Match": { "Path": "/api/v1/nodes/{**catch-all}", "Methods": [ "GET" ] },
      "Transforms": [
        { "RequestHeaderRemove": "X-User-Id" },
        { "RequestHeaderRemove": "X-User-Role" },
        { "RequestHeadersCopy": "true" }
      ]
    }
  },
  "Clusters": {
    "inventory": {
      "LoadBalancingPolicy": "PowerOfTwoChoices",
      "HealthCheck": { "Active": { "Enabled": true, "Path": "/health/ready", "Interval": "00:00:10" } },
      "Destinations": { "d1": { "Address": "http://inventory:8080/" } }
    }
  }
}
```

## 3. Xác thực

### 3.1 Token

| Token | Định dạng | TTL | Lưu ở đâu | Ghi chú |
|---|---|---|---|---|
| Access token | JWT RS256 | **15 phút** | Bộ nhớ JS của SPA (không localStorage) | Claims: `sub`, `name`, `role`, `sid` (session), `jti`, `iss`, `aud`, `exp`, `iat` |
| Refresh token | Chuỗi ngẫu nhiên 256-bit, lưu **hash SHA-256** trong DB | **7 ngày**, trượt tối đa 30 ngày | Cookie `soe_rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` | **Xoay vòng** mỗi lần refresh |
| Service token | JWT client_credentials | 10 phút | Bộ nhớ service | Scope: `inventory.credentials.read`… |

### 3.2 Luồng đăng nhập & refresh

```mermaid
sequenceDiagram
    participant FE
    participant GW as Gateway
    participant ID as Identity
    FE->>GW: POST /auth/login {username, password}
    GW->>GW: rate limit 5/phút/IP
    GW->>ID: chuyển tiếp
    ID->>ID: Argon2id verify (thời gian hằng định, có dummy verify khi user không tồn tại)
    ID-->>FE: 200 {accessToken, expiresIn, user} + Set-Cookie soe_rt (rotation)
    Note over FE: lưu accessToken trong biến JS, không localStorage
    FE->>GW: GET /nodes (Bearer)
    GW-->>FE: 401 khi hết hạn
    FE->>GW: POST /auth/refresh (cookie tự gửi)
    ID->>ID: kiểm hash + trạng thái; token đã dùng lại → thu hồi cả family (reuse detection)
    ID-->>FE: 200 {accessToken} + cookie mới
```

**Khóa tài khoản:** 5 lần sai liên tiếp → khóa 15 phút (đếm theo `username` và theo IP), phát `UserLockedV1`, ghi audit. Thông báo trả về luôn là “Tên đăng nhập hoặc mật khẩu không đúng” (không lộ tài khoản tồn tại hay không).

**Mật khẩu:** băm **Argon2id** (memory 19 MiB, iterations 2, parallelism 1) hoặc PBKDF2-SHA512 600k vòng nếu môi trường hạn chế; chính sách: ≥ 12 ký tự, không nằm trong danh sách mật khẩu yếu, đổi mật khẩu thì thu hồi toàn bộ refresh token.

### 3.3 Xác minh JWT tại service

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = cfg["Identity:Authority"];          // http://identity:8080
        o.MetadataAddress = cfg["Identity:Jwks"];          // /.well-known/openid-configuration
        o.RequireHttpsMetadata = !env.IsDevelopment();
        o.TokenValidationParameters = new()
        {
            ValidateIssuer = true, ValidIssuer = "soe-identity",
            ValidateAudience = true, ValidAudience = "soe-api",
            ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true,
            RequireSignedTokens = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256]   // chặn alg=none / HS256 confusion
        };
        o.Events = new JwtBearerEvents {
            OnMessageReceived = ctx => { /* SignalR: đọc access_token từ query cho WS */ return Task.CompletedTask; }
        };
    });
```

**Xoay khóa ký:** Identity giữ 2 khóa (current + next), JWKS công bố cả hai, xoay mỗi 90 ngày; khóa lưu trong Key Vault / K8s Secret.

## 4. Phân quyền (RBAC)

| Hành động | ADMIN | OPERATOR | VIEWER |
|---|:---:|:---:|:---:|
| Xem dashboard, node, metric, incident | ✔ | ✔ | ✔ |
| Check now | ✔ | ✔ | ✘ |
| Acknowledge / Resolve incident | ✔ | ✔ | ✘ |
| Tạo / sửa / xóa node, test kết nối | ✔ | ✘ | ✘ |
| Bật/tắt giám sát node | ✔ | ✔ | ✘ |
| Quản lý alert channel, gửi thử | ✔ | ✘ | ✘ |
| Sửa threshold policy | ✔ | ✘ | ✘ |
| Quản lý người dùng | ✔ | ✘ | ✘ |
| Xem / xuất audit log | ✔ | ✘ | ✘ |
| Sửa cấu hình hệ thống (SMTP, chu kỳ quét) | ✔ | ✘ | ✘ |

```csharp
options.AddPolicy("ViewerOrAbove", p => p.RequireRole("ADMIN", "OPERATOR", "VIEWER"));
options.AddPolicy("OperatorOrAbove", p => p.RequireRole("ADMIN", "OPERATOR"));
options.AddPolicy("AdminOnly", p => p.RequireRole("ADMIN"));
```

Mỗi endpoint trong service vẫn khai báo `[Authorize(Policy = ...)]` — **không tin vào việc Gateway đã lọc** (phòng khi có đường vào nội bộ).

## 5. Ánh xạ OWASP API Security Top 10 (2023)

| Mã | Rủi ro | Biện pháp trong SOE v3 |
|---|---|---|
| **API1** Broken Object Level Authorization | Truy cập node/incident không thuộc quyền | Định danh dùng **GUID v7** (không đoán được); handler luôn kiểm tra quyền trên chính đối tượng; test `TC-*-SEC-*` thử id của người khác |
| **API2** Broken Authentication | Brute force, token yếu | Argon2id, khóa tài khoản, rate limit login, RS256, TTL ngắn, refresh rotation + reuse detection, logout thu hồi |
| **API3** Broken Object Property Level Authorization | Lộ/ghi đè trường nhạy cảm | DTO riêng cho request/response; **không bao giờ trả `passwordEncrypted`, `sshKey`, `passwordHash`**; cấm mass-assignment (không bind trực tiếp entity) |
| **API4** Unrestricted Resource Consumption | Query khổng lồ, spam check-now | Phân trang bắt buộc (`pageSize` ≤ 100), giới hạn `range` truy vấn metric, rate limit, timeout SSH, body ≤ 1 MB, giới hạn kết nối SignalR/user |
| **API5** Broken Function Level Authorization | Gọi endpoint quản trị bằng tài khoản thấp | Policy theo vai trò ở cả Gateway và service; kiểm thử ma trận vai trò × endpoint |
| **API6** Unrestricted Access to Sensitive Business Flows | Lạm dụng gửi thử email/webhook | Rate limit riêng (5/phút), yêu cầu ADMIN, ghi audit, chặn URL nội bộ (SSRF) |
| **API7** Server Side Request Forgery | Webhook URL trỏ vào mạng nội bộ / metadata cloud | Chỉ cho phép `https`, chặn IP private/loopback/link-local (`169.254.169.254`), resolve DNS và kiểm tra lại IP trước khi gửi, cấm redirect, timeout 5s |
| **API8** Security Misconfiguration | Header thiếu, CORS lỏng, stack trace lộ | Security headers bắt buộc (§6), CORS whitelist, `ProblemDetails` không chứa stack trace ở production, Swagger tắt ở production, image container chạy user non-root |
| **API9** Improper Inventory Management | Endpoint cũ/không tài liệu | API versioning `/api/v1`, OpenAPI sinh tự động cho mọi service, kiểm kê route trong CI, chặn route không khai báo tại Gateway (deny by default) |
| **API10** Unsafe Consumption of APIs | Phản hồi webhook/SMTP độc hại | Giới hạn kích thước phản hồi webhook (8 KB), không thực thi/parse nội dung trả về, timeout, validate chứng chỉ TLS |

## 6. Header bảo mật & CORS

| Header | Giá trị |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |
| `Cache-Control` (API) | `no-store` |
| `Content-Security-Policy` | Đặt ở nginx phục vụ SPA — xem [frontend_architecture.md](frontend_architecture.md) §5 |

CORS: chỉ `https://soe.example.com` (và `http://localhost:5173` ở môi trường dev), `AllowCredentials = true`, method/header khai báo tường minh; **không dùng** `AllowAnyOrigin`.

## 7. Chuẩn lỗi & validate đầu vào

- Mọi lỗi trả `application/problem+json` (RFC 7807):

```json
{
  "type": "https://docs.soe.local/errors/SOE-INV-409",
  "title": "Host đã tồn tại",
  "status": 409,
  "detail": "Đã có node sử dụng 192.168.1.10:22.",
  "instance": "/api/v1/nodes",
  "correlationId": "0HMV9…",
  "errors": { "host": ["Host/IP đã được đăng ký."] }
}
```

- Validate bằng **FluentValidation** ở Application layer; quy tắc dùng chung với FE (bảng đối chiếu trong từng SRS).
- Quy tắc tối thiểu cho input: độ dài tối đa mọi chuỗi, whitelist ký tự cho `host`/`name`, `port` 1–65535, enum chỉ nhận giá trị hợp lệ, GUID đúng định dạng, không nhận trường lạ (`JsonSerializerOptions.UnmappedMemberHandling = Disallow`).
- Chống injection: EF Core tham số hóa; **không nối chuỗi lệnh SSH từ input người dùng** — lệnh là hằng số, chỉ `host/port/username` được dùng làm tham số kết nối (đã validate).

## 8. Bảo vệ credential SSH

| Yêu cầu | Thực hiện |
|---|---|
| Mã hóa khi lưu | **AES-256-GCM**, mỗi bản ghi một nonce 96-bit ngẫu nhiên; lưu `keyId‖nonce‖ciphertext‖tag` (Base64) |
| Quản lý khóa | Khóa 256-bit từ K8s Secret / Azure Key Vault, biến môi trường `SOE_CRYPTO__KEYS__<keyId>`; hỗ trợ nhiều keyId để **xoay khóa** không cần downtime |
| Một điểm mã hóa | `ICredentialProtector` (Infrastructure) — cấm mã hóa thủ công ở controller (lỗi double-encrypt của v1) |
| Không lộ ra API | Response không có trường credential; cập nhật dùng cờ `changeCredential` |
| Truyền cho Worker | API nội bộ `GET /internal/nodes/{id}/credentials` — mTLS + scope `inventory.credentials.read`, TTL token 10 phút, ghi audit mỗi lần đọc |
| Trong bộ nhớ | Dùng `byte[]`/`char[]` và xóa sau khi dùng; không ghi log, không đưa vào exception message |
| Host key | Lưu fingerprint SHA-256 khi thêm node (TOFU có xác nhận của ADMIN); khác fingerprint → **từ chối kết nối** và mở sự cố `HOST_KEY_MISMATCH` |

## 9. Rate limiting (chi tiết)

Dùng `Microsoft.AspNetCore.RateLimiting` với store Redis để dùng chung giữa các replica.

| Policy | Thuật toán | Cấu hình |
|---|---|---|
| `login-ip` | Fixed window | 5 / 1 phút / IP, queue 0 |
| `login-user` | Sliding window | 10 / 1 giờ / username |
| `per-user-read` | Token bucket | 300 / phút, burst 60 |
| `per-user-write` | Token bucket | 60 / phút, burst 10 |
| `expensive` (check-now, test-email, test-connection) | Concurrency + fixed window | 5 / phút / user, tối đa 2 đồng thời |
| `anonymous` | Fixed window | 60 / phút / IP |

Vượt giới hạn → `429` + header `Retry-After`; ghi log cảnh báo và sự kiện audit khi một IP vượt liên tục.

## 10. Kiểm thử & vận hành bảo mật

| Hạng mục | Công cụ / chu kỳ |
|---|---|
| SAST | `dotnet list package --vulnerable`, CodeQL — mỗi PR |
| Dependency | Dependabot/Renovate + `npm audit` — hằng tuần |
| DAST | OWASP ZAP baseline vào môi trường staging — mỗi release |
| Secret scanning | gitleaks — mỗi PR |
| Image scanning | Trivy trên image container — mỗi build |
| Pentest | Thủ công theo checklist OWASP ASVS L2 — trước go-live |
| Kiểm thử phân quyền | Ma trận vai trò × endpoint tự động (`TC-GW-SEC-*`) — mỗi đêm |
