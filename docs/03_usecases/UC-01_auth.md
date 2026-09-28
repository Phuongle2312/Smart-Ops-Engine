# UC-IDN — Xác thực & Quản lý người dùng

---

## UC-IDN-01 — Đăng nhập hệ thống

| Mục | Nội dung |
|---|---|
| **Actor chính** | Người dùng (ADMIN / OPERATOR / VIEWER) |
| **Actor phụ** | Identity Service, Audit Service |
| **Ưu tiên** | Must · **Tần suất**: nhiều lần/ngày |
| **Tiền điều kiện** | Tài khoản đã được ADMIN tạo và đang hoạt động; người dùng truy cập được `https://soe.example.com` |
| **Kích hoạt** | Người dùng mở ứng dụng mà chưa có phiên hợp lệ |

**Luồng chính**

1. Hệ thống hiển thị trang đăng nhập với ô “Tên đăng nhập”, “Mật khẩu” và nút “Đăng nhập”.
2. Người dùng nhập thông tin và bấm “Đăng nhập”.
3. Frontend validate: cả hai ô bắt buộc, `username` đúng định dạng. Không hợp lệ → hiện lỗi tại ô, dừng.
4. Frontend gọi `POST /api/v1/auth/login`.
5. Gateway kiểm tra rate limit (5 lần/phút/IP) và chuyển tiếp.
6. Identity tìm người dùng, xác minh mật khẩu bằng Argon2id.
7. Identity đặt lại `failedLoginCount`, cập nhật `lastLoginAt`, phát hành access token (15 phút) và refresh token (cookie `HttpOnly`), phát `UserLoggedInV1`.
8. Frontend lưu access token trong bộ nhớ, khởi tạo kết nối SignalR, điều hướng tới Dashboard (hoặc `returnUrl` nội bộ).
9. Audit ghi `LOGIN_SUCCEEDED`.

**Luồng thay thế**

- **A1 — Bắt buộc đổi mật khẩu:** bước 7 trả `mustChangePassword = true` → frontend mở hộp thoại đổi mật khẩu và chặn điều hướng cho tới khi đổi xong (UC-IDN-03).
- **A2 — Còn phiên hợp lệ:** ở bước 1, nếu cookie refresh còn hạn, frontend gọi `/auth/refresh` và vào thẳng Dashboard.
- **A3 — Có `returnUrl`:** sau khi đăng nhập, điều hướng tới đường dẫn nội bộ đã lưu (chỉ nhận đường dẫn bắt đầu bằng `/`).

**Luồng ngoại lệ**

- **E1 — Sai thông tin:** Identity tăng `failedLoginCount`, phát `UserLoginFailedV1`, trả `401 SOE-IDN-401`; frontend hiện “Tên đăng nhập hoặc mật khẩu không đúng.” (không nói rõ sai ở đâu — BR-IDN-001).
- **E2 — Sai 5 lần:** tài khoản bị khóa 15 phút, trả `423 SOE-IDN-423`; frontend hiện đếm ngược; Audit ghi `ACCOUNT_LOCKED`.
- **E3 — Tài khoản bị vô hiệu hóa:** trả `403 SOE-IDN-403` “Tài khoản đã bị vô hiệu hóa.”
- **E4 — Vượt rate limit:** `429` + `Retry-After`; frontend hiện “Bạn thử quá nhiều lần, vui lòng đợi {n} giây.”
- **E5 — Identity không phản hồi:** gateway trả `503`; frontend hiện “Hệ thống tạm thời không khả dụng, vui lòng thử lại.”

**Hậu điều kiện**

- Thành công: người dùng có phiên, access token 15 phút, refresh token 7 ngày; audit ghi nhận.
- Thất bại: không phát hành token; số lần sai được ghi nhận.

**BR liên quan:** BR-IDN-001, 002, 006 · **NFR:** NFR-SEC-004, 005, 006; đăng nhập p95 ≤ 700 ms
**Test case:** TC-IDN-API-001…010, TC-IDN-E2E-001…004, TC-IDN-SEC-001…005

---

## UC-IDN-02 — Duy trì phiên & đăng xuất

| Mục | Nội dung |
|---|---|
| **Actor chính** | Người dùng · **Actor phụ**: Identity |
| **Tiền điều kiện** | Đang có phiên hợp lệ |
| **Kích hoạt** | Access token hết hạn, hoặc người dùng bấm “Đăng xuất” |

**Luồng chính (làm mới token)**

1. Frontend gọi API nghiệp vụ và nhận `401`.
2. Interceptor tạm giữ mọi request đang chờ (single-flight) và gọi `POST /auth/refresh` (cookie tự gửi).
3. Identity xác minh hash refresh token, kiểm tra chưa dùng và chưa thu hồi.
4. Identity đánh dấu token cũ đã dùng, phát hành access token mới + refresh token mới cùng `FamilyId`.
5. Frontend cập nhật token trong bộ nhớ và gửi lại các request đang chờ.

**Luồng thay thế**

- **A1 — Đăng xuất chủ động:** người dùng bấm “Đăng xuất” → `POST /auth/logout` → thu hồi refresh token, xóa cookie, đóng SignalR, xóa cache React Query, chuyển về `/login`.
- **A2 — Hết hạn phiên do không thao tác:** sau 30 phút không tương tác, frontend tự đăng xuất và hiện thông báo “Phiên làm việc đã kết thúc”.

