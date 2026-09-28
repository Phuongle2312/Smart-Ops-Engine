# 08 — Lịch sử Metrics — Frontend

> **Trạng thái:** `[FE Mock ✅]` Biểu đồ LineChart hoàn chỉnh với dữ liệu sinh giả lập.
> `[FE API 🔜]` Cần thay `generateHistoricalMetrics()` bằng `GET /api/nodes/{id}/metrics`.

---

## View: NodeDetail (`src/views/NodeDetail.jsx`)

**Route:** `/app/nodes/:id`

**Truy cập:** Nhấn vào tên Node trong bảng Nodes.

---

## Header Node

```
[Tên Node lớn]  |  192.168.1.10:22  |  [Badge: Active/Inactive]
                                        [Nút Sửa]  [Nút Kiểm tra ngay (ADMIN)]
```

---

## Metric Cards tức thời

Ba thẻ ngang hiển thị giá trị lần quét gần nhất:

| Thẻ  | Giá trị        | Màu nền (theo ngưỡng)                             |
| :--- | :------------- | :------------------------------------------------ |
| CPU% | `node.cpu`     | Xanh < 75%, Vàng 75–90%, Đỏ ≥ 90%               |
| Disk%| `node.disk`    | Xanh < 80%, Vàng 80–90%, Đỏ ≥ 90%               |
| RAM% | `node.ram`     | Xanh < 80%, Vàng 80–90%, Đỏ ≥ 90%               |

Kèm icon cảnh báo `lucide-react AlertTriangle` khi vượt ngưỡng warning.

---

## Biểu đồ lịch sử (Recharts LineChart)

### Bộ lọc range

```jsx
<div className="flex gap-2">
  {['24h', '7d', '30d'].map(r => (
    <button
      key={r}
      onClick={() => setRange(r)}
      className={range === r ? 'bg-indigo-600' : 'bg-slate-700'}
    >
      {r === '24h' ? '24 giờ' : r === '7d' ? '7 ngày' : '30 ngày'}
    </button>
  ))}
</div>
```

### Cấu hình LineChart

```jsx
<LineChart data={getNodeMetrics(nodeId, range)} height={300}>
  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
  <Tooltip content={<CustomTooltip />} />

  {/* Đường ngưỡng WARNING và CRITICAL */}
  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 4" label="Warning 80%" />
  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" label="Critical 90%" />

  <Line dataKey="disk" stroke="#3b82f6" name="Disk"
        dot={false} strokeWidth={2} animationDuration={500} />
  <Line dataKey="cpu"  stroke="#f59e0b" name="CPU"
        dot={false} strokeWidth={2} animationDuration={500} />
  <Line dataKey="ram"  stroke="#8b5cf6" name="RAM"
        dot={false} strokeWidth={2} animationDuration={500} />
</LineChart>
```

**Màu đường:**
- Disk: xanh dương `#3b82f6`
- CPU: vàng cam `#f59e0b`
- RAM: tím `#8b5cf6`

**Custom Tooltip:**
```jsx
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
    </div>
  );
};
```

---

## `getNodeMetrics()` — Mock với Cache

```javascript
const getNodeMetrics = (nodeId, range) => {
  const cacheKey = `${nodeId}_${range}`;
  if (metricsCache[cacheKey]) return metricsCache[cacheKey];  // Cache hit

  const data = generateHistoricalMetrics(nodeId, range);      // Cache miss → generate
  setMetricsCache(prev => ({ ...prev, [cacheKey]: data }));
  return data;
};
```

### `generateHistoricalMetrics(nodeId, range)` — Thuật toán sinh data giả lập

```
Số điểm: 24h → 24 points, 7d → 7 points, 30d → 30 points

Base metrics theo Node:
  Node 1 (prod-web-01):    CPU:40, Disk:75, RAM:60
  Node 2 (prod-db-master): CPU:15, Disk:87, RAM:80
  Node 3 (stg-api-gateway):CPU:20, Disk:42, RAM:48
  Node 5 (mail-smtp):      CPU:10, Disk:90, RAM:25

Tại mỗi điểm i:
  cpu  = clamp(baseCpu  + sin(i/2)*10  + random*8,  0, 100)
  disk = clamp(baseDisk - (i/n)*3      + random*1.5, 0, 100)  ← giảm nhẹ về quá khứ
  ram  = clamp(baseRam  + cos(i/3)*5   + random*4,  0, 100)

Trục X:
  24h: toLocaleTimeString('HH:mm')
  7d / 30d: toLocaleDateString('MM/DD')
```

Cache key `{nodeId}_{range}` — một khi đã generate, không sinh lại trong session.

---

## Bảng lịch sử sự cố của Node

Phía dưới biểu đồ: Top 20 incidents liên quan đến Node này:

```javascript
const nodeIncidents = incidents
  .filter(i => i.node.id === parseInt(nodeId))
  .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
  .slice(0, 20);
```

Cùng columns như trang Incidents nhưng bỏ cột Node (đã biết là Node này).

---

## Kế hoạch tích hợp API thực `[FE API 🔜]`

```javascript
// Thay getNodeMetrics() mock bằng:
const fetchNodeMetrics = async (nodeId, range) => {
  const cacheKey = `${nodeId}_${range}`;
  if (metricsCache[cacheKey]) return metricsCache[cacheKey];

  const { data } = await api.get(`/api/nodes/${nodeId}/metrics?range=${range}`);
  // data = { nodeId, nodeName, range, metrics: [...] }
  setMetricsCache(prev => ({ ...prev, [cacheKey]: data.metrics }));
  return data.metrics;
};
```

**Mapping field names:**
```
API response field      → Recharts dataKey
data.metrics[].checkedAt → time (format trước khi set state)
data.metrics[].diskPct   → disk
data.metrics[].cpuPct    → cpu
data.metrics[].ramPct    → ram
```

**Cache invalidation:** Xóa cache key khi user switch range hoặc sau 5 phút để data không stale.

---

**Xem thêm:** [BE Metrics History](be.md) · [FE Node Management](../02_node_management/fe.md) · [BE Health Check](../03_health_check_scheduler/be.md)
