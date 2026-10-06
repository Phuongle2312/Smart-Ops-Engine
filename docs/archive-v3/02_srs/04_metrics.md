# SRS 04 — Metrics Service (`MET`)

> Lưu trữ chuỗi thời gian metric và phục vụ truy vấn lịch sử cho biểu đồ.
> Liên quan: [data_architecture.md §3.4](../01_architecture/data_architecture.md)

---

## 1. Mục đích & phạm vi

Metrics nhận `MetricCollectedV1`, lưu snapshot, duy trì bảng “giá trị mới nhất” cho dashboard, tạo rollup theo giờ để truy vấn dải dài, và dọn dữ liệu theo chính sách lưu trữ. Service **chỉ đọc/ghi số liệu**, không đánh giá ngưỡng.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-MET-001 | Lưu mỗi `MetricCollectedV1` thành một bản ghi `MetricSnapshots`, ghi theo lô để chịu tải. | Must |
| FR-MET-002 | Bỏ qua bản ghi trùng `(nodeId, collectedAt)` (idempotent). | Must |
| FR-MET-003 | Cập nhật `MetricLatest` cho node kèm `status` (`NORMAL`/`WARNING`/`CRITICAL`/`UNREACHABLE`/`MONITORING_OFF`). | Must |
| FR-MET-004 | API lấy metric mới nhất của **tất cả** node trong một lần gọi cho Dashboard. | Must |
| FR-MET-005 | API lấy lịch sử một node theo `range` ∈ {`1h`,`24h`,`7d`,`30d`} hoặc `from`/`to` tùy chỉnh (tối đa 90 ngày). | Must |
| FR-MET-006 | Tự chọn nguồn dữ liệu và độ phân giải: ≤ 24h dùng snapshot thô, > 24h dùng rollup theo giờ; kết quả tối đa 500 điểm. | Must |
| FR-MET-007 | Job rollup chạy mỗi giờ, tính `avg`/`min`/`max`/`sampleCount` cho từng metric. | Must |
| FR-MET-008 | Job retention chạy hằng ngày: xóa snapshot > 90 ngày (partition switch), rollup > 400 ngày. | Must |
| FR-MET-009 | Khi nhận `NodeDeletedV1`, đánh dấu dữ liệu của node là đã lưu trữ và xóa sau 30 ngày. | Should |
| FR-MET-010 | API thống kê tóm tắt cho một node: trung bình/đỉnh 24h, xu hướng đĩa (điểm % tăng/ngày) và dự báo thời điểm đầy đĩa. | Should |
| FR-MET-011 | Xuất CSV lịch sử metric của một node theo dải thời gian. | Could |
| FR-MET-012 | Cache Redis 10 giây cho `metrics/latest`, tự vô hiệu khi có dữ liệu mới. | Should |
| FR-MET-013 | Chỉ nhận dữ liệu của node đang tồn tại; bản ghi mồ côi được ghi log và bỏ qua. | Must |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-MET-001 | `null` nghĩa là “không thu được”, khác 0; biểu đồ phải ngắt đường tại điểm `null`, không nối thẳng. |
| BR-MET-002 | Mọi mốc thời gian lưu UTC; tham số `from`/`to` bắt buộc có offset rõ ràng. |
| BR-MET-003 | `range` và `from/to` loại trừ nhau; gửi cả hai ⇒ 400. |
| BR-MET-004 | Dải truy vấn tối đa 90 ngày; vượt quá ⇒ 400 `SOE-MET-400`. |
| BR-MET-005 | Downsample dùng trung bình cho đường chính và giữ `max` để hiển thị vùng đỉnh (tránh che giấu đợt tăng đột biến). |
| BR-MET-006 | `MetricLatest.status` do Metrics tính từ ngưỡng công bố bởi Incident (cache 60 giây) — chỉ để hiển thị, quyết định sự cố vẫn thuộc Incident. |

## 4. Hợp đồng API

### 4.1 `GET /api/v1/metrics/latest` — VIEWER+

```json
{
  "items": [{
    "nodeId": "0192b7…", "nodeName": "prod-web-01",
    "cpuPercent": 42.5, "memoryPercent": 71.8, "diskPercent": 91.2,
    "collectedAt": "2026-09-23T08:30:12Z", "status": "CRITICAL", "isStale": false
  }],
  "generatedAt": "2026-09-23T08:30:20Z"
}
```
`isStale = true` khi `collectedAt` cũ hơn 2 chu kỳ quét.

