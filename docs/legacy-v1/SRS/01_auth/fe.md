# 01 — Xác thực & Phân quyền — Frontend

> **Trạng thái:** `[FE Mock ✅]` Login UI hoàn chỉnh, chạy với mock credentials.
> `[FE API 🔜]` Cần thay mock `login()` bằng Axios gọi `POST /api/auth/login`.

---

## Hiện trạng Mock

### Credentials demo

| Username | Password | Role         | Tên hiển thị              |
| :------- | :------- | :----------- | :------------------------ |
| `admin`  | `admin`  | `ROLE_ADMIN` | Lê Trí Phương (Admin)     |
| `viewer` | `viewer` | `ROLE_VIEWER`| Nguyễn Văn Xem (Viewer)  |

### Mock `login()` trong `AppContext.jsx`

```javascript
const login = (username, password) => new Promise((resolve, reject) => {
  setTimeout(() => {           // Mô phỏng network latency 500ms
    if (u === 'admin' && p === 'admin') {
      const user = { id: 1, username: 'admin', role: 'ROLE_ADMIN', fullName: '...' };
      setUser(user);
      setAccessToken('mock-jwt-token-xyz-12345');
      localStorage.setItem('soe_user', JSON.stringify(user));  // persist session
      resolve(user);
    } else reject(new Error('Tên đăng nhập hoặc mật khẩu không đúng.'));
  }, 500);
});
```

### Token storage (Mock Phase — chấp nhận cho development)

- `user` và `accessToken` lưu trong React Context + `localStorage` (`soe_user`).
- Reload trang: đọc lại từ localStorage → khôi phục session.

---

## Trang Login (`src/views/Login.jsx`)

**Route:** `/login` (public, không cần auth)

**Layout:** Centered card, không có Sidebar/Header. Background gradient tối.

**Form:**
- `Username` — text input, required.
- `Password` — password input, required, nút toggle hiện/ẩn.
- Nút **"Đăng nhập"** — disabled + spinner khi đang chờ `login()` resolve.

**Xử lý lỗi:**
- Credentials sai → error message đỏ inline dưới form.
- Loading state → nút disable, text đổi thành "Đang xác thực...".
- Sau thành công → `toast.success()` + `navigate('/app/dashboard')`.

**Tài khoản demo** hiển thị nhỏ dưới form (development helper).

---

## PrivateRoute (`src/components/PrivateRoute.jsx`)

```javascript
const PrivateRoute = () => {
  const { user } = useContext(AppContext);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};
```

- Wrap toàn bộ `/app/*` routes.
- Kiểm tra `user !== null` trước khi render children.
- `replace` để trang Login không vào browser history.

---

## Phân quyền UI (RBAC)

Đọc `user.role` từ Context để ẩn/hiện elements:

```javascript
const { user } = useContext(AppContext);
const isAdmin = user?.role === 'ROLE_ADMIN';

// Ví dụ:
{isAdmin && <button onClick={deleteNode}>Xóa</button>}
{isAdmin && <SidebarItem to="/app/alert-channels" label="Alert Channels" />}
```

| Element                               | ROLE_ADMIN | ROLE_VIEWER |
| :------------------------------------ | :--------- | :---------- |
| Sidebar: Alert Channels, Audit Logs   | Hiển thị   | Ẩn          |
| Nút Thêm/Sửa/Xóa Node                | Hiển thị   | Ẩn          |
| Toggle active Node                    | Hiển thị   | Ẩn          |
| Nút Resolve/Acknowledge Incident      | Hiển thị   | Ẩn          |
| Nút "Kiểm tra hệ thống ngay"          | Hiển thị   | Ẩn          |

> Các element dành riêng ADMIN **không render** (không chỉ disable) với VIEWER.

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

### 1. Cài Axios

```bash
npm install axios
```

### 2. Axios instance với interceptors

```javascript
// src/api/axiosConfig.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // http://localhost:8080
  withCredentials: true,   // Gửi httpOnly cookie cho refresh token
});

// Đính kèm JWT vào mọi request
api.interceptors.request.use(config => {
  const token = getAccessTokenFromContext();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Tự động refresh khi nhận 401
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      setAccessTokenInContext(data.accessToken);
      return api(err.config);   // Retry request gốc
    }
    return Promise.reject(err);
  }
);
```

### 3. Thay mock `login()`

```javascript
// Thay setTimeout mock bằng:
const login = async (username, password) => {
  const { data } = await api.post('/api/auth/login', { username, password });
  setUser(data.user);
  setAccessToken(data.accessToken);   // Chỉ lưu trong RAM Context — KHÔNG localStorage
  // Refresh Token tự động vào httpOnly cookie (Backend set)
  return data.user;
};
```

### 4. Token storage an toàn (Production)

| Token         | Lưu ở đâu                  | Lý do                              |
| :------------ | :------------------------- | :--------------------------------- |
| Access Token  | RAM — React Context only   | Tránh XSS đọc từ localStorage      |
| Refresh Token | `httpOnly cookie` (BE set) | JS không thể đọc, tự gửi kèm      |

> Sau khi chuyển sang production storage: bỏ `localStorage.setItem('soe_user', ...)`.

### 5. Logout an toàn

```javascript
const logout = async () => {
  await api.post('/api/auth/logout');  // Vô hiệu hóa Refresh Token trên server
  setUser(null);
  setAccessToken(null);
  window.location.href = '/login';    // Hard reload để clear mọi state
};
```

---

**Xem thêm:** [BE Auth](be.md) · [FE Node Management](../02_node_management/fe.md)
