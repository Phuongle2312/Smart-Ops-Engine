# CI/CD — GitHub Actions

> Trạng thái: 🔜 **Khung** — chưa có workflow nào. Đặc tả:
> [docs/01_architecture/deployment_scaling.md §6](../../docs/01_architecture/deployment_scaling.md)

## Workflow dự kiến

| Tệp | Job | Chặn merge? |
|---|---|---|
| `backend-ci.yml` | `dotnet build` + unit test + coverage gate + ArchitectureTests | ✔ |
| `backend-integration.yml` | Testcontainers (SQL Server, RabbitMQ) cho từng service | ✔ |
| `contract-tests.yml` | So schema integration event với snapshot | ✔ |
| `frontend-ci.yml` | `npm ci`, lint, vitest, build, kiểm tra ngân sách bundle | ✔ |
| `security.yml` | gitleaks, CodeQL, `dotnet list package --vulnerable`, `npm audit`, Trivy | ✔ |
| `e2e.yml` | Playwright trên môi trường compose dựng tạm | ✔ (nhánh chính) |
| `publish-images.yml` | Build & push image theo `git sha` | — |
| `deploy-staging.yml` | Kustomize apply + migration job + smoke test | tự động |
| `deploy-production.yml` | Phê duyệt thủ công, rolling update, theo dõi SLO, rollback tự động | thủ công |

## Nguyên tắc

- Mỗi workflow chỉ chạy khi thư mục liên quan thay đổi (`paths:`) để tiết kiệm thời gian.
- Pipeline chính phải hoàn tất ≤ 15 phút (NFR-MNT-003).
- Không job nào in secret ra log; dùng `secrets.*` của GitHub, không hardcode.
- Image tag theo `git sha`, không dùng `latest` ở môi trường staging/production.
