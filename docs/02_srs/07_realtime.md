# SRS 07 — Realtime Service (`RTM`)

> Đẩy dữ liệu giám sát và sự cố tới trình duyệt theo thời gian thực bằng SignalR (WebSocket).
> Liên quan: [system_architecture.md §5.3](../01_architecture/system_architecture.md) · [frontend_architecture.md §3.3](../01_architecture/frontend_architecture.md)

---

## 1. Mục đích & phạm vi

Thay thế cơ chế giả lập bằng `setInterval` ở frontend v1 bằng kênh đẩy thật. Service không có database: nó chỉ chuyển tiếp sự kiện từ RabbitMQ tới các client đang kết nối, có lọc theo quyền và theo nhóm.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-RTM-001 | Cung cấp hub SignalR tại `/hubs/monitoring`, chỉ chấp nhận kết nối có access token hợp lệ. | Must |
| FR-RTM-002 | Đẩy `MetricCollected` cho client đang xem Dashboard (nhóm `all-nodes`) và cho client đang xem node cụ thể (nhóm `node:{id}`). | Must |
| FR-RTM-003 | Đẩy `IncidentOpened`, `IncidentEscalated`, `IncidentAcknowledged`, `IncidentResolved` cho mọi client đã xác thực. | Must |
| FR-RTM-004 | Đẩy `NodeStatusChanged` (mất liên lạc, khôi phục, bật/tắt giám sát, node mới/đã xóa). | Must |
| FR-RTM-005 | Client tự tham gia/rời nhóm qua phương thức hub `SubscribeNode(nodeId)` / `UnsubscribeNode(nodeId)`. | Must |
| FR-RTM-006 | Hỗ trợ nhiều instance: mọi instance đều nhận sự kiện từ queue riêng; phát theo nhóm dùng Redis backplane. | Must |
| FR-RTM-007 | Giới hạn 10 kết nối đồng thời cho mỗi người dùng; vượt quá thì đóng kết nối cũ nhất. | Should |
| FR-RTM-008 | Khi client kết nối lại, gửi một gói “trạng thái hiện tại” (snapshot mới nhất của các node trong nhóm đang theo dõi) để đồng bộ. | Should |
| FR-RTM-009 | Ngắt kết nối khi access token hết hạn; client phải kết nối lại bằng token mới. | Must |
| FR-RTM-010 | Cung cấp `GET /hubs/health` (nội bộ) báo số kết nối, số nhóm — phục vụ HPA và giám sát. | Should |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-RTM-001 | Dữ liệu đẩy đi là **tập con an toàn**: không chứa credential, không chứa thông tin người dùng khác ngoài tên hiển thị của người thao tác. |
| BR-RTM-002 | Mọi vai trò đều nhận được sự kiện giám sát (VIEWER cũng cần xem realtime); sự kiện quản trị (người dùng, cấu hình) **không** đẩy cho VIEWER/OPERATOR. |
| BR-RTM-003 | Realtime là kênh **bổ trợ**: mất kết nối không được làm hỏng chức năng; frontend chuyển sang polling 30 giây. |
| BR-RTM-004 | Không bảo đảm thứ tự tuyệt đối; mỗi thông điệp mang `occurredAt` để client tự quyết định bỏ qua dữ liệu cũ. |
| BR-RTM-005 | Token truyền qua query string (`?access_token=`) khi thiết lập WebSocket phải được **che trong log** của gateway và service. |

## 4. Hợp đồng hub

**Server → Client**

| Phương thức | Payload | Nhóm nhận |
|---|---|---|
| `MetricCollected` | `{ nodeId, nodeName, cpuPercent, memoryPercent, diskPercent, collectedAt, status }` | `all-nodes`, `node:{id}` |
| `NodeStatusChanged` | `{ nodeId, status, reason, occurredAt }` | `all-nodes`, `node:{id}` |
| `IncidentOpened` / `IncidentEscalated` | `{ incidentId, nodeId, nodeName, type, severity, description, detectedAt }` | `authenticated` |
| `IncidentAcknowledged` | `{ incidentId, actorName, occurredAt }` | `authenticated` |
| `IncidentResolved` | `{ incidentId, resolvedSource, actorName, resolvedAt }` | `authenticated` |
| `CheckCompleted` | `{ checkId, nodeId, outcome, durationMs }` | `node:{id}` (phản hồi cho “Kiểm tra ngay”) |
| `SystemNotice` | `{ level, message }` | `authenticated` / `admins` |

**Client → Server:** `SubscribeNode(nodeId)`, `UnsubscribeNode(nodeId)`, `SubscribeAll()`, `Ping()`.

Cấu hình: chỉ bật transport WebSocket (`SkipNegotiation` phía client), `KeepAliveInterval = 15s`, `ClientTimeoutInterval = 30s`, giới hạn kích thước message 32 KB.

## 5. Xác thực & phân quyền

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = ctx =>
    {
        var token = ctx.Request.Query["access_token"];
        if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
            ctx.Token = token;                      // FR-RTM-001
        return Task.CompletedTask;
    }
};
```
Hub đánh dấu `[Authorize]`; nhóm `admins` chỉ nhận người có role `ADMIN`. Hết hạn token ⇒ `OnTokenValidated` đặt hẹn giờ đóng kết nối tại `exp`.

## 6. Phía Frontend

| ID | Yêu cầu |
|---|---|
| FR-RTM-FE-001 | Một kết nối SignalR duy nhất cho toàn ứng dụng, khởi tạo sau khi đăng nhập, đóng khi đăng xuất. |
| FR-RTM-FE-002 | Tự kết nối lại với backoff `[0, 2s, 10s, 30s]`; sau 30 giây mất kết nối thì bật polling dự phòng 30 giây. |
| FR-RTM-FE-003 | Chỉ báo trạng thái kết nối ở header: “Trực tuyến” (chấm xanh) / “Đang kết nối lại” (vàng) / “Ngoại tuyến” (xám) kèm tooltip giải thích. |
| FR-RTM-FE-004 | Sự kiện realtime ghi trực tiếp vào cache React Query (không refetch toàn danh sách). |
| FR-RTM-FE-005 | Vào trang Node Detail thì `SubscribeNode`, rời trang thì `UnsubscribeNode`. |
| FR-RTM-FE-006 | Bỏ qua sự kiện có `occurredAt` cũ hơn dữ liệu đang hiển thị. |
| FR-RTM-FE-007 | Khi tab ẩn > 5 phút, tạm dừng cập nhật biểu đồ; khi hiện lại thì đồng bộ bằng một lần gọi API. |

## 7. Phi chức năng & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Hiệu năng | Độ trễ đẩy p95 ≤ 2 giây (NFR-PERF-011); 200 kết nối đồng thời/pod với CPU < 60% (NFR-SCL-004) |
| Mở rộng | Redis backplane; không cần sticky session nhờ dùng WebSocket thuần |
| Rủi ro | Bão sự kiện khi hàng trăm node cùng vượt ngưỡng → gộp `MetricCollected` theo lô 500 ms mỗi nhóm, tối đa 20 sự kiện/giây/kết nối |
| Rủi ro | Redis lỗi → mỗi instance vẫn phát cho client của mình (queue riêng theo instance), chỉ mất phát theo nhóm xuyên instance |
| Bảo mật | Không đẩy dữ liệu nhạy cảm; token trong query bị che trong log; giới hạn kết nối/người dùng |
