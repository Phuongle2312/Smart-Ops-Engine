# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) - PHẦN FRONTEND
## GIAO DIỆN GIÁM SÁT VẬN HÀNH (SMART OPS DASHBOARD)
### Phiên bản 2.0 — Cập nhật cải thiện bảo mật, trải nghiệm và thông báo thời gian thực

---

## LỊCH SỬ PHIÊN BẢN

| Phiên bản | Ngày       | Mô tả thay đổi                                                                              | Tác giả  |
| :-------- | :--------- | :------------------------------------------------------------------------------------------ | :------- |
| 1.0       | 2026-01-01 | Phiên bản khởi tạo                                                                          | Dev Team |
| 2.0       | 2026-06-01 | Thêm màn hình Login, JWT Auth flow, WebSocket realtime, Node Detail, CPU/RAM, Alert Channels, Audit Log | Dev Team |

---

## 1. GIỚI THIỆU (INTRODUCTION)

### 1.1. Mục đích (Purpose)
Tài liệu này mô tả chi tiết các yêu cầu về giao diện (UI), trải nghiệm người dùng (UX) và các luồng nghiệp vụ của phần **Frontend Dashboard** thuộc hệ thống **Smart Ops Engine v2.0**. Phiên bản này bổ sung xác thực người dùng, cập nhật dữ liệu thời gian thực qua WebSocket, quản lý kênh thông báo đa kênh, trang chi tiết Node với lịch sử metrics và màn hình Audit Log.

### 1.2. Phạm vi giao diện người dùng (Scope)
Ứng dụng Frontend là trang quản trị (Admin Dashboard) tương tác với Backend API qua HTTP (JSON) và WebSocket (STOMP). Các tính năng chính:
*   Xác thực đăng nhập và quản lý phiên làm việc (JWT).
*   Trực quan hóa tình trạng hoạt động của toàn bộ các máy chủ (Nodes) theo thời gian thực.
*   Quản lý Node: thêm, sửa, xóa, bật/tắt giám sát.
*   Hiển thị sự cố thời gian thực (WebSocket) và xử lý/giải quyết sự cố.
*   Trang chi tiết từng Node với biểu đồ lịch sử Disk/CPU/RAM theo thời gian.
*   Quản lý kênh thông báo (Email, Webhook).
*   Xem nhật ký hành động hệ thống (Audit Log).
*   Báo cáo trực quan bằng biểu đồ và các chỉ số sức khỏe.

---

## 2. CÔNG NGHỆ ĐỀ XUẤT (TECHNOLOGY STACK)

*   **Framework chính:** React (Functional Components, Hooks: `useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`).
*   **Quản lý trạng thái:** React Context API hoặc Redux Toolkit. Phiên bản 2.0 khuyến nghị **Redux Toolkit** do luồng dữ liệu phức tạp hơn (auth state, WebSocket events, metrics).
*   **CSS Styling:** Tailwind CSS — thiết kế tối giản, hiện đại, hỗ trợ Dark Mode, Glassmorphism và Micro-animations mượt mà.
*   **Thư viện Biểu đồ:** Recharts — vẽ Line Chart lịch sử metrics và Pie Chart phân loại sự cố.
*   **HTTP Client:** Axios — cấu hình interceptors tự động đính kèm JWT header và xử lý lỗi 401 (tự động refresh token).
*   **WebSocket Client:** `@stomp/stompjs` + `sockjs-client` — kết nối và subscribe topic realtime từ Backend.
*   **Routing:** React Router v6 — quản lý điều hướng, bảo vệ route (Private Route) theo role.
*   **Kiểm thử:** React Testing Library (unit) + Cypress (E2E).
*   **Thư viện tiện ích:**
    *   `date-fns` — format thời gian.
    *   `react-hot-toast` — Toast notification.
    *   `react-hook-form` + `zod` — Quản lý form và validation schema.

---

## 3. KIẾN TRÚC LUỒNG XÁC THỰC (AUTHENTICATION ARCHITECTURE)

### 3.1. Lưu trữ Token an toàn
*   **Access Token (JWT):** Lưu trong bộ nhớ RAM của ứng dụng (biến JS trong Redux store / React Context) — **không lưu localStorage hoặc sessionStorage** để tránh XSS đánh cắp token.
*   **Refresh Token:** Lưu trong `httpOnly cookie` (Backend set) — JavaScript không thể đọc được, tự động gửi kèm mỗi request `/api/auth/refresh`.

