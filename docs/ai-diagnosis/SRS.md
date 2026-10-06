# SRS — Chẩn đoán lỗi RAM / CPU / GPU từ ảnh (AI nội bộ)

| Mục | Nội dung |
|---|---|
| Phạm vi | Nhận ảnh lỗi → nhận diện loại lỗi → tra runbook → thông báo email người phụ trách kèm hướng xử lý |
| Ngoài phạm vi | **Không tự thực thi lệnh sửa lỗi.** Người quản lý thiết bị xử lý trực tiếp tại máy |
| Thành phần | `apps/ai-service` (Python FastAPI) + `apps/backend` (Java, incident + email) |
| Mô hình | Chạy nội bộ (Ollama), không gửi ảnh ra dịch vụ ngoài. Phần cứng: Xeon Gold 5416S, 192 GB RAM, **không GPU** |

## 1. Luồng tổng thể

```
Ảnh ──► ai-service /diagnose ──► Tiền xử lý ──► OCR ──► Luật từ khóa ──┐
                                                                        ├─► Hợp nhất ─► Tra runbook (+ RAG) ─► JSON
                                          Vision LLM (khi luật chưa chắc) ┘
JSON ──► backend (Java) ──► tạo IncidentLog ──► tra NodeOwner ──► email người phụ trách (ảnh + nguyên nhân + hướng xử lý)
```

Quy tắc quyết định theo độ tin cậy:

| Độ tin cậy | `decision` | Hành động |
|---|---|---|
| ≥ 0,85 | `auto_notify` | Gửi email ngay |
| 0,60 – 0,85 | `needs_review` | Gửi email, ghi rõ "cần xác nhận" kèm ảnh |
| < 0,60 | `unknown` | Gửi email cho quản trị viên để gắn nhãn thủ công |

OCR + luật chạy trước (≈ 1 giây). Khi luật đạt ≥ 0,85 thì **bỏ qua vision LLM** để tiết kiệm thời gian CPU.

## 2. Phân loại lỗi (taxonomy)

| Mã | Tài nguyên | Mức độ | Mô tả |
|---|---|---|---|
| `RAM_OOM_KILLER` | RAM | critical | Kernel OOM killer kết thúc tiến trình |
| `RAM_JAVA_HEAP` | RAM | high | `java.lang.OutOfMemoryError` (heap / GC overhead) |
| `RAM_SWAP_HIGH` | RAM | medium | Swap sử dụng cao, hệ thống chậm |
| `RAM_LEAK` | RAM | high | Bộ nhớ tăng liên tục, nghi rò rỉ |
| `CPU_HIGH_SUSTAINED` | CPU | high | CPU ~100 % kéo dài |
| `CPU_LOAD_AVG_HIGH` | CPU | medium | Load average vượt số core |
| `CPU_THERMAL_THROTTLE` | CPU | high | CPU giảm xung vì nhiệt |
| `GPU_CUDA_OOM` | GPU | critical | `CUDA out of memory` |
| `GPU_OVERHEAT` | GPU | high | GPU nhiệt độ cao / thermal slowdown |
| `GPU_XID_ERROR` | GPU | critical | NVRM Xid (driver / phần cứng) |
| `GPU_ECC_ERROR` | GPU | critical | Lỗi ECC bộ nhớ GPU |
| `UNKNOWN` | — | low | Không nhận diện được |

Nguồn duy nhất của taxonomy: `apps/ai-service/app/taxonomy.py`. Mỗi mã (trừ `UNKNOWN`) có một runbook ở `data/knowledge/<mã>.md`.

## 3. Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-AI-001 | `POST /diagnose` nhận 1 ảnh (PNG/JPEG/WEBP, ≤ 10 MB), tùy chọn `node_id`, `note`; trả kết quả chẩn đoán JSON |
| FR-AI-002 | Tiền xử lý: kiểm tra ảnh hợp lệ, đổi RGB, thu nhỏ cạnh dài tối đa 1600 px, tính SHA-256 |
| FR-AI-003 | OCR trích văn bản; nếu OCR không khả dụng, hệ thống vẫn chạy (chỉ dùng vision) |
| FR-AI-004 | Luật từ khóa/regex trên văn bản OCR, mỗi mẫu có trọng số; độ tin cậy = tổng trọng số, tối đa 1,0 |
| FR-AI-005 | Vision LLM (Ollama) chỉ được gọi khi luật < 0,85; bắt buộc trả JSON, mã lỗi phải thuộc taxonomy, nếu không → `UNKNOWN` |
| FR-AI-006 | Hợp nhất: confidence tự báo của vision **không hiệu chỉnh** (thực đo luôn ≈ 0,9) nên được nhân hệ số `AI_VISION_WEIGHT` (mặc định 0,8) trước khi dùng — vision đứng một mình tối đa 0,8 < 0,85, không bao giờ `auto_notify`. Hai nguồn cùng mã → gộp noisy-or `1-(1-a)(1-b)`; khác mã → chọn nguồn cao hơn, nhân 0,8 và ghi cảnh báo |
| FR-AI-007 | Vision lỗi/hết thời gian chờ → dùng kết quả luật, thêm `warnings`, không trả lỗi 5xx |
| FR-AI-008 | Gắn `runbook` (tiêu đề, nguyên nhân thường gặp, lệnh chẩn đoán, hướng xử lý, khi nào leo thang) theo mã lỗi |
| FR-AI-009 | RAG: trả `related` — đoạn tri thức liên quan (runbook, incident đã xử lý) bằng tìm kiếm vector (Qdrant + bge-m3); không có Qdrant thì dùng tìm theo từ khóa |
| FR-AI-010 | `POST /library/images` thêm ảnh có nhãn vào `data/error-images/<tài nguyên>/<mã>/` và ghi `manifest.csv` (nguồn, giấy phép, người gắn nhãn) |
| FR-AI-011 | `POST /feedback` ghi phản hồi đúng/sai (kèm mã đúng nếu sai) vào `data/feedback/feedback.jsonl` |
| FR-AI-012 | `POST /knowledge/reindex` nạp lại runbook và tri thức vào vector store |
| FR-AI-013 | `GET /health` báo trạng thái OCR, Ollama, Qdrant, số runbook đã nạp |
| FR-AI-014 | Nếu cấu hình `AI_API_KEY`, mọi endpoint (trừ `/health`) yêu cầu header `X-API-Key` |

