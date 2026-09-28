# Services — phân chia công việc theo bounded context

Mỗi thư mục con là **một service độc lập**: một database riêng, một vòng đời triển khai riêng,
một nhóm yêu cầu (`FR-*`) riêng. Đây cũng là đơn vị chia việc giữa các thành viên.

| Thư mục | Mã | Mốc | Trạng thái | SRS |
|---|---|---|---|---|
| [Identity](Identity/) | `IDN` | M1 | ✅ Đã hiện thực | [01_identity.md](../../../../docs/02_srs/01_identity.md) |
| [Inventory](Inventory/) | `INV` | M2 | 🔜 Khung | [02_inventory.md](../../../../docs/02_srs/02_inventory.md) |
| [Monitoring](Monitoring/) | `MON` | M2 | 🔜 Khung | [03_monitoring.md](../../../../docs/02_srs/03_monitoring.md) |
| [Metrics](Metrics/) | `MET` | M2 | 🔜 Khung | [04_metrics.md](../../../../docs/02_srs/04_metrics.md) |
| [Incident](Incident/) | `INC` | M3 | 🔜 Khung | [05_incident.md](../../../../docs/02_srs/05_incident.md) |
| [Notification](Notification/) | `NTF` | M3 | 🔜 Khung | [06_notification.md](../../../../docs/02_srs/06_notification.md) |
| [Realtime](Realtime/) | `RTM` | M4 | 🔜 Khung | [07_realtime.md](../../../../docs/02_srs/07_realtime.md) |
| [Audit](Audit/) | `AUD` | M4 | 🔜 Khung | [08_audit.md](../../../../docs/02_srs/08_audit.md) |

## Khuôn hình bắt buộc cho mỗi service

```
<Service>/
 ├── SOE.<Service>.Domain/           # Entity, value object, domain event — không phụ thuộc hạ tầng
 ├── SOE.<Service>.Application/      # Command/Query + validator + port (interface)
 ├── SOE.<Service>.Infrastructure/   # EF Core, MassTransit, SSH/SMTP… — hiện thực các port
 └── SOE.<Service>.Api/              # Minimal API, chỉ nối dây
```

Service có tiến trình nền (Monitoring) có thêm `SOE.<Service>.Worker`.

## Quy trình thêm một service mới

1. Đọc SRS tương ứng trong `docs/02_srs/` và use case liên quan trong `docs/03_usecases/`.
2. Tạo 4 project theo khuôn hình trên, thêm vào `SmartOpsEngine.sln`.
3. Tham chiếu `SOE.BuildingBlocks.*` thay vì viết lại Result/Error/middleware.
4. Khai báo event mới trong `src/BuildingBlocks/SOE.Contracts/<Module>/` (có hậu tố `V1`).
5. Thêm project test `tests/SOE.<Service>.UnitTests` và cập nhật `tests/SOE.ArchitectureTests`.
6. Thêm route + policy vào `src/Gateway/SOE.Gateway/appsettings.json`.
7. Thêm Dockerfile + mục trong `deploy/docker/docker-compose.yml`.
8. Cập nhật ma trận truy vết `docs/05_traceability_matrix.md`.

> Ranh giới bắt buộc: **không service nào truy cập database của service khác**. Trao đổi qua
> integration event trên RabbitMQ, hoặc HTTP nội bộ có mTLS khi bắt buộc đồng bộ.
