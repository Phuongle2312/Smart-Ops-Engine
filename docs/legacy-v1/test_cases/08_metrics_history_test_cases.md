# 08 — Test Cases: Lịch sử Metrics (Metrics History)

Phân hệ Lịch sử Metrics quản lý việc lưu trữ các chỉ số tài nguyên (Disk/CPU/RAM) của từng Node theo thời gian và hiển thị biểu đồ xu hướng (LineChart Recharts) giúp vận hành viên phân tích hiệu năng và dự đoán nguy cơ quá tải máy chủ.

---

## 1. Backend Test Cases (Time-Series Database, Metrics API & Cleanup Job)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-METRIC-BE-01** | Lưu snapshot chỉ số sau mỗi chu kỳ quét thành công | Scheduler quét thành công một Node active | Theo dõi bảng `Node_Metrics` sau khi scheduler hoàn tất quét | N/A | - Một bản ghi mới được thêm vào bảng `Node_Metrics`.<br>- Các trường được lưu đúng: `node_id`, `disk_pct` (giá trị đo được), `cpu_pct` và `ram_pct` (giá trị đo được ở v2.0), `checked_at` (thời điểm lưu). | Functional / Database | `N/A` |
| **TC-METRIC-BE-02** | Chỉ số null khi quét SSH lỗi (v2.0) | Node xảy ra lỗi SSH (unreachable) khi scheduler quét | Chờ scheduler hoàn tất chu kỳ | Host: offline | - Hệ thống lưu bản ghi snapshot vào DB với các trường `disk_pct = null`, `cpu_pct = null`, `ram_pct = null` để thể hiện trạng thái mất dữ liệu đo. | Robustness / Database | `N/A` |
| **TC-METRIC-BE-03** | API lấy dữ liệu lịch sử Metrics theo dải thời gian | Node có sẵn lịch sử metrics đo được trong 30 ngày qua | Gửi request `GET /api/nodes/{id}/metrics?range=24h` (và `7d`, `30d`) | `id` của Node và param `range` | - Trả về `HTTP 200 OK`.<br>- Response JSON chứa: `nodeId`, `nodeName`, `range` và mảng `metrics[]` sắp xếp tăng dần theo thời gian (`checkedAt` tăng dần).<br>- Số điểm dữ liệu tương ứng với range: `24h` trả về dữ liệu 24 giờ qua (khoảng 288 điểm đo nếu quét 5p/lần). | Functional | `N/A` |
| **TC-METRIC-BE-04** | Dọn dẹp dữ liệu cũ tự động (Cleanup Job) | Cấu hình lưu trữ dữ liệu là 90 ngày (`smartops.metrics.retention-days = 90`) | 1. Đặt cấu hình test dọn dẹp sau 1 ngày.<br>2. Chờ tới 02:00 AM (hoặc trigger job thủ công). | Dữ liệu cũ hơn 90 ngày tồn tại trong DB | - Job cleanup kích hoạt thành công lúc 02:00 AM.<br>- Thực hiện câu lệnh xóa toàn bộ bản ghi có `checked_at` trước mốc thời gian cutoff (90 ngày trước).<br>- Log hệ thống ghi nhận số bản ghi metrics đã xóa thành công. | Functional / Performance | `Pass` |

---

