# ai-service — chẩn đoán lỗi RAM/CPU/GPU từ ảnh

Python FastAPI, chạy mô hình **nội bộ** (Ollama). Đặc tả: [docs/ai-diagnosis/SRS.md](../../docs/ai-diagnosis/SRS.md).
Chỉ nhận diện và gợi ý hướng xử lý — **không thực thi lệnh sửa lỗi**.

## Cách hoạt động

`ảnh → tiền xử lý → OCR → luật từ khóa → (vision LLM nếu luật < 0,85) → hợp nhất → runbook + RAG → JSON`

| File | Vai trò |
|---|---|
| `app/taxonomy.py` | Danh sách mã lỗi (nguồn duy nhất) |
| `app/rules.py` | Luật regex + trọng số trên văn bản OCR |
| `app/ocr.py` | RapidOCR (tùy chọn) |
| `app/vision.py` | Gọi Ollama vision, ép JSON, kiểm tra mã lỗi |
| `app/knowledge.py` | Runbook theo mã + RAG (Qdrant hoặc từ khóa) |
| `app/pipeline.py` | Điều phối và hợp nhất kết quả |
| `app/library.py` | Thêm ảnh có nhãn vào `data/error-images/`, ghi phản hồi |
| `app/main.py` | Các endpoint |

## Chạy

```powershell
cd apps/ai-service
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest -q                         # test (không cần Ollama)
.\.venv\Scripts\uvicorn app.main:app --port 8001            # chạy dev
```

OCR tùy chọn (cần Python ≤ 3.12): `pip install -r requirements-ocr.txt`. Không cài thì service chỉ dùng vision LLM.

Mô hình vision (cần Ollama đang chạy, ví dụ qua `docker compose -f deploy/docker/docker-compose.yml up -d`):

```bash
docker exec -it smart-ops-engine-ollama-1 ollama pull qwen2.5vl:7b
docker exec -it smart-ops-engine-ollama-1 ollama pull bge-m3
```

Cấu hình qua biến môi trường `AI_*` — xem `.env.example`.

## API

| Endpoint | Mô tả |
|---|---|
| `GET /health` | Trạng thái OCR, Ollama, kiểu tìm kiếm, số runbook |
| `POST /diagnose` | `multipart`: `file`, `node_id?`, `note?` → chẩn đoán |
| `POST /library/images` | Thêm ảnh có nhãn: `file`, `error_code`, `source?`, `license?`, `labeler?` |
| `POST /feedback` | `{diagnosis_id, correct, correct_code?, comment?}` |
| `POST /knowledge/reindex` | Nạp lại runbook / vector store |

```bash
curl -F "file=@loi.png" -F "node_id=srv-01" http://localhost:8001/diagnose
```

## AI Agent (`POST /agent/diagnose`)

Khác `/diagnose` (luồng cố định), agent để **LLM tự quyết định** gọi công cụ nào và khi nào kết luận (`app/agent.py`).

```
mục tiêu → LLM chọn công cụ → chạy → kết quả đưa lại LLM → ... → finish
```

| Công cụ | Việc làm |
|---|---|
| `analyze_image` | chạy pipeline OCR + luật + vision trên ảnh đính kèm |
| `get_node_metrics` | đọc CPU/RAM/Disk thật từ backend Java (`AI_BACKEND_URL`) |
| `search_runbook` / `get_runbook` | RAG / runbook theo mã |
| `finish` | kết luận: mã lỗi, độ tin cậy, tóm tắt, các bước gợi ý |

Mọi công cụ chỉ **đọc**; agent không thực thi lệnh sửa lỗi. Giới hạn `AI_AGENT_MAX_STEPS` (mặc định 6); hết bước mà chưa
`finish` thì dùng kết quả `analyze_image` và cảnh báo rõ. Phản hồi có `trace` ghi từng bước (công cụ, tham số, kết quả) để demo/giải thích.

Nhà cung cấp LLM (`AI_LLM_PROVIDER`): `ollama` (nội bộ, mô hình có tool calling như `qwen2.5:7b`) hoặc `openai`
(API tương thích OpenAI: ChatGPT, hoặc Gemini qua `AI_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`).
Xem `.env.example`.

```bash
curl -F "file=@loi.png" -F "node_id=1" http://localhost:8001/agent/diagnose
```

## Thêm tri thức

- Loại lỗi mới: thêm vào `app/taxonomy.py`, mẫu luật vào `app/rules.py`, runbook `data/knowledge/<MÃ>.md`
  (test `test_knowledge.py` kiểm tra mọi mã đều có runbook đủ 4 mục).
- Tri thức chung (incident đã xử lý, ghi chú hệ thống): thả file `.md` vào `data/knowledge/`, rồi gọi `/knowledge/reindex`.

## Đo hiệu năng và độ chính xác

```powershell
.\.venv\Scripts\python scripts\benchmark.py --model qwen2.5vl:7b --runs 3 --json bench.json
```

Chạy **trên máy sẽ triển khai** (số đo phụ thuộc phần cứng). Dùng ảnh thật trong `data/error-images/`; chưa có thì vẽ ảnh
chữ mô phỏng (chỉ kiểm tra chức năng + độ trễ). Script không tự tải model — thiếu thì in lệnh `ollama pull`.
In: thời gian nạp model, p50/p95 mỗi ảnh, token/s, độ chính xác, so với NFR-AI-002 (≤ 120 giây).

## Lưu ý hiệu năng (CPU, không GPU)

Đường luật ≈ 1–2 giây. Vision chạy CPU nên backend gọi bất đồng bộ.

**Số đo thực tế (2026-10-05)** — máy dev: Core i5-11300H (4 nhân/8 luồng), 24 GB RAM, Ollama 0.35.1 chạy CPU,
`qwen2.5vl:3b`, 11 ảnh chữ mô phỏng (không phải ảnh chụp thật):

| Chỉ số | Giá trị |
|---|---|
| Nạp model lần đầu | 7–45 giây (tùy cache đĩa) |
| Ảnh mới | khoảng 17–21 giây/ảnh (p95 20,5 s) |
| Ảnh lặp lại (cache prompt) | khoảng 6–8 giây |
| Tốc độ sinh | khoảng 11–12 token/giây |
| Embedding 11 đoạn runbook (`bge-m3`) | 4,8 giây |
| Độ chính xác trên ảnh mô phỏng | 22/22 — **dễ, chữ rõ, không đại diện cho ảnh chụp thật** |

Chưa đo `qwen2.5vl:7b` và chưa đo trên Xeon Gold 5416S. Trên máy dev có GPU GTX 1650, Ollama gặp lỗi
`CUDA error: device kernel image is invalid` và trả 500; chạy CPU bằng cách đặt `CUDA_VISIBLE_DEVICES=-1` trước khi
`ollama serve` (máy Xeon không GPU nên không bị).

**Hiệu chỉnh độ tin cậy vision:** mô hình luôn tự báo `confidence` ≈ 0,90 cho mọi ảnh nên không dùng trực tiếp được.
Pipeline nhân với `AI_VISION_WEIGHT` (mặc định 0,8): vision đứng một mình tối đa 0,8 → luôn `needs_review`, chỉ
`auto_notify` khi luật OCR/ghi chú độc lập đồng thuận (gộp noisy-or). Cột `conf` của `benchmark.py` là giá trị thô
của mô hình, chưa quy đổi.
