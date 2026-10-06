# deploy — hạ tầng triển khai

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| [docker/](docker/docker-compose.yml) | Ollama (vision LLM + embedding) và Qdrant (vector store), chạy CPU | ✅ |

```bash
docker compose -f deploy/docker/docker-compose.yml up -d
```

## Nguyên tắc

- **Không secret trong repo**: mọi giá trị nhạy cảm qua `.env` (đã gitignore).
- Mô hình AI chạy nội bộ, không gửi ảnh ra dịch vụ ngoài.
- Backend Java và `ai-service` sẽ được thêm vào compose khi có Dockerfile.
