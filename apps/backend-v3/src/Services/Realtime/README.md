# Realtime Service (`RTM`) — M4

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/07_realtime.md](../../../../../docs/02_srs/07_realtime.md)

## Phạm vi

Hub SignalR `/hubs/monitoring` đẩy metric, sự cố và trạng thái node xuống trình duyệt. Service
**không có database**: chỉ chuyển tiếp event từ RabbitMQ tới client đang kết nối, có lọc theo nhóm.

Thay thế cơ chế giả lập `setInterval` của frontend v1.

## Yêu cầu phụ trách

`FR-RTM-001` … `FR-RTM-010` · `FR-RTM-FE-001` … `FR-RTM-FE-007` · `BR-RTM-001` … `BR-RTM-005`

## Việc cần làm

- [ ] `SOE.Realtime.Api` — `MonitoringHub` (`[Authorize]`), phương thức `SubscribeNode` / `UnsubscribeNode` / `SubscribeAll`
- [ ] `SOE.Realtime.Infrastructure` — Redis backplane, consumer nhận event qua **queue riêng mỗi instance** (auto-delete)
- [ ] Gộp sự kiện theo lô 500 ms, trần 20 sự kiện/giây/kết nối (chống bão)
- [ ] Giới hạn 10 kết nối/người dùng; đóng kết nối khi access token hết hạn
- [ ] Test: `docs/04_test_cases/TC-07_realtime.md` (24 ca)

## Bẫy đã biết

- Chỉ dùng transport WebSocket (`SkipNegotiation` phía client) ⇒ **không cần sticky session** khi scale.
- Token truyền qua query string khi bắt tay WebSocket ⇒ phải **che trong log** gateway và service.
- Realtime là kênh bổ trợ: mất kết nối không được làm hỏng chức năng, frontend tự chuyển sang polling 30s.
