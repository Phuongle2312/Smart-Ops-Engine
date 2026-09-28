# Incident Service (`INC`) — M3

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/05_incident.md](../../../../../docs/02_srs/05_incident.md)

## Phạm vi

“Bộ não” nghiệp vụ: nghe metric, so với chính sách ngưỡng, quyết định mở / đếm thêm / nâng cấp /
tự đóng sự cố; quản lý vòng đời `OPEN → ACKNOWLEDGED → RESOLVED`.

## Yêu cầu phụ trách

`FR-INC-001` … `FR-INC-033` · `FR-INC-FE-001` … `FR-INC-FE-009` · `BR-INC-001` … `BR-INC-008`

## Việc cần làm

- [ ] `SOE.Incident.Domain` — `Incident` (aggregate có máy trạng thái), `ThresholdPolicy`, `NodeMetricState` (breach/recovery streak)
- [ ] `SOE.Incident.Application` — `ThresholdEvaluator`, `IncidentDeduplicator`, acknowledge/resolve, thống kê & MTTR
- [ ] `SOE.Incident.Infrastructure` — EF Core (`soe_incident`) với **unique filtered index** `(NodeId, Type) WHERE Status <> 'RESOLVED'`
- [ ] Consumer: `MetricCollectedV1`, `NodeUnreachableV1`, `NodeDeletedV1`, `NodeMonitoringToggledV1`
- [ ] Contracts: `IncidentOpenedV1`, `IncidentEscalatedV1`, `IncidentAcknowledgedV1`, `IncidentResolvedV1`
- [ ] Test: `docs/04_test_cases/TC-05_incident.md` (52 ca — nhiều nhất hệ thống)

## Bẫy đã biết (v1 không có)

- **Dedup**: một sự cố chưa đóng cho mỗi `(node, loại)`; tái diễn thì tăng `occurrenceCount`, không tạo bản ghi mới.
- **Hysteresis**: cần `consecutiveBreaches` lần liên tiếp mới mở, và giá trị phải xuống dưới `ngưỡng − recoveryMargin` đủ `consecutiveRecoveries` lần mới tự đóng — chống bão cảnh báo.
- Bỏ qua snapshot đến muộn (`collectedAt ≤ lastProcessedAt`) để chuỗi đếm không sai.
