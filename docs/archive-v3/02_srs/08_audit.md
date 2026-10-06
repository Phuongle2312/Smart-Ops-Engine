# SRS 08 — Audit Service (`AUD`)

> Nhật ký kiểm toán bất biến cho mọi thao tác ghi và sự kiện bảo mật.
> Liên quan: [data_architecture.md §3.7](../01_architecture/data_architecture.md)

---

## 1. Mục đích & phạm vi

Audit trả lời câu hỏi “**ai**, làm **gì**, với **đối tượng nào**, **khi nào**, từ **đâu**, kết quả ra sao”. Ở v1 audit log do frontend tự sinh trong `localStorage` — không có giá trị pháp lý; ở v3 audit là service backend độc lập, chỉ ghi thêm (append-only), dữ liệu đến từ event chứ không từ client.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-AUD-001 | Ghi nhật ký cho mọi thao tác ghi: tạo/sửa/xóa node, bật tắt giám sát, ghim host key, xác nhận/đóng sự cố, sửa ngưỡng, tạo/sửa/xóa kênh cảnh báo, gửi thử, sửa SMTP, tạo/sửa người dùng, đổi vai trò, đặt lại mật khẩu, bật/tắt scheduler. | Must |
| FR-AUD-002 | Ghi nhật ký sự kiện bảo mật: đăng nhập thành công/thất bại, khóa tài khoản, phát hiện tái sử dụng refresh token, truy cập credential (`CREDENTIAL_ACCESSED`), từ chối do sai host key. | Must |
| FR-AUD-003 | Mỗi bản ghi gồm: thời điểm, người thực hiện (id, tên, vai trò, hoặc `SYSTEM`), hành động, loại và mã đối tượng, giá trị trước/sau (JSON), `correlationId`, IP băm, user agent băm, kết quả. | Must |
| FR-AUD-004 | Giá trị trước/sau được lọc bỏ trường nhạy cảm (credential, secret, mật khẩu, token) — thay bằng `"***"`. | Must |
| FR-AUD-005 | ADMIN tra cứu nhật ký với bộ lọc: khoảng thời gian, người thực hiện, hành động, loại đối tượng, mã đối tượng, từ khóa; phân trang. | Must |
| FR-AUD-006 | Xem chi tiết một bản ghi với so sánh trước/sau dạng diff. | Must |
| FR-AUD-007 | Xuất CSV theo bộ lọc (tối đa 100.000 dòng), có ghi audit cho chính hành động xuất. | Should |
| FR-AUD-008 | Chuỗi băm liên tiếp (`Hash`, `PrevHash`) để phát hiện chỉnh sửa; API kiểm tra tính toàn vẹn theo khoảng thời gian (ADMIN). | Should |
| FR-AUD-009 | Lưu 365 ngày; job dọn theo partition, có thể xuất lưu trữ lạnh trước khi xóa. | Must |
| FR-AUD-010 | Xem “dòng thời gian của một đối tượng” (vd toàn bộ thao tác trên một node). | Should |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-AUD-001 | Nhật ký **chỉ ghi thêm**: tài khoản ứng dụng không có quyền `UPDATE`/`DELETE` trên `AuditEntries`. |
| BR-AUD-002 | Chỉ ADMIN được đọc nhật ký; mọi lần tra cứu/xuất cũng được ghi lại. |
| BR-AUD-003 | Lỗi ghi audit **không** được làm hỏng nghiệp vụ chính; message sẽ retry rồi vào DLQ và cảnh báo vận hành. |
| BR-AUD-004 | Địa chỉ IP và user agent lưu dạng băm có salt (giảm rủi ro dữ liệu cá nhân) nhưng vẫn so khớp được. |
| BR-AUD-005 | Hành động của hệ thống ghi actor `SYSTEM` kèm tên service thực hiện. |
| BR-AUD-006 | Thứ tự trong chuỗi băm theo thứ tự ghi của service, không theo thời điểm xảy ra (ghi rõ trong tài liệu kiểm toán). |

## 4. Danh mục hành động (`Action`)