### 3.2. Axios Interceptor tự động gia hạn Token
*   Mọi request API đính kèm `Authorization: Bearer <accessToken>` từ store.
*   Khi nhận response `401 Unauthorized` → interceptor tự động gọi `POST /api/auth/refresh` để lấy Access Token mới, sau đó retry request gốc.
*   Nếu refresh thất bại → redirect người dùng về trang Login, xóa state auth.

### 3.3. Private Route & Phân quyền UI
*   Mọi route trong `/app/**` được bọc bởi `<PrivateRoute>` — kiểm tra token hợp lệ trước khi render.
*   Các tính năng chỉ dành cho `ROLE_ADMIN` (thêm/xóa Node, resolve incident, quản lý Alert Channels, xem Audit Log) được ẩn hoặc disable với người dùng `ROLE_VIEWER`.
*   Nút và form bị disable hiển thị tooltip: "Bạn không có quyền thực hiện thao tác này."

---

## 4. BỐ CỤC TỔNG THỂ (LAYOUT OVERVIEW)

```
+----------------------------------------------------------------------+
| Sidebar          | Header: Tên hệ thống | Alert Indicator | Check Now |
| - Dashboard      | [WebSocket Status]   | [User Info] [Logout]       |
| - Nodes          +----------------------------------------------------+
| - Node Detail    |                                                    |
| - Incidents      |           Vùng Nội Dung Chính                      |
| - Alert Channels |        (Main Content Area — Dynamic)               |
| - Audit Log      |                                                    |
| [role=ADMIN]     |                                                    |
+------------------+----------------------------------------------------+
```

*   **Sidebar:** Cố định bên trái. Hiển thị menu theo role (ADMIN thấy tất cả, VIEWER không thấy Alert Channels và Audit Log).
*   **Header:** Hiển thị badge WebSocket status (xanh = connected, đỏ = disconnected), thông tin người dùng đang đăng nhập và nút Logout.
*   **Alert Indicator:** Badge số lượng incident `OPEN` hiện tại, nhấn vào chuyển thẳng tới trang Incidents lọc sẵn OPEN.

---

## 5. ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (USER INTERFACE SPECIFICATIONS)

### 5.1. Trang đăng nhập (Login Page)

Màn hình duy nhất có thể truy cập khi chưa xác thực.

*   **Form đăng nhập:**
    *   `Username` (Text input, bắt buộc).
    *   `Password` (Password input, bắt buộc, có nút toggle hiện/ẩn).
    *   Nút **"Đăng nhập"** — khi bấm gọi `POST /api/auth/login`.
*   **Xử lý lỗi:**
    *   Credentials sai → hiển thị thông báo lỗi đỏ dưới form: "Tên đăng nhập hoặc mật khẩu không đúng."
    *   Tài khoản bị khóa → "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
    *   Rate limit → "Quá nhiều lần thử. Vui lòng đợi 1 phút."
*   **Sau đăng nhập thành công:** Lưu Access Token vào store, redirect tới `/app/dashboard`.
*   **Thiết kế:** Centered card, logo hệ thống, không có Sidebar/Header.

### 5.2. Trang tổng quan (Dashboard View)

Màn hình mặc định sau đăng nhập.

*   **Metric Cards (4 thẻ):**
    *   Tổng số Node — màu trung tính.
    *   Node Đang Hoạt Động (Active) — màu xanh lá.
    *   Node Tạm Dừng (Inactive) — màu xám.
    *   Sự cố đang mở (Open Incidents) — màu đỏ nổi bật, nhấn vào chuyển sang trang Incidents.
*   **Biểu đồ tổng quan (Recharts):**
    *   Pie Chart phân loại sự cố: `DISK_CRITICAL` / `DISK_WARNING` / `CPU_CRITICAL` / `CPU_HIGH` / `RAM_CRITICAL` / `SSH_FAILURE`.
    *   Bar Chart thống kê số sự cố theo Node (top 5 Node có nhiều sự cố nhất).
