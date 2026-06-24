# 01 — Xác thực & Phân quyền — Backend

> **Trạng thái:** `[BE v2.0 🔜]` — Chưa có trong source code hiện tại. Toàn bộ API đang public.

---

## Hiện trạng v1.0

Không có authentication. Mọi endpoint `/api/**` đều public, không cần token. Đây là rủi ro bảo mật cần khắc phục ở v2.0.

---

## Yêu cầu v2.0

### 1. Entity: `Users`

**Bảng SQL Server:**

| Cột             | Kiểu           | Ràng buộc              | Mô tả                        |
| :-------------- | :------------- | :--------------------- | :--------------------------- |
| `id`            | `BIGINT`       | PK, IDENTITY           | Khóa chính tự tăng           |
| `username`      | `VARCHAR(100)` | NOT NULL, UNIQUE       | Tên đăng nhập                |
| `password_hash` | `VARCHAR(255)` | NOT NULL               | BCrypt hash (strength 12)    |
| `full_name`     | `VARCHAR(255)` | NOT NULL               | Họ tên hiển thị              |
| `email`         | `VARCHAR(255)` | NOT NULL, UNIQUE       | Email liên hệ                |
| `role`          | `VARCHAR(20)`  | NOT NULL, Default USER | `ADMIN` hoặc `VIEWER`        |
| `is_active`     | `BIT`          | NOT NULL, Default 1    | Tài khoản còn hiệu lực       |
| `created_at`    | `DATETIME2`    | NOT NULL               | Thời điểm tạo                |
| `last_login_at` | `DATETIME2`    | NULL                   | Lần đăng nhập gần nhất       |

> Mật khẩu KHÔNG BAO GIỜ lưu plaintext — chỉ lưu BCrypt hash.

### 2. JWT Authentication Flow

```
POST /api/auth/login
Body: { "username": "admin", "password": "secret123" }

1. Load UserDetails từ UserRepository
2. PasswordEncoder.matches(rawPassword, hashFromDB)
3. Nếu khớp: phát sinh 2 token
   - Access Token (JWT, TTL 1h, ký HMAC-SHA256 với JWT_SECRET)
   - Refresh Token (opaque random string, TTL 7 ngày, lưu DB hoặc Redis)
4. Set Refresh Token vào httpOnly cookie (SameSite=Strict)
5. Trả về Access Token trong response body

Response 200:
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 3600,
  "user": { "id": 1, "username": "admin", "role": "ADMIN", "fullName": "..." }
}

Response 401: { "error": "Invalid credentials" }
```

```
POST /api/auth/refresh
Cookie: refresh_token=<opaque_token> (auto-sent, httpOnly)

1. Đọc Refresh Token từ cookie
2. Xác thực token còn hạn, tìm user liên kết
3. Phát sinh Access Token mới

Response 200: { "accessToken": "eyJhbGci...", "expiresIn": 3600 }
Response 401: { "error": "Refresh token expired or invalid" }
```

```
POST /api/auth/logout
Header: Authorization: Bearer <accessToken>

1. Vô hiệu hóa Refresh Token (xóa khỏi DB/Redis)
2. Xóa httpOnly cookie

Response 204: No Content
```

### 3. JWT Authentication Filter

```java
// Thực thi trên mỗi request tới /api/**
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(request, response, chain) {
        String token = extractBearerToken(request);     // Authorization header
        if (token != null && jwtService.isValid(token)) {
            UsernamePasswordAuthenticationToken auth = jwtService.getAuthentication(token);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}
```

**Endpoint miễn xác thực:** `/api/auth/**`, `/actuator/health`

### 4. RBAC (Role-Based Access Control)

| Role           | Quyền hạn                                                                              |
| :------------- | :------------------------------------------------------------------------------------- |
| `ROLE_ADMIN`   | Toàn quyền: CRUD Node, resolve/acknowledge incident, quản lý Alert Channels, Audit Log |
| `ROLE_VIEWER`  | Chỉ đọc: GET /api/nodes, GET /api/incidents, GET /api/nodes/{id}/metrics              |

Cấu hình Spring Security:
```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/nodes/**", "/api/incidents").hasAnyRole("ADMIN", "VIEWER")
    .requestMatchers("/api/nodes/**", "/api/incidents/**", "/api/alert-channels/**").hasRole("ADMIN")
    .anyRequest().authenticated()
);
```

### 5. Rate Limiting

| Endpoint              | Giới hạn              | Mục đích            |
| :-------------------- | :-------------------- | :------------------ |
| `POST /api/auth/login`| 10 lần/phút/IP        | Chặn brute force    |
| `POST /api/check-now` | 5 lần/phút/user       | Tránh lạm dụng      |

Triển khai bằng `Bucket4j` hoặc Spring interceptor + ConcurrentHashMap counter.

### 6. API Endpoints

| Method | Endpoint            | Auth   | Request Body                     | Response     |
| :----- | :------------------ | :----- | :------------------------------- | :----------- |
| POST   | `/api/auth/login`   | Không  | `{username, password}`           | 200 / 401    |
| POST   | `/api/auth/refresh` | Cookie | —                                | 200 / 401    |
| POST   | `/api/auth/logout`  | JWT    | —                                | 204          |

### 7. Bảo mật bổ sung

- `JWT_SECRET` phải là chuỗi ngẫu nhiên ≥ 64 ký tự, đọc từ biến môi trường.
- HTTPS bắt buộc ở production (`server.ssl.enabled=true`).
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`.
- CORS chỉ cho phép origin của Frontend domain (cấu hình `CorsConfigurationSource`).

---

**Xem thêm:** [FE Auth](fe.md) · [09 System Config](../09_system_config/be.md)