## 2. Frontend Test Cases (Instant Cards, Recharts LineChart & Caching)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-METRIC-FE-01** | Điều hướng và hiển thị thông tin Node Detail | Hệ thống đang hiển thị trang Nodes | Click vào tên Node `prod-web-01` | N/A | - Ứng dụng điều hướng sang `/app/nodes/1`. <br>- Header hiển thị tên máy chủ lớn, IP:Port và badge trạng thái Active.<br>- Nút Sửa và nút Kiểm tra ngay (ADMIN) hiển thị đúng vị trí. | Functional / UI | `Pass` |
| **TC-METRIC-FE-02** | Thẻ chỉ số tức thời (Instant Metric Cards) | Node detail đang hiển thị | Xem 3 thẻ CPU, RAM, Disk | N/A | - Ba thẻ hiển thị giá trị hiện tại của Node.<br>- Màu nền thay đổi theo ngưỡng: CPU xanh <75%, vàng 75-90%, đỏ >=90%; Disk/RAM xanh <80%, vàng 80-90%, đỏ >=90%.<br>- Hiển thị icon cảnh báo `AlertTriangle` nhấp nháy bên cạnh chỉ số nếu vượt ngưỡng. | UI/UX | `Pass` |
| **TC-METRIC-FE-03** | Hiển thị biểu đồ lịch sử Recharts LineChart | Node detail đang hiển thị | Xem biểu đồ lịch sử bên dưới các thẻ chỉ số | N/A | - Biểu đồ dạng LineChart hiển thị mượt mà.<br>- Có đầy đủ lưới tọa độ (`CartesianGrid`), trục X (thời gian), trục Y (từ 0% đến 100%).<br>- Hiển thị 3 đường line màu sắc phân biệt: Disk (xanh dương `#3b82f6`), CPU (vàng cam `#f59e0b`), RAM (tím `#8b5cf6`). | UI/UX | `Pass` |
| **TC-METRIC-FE-04** | Đường chỉ báo ngưỡng Warning và Critical trên biểu đồ | Biểu đồ đang hiển thị | Xem các đường kẻ ReferenceLine ngang | Ngưỡng: `80%` và `90%` | - Có đường đứt nét màu vàng cam tại mốc 80% kèm nhãn "Warning 80%".<br>- Có đường đứt nét màu đỏ tại mốc 90% kèm nhãn "Critical 90%". | UI/UX | `Pass` |
| **TC-METRIC-FE-05** | Tooltip chi tiết khi tương tác với biểu đồ | Biểu đồ đang hiển thị | Rê chuột (hover) qua các điểm dữ liệu trên biểu đồ | N/A | - Tooltip hiển thị tại vị trí trỏ chuột.<br>- Nội dung tooltip hiển thị rõ: mốc thời gian và chi tiết giá trị % của CPU, RAM, Disk tương ứng với màu sắc của đường biểu diễn. | UI/UX / UX | `Pass` |
| **TC-METRIC-FE-06** | Bộ lọc khoảng thời gian biểu đồ (Range selector) | Node detail đang hiển thị, mặc định biểu đồ chọn range "24h" | Click chọn nút "7 ngày" và "30 ngày" | N/A | - Biểu đồ tải lại dữ liệu mới.<br>- Trục X thay đổi định dạng hiển thị: 24h hiển thị dạng giờ phút `HH:mm`, 7d và 30d hiển thị dạng ngày tháng `MM/DD`. | Functional / UI | `Pass` |
| **TC-METRIC-FE-07** | Cơ chế Cache dữ liệu biểu đồ tránh request trùng lặp | Người dùng đang xem chi tiết Node | 1. Click chọn dải "7 ngày".<br>2. Chọn lại dải "24 giờ".<br>3. Kiểm tra xem hệ thống có gửi lại request (ở Mock/API) không. | N/A | - **Đạt**: Lần đầu tiên click chọn "7 ngày", dữ liệu được sinh/fetch và lưu vào cache `{nodeId}_{range}` (Cache miss).<br>- Khi click lại "24 giờ", hệ thống đọc trực tiếp từ cache cũ trong RAM Context (Cache hit), biểu đồ hiển thị lập tức mà không phải tải lại dữ liệu từ Server. | Performance / UX | `Pass` |
| **TC-METRIC-FE-08** | Bảng sự cố riêng của Node | Node detail đang hiển thị | Xem bảng danh sách phía dưới biểu đồ | N/A | - Bảng hiển thị tối đa 20 sự cố gần nhất liên quan tới riêng Node đang xem.<br>- Cấu trúc bảng giống trang Incidents nhưng ẩn cột Node (do đã biết là Node này). | Functional / UI | `Pass` |
