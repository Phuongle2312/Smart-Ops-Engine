# SRS 01 — Identity Service (`IDN`)

> Xác thực, phiên đăng nhập, quản lý người dùng và phân quyền.
> Liên quan: [api_gateway_security.md](../01_architecture/api_gateway_security.md) · [data_architecture.md §3.1](../01_architecture/data_architecture.md)

---

## 1. Mục đích & phạm vi

Identity là nguồn sự thật duy nhất về **người dùng và quyền**. Service phát hành access token (JWT RS256) cho SPA, refresh token xoay vòng, token client-credentials cho giao tiếp nội bộ, và công bố JWKS để các service khác tự xác minh token mà không cần gọi ngược lại.

Ngoài phạm vi v3: SSO/OIDC bên ngoài, MFA (thiết kế để bổ sung: cột `MfaSecret` dự phòng), tự đăng ký tài khoản.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-IDN-001 | Người dùng đăng nhập bằng `username` + `password`; thành công nhận access token (15 phút) trong body và refresh token trong cookie `HttpOnly`. | Must |
| FR-IDN-002 | Hệ thống làm mới access token bằng refresh token; refresh token cũ bị vô hiệu và thay bằng token mới (rotation). | Must |
| FR-IDN-003 | Phát hiện tái sử dụng refresh token đã dùng ⇒ thu hồi toàn bộ token cùng `FamilyId`, ghi audit `TOKEN_REUSE_DETECTED`. | Must |
| FR-IDN-004 | Đăng xuất: thu hồi refresh token hiện tại và xóa cookie. | Must |
| FR-IDN-005 | Khóa tài khoản 15 phút sau 5 lần đăng nhập sai liên tiếp; tự mở khóa khi hết hạn. | Must |
| FR-IDN-006 | ADMIN tạo người dùng mới với vai trò `ADMIN`/`OPERATOR`/`VIEWER`; mật khẩu khởi tạo bắt buộc đổi ở lần đăng nhập đầu. | Must |
| FR-IDN-007 | ADMIN sửa thông tin (họ tên, email, vai trò), bật/tắt tài khoản, đặt lại mật khẩu. | Must |
| FR-IDN-008 | Người dùng tự đổi mật khẩu (nhập mật khẩu hiện tại); đổi xong thu hồi mọi refresh token của người đó. | Must |
| FR-IDN-009 | Trả thông tin người đang đăng nhập (`GET /me`) gồm vai trò và danh sách quyền. | Must |
| FR-IDN-010 | Công bố JWKS tại `/.well-known/jwks.json` và metadata OIDC tối thiểu. | Must |
| FR-IDN-011 | Cấp token client-credentials cho service nội bộ theo `clientId`/`clientSecret` + `scope`. | Must |
| FR-IDN-012 | Ghi nhận lịch sử đăng nhập (thành công/thất bại, IP băm, user agent băm) và phát event cho Audit. | Must |
| FR-IDN-013 | ADMIN xem danh sách người dùng có lọc theo vai trò/trạng thái và phân trang. | Should |
| FR-IDN-014 | ADMIN thu hồi mọi phiên của một người dùng (force logout). | Should |
| FR-IDN-015 | Không cho phép vô hiệu hóa/hạ quyền tài khoản ADMIN cuối cùng còn hoạt động. | Must |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-IDN-001 | Thông báo đăng nhập thất bại luôn là “Tên đăng nhập hoặc mật khẩu không đúng”, không phân biệt sai tài khoản hay sai mật khẩu, không tiết lộ tài khoản bị khóa cho tới khi xác thực đúng mật khẩu. |
| BR-IDN-002 | Thời gian xử lý đăng nhập phải gần như hằng định: khi không tìm thấy user vẫn thực hiện một phép băm giả (dummy verify). |
| BR-IDN-003 | Access token không chứa dữ liệu nhạy cảm; claim gồm `sub`, `name`, `role`, `sid`, `jti`, `iss`, `aud`, `iat`, `exp`, `pwd_at`. |
| BR-IDN-004 | Token phát hành trước `PasswordChangedAt` bị từ chối (so sánh claim `pwd_at`). |
| BR-IDN-005 | Refresh token trượt hạn nhưng tổng vòng đời một `FamilyId` tối đa 30 ngày. |
| BR-IDN-006 | Tài khoản `IsActive = false` không đăng nhập được và mọi refresh token bị thu hồi ngay khi bị vô hiệu hóa. |
| BR-IDN-007 | Mật khẩu mới không được trùng mật khẩu hiện tại; kiểm tra danh sách mật khẩu phổ biến (top 10k). |
| BR-IDN-008 | Một người dùng có tối đa 5 phiên (refresh token) còn hiệu lực; vượt quá thì thu hồi phiên cũ nhất. |

