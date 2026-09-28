# Kiến trúc Frontend — React 19 + Vite + Tailwind CSS 4

> Ba tiêu chí bắt buộc: **hiệu năng** (§4), **chống lỗ hổng bảo mật** (§5), **validate dữ liệu** (§6).
> Hiện trạng: SPA đã có 9 màn hình nhưng dùng mock data trong `AppContext` + `localStorage`. Tài liệu này mô tả đích đến v3.

---

## 1. Công nghệ

| Nhóm | Giữ nguyên | Bổ sung |
|---|---|---|
| Nền tảng | React 19, Vite 8, Tailwind CSS 4, React Router 7 | — |
| UI | lucide-react, recharts, react-hot-toast | `@tanstack/react-virtual` (bảng lớn) |
| Dữ liệu | — | `axios` (interceptor), `@tanstack/react-query` v5 (server state) |
| Realtime | — | `@microsoft/signalr` |
| Form & validate | — | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Kiểm thử | — | `vitest`, `@testing-library/react`, `msw`, `@playwright/test` |
| Chất lượng | eslint | `eslint-plugin-security`, `eslint-plugin-jsx-a11y`, `vite-bundle-visualizer`, Lighthouse CI |

**Không** thêm component library (giữ quy ước utility-first của repo). **Không** dùng Redux — server state do React Query giữ, client state (theme, bộ lọc, sidebar) do Context nhỏ + `useState`.

## 2. Cấu trúc thư mục đích

```
apps/web/src/
 ├── app/
 │    ├── router.jsx                 # createBrowserRouter, lazy route, error boundary
 │    ├── providers.jsx              # QueryClientProvider, AuthProvider, RealtimeProvider, Toaster
 │    └── queryClient.js             # staleTime, retry, onError chung
 ├── features/
 │    ├── auth/        { api/, hooks/, schemas/, components/, pages/Login.jsx }
 │    ├── nodes/       { api/, hooks/, schemas/, components/NodeFormModal.jsx, pages/{Nodes,NodeDetail}.jsx }
 │    ├── dashboard/   { hooks/, components/, pages/Dashboard.jsx }
 │    ├── incidents/   { ... pages/Incidents.jsx }
 │    ├── alert-channels/ { ... pages/AlertChannels.jsx }
 │    ├── audit-logs/  { ... pages/AuditLogs.jsx }
 │    ├── system-config/{ ... pages/SystemConfig.jsx }
 │    └── users/       { ... pages/Users.jsx }
 ├── shared/
 │    ├── api/httpClient.js          # axios instance + interceptor (token, refresh, correlation-id)
 │    ├── api/problemDetails.js      # RFC 7807 → lỗi theo field
 │    ├── auth/{AuthContext.jsx, useAuth.js, RequireRole.jsx}
 │    ├── realtime/{signalrClient.js, useRealtime.js}
 │    ├── ui/{Button,Modal,Table,Badge,ProgressBar,Skeleton,ConfirmDialog}.jsx
 │    ├── hooks/{useDebounce,usePagination,useVisibilityRefetch}.js
 │    └── utils/{format.js, datetime.js, permissions.js}
 └── main.jsx
```

Quy ước: mỗi feature tự chứa gọi API + schema + component; `shared` không import ngược từ `features`.

## 3. Lớp dữ liệu

### 3.1 HTTP client

```js
// shared/api/httpClient.js
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,   // https://soe.example.com/api/v1
  timeout: 15000,
  withCredentials: true,                        // để cookie refresh đi kèm /auth/*
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();               // biến trong bộ nhớ, KHÔNG localStorage
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Correlation-Id"] = crypto.randomUUID();
  return config;
});

// 401 → refresh một lần, gom các request đang chờ (single-flight), thất bại → đăng xuất
http.interceptors.response.use(undefined, createRefreshInterceptor(http));
```

### 3.2 React Query

