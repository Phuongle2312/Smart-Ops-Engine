# Hướng dẫn chạy thử dự án

> Tài liệu thực hành: dựng môi trường, chạy kiểm thử tự động, rồi tự tay thử từng phần của hệ thống
> và ghi lại kết quả. Áp dụng cho trạng thái repo hiện tại — **mốc M1** của v3 (Identity + Gateway),
> giao diện chạy **mock**, bản v1 Spring Boot vẫn chạy được.
>
> Test case đầy đủ nằm ở [04_test_cases/](04_test_cases/README.md); tài liệu này chỉ chọn các bài
> **chạy được ngay** trên code hiện có.

---

## 0. Bản đồ nhanh — thử cái gì, ở đâu

| Phần | Cổng | Dữ liệu | Cần gì | Mục |
|---|---|---|---|---|
| Kiểm thử tự động toàn repo | — | — | .NET 8, Node, Java 17 | [§2](#2-chạy-kiểm-thử-tự-động) |
| Identity (v3) | 5001 | SQL Server `soe_identity_dev` | SQL Server | [§3](#3-chạy-thử-backend-v3-identity--gateway) |
| Gateway (v3) | 8080 | — | Identity đang chạy | [§3](#3-chạy-thử-backend-v3-identity--gateway) |
| Giao diện web | 5173 | `localStorage` (mock) | Node | [§4](#4-chạy-thử-giao-diện-web-mock) |
| Backend v1 | 8080 | SQL Server `smart_ops_engine` | SQL Server, Java 17 | [§5](#5-chạy-thử-backend-v1-legacy) |
| Docker Compose (v3) | 8080 | SQL Server trong container | Docker Desktop | [§6](#6-chạy-bằng-docker-compose-tùy-chọn) |

> ⚠️ **Gateway v3 và backend v1 cùng dùng cổng 8080** — chỉ chạy một trong hai tại một thời điểm.
> Màn hình *Cấu hình hệ thống* của web gọi thẳng `http://localhost:8080/api/system-config` của **v1**.

---

## 1. Chuẩn bị

### 1.1 Công cụ

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| .NET SDK | 8.x (có SDK 9/10 cũng được) | `dotnet --list-sdks` |
| Node.js | ≥ 20 (đã thử với 22) | `node -v` |
| JDK | 17 | `java -version` |
| SQL Server | 2019+ / Express, mở TCP cổng 1433 | `Test-NetConnection localhost -Port 1433` |
| Docker Desktop | tùy chọn, cho §6 | `docker version` |

### 1.2 Chuỗi kết nối SQL Server

`appsettings.Development.json` của Identity mặc định dùng tài khoản `sa` với mật khẩu mẫu — thường
**không khớp** máy của bạn. Cách đơn giản nhất trên Windows là dùng Windows Authentication:

```powershell
$env:ConnectionStrings__Default = 'Server=localhost,1433;Database=soe_identity_dev;Integrated Security=True;TrustServerCertificate=True;Encrypt=True'
```

Biến này chỉ sống trong cửa sổ PowerShell hiện tại. CSDL `soe_identity_dev` được **tự tạo** bằng
migration khi Identity khởi động ở môi trường Development.

### 1.3 Tài khoản dùng để thử

| Nơi | Tài khoản | Mật khẩu |
|---|---|---|
| Identity v3 | `admin` | `Admin@Test2026!` (giá trị `Identity:InitialAdminPassword` trong `appsettings.Development.json`; chỉ áp dụng khi CSDL tạo mới) |
| Web (mock) | `admin` | `admin` — quyền ADMIN |
| Web (mock) | `viewer` | `viewer` — quyền VIEWER |

> Nếu đã đổi mật khẩu admin trong lần thử trước, xóa CSDL `soe_identity_dev` để hệ thống seed lại,
> hoặc truyền mật khẩu hiện tại qua `-AdminPassword`.

---

## 2. Chạy kiểm thử tự động

Chạy từ **gốc repo** trong PowerShell.

| # | Lệnh | Kỳ vọng |
|---|---|---|
| A1 | `.\tools\scripts\test-all.ps1` | Bảng tổng kết 3 bước `ĐẠT`: backend-v3 (49 test), web (lint + build), legacy-v1 (6 test) |
| A2 | `.\tools\scripts\test-all.ps1 -Only backend` | Chỉ chạy `dotnet test`: 41 unit + 8 architecture test xanh |
| A3 | `.\tools\scripts\test-all.ps1 -Smoke -ConnectionString '<chuỗi ở §1.2>'` | Thêm bước smoke: tự bật Identity + Gateway, `Kết quả smoke test: 14/14 đạt`, rồi tự tắt |

Nếu một bước `LỖI`, cuộn lên xem output của bước đó; log service khi chạy smoke nằm ở
`tools/scripts/.logs/identity.*.log` và `gateway.*.log`.

---

## 3. Chạy thử backend v3 (Identity + Gateway)

### 3.1 Khởi động

Mở **hai** cửa sổ PowerShell tại `apps/backend-v3`, cả hai đều đặt biến ở §1.2.

```powershell
# Cửa sổ 1 — Identity
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project src\Services\Identity\SOE.Identity.Api --urls http://localhost:5001
```

```powershell
# Cửa sổ 2 — Gateway
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project src\Gateway\SOE.Gateway --urls http://localhost:8080
```

Sẵn sàng khi `http://localhost:5001/health/ready` và `http://localhost:8080/health/live` trả `200`.

### 3.2 Smoke test tự động trên service đang chạy

```powershell
.\tools\scripts\smoke-m1.ps1 -AdminPassword 'Admin@Test2026!'
```

Thêm `-IncludeRateLimit` để thử giới hạn đăng nhập (tốn một cửa sổ 1 phút).
Thêm `-BaseUrl http://localhost:5001` để gọi thẳng Identity, bỏ qua Gateway.

### 3.3 Thử tay bằng PowerShell

Các lệnh dưới dùng `Invoke-RestMethod`; lưu ý PowerShell 5.1 **ném lỗi** với mã 4xx/5xx — đó chính
là kết quả cần kiểm tra (xem `StatusCode` trong thông báo lỗi).

```powershell
$api = 'http://localhost:8080/api/v1'
$login = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' `
    -Body '{"username":"admin","password":"Admin@Test2026!"}' -SessionVariable s
$h = @{ Authorization = "Bearer $($login.accessToken)" }
```

| # | Thao tác | Lệnh | Kỳ vọng | TC |
|---|---|---|---|---|
| B1 | Đăng nhập admin | lệnh ở trên, rồi `$login` | Có `accessToken`, `expiresIn = 900`, `user.role = ADMIN` | TC-IDN-API-001 |
| B2 | Xem thông tin bản thân | `Invoke-RestMethod "$api/me" -Headers $h` | Có `permissions` | TC-IDN-API-017 |
| B3 | Gọi `/me` không token | `Invoke-RestMethod "$api/me"` | Lỗi `401` | TC-GW-SEC-001 |
| B4 | Tạo người dùng VIEWER | `Invoke-RestMethod "$api/users" -Method Post -Headers $h -ContentType 'application/json' -Body '{"username":"viewer01","fullName":"Nguyen Van Xem","email":"viewer01@example.com","role":"VIEWER"}'` | `201`, trả `temporaryPassword` (chỉ hiện một lần) | TC-IDN-API-025 |
| B5 | Tạo trùng username | chạy lại lệnh B4 | Lỗi `409`, body `code: SOE-IDN-409` | TC-IDN-API-026 |
| B6 | VIEWER gọi API quản trị | đăng nhập `viewer01` bằng mật khẩu tạm, gọi `GET $api/users` | Lỗi `403` | TC-IDN-API-036 |
| B7 | Danh sách người dùng | `Invoke-RestMethod "$api/users" -Headers $h` | Có `admin` và `viewer01` | — |
| B8 | Refresh token | `Invoke-RestMethod "$api/auth/refresh" -Method Post -WebSession $s` | `200`, access token mới; cookie `soe_rt` đổi | TC-IDN-API-011 |
| B9 | Khóa tài khoản | sai mật khẩu `viewer01` 5 lần (chờ hết cửa sổ rate limit giữa các đợt) | Lần 5 trả `423`, `code: SOE-IDN-423` | TC-IDN-API-004 |
| B10 | Rate limit đăng nhập | gửi 6 lần login trong 1 phút | Lần 6 trả `429` kèm `Retry-After` | TC-IDN-API-008 |
| B11 | JWKS | `Invoke-RestMethod http://localhost:5001/.well-known/jwks.json` | Một khóa `RS256` có `kid`, không có `d`/`p`/`q` | TC-IDN-API-018 |
| B12 | Health khi mất CSDL | dừng dịch vụ SQL Server, gọi `http://localhost:5001/health/ready` | `503`; bật lại ⇒ `200` | — |

Kịch bản chi tiết hơn (bằng `curl`): [apps/backend-v3/docs-m1-smoke-test.md](../apps/backend-v3/docs-m1-smoke-test.md).

> Khóa ký JWT hiện **sinh tạm mỗi lần khởi động** Identity ⇒ restart Identity là mọi token cũ mất hiệu
> lực. Đây là hành vi đã biết (nợ M1 #5), không phải lỗi.

---

## 4. Chạy thử giao diện web (mock)

```powershell
cd apps\web
npm install        # lần đầu
npm run dev        # http://localhost:5173
```

Toàn bộ dữ liệu nằm trong `localStorage` của trình duyệt (khóa `soe_*`); cứ **7 giây** hệ thống giả
lập dao động CPU/RAM/Disk và thỉnh thoảng sinh sự cố ngẫu nhiên. Muốn làm lại từ đầu: DevTools →
Application → Local Storage → xóa các khóa `soe_*`, rồi tải lại trang.

### 4.1 Đăng nhập & phân quyền

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W1 | Mở `/` khi chưa đăng nhập | Chuyển về `/login` |
| W2 | Đăng nhập `admin/admin` | Toast "Đăng nhập thành công với quyền ADMIN", vào *Tổng quan*; sidebar đủ 6 mục |
| W3 | Đăng nhập sai mật khẩu | Báo lỗi, không vào được |
| W4 | Đăng xuất, đăng nhập `viewer/viewer` | Sidebar chỉ còn *Tổng quan*, *Máy chủ*, *Sự cố* |
| W5 | VIEWER gõ thẳng `/app/audit-logs` hoặc `/app/alert-channels` | Bị đưa về *Tổng quan* |
| W6 | VIEWER bấm "Quét hệ thống" | Toast "Bạn không có quyền thực hiện thao tác này." |

### 4.2 Tổng quan

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W7 | Để trang mở ~30 giây | Chỉ số CPU/RAM thay đổi nhẹ; biểu đồ cập nhật |
| W8 | ADMIN bấm "Quét hệ thống" | Toast đang quét → hoàn thành |
| W9 | Bấm "Quét hệ thống" lần nữa trong 12 giây | Toast "Thao tác quá nhanh…" |

### 4.3 Máy chủ

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W10 | ADMIN thêm máy chủ, để trống mọi trường, bấm lưu | Hiện lỗi: tên trống, IP/Hostname trống, tên đăng nhập SSH trống, mật khẩu SSH |
| W11 | Nhập host `abc..`, cổng `70000` | "Sai định dạng Hostname hoặc địa chỉ IP.", "Cổng kết nối phải từ 1 đến 65535." |
| W12 | Nhập hợp lệ rồi lưu | Toast "Đã thêm máy chủ … thành công."; xuất hiện trong danh sách; *Nhật ký hệ thống* có dòng CREATE |
| W13 | Sửa, bật/tắt giám sát, xóa máy chủ vừa tạo | Toast tương ứng; máy chủ tắt giám sát không còn dao động chỉ số |
| W14 | VIEWER mở *Máy chủ* | Không có nút thêm/sửa/xóa |
| W15 | Bấm vào một máy chủ | Trang chi tiết: 3 thẻ CPU/Disk/RAM, biểu đồ lịch sử có trạng thái đang tải rồi hiện dữ liệu |
| W16 | Đổi khoảng thời gian "24 Giờ" ↔ "7 Ngày" ↔ "30 Ngày" | Biểu đồ tải lại theo khoảng mới |
| W17 | Bấm "Kiểm tra ngay" trên máy chủ đang tắt giám sát | Toast "Máy chủ đang tắt giám sát…" |
| W18 | Gõ URL `/app/nodes/999999` | "Không tìm thấy máy chủ yêu cầu." và nút quay lại |

### 4.4 Sự cố

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W19 | Mở `/app/incidents?status=OPEN` | Bộ lọc trạng thái tự chọn "Chưa xử lý (OPEN)" |
| W20 | Lọc theo máy chủ / loại / gõ ô tìm kiếm | Danh sách lọc đúng; tìm kiếm áp dụng sau ~0,3 giây; trang quay về 1 |
| W21 | ADMIN bấm xác nhận (Ack) một sự cố OPEN | Chuyển sang đang xử lý, toast "Đã xác nhận sự cố…" |
| W22 | ADMIN bấm giải quyết, nhập hành động khắc phục | Toast "Sự cố đã được giải quyết thành công." |
| W23 | Chờ vài phút trên bất kỳ trang nào | Thỉnh thoảng có toast `[WebSocket] …` báo sự cố mới/tái phát; chuông trên header tăng số |

### 4.5 Chỉ dành cho ADMIN

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W24 | *Kênh thông báo* → thêm kênh Email với địa chỉ sai định dạng | "Địa chỉ email không đúng định dạng." |
| W25 | Thêm kênh Webhook với URL sai | "Địa chỉ Webhook URL không hợp lệ." |
| W26 | Thêm, sửa, bật/tắt, xóa kênh | Toast tương ứng; danh sách cập nhật |
| W27 | *Nhật ký hệ thống* → lọc theo hành động/người/đối tượng, bấm "Xem Diff" | Bảng lọc đúng, hộp thoại hiện JSON trước/sau |
| W28 | *Cấu hình hệ thống* khi **không** chạy backend v1 | Toast "Không kết nối được backend…" (đúng như thiết kế) |
| W29 | *Cấu hình hệ thống* khi backend v1 đang chạy (§5) | Tải được cấu hình; đổi ngưỡng rồi lưu thành công |

### 4.6 Kiểm tra chung

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W30 | Mở DevTools → Console, đi qua mọi màn hình | Không có lỗi đỏ |
| W31 | Thu hẹp cửa sổ còn ~375 px | Không vỡ bố cục nghiêm trọng (ghi nhận lại nếu có) |
| W32 | `npm run build` rồi `npm run preview` | Bản build chạy giống bản dev |

---

## 5. Chạy thử backend v1 (legacy)

Dừng Gateway v3 trước (trùng cổng 8080). Đặt biến môi trường theo
[apps/legacy-v1/.env.example](../apps/legacy-v1/.env.example) — tối thiểu `DB_USERNAME`, `DB_PASSWORD`
(hoặc chuỗi kết nối phù hợp) và `AES_SECRET_KEY` (≥ 32 ký tự):

```powershell
cd apps\legacy-v1
$env:AES_SECRET_KEY = '<chuỗi ngẫu nhiên ≥ 32 ký tự>'
$env:DB_PASSWORD = '<mật khẩu sa>'
.\mvnw.cmd spring-boot:run
```

| # | Thao tác | Kỳ vọng |
|---|---|---|
| L1 | `GET http://localhost:8080/api/nodes` | `200` và một mảng JSON (có thể rỗng) — v1 **không** có Actuator nên `/actuator/health` trả 404 |
| L2 | `POST /api/nodes` với node `127.0.0.1` | `201`; node localhost đọc metrics qua MX bean, không cần SSH |
| L3 | `POST /api/nodes/{id}/check-now` rồi `GET /api/nodes/{id}/metrics` | Có bản ghi metrics mới |
| L4 | `GET /api/incidents`, `PUT /api/incidents/{id}/resolve` | Danh sách sự cố; giải quyết thành công |
| L5 | `GET /api/system-config` | Trả cấu hình (ngưỡng disk 80/90, CPU 85, RAM 90 mặc định) |
| L6 | `POST /api/system-config/test-email` | Thành công nếu SMTP cấu hình đúng; nếu không, báo lỗi SMTP rõ ràng |

Tệp [apps/legacy-v1/ops-dashboard.http](../apps/legacy-v1/ops-dashboard.http) có sẵn các request trên
(mở bằng VS Code REST Client hoặc IntelliJ HTTP Client). Test case đầy đủ:
[legacy-v1/test_cases/](legacy-v1/test_cases/README.md).

---

## 6. Chạy bằng Docker Compose (tùy chọn)

```powershell
Copy-Item deploy\docker\.env.example deploy\docker\.env   # rồi sửa SQL_SA_PASSWORD, INITIAL_ADMIN_PASSWORD
docker compose -f deploy/docker/docker-compose.yml --env-file deploy/docker/.env up -d --build
docker compose -f deploy/docker/docker-compose.yml ps
```

| # | Kiểm tra | Kỳ vọng |
|---|---|---|
| D1 | `docker compose ps` | `sqlserver` healthy; `identity`, `gateway` running |
| D2 | `.\tools\scripts\smoke-m1.ps1 -AdminPassword '<INITIAL_ADMIN_PASSWORD>'` | 11 bài qua Gateway đạt; 3 bài `HEALTH-*` và `TC-IDN-API-018` báo FAIL vì compose không mở cổng 5001 của Identity ra ngoài — đó là hành vi đúng |
| D3 | `docker compose ... down -v` | Dọn sạch, xóa luôn volume dữ liệu |

> Nếu để trống `INITIAL_ADMIN_PASSWORD`, mật khẩu admin được sinh ngẫu nhiên và in **một lần** trong
> `docker compose logs identity`.

---

## 7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Identity dừng với lỗi đăng nhập SQL (`Login failed for user 'sa'`) | Chuỗi kết nối mặc định không khớp máy | Đặt `ConnectionStrings__Default` như §1.2 |
| `/health/ready` trả 503 | Không kết nối được CSDL | Kiểm tra SQL Server đang chạy, TCP 1433 đã bật (SQL Server Configuration Manager) |
| Gateway trả 401 với token vừa lấy | Identity đã restart ⇒ khóa ký mới | Đăng nhập lại |
| Đăng nhập admin v3 trả 401 dù đúng mật khẩu mẫu | Mật khẩu đã đổi ở lần thử trước | Dùng mật khẩu hiện tại hoặc xóa CSDL `soe_identity_dev` |
| Đăng nhập trả 429 | Vượt 5 lần/phút/IP | Chờ 60 giây |
| Đăng nhập trả 423 | Tài khoản bị khóa sau 5 lần sai | Chờ hết thời gian khóa (thông báo có số phút) |
| `Address already in use` cổng 8080 | Gateway v3 và backend v1 chạy cùng lúc | Tắt một trong hai |
| Chạy `.ps1` báo *running scripts is disabled* | Execution policy | `Set-ExecutionPolicy -Scope Process Bypass` trong cửa sổ hiện tại |
| Web hiện dữ liệu lạ/cũ | `localStorage` còn dữ liệu cũ | Xóa khóa `soe_*` (§4) |

---

## 8. Phiếu ghi kết quả

Sao chép bảng này vào issue/PR khi báo cáo một lượt chạy thử.

| Mục | Người thử | Ngày | Đạt | Lỗi | Ghi chú / link issue |
|---|---|---|---|---|---|
| §2 Kiểm thử tự động (A1–A3) | | | | | |
| §3 Backend v3 (B1–B12) | | | | | |
| §4 Web mock (W1–W32) | | | | | |
| §5 Backend v1 (L1–L6) | | | | | |
| §6 Docker Compose (D1–D3) | | | | | |

Khi ghi lỗi, nêu: mã bước (ví dụ `W21`), thao tác đã làm, kết quả thực tế, kết quả mong đợi, ảnh chụp
hoặc log (`tools/scripts/.logs/`, Console trình duyệt).
