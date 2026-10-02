# M1 — Kịch bản kiểm thử nhanh (smoke test)

Đối chiếu với [docs/04_test_cases/TC-01_identity.md](../../docs/04_test_cases/TC-01_identity.md).
Chạy sau khi Identity đã khởi động ở `http://localhost:5001` (hoặc qua Gateway `http://localhost:8080`).

> Các mục 1–5, 7 (phần xoay vòng), 9, 10 đã được tự động hóa trong
> [tools/scripts/smoke-m1.ps1](../../tools/scripts/smoke-m1.ps1); `tools/scripts/test-all.ps1 -Smoke` tự khởi động
> service rồi chạy script đó. Mục 6 (khóa tài khoản) và 8 (đổi mật khẩu) vẫn kiểm tra tay vì làm thay đổi tài khoản admin.

## 0. Khởi động

```bash
dotnet run --project apps/backend-v3/src/Services/Identity/SOE.Identity.Api --urls http://localhost:5001
```

Môi trường `Development` sẽ tự chạy migration và tạo tài khoản `admin`. Chuỗi kết nối lấy từ
`ConnectionStrings__Default`; mật khẩu admin ban đầu lấy từ `Identity__InitialAdminPassword`,
để trống thì hệ thống sinh ngẫu nhiên và ghi ra log **một lần**.

## 1. Đăng nhập — TC-IDN-API-001

```bash
curl -i -X POST http://localhost:5001/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin@Test2026!\"}"
```

Kỳ vọng: `200`; body có `accessToken`, `expiresIn: 900`, `user.role: "ADMIN"`;
header `Set-Cookie: soe_rt=…; httponly; samesite=strict; path=/api/v1/auth`;
bộ header bảo mật (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Cache-Control: no-store`) và `X-Correlation-Id`.

## 2. Gọi API có token — TC-IDN-API-017

```bash
curl -s http://localhost:5001/api/v1/me -H "Authorization: Bearer <access-token>"
```

Kỳ vọng: `200` kèm `permissions` tương ứng vai trò. Không gửi token ⇒ `401`.

## 3. Phân quyền — TC-IDN-API-036 / TC-GW-SEC-008

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/api/v1/users -H "Authorization: Bearer <token-cua-VIEWER>"
```

Kỳ vọng: `403` với VIEWER/OPERATOR, `200` với ADMIN.

## 4. Tạo người dùng & trùng dữ liệu — TC-IDN-API-025, 026

```bash
curl -s -X POST http://localhost:5001/api/v1/users -H "Authorization: Bearer <token-admin>" -H "Content-Type: application/json" -d "{\"username\":\"viewer01\",\"fullName\":\"Nguyen Van Xem\",\"email\":\"viewer01@example.com\",\"role\":\"VIEWER\"}"
```

Kỳ vọng: `201` kèm `temporaryPassword` (chỉ trả một lần). Gọi lại cùng `username` ⇒ `409` với
`code: SOE-IDN-409` theo định dạng ProblemDetails.

## 5. Rate limit đăng nhập — TC-IDN-API-008

Gửi 6 request login trong 1 phút từ cùng IP ⇒ request thứ 6 trả `429`, header `Retry-After: 60`,
body có `code: SOE-GW-429`.

## 6. Khóa tài khoản — TC-IDN-API-004, 005

Sai mật khẩu 5 lần liên tiếp (chú ý rate limit ở mục 5 — chờ hết cửa sổ giữa các đợt) ⇒ lần thứ 5
trả `423` với `code: SOE-IDN-423` và thông báo số phút còn lại. Đăng nhập đúng mật khẩu trong lúc
đang khóa vẫn trả `423`.

## 7. Xoay vòng refresh token — TC-IDN-API-011, 012

```bash
curl -s -b cookies.txt -c cookies-new.txt -X POST http://localhost:5001/api/v1/auth/refresh
```

Kỳ vọng: `200`, cookie `soe_rt` **khác** giá trị cũ. Gọi lại bằng cookie cũ ⇒ `401`
(`SOE-IDN-402`) và **toàn bộ chuỗi token bị thu hồi** ⇒ cookie mới cũng không dùng được nữa.

## 8. Đổi mật khẩu — TC-IDN-API-019…021

```bash
curl -i -X PUT http://localhost:5001/api/v1/me/password -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"currentPassword\":\"Admin@Test2026!\",\"newPassword\":\"MatKhauMoi2026abc\"}"
```

Kỳ vọng: `204`; mọi refresh token bị thu hồi; mật khẩu mới < 12 ký tự ⇒ `400` kèm
`errors.newPassword` bằng tiếng Việt.

## 9. JWKS — TC-IDN-API-018

```bash
curl -s http://localhost:5001/.well-known/jwks.json
```

Kỳ vọng: `200`, có đúng một khóa RSA `alg: RS256` kèm `kid`, **không** chứa tham số private key.

## 10. Health check

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/health/ready
```

Kỳ vọng: `200` khi kết nối được CSDL; `503` khi CSDL ngừng.
