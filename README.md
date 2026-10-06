# Smart Ops Engine

Hệ thống giám sát sức khỏe máy chủ (CPU / RAM / Disk qua SSH), phát hiện sự cố và cảnh báo qua email.
Đang bổ sung **chẩn đoán lỗi từ ảnh (RAM / CPU / GPU) bằng AI chạy nội bộ** — chỉ gợi ý và thông báo
cho người phụ trách, việc xử lý do người quản lý thiết bị làm trực tiếp tại máy.

## Bản đồ thư mục

```
Smart-Ops-Engine/
├── apps/
│   ├── backend/       # Spring Boot 3.2.4, Java 17 — lõi nghiệp vụ (node, health check, incident, email)
│   ├── ai-service/    # Python FastAPI — OCR, vision LLM, RAG; chạy mô hình nội bộ
│   └── web/           # React 19 + Vite + Tailwind — giao diện người dùng
├── data/
│   ├── error-images/  # Thư viện ảnh lỗi theo ram/ cpu/ gpu/ + manifest.csv (ảnh không commit)
│   └── knowledge/     # Runbook / tài liệu nội bộ cho RAG
├── docs/
│   ├── legacy-v1/     # Đặc tả (SRS) + test case của backend hiện tại
│   ├── ai-diagnosis/  # Đặc tả chức năng chẩn đoán lỗi bằng ảnh
│   ├── ai-agent/      # Nguyên lý AI Agent + kịch bản demo
│   └── archive-v3/    # Bộ đặc tả .NET microservices — đã lưu trữ, không còn là đích đến
├── deploy/docker/     # Docker Compose: Ollama + Qdrant cho dịch vụ AI
└── tools/scripts/     # test-all.ps1
```

Mã nguồn .NET (v3) đã được gỡ khỏi nhánh chính, lấy lại bằng: `git checkout archive/backend-v3`.

## Bắt đầu nhanh

| Việc | Lệnh |
|---|---|
| Chạy toàn bộ kiểm thử | `.\tools\scripts\test-all.ps1` |
| Chạy backend | `cd apps/backend && .\mvnw.cmd spring-boot:run` |
| Chạy giao diện | `cd apps/web && npm install && npm run dev` |
| Dựng hạ tầng AI (Ollama + Qdrant) | `docker compose -f deploy/docker/docker-compose.yml up -d` |

Biến môi trường backend: xem `apps/backend/.env.example`.

## Trạng thái

| Phần | Trạng thái |
|---|---|
| `apps/backend` | 🟢 Chạy được (6 test xanh) |
| `apps/web` | 🟡 9 màn hình; nodes/sự cố/chẩn đoán ảnh gọi API thật, auth + kênh thông báo + audit log còn mock |
| `apps/ai-service` | 🟡 Chạy được, 33 test xanh; chưa thử với Ollama thật |
| Java ↔ ai-service | 🟡 Backend gọi `/diagnose`, tạo incident, gửi email (25 test xanh, đã thử qua HTTP thật với ai-service); UI đã có (trang Chẩn đoán ảnh + người phụ trách), đã chạy thử toàn luồng trên trình duyệt; chưa thử gửi SMTP thật |
| `data/` | 🟡 Có 11 runbook; thư viện ảnh còn trống |
| CI/CD | 🔴 Chưa có |

## Tài liệu

1. [CLAUDE.md](CLAUDE.md) — quy ước làm việc trong repo
2. [docs/ai-agent/README.md](docs/ai-agent/README.md) — nguyên lý AI Agent và kịch bản demo
3. [docs/legacy-v1/SRS/README.md](docs/legacy-v1/SRS/README.md) — feature matrix backend hiện tại