| Nhóm | Mã hành động |
|---|---|
| Node | `NODE_CREATED`, `NODE_UPDATED`, `NODE_DELETED`, `NODE_MONITORING_ENABLED`, `NODE_MONITORING_DISABLED`, `NODE_HOSTKEY_PINNED`, `NODE_CONNECTION_TESTED` |
| Sự cố | `INCIDENT_ACKNOWLEDGED`, `INCIDENT_RESOLVED`, `INCIDENT_AUTO_RESOLVED`, `THRESHOLD_POLICY_UPDATED` |
| Cảnh báo | `CHANNEL_CREATED`, `CHANNEL_UPDATED`, `CHANNEL_DELETED`, `CHANNEL_TESTED`, `CHANNEL_AUTO_DISABLED`, `SMTP_CONFIG_UPDATED`, `ALERT_RESENT` |
| Người dùng | `USER_CREATED`, `USER_UPDATED`, `USER_ROLE_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_PASSWORD_RESET`, `USER_SESSIONS_REVOKED` |
| Bảo mật | `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `TOKEN_REUSE_DETECTED`, `CREDENTIAL_ACCESSED`, `HOSTKEY_MISMATCH_BLOCKED` |
| Hệ thống | `SCHEDULER_TOGGLED`, `SCAN_INTERVAL_CHANGED`, `AUDIT_EXPORTED`, `METRICS_EXPORTED` |

## 5. Hợp đồng API

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/audit-logs?from=&to=&actorId=&action=&entityType=&entityId=&search=&page=&pageSize=` | ADMIN | Danh sách phân trang (mặc định 7 ngày gần nhất) |
| GET | `/api/v1/audit-logs/{id}` | ADMIN | Chi tiết + diff |
| GET | `/api/v1/audit-logs/entity/{type}/{id}` | ADMIN | Dòng thời gian của một đối tượng |
| GET | `/api/v1/audit-logs/export?…` | ADMIN | CSV |
| POST | `/api/v1/audit-logs/verify` | ADMIN | `{ from, to }` → `{ isIntact, brokenAtId }` |

```json
// AuditLogResponse
{
  "id": 481920,
  "occurredAt": "2026-09-23T08:31:05Z",
  "actor": { "id": "0192a…", "name": "Nguyễn Văn A", "role": "OPERATOR" },
  "action": "INCIDENT_RESOLVED",
  "entityType": "Incident", "entityId": "0192c…",
  "summary": "Đóng sự cố DISK_HIGH của prod-web-01",
  "before": { "status": "OPEN", "resolutionAction": null },
  "after":  { "status": "RESOLVED", "resolutionAction": "Đã dọn log cũ" },
  "correlationId": "0HMV9…",
  "result": "SUCCESS"
}
```

## 6. Validate

| Tham số | Quy tắc |
|---|---|
| `from`,`to` | ISO-8601, `from < to`, khoảng ≤ 90 ngày cho truy vấn, ≤ 365 ngày cho xuất |
| `action`, `entityType` | thuộc danh mục §4 |
| `actorId`, `entityId` | GUID |
| `search` | ≤ 128 ký tự, khớp trong `summary` |
| `pageSize` | 1–100 |

## 7. Sự kiện tiêu thụ

Queue `audit.all` nhận: `AuditRequestedV1` (mọi service phát khi có thao tác ghi) và các event nghiệp vụ (`NodeCreatedV1`, `IncidentResolvedV1`, `UserChangedV1`, `AlertDispatchedV1`, `UserLoginFailedV1`…). Consumer ghi theo lô 100 bản ghi / 200 ms, idempotent theo `MessageId`.

## 8. Phía Frontend

**Màn hình:** `AuditLogs` (ADMIN).

| ID | Yêu cầu |
|---|---|
| FR-AUD-FE-001 | Bảng nhật ký với cột: thời gian (giờ địa phương + tương đối), người thực hiện, hành động (badge theo nhóm), đối tượng, kết quả. |
| FR-AUD-FE-002 | Bộ lọc: khoảng thời gian (mặc định 7 ngày), người thực hiện, hành động, loại đối tượng, ô tìm kiếm có debounce; bộ lọc lưu trong URL. |
| FR-AUD-FE-003 | Danh sách dùng virtualization + phân trang server; không tải toàn bộ nhật ký. |
| FR-AUD-FE-004 | Xem chi tiết: hiển thị diff hai cột (trước / sau), tô sáng trường thay đổi, hiển thị `***` cho trường đã che. |
| FR-AUD-FE-005 | Nút xuất CSV có hộp thoại xác nhận nêu số dòng ước tính. |
| FR-AUD-FE-006 | Màn hình chỉ hiển thị với ADMIN; vai trò khác không thấy mục menu và nhận 403 nếu truy cập trực tiếp URL. |
| FR-AUD-FE-007 | Bỏ hoàn toàn `logAudit()` phía client của bản mock — dữ liệu chỉ đến từ API. |

## 9. Phi chức năng & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Hiệu năng | Ghi ≥ 2.000 bản ghi/phút; truy vấn 7 ngày p95 ≤ 400 ms (index `(OccurredAt DESC)`, `(EntityType, EntityId)`) |
| Bảo mật | Quyền SQL chỉ INSERT/SELECT; chuỗi hash phát hiện sửa đổi; nội dung đã lọc secret |
| Dung lượng | ~1–3 triệu bản ghi/năm ở quy mô 500 node; partition theo tháng |
| Rủi ro | Mất event audit khi DLQ đầy → cảnh báo `SoeDlqNotEmpty` mức P2, runbook phát lại |
