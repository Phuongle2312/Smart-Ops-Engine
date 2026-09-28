# 04 — Quản lý Sự cố (Incident) — Frontend

> **Trạng thái:** `[FE Mock ✅]` UI hoàn chỉnh, filter, resolve/acknowledge hoạt động với mock data.
> `[FE API 🔜]` Cần fetch từ `GET /api/incidents`, gọi `PUT /api/incidents/{id}/resolve`.

---

## View: Incidents (`src/views/Incidents.jsx`)

**Route:** `/app/incidents`

---

## Bảng sự cố

**Phân trang:** 20 bản ghi/trang (client-side từ filtered array).

| Cột           | Nội dung                                                                          |
| :------------ | :-------------------------------------------------------------------------------- |
| ID            | Monospace, nhỏ                                                                    |
| Node          | Tên node (link → `/app/nodes/:id`)                                               |
| Loại sự cố    | Badge màu (xem bảng màu bên dưới)                                                |
| Mô tả         | `issueDescription` — truncate 80 ký tự                                           |
| Số lần        | `count` field — badge đỏ số nếu > 1 (ghi nhận tái phát)                        |
| Thời gian     | `detectedAt` format `DD/MM HH:mm`                                                |
| Trạng thái    | Badge màu theo status                                                             |
| Người xử lý   | `assignee` hoặc `—`                                                              |
| Hành động     | Nút Resolve / Acknowledge tùy status — chỉ ADMIN                                |

**Màu badge loại sự cố:**

| incidentType                          | Màu badge       |
| :------------------------------------ | :-------------- |
| `DISK_CRITICAL`, `CPU_CRITICAL`, `RAM_CRITICAL` | Đỏ đậm (`red-600`) |
| `DISK_WARNING`, `CPU_HIGH`, `RAM_HIGH` | Vàng cam (`amber-500`) |
| `SSH_FAILURE`                         | Tím (`violet-500`) |

**Màu badge trạng thái:**

| Status         | Màu                   |
| :------------- | :-------------------- |
| `OPEN`         | Đỏ (`red-500`)        |
| `MONITORING`   | Vàng (`yellow-500`)   |
| `ACKNOWLEDGED` | Xanh dương nhạt       |
| `RESOLVED`     | Xanh lá (`green-500`) |

---

## Thanh lọc (Filter Bar)

- **Status buttons:** Tất cả / OPEN / MONITORING / ACKNOWLEDGED / RESOLVED — toggle highlight button active.
- **Node dropdown:** Danh sách tên Node từ `nodes[]` state.
- **Type dropdown:** Danh sách `incidentType` khác nhau trong incidents.
- **Search input:** Tìm theo `issueDescription` + tên Node, debounce 300ms.
- Kết hợp filter: AND logic — cùng lúc lọc cả status + node + type + search.

---

## Dialog Resolve Incident

**Trigger:** Nút "Resolve" trên hàng `OPEN` hoặc `MONITORING` — chỉ ADMIN.

```
Modal:
  Tiêu đề: "Giải quyết sự cố #[id]"
  Thông tin: Node, Type, Mô tả

  Textarea "Hành động đã thực hiện:" (optional)
  Placeholder: "VD: Đã xóa log cũ, giải phóng 20GB..."

  [Hủy]  |  [Xác nhận Giải quyết] (xanh lá)
```

**Submit:** Gọi `resolveIncident(id, resolutionAction)`:
```javascript
const resolveIncident = (id, resolutionAction) => {
  setIncidents(prev => prev.map(inc => {
    if (inc.id !== id) return inc;
    return {
      ...inc,
      status: 'RESOLVED',
      resolutionAction: resolutionAction || 'Đã kiểm tra và xử lý hoàn tất.',
      resolvedAt: new Date().toISOString(),
      assignee: user.fullName.split(' (')[0]
    };
  }));
  logAudit('RESOLVE', 'IncidentLog', id, old, { status: 'RESOLVED', resolutionAction });
  toast.success('Sự cố đã được giải quyết thành công.');
};
```

---

## Dialog Acknowledge Incident

**Trigger:** Nút "Acknowledge" trên hàng `OPEN` — chỉ ADMIN.

```
Modal nhẹ:
  "Bạn muốn xác nhận đã biết về sự cố này?
   Trạng thái sẽ chuyển sang ACKNOWLEDGED."

  [Hủy]  |  [Xác nhận] (xanh dương)
```

**Submit:** Gọi `acknowledgeIncident(id)`:
```javascript
const acknowledgeIncident = (id) => {
  setIncidents(prev => prev.map(inc =>
    inc.id === id ? { ...inc, status: 'ACKNOWLEDGED', assignee: user.fullName } : inc
  ));
  logAudit('ACKNOWLEDGE', 'IncidentLog', id, ...);
  toast.success('Đã xác nhận sự cố (Đang xử lý).');
};
```

---

## WebSocket Highlight (Mock Simulation)

Khi `newIncidentId` thay đổi trong Context (set bởi `triggerMockIncident()`):
- Hàng tương ứng trong bảng nhận class `bg-yellow-500/10` (nền vàng nhạt mờ).
- Hiệu ứng fade-out trong 3 giây.
- Hàng mới xuất hiện đầu danh sách (incidents prepend trong state).

---

## Dashboard — Bảng sự cố nhanh

Trang Dashboard (`src/views/Dashboard.jsx`) hiển thị **Top 10 incidents mới nhất** với nút "Resolve" nhanh cho mỗi hàng `OPEN` (chỉ ADMIN). Bấm → mở Resolve Dialog trực tiếp từ Dashboard.

---

## Mock data mặc định (DEFAULT_INCIDENTS)

```javascript
[
  { id: 101, node: { id: 5, name: 'mail-smtp-server' },
    incidentType: 'DISK_CRITICAL', status: 'OPEN', count: 4 },
  { id: 102, node: { id: 2, name: 'prod-db-master' },
    incidentType: 'DISK_WARNING', status: 'RESOLVED', count: 1 },
  { id: 103, node: { id: 3, name: 'stg-api-gateway' },
    incidentType: 'SSH_FAILURE', status: 'ACKNOWLEDGED', count: 2 },
  { id: 104, node: { id: 4, name: 'dev-runner-01' },
    incidentType: 'CPU_HIGH', status: 'RESOLVED', count: 3 }
]
```

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

| Mock action             | API thực                                    | Notes                               |
| :---------------------- | :------------------------------------------ | :---------------------------------- |
| Load initial incidents  | `GET /api/incidents?page=0&size=20`         | Phân trang server-side              |
| Filter incidents        | `GET /api/incidents?status=OPEN&nodeId=1`   | Tham số query                       |
| `resolveIncident()`     | `PUT /api/incidents/{id}/resolve`           | Body: `{resolutionAction}`          |
| `acknowledgeIncident()` | `PUT /api/incidents/{id}/acknowledge`       | *(BE chưa có)*                      |
| Realtime updates        | WebSocket `/topic/incidents`                | Thay `setInterval` simulation       |

---

**Xem thêm:** [BE Incident Management](be.md) · [FE WebSocket](../06_websocket_realtime/fe.md) · [FE Dashboard](#dashboard--bảng-sự-cố-nhanh)
