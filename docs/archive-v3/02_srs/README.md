# SRS — Đặc tả yêu cầu theo service

Mỗi tài liệu có cùng bố cục: mục đích & phạm vi → yêu cầu chức năng (`FR-*`) → quy tắc nghiệp vụ (`BR-*`) → mô hình miền → hợp đồng API → quy tắc validate (BE/FE) → sự kiện → yêu cầu phía Frontend (`FR-*-FE-*`) → bảo mật riêng → phi chức năng & rủi ro.

| # | Service | Mã | Tài liệu | Số FR (BE + FE) |
|---|---|---|---|---|
| 01 | Identity — xác thực & người dùng | `IDN` | [01_identity.md](01_identity.md) | 15 + 8 |
| 02 | Inventory — quản lý Node | `INV` | [02_inventory.md](02_inventory.md) | 17 + 9 |
| 03 | Monitoring — lập lịch & thu thập | `MON` | [03_monitoring.md](03_monitoring.md) | 16 + 5 |
| 04 | Metrics — lịch sử chỉ số | `MET` | [04_metrics.md](04_metrics.md) | 13 + 8 |
| 05 | Incident — ngưỡng & sự cố | `INC` | [05_incident.md](05_incident.md) | 28 + 9 |
| 06 | Notification — cảnh báo đa kênh | `NTF` | [06_notification.md](06_notification.md) | 20 + 8 |
| 07 | Realtime — SignalR | `RTM` | [07_realtime.md](07_realtime.md) | 10 + 7 |
| 08 | Audit — nhật ký kiểm toán | `AUD` | [08_audit.md](08_audit.md) | 10 + 7 |
| 09 | Gateway & cấu hình hệ thống | `GW` | [09_gateway_config.md](09_gateway_config.md) | 22 + 7 |

**Đọc kèm:** [Kiến trúc hệ thống](../01_architecture/system_architecture.md) · [NFR](../01_architecture/nfr.md) · [Kiến trúc Frontend](../01_architecture/frontend_architecture.md) · [Use case](../03_usecases/) · [Test case](../04_test_cases/)

## Bản đồ màn hình ↔ service

| Màn hình Frontend | Service cung cấp dữ liệu |
|---|---|
| `Login` | Identity |
| `Dashboard` | Metrics (latest, health-summary), Incident (stats), Monitoring (status), Realtime |
| `Nodes` | Inventory, Metrics (latest), Monitoring (check-now) |
| `NodeDetail` | Inventory, Metrics (history, summary), Incident (theo node), Monitoring (check-runs) |
| `Incidents` | Incident, Realtime |
| `AlertChannels` | Notification |
| `AuditLogs` | Audit |
| `SystemConfig` | Monitoring + Incident + Notification (tổng hợp qua Gateway) |
| `Users` | Identity |