*   **Bảng sự cố mới nhất:** Top 10 sự cố gần nhất, nút **"Resolve"** nhanh cho từng hàng `OPEN` *(chỉ ADMIN)*.
*   **WebSocket Realtime:** Khi nhận event mới từ WebSocket → tự động cập nhật Metric Cards và bảng sự cố, không cần tải lại trang. Hiển thị toast thông báo: "Phát hiện sự cố mới: `[Node Name]` — `[Type]`".
*   **Hành động nhanh:** Nút **"Kiểm tra hệ thống ngay"** — gọi `POST /api/check-now`, hiển thị toast xanh lá xác nhận. *(Chỉ ADMIN, áp dụng rate limit 5 lần/phút)*
*   **Polling dự phòng:** Nếu WebSocket mất kết nối, tự động polling `GET /api/incidents` và `GET /api/nodes` mỗi 5 phút.

### 5.3. Trang quản lý máy chủ (Node Management View)

*   **Bảng danh sách Node:**
    *   Cột thông tin: Tên Node, IP/Host, Port, Username, CPU%, Disk%, RAM%, Mô tả, Trạng thái.
    *   Cột CPU%, Disk%, RAM%: Hiển thị giá trị từ lần quét gần nhất với màu sắc theo ngưỡng (xanh < warning, vàng = warning, đỏ = critical).
    *   Cột **"Giám sát":** Toggle Switch Bật/Tắt (`PUT /api/nodes/{id}/toggle-active`). *(Chỉ ADMIN)*
    *   Cột **"Hành động":** Nút **"Sửa"** (xanh nhạt) và nút **"Xóa"** (đỏ nhạt). *(Chỉ ADMIN)*
    *   Nhấn vào tên Node → chuyển sang Trang Chi tiết Node.
*   **Nút "Thêm Node":** Mở Modal thêm mới. *(Chỉ ADMIN)*
*   **Modal thêm Node mới:**
    *   Các trường: `Name`*, `Host`*, `Port` (default 22), `Username`*, `Password`, `SSH Key`, `Description`.
    *   Tab chọn phương thức xác thực: **Password** hoặc **SSH Key** (textarea nhập private key).
    *   Checkbox bật/tắt giám sát từng loại: `☑ Monitor Disk`, `☑ Monitor CPU`, `☐ Monitor RAM`.
    *   Validation: Bắt buộc, định dạng IP/Domain, Port 1-65535.
    *   Gọi `POST /api/nodes`, hiển thị toast thành công và cập nhật danh sách.
*   **Modal sửa Node** *(Mới — v2.0)*:
    *   Tương tự form thêm, pre-fill thông tin hiện tại.
    *   Trường `Password`/`SSH Key` hiển thị placeholder `••••••••` — chỉ gửi lên nếu người dùng nhập mới.
    *   Gọi `PUT /api/nodes/{id}`.
*   **Confirmation Dialog xóa Node:** Hiển thị modal cảnh báo trước khi gọi `DELETE /api/nodes/{id}`.

### 5.4. Trang chi tiết Node (Node Detail View) *(Mới — v2.0)*

Truy cập bằng cách nhấn vào tên Node trong bảng.

*   **Header Node:** Tên Node, IP/Host, trạng thái Active/Inactive, nút **"Sửa"** và **"Kiểm tra ngay"**.
*   **Metric Cards tức thời:** CPU%, Disk%, RAM% của lần quét gần nhất với màu sắc ngưỡng.
*   **Biểu đồ lịch sử metrics (Recharts Line Chart):**
    *   Trục X: thời gian. Trục Y: phần trăm sử dụng (0-100%).
    *   Ba đường: Disk (xanh dương), CPU (vàng cam), RAM (tím).
    *   Đường kẻ ngang đứt khúc tại ngưỡng Warning (80%) và Critical (90%) để trực quan so sánh.
    *   Bộ lọc thời gian: **24 giờ** / **7 ngày** / **30 ngày** (gọi `GET /api/nodes/{id}/metrics?range=...`).
    *   Tooltip khi hover hiển thị đầy đủ: Disk X%, CPU X%, RAM X% tại thời điểm đó.
*   **Bảng lịch sử sự cố của Node:** Top 20 sự cố gần nhất của riêng Node này.

### 5.5. Trang nhật ký sự cố (Incident Log View)

