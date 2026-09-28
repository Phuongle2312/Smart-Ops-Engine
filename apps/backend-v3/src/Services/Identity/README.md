# Identity Service (`IDN`) — M1

> Trạng thái: ✅ **Đã hiện thực**. Đặc tả: [docs/02_srs/01_identity.md](../../../../../docs/02_srs/01_identity.md)

## Phạm vi

Nguồn sự thật duy nhất về người dùng và quyền: đăng nhập, phát hành JWT RS256 + refresh token xoay
vòng, khóa tài khoản, quản lý người dùng, công bố JWKS cho các service khác tự xác minh token.

## Cấu trúc

| Project | Nội dung chính |
|---|---|
| `SOE.Identity.Domain` | `User` (khóa tài khoản, đổi mật khẩu, đổi vai trò), `RefreshToken` (xoay vòng, thu hồi theo family), VO `Username`/`EmailAddress`, `IdentityErrors` |
| `SOE.Identity.Application` | 9 command + 3 query kèm validator; port `IUserRepository`, `ITokenService`, `IPasswordHasher`, `IPasswordPolicy` |
| `SOE.Identity.Infrastructure` | EF Core (`soe_identity`) + migration, `Argon2PasswordHasher`, `JwtTokenService` (RS256), `RsaKeyProvider`, `IdentityDbSeeder` |
| `SOE.Identity.Api` | Endpoint `/auth/*`, `/me`, `/users/*`, `/.well-known/jwks.json`, health check, rate limit đăng nhập |

## Đã hiện thực

`FR-IDN-001` … `FR-IDN-015` (trừ phần rate limit dùng Redis — hiện đếm trong tiến trình).

## Kiểm thử

- `tests/SOE.Identity.UnitTests` — 41 test (domain + application)
- Kịch bản thủ công: [docs-m1-smoke-test.md](../../../docs-m1-smoke-test.md)
- Còn nợ: test tích hợp API theo [TC-01_identity.md](../../../../../docs/04_test_cases/TC-01_identity.md)

## Lưu ý vận hành

- `Jwt__PrivateKeyPem` để trống ⇒ sinh khóa RSA tạm mỗi lần khởi động, token cũ mất hiệu lực sau restart. Production **bắt buộc** cấu hình khóa từ secret store.
- Môi trường `Development` tự chạy migration và seed tài khoản `admin`; production dùng Job migration riêng.
