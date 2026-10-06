# Công cụ AI đã dùng trong dự án

Tài liệu này ghi lại công cụ AI được dùng để **làm ra** dự án (hỗ trợ lập trình) và công cụ AI **nằm trong** sản phẩm.
Các mục đánh dấu **[ĐIỀN]** là những việc repo không có bằng chứng — tác giả tự điền theo thực tế, **không điền nếu chưa dùng**.

## 1. AI hỗ trợ lập trình

### 1.1 Claude Code (đã dùng — có bằng chứng trong repo)

| Bằng chứng | Chi tiết |
|---|---|
| Lịch sử git | 7 commit có dòng `Co-Authored-By: Claude …` (5 commit Claude Opus 5, 2 commit Claude Sonnet 5.5) — xem `git log --grep="Co-Authored-By"` |
| [CLAUDE.md](../CLAUDE.md) | Tệp hướng dẫn cho Claude Code: kiến trúc, lệnh build/test, quy ước code, cạm bẫy đã biết |
| `.claude/launch.json` | Cấu hình chạy dev server để Claude Code kiểm tra giao diện |

Cách dùng thực tế trong dự án (phần AI Agent, commit `9f2da2c`):

| Việc | Cách làm |
|---|---|
| Khảo sát và đối chiếu yêu cầu | Đọc toàn bộ repo, đối chiếu từng yêu cầu của môn học, chỉ ra chỗ chưa đạt |
| Thiết kế và viết code | AI Agent (`agent.py`, `llm.py`), endpoint backend, giao diện web — viết theo quy ước trong CLAUDE.md |
| Kiểm thử | Viết test (`test_agent.py`, test controller), chạy test, chạy lint và build web |
| Kiểm tra giao diện | Chạy web trên trình duyệt tích hợp, thao tác thử và chụp màn hình |
| Viết tài liệu | `docs/ai-agent/README.md`, README các phần |
| Commit | Tách thành commit có thông điệp rõ ràng |

**Đánh giá:** AI viết nhanh phần khung và test, nhưng cần người rà soát. Ví dụ trong lần làm agent, giao diện chỉ được kiểm tra
với kết quả API giả lập; việc chạy với LLM thật vẫn do người thực hiện. Mọi quyết định thiết kế (agent chỉ đọc, không tự sửa lỗi)
do người chốt.

> **[ĐIỀN]** Những phần cụ thể bạn tự hướng dẫn / sửa lại sau khi AI sinh code, và bài học rút ra.

### 1.2 Thiết kế giao diện: Figma, Stitch, …

**[ĐIỀN]** Repo hiện **không có** tệp hay tham chiếu nào cho Figma hay Stitch. Giao diện React/Tailwind hiện có được viết trực tiếp bằng code.

Nếu có dùng, ghi theo mẫu:

| Công cụ | Dùng cho màn hình nào | Cách dùng (prompt / mẫu) | Link bản thiết kế | Kết quả so với sản phẩm cuối |
|---|---|---|---|---|
| **[ĐIỀN]** | | | | |

Nếu chưa dùng và muốn có minh chứng cho yêu cầu môn học: thiết kế lại một màn hình nhỏ (ví dụ trang Chẩn đoán) bằng
Stitch hoặc Figma, lưu ảnh chụp thiết kế vào `docs/design/`, rồi ghi so sánh với giao diện thật vào bảng trên.

### 1.3 Công cụ khác

**[ĐIỀN]** ChatGPT, Gemini, GitHub Copilot, … nếu có dùng để hỏi đáp / sinh code. Chỉ ghi công cụ thật sự đã dùng.

## 2. AI nằm trong sản phẩm

| Thành phần | Công cụ / mô hình | Vai trò | Nơi cấu hình |
|---|---|---|---|
| Vision LLM | `qwen2.5vl` (Ollama, chạy nội bộ) | Nhận diện loại lỗi từ ảnh | `AI_VISION_MODEL` |
| Embedding | `bge-m3` (Ollama) | Vector hóa runbook cho RAG | `AI_EMBED_MODEL` |
| OCR | RapidOCR (tùy chọn) | Đọc chữ trong ảnh để áp luật | `AI_OCR_ENABLED` |
| Vector store | Qdrant (tùy chọn) | Tìm tri thức theo vector | `AI_QDRANT_URL` |
| LLM của agent | Ollama (`qwen2.5:7b`) **hoặc** API tương thích OpenAI (ChatGPT, Gemini) | Bộ não của AI Agent: chọn công cụ, kết luận | `AI_LLM_PROVIDER`, `AI_LLM_*` |

- Nguyên lý và kịch bản demo của agent: [ai-agent/README.md](ai-agent/README.md).
- Gọi **API ChatGPT / Gemini**: code đã hỗ trợ (`app/llm.py`, lớp `OpenAIChat`) nhưng mới được kiểm thử bằng test giả lập.
  **[ĐIỀN]** ngày bạn chạy thử với khóa thật, model đã dùng và kết quả. Khóa API chỉ đặt trong biến môi trường, không commit.

## 3. Tóm tắt đối chiếu với yêu cầu môn học

| Yêu cầu | Trạng thái | Bằng chứng / việc còn lại |
|---|---|---|
| Công cụ AI hỗ trợ lập trình | Một phần | Claude Code (mục 1.1). Figma/Stitch: **[ĐIỀN]** hoặc làm bổ sung (mục 1.2) |
| Dùng API ChatGPT / Gemini viết ứng dụng | Code đã có, chưa chạy thật | Chạy thử với khóa thật và ghi kết quả (mục 2) |
| Trợ lý hỗ trợ công việc | Có | Trợ lý chẩn đoán sự cố vận hành |
| Tự tạo AI Agent, demo, giải thích nguyên lý | Có | [ai-agent/README.md](ai-agent/README.md); cần chạy demo thử với LLM thật |