*   **Bảng lịch sử sự cố** với phân trang (20 bản ghi/trang):
    *   Cột: ID, Tên Node, Loại sự cố, Chi tiết, Số lần xuất hiện *(Mới)*, Thời gian phát hiện, Lần cuối phát hiện *(Mới)*, Trạng thái, Người xử lý *(Mới)*, Hành động.
    *   Badge màu sắc theo loại sự cố: `DISK_CRITICAL` / `CPU_CRITICAL` / `RAM_CRITICAL` → đỏ, `*_WARNING` / `*_HIGH` → vàng, `SSH_FAILURE` → tím.
*   **Thanh lọc (Filter Bar):**
    *   Lọc theo trạng thái: Tất cả / `OPEN` / `MONITORING` / `RESOLVED` / `ACKNOWLEDGED`.
    *   Lọc theo tên Node (dropdown).
    *   Lọc theo loại sự cố (dropdown).
    *   Tìm kiếm từ khóa (debounce 300ms).
*   **Hộp thoại Resolve Incident:** Nhập **"Hành động đã xử lý"** → gọi `PUT /api/incidents/{id}/resolve`. *(Chỉ ADMIN)*
*   **Hộp thoại Acknowledge Incident** *(Mới)*: Đánh dấu đã nhận biết sự cố (chuyển sang `ACKNOWLEDGED`) mà chưa xử lý xong — gọi `PUT /api/incidents/{id}/acknowledge`. *(Chỉ ADMIN)*
*   **WebSocket realtime:** Incident mới tự động xuất hiện đầu danh sách với hiệu ứng highlight (nền vàng nhạt fade out trong 3 giây). Badge đếm OPEN trên header cũng tự cập nhật.

### 5.6. Trang quản lý kênh thông báo (Alert Channels View) *(Mới — v2.0)*

*Chỉ ADMIN mới thấy menu này.*

*   **Danh sách Alert Channels:**
    *   Hiển thị: Tên kênh, Loại (Email/Webhook), Mức sự cố tối thiểu, Trạng thái bật/tắt.
    *   Nút Toggle bật/tắt từng kênh.
    *   Nút **"Sửa"** và **"Xóa"** cho từng kênh.
*   **Modal thêm/sửa kênh:**
    *   Tab **Email:** Trường `Địa chỉ email nhận`, `Mức sự cố tối thiểu` (Warning / Critical).
    *   Tab **Webhook:** Trường `URL`, `Secret` (tùy chọn), `Mức sự cố tối thiểu`.
    *   Nút **"Test gửi thông báo"** — gửi payload mẫu đến kênh để kiểm tra cấu hình.

### 5.7. Trang nhật ký hành động (Audit Log View) *(Mới — v2.0)*

*Chỉ ADMIN mới thấy menu này.*

*   **Bảng Audit Log** với phân trang (20 bản ghi/trang):
    *   Cột: Thời gian, Người thực hiện, Hành động (`CREATE`, `UPDATE`, `DELETE`, `RESOLVE`), Đối tượng, ID đối tượng, IP address.
    *   Nhấn vào một hàng → hiển thị Dialog chi tiết xem `old_value` và `new_value` dạng JSON diff.
*   **Thanh lọc:**
    *   Theo loại hành động, theo người dùng, theo loại đối tượng, theo khoảng thời gian (date range picker).

---

## 6. LUỒNG TRẢI NGHIỆM NGƯỜI DÙNG CHÍNH (UX FLOWS)

### 6.1. Luồng đăng nhập và bảo vệ phiên làm việc

```
Người dùng truy cập /app/dashboard
         │
         ▼
  Có Access Token hợp lệ trong store?
         │
    Không│                  Có│
         ▼                   ▼
  Redirect /login       Render Dashboard
         │
  Nhập Username/Password
         │
  POST /api/auth/login
         │
  ┌──────┴──────────┐
  │Thành công       │Thất bại
  │                 │
  ▼                 ▼
Lưu token      Hiển thị lỗi
vào store      dưới form
  │
  ▼
Redirect /app/dashboard
```

### 6.2. Luồng thêm mới và sửa Node

```
[Thêm mới]
User → Bấm "Thêm Node" → Modal form mở
  → Điền thông tin → Validate (react-hook-form + zod)
  → POST /api/nodes
  → Toast thành công → Cập nhật danh sách

[Sửa]
User → Bấm "Sửa" trên hàng Node → Modal form pre-filled
  → Chỉnh sửa → Validate
  → PUT /api/nodes/{id}
  → Toast thành công → Cập nhật hàng đó trong bảng
```

