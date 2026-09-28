# 06 — Test Cases: WebSocket Realtime (Thông báo thời gian thực)

Phân hệ WebSocket Realtime chịu trách nhiệm đẩy các sự kiện (incident mới, sự cố được xử lý) trực tiếp từ Backend tới Frontend theo thời gian thực (Push style) nhằm giảm độ trễ và tránh lãng phí tài nguyên của việc Polling API liên tục.

---

## 1. Backend Test Cases (STOMP Broker, Message Push & Connection Security)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WS-BE-01** | Khởi tạo kết nối STOMP thành công | Server đang chạy | Trình duyệt thực hiện kết nối WebSocket tới endpoint `/ws` | Endpoint: `ws://localhost:8080/ws` | - Handshake thành công.<br>- Trả về mã kết nối 101 Switching Protocols.<br>- Kết nối được duy trì ổn định. | Functional / Integration | `N/A` |
| **TC-WS-BE-02** | SockJS Fallback hoạt động khi WebSocket bị chặn | Trình duyệt không hỗ trợ WebSocket hoặc bị chặn bởi Proxy/Firewall | Gửi kết nối STOMP sử dụng thư viện SockJS | N/A | - Hệ thống tự động chuyển sang cơ chế HTTP Long-polling để duy trì kênh truyền thông tin.<br>- Dữ liệu STOMP vẫn được truyền nhận bình thường. | Robustness / Compatibility | `N/A` |
| **TC-WS-BE-03** | Xác thực JWT trong quá trình Handshake WebSocket | Cấu hình bảo mật WebSocket đã kích hoạt | 1. Kết nối với token hợp lệ.<br>2. Kết nối với token sai/hết hạn. | Token: `Bearer eyJhbGci...` | - **Token hợp lệ**: Handshake thành công. Lưu thông tin user đăng nhập vào thuộc tính phiên WebSocket.<br>- **Token sai**: Trả về lỗi 403 Forbidden và từ chối handshake. | Security | `N/A` |
| **TC-WS-BE-04** | Đẩy sự kiện khi có Incident mới (INCIDENT_CREATED) | User đã subscribe topic `/topic/incidents` | Scheduler tạo mới 1 sự cố trong DB | Incident ID: `15`<br>Node: `prod-db-master` | - `IncidentEventPublisher` đẩy JSON event tới topic `/topic/incidents`.<br>- Nội dung JSON chứa đầy đủ thông tin: `eventType: "INCIDENT_CREATED"`, ID sự cố, ID Node, loại sự cố, mô tả lỗi và thời gian phát hiện. | Functional / Live Data | `N/A` |
| **TC-WS-BE-05** | Đẩy sự kiện khi Incident được giải quyết (INCIDENT_RESOLVED) | User đã subscribe topic `/topic/incidents` | Admin nhấn Resolve sự cố trên hệ thống | Incident ID: `15` | - Hệ thống đẩy JSON event có `eventType: "INCIDENT_RESOLVED"`.<br>- Response chứa: ID sự cố, ID Node và trạng thái mới `RESOLVED`. | Functional / Live Data | `N/A` |

---

## 2. Frontend Test Cases (Mock Simulator, Live Indicators & Reconnect)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WS-FE-01** | Simulator chạy ngẫu nhiên các chỉ số (Mock Phase) | Người dùng đăng nhập thành công | Theo dõi các progress bar CPU/Disk/RAM tại trang Nodes | N/A | - Cứ mỗi 7 giây, các chỉ số của tất cả Node active tự động tăng giảm nhẹ trong khoảng `±5%` (dao động ngẫu nhiên).<br>- Chỉ cập nhật các chỉ số được chọn giám sát (CPU, Disk, RAM). Các Node inactive giữ nguyên 0%. | Functional / Simulator | `Pass` |
| **TC-WS-FE-02** | Simulator tạo sự cố ngẫu nhiên (Mock Phase) | Người dùng đăng nhập thành công | Theo dõi màn hình trong vài phút | Tỷ lệ xác suất: `8%` | - Ngẫu nhiên có sự cố được sinh ra.<br>- Toast đỏ hiện lên, bảng Incidents cập nhật sự cố mới ở đầu hàng, badge cảnh báo trên Header tăng lên.<br>- Nếu trùng lặp sự cố đang OPEN, hệ thống tăng số lần tái phát (`count + 1`) thay vì insert hàng mới. | Functional / Simulator | `Pass` |
| **TC-WS-FE-03** | Trạng thái chỉ báo kết nối WebSocket (Live Indicator) | Trang chính đang hiển thị | Xem góc phải trên Header | N/A | - Giao diện hiển thị badge màu xanh lá ghi chữ **"Live"** (trạng thái đang kết nối WebSocket).<br>- Đăng xuất tài khoản -> Badge ẩn hoặc chuyển sang màu đỏ. | UI/UX | `Pass` |
| **TC-WS-FE-04** | Tự động kết nối lại khi mất kết nối (Auto Reconnect) | Người dùng đang làm việc trong hệ thống | Giả lập mất kết nối mạng hoặc ngắt dịch vụ Backend | N/A | - Chỉ báo trên Header đổi sang màu đỏ **"Offline"**, hiển thị tooltip: "Đang thử kết nối lại...".<br>- Thư viện `@stomp/stompjs` tự động gửi request kết nối lại định kỳ mỗi 5 giây (`reconnectDelay: 5000`). | Robustness / UX | `N/A` |
| **TC-WS-FE-05** | Polling dự phòng khi WebSocket bị mất hoàn toàn (v2.0) | Hệ thống đang hiển thị chỉ báo "Offline" kéo dài | Theo dõi Tab Network trong DevTools | N/A | - **Đạt**: Cứ mỗi 5 phút, Frontend tự động gửi request `GET /api/incidents?page=0&size=20` để cập nhật dữ liệu mới nhất từ Server (chế độ dự phòng khi không có WebSocket). | Robustness / Performance | `N/A` |
| **TC-WS-FE-06** | Hiệu ứng UI khi nhận WebSocket Event tạo sự cố | Trang Incidents đang hiển thị | Simulator/Backend đẩy sự kiện tạo sự cố mới | N/A | - Hàng mới lập tức xuất hiện ở dòng đầu tiên của bảng.<br>- Dòng này có nền màu vàng nhạt mờ (`bg-yellow-500/10`) để thu hút chú ý.<br>- Màu nền nhạt dần và tự động biến mất hoàn toàn sau 3 giây. | UI/UX / Live Data | `Pass` |
| **TC-WS-FE-07** | Hiệu ứng UI khi nhận WebSocket Event resolve sự cố | Trang Incidents đang hiển thị | Simulator/Backend đẩy sự kiện resolve sự cố | N/A | - Hàng sự cố tương ứng đổi badge trạng thái từ `OPEN` sang `RESOLVED` (màu xanh lá) lập tức.<br>- Số lượng badge đỏ ở Header tự động trừ đi 1.<br>- Bảng sự cố nhanh ở Dashboard cập nhật trạng thái mới. | UI/UX / Live Data | `Pass` |