| Query key | Nguồn | `staleTime` | Ghi chú |
|---|---|---|---|
| `['nodes', filters]` | `GET /nodes` | 30 s | `keepPreviousData` khi đổi trang |
| `['metrics','latest']` | `GET /metrics/latest` | 10 s | Dashboard; realtime patch trực tiếp vào cache |
| `['metrics', nodeId, range]` | `GET /nodes/{id}/metrics?range=` | 60 s | Không refetch khi đổi tab |
| `['incidents', filters, page]` | `GET /incidents` | 15 s | |
| `['audit-logs', filters, page]` | `GET /audit-logs` | 60 s | ADMIN |

Mặc định: `refetchOnWindowFocus: true`, `retry: 1` (không retry 4xx), mutation dùng **optimistic update** cho acknowledge/resolve và toggle giám sát, rollback khi lỗi.

### 3.3 Realtime

`useRealtime()` mở một kết nối SignalR duy nhất cho cả ứng dụng, `withAutomaticReconnect([0, 2s, 10s, 30s])`, tham gia group theo trang đang xem (`node:{id}`), và **ghi thẳng vào cache React Query** thay vì gọi lại API:

```js
connection.on("MetricCollected", (m) => {
  queryClient.setQueryData(['metrics','latest'], patchLatest(m));
  queryClient.setQueryData(['metrics', m.nodeId, '1h'], appendPoint(m));
});
connection.on("IncidentOpened", (i) => {
  queryClient.invalidateQueries({ queryKey: ['incidents'] });
  toast.error(`Sự cố mới: ${i.nodeName} — ${i.description}`);
});
```

Khi mất kết nối > 30 s: hiện chỉ báo “Mất kết nối realtime — đang dùng chế độ làm mới định kỳ” và bật polling 30 s (dự phòng).

## 4. Hiệu năng

### 4.1 Ngân sách (performance budget — cổng chặn trong CI)

| Chỉ số | Ngưỡng | Đo bằng |
|---|---|---|
| JS khởi tạo (gzip) | ≤ 250 KB | `vite build` + script kiểm tra kích thước |
| Tổng JS tải trên Dashboard | ≤ 450 KB | Lighthouse CI |
| LCP (Dashboard, 500 node, mạng Fast 3G mô phỏng) | ≤ 2,5 s | Lighthouse CI |
| INP | ≤ 200 ms | Lighthouse CI / RUM |
| CLS | ≤ 0,1 | Lighthouse CI |
| TTI trang Incidents (1.000 dòng) | ≤ 3 s | Playwright + trace |
| Số request khi mở Dashboard | ≤ 6 | Playwright network assert |

### 4.2 Kỹ thuật bắt buộc

| # | Kỹ thuật | Áp dụng ở |
|---|---|---|
| P1 | Code-splitting theo route (`React.lazy` + `Suspense`) — đã có, giữ nguyên | `app/router.jsx` |
| P2 | Tách `recharts` thành chunk riêng, chỉ tải ở Node Detail/Dashboard | vite `manualChunks` |
| P3 | **Virtualization** bảng > 100 dòng (`@tanstack/react-virtual`) | Nodes, Incidents, AuditLogs |
| P4 | Phân trang phía server, mặc định 20 dòng, tối đa 100 | mọi danh sách |
| P5 | `useMemo`/`memo` cho hàng bảng & biểu đồ; tránh tạo hàm mới trong props hàng | `NodeRow`, `IncidentRow`, chart |
| P6 | `useDebounce(300ms)` cho ô tìm kiếm/bộ lọc | Nodes, Incidents, AuditLogs |
| P7 | Downsample dữ liệu biểu đồ ở **backend** (7d/30d dùng rollup), FE không vẽ > 500 điểm | Node Detail |
| P8 | Realtime patch cache thay vì refetch toàn danh sách | §3.3 |
| P9 | Skeleton + `keepPreviousData` để tránh nhảy layout (CLS) | mọi trang danh sách |
| P10 | Asset: font self-host `font-display: swap`, ảnh/SVG inline nhỏ, `Cache-Control: immutable` cho file có hash; bật gzip+brotli ở nginx | nginx config |
| P11 | Dừng polling/chart animation khi tab ẩn (`document.visibilityState`) | `useVisibilityRefetch` |
| P12 | Không import cả thư viện icon: `import { Server } from 'lucide-react'` (tree-shaking) | toàn dự án |

## 5. Bảo mật frontend

