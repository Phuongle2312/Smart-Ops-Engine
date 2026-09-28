# TC-01 — Identity Service (`IDN`)

> SRS: [01_identity.md](../02_srs/01_identity.md) · Use case: [UC-01_auth.md](../03_usecases/UC-01_auth.md)

## 1. Backend — API & Integration

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-IDN-API-001 | Đăng nhập thành công | Tài khoản `admin` đang hoạt động | `POST /api/v1/auth/login` | `{"username":"admin","password":"Admin@Test2026!"}` | 200; body có `accessToken`, `expiresIn=900`, `user.role="ADMIN"`; header `Set-Cookie: soe_rt=…; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; **không** có `passwordHash` | Functional | P1 | FR-IDN-001 |
| TC-IDN-API-002 | Sai mật khẩu | — | Đăng nhập với mật khẩu sai | `admin` / `SaiMatKhau1` | 401 `SOE-IDN-401`, thông báo “Tên đăng nhập hoặc mật khẩu không đúng.”; không có cookie | Security | P1 | BR-IDN-001 |
| TC-IDN-API-003 | Tài khoản không tồn tại | — | Đăng nhập với username lạ | `khongtontai` / `bat-ky` | 401 với **cùng** thông báo và mã như TC-002; chênh lệch thời gian phản hồi < 100 ms so với TC-002 | Security | P1 | BR-IDN-002 |
| TC-IDN-API-004 | Khóa sau 5 lần sai | Tài khoản `operator` mở khóa | Gọi login sai 5 lần rồi lần 6 | mật khẩu sai | Lần 6 trả 423 `SOE-IDN-423` kèm thời gian còn lại; DB `LockedUntil` = now+15′; phát `UserLockedV1` | Security | P1 | FR-IDN-005 |
| TC-IDN-API-005 | Đăng nhập đúng khi đang khóa | `locked_user` đang khóa | Login đúng mật khẩu | — | 423, không phát hành token | Security | P1 | FR-IDN-005 |
| TC-IDN-API-006 | Tự mở khóa sau 15 phút | `locked_user`, giả lập `IClock` +16′ | Login đúng | — | 200, `FailedLoginCount = 0` | Functional | P2 | FR-IDN-005 |
| TC-IDN-API-007 | Tài khoản bị vô hiệu hóa | `disabled_user` | Login đúng mật khẩu | — | 403 `SOE-IDN-403` | Security | P1 | BR-IDN-006 |
| TC-IDN-API-008 | Rate limit đăng nhập | — | Gửi 6 request login trong 1 phút cùng IP | — | Request thứ 6 trả 429 kèm `Retry-After` | Security | P1 | FR-GW-004 |
| TC-IDN-API-009 | Buộc đổi mật khẩu lần đầu | Người dùng vừa được tạo | Login | — | 200 với `mustChangePassword = true` | Functional | P2 | FR-IDN-006 |
| TC-IDN-API-010 | Claim của access token | Đã đăng nhập | Giải mã JWT | — | Có `sub`, `role`, `sid`, `jti`, `iss=soe-identity`, `aud=soe-api`, `pwd_at`; `alg=RS256`; **không** chứa email/hash | Security | P1 | BR-IDN-003 |
| TC-IDN-API-011 | Refresh thành công & xoay vòng | Có cookie refresh hợp lệ | `POST /auth/refresh` | cookie | 200, access token mới; cookie mới khác cookie cũ; bản ghi cũ có `UsedAt` | Functional | P1 | FR-IDN-002 |
| TC-IDN-API-012 | Tái sử dụng refresh token | Đã refresh một lần | Gọi refresh lại bằng token cũ | token cũ | 401; toàn bộ token cùng `FamilyId` bị thu hồi; audit `TOKEN_REUSE_DETECTED` | Security | P1 | FR-IDN-003 |
| TC-IDN-API-013 | Refresh token hết hạn | Token quá 7 ngày | `POST /auth/refresh` | — | 401 `SOE-IDN-402` | Functional | P2 | BR-IDN-005 |
| TC-IDN-API-014 | Đăng xuất | Đang đăng nhập | `POST /auth/logout` | Bearer token | 204; cookie bị xóa; refresh token bị thu hồi; dùng lại token cũ → 401 | Functional | P1 | FR-IDN-004 |
| TC-IDN-API-015 | Giới hạn 5 phiên | Đã đăng nhập 5 thiết bị | Đăng nhập thiết bị thứ 6 | — | Phiên cũ nhất bị thu hồi; tổng phiên hoạt động = 5 | Security | P3 | BR-IDN-008 |
| TC-IDN-API-016 | Token phát hành trước khi đổi mật khẩu | Đổi mật khẩu ở phiên khác | Gọi API bằng token cũ | — | 401 (so sánh `pwd_at` < `PasswordChangedAt`) | Security | P1 | BR-IDN-004 |
| TC-IDN-API-017 | `GET /me` | Đăng nhập OPERATOR | Gọi `/me` | — | 200 với `role="OPERATOR"` và danh sách `permissions` đúng | Functional | P2 | FR-IDN-009 |
| TC-IDN-API-018 | JWKS khả dụng | — | `GET /.well-known/jwks.json` | — | 200, chứa ≥ 1 khóa RSA có `kid`; cache header hợp lệ | Functional | P1 | FR-IDN-010 |
| TC-IDN-API-019 | Đổi mật khẩu thành công | Đăng nhập | `PUT /me/password` | `{current, new: "MatKhauMoi2026abc"}` | 204; mọi refresh token bị thu hồi; login bằng mật khẩu mới thành công | Functional | P1 | FR-IDN-008 |
| TC-IDN-API-020 | Sai mật khẩu hiện tại | Đăng nhập | `PUT /me/password` | current sai | 401, mật khẩu không đổi | Security | P1 | UC-IDN-03/E1 |
| TC-IDN-API-021 | Mật khẩu mới quá ngắn | Đăng nhập | `PUT /me/password` | new: `abc123` | 400, `errors.newPassword` = “Mật khẩu tối thiểu 12 ký tự, gồm chữ và số” | Validation | P1 | FR-IDN-008 |
| TC-IDN-API-022 | Mật khẩu mới trùng mật khẩu cũ | Đăng nhập | `PUT /me/password` | new = current | 400 với thông báo riêng | Validation | P2 | BR-IDN-007 |
| TC-IDN-API-023 | Mật khẩu nằm trong danh sách yếu | Đăng nhập | `PUT /me/password` | `Password123456` | 400 | Security | P2 | BR-IDN-007 |
| TC-IDN-API-024 | Băm mật khẩu là Argon2id | Đã tạo người dùng | Đọc DB | — | `PasswordHash` bắt đầu `$argon2id$`, khác nhau cho hai người dùng cùng mật khẩu (salt riêng) | Security | P1 | NFR-SEC-004 |
| TC-IDN-API-025 | ADMIN tạo người dùng | Đăng nhập ADMIN | `POST /users` | `{"username":"opr2","fullName":"Trần B","email":"b@example.com","role":"OPERATOR"}` | 201; trả mật khẩu tạm một lần; `mustChangePassword=true`; audit `USER_CREATED` | Functional | P1 | FR-IDN-006 |
| TC-IDN-API-026 | Trùng username | `opr2` đã tồn tại | `POST /users` | cùng username | 409 `SOE-IDN-409` | Validation | P1 | UC-IDN-04/E1 |
| TC-IDN-API-027 | Trùng email | — | `POST /users` | email đã dùng | 409 | Validation | P2 | FR-IDN-006 |
| TC-IDN-API-028 | Username sai định dạng | — | `POST /users` | `"Admin User!"` | 400, `errors.username` | Validation | P1 | SRS §6 |
| TC-IDN-API-029 | Đổi vai trò | Có `opr2` | `PUT /users/{id}` role → VIEWER | — | 200; audit `USER_ROLE_CHANGED`; token hiện tại của `opr2` mất quyền OPERATOR sau refresh | Functional | P1 | FR-IDN-007 |
| TC-IDN-API-030 | Vô hiệu hóa người dùng | `opr2` đang đăng nhập | `PUT /users/{id}/status` `{isActive:false}` | — | 200; refresh của `opr2` trả 401; access token cũ hết tác dụng ≤ 15 phút | Security | P1 | BR-IDN-006 |
| TC-IDN-API-031 | Chặn vô hiệu hóa ADMIN cuối cùng | Chỉ còn 1 ADMIN hoạt động | `PUT /users/{admin}/status` false | — | 422 `SOE-IDN-422` | Functional | P1 | FR-IDN-015 |
| TC-IDN-API-032 | Chặn hạ quyền ADMIN cuối cùng | như trên | `PUT /users/{admin}` role=VIEWER | — | 422 | Functional | P1 | FR-IDN-015 |
| TC-IDN-API-033 | Đặt lại mật khẩu | ADMIN | `POST /users/{id}/reset-password` | — | 200 với mật khẩu tạm; người dùng phải đổi khi đăng nhập; audit ghi nhận | Functional | P2 | FR-IDN-007 |
| TC-IDN-API-034 | Thu hồi mọi phiên | `opr2` đang đăng nhập 2 thiết bị | `POST /users/{id}/revoke-sessions` | — | 204; cả hai thiết bị phải đăng nhập lại | Security | P2 | FR-IDN-014 |
| TC-IDN-API-035 | Danh sách người dùng có lọc | Có ≥ 5 người dùng | `GET /users?role=OPERATOR&page=1&pageSize=2` | — | 200; đúng phân trang; response không chứa `passwordHash` | Functional | P2 | FR-IDN-013 |
| TC-IDN-API-036 | OPERATOR gọi API quản trị người dùng | Đăng nhập OPERATOR | `GET /users` | — | 403 | Security | P1 | NFR-SEC-008 |
| TC-IDN-INT-001 | Phát event khi đăng nhập | Bus test harness | Đăng nhập thành công | — | `UserLoggedInV1` được publish đúng một lần, có `correlationId` | Integration | P2 | FR-IDN-012 |
| TC-IDN-INT-002 | Event khi đăng nhập thất bại | — | Sai mật khẩu 1 lần | — | `UserLoginFailedV1` có `reason`, IP dạng băm | Integration | P2 | FR-IDN-012 |
| TC-IDN-INT-003 | Audit ghi đủ hành động người dùng | Audit chạy | Tạo + sửa + vô hiệu hóa người dùng | — | 3 bản ghi audit đúng `Action`, có diff, mật khẩu hiển thị `***` | Integration | P1 | FR-AUD-001 |

## 2. Frontend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-IDN-E2E-001 | Đăng nhập qua giao diện | Ứng dụng chạy | Nhập tài khoản đúng, bấm Đăng nhập | `admin` | Điều hướng tới `/app/dashboard`; header hiện tên và vai trò | Functional | P1 | FR-IDN-FE-001 |
| TC-IDN-E2E-002 | Validate form đăng nhập | Ở trang Login | Bấm Đăng nhập khi bỏ trống | — | Hai ô báo lỗi tiếng Việt; không gửi request nào | Validation | P1 | FR-IDN-FE-001 |
| TC-IDN-E2E-003 | Token không nằm trong localStorage | Đã đăng nhập | Kiểm tra `localStorage`/`sessionStorage` | — | Không có khóa nào chứa access token; cookie `soe_rt` không đọc được bằng `document.cookie` | Security | P1 | FR-IDN-FE-002, NFR-SEC-005 |
| TC-IDN-E2E-004 | Khôi phục phiên khi tải lại trang | Đã đăng nhập | F5 | — | Vẫn ở trạng thái đăng nhập nhờ `/auth/refresh`; không quay về Login | Functional | P1 | FR-IDN-FE-002 |
| TC-IDN-E2E-005 | Tự refresh khi access token hết hạn | Giả lập token hết hạn | Thao tác bất kỳ gọi API | — | Một request refresh duy nhất (single-flight); thao tác hoàn tất, người dùng không thấy gián đoạn | Integration | P1 | FR-IDN-FE-003 |
| TC-IDN-E2E-006 | Đếm ngược khi bị khóa | Tài khoản bị khóa | Đăng nhập | — | Hiện “Thử lại sau mm:ss” và nút bị vô hiệu hóa | UI/UX | P2 | FR-IDN-FE-004 |
| TC-IDN-E2E-007 | Bắt buộc đổi mật khẩu | `mustChangePassword=true` | Đăng nhập | — | Hộp thoại đổi mật khẩu mở, không thể đóng/điều hướng sang trang khác | Functional | P1 | FR-IDN-FE-005 |
| TC-IDN-E2E-008 | Menu theo vai trò | Đăng nhập VIEWER | Xem sidebar | — | Không có mục Người dùng, Kênh cảnh báo, Nhật ký, Cấu hình | UI/UX | P1 | FR-IDN-FE-006 |
| TC-IDN-E2E-009 | Truy cập URL bị cấm | Đăng nhập VIEWER | Mở `/app/users` | — | Chuyển hướng/thông báo không có quyền; API trả 403 | Security | P1 | FR-IDN-FE-006 |
| TC-IDN-E2E-010 | Tự đăng xuất khi không thao tác | Đăng nhập, chờ 30 phút (giả lập) | — | — | Tự đăng xuất, hiện thông báo, cache React Query bị xóa | Security | P2 | FR-IDN-FE-007 |
| TC-IDN-E2E-011 | Quản lý người dùng | Đăng nhập ADMIN | Tạo → sửa → vô hiệu hóa người dùng | — | Bảng cập nhật đúng; toast; mật khẩu tạm hiển thị một lần kèm nút sao chép | Functional | P1 | FR-IDN-FE-008 |
| TC-IDN-E2E-012 | Chặn vô hiệu hóa ADMIN cuối cùng (UI) | Chỉ còn 1 ADMIN | Thử vô hiệu hóa | — | Thông báo rõ ràng, trạng thái không đổi | UI/UX | P2 | FR-IDN-015 |
