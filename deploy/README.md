# deploy — hạ tầng triển khai

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| [docker/](docker/docker-compose.yml) | Ollama + Qdrant + ai-service, chạy CPU (`docker-compose.local.yml` cho máy dev) | ✅ |

**Server (Xeon, không GPU)** — Ollama chạy trong container:

```bash
docker compose -f deploy/docker/docker-compose.yml up -d
```

**Máy dev** (i5-11300H, 24 GB RAM; Docker Desktop chỉ được ~12 GB) — Ollama chạy native, Docker chỉ chạy Qdrant + ai-service,
model `qwen2.5vl:3b`, ai-service giới hạn 2 CPU / 3 GB:

```powershell
$env:CUDA_VISIBLE_DEVICES = "-1"; ollama serve      # GTX 1650 lỗi CUDA nên ép chạy CPU
ollama pull qwen2.5vl:3b; ollama pull bge-m3
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.local.yml up -d --build
curl -X POST http://localhost:8001/knowledge/reindex   # nạp runbook vào Qdrant
```

Khi dự án chạy ổn và lên server thật: bỏ file `docker-compose.local.yml`, đặt `AI_VISION_MODEL=qwen2.5vl:7b`.

## Nguyên tắc

- **Không secret trong repo**: mọi giá trị nhạy cảm qua `.env` (đã gitignore).
- Mô hình AI chạy nội bộ, không gửi ảnh ra dịch vụ ngoài.
- `ai-service` đã có trong compose; backend Java chưa có Dockerfile nên vẫn chạy bằng `mvnw`.
