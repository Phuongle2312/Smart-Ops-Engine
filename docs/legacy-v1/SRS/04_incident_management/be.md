# 04 — Quản lý Sự cố (Incident) — Backend

> **Trạng thái:** `[BE v1.0 ✅]` Resolve cơ bản hoạt động. Phân trang, dedup, acknowledge `[BE v2.0 🔜]`.

---

## Entity: `IncidentLog`

**Class:** `com.soe.entity.IncidentLog` · **Bảng:** `Incident_Logs`

| Field               | Kiểu Java        | SQL            | Ràng buộc              | Ghi chú                                                  |
| :------------------ | :--------------- | :------------- | :--------------------- | :------------------------------------------------------- |
| `id`                | `Long`           | `BIGINT`       | PK, IDENTITY           |                                                          |
| `node`              | `Node`           | `BIGINT`       | FK → `Nodes(id)`, NOT NULL | `@ManyToOne(fetch=LAZY)`, `@JoinColumn(name="node_id")` |
| `incidentType`      | `String`         | `VARCHAR(50)`  | NOT NULL               | Dùng String thay Enum — dễ thêm loại mới không cần migration |
| `issueDescription`  | `String`         | `TEXT`         | NOT NULL               | Giá trị thực đo được: "Disk usage CRITICAL: 92%"        |
| `resolutionAction`  | `String`         | `TEXT`         | NULL                   | Biện pháp xử lý đã thực hiện                            |
| `status`            | `String`         | `VARCHAR(20)`  | NOT NULL, Default OPEN | `"OPEN"`, `"MONITORING"`, `"RESOLVED"` (v1.0)           |
| `detectedAt`        | `LocalDateTime`  | `DATETIME2`    | NOT NULL               | Thời điểm phát hiện lần đầu                              |
| `resolvedAt`        | `LocalDateTime`  | `DATETIME2`    | NULL                   | null nếu chưa giải quyết                                |

**Annotations Lombok:** `@Entity`, `@Table(name="Incident_Logs")`, `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`

---

## Các loại sự cố hiện tại

| `incidentType`  | Điều kiện              | Email gửi? | Status khi tạo  |
| :-------------- | :--------------------- | :--------- | :-------------- |
| `DISK_CRITICAL` | Disk >= 90%            | Có         | `OPEN`          |
| `DISK_WARNING`  | 80% <= Disk < 90%      | Không      | `MONITORING`    |
| `SSH_FAILURE`   | Không kết nối SSH được | Có         | `OPEN`          |

**Loại kế hoạch v2.0:** `CPU_CRITICAL`, `CPU_HIGH`, `RAM_CRITICAL`, `RAM_HIGH`

---

## Repository: `IncidentLogRepository`

```java
interface IncidentLogRepository extends JpaRepository<IncidentLog, Long> {
    List<IncidentLog> findTop50ByOrderByDetectedAtDesc();
    // Chỉ có một method — không có filter, không có phân trang (v1.0)
}
```

**Index khuyến nghị:**
```sql
CREATE INDEX idx_incidents_node_status ON Incident_Logs(node_id, status, detected_at DESC);
CREATE INDEX idx_incidents_type_status ON Incident_Logs(incident_type, status);
```

---

## API Endpoints

### GET `/api/incidents` — Lấy sự cố gần nhất

- Trả về 50 sự cố mới nhất (không phân trang).
- Dùng `findTop50ByOrderByDetectedAtDesc()`.
- Trả về `List<IncidentLog>` trực tiếp (Entity — chưa có DTO wrapper).

**Response 200:**
```json
[
  {
    "id": 101,
    "node": { "id": 5, "name": "mail-smtp-server", ... },
    "incidentType": "DISK_CRITICAL",
    "issueDescription": "Disk usage CRITICAL: 92%",
    "resolutionAction": null,
    "status": "OPEN",
    "detectedAt": "2026-06-24T08:30:00",
    "resolvedAt": null
  }
]
```

> **[TODO ⚠️]:** Trả về Entity trực tiếp (bao gồm `node` với lazy-load có thể gây N+1). Cần tạo `IncidentLogResponse` DTO và dùng JOIN FETCH query.

### PUT `/api/incidents/{id}/resolve` — Giải quyết sự cố

**Request body (optional):**
```json
{ "resolutionAction": "Đã xóa log cũ, disk trở về 70%" }
```

**Logic:**
```java
incident.setStatus("RESOLVED");
incident.setResolvedAt(LocalDateTime.now());
if (body.containsKey("resolutionAction")) {
    incident.setResolutionAction(body.get("resolutionAction"));
} else if (incident.getResolutionAction() == null) {
    incident.setResolutionAction("Sự cố đã được xác nhận và giải quyết.");
}
incidentLogRepository.save(incident);
```

**Response 200:** `IncidentLog` đã cập nhật  
**Response 404:** Node không tồn tại

---

## Vấn đề duplicate hiện tại `[TODO ⚠️]`

Mỗi chu kỳ quét, nếu Disk vẫn cao, Scheduler tạo **một bản ghi IncidentLog mới** thay vì cập nhật bản ghi cũ. Điều này gây trùng lặp trong DB.

**Fix cần làm ở v2.0:**

1. Thêm cột `occurrence_count INT NOT NULL DEFAULT 1` vào `Incident_Logs`.
2. Thêm cột `last_seen_at DATETIME2 NOT NULL`.
3. Trong `saveIncidentLog()`, kiểm tra trước:

```java
Optional<IncidentLog> existing = incidentLogRepository
    .findFirstByNodeAndIncidentTypeAndStatusIn(node, type, List.of("OPEN", "MONITORING"));

if (existing.isPresent()) {
    existing.get().setOccurrenceCount(existing.get().getOccurrenceCount() + 1);
    existing.get().setLastSeenAt(LocalDateTime.now());
    incidentLogRepository.save(existing.get());
} else {
    // Tạo mới
    incidentLogRepository.save(IncidentLog.builder()...build());
}
```

---

## Kế hoạch v2.0 `[BE v2.0 🔜]`

| Tính năng                     | Mô tả                                                           |
| :---------------------------- | :-------------------------------------------------------------- |
| `PUT /api/incidents/{id}/acknowledge` | Đổi status → `ACKNOWLEDGED`, ghi `assignee`          |
| Phân trang                    | `GET /api/incidents?page=0&size=20&status=OPEN&nodeId=1&type=DISK_CRITICAL` |
| IncidentLog DTO               | Tránh serialize Entity trực tiếp, ẩn lazy-load fields          |
| `occurrence_count` + `last_seen_at` | Dedup logic                                             |
| `resolved_by`                 | FK → `Users(id)` — ghi người xử lý từ JWT principal           |
| `ACKNOWLEDGED` status         | Thêm vào valid status values                                    |
| WebSocket push                | Push event khi tạo mới hoặc resolve (xem [06 WebSocket](../06_websocket_realtime/be.md)) |
| Audit Log                     | Ghi RESOLVE action vào `Audit_Logs`                            |

---

**Xem thêm:** [FE Incident Management](fe.md) · [BE Health Check](../03_health_check_scheduler/be.md) · [BE WebSocket](../06_websocket_realtime/be.md)