| # | Rủi ro | Biện pháp |
|---|---|---|
| S1 | **XSS lưu trữ/phản chiếu** | Chỉ render qua JSX (tự escape). **Cấm `dangerouslySetInnerHTML`** — nếu bắt buộc phải sanitize bằng DOMPurify và duyệt trong review; ESLint `react/no-danger` = error |
| S2 | **Đánh cắp token qua XSS** | Access token chỉ nằm trong **biến JS (module scope)**, không `localStorage`/`sessionStorage`; refresh token trong cookie `HttpOnly; Secure; SameSite=Strict` nên JS không đọc được |
| S3 | **CSRF** | Cookie `SameSite=Strict` + API ghi yêu cầu header `Authorization` (cookie một mình không đủ quyền); endpoint `/auth/refresh` kiểm tra `Origin` |
| S4 | **Clickjacking** | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'` |
| S5 | **Injection qua URL/route** | Validate tham số route bằng zod (`uuid`), không dùng giá trị URL để dựng HTML |
| S6 | **Rò rỉ dữ liệu nhạy cảm** | Không log payload ra console ở production (`drop_console` khi build); không đưa token vào URL; màn hình node không hiển thị credential (chỉ `••••••••`) |
| S7 | **Phân quyền phía client bị bỏ qua** | `RequireRole` chỉ để **ẩn/hiện UI**; mọi quyết định thật nằm ở backend — test case kiểm chứng VIEWER gọi API ghi vẫn nhận 403 |
| S8 | **Phụ thuộc có lỗ hổng** | `npm audit --audit-level=high` + Dependabot trong CI; ghim version bằng `package-lock.json` |
| S9 | **Open redirect** | Tham số `returnUrl` chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng `/` và không có `//` |
| S10 | **Lộ thông tin qua sourcemap** | Không publish sourcemap ra production (hoặc chỉ tải lên hệ thống theo dõi lỗi nội bộ) |
| S11 | **Phiên treo** | Tự đăng xuất sau 30 phút không thao tác; xóa cache React Query khi đăng xuất |

**CSP phục vụ bởi nginx (không dùng `unsafe-inline` cho script):**

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://soe.example.com wss://soe.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
```

> `style-src 'unsafe-inline'` là nhượng bộ cho Tailwind/`recharts` inline style; nếu siết hơn, dùng nonce cho style ở bản sau.

## 6. Validate dữ liệu

### 6.1 Cách làm

- Mỗi form có **một schema zod** đặt tại `features/<x>/schemas/`, dùng chung cho `react-hook-form` (`zodResolver`) và cho việc kiểm tra dữ liệu trả về khi cần.
- Validate theo `mode: 'onBlur'` + `reValidateMode: 'onChange'`; nút gửi bị vô hiệu khi form không hợp lệ hoặc đang gửi.
- Lỗi 400/422 từ backend (`ProblemDetails.errors`) được map ngược vào từng field bằng `setError` → người dùng thấy lỗi đúng chỗ, không chỉ toast.
- **Client validate là trải nghiệm, server validate là sự thật** — quy tắc hai phía phải khớp; bảng đối chiếu nằm trong SRS từng module.

### 6.2 Bảng quy tắc dùng chung (trích, đầy đủ trong SRS Đợt 2)

| Trường | Quy tắc | Thông báo tiếng Việt |
|---|---|---|
| `username` | 3–64 ký tự, `^[a-z0-9._-]+$` | “Tên đăng nhập chỉ gồm chữ thường, số, dấu . _ -” |
| `password` | ≥ 12 ký tự, có chữ và số | “Mật khẩu tối thiểu 12 ký tự, gồm chữ và số” |
| `node.name` | 1–128 ký tự, không chỉ khoảng trắng | “Vui lòng nhập tên máy chủ” |
| `node.host` | IPv4 / IPv6 / hostname hợp lệ (RFC 1123) | “IP hoặc hostname không hợp lệ” |
| `node.port` | số nguyên 1–65535 | “Port phải nằm trong khoảng 1–65535” |
| `node.username` | 1–64 ký tự | “Vui lòng nhập tài khoản SSH” |
| `node.password` / `sshKey` | Bắt buộc khi tạo mới; khi sửa để trống = giữ nguyên | “Chọn Password hoặc SSH Key và nhập giá trị” |
| `sshKey` | Bắt đầu bằng `-----BEGIN`, ≤ 16 KB | “Nội dung private key không hợp lệ” |
| `threshold.warning/critical` | 1–100, `warning < critical` | “Ngưỡng cảnh báo phải nhỏ hơn ngưỡng nguy cấp” |
| `checkIntervalSeconds` | 60–3600 | “Chu kỳ quét từ 60 đến 3600 giây” |
| `channel.webhookUrl` | `https://`, không trỏ IP nội bộ | “Chỉ chấp nhận URL HTTPS công khai” |
| `channel.email` | RFC 5322 rút gọn | “Email không hợp lệ” |
| `resolutionAction` | ≤ 1000 ký tự | “Nội dung xử lý tối đa 1000 ký tự” |

