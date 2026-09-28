# Smart Ops Engine

Hệ thống giám sát sức khỏe máy chủ (CPU / RAM / Disk qua SSH), phát hiện sự cố và cảnh báo đa kênh.

Repo đang trong giai đoạn **chuyển từ v1 (Spring Boot monolith) sang v3 (.NET 8 microservices)**.

## Bản đồ thư mục

```
Smart-Ops-Engine/
├── apps/                      # Mã nguồn sản phẩm
│   ├── backend-v3/            # ⭐ .NET 8 microservices — hệ thống đang xây (mốc M1)
│   ├── web/                   # React 19 + Vite + Tailwind — giao diện người dùng
│   └── legacy-v1/             # Spring Boot 3.2.4 — bản v1, đóng băng, chỉ sửa lỗi
├── docs/                      # ⭐ Đặc tả v3: kiến trúc, SRS, use case, test case, ma trận truy vết
│   └── legacy-v1/             # Tài liệu v1 cũ (SRS + test_cases) — chỉ để tham chiếu
├── deploy/                    # Docker Compose (dev) và Kubernetes (staging/production)
├── tools/                     # Script phát triển, kịch bản k6, script SQL vận hành
└── .github/workflows/         # CI/CD
```

Ai làm phần nào, thứ tự triển khai: [docs/06_workplan.md](docs/06_workplan.md).

## Bắt đầu nhanh

| Việc | Lệnh |
|---|---|
| Build & test backend v3 | `dotnet test apps/backend-v3/SmartOpsEngine.sln` |
| Chạy Identity (v3) | `dotnet run --project apps/backend-v3/src/Services/Identity/SOE.Identity.Api --urls http://localhost:5001` |
| Chạy Gateway (v3) | `dotnet run --project apps/backend-v3/src/Gateway/SOE.Gateway --urls http://localhost:8080` |
| Chạy giao diện | `cd apps/web && npm install && npm run dev` |
| Dựng môi trường Docker | `docker compose -f deploy/docker/docker-compose.yml up -d --build` |
| Chạy backend v1 | `cd apps/legacy-v1 && ./mvnw.cmd spring-boot:run` |

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Tài liệu đặc tả v3 | ✅ Hoàn chỉnh — 44 tài liệu, ~210 yêu cầu chức năng, 28 use case, ~330 test case |
| `apps/backend-v3` | 🟡 M1 xong: BuildingBlocks + Gateway + Identity (49 test xanh); M2–M5 chưa bắt đầu |
| `apps/web` | 🟡 Đủ 9 màn hình nhưng còn chạy **mock** — chưa nối API thật |
| `apps/legacy-v1` | 🟢 Đang chạy được, không phát triển thêm |
| `deploy` | 🟡 Có Docker Compose cho M1; Kubernetes chưa làm |
| CI/CD | 🔴 Chưa có |

## Tài liệu nên đọc trước khi code

1. [docs/README.md](docs/README.md) — mục lục và quy ước định danh
2. [docs/01_architecture/system_architecture.md](docs/01_architecture/system_architecture.md) — bức tranh tổng thể
3. [docs/01_architecture/solid_clean_architecture.md](docs/01_architecture/solid_clean_architecture.md) — khuôn hình mã nguồn bắt buộc
4. SRS của service mình phụ trách trong [docs/02_srs/](docs/02_srs/README.md)
5. [CLAUDE.md](CLAUDE.md) — quy ước làm việc trong repo
