# backend-v3 — Smart Ops Engine (.NET 8 Microservices)

Bản build lại theo [docs/](../../docs/README.md). Giai đoạn hiện tại: **M1 — BuildingBlocks + Gateway + Identity**.

## Trạng thái theo lộ trình

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M1 | BuildingBlocks, Gateway (YARP), Identity (JWT + RBAC) | ✅ Khung hoàn chỉnh, build & test xanh |
| M2 | Inventory, Monitoring (Scheduler + Worker), Metrics, RabbitMQ/MassTransit | 🔜 |
| M3 | Incident, Notification | 🔜 |
| M4 | Realtime (SignalR), Audit, System Config | 🔜 |
| M5 | Kubernetes, KEDA/HPA, observability, pentest, load test | 🔜 |

## Cấu trúc

```
apps/backend-v3/
 ├── SmartOpsEngine.sln
 ├── Directory.Build.props         # net8.0, nullable, TreatWarningsAsErrors
 ├── Directory.Packages.props      # Central Package Management
 ├── src/
 │   ├── BuildingBlocks/
 │   │   ├── SOE.BuildingBlocks.Domain           # Entity, AggregateRoot, Result, Error
 │   │   ├── SOE.BuildingBlocks.Application      # ICommand/IQuery, IClock, IUserContext, behaviors
 │   │   ├── SOE.BuildingBlocks.Infrastructure   # SystemClock, LoggingEventPublisher
 │   │   ├── SOE.BuildingBlocks.Web              # ProblemDetails, middleware, JWT, policy
 │   │   └── SOE.Contracts                       # Integration event (versioned)
 │   ├── Gateway/SOE.Gateway                     # YARP + JWT + RBAC + rate limit + CORS
 │   └── Services/Identity/
 │       ├── SOE.Identity.Domain                 # User, RefreshToken, value object, domain event
 │       ├── SOE.Identity.Application            # Command/Query + validator + port
 │       ├── SOE.Identity.Infrastructure         # EF Core, Argon2id, JWT RS256, seeder
 │       └── SOE.Identity.Api                    # Minimal API endpoints
 └── tests/
     ├── SOE.Identity.UnitTests                  # 41 test: domain + application
     └── SOE.ArchitectureTests                   # 8 test: ràng buộc layer (NetArchTest)
```

## Chạy nhanh

**Yêu cầu:** .NET SDK 8, SQL Server (hoặc Docker).

```bash
dotnet build apps/backend-v3/SmartOpsEngine.sln
```

```bash
dotnet test apps/backend-v3/SmartOpsEngine.sln
```

Chạy Identity (tự migrate + seed tài khoản `admin` ở môi trường Development):

```bash
dotnet run --project apps/backend-v3/src/Services/Identity/SOE.Identity.Api --urls http://localhost:5001
```

Chạy Gateway ở cửa sổ khác:

```bash
dotnet run --project apps/backend-v3/src/Gateway/SOE.Gateway --urls http://localhost:8080
```

Bằng Docker (từ thư mục gốc repo, sau khi tạo `deploy/docker/.env` từ `.env.example`):

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

Kịch bản kiểm thử nhanh đầy đủ: [docs-m1-smoke-test.md](docs-m1-smoke-test.md).

## Thử nhanh luồng đăng nhập

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin@Test2026!\"}"
```

```bash
curl -s http://localhost:8080/api/v1/me -H "Authorization: Bearer <access-token>"
```

## Endpoint đã có (M1)

| Method | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Ẩn danh (5 req/phút/IP) | Đăng nhập, trả access token + cookie refresh |
| POST | `/api/v1/auth/refresh` | Cookie | Làm mới token, xoay vòng refresh token |
| POST | `/api/v1/auth/logout` | Đã đăng nhập | Thu hồi refresh token |
| PUT | `/api/v1/me/password` | Đã đăng nhập | Đổi mật khẩu, thu hồi mọi phiên |
| GET | `/api/v1/me` | VIEWER+ | Thông tin bản thân + danh sách quyền |
| GET/POST | `/api/v1/users` | ADMIN | Danh sách / tạo người dùng |
| GET/PUT | `/api/v1/users/{id}` | ADMIN | Chi tiết / cập nhật |
| PUT | `/api/v1/users/{id}/status` | ADMIN | Bật/tắt tài khoản |
| POST | `/api/v1/users/{id}/reset-password` | ADMIN | Đặt lại mật khẩu (trả mật khẩu tạm một lần) |
| POST | `/api/v1/users/{id}/revoke-sessions` | ADMIN | Buộc đăng xuất mọi thiết bị |
| GET | `/.well-known/jwks.json` | Ẩn danh | Khóa công khai xác minh JWT |
| GET | `/health/live`, `/health/ready` | Ẩn danh (nội bộ) | Health check |

## Quyết định đã hiện thực (đối chiếu docs)

- Access token JWT **RS256, 15 phút**; refresh token opaque 7 ngày, **chỉ lưu hash SHA-256**, xoay vòng mỗi lần dùng, phát hiện tái sử dụng thì thu hồi cả chuỗi (FR-IDN-002, 003).
- Mật khẩu băm **Argon2id** 19 MiB / 2 vòng; có dummy verify giữ thời gian phản hồi hằng định (BR-IDN-002).
- Khóa tài khoản 15 phút sau 5 lần sai; tối đa 5 phiên/người dùng (FR-IDN-005, BR-IDN-008).
- Lỗi trả theo **RFC 7807** kèm `code`, `correlationId`, `errors` theo từng trường.
- Gateway xóa header `X-User-*` do client gắn rồi gắn lại từ JWT (FR-GW-006); bộ header bảo mật áp cho mọi response.
- Ràng buộc layer được kiểm tra tự động bằng `SOE.ArchitectureTests`.

## Việc còn lại của M1

- [ ] Rate limit dùng Redis thay vì bộ đếm trong tiến trình (TC-GW-SEC-012).
- [ ] Test tích hợp API bằng `WebApplicationFactory` + Testcontainers (TC-IDN-API-*).
- [ ] Nối frontend React vào API thật (FE Auth).
- [ ] Thay `LoggingEventPublisher` bằng MassTransit + outbox khi bước sang M2.