```js
// features/nodes/schemas/nodeSchema.js
export const nodeSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên máy chủ').max(128),
  host: z.string().trim().refine(isIpOrHostname, 'IP hoặc hostname không hợp lệ'),
  port: z.coerce.number().int().min(1, 'Port phải nằm trong khoảng 1–65535').max(65535),
  username: z.string().trim().min(1).max(64),
  authType: z.enum(['PASSWORD', 'SSH_KEY']),
  password: z.string().max(256).optional(),
  sshKey: z.string().max(16384).optional(),
  ...
}).superRefine(requireCredentialOnCreate);
```

## 7. Khả năng tiếp cận & UX

- Mọi control có nhãn (`aria-label`), modal bẫy focus và đóng bằng `Esc`, thứ tự tab hợp lý.
- Tương phản màu ≥ 4.5:1 (đặc biệt thanh tiến trình xanh/vàng/đỏ của CPU/RAM/Disk).
- Không dùng **chỉ** màu để truyền đạt trạng thái — kèm nhãn chữ (“Nguy cấp”, “Cảnh báo”, “Bình thường”).
- Toast không tự đóng với thông báo lỗi nghiêm trọng; có khu vực `aria-live` cho sự cố mới.
- Hỗ trợ màn hình ≥ 1280 px là chính; ≥ 768 px vẫn dùng được (bảng cuộn ngang).

## 8. Kiểm thử frontend

| Cấp | Công cụ | Phạm vi |
|---|---|---|
| Unit | Vitest | utils, schema zod, hook (`useDebounce`, permission) |
| Component | RTL + MSW | Form validate, bảng, modal, trạng thái loading/lỗi/rỗng |
| Integration | RTL + MSW | Luồng đăng nhập + refresh 401, optimistic update |
| E2E | Playwright | 9 màn hình, ma trận vai trò, realtime (giả lập bằng hub test) |
| Hiệu năng | Lighthouse CI | Ngân sách §4.1, chạy mỗi PR vào nhánh chính |
| Bảo mật | ESLint security + kiểm tra header/CSP trong E2E | §5 |

## 9. Việc cần làm khi chuyển từ mock sang API thật

| # | Việc | Ghi chú |
|---|---|---|
| 1 | Cài `axios`, `@tanstack/react-query`, `@microsoft/signalr`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-virtual` | `package.json` hiện chưa có |
| 2 | Tách `AppContext.jsx` (mock) thành `AuthContext` + React Query | Bỏ `soe_nodes`, `soe_incidents`… trong `localStorage` |
| 3 | Bỏ `setInterval` giả lập WebSocket và `generateHistoricalMetrics()` | Thay bằng SignalR + API metrics |
| 4 | Bỏ auth giả `admin/admin`, `viewer/viewer` | Dùng `/auth/login` thật; thêm vai trò OPERATOR |
| 5 | Chuyển `logAudit()` phía client sang đọc `GET /audit-logs` | Audit là việc của backend |
| 6 | Thêm màn hình `Users` và cập nhật `Sidebar` theo vai trò | Mới ở v3 |
| 7 | Thêm biến môi trường `VITE_API_BASE_URL`, `VITE_REALTIME_URL` | `.env.example` |
