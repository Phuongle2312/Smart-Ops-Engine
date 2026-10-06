# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trên repo này.

## Tổng quan

**Smart Ops Engine** — hệ thống giám sát sức khỏe máy chủ (health check CPU/RAM/Disk qua SSH) và cảnh báo sự cố tự động qua email.

Monorepo gồm 3 phần:
- `apps/backend/` — Spring Boot 3.2.4, Java 17 (REST API + scheduler) — **lõi nghiệp vụ duy nhất**
- `apps/ai-service/` — Python FastAPI (OCR + vision LLM + RAG, chạy mô hình nội bộ trên CPU) — Java gọi qua REST (`com.soe.ai`); chạy/test: xem `apps/ai-service/README.md`
- `apps/web/` — React 19, Vite 8, Tailwind CSS 4

Chức năng AI: ảnh lỗi RAM/CPU/GPU → nhận diện → incident → email người phụ trách kèm hướng xử lý (RAG). **Chỉ gợi ý và thông báo, không tự thực thi lệnh sửa lỗi.** Ảnh mẫu ở `data/error-images/`, runbook cho RAG ở `data/knowledge/`.

## Lệnh build / run / test

**Backend** (chạy trong thư mục `apps/backend/`, Maven wrapper cho Windows):

```powershell
.\mvnw.cmd clean install      # build
.\mvnw.cmd spring-boot:run     # chạy dev, port 8080
.\mvnw.cmd test                # chạy test (JUnit 5 + Mockito)
```

**Chạy toàn bộ kiểm thử** (từ gốc repo, PowerShell):

```powershell
.\tools\scripts\test-all.ps1                      # web lint/build + backend test
```

**Frontend** (chạy trong thư mục `apps/web/`):

```powershell
npm run dev       # Vite dev server, port 5173
npm run build     # build production
npm run lint      # ESLint
npm run preview   # preview bản build
```

## Kiến trúc backend (`com.soe.*`)

| Package | Vai trò |
|---------|---------|
| `controller` | `NodeController` — REST API cho nodes / incidents / metrics / check-now / test-email |
| `scheduler` | `HealthCheckScheduler` — health check định kỳ (~5 phút) + daily report (cron) |
| `service` | `NodeMetricsService` (điều phối local vs remote), `SshService` (jsch exec), `LocalMetricsService` (MX beans cho localhost), `OutlookAlertService` (SMTP email) |
| `entity` | `Node`, `NodeMetric`, `IncidentLog` (JPA) |
| `repository` | Spring Data JPA interfaces |
| `ai` | Chẩn đoán lỗi từ ảnh: `AiDiagnosisClient` (REST → ai-service), `DiagnosisService` (@Async: ảnh → `IncidentLog` → email người phụ trách), `DiagnosisEmailTemplate` (escape HTML). API: `POST /api/diagnose` (202), `POST /api/agent/diagnose` (đồng bộ, AI agent → kết luận + `trace` từng bước, không tạo incident/email), `POST /api/incidents/{id}/ai-feedback`, `/api/nodes/{id}/owners` (`NodeOwner`). Cấu hình `smartops.ai.*` |
| `converter` + `util` | `CryptoConverter` (JPA AttributeConverter) + `AesEncryptionUtil` — mã hóa `password`/`sshKey` khi lưu |

Cần biết:
- **DB:** SQL Server (`jdbc:sqlserver://localhost:1433;databaseName=smart_ops_engine`), có H2 runtime cho dev. `hibernate.ddl-auto=update`.
- Ngưỡng cảnh báo & interval cấu hình trong `application.properties` (disk warning 80% / critical 90%, cpu 85%, memory 90%).
- **Local node** (127.0.0.1 / localhost) đọc metrics qua Java MX beans; **remote node** đọc qua lệnh shell chạy bằng SSH.

## Kiến trúc frontend

