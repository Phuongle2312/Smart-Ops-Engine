# 05 — Cảnh báo đa kênh — Frontend

> **Trạng thái:** `[FE Mock ✅]` Toast notification và Alert Channels UI hoàn chỉnh với mock data.
> `[FE API 🔜]` Cần tích hợp CRUD Alert Channels với Backend API thực.

---

## Toast Notification System

**Thư viện:** `react-hot-toast` (top-right position)

**Cấu hình global trong `App.jsx`:**
```jsx
<Toaster
  position="top-right"
  toastOptions={{
    duration: 3500,
    style: {
      background: '#0f172a',
      color: '#f3f4f6',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      fontSize: '13px',
    },
    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
    error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
  }}
/>
```

**Các loại toast đang dùng:**

| Loại         | Trigger                                | Ví dụ nội dung                                         |
| :----------- | :------------------------------------- | :----------------------------------------------------- |
| `success`    | Thêm/sửa/xóa Node thành công          | "Đã thêm máy chủ prod-web-01 thành công."             |
| `success`    | Resolve/Acknowledge incident           | "Sự cố đã được giải quyết thành công."                |
| `success`    | Đăng nhập / đăng xuất                 | "Đăng nhập thành công với quyền ADMIN!"               |
| `error`      | Login sai credentials                  | "Tên đăng nhập hoặc mật khẩu không đúng."            |
| `error`      | Viewer cố làm hành động ADMIN          | "Bạn không có quyền thực hiện thao tác này."          |
| `error`      | Check-now rate limit                   | "Thao tác quá nhanh. Vui lòng đợi trong giây lát."   |
| `loading`    | Check-now đang xử lý                  | "Đang gửi lệnh quét khẩn cấp..."                     |
| `custom`     | WebSocket incident mới                 | Custom toast đỏ bounce animation (xem bên dưới)       |

### Custom Toast cho incident mới (WebSocket)

```jsx
toast.custom((t) => (
  <div className="bg-red-950/80 border border-red-500/50 backdrop-blur-md rounded-lg p-4">
    <p className="text-sm font-bold text-red-400">
      PHÁT HIỆN SỰ CỐ MỚI (WebSocket Live)
    </p>
    <p className="text-sm text-gray-200">
      <strong>{nodeName}</strong> — <span className="text-yellow-400 font-mono">{incidentType}</span>
    </p>
    <p className="text-xs text-gray-400">{description}</p>
    <button onClick={() => toast.dismiss(t.id)}>Đóng</button>
  </div>
), { duration: 5000 });
```

---

## View: Alert Channels (`src/views/AlertChannels.jsx`)

**Route:** `/app/alert-channels` — **Chỉ ADMIN**

### Bảng danh sách kênh

| Cột              | Nội dung                                      |
| :--------------- | :-------------------------------------------- |
| Tên kênh         | `name`                                        |
| Loại             | Badge: "Email" (xanh dương) / "Webhook" (cam) |
| Target           | Email address hoặc URL (truncate nếu dài)     |
| Mức tối thiểu    | Badge: "Warning" (vàng) / "Critical" (đỏ)   |
| Trạng thái       | Toggle switch Bật/Tắt                        |
| Hành động        | Icon Edit + Icon Trash2                       |

### Modal Thêm / Sửa kênh

**Tab Email:**
- `Tên kênh` (required)
- `Địa chỉ email nhận` (required, validate email format)
- `Mức sự cố tối thiểu` — select: Warning / Critical

**Tab Webhook:**
- `Tên kênh` (required)
- `URL endpoint` (required, validate URL format)
- `Secret` (optional, dùng để ký HMAC)
- `Mức sự cố tối thiểu` — select: Warning / Critical

**Nút "Test gửi thông báo":**
- Hiển thị loading spinner.
- Mock: `setTimeout 800ms` → `toast.success('Đã gửi thông báo test đến kênh [name].')`.
- `[FE API 🔜]` Cần thêm endpoint `POST /api/alert-channels/{id}/test`.

### Actions trong AppContext

```javascript
addAlertChannel(channelData)      // setChannels + logAudit CREATE
updateAlertChannel(id, data)      // setChannels + logAudit UPDATE
deleteAlertChannel(id)            // setChannels + logAudit DELETE
toggleAlertChannel(id)            // setChannels active toggle + logAudit UPDATE
```

### Mock data mặc định (DEFAULT_CHANNELS)

```javascript
[
  { id: 1, name: 'Email Nhận Cảnh Báo', type: 'Email',
    target: 'letriphuong23.12@gmail.com', minSeverity: 'Warning', active: true },
  { id: 2, name: 'Slack Webhook Operations', type: 'Webhook',
    target: 'https://hooks.slack.com/services/T00/B00/X00', minSeverity: 'Critical', active: true }
]
```

---

## Alert Badge trên Header

Header hiển thị số lượng incidents `status === 'OPEN'` dưới dạng badge đỏ. Nhấn vào → navigate `/app/incidents` (pre-filter OPEN).

```javascript
// Trong Header.jsx
const openCount = incidents.filter(i => i.status === 'OPEN').length;
// Hiển thị badge nếu openCount > 0
```

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

| Mock action             | API thực                                    |
| :---------------------- | :------------------------------------------ |
| `addAlertChannel()`     | `POST /api/alert-channels`                  |
| `updateAlertChannel()`  | `PUT /api/alert-channels/{id}`              |
| `deleteAlertChannel()`  | `DELETE /api/alert-channels/{id}`           |
| `toggleAlertChannel()`  | `PUT /api/alert-channels/{id}` body: `{isEnabled: bool}` |
| Load initial channels   | `GET /api/alert-channels`                   |
| Test channel            | `POST /api/alert-channels/{id}/test` *(BE chưa có)* |

---

**Xem thêm:** [BE Alert Notifications](be.md) · [FE WebSocket](../06_websocket_realtime/fe.md)
