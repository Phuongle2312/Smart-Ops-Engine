# AI Agent chẩn đoán sự cố — nguyên lý và kịch bản demo

Tài liệu cho phần AI Agent của Smart Ops Engine: nguyên lý hoạt động, cách chạy, kịch bản demo trước lớp và
cách tự kiểm chứng. Mã nguồn: [apps/ai-service/app/agent.py](../../apps/ai-service/app/agent.py),
[apps/ai-service/app/llm.py](../../apps/ai-service/app/llm.py).

## 1. Agent là gì và khác gì chatbot / pipeline

| | Chatbot | Pipeline cố định (`/diagnose`) | **AI Agent** (`/agent/diagnose`) |
|---|---|---|---|
| Ai quyết định bước tiếp theo? | Người dùng | Lập trình viên (code cứng) | **LLM** |
| Dùng công cụ ngoài? | Không | Có, theo thứ tự cố định | Có, LLM tự chọn công cụ và thứ tự |
| Dừng khi nào? | Sau 1 câu trả lời | Hết các bước | LLM tự gọi `finish` khi đủ bằng chứng |
| Tự đối chiếu nguồn? | Không | Không | Có: nghi ngờ thì gọi thêm công cụ |

Định nghĩa dùng trong đồ án: **agent = LLM + công cụ + vòng lặp quan sát–quyết định, có điều kiện dừng và giới hạn an toàn.**

## 2. Kiến trúc

```
Web (trang Chẩn đoán, bật "Dùng AI Agent")
   │  POST /api/agent/diagnose  (ảnh? + node + ghi chú)
   ▼
Backend Spring Boot (DiagnosisController) ── kiểm tra đầu vào, node tồn tại
   │  POST /agent/diagnose
   ▼
ai-service (FastAPI)  ── DiagnosisAgent ──► LLM (Ollama nội bộ | OpenAI/ChatGPT | Gemini)
                               │  ▲
                  gọi công cụ  │  │ kết quả công cụ
                               ▼  │
        analyze_image · get_node_metrics · search_runbook · get_runbook · finish
```

## 3. Vòng lặp của agent

```
messages = [system prompt, mục tiêu (node, có ảnh?, ghi chú)]
lặp tối đa AI_AGENT_MAX_STEPS (mặc định 6) lần:
    reply = LLM(messages, danh sách công cụ)
    nếu reply không gọi công cụ  → nhắc "hãy gọi công cụ hoặc finish", lặp tiếp
    với mỗi công cụ LLM yêu cầu:
        kết quả = chạy công cụ (lỗi → trả chuỗi lỗi cho LLM, không sập)
        thêm (yêu cầu, kết quả) vào messages        ← "bộ nhớ ngắn hạn"
    nếu đã gọi finish → dừng
kết luận = tham số của finish (đã kiểm tra), hoặc dự phòng nếu hết bước
```

Điểm mấu chốt: **LLM không tự chạy gì cả.** Nó chỉ trả về "tôi muốn gọi công cụ X với tham số Y"; code Python mới là nơi
thực thi, rồi đưa kết quả lại cho LLM đọc. Đây là cơ chế *tool calling* (function calling).

### Các thành phần

| Thành phần | Vai trò | Ở đâu |
|---|---|---|
| **LLM** (bộ não) | Đọc tình huống, chọn công cụ, tổng hợp kết luận | `llm.py` — `OllamaChat`, `OpenAIChat` |
| **Công cụ** (tay chân) | Thu thập bằng chứng; **chỉ đọc** | `agent.py` — `TOOLS`, `_call_tool` |
| **Bộ nhớ ngắn hạn** | Danh sách `messages` của một lần chạy | `DiagnosisAgent.run` |
| **Tri thức** (RAG) | Runbook nội bộ cho từng loại lỗi | `data/knowledge/*.md`, `knowledge.py` |
| **System prompt** | Quy tắc: dùng công cụ không đoán, chỉ gợi ý, không tự sửa | `SYSTEM_PROMPT` |
| **Rào chắn** | Giới hạn bước, kiểm tra đầu ra, lỗi không làm sập | `_build`, `agent_max_steps` |

### Công cụ

| Công cụ | Làm gì | Nguồn dữ liệu |
|---|---|---|
| `analyze_image` | OCR + luật + vision LLM trên ảnh đính kèm → mã lỗi, độ tin cậy, bằng chứng | pipeline sẵn có |
| `get_node_metrics` | CPU/RAM/Disk gần đây (min/max/avg/mới nhất) | backend Java `/api/nodes/{id}/metrics` |
| `search_runbook` | Tìm tri thức liên quan theo mô tả | RAG (Qdrant hoặc từ khóa) |
| `get_runbook` | Runbook đầy đủ theo mã lỗi | `data/knowledge/` |
| `finish` | Kết luận cuối: mã lỗi, độ tin cậy, tóm tắt, các bước gợi ý | — |