### 6.3. Luồng phát hiện và xử lý sự cố realtime

```
Backend phát hiện sự cố → push WebSocket event

Frontend (nhận qua STOMP /topic/incidents)
  → Cập nhật badge OPEN trên Header
  → Nếu đang xem Dashboard: cập nhật metric card + bảng top incidents
  → Nếu đang xem Incident Log: highlight hàng mới
  → Hiện toast: "⚠ DISK_CRITICAL - prod-web-01 (92%)"

User → Vào Incident Log → Tìm sự cố → Bấm "Resolve"
  → Dialog nhập biện pháp xử lý → Bấm Xác nhận
  → PUT /api/incidents/{id}/resolve
  → Backend push WebSocket event INCIDENT_RESOLVED
  → Frontend cập nhật trạng thái sự cố sang xanh lá (RESOLVED)
  → Badge OPEN giảm đi 1
```

### 6.4. Luồng xem lịch sử metrics Node

```
User → Bảng Nodes → Nhấn vào tên Node
  → Chuyển sang trang /app/nodes/{id}
  → GET /api/nodes/{id}/metrics?range=24h
  → Render Line Chart 3 đường (Disk/CPU/RAM)

User → Bấm "7 ngày"
  → GET /api/nodes/{id}/metrics?range=7d
  → Line Chart cập nhật dữ liệu
```

---

## 7. YÊU CẦU PHI CHỨC NĂNG FRONTEND (NON-FUNCTIONAL REQUIREMENTS)

### 7.1. Trải nghiệm & Thiết kế (UI/UX)

*   **Responsive Design:** Hỗ trợ Desktop 1920×1080, Laptop 1366×768, Tablet (xem nhanh). Mobile không phải là ưu tiên chính nhưng không được vỡ layout.
*   **Micro-animations:**
    *   Hover phóng to nhẹ (scale 1.02) trên Metric Cards và nút bấm.
    *   Loading Skeleton (thay vì spinner cứng) khi đang tải dữ liệu — cảm giác tải nhanh hơn.
    *   Toast Message trượt từ góc phải màn hình (slide in/out).
    *   Highlight fade-out (nền vàng → trong suốt, 3 giây) cho incident mới nhận từ WebSocket.
    *   Biểu đồ Line Chart animate khi lần đầu render.
*   **WebSocket Status Indicator:** Badge nhỏ góc trên Header — xanh lá "Live" khi kết nối, đỏ "Offline" khi mất kết nối kèm tooltip "Đang thử kết nối lại...".
*   **Empty States:** Mỗi bảng dữ liệu trống có hình minh họa và text hướng dẫn (ví dụ: "Chưa có Node nào. Bấm 'Thêm Node' để bắt đầu.").
*   **Confirmation Dialogs:** Mọi hành động phá hủy (xóa Node, xóa Alert Channel) đều hiển thị dialog xác nhận với nút hủy rõ ràng.

### 7.2. Hiệu năng & Tối ưu (Performance)

*   **Code Splitting + Lazy Loading:** Mỗi trang (Dashboard, Nodes, Incidents, AlertChannels, AuditLog) là một chunk riêng — lazy load khi người dùng điều hướng đến.
*   **Memoization:** Dùng `useMemo` và `useCallback` cho các biểu đồ và danh sách lớn tránh render lại không cần thiết.
*   **Debounce Search:** Tìm kiếm Node và Incident debounce 300ms.
*   **Pagination thay vì infinite scroll:** Các bảng dữ liệu lớn dùng phân trang (page navigation) — tránh load toàn bộ dữ liệu một lúc.
*   **Polling dự phòng:** Chỉ kích hoạt polling khi WebSocket mất kết nối. Khoảng cách polling 5 phút.
*   **Bundle size:** Mục tiêu bundle gzip < 300KB cho initial load.

### 7.3. Bảo mật phía Client (Client Security)

