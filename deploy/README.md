# deploy — hạ tầng triển khai

| Thư mục | Môi trường | Trạng thái |
|---|---|---|
| [docker/](docker/docker-compose.yml) | Dev & test cục bộ (Docker Compose) | ✅ M1: SQL Server + Identity + Gateway |
| [k8s/base/](k8s/base/) | Manifest dùng chung (Kustomize base) | 🔜 M5 |
| [k8s/overlays/staging/](k8s/overlays/staging/) | Ghi đè cho staging | 🔜 M5 |
| [k8s/overlays/production/](k8s/overlays/production/) | Ghi đè cho production | 🔜 M5 |

Đặc tả đầy đủ: [docs/01_architecture/deployment_scaling.md](../docs/01_architecture/deployment_scaling.md).

## Chạy môi trường dev

```bash
cp deploy/docker/.env.example deploy/docker/.env
```

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

## Nguyên tắc

- **Không secret trong repo**: mọi giá trị nhạy cảm qua `.env` (đã gitignore) hoặc K8s Secret /
  ExternalSecret trỏ tới Key Vault.
- Image chạy user non-root, read-only rootfs, drop mọi capability.
- Migration chạy bằng **Job riêng trước khi rollout**, ứng dụng không tự migrate ở production.
- Thứ tự triển khai: migration job → service backend → gateway → frontend.