## 4. Hợp đồng `POST /diagnose`

Yêu cầu: `multipart/form-data` — `file` (bắt buộc), `node_id`, `note`.

Phản hồi 200:

```json
{
  "diagnosis_id": "b7c1…",
  "image_sha256": "…",
  "node_id": "srv-01",
  "error_code": "GPU_CUDA_OOM",
  "resource": "GPU",
  "severity": "critical",
  "confidence": 0.97,
  "decision": "auto_notify",
  "source": "rules",
  "evidence": ["Khớp mẫu: cuda out of memory"],
  "ocr_text": "RuntimeError: CUDA out of memory …",
  "runbook": { "code": "GPU_CUDA_OOM", "title": "…", "content": "…markdown…" },
  "related": [ { "title": "…", "snippet": "…", "score": 0.71 } ],
  "warnings": [],
  "elapsed_ms": 1210
}
```

Lỗi: `400` ảnh không hợp lệ/quá lớn, `401` sai API key.

## 5. Phía backend Java (package `com.soe.ai`)

- Gọi `/diagnose` bất đồng bộ; trả "đang phân tích" cho người dùng, gửi email khi có kết quả.
- Tạo `IncidentLog` từ kết quả, lưu ảnh và `diagnosis_id`.
- Bảng `NodeOwner` (node ↔ người/nhóm phụ trách ↔ thứ tự leo thang); không có người phụ trách thì gửi `smartops.alert.recipient.email`.
- Email gồm: ảnh gốc, loại lỗi, độ tin cậy, nguyên nhân dự đoán, hướng xử lý từ runbook, ghi chú "cần xác nhận" khi `needs_review`, liên kết phản hồi đúng/sai.

## 6. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-AI-001 | Chạy hoàn toàn nội bộ; ảnh và văn bản không rời mạng |
| NFR-AI-002 | Đường luật (OCR + từ khóa): ≤ 5 giây / ảnh trên CPU. Đường vision: ≤ 120 giây / ảnh (chấp nhận do xử lý bất đồng bộ) |
| NFR-AI-003 | Mọi cấu hình qua biến môi trường tiền tố `AI_`; không secret trong repo |
| NFR-AI-004 | Thành phần phụ thuộc (OCR, Ollama, Qdrant) lỗi không làm service sập — suy giảm có kiểm soát |
| NFR-AI-005 | Thay mô hình/ thêm GPU chỉ cần đổi `AI_VISION_MODEL` / `AI_OLLAMA_URL`, không sửa code |
| NFR-AI-006 | Ảnh lỗi lớn không commit vào git (`.gitignore`); chỉ `manifest.csv` được commit |

## 7. Chất lượng & đánh giá

- Bộ ảnh mẫu ở `data/error-images/` đồng thời là **bộ test độ chính xác**: mục tiêu ≥ 90 % đúng mã lỗi trên ảnh có chữ rõ, ≥ 75 % trên ảnh chụp biểu đồ.
- Phản hồi đúng/sai (FR-AI-011) quay lại thành dữ liệu gắn nhãn; ảnh bị nhận sai được thêm vào thư viện.

## 8. Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| P1 | Taxonomy, thư viện ảnh, runbook | ✅ |
| P2 | `ai-service`: tiền xử lý, OCR, luật, vision, hợp nhất, runbook, RAG, phản hồi | ✅ |
| P3 | Backend Java: gọi `/diagnose`, `IncidentLog`, `NodeOwner`, email (xem mục 5) | ✅ |
| P4 | Giao diện web: upload ảnh, xem chẩn đoán, thư viện ảnh | 🔜 |
| P5 | Few-shot từ thư viện, embedding ảnh (CLIP), đánh giá tự động, fine-tune LoRA khi đủ dữ liệu | 🔜 |