## 4. Mô hình miền

```
User (AggregateRoot)
 ├─ Username (VO: chuẩn hóa chữ thường, regex)
 ├─ Email (VO)
 ├─ PasswordHash (VO: Argon2id)
 ├─ Role (enum: ADMIN | OPERATOR | VIEWER)
 ├─ IsActive, FailedLoginCount, LockedUntil, PasswordChangedAt, LastLoginAt
 ├─ RegisterFailedLogin(now) / RegisterSuccessfulLogin(now)
 ├─ ChangePassword(newHash, now) → thu hồi phiên
 └─ Deactivate() / Activate() / ChangeRole(role)

RefreshToken (Entity): TokenHash, FamilyId, ExpiresAt, UsedAt, RevokedAt, RevokedReason
```

Domain event: `UserLoggedIn`, `UserLoginFailed`, `UserLocked`, `UserCreated`, `UserUpdated`, `UserPasswordChanged`, `TokenReuseDetected`.

## 5. Hợp đồng API

Base: `/api/v1` (qua Gateway).

### 5.1 `POST /auth/login` — Ẩn danh

```json
// Request
{ "username": "admin", "password": "MatKhauRatManh2026" }
```
```json
// 200 OK
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs…",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "mustChangePassword": false,
  "user": { "id": "0192…", "username": "admin", "fullName": "Quản trị hệ thống", "role": "ADMIN" }
}
// + Set-Cookie: soe_rt=…; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
```

| Mã lỗi | HTTP | Thông báo |
|---|---|---|
| `SOE-IDN-401` | 401 | Tên đăng nhập hoặc mật khẩu không đúng. |
| `SOE-IDN-423` | 423 | Tài khoản đang tạm khóa. Vui lòng thử lại sau {n} phút. |
| `SOE-IDN-403` | 403 | Tài khoản đã bị vô hiệu hóa. |
| `SOE-GW-429` | 429 | Bạn thử quá nhiều lần. Vui lòng đợi {Retry-After} giây. |

### 5.2 `POST /auth/refresh` — Cookie

`200` trả `accessToken` mới + cookie mới. `401` `SOE-IDN-402` “Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.” Khi phát hiện tái sử dụng: `401` + thu hồi family + audit.

### 5.3 `POST /auth/logout` — Đã đăng nhập → `204`

### 5.4 `GET /me`

```json
{ "id": "0192…", "username": "operator01", "fullName": "Nguyễn Văn A", "email": "a@example.com",
  "role": "OPERATOR", "permissions": ["node:read","incident:ack","incident:resolve","check:run"],
  "lastLoginAt": "2026-09-23T01:12:00Z" }
```

### 5.5 `PUT /me/password`

```json
{ "currentPassword": "…", "newPassword": "…" }   // 204 | 400 SOE-IDN-400 | 401
```

### 5.6 Quản trị người dùng (ADMIN)

| Method | Endpoint | Mô tả | Mã trả về |
|---|---|---|---|
| GET | `/users?role=&isActive=&search=&page=1&pageSize=20` | Danh sách phân trang | 200 |
| POST | `/users` | Tạo người dùng | 201, 409 `SOE-IDN-409` (trùng username/email) |
| GET | `/users/{id}` | Chi tiết | 200, 404 |
| PUT | `/users/{id}` | Sửa họ tên, email, vai trò | 200, 404, 409, 422 `SOE-IDN-422` (ADMIN cuối cùng) |
| PUT | `/users/{id}/status` | Bật/tắt | 200, 422 |
| POST | `/users/{id}/reset-password` | Đặt lại mật khẩu tạm | 200 (trả mật khẩu tạm một lần duy nhất) |
| POST | `/users/{id}/revoke-sessions` | Thu hồi mọi phiên | 204 |

**Response `UserResponse` không bao giờ chứa** `passwordHash`, `failedLoginCount` (chỉ ADMIN thấy `lockedUntil`).

### 5.7 Nội bộ

| Endpoint | Mô tả |
|---|---|
| `POST /internal/connect/token` | client_credentials → JWT scope nội bộ (mTLS) |
| `GET /.well-known/jwks.json` | Khóa công khai (cache 10 phút) |