*   **Token storage an toàn:** Access Token trong RAM (Redux store), Refresh Token trong `httpOnly cookie`.
*   **Không lưu mật khẩu:** Mật khẩu SSH và mật khẩu đăng nhập chỉ tồn tại trong DOM khi đang nhập form, không được lưu vào bất kỳ storage nào.
*   **XSS Prevention:** Không dùng `dangerouslySetInnerHTML` trừ khi dữ liệu đã được làm sạch bằng DOMPurify. React JSX tự escape output — tuân thủ mặc định.
*   **CSRF:** Backend set Refresh Token cookie với `SameSite=Strict` để chặn CSRF.
*   **Route protection:** `<PrivateRoute>` kiểm tra auth state trước khi render — redirect về Login nếu chưa xác thực.
*   **Role-based UI:** Các element dành riêng ADMIN ẩn hoàn toàn (không chỉ disable) với VIEWER — không chỉ là UI, Backend cũng validate quyền ở mọi API call.
*   **Logout an toàn:** Gọi `POST /api/auth/logout`, sau đó xóa Access Token khỏi store và reload trang để đảm bảo state được reset hoàn toàn.

### 7.4. Xử lý lỗi & Trạng thái mạng (Error Handling)

*   **Axios interceptor:** Tự động xử lý `401` (refresh token hoặc logout), `403` (hiển thị toast "Bạn không có quyền"), `500` (toast "Lỗi hệ thống, vui lòng thử lại").
*   **Network error:** Hiển thị banner cảnh báo "Không thể kết nối máy chủ" khi mất mạng hoàn toàn.
*   **WebSocket reconnect:** `@stomp/stompjs` tự động thử kết nối lại với exponential backoff khi mất kết nối.
*   **Loading states:** Mỗi thao tác async (submit form, gọi API) phải có trạng thái loading rõ ràng — nút bị disable và hiển thị spinner trong quá trình chờ.

---

## 8. CẤU TRÚC ROUTE (ROUTING STRUCTURE)

```
/                          → Redirect tới /app/dashboard (nếu đã đăng nhập) hoặc /login
/login                     → Trang đăng nhập (public)
/app                       → Layout chính (PrivateRoute — yêu cầu đăng nhập)
  /app/dashboard           → Trang tổng quan
  /app/nodes               → Danh sách Node (ADMIN: thêm/sửa/xóa; VIEWER: chỉ xem)
  /app/nodes/:id           → Chi tiết Node + lịch sử metrics
  /app/incidents           → Nhật ký sự cố (ADMIN: resolve/acknowledge; VIEWER: chỉ xem)
  /app/alert-channels      → Quản lý kênh thông báo (chỉ ADMIN)
  /app/audit-logs          → Nhật ký hành động (chỉ ADMIN)
```

---

## 9. QUẢN LÝ TRẠNG THÁI (STATE MANAGEMENT)

### Redux Store structure (đề xuất):

```javascript
{
  auth: {
    user: { id, username, fullName, role },
    accessToken: "eyJ...",          // RAM only, không persist
    isAuthenticated: boolean,
    isLoading: boolean
  },
  nodes: {
    items: [...],
    loading: boolean,
    error: string | null
  },
  incidents: {
    items: [...],
    pagination: { page, size, total },
    filters: { status, nodeId, type },
    loading: boolean,
    wsConnected: boolean           // Trạng thái WebSocket
  },
  metrics: {
    byNodeId: {
      [nodeId]: { data: [...], range: "24h", loading: boolean }
    }
  },
  alerts: {
    channels: [...],
    loading: boolean
  },
  ui: {
    toasts: [...],
    sidebarOpen: boolean
  }
}
```

---

## 10. KIỂM THỬ (TESTING REQUIREMENTS)

*   **Unit Test (React Testing Library):**
    *   Test render đúng component theo role (ADMIN vs VIEWER).
    *   Test validation form (thêm Node, resolve incident).
    *   Test Axios interceptor tự động refresh token.
    *   Test Redux reducers xử lý WebSocket events.
*   **Integration Test:**
    *   Test Private Route redirect khi chưa đăng nhập.
    *   Test flow thêm Node end-to-end (mock API).
*   **E2E Test (Cypress):**
    *   Flow đăng nhập → xem Dashboard → thêm Node → xem chi tiết Node → đăng xuất.
    *   Flow xem Incident List → resolve một incident.
*   **Coverage mục tiêu:** ≥ 70% cho components, 100% cho auth utilities và route guards.