### 4.2 `GET /api/v1/nodes/{id}/metrics` — VIEWER+

Query: `range=24h` | `from=&to=`, `metrics=cpu,memory,disk` (mặc định cả ba), `maxPoints` (≤500).

```json
{
  "nodeId": "0192b7…", "range": "7d", "resolution": "1h", "pointCount": 168,
  "series": {
    "cpu":    [{ "t": "2026-09-16T00:00:00Z", "avg": 35.2, "max": 78.0 }],
    "memory": [{ "t": "2026-09-16T00:00:00Z", "avg": 65.1, "max": 70.4 }],
    "disk":   [{ "t": "2026-09-16T00:00:00Z", "avg": 88.0, "max": 88.3 }]
  }
}
```

### 4.3 Các endpoint khác

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/nodes/{id}/metrics/summary` | VIEWER+ | `{ avg24h, peak24h, diskTrendPerDay, diskFullEtaDays, sampleCount }` |
| GET | `/nodes/{id}/metrics/export?from=&to=` | OPERATOR+ | CSV (giới hạn 100.000 dòng, `Content-Disposition`) |
| GET | `/metrics/health-summary` | VIEWER+ | Đếm node theo `status` cho thẻ tổng quan Dashboard |

Lỗi: `404 SOE-MET-404` (node không tồn tại), `400 SOE-MET-400` (tham số sai), `413`/`400` khi yêu cầu vượt giới hạn.

## 5. Validate

| Tham số | Quy tắc |
|---|---|
| `range` | thuộc {`1h`,`24h`,`7d`,`30d`} |
| `from`,`to` | ISO-8601 có offset, `from < to`, khoảng ≤ 90 ngày, `to` ≤ hiện tại + 1 phút |
| `metrics` | tập con của {`cpu`,`memory`,`disk`} |
| `maxPoints` | 10–500 |
| `nodeId` | GUID |

## 6. Sự kiện

**Tiêu thụ:** `MetricCollectedV1` (ghi lô), `NodeDeletedV1`, `NodeMonitoringToggledV1` (đổi `status` sang `MONITORING_OFF`), `NodeUnreachableV1` (đổi `status` sang `UNREACHABLE`).
**Phát:** không (Metrics là nơi lưu trữ, không sinh sự kiện nghiệp vụ).

## 7. Phía Frontend

**Màn hình:** `Dashboard`, `NodeDetail`.

| ID | Yêu cầu |
|---|---|
| FR-MET-FE-001 | Dashboard hiển thị thẻ tổng quan (tổng node, đang giám sát, cảnh báo, nguy cấp, không liên lạc được) lấy từ `health-summary`. |
| FR-MET-FE-002 | Dashboard lấy `metrics/latest` một lần và cập nhật tiếp bằng realtime; không gọi API cho từng node. |
| FR-MET-FE-003 | Node Detail có bộ chọn dải thời gian (1h / 24h / 7d / 30d); đổi dải chỉ gọi API tương ứng, dữ liệu cũ giữ lại làm nền (`keepPreviousData`). |
| FR-MET-FE-004 | Biểu đồ đường cho CPU/RAM/Disk, có đường ngưỡng cảnh báo/nguy cấp, tooltip hiển thị thời gian theo múi giờ người dùng. |
| FR-MET-FE-005 | Điểm `null` làm đứt đường và tooltip ghi “Không thu được dữ liệu”. |
| FR-MET-FE-006 | Không vẽ quá 500 điểm; dữ liệu đã được downsample ở backend. |
| FR-MET-FE-007 | Trạng thái `isStale` hiển thị nhãn “Dữ liệu cũ” kèm thời điểm thu thập gần nhất. |
| FR-MET-FE-008 | Nút xuất CSV (OPERATOR+) hiển thị tiến trình tải và thông báo khi vượt giới hạn dòng. |

## 8. Phi chức năng

| Yêu cầu | Chỉ tiêu |
|---|---|
| Ghi | 1.000 snapshot/phút không làm queue dồn > 500 (NFR-SCL-005); ghi theo lô 100 ms hoặc 200 bản ghi |
| Đọc | `metrics/latest` p95 ≤ 400 ms với 500 node; lịch sử 30 ngày p95 ≤ 700 ms |
| Dung lượng | 500 node × 90 ngày ≈ 13 triệu dòng; nén PAGE + partition theo tháng |
| Dọn dữ liệu | Retention chạy 02:00 UTC, dùng partition switch (không `DELETE` hàng loạt gây khóa bảng) |