**Luồng ngoại lệ**

- **E1 — Refresh token hết hạn/không hợp lệ:** `401 SOE-IDN-402`; frontend chuyển về `/login` kèm `returnUrl`.
- **E2 — Phát hiện tái sử dụng token:** Identity thu hồi toàn bộ `FamilyId`, ghi `TOKEN_REUSE_DETECTED`, trả `401`; mọi thiết bị của người dùng bị đăng xuất.
- **E3 — Người dùng bị vô hiệu hóa giữa phiên:** refresh bị từ chối; token cũ hết hiệu lực trong tối đa 15 phút.
- **E4 — Đổi mật khẩu ở thiết bị khác:** mọi refresh token bị thu hồi (BR-IDN-004) → E1.

**Hậu điều kiện:** phiên được gia hạn liền mạch hoặc chấm dứt sạch (không còn token, không còn cache).

**BR:** BR-IDN-003, 004, 005, 008 · **NFR:** NFR-SEC-005 · **Test case:** TC-IDN-API-011…018, TC-IDN-SEC-006…009

---

## UC-IDN-03 — Đổi mật khẩu

| Mục | Nội dung |
|---|---|
| **Actor chính** | Người dùng bất kỳ · **Tiền điều kiện**: đã đăng nhập |
| **Kích hoạt** | Người dùng chọn “Đổi mật khẩu”, hoặc hệ thống yêu cầu (`mustChangePassword`) |

**Luồng chính**

1. Người dùng mở hộp thoại đổi mật khẩu.
2. Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu mới.
3. Frontend validate: ≥ 12 ký tự, có chữ và số, hai ô mới khớp nhau, khác mật khẩu hiện tại; hiện thanh đo độ mạnh.
4. Gọi `PUT /api/v1/me/password`.
5. Identity xác minh mật khẩu hiện tại, kiểm tra chính sách và danh sách mật khẩu yếu, cập nhật hash và `PasswordChangedAt`, thu hồi toàn bộ refresh token.
6. Frontend nhận `204`, hiện toast, đăng xuất và yêu cầu đăng nhập lại bằng mật khẩu mới.
7. Audit ghi `USER_PASSWORD_CHANGED`.

**Luồng ngoại lệ**

- **E1 — Sai mật khẩu hiện tại:** `401`; hiện lỗi tại ô mật khẩu hiện tại.
- **E2 — Mật khẩu mới không đạt chính sách/nằm trong danh sách yếu:** `400 SOE-IDN-400` kèm `errors.newPassword`.
- **E3 — Mật khẩu mới trùng mật khẩu cũ:** `400` với thông báo riêng (BR-IDN-007).

**Hậu điều kiện:** mật khẩu mới có hiệu lực; mọi phiên cũ bị thu hồi.
**Test case:** TC-IDN-API-019…024, TC-IDN-E2E-005

---

## UC-IDN-04 — Quản lý người dùng

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Tiền điều kiện**: đăng nhập với vai trò ADMIN |
| **Kích hoạt** | ADMIN mở màn hình “Người dùng” |

**Luồng chính (tạo người dùng)**

1. ADMIN mở màn hình `Users`, thấy danh sách phân trang có bộ lọc vai trò/trạng thái.
2. Bấm “Thêm người dùng”, nhập `username`, họ tên, email, vai trò.
3. Frontend validate theo bảng quy tắc (SRS 01 §6).
4. Gọi `POST /api/v1/users`.
5. Identity tạo tài khoản với mật khẩu tạm, đặt `mustChangePassword = true`.
6. Hệ thống hiển thị mật khẩu tạm **một lần duy nhất** kèm nút sao chép và cảnh báo không hiển thị lại.
7. Audit ghi `USER_CREATED`.

**Luồng thay thế**

- **A1 — Sửa người dùng:** đổi họ tên/email/vai trò → `PUT /users/{id}`; đổi vai trò làm token hiện tại của người đó mất quyền ở lần refresh kế tiếp.
- **A2 — Vô hiệu hóa/kích hoạt:** `PUT /users/{id}/status`; vô hiệu hóa kéo theo thu hồi mọi phiên.
- **A3 — Đặt lại mật khẩu:** `POST /users/{id}/reset-password` → mật khẩu tạm mới, `mustChangePassword = true`.
- **A4 — Buộc đăng xuất:** `POST /users/{id}/revoke-sessions`.

**Luồng ngoại lệ**

- **E1 — Trùng username/email:** `409 SOE-IDN-409`, lỗi gắn vào đúng ô.
- **E2 — Hạ quyền/vô hiệu hóa ADMIN cuối cùng:** `422 SOE-IDN-422` “Không thể vô hiệu hóa quản trị viên cuối cùng.” (FR-IDN-015).
- **E3 — ADMIN tự vô hiệu hóa chính mình:** chặn ở backend với cùng mã lỗi.
- **E4 — Người dùng không tồn tại:** `404`.

**Hậu điều kiện:** danh sách người dùng phản ánh thay đổi; mọi thao tác có bản ghi audit.

**BR:** BR-IDN-006, 008 · **NFR:** NFR-SEC-008, NFR-SEC-012
**Test case:** TC-IDN-API-025…036, TC-IDN-E2E-006…009, TC-GW-SEC-010 (VIEWER/OPERATOR bị 403)
