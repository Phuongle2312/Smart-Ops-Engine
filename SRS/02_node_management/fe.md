# 02 — Quản lý Node — Frontend

> **Trạng thái:** `[FE Mock ✅]` UI hoàn chỉnh với mock data.
> `[FE API 🔜]` Cần thay mock CRUD bằng Axios calls.

---

## View: Nodes (`src/views/Nodes.jsx`)

**Route:** `/app/nodes`

---

## Bảng danh sách Node

| Cột            | Hiển thị                                                                       |
| :------------- | :----------------------------------------------------------------------------- |
| Tên Node       | Bold, nhấn → navigate `/app/nodes/:id` (Node Detail)                          |
| IP/Host        | Monospace font                                                                 |
| Port           | Badge nhỏ xám                                                                  |
| CPU%           | Progress bar + số % — màu xanh/vàng/đỏ theo ngưỡng                           |
| Disk%          | Progress bar + số % — màu xanh/vàng/đỏ theo ngưỡng                           |
| RAM%           | Progress bar + số % — màu xanh/vàng/đỏ theo ngưỡng                           |
| Mô tả          | Truncate nếu quá dài                                                           |
| Giám sát       | Toggle switch — chỉ ADMIN, gọi `toggleNodeActive(id)`                        |
| Hành động      | Icon Edit (xanh nhạt) + Icon Trash2 (đỏ nhạt) — chỉ ADMIN                   |

**Màu ngưỡng:**
- `< 75% CPU / < 80% Disk/RAM` → xanh lá
- `>= warning và < 90%` → vàng cam
- `>= 90%` → đỏ đậm

**Dữ liệu mock mặc định (DEFAULT_NODES trong AppContext):**
```
prod-web-01      | 192.168.1.10  | CPU:45% Disk:78% RAM:62%  | Active
prod-db-master   | 192.168.1.20  | CPU:18% Disk:89% RAM:84%  | Active
stg-api-gateway  | 192.168.2.11  | CPU:28% Disk:45% RAM:50%  | Active (port 2222)
dev-runner-01    | 192.168.5.50  | CPU:0%  Disk:50% RAM:0%   | Inactive
mail-smtp-server | 10.0.0.15    | CPU:12% Disk:92% RAM:28%  | Active (port 25)
```

---

## Modal Thêm Node mới

**Trigger:** Nút "Thêm Node" — chỉ ADMIN.

**Form fields:**

| Field       | Type       | Required | Default | Validation                  |
| :---------- | :--------- | :------- | :------ | :-------------------------- |
| Name        | text       | Có       | —       | Không rỗng                  |
| Host        | text       | Có       | —       | IP hoặc domain hợp lệ       |
| Port        | number     | Có       | 22      | 1–65535                     |
| Username    | text       | Có       | —       | Không rỗng                  |
| Password    | password   | Không    | —       | —                           |
| SSH Key     | textarea   | Không    | —       | —                           |
| Description | textarea   | Không    | —       | Max 500 ký tự               |

**Tab chọn phương thức xác thực:**
- Tab **"Password"** — hiện input Password.
- Tab **"SSH Key"** — hiện textarea nhập private key.

**Checkboxes monitor:**
```
[✓] Giám sát CPU
[✓] Giám sát Disk
[✓] Giám sát RAM
```

**Submit:** Gọi `addNode(formData)` → `toast.success()` → đóng modal.

---

## Modal Sửa Node

**Trigger:** Nhấn icon Edit trên hàng — chỉ ADMIN.

- Pre-fill tất cả field từ Node hiện tại.
- Trường Password/SSH Key hiển thị placeholder `••••••••`.
- Chỉ gửi password mới nếu người dùng nhập khác `••••••••`.
- Submit → `updateNode(id, formData)` → `toast.success()`.

---

## Confirmation Dialog xóa Node

**Trigger:** Nhấn icon Trash2 — chỉ ADMIN.

```
Modal cảnh báo:
"Bạn có chắc muốn xóa Node [name]?
 Hành động này không thể hoàn tác."

Nút [Hủy]  |  Nút [Xóa] (đỏ, confirm)
```

Confirm → `deleteNode(id)` → `toast.success()`.

---

## Actions trong AppContext

```javascript
// Thêm Node
const addNode = (nodeData) => {
  const newNode = { id: generateId(), active: true, cpu: 0, disk: 0, ram: 0, ...nodeData };
  setNodes(prev => [...prev, newNode]);
  logAudit('CREATE', 'Node', newNode.id, null, nodeData);
  toast.success(`Đã thêm máy chủ ${nodeData.name}`);
};

// Sửa Node
const updateNode = (id, nodeData) => {
  setNodes(prev => prev.map(n => n.id === id ? { ...n, ...nodeData } : n));
  logAudit('UPDATE', 'Node', id, oldNode, nodeData);
};

// Xóa Node
const deleteNode = (id) => {
  setNodes(prev => prev.filter(n => n.id !== id));
  logAudit('DELETE', 'Node', id, nodeToDelete, null);
};

// Toggle active — nếu tắt, reset CPU/RAM về 0
const toggleNodeActive = (id) => {
  setNodes(prev => prev.map(n => {
    if (n.id !== id) return n;
    return { ...n, active: !n.active, cpu: !n.active ? n.cpu : 0, ram: !n.active ? n.ram : 0 };
  }));
};
```

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

| Mock action       | API thực                               | Response xử lý                     |
| :---------------- | :------------------------------------- | :--------------------------------- |
| `addNode(data)`   | `POST /api/nodes`                      | Set node từ response.data          |
| `updateNode(id)`  | `PUT /api/nodes/{id}` *(BE chưa có)*  | Update state từ response.data      |
| `deleteNode(id)`  | `DELETE /api/nodes/{id}`              | Filter node khỏi state             |
| `toggleNode(id)`  | `PUT /api/nodes/{id}/toggle-active`   | Update `active` từ response.data   |
| Load initial data | `GET /api/nodes`                      | Set nodes state từ response.data   |

**Lưu ý:** Sau tích hợp API, bỏ `localStorage` persist cho nodes — data luôn fresh từ server.

---

**Xem thêm:** [BE Node Management](be.md) · [FE Node Detail](../08_metrics_history/fe.md)
