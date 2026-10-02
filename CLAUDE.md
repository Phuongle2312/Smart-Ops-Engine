# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trên repo này.

## Tổng quan

**Smart Ops Engine** — hệ thống giám sát sức khỏe máy chủ (health check CPU/RAM/Disk qua SSH) và cảnh báo sự cố tự động qua email.

Monorepo gồm 3 phần:
- `apps/legacy-v1/` — Spring Boot 3.2.4, Java 17 (REST API + scheduler) — **bản v1 đang chạy**
- `apps/backend-v3/` — .NET 8 microservices (Gateway YARP + Identity…) — **bản build lại, đang ở mốc M1**
- `apps/web/` — React 19, Vite 8, Tailwind CSS 4

## Lệnh build / run / test

**Backend** (chạy trong thư mục `apps/legacy-v1/`, Maven wrapper cho Windows):

```powershell
.\mvnw.cmd clean install      # build
.\mvnw.cmd spring-boot:run     # chạy dev, port 8080
.\mvnw.cmd test                # chạy test (JUnit 5 + Mockito)
```

**Backend v3** (.NET 8, chạy trong thư mục `apps/backend-v3/`):

```powershell
dotnet build SmartOpsEngine.sln        # build toàn bộ solution
dotnet test SmartOpsEngine.sln         # unit test + architecture test
dotnet run --project src\Services\Identity\SOE.Identity.Api --urls http://localhost:5001
dotnet run --project src\Gateway\SOE.Gateway --urls http://localhost:8080
```

Chuỗi kết nối và secret truyền qua biến môi trường (`ConnectionStrings__Default`, `Jwt__PrivateKeyPem`,
`Identity__InitialAdminPassword`) — không commit vào repo. Migration: `dotnet ef migrations add <Tên>
--project src\Services\Identity\SOE.Identity.Infrastructure --startup-project src\Services\Identity\SOE.Identity.Api
--output-dir Persistence\Migrations`.

**Chạy toàn bộ kiểm thử** (từ gốc repo, PowerShell):

```powershell
.\tools\scripts\test-all.ps1                      # backend-v3 test + web lint/build + legacy-v1 test
.\tools\scripts\test-all.ps1 -Smoke -ConnectionString '<chuỗi kết nối>'   # kèm smoke test API Identity + Gateway
.\tools\scripts\smoke-m1.ps1 -AdminPassword '<mật khẩu>'   # chỉ smoke test, service đã chạy sẵn
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
| `converter` + `util` | `CryptoConverter` (JPA AttributeConverter) + `AesEncryptionUtil` — mã hóa `password`/`sshKey` khi lưu |

Cần biết:
- **DB:** SQL Server (`jdbc:sqlserver://localhost:1433;databaseName=smart_ops_engine`), có H2 runtime cho dev. `hibernate.ddl-auto=update`.
- Ngưỡng cảnh báo & interval cấu hình trong `application.properties` (disk warning 80% / critical 90%, cpu 85%, memory 90%).
- **Local node** (127.0.0.1 / localhost) đọc metrics qua Java MX beans; **remote node** đọc qua lệnh shell chạy bằng SSH.

## Kiến trúc frontend

- `src/views/` — 8 view: `Login`, `Dashboard`, `Nodes`, `NodeDetail`, `Incidents`, `AlertChannels`, `AuditLogs`, `SystemConfig`
- `src/components/` — `Header`, `Sidebar`, `PrivateRoute`
- `src/context/AppContext.jsx` — state tập trung bằng **Context API** (không dùng Redux)
- `src/context/PreferencesContext.jsx` — theme sáng/tối + ngôn ngữ VI/EN (`usePreferences()` → `t()`, `formatDateTime`, `formatRelative`, `chartTheme`). Từ điển ở `src/i18n/vi.js` / `en.js` — **thêm chuỗi UI mới phải thêm khóa vào cả hai file**, không hardcode text trong JSX.
- Theme sáng hoạt động bằng cách **đảo biến màu Tailwind** (`--color-slate-*`, sắc 300/400/900/950) dưới `:root[data-theme="light"]` trong `index.css`. Tiêu đề dùng `text-slate-50` (tự đảo), chỉ giữ `text-white` cho chữ trên nền màu đặc (nút indigo/red). Màu Recharts lấy từ `chartTheme`.
- `src/constants/incidentMeta.js` — nguồn duy nhất cho màu / mức độ loại sự cố, badge trạng thái, ngưỡng tài nguyên; hiển thị qua `components/IncidentBadges.jsx`.
- **Trạng thái hiện tại: MOCK** — dữ liệu lưu ở `localStorage`, chưa gọi API thật. Auth giả (`admin/admin`, `viewer/viewer`); WebSocket & metrics giả lập bằng `setInterval`.

## Quy ước code

- Comment / label / toast viết bằng **tiếng Việt**; tên class / API / biến bằng tiếng Anh.
- **Backend:** Lombok (`@Getter/@Setter/@Builder/@Slf4j`), logging SLF4J, test JUnit 5 + Mockito (mẫu: `apps/legacy-v1/src/test/java/com/soe/scheduler/HealthCheckSchedulerTest.java`).
- **Frontend:** functional components + hooks, Tailwind utility-first (không dùng component library), React Router v7.

## Cạm bẫy / lưu ý

- **AES dùng ECB mode** (không IV) — không an toàn cho production; nên nâng lên AES/GCM.
- **Nguy cơ double-encrypt:** không gọi `AesEncryptionUtil.encrypt()` thủ công trong `NodeController` vì `CryptoConverter` đã tự encrypt khi persist. Kiểm tra kỹ luồng lưu Node.
- Secret key AES, mật khẩu DB và SMTP của v1 đọc từ **biến môi trường** (xem `apps/legacy-v1/.env.example`) — không commit giá trị thật.
- `appsettings.Development.json` của Identity chứa mật khẩu dev mẫu (`sa`, admin) — chỉ dùng cục bộ; máy dev thường phải ghi đè `ConnectionStrings__Default` (ví dụ `Integrated Security=True`).
- Nhiều tính năng (Auth/JWT, WebSocket thật, Audit log, Metrics history) mới là **kế hoạch v2.0** — frontend đang mock, backend bổ sung dần (metrics-history là phần đang làm dở).

## Tài liệu tham chiếu

- `README.md` (gốc repo) — bản đồ thư mục và lệnh chạy nhanh cho từng phần.
- `docs/06_workplan.md` — **phân chia công việc**: hạng mục ↔ thư mục ↔ SRS ↔ test case ↔ mốc M1–M5, thứ tự phụ thuộc, định nghĩa “hoàn thành”, quy ước nhánh/commit.
- `apps/backend-v3/src/Services/README.md` — khuôn hình bắt buộc và quy trình thêm một service mới; mỗi service có README riêng ghi phạm vi + việc cần làm + bẫy đã biết.
- `docs/` — **bộ đặc tả v3 (.NET 8 microservices)**: kiến trúc (`01_architecture/`), SRS theo service (`02_srs/`), use case (`03_usecases/`), test case (`04_test_cases/`), ma trận truy vết (`05_traceability_matrix.md`). Đây là đích đến khi build lại; code Spring Boot hiện tại là bản v1.

- `docs/legacy-v1/SRS/` — đặc tả theo 9 module, mỗi module có `be.md` / `fe.md`, kèm `README.md` (feature matrix).
- `docs/legacy-v1/test_cases/` — 9 file test case tương ứng các module.