### Định dạng công cụ gửi cho LLM

Mỗi công cụ được mô tả bằng JSON Schema (tên, mô tả, tham số). Ví dụ `get_runbook`:

```json
{"type": "function", "function": {
  "name": "get_runbook",
  "description": "Lấy runbook đầy đủ (nguyên nhân, kiểm tra, xử lý) theo mã lỗi.",
  "parameters": {"type": "object",
                 "properties": {"code": {"type": "string", "enum": ["RAM_OOM_KILLER", "..."]}},
                 "required": ["code"]}}}
```

LLM thấy danh sách này và trả về một `tool_call` như `{"name": "get_runbook", "arguments": {"code": "GPU_XID_ERROR"}}`.
`llm.py` chuyển qua lại giữa định dạng nội bộ và định dạng của từng nhà cung cấp (Ollama nhận tham số dạng object,
OpenAI/Gemini nhận chuỗi JSON kèm `tool_call_id`).

## 4. An toàn và xử lý lỗi

| Rủi ro | Cách xử lý |
|---|---|
| Agent tự thực thi lệnh nguy hiểm | Không có công cụ ghi/chạy lệnh. Mọi công cụ chỉ đọc; kết quả chỉ là gợi ý cho người phụ trách |
| LLM lặp vô hạn | Tối đa `AI_AGENT_MAX_STEPS` bước |
| Hết bước mà chưa `finish` | Dùng kết quả `analyze_image` gần nhất (độ tin cậy × 0,8) và ghi cảnh báo; không có thì trả `UNKNOWN` |
| LLM bịa mã lỗi / độ tin cậy | Mã ngoài danh sách → `UNKNOWN` (độ tin cậy ≤ 0,5); độ tin cậy kẹp trong 0–1 |
| LLM gọi công cụ không tồn tại / tham số sai | Trả chuỗi lỗi cho LLM tự sửa, vòng lặp không sập |
| LLM / mạng lỗi | Trạng thái `llm_error`, kèm cảnh báo |
| Lộ khóa API | Khóa chỉ đọc từ biến môi trường `AI_LLM_API_KEY`, không commit |
| Prompt injection qua ảnh (chữ trong ảnh ra lệnh cho LLM) | Hạn chế: công cụ chỉ đọc, đầu ra được kiểm tra. Chưa có bộ lọc riêng — đây là giới hạn đã biết |

## 5. Cấu hình nhà cung cấp LLM

Biến môi trường (xem [.env.example](../../apps/ai-service/.env.example)):

| Mục tiêu | Cấu hình |
|---|---|
| Nội bộ (Ollama) | `AI_LLM_PROVIDER=ollama`, `AI_LLM_MODEL=qwen2.5:7b` (chạy `ollama pull qwen2.5:7b`) |
| ChatGPT (OpenAI) | `AI_LLM_PROVIDER=openai`, `AI_LLM_BASE_URL=https://api.openai.com/v1`, `AI_LLM_MODEL=<model>`, `AI_LLM_API_KEY=<khóa>` |
| Gemini | `AI_LLM_PROVIDER=openai`, `AI_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `AI_LLM_MODEL=<model Gemini>`, `AI_LLM_API_KEY=<khóa>` |

Đọc metrics thật: đặt `AI_BACKEND_URL=http://localhost:8080`.

> Hai đường cloud (OpenAI, Gemini) mới được kiểm thử bằng test giả lập định dạng yêu cầu/đáp ứng, **chưa gọi API thật**.
> Trước buổi demo hãy thử một lần với khóa của bạn. Tên model đổi theo thời gian — dùng tên model hiện có trong tài khoản.

## 6. Kịch bản demo (≈ 8–10 phút)

### Chuẩn bị (làm trước, không làm trên lớp)

1. Chạy 3 thành phần (xem README gốc):
   ```powershell
   cd apps/backend;    .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"   # H2, không cần SQL Server
   cd apps/ai-service; .\.venv\Scripts\uvicorn app.main:app --port 8001
   cd apps/web;        npm run dev
   ```
   Đặt các biến `AI_*` ở mục 5 **trước khi** chạy ai-service.
2. Tạo sẵn 1 node trên trang "Máy chủ" (ví dụ máy local) để chọn khi demo.
3. Chuẩn bị 2 ảnh: một ảnh lỗi rõ chữ (ví dụ `NVRM: Xid 79` hoặc `Out of memory: Killed process`) và một ảnh mờ / không liên quan.
4. Chạy thử toàn bộ kịch bản 1 lần. Có sẵn video quay màn hình dự phòng nếu LLM chậm.
5. Kiểm tra: `curl http://localhost:8001/health` trả `status: ok`.

### Diễn biến

