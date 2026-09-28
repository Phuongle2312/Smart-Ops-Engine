# Smart Ops Engine — Tổng quan tài liệu SRS

## Mô tả hệ thống

**Smart Ops Engine** là hệ thống giám sát sức khỏe hạ tầng máy chủ tự động và cảnh báo sự cố thời gian thực. Hệ thống theo dõi Disk/CPU/RAM của các máy chủ qua SSH, phát hiện vượt ngưỡng và gửi cảnh báo đa kênh.

## Quy ước trạng thái triển khai

| Ký hiệu                     | Ý nghĩa                                            |
| :-------------------------- | :------------------------------------------------- |
| `[BE v1.0 ✅]`              | Backend đã triển khai, hoạt động trong source code |
| `[FE Mock ✅]`              | Frontend đã có UI hoàn chỉnh, chạy với mock data   |
| `[BE v2.0 🔜]`              | Backend kế hoạch, chưa có trong source code        |
| `[FE API 🔜]`               | Frontend cần tích hợp API thực thay mock           |
| `[TODO ⚠️]`                | Điểm cần cải thiện đã biết                         |

## Cấu trúc tài liệu

```
SRS/
 ├── README.md                        ← Tổng quan này
 ├── 01_auth/
 │    ├── be.md                       ← JWT Auth, User Entity, RBAC
 │    └── fe.md                       ← Login Page, PrivateRoute, Token Storage
 ├── 02_node_management/
 │    ├── be.md                       ← Node Entity, CRUD API, AES Encryption
 │    └── fe.md                       ← Nodes View, Modal Thêm/Sửa/Xóa
 ├── 03_health_check_scheduler/
 │    └── be.md                       ← Scheduler, SSH Check, Local Metrics, Ngưỡng cảnh báo
 ├── 04_incident_management/
 │    ├── be.md                       ← IncidentLog Entity, Resolve API, Dedup logic
 │    └── fe.md                       ← Incidents View, Filter, Resolve/Acknowledge Dialog
 ├── 05_alert_notifications/
 │    ├── be.md                       ← Email SMTP, Webhook (planned), Alert Channels (planned)
 │    └── fe.md                       ← Toast System, Alert Channels View
 ├── 06_websocket_realtime/
 │    ├── be.md                       ← WebSocket STOMP Broker (planned)
 │    └── fe.md                       ← Simulation hiện tại → STOMP client (planned)
 ├── 07_audit_log/
 │    ├── be.md                       ← AuditLog Entity, AOP Aspect (planned)
 │    └── fe.md                       ← AuditLogs View, logAudit() trong Context
 ├── 08_metrics_history/
 │    ├── be.md                       ← Node_Metrics Entity, GET metrics API (planned)
 │    └── fe.md                       ← NodeDetail LineChart, Cache, Range Selector
 └── 09_system_config/
      └── be.md                       ← application.properties, biến môi trường
```

## Bảng tóm tắt tính năng

| #  | Tính năng                  | Backend          | Frontend         | Tài liệu                                                 |
| :- | :------------------------- | :--------------- | :--------------- | :------------------------------------------------------- |
| 01 | Xác thực & Phân quyền      | 🔜 v2.0 kế hoạch | ✅ Mock hoàn chỉnh | [BE](01_auth/be.md) / [FE](01_auth/fe.md)               |
| 02 | Quản lý Node (CRUD)        | ✅ v1.0 hoạt động | ✅ Mock hoàn chỉnh | [BE](02_node_management/be.md) / [FE](02_node_management/fe.md) |
| 03 | Health Check Scheduler     | ✅ v1.0 hoạt động | — (chỉ BE)        | [BE](03_health_check_scheduler/be.md)                   |
| 04 | Quản lý Sự cố (Incident)  | ✅ v1.0 cơ bản   | ✅ Mock hoàn chỉnh | [BE](04_incident_management/be.md) / [FE](04_incident_management/fe.md) |
| 05 | Cảnh báo đa kênh           | ✅ Email v1.0    | ✅ Mock hoàn chỉnh | [BE](05_alert_notifications/be.md) / [FE](05_alert_notifications/fe.md) |
| 06 | WebSocket Realtime         | 🔜 v2.0 kế hoạch | ✅ Simulation      | [BE](06_websocket_realtime/be.md) / [FE](06_websocket_realtime/fe.md) |
| 07 | Audit Log                  | 🔜 v2.0 kế hoạch | ✅ Mock hoàn chỉnh | [BE](07_audit_log/be.md) / [FE](07_audit_log/fe.md)    |
| 08 | Lịch sử Metrics            | 🔜 v2.0 kế hoạch | ✅ Mock hoàn chỉnh | [BE](08_metrics_history/be.md) / [FE](08_metrics_history/fe.md) |
| 09 | Cấu hình hệ thống          | ✅ v1.0 hoạt động | —                | [BE](09_system_config/be.md)                            |

## Tech Stack tóm tắt

**Backend:** Spring Boot 3.2.4 · Java 17 · SQL Server · JSch (`com.github.mwiede:0.2.17`) · OSHI 6.6.3 · Lombok · Maven

**Frontend:** React 19 · Vite 8 · Tailwind CSS 4 · React Router v7 · Recharts 3 · react-hot-toast · lucide-react · React Context API

## Tài liệu đầy đủ (monolithic)

- [backend_srs_v2.md](backend_srs_v2.md) — SRS Backend tổng hợp (v2.1)
- [frontend_srs_v2.md](frontend_srs_v2.md) — SRS Frontend tổng hợp (v2.1)
