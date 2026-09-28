# Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| **Node** | Một máy chủ được giám sát, xác định bởi `host` + `port` SSH. |
| **Metric snapshot** | Bộ giá trị CPU%, RAM%, Disk% của một node tại một thời điểm thu thập. |
| **Check / Scan** | Một lần thu thập metric của một node. |
| **Chu kỳ quét (scan cycle)** | Khoảng thời gian giữa hai lần Scheduler phát lệnh quét toàn bộ node active (mặc định 5 phút). |
| **Check now** | Quét ngay một node theo yêu cầu người dùng, ngoài chu kỳ. |
| **Threshold policy** | Bộ ngưỡng WARNING / CRITICAL cho từng loại metric; có mức toàn cục và ghi đè theo node. |
| **Breach** | Một snapshot có giá trị ≥ ngưỡng. |
| **Consecutive breaches** | Số lần breach liên tiếp cần đạt trước khi mở sự cố (chống nhiễu, mặc định 2). |
| **Hysteresis** | Khoảng đệm dưới ngưỡng mà giá trị phải xuống thấp hơn mới coi là hồi phục (mặc định 5 điểm %). |
| **Incident** | Sự cố được mở khi một điều kiện bất thường kéo dài; có vòng đời OPEN → ACKNOWLEDGED → RESOLVED. |
| **Fingerprint** | Khóa dedup của sự cố: `nodeId + incidentType`. Tại một thời điểm chỉ có một sự cố chưa đóng cho mỗi fingerprint. |
| **Severity** | Mức độ: `WARNING`, `CRITICAL`. |
| **Escalation** | Sự cố đang WARNING chuyển thành CRITICAL cùng loại tài nguyên. |
| **Auto-resolve** | Hệ thống tự đóng sự cố khi metric hồi phục đủ số lần liên tiếp. |
| **Alert channel** | Đích nhận cảnh báo: EMAIL hoặc WEBHOOK (định dạng SLACK / TEAMS / DISCORD / GENERIC). |
| **HMAC signature** | Chữ ký `HMAC-SHA256` trên body webhook, gửi trong header `X-SOE-Signature` để bên nhận xác thực nguồn. |
| **Throttle** | Không gửi lặp cảnh báo cho cùng sự cố trong một cửa sổ thời gian (mặc định 30 phút). |
| **API Gateway** | Điểm vào duy nhất từ Internet (YARP), định tuyến tới service nội bộ. |
| **Integration event** | Thông điệp bất biến một service phát lên RabbitMQ để service khác phản ứng (vd `MetricCollectedV1`). |
| **Command message** | Thông điệp yêu cầu một hành động cụ thể, có đúng một consumer loại (vd `CheckNodeV1`). |
| **Transactional outbox** | Kỹ thuật ghi event vào bảng outbox trong cùng transaction với dữ liệu nghiệp vụ, sau đó mới publish — đảm bảo không mất event. |
| **Inbox / Idempotent consumer** | Consumer ghi nhận `MessageId` đã xử lý để bỏ qua bản trùng. |
| **DLQ (Dead-letter queue)** | Hàng đợi chứa message xử lý thất bại sau khi hết số lần retry. |
| **Competing consumers** | Nhiều instance cùng tiêu thụ một queue, mỗi message chỉ tới một instance → scale ngang. |
| **HPA** | Horizontal Pod Autoscaler của Kubernetes — tự tăng/giảm pod theo CPU/RAM/metric. |
| **KEDA** | Kubernetes Event-Driven Autoscaling — scale theo độ dài queue RabbitMQ. |
| **Backplane (SignalR)** | Kênh Redis pub/sub giúp nhiều instance Realtime Service cùng phát tới mọi client. |
| **Access token** | JWT ngắn hạn (15 phút) ký RS256, gửi trong header `Authorization: Bearer`. |
| **Refresh token** | Chuỗi ngẫu nhiên dài hạn (7 ngày), lưu hash trong DB, gửi qua cookie HttpOnly, **xoay vòng** mỗi lần dùng. |
| **Token family / reuse detection** | Nếu một refresh token đã dùng bị dùng lại → thu hồi toàn bộ chuỗi token của phiên (nghi bị đánh cắp). |
| **JWKS** | JSON Web Key Set — endpoint công bố public key để các service tự xác minh JWT. |
| **BOLA** | Broken Object Level Authorization — lỗ hổng truy cập đối tượng không thuộc quyền (OWASP API1). |
| **ProblemDetails** | Định dạng lỗi chuẩn RFC 7807 (`application/problem+json`). |
| **Correlation ID** | Mã `X-Correlation-Id` gắn xuyên suốt request/message để truy vết log. |
| **CSP** | Content Security Policy — header giới hạn nguồn script/style để chống XSS. |
| **Performance budget** | Ngưỡng tối đa cho kích thước bundle và chỉ số Web Vitals (LCP, INP, CLS). |
| **Clean Architecture** | Tổ chức mã thành các lớp Domain → Application → Infrastructure → Api, phụ thuộc hướng vào trong. |
| **CQRS** | Tách Command (ghi) và Query (đọc) thành các handler riêng. |