| Phút | Việc làm | Điều cần nói |
|---|---|---|
| 0–2 | Mở sơ đồ mục 2 và vòng lặp mục 3 | Agent khác pipeline ở chỗ LLM tự quyết định bước tiếp theo. LLM chỉ "yêu cầu", code mới thực thi |
| 2–4 | **Demo 1 — ảnh rõ.** Trang Chẩn đoán → chọn node → tải ảnh lỗi rõ → bật "Dùng AI Agent" → "Chạy agent" | Chờ kết quả. Chỉ vào danh sách bước: agent gọi `analyze_image` trước (theo system prompt), rồi tự quyết định có cần đối chiếu thêm không |
| 4–6 | **Demo 2 — không có ảnh.** Bỏ ảnh, chỉ nhập ghi chú ("máy chậm từ sáng, nghi hết RAM") → chạy | Không có ảnh nên agent không thể `analyze_image`; xem nó chuyển sang `get_node_metrics` / `search_runbook`. Đây là điểm khác pipeline cố định (luôn cần ảnh) |
| 6–7 | **Demo 3 — ca khó.** Ảnh mờ / không liên quan | Agent phải trả `UNKNOWN` hoặc độ tin cậy thấp thay vì bịa. Nhấn mạnh rào chắn ở mục 4 |
| 7–8 | Mở [agent.py](../../apps/ai-service/app/agent.py): `TOOLS`, `run`, `_build` | Chỉ ba chỗ: khai báo công cụ, vòng lặp, kiểm tra đầu ra |
| 8–9 | (Tùy chọn) Đổi `AI_LLM_PROVIDER` sang Gemini/OpenAI, chạy lại cùng ca | Cùng một agent, đổi "bộ não" chỉ bằng cấu hình |
| 9–10 | Hỏi đáp | Xem mục 7 |

> Thứ tự công cụ phụ thuộc vào LLM nên **có thể khác** giữa các lần chạy và giữa các mô hình — đó chính là bản chất của agent.
> Đừng hứa trước một chuỗi bước cụ thể; hãy giải thích từng bước thực tế trong `trace`.

### Cách đọc kết quả trên màn hình

- Khối "Kết luận của agent": mã lỗi, mức nghiêm trọng, độ tin cậy, trạng thái (`Đã kết luận` / `Hết số bước` / `LLM lỗi`), tên LLM đã dùng.
- "Các bước agent đã thực hiện": mỗi dòng là một lần gọi công cụ — tên công cụ, tham số, kết quả (cắt tối đa 500 ký tự).
- Chạy cùng ca bằng `curl` để thấy JSON thô:
  ```bash
  curl -F "file=@loi.png" -F "node_id=1" http://localhost:8001/agent/diagnose
  ```

## 7. Câu hỏi thường gặp khi bảo vệ

- **Sao không để agent tự sửa lỗi?** Quyết định có chủ đích: sửa lỗi trên máy chủ thật là hành động không thể đảo ngược; đội vận hành cần xác nhận. Thêm công cụ ghi cần có bước phê duyệt của con người.
- **Sao không dùng LangChain / framework agent?** Vòng lặp chỉ ~40 dòng; tự viết giúp hiểu rõ và dễ kiểm thử. Dùng framework khi cần nhiều agent hoặc bộ nhớ dài hạn.
- **Khác gì gọi thẳng ChatGPT?** LLM đơn lẻ không thấy ảnh, metrics hay runbook của hệ thống này; công cụ cho nó dữ liệu thật và vòng lặp cho nó kiểm tra chéo.
- **Làm sao biết kết quả đúng?** Độ tin cậy do LLM tự báo **không đáng tin tuyệt đối** (xem hiệu chỉnh vision trong [README ai-service](../../apps/ai-service/README.md)). Người phụ trách vẫn phải xác nhận; có cơ chế phản hồi đúng/sai ở luồng chẩn đoán ảnh.
- **Giới hạn hiện tại?** Bộ nhớ chỉ trong một lần chạy; một agent; chưa lọc prompt injection; mô hình nhỏ chạy CPU có thể gọi công cụ chưa ổn; chưa đo độ chính xác của agent trên ảnh chụp thật.

## 8. Kiểm chứng

```powershell
cd apps/ai-service
.\.venv\Scripts\python -m pytest -q tests/test_agent.py      # vòng lặp, công cụ, rào chắn, định dạng OpenAI/Ollama
cd ../backend
.\mvnw.cmd test "-Dtest=DiagnosisControllerTest"             # endpoint /api/agent/diagnose
```

Các test dùng LLM giả có kịch bản (`ScriptedLLM`) nên chạy không cần Ollama hay khóa API. Chúng chứng minh **vòng lặp và rào chắn đúng**,
không chứng minh chất lượng quyết định của một LLM thật.
