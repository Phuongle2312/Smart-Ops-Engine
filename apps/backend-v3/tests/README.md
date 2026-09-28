# Tests — phân chia theo cấp kiểm thử

Quy ước cấp test và mẫu test case: [docs/04_test_cases/README.md](../../../docs/04_test_cases/README.md).

| Project | Cấp | Phạm vi | Trạng thái |
|---|---|---|---|
| `SOE.Identity.UnitTests` | UNIT | Domain + Application của Identity, không I/O | ✅ 41 test |
| `SOE.ArchitectureTests` | UNIT | Ràng buộc phụ thuộc giữa các lớp (NetArchTest) | ✅ 8 test |
| `SOE.<Service>.UnitTests` | UNIT | Mỗi service một project, thêm khi hiện thực service đó | 🔜 M2–M4 |
| `SOE.IntegrationTests` | INT | `WebApplicationFactory` + Testcontainers (SQL Server, RabbitMQ) | 🔜 M1 còn nợ |
| `SOE.ContractTests` | CON | Snapshot JSON schema của integration event | 🔜 M2 |
| `SOE.Gateway.Tests` | API/SEC | Định tuyến, JWT, RBAC, rate limit, security header | 🔜 M1 còn nợ |

Kiểm thử E2E (Playwright) nằm ở `apps/web/tests/`; kiểm thử hiệu năng (k6) nằm ở `tools/perf/`.

## Nguyên tắc

1. **Unit test không chạm I/O** — không DB, không HTTP, không hệ thống tệp; dùng `IClock` và
   `NSubstitute` cho mọi port.
2. **Một test một khẳng định nghiệp vụ**; tên test bằng tiếng Việt mô tả hành vi mong đợi.
3. Mỗi test tham chiếu mã test case trong `docs/04_test_cases/` để giữ ma trận truy vết luôn đúng.
4. Cổng chất lượng CI: Domain + Application ≥ 80% coverage, toàn service ≥ 65% (NFR-MNT-001).

```bash
dotnet test apps/backend-v3/SmartOpsEngine.sln
```
