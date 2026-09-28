# Metrics Service (`MET`) — M2

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/04_metrics.md](../../../../../docs/02_srs/04_metrics.md)

## Phạm vi

Lưu chuỗi thời gian metric, phục vụ dashboard và biểu đồ lịch sử, tạo rollup theo giờ, dọn dữ liệu
theo chính sách lưu trữ. Không đánh giá ngưỡng (việc đó thuộc Incident).

## Yêu cầu phụ trách

`FR-MET-001` … `FR-MET-013` · `FR-MET-FE-001` … `FR-MET-FE-008` · `BR-MET-001` … `BR-MET-006`

## Việc cần làm

- [ ] `SOE.Metrics.Domain` — `MetricSnapshot`, `MetricRollup`, `NodeHealthStatus`
- [ ] `SOE.Metrics.Application` — truy vấn theo `range` (1h/24h/7d/30d) có downsample ≤ 500 điểm, tóm tắt & dự báo đầy đĩa, xuất CSV
- [ ] `SOE.Metrics.Infrastructure` — EF Core (`soe_metrics`), bảng partition theo tháng, cache Redis 10s cho `metrics/latest`, job rollup + retention (khóa phân tán)
- [ ] `SOE.Metrics.Api` — `/metrics/latest`, `/metrics/health-summary`, `/nodes/{id}/metrics*`
- [ ] Consumer `MetricCollectedV1` ghi theo lô (100ms / 200 bản ghi)
- [ ] Test: `docs/04_test_cases/TC-04_metrics.md` (35 ca)

## Bẫy đã biết

- Unique `(nodeId, collectedAt)` để chống ghi trùng khi message được xử lý lại.
- `null` khác 0 — biểu đồ phải ngắt đường, không nối thẳng.
- Retention xóa bằng **partition switch**, không `DELETE` hàng loạt (khóa bảng).