- `src/views/` — 9 view: `Login`, `Dashboard`, `Nodes`, `NodeDetail`, `Incidents`, `Diagnosis` (upload ảnh lỗi → AI, phản hồi đúng/sai; checkbox "Dùng AI Agent" chạy agent và hiện từng bước), `AlertChannels`, `AuditLogs`, `SystemConfig`
- `src/components/` — `Header`, `Sidebar`, `PrivateRoute`, `OwnersPanel` (người phụ trách node, trong `NodeDetail`)
- `src/context/AppContext.jsx` — state tập trung bằng **Context API** (không dùng Redux)
- `src/context/PreferencesContext.jsx` — theme sáng/tối + ngôn ngữ VI/EN (`usePreferences()` → `t()`, `formatDateTime`, `formatRelative`, `chartTheme`). Từ điển ở `src/i18n/vi.js` / `en.js` — **thêm chuỗi UI mới phải thêm khóa vào cả hai file**, không hardcode text trong JSX.
- Theme sáng hoạt động bằng cách **đảo biến màu Tailwind** (`--color-slate-*`, sắc 300/400/900/950) dưới `:root[data-theme="light"]` trong `index.css`. Tiêu đề dùng `text-slate-50` (tự đảo), chỉ giữ `text-white` cho chữ trên nền màu đặc (nút indigo/red). Màu Recharts lấy từ `chartTheme`.
- `src/constants/incidentMeta.js` — nguồn duy nhất cho màu / mức độ loại sự cố, badge trạng thái, ngưỡng tài nguyên; hiển thị qua `components/IncidentBadges.jsx`.
- **Trạng thái:** nodes / incidents / metrics / chẩn đoán ảnh / người phụ trách gọi **API thật** (`src/api/client.js`, Vite proxy `/api` → `:8080`, polling 15 giây). Còn **mock** (localStorage): auth (`admin/admin`, `viewer/viewer`), kênh thông báo, audit log.
- Hạ tầng AI trên máy dev: `deploy/README.md` (Ollama native + `docker-compose.local.yml`).
- Chạy toàn bộ luồng AI không cần SQL Server: backend `.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"` (H2) + `uvicorn app.main:app --port 8001` trong `apps/ai-service` + `npm run dev`.

## Quy ước code

- Comment / label / toast viết bằng **tiếng Việt**; tên class / API / biến bằng tiếng Anh.
- **Backend:** Lombok (`@Getter/@Setter/@Builder/@Slf4j`), logging SLF4J, test JUnit 5 + Mockito (mẫu: `apps/backend/src/test/java/com/soe/scheduler/HealthCheckSchedulerTest.java`).
- **Frontend:** functional components + hooks, Tailwind utility-first (không dùng component library), React Router v7.

## Cạm bẫy / lưu ý

- **AES dùng ECB mode** (không IV) — không an toàn cho production; nên nâng lên AES/GCM.
- **Nguy cơ double-encrypt:** không gọi `AesEncryptionUtil.encrypt()` thủ công trong `NodeController` vì `CryptoConverter` đã tự encrypt khi persist. Kiểm tra kỹ luồng lưu Node.
- Secret key AES, mật khẩu DB và SMTP của v1 đọc từ **biến môi trường** (xem `apps/backend/.env.example`) — không commit giá trị thật.
- Nhiều tính năng (Auth/JWT, WebSocket thật, Audit log, Metrics history) mới là **kế hoạch v2.0** — frontend đang mock, backend bổ sung dần (metrics-history: đã có API + job dọn `smartops.metrics.retention-days`; chống trùng incident đã làm trong `HealthCheckScheduler`).

## Tài liệu tham chiếu

- `README.md` (gốc repo) — bản đồ thư mục và lệnh chạy nhanh cho từng phần.
- `docs/legacy-v1/`, `docs/ai-diagnosis/`, `docs/archive-v3/` — xem `docs/README.md`. Bộ đặc tả .NET v3 đã lưu trữ ở `docs/archive-v3/` (không còn là đích đến); mã .NET lấy lại bằng `git checkout archive/backend-v3`.

- `docs/legacy-v1/SRS/` — đặc tả theo 9 module, mỗi module có `be.md` / `fe.md`, kèm `README.md` (feature matrix).
- `docs/legacy-v1/test_cases/` — 9 file test case tương ứng các module.

