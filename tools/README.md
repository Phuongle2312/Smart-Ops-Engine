# tools — script và tiện ích hỗ trợ

Nơi chứa mọi thứ **không phải sản phẩm** nhưng cần cho phát triển và vận hành.

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `scripts/` | `test-all.ps1` (chạy toàn bộ kiểm thử), `smoke-m1.ps1` (smoke test API M1); sắp có: sinh khóa JWT, reset DB dev, seed dữ liệu | 🟡 |
| `perf/` | Kịch bản k6 theo [docs/04_test_cases/performance_scaling_tests.md](../docs/04_test_cases/performance_scaling_tests.md) | 🔜 M5 |
| `db/` | Script SQL vận hành: tạo partition, kiểm tra toàn vẹn chuỗi hash audit, dọn dữ liệu | 🔜 |

## Việc thường dùng

Chạy toàn bộ kiểm thử (backend-v3, web, legacy-v1; `-Smoke` để khởi động Identity + Gateway và gọi API thật):

```powershell
.\tools\scripts\test-all.ps1
.\tools\scripts\test-all.ps1 -Only backend,web
.\tools\scripts\test-all.ps1 -Smoke -ConnectionString 'Server=localhost,1433;Database=soe_identity_dev;Integrated Security=True;TrustServerCertificate=True;Encrypt=True'
```

Log của service khi chạy smoke nằm ở `tools/scripts/.logs/` (đã gitignore).


Sinh khóa RSA để ký JWT (đưa nội dung vào biến môi trường `Jwt__PrivateKeyPem`, **không commit**):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
```

Tạo migration mới cho một service:

```bash
dotnet ef migrations add <Ten> --project apps/backend-v3/src/Services/Identity/SOE.Identity.Infrastructure --startup-project apps/backend-v3/src/Services/Identity/SOE.Identity.Api --output-dir Persistence/Migrations
```

- `scripts/build_test_docs.py` — sinh `docs/SOE_UseCase_TestCase.xlsx` (use case + test case) từ Markdown trong `docs/`. Cần `pip install openpyxl`.
