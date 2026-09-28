# 07 — Audit Log — Frontend

> **Trạng thái:** `[FE Mock ✅]` UI hoàn chỉnh, `logAudit()` tự động ghi mọi hành động.
> `[FE API 🔜]` Cần fetch từ `GET /api/audit-logs` thay vì dùng local state.

---

## View: AuditLogs (`src/views/AuditLogs.jsx`)

**Route:** `/app/audit-logs` — **Chỉ ADMIN**

---

## Bảng Audit Logs

**Phân trang:** 20 bản ghi/trang (client-side).

| Cột             | Nội dung                                                       |
| :-------------- | :------------------------------------------------------------- |
| Thời gian       | `timestamp` format `DD/MM/YYYY HH:mm:ss`                      |
| Người thực hiện | `username` — badge màu (admin=tím, system=xám)                |
| Hành động       | Badge màu theo action (xem bảng bên dưới)                     |
| Đối tượng       | `target` (NODE, IncidentLog, AlertChannel)                    |
| ID              | `targetId` monospace                                           |
| IP Address      | `ipAddress` — monospace, font nhỏ                             |

**Màu badge hành động:**

| Action        | Màu badge           |
| :------------ | :------------------ |
| `CREATE`      | Xanh lá             |
| `UPDATE`      | Xanh dương          |
| `DELETE`      | Đỏ                  |
| `RESOLVE`     | Tím                 |
| `ACKNOWLEDGE` | Vàng                |
| `TOGGLE`      | Cam                 |

### Dialog chi tiết (khi click vào hàng)

Hiển thị `old_value` và `new_value` dạng JSON diff:

```
┌──────────────────────────────────────────┐
│ Chi tiết Audit Log #501                  │
├──────────────────────────────────────────┤
│ Trước (old_value):                       │
│  {                                        │
│    "status": "OPEN"                       │
│  }                                        │
├──────────────────────────────────────────┤
│ Sau (new_value):                          │
│  {                                        │
│    "status": "RESOLVED",                  │
│    "resolutionAction": "Đã xóa log cũ"   │
│  }                                        │
└──────────────────────────────────────────┘
```

Nếu `old_value = null` (hành động CREATE): Chỉ hiển thị `new_value`.  
Nếu `new_value = null` (hành động DELETE): Chỉ hiển thị `old_value`.

---

## Thanh lọc

- **Action filter:** Tất cả / CREATE / UPDATE / DELETE / RESOLVE / ACKNOWLEDGE.
- **Entity type filter:** Tất cả / Node / IncidentLog / AlertChannel.
- **Search:** Tìm theo `username` hoặc `ipAddress`.

---

## `logAudit()` trong AppContext (Mock)

```javascript
const logAudit = useCallback((action, target, targetId, oldValue, newValue) => {
  const newLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    username: user?.username || 'system',
    action,                                     // 'CREATE', 'UPDATE', 'DELETE', 'RESOLVE'
    target,                                     // 'Node', 'IncidentLog', 'AlertChannel'
    targetId,
    ipAddress: '192.168.1.100',                 // Mock IP
    oldValue: oldValue ? JSON.stringify(oldValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null
  };
  setAuditLogs(prev => [newLog, ...prev]);      // Prepend — mới nhất đầu
}, [user]);
```

**Tự động gọi trong mọi action:**

| Action trong Context    | logAudit call                                      |
| :---------------------- | :------------------------------------------------- |
| `addNode(data)`         | `logAudit('CREATE', 'Node', id, null, data)`       |
| `updateNode(id, data)`  | `logAudit('UPDATE', 'Node', id, old, data)`        |
| `deleteNode(id)`        | `logAudit('DELETE', 'Node', id, old, null)`        |
| `toggleNodeActive(id)`  | `logAudit('UPDATE', 'Node', id, {active:old}, {active:new})` |
| `resolveIncident(id)`   | `logAudit('RESOLVE', 'IncidentLog', id, old, new)` |
| `acknowledgeIncident()` | `logAudit('ACKNOWLEDGE', 'IncidentLog', id, old, new)` |
| `addAlertChannel()`     | `logAudit('CREATE', 'AlertChannel', id, null, data)` |
| `updateAlertChannel()`  | `logAudit('UPDATE', 'AlertChannel', id, old, data)` |
| `deleteAlertChannel()`  | `logAudit('DELETE', 'AlertChannel', id, old, null)` |
| `toggleAlertChannel()`  | `logAudit('UPDATE', 'AlertChannel', id, old, new)` |

---

## Mock data mặc định (DEFAULT_AUDIT_LOGS)

```javascript
[
  { id: 501, timestamp: '-4h', username: 'admin', action: 'UPDATE',
    target: 'Node', targetId: 2, ipAddress: '192.168.1.100',
    oldValue: '{"disk": 92}', newValue: '{"disk": 89}' },
  { id: 502, timestamp: '-4h', username: 'admin', action: 'RESOLVE',
    target: 'IncidentLog', targetId: 102, ipAddress: '192.168.1.100',
    oldValue: '{"status": "OPEN"}', newValue: '{"status": "RESOLVED", ...}' },
  { id: 503, timestamp: '-10h', username: 'admin', action: 'CREATE',
    target: 'AlertChannel', targetId: 2, ipAddress: '192.168.1.100',
    oldValue: null, newValue: '{"name": "Slack Webhook Operations", ...}' }
]
```

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

| Mock                        | API thực                                                    |
| :-------------------------- | :---------------------------------------------------------- |
| `auditLogs` state local     | `GET /api/audit-logs?page=0&size=20&action=...&entityType=...` |
| `logAudit()` client-side    | **Bỏ hoàn toàn** — BE tự động ghi qua AOP, FE không cần gửi |
| localStorage persist        | Không cần — dữ liệu luôn fetch từ server                    |

> Khi tích hợp API: Xóa `logAudit()`, `DEFAULT_AUDIT_LOGS`, và `auditLogs` state khỏi `AppContext`. Thay bằng Axios GET trong `AuditLogs.jsx`.

---

**Xem thêm:** [BE Audit Log](be.md) · [BE Auth](../01_auth/be.md)