## 6. Quy tắc validate

| Trường | Backend (FluentValidation) | Frontend (zod) |
|---|---|---|
| `username` | bắt buộc, 3–64, `^[a-z0-9._-]+$`, chuẩn hóa chữ thường | như backend |
| `password` (đăng nhập) | bắt buộc, ≤ 256 | bắt buộc |
| `newPassword` | ≥ 12, có chữ + số, ≠ mật khẩu cũ, không nằm trong danh sách yếu | ≥ 12, có chữ + số, khớp ô xác nhận |
| `fullName` | bắt buộc, ≤ 128 | như backend |
| `email` | bắt buộc, RFC 5322 rút gọn, ≤ 256, unique | định dạng email |
| `role` | thuộc enum | select cố định |
| `page`/`pageSize` | ≥ 1 / 1–100 | — |

## 7. Sự kiện phát ra

| Event | Khi nào | Consumer |
|---|---|---|
| `UserLoggedInV1` | Đăng nhập thành công | Audit |
| `UserLoginFailedV1` | Sai mật khẩu / tài khoản không tồn tại | Audit (+ cảnh báo brute-force) |
| `UserLockedV1` | Khóa do sai 5 lần | Audit, Notification (tùy chọn) |
| `UserChangedV1` | Tạo/sửa/đổi vai trò/bật tắt | Audit |
| `TokenReuseDetectedV1` | Tái sử dụng refresh token | Audit (mức Security) |

## 8. Phía Frontend

**Màn hình:** `Login`, `Users` (mới), hộp thoại “Đổi mật khẩu” trong `Header`.

| Yêu cầu FE | Mô tả |
|---|---|
| FR-IDN-FE-001 | Form đăng nhập validate client (username/password bắt buộc), hiện lỗi dưới từng ô; nút submit có trạng thái loading và bị khóa khi đang gửi. |
| FR-IDN-FE-002 | Lưu access token trong bộ nhớ (module scope), **không** `localStorage`; khôi phục phiên khi tải lại trang bằng `/auth/refresh` (cookie). |
| FR-IDN-FE-003 | Interceptor tự refresh khi gặp 401 (single-flight, tối đa 1 lần/chu kỳ), thất bại thì chuyển về `/login` kèm `returnUrl` nội bộ. |
| FR-IDN-FE-004 | Hiện đếm ngược khi nhận 423/429 (“Thử lại sau 14:59”). |
| FR-IDN-FE-005 | Nếu `mustChangePassword = true`, bắt buộc mở hộp thoại đổi mật khẩu, chặn điều hướng sang trang khác. |
| FR-IDN-FE-006 | Sidebar/menu và nút hành động ẩn theo vai trò (`RequireRole`); vẫn phải xử lý 403 từ API. |
| FR-IDN-FE-007 | Tự đăng xuất sau 30 phút không thao tác; xóa cache React Query khi đăng xuất. |
| FR-IDN-FE-008 | Màn hình `Users`: bảng phân trang, bộ lọc vai trò/trạng thái, modal tạo/sửa, xác nhận khi vô hiệu hóa, thông báo rõ khi bị chặn do “ADMIN cuối cùng”. |

## 9. Bảo mật riêng của module

- Băm Argon2id; tham số cấu hình được, đo và giữ thời gian băm ~200 ms trên phần cứng đích.
- Khóa ký RSA 2048+ lưu trong secret store; xoay 90 ngày với 2 khóa song song.
- Không trả về thông tin phân biệt tài khoản tồn tại ở mọi endpoint công khai.
- Mật khẩu tạm khi reset: dùng một lần, hết hạn 24 giờ, bắt buộc đổi.
- Mọi hành động quản trị ghi audit kèm `correlationId`.

## 10. Phụ thuộc & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Phụ thuộc | SQL Server (`soe_identity`), Redis (đếm rate limit đăng nhập), RabbitMQ (event audit) |
| Rủi ro | Redis mất ⇒ rate limit rơi về bộ đếm cục bộ (chặt hơn, per-pod); DB mất ⇒ toàn hệ thống không đăng nhập được (token còn hạn vẫn dùng được tối đa 15 phút) |
| Hiệu năng | Đăng nhập p95 ≤ 700 ms (do chi phí Argon2id có chủ đích); các endpoint khác theo NFR-PERF-001 |
