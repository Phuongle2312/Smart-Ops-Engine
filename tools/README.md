# tools — script và tiện ích hỗ trợ

Nơi chứa mọi thứ **không phải sản phẩm** nhưng cần cho phát triển và vận hành.

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `scripts/` | Script tiện ích cho lập trình viên (sinh khóa JWT, reset DB dev, seed dữ liệu mẫu) | 🔜 |
| `perf/` | Kịch bản k6 theo [docs/04_test_cases/performance_scaling_tests.md](../docs/04_test_cases/performance_scaling_tests.md) | 🔜 M5 |
| `db/` | Script SQL vận hành: tạo partition, kiểm tra toàn vẹn chuỗi hash audit, dọn dữ liệu | 🔜 |

## Việc thường dùng

Sinh khóa RSA để ký JWT (đưa nội dung vào biến môi trường `Jwt__PrivateKeyPem`, **không commit**):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
```

Tạo migration mới cho một service:

```bash
dotnet ef migrations add <Ten> --project apps/backend-v3/src/Services/Identity/SOE.Identity.Infrastructure --startup-project apps/backend-v3/src/Services/Identity/SOE.Identity.Api --output-dir Persistence/Migrations
```
