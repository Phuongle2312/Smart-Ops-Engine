# 06 — WebSocket Realtime — Frontend

> **Trạng thái:** `[FE Mock ✅]` Mô phỏng bằng `setInterval(7000ms)`.
> `[FE API 🔜]` Cần thay bằng `@stomp/stompjs` khi Backend WebSocket sẵn sàng.

---

## Hiện trạng: Mô phỏng WebSocket

**File:** `src/context/AppContext.jsx`

```javascript
// Chạy mỗi 7 giây khi user đã đăng nhập
useEffect(() => {
  const timer = setInterval(() => {
    if (!user) return;

    // 1. Cập nhật metrics nhẹ tất cả Node active (dao động ±5%)
    setNodes(prevNodes => prevNodes.map(node => {
      if (!node.active) return node;
      return {
        ...node,
        cpu:  node.monitorCpu  ? clamp(node.cpu  + random(-5, 5),  5, 98) : node.cpu,
        ram:  node.monitorRam  ? clamp(node.ram  + random(-4, 4), 10, 96) : node.ram,
        disk: node.monitorDisk ? clamp(node.disk + random(-1, 1),  5, 99) : node.disk,
      };
    }));

    // 2. Xác suất 8%: tạo incident ngẫu nhiên
    if (Math.random() < 0.08) {
      const targetNode = randomFrom(nodes.filter(n => n.active));
      // Chọn loại sự cố: CPU_CRITICAL | DISK_WARNING | RAM_CRITICAL | SSH_FAILURE
      triggerMockIncident(targetNode.id, targetNode.name, incidentType, desc);
    }
  }, 7000);

  return () => clearInterval(timer);
}, [user, nodes, triggerMockIncident]);
```

### `triggerMockIncident()` — Logic dedup

```javascript
const existing = incidents.find(
  inc => inc.node.id === nodeId && inc.incidentType === incidentType && inc.status === 'OPEN'
);

if (existing) {
  // Tăng count (tái phát)
  setIncidents(prev => prev.map(i =>
    i.id === existing.id ? { ...i, count: i.count + 1, detectedAt: new Date().toISOString() } : i
  ));
  toast.error(`[WebSocket] ${nodeName} tái phát ${incidentType} (${count+1} lần)!`);
} else {
  // Tạo mới, set newIncidentId để trigger highlight
  const newInc = { id: generateId(), node: { id: nodeId, name: nodeName }, ... };
  setIncidents(prev => [newInc, ...prev]);  // Prepend — mới nhất đầu
  setNewIncidentId(newInc.id);
  setTimeout(() => setNewIncidentId(null), 3000);  // Clear highlight sau 3s
  // Hiển thị custom toast đỏ bounce
}
```

---

## WebSocket Status Indicator

**File:** `src/components/Header.jsx`

- Badge nhỏ góc trên Header.
- **Xanh lá "Live"** khi `wsConnected = true`.
- **Đỏ "Offline"** khi `wsConnected = false`, kèm tooltip "Đang thử kết nối lại...".
- Giá trị `wsConnected` trong Context — hiện luôn `true` (mock).

---

## Kế hoạch tích hợp STOMP thực `[FE API 🔜]`

### 1. Cài thư viện

```bash
npm install @stomp/stompjs sockjs-client
```

### 2. Hook `useWebSocket`

```javascript
// src/hooks/useWebSocket.js
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export const useWebSocket = ({ onIncidentCreated, onIncidentResolved }) => {
  const { setWsConnected } = useContext(AppContext);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(
        `${import.meta.env.VITE_API_BASE_URL}/ws?token=${getAccessToken()}`
      ),
      reconnectDelay: 5000,      // Tự động reconnect sau 5s
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        setWsConnected(true);
        client.subscribe('/topic/incidents', (msg) => {
          const event = JSON.parse(msg.body);
          if (event.eventType === 'INCIDENT_CREATED') onIncidentCreated(event.incident);
          if (event.eventType === 'INCIDENT_RESOLVED') onIncidentResolved(event.incident);
        });
      },

      onDisconnect: () => setWsConnected(false),

      onStompError: (frame) => {
        console.error('STOMP error', frame);
        setWsConnected(false);
      }
    });

    client.activate();
    return () => client.deactivate();
  }, []);
};
```

### 3. Thay setInterval bằng hook

Trong `AppContext.jsx`, xóa block `useEffect setInterval` và thay bằng:

```javascript
useWebSocket({
  onIncidentCreated: (incident) => {
    setIncidents(prev => [incident, ...prev]);
    setNewIncidentId(incident.id);
    setTimeout(() => setNewIncidentId(null), 3000);
    toast.custom(...);   // Custom toast đỏ
  },
  onIncidentResolved: (incident) => {
    setIncidents(prev => prev.map(i =>
      i.id === incident.id ? { ...i, status: 'RESOLVED', resolvedAt: incident.resolvedAt } : i
    ));
  }
});
```

### 4. Polling dự phòng khi WebSocket offline

```javascript
// Chỉ kích hoạt khi wsConnected = false
useEffect(() => {
  if (wsConnected) return;
  const poll = setInterval(async () => {
    const { data } = await api.get('/api/incidents?page=0&size=20');
    setIncidents(data.content);
  }, 5 * 60 * 1000);  // 5 phút
  return () => clearInterval(poll);
}, [wsConnected]);
```

---

## Hiệu ứng UI khi nhận WebSocket event

| Sự kiện               | Tác động UI                                                         |
| :-------------------- | :------------------------------------------------------------------ |
| Incident mới          | Prepend hàng đầu bảng Incidents, highlight vàng 3s                 |
| Incident mới          | Dashboard: Open badge +1, cập nhật bảng top 10                     |
| Incident mới          | Custom toast đỏ bounce 5 giây                                      |
| Incident resolved     | Hàng đổi badge → RESOLVED (xanh lá)                               |
| Incident resolved     | Dashboard: Open badge -1                                            |
| WS disconnect         | Header badge đổi "Live" → "Offline" (đỏ)                          |
| WS reconnect          | Header badge đổi lại "Live" (xanh)                                 |

---

**Xem thêm:** [BE WebSocket](be.md) · [FE Incident Management](../04_incident_management/fe.md)
