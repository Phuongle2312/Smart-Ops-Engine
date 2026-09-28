# SRS 02 — Inventory Service (`INV`)

> Quản lý danh mục máy chủ được giám sát và credential SSH.
> Liên quan: [data_architecture.md §3.2](../01_architecture/data_architecture.md) · [api_gateway_security.md §8](../01_architecture/api_gateway_security.md)

---

## 1. Mục đích & phạm vi

Inventory sở hữu dữ liệu Node: thông tin kết nối, credential (mã hóa), cờ giám sát và trạng thái bật/tắt. Service này là nơi **duy nhất** giải mã credential, và chỉ cung cấp cho Monitoring Worker qua API nội bộ có mTLS.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-INV-001 | ADMIN tạo node mới với `name`, `host`, `port`, `username`, kiểu xác thực (`PASSWORD` hoặc `SSH_KEY`) và credential tương ứng. | Must |
| FR-INV-002 | Hệ thống từ chối tạo/sửa node khi trùng `(host, port)` với node chưa xóa. | Must |
| FR-INV-003 | Credential được mã hóa AES-256-GCM trước khi lưu, một lần duy nhất tại tầng Infrastructure. | Must |
| FR-INV-004 | API không bao giờ trả credential (kể cả bản mã); chỉ trả cờ `hasCredential` và `authType`. | Must |
| FR-INV-005 | ADMIN sửa node; khi để trống trường credential thì giữ nguyên giá trị cũ. | Must |
| FR-INV-006 | ADMIN/OPERATOR bật–tắt giám sát node (`isActive`); node tắt không được xếp lịch quét. | Must |
| FR-INV-007 | ADMIN xóa node (soft delete); phát `NodeDeletedV1` để các service dọn dữ liệu liên quan. | Must |
| FR-INV-008 | Chọn metric cần giám sát cho từng node (`monitorCpu`, `monitorMemory`, `monitorDisk`) và đường mount đĩa cần kiểm tra. | Must |
| FR-INV-009 | Đặt chu kỳ quét riêng cho node (60–3600 giây); bỏ trống thì dùng mặc định hệ thống. | Should |
| FR-INV-010 | ADMIN kiểm tra kết nối ngay (`test-connection`): thử SSH, trả kết quả và fingerprint host key. | Must |
| FR-INV-011 | Ghim `hostKeyFingerprint` khi tạo/kiểm tra kết nối lần đầu; các lần sau khác fingerprint ⇒ từ chối kết nối. | Must |
| FR-INV-012 | Liệt kê node có tìm kiếm (`name`, `host`), lọc (`isActive`, tag), sắp xếp và phân trang. | Must |
| FR-INV-013 | Gắn tag (khóa–giá trị) cho node để nhóm và lọc cảnh báo. | Should |
| FR-INV-014 | Cung cấp `GET /internal/nodes/{id}/credentials` cho Monitoring (mTLS + scope `inventory.credentials.read`), ghi audit mỗi lần gọi. | Must |
| FR-INV-015 | Phát `NodeCreatedV1`/`NodeUpdatedV1`/`NodeMonitoringToggledV1`/`NodeDeletedV1` qua outbox. | Must |
| FR-INV-016 | Hỗ trợ xoay khóa mã hóa: mã hóa lại dần các bản ghi sang `keyId` mới mà không downtime. | Should |
| FR-INV-017 | Import nhiều node từ CSV (kiểm tra từng dòng, báo lỗi theo dòng). | Could |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-INV-001 | `host` chấp nhận IPv4, IPv6 hoặc hostname hợp lệ (RFC 1123); không chấp nhận URL, khoảng trắng, ký tự shell. |
| BR-INV-002 | Cặp `(host, port)` là duy nhất trong các node chưa xóa; `name` cũng duy nhất. |
| BR-INV-003 | Khi tạo node, phải có đúng một loại credential theo `authType`. Khi sửa, để trống = giữ nguyên. |
| BR-INV-004 | Xóa node là soft delete: dữ liệu lịch sử metric/sự cố vẫn tra cứu được, node biến mất khỏi danh sách giám sát. |
| BR-INV-005 | Tắt giám sát không xóa dữ liệu; sự cố đang mở của node sẽ được Incident đóng với lý do “Node ngừng giám sát”. |
| BR-INV-006 | Fingerprint khác bản đã ghim ⇒ coi là rủi ro bảo mật: không kết nối, mở sự cố `HOST_KEY_MISMATCH`, chỉ ADMIN mới xác nhận ghim lại (có audit). |
| BR-INV-007 | `DiskMountPath` mặc định `/`; chỉ chấp nhận đường dẫn tuyệt đối, không chứa ký tự điều khiển hay `;`, `&`, `|`, backtick. |
| BR-INV-008 | Chỉ ADMIN được tạo/sửa/xóa và đọc credential; OPERATOR chỉ bật/tắt giám sát; VIEWER chỉ đọc. |

## 4. Mô hình miền

```
Node (AggregateRoot)
 ├─ NodeName (VO)        ├─ HostAddress (VO: IPv4/IPv6/hostname)
 ├─ SshPort (VO 1..65535)├─ MonitoringOptions (VO: cpu, memory, disk, diskMountPath, intervalSeconds)
 ├─ AuthType, HostKeyFingerprint, IsActive, DeletedAt
 ├─ Rename / ChangeConnection / UpdateMonitoring
 ├─ PinHostKey(fingerprint, actor) / RejectHostKey()
 ├─ ToggleMonitoring(isActive) / SoftDelete()
 └─ Tags: NodeTag[]

NodeCredential (Entity trong aggregate): SecretCipher, PassphraseCipher, KeyId
```

Port (Application): `INodeRepository`, `ICredentialProtector`, `ISshConnectionTester`, `IEventPublisher`, `IClock`, `IUserContext`.

## 5. Hợp đồng API

### 5.1 `GET /api/v1/nodes` — VIEWER+

Query: `search`, `isActive`, `tag` (lặp lại được), `sort` (`name|host|createdAt`, tiền tố `-` để giảm dần), `page` (≥1), `pageSize` (1–100, mặc định 20).

```json
{
  "items": [{
    "id": "0192b7…", "name": "prod-web-01", "host": "192.168.1.10", "port": 22,
    "username": "ubuntu", "authType": "SSH_KEY", "hasCredential": true,
    "monitorCpu": true, "monitorMemory": true, "monitorDisk": true, "diskMountPath": "/",
    "checkIntervalSeconds": null, "isActive": true,
    "hostKeyFingerprint": "SHA256:9x8…", "description": "Máy chủ Production",
    "tags": [{ "key": "env", "value": "prod" }],
    "createdAt": "2026-09-01T02:00:00Z", "updatedAt": "2026-09-20T09:15:00Z"
  }],
  "page": 1, "pageSize": 20, "totalItems": 137, "totalPages": 7
}
```

### 5.2 `POST /api/v1/nodes` — ADMIN, `Idempotency-Key` khuyến nghị

```json
{
  "name": "prod-app-02", "host": "192.168.1.15", "port": 22, "username": "deploy",
  "authType": "PASSWORD", "password": "…",
  "monitorCpu": true, "monitorMemory": true, "monitorDisk": true,
  "diskMountPath": "/", "checkIntervalSeconds": 300,
  "description": "App server", "tags": [{ "key": "env", "value": "prod" }],
  "testConnectionFirst": true
}
```

| Kết quả | HTTP | Mã |
|---|---|---|
| Thành công | 201 + `Location` | — |
| Trùng host/port | 409 | `SOE-INV-409` “Đã có node sử dụng {host}:{port}.” |
| Trùng tên | 409 | `SOE-INV-410` |
| Dữ liệu sai | 400 | `SOE-INV-400` + `errors` theo field |
| `testConnectionFirst` thất bại | 422 | `SOE-INV-422` “Không kết nối được tới máy chủ: {lý do}.” |

### 5.3 `PUT /api/v1/nodes/{id}` — ADMIN

Cho phép sửa mọi trường; `password`/`sshKey` bỏ trống = giữ nguyên; muốn đổi credential phải gửi `changeCredential: true` kèm giá trị mới. Đổi `host`/`port` ⇒ xóa fingerprint đã ghim và yêu cầu ghim lại.

### 5.4 Các endpoint khác

| Method | Endpoint | Quyền | Mô tả | Mã |
|---|---|---|---|---|
| GET | `/nodes/{id}` | VIEWER+ | Chi tiết | 200, 404 `SOE-INV-404` |
| PUT | `/nodes/{id}/monitoring` | OPERATOR+ | `{ "isActive": false }` | 200 |
| DELETE | `/nodes/{id}` | ADMIN | Soft delete | 204, 404 |
| POST | `/nodes/{id}/test-connection` | ADMIN | Thử SSH, trả `{ success, durationMs, fingerprint, fingerprintChanged, failureKind, message }` | 200, 404, 429 |
| POST | `/nodes/{id}/host-key/pin` | ADMIN | Ghim fingerprint mới (xác nhận rủi ro) | 204 |
| GET | `/nodes/{id}/tags` · PUT | ADMIN | Quản lý tag | 200 |
| GET | `/internal/nodes/{id}/credentials` | Service (scope) | `{ username, authType, secret, passphrase }` | 200, 403, 404 |

## 6. Quy tắc validate

| Trường | Backend | Frontend |
|---|---|---|
| `name` | bắt buộc, 1–128, trim, unique | bắt buộc, ≤128 |
| `host` | bắt buộc, ≤255, IPv4/IPv6/hostname, không ký tự shell | như backend, báo “IP hoặc hostname không hợp lệ” |
| `port` | số nguyên 1–65535, mặc định 22 | như backend |
| `username` | bắt buộc, 1–64, `^[A-Za-z0-9._-]+$` | như backend |
| `authType` | enum `PASSWORD`/`SSH_KEY` | tab chọn |
| `password` | bắt buộc khi tạo với `PASSWORD`, ≤256 | như backend |
| `sshKey` | bắt buộc khi tạo với `SSH_KEY`, bắt đầu `-----BEGIN`, ≤16 KB | như backend |
| `diskMountPath` | bắt đầu bằng `/`, ≤255, không ký tự nguy hiểm | như backend |
| `checkIntervalSeconds` | null hoặc 60–3600 | như backend |
| `description` | ≤512 | ≤512, đếm ký tự |
| `tags` | ≤10 tag, key ≤32 `^[a-z0-9_-]+$`, value ≤64 | như backend |

## 7. Sự kiện

| Event | Payload chính | Khi nào |
|---|---|---|
| `NodeCreatedV1` | id, name, host, port, username, cờ giám sát, interval, isActive | Sau khi lưu thành công |
| `NodeUpdatedV1` | + `changedFields[]` | Sửa node |
| `NodeMonitoringToggledV1` | id, isActive | Bật/tắt |
| `NodeDeletedV1` | id | Soft delete |

Tất cả phát qua **outbox** trong cùng transaction với thay đổi dữ liệu.

## 8. Phía Frontend

**Màn hình:** `Nodes` (danh sách + modal thêm/sửa/xóa), `NodeDetail` (thông tin + biểu đồ, xem [SRS 04 Metrics](04_metrics.md)).

| ID | Yêu cầu |
|---|---|
| FR-INV-FE-001 | Bảng node hiển thị: tên (link sang chi tiết), host (monospace), port (badge), CPU/RAM/Disk dạng thanh tiến trình có màu theo ngưỡng (xanh < cảnh báo, vàng ≥ cảnh báo, đỏ ≥ nguy cấp), công tắc giám sát, cột thao tác theo vai trò. |
| FR-INV-FE-002 | Danh sách > 100 dòng dùng virtualization; tìm kiếm có debounce 300 ms; giữ bộ lọc trong URL query để chia sẻ link. |
| FR-INV-FE-003 | Modal thêm/sửa có 2 tab xác thực (Password / SSH Key); ô mật khẩu khi sửa hiển thị `••••••••` và **không** gửi lên nếu người dùng không thay. |
| FR-INV-FE-004 | Validate bằng zod trước khi gửi; lỗi 400/409 từ backend map vào đúng field (`host` trùng → hiện lỗi dưới ô Host). |
| FR-INV-FE-005 | Nút “Kiểm tra kết nối” trong modal: hiện trạng thái đang thử, kết quả thành công kèm thời gian, hoặc lỗi kèm gợi ý xử lý. |
| FR-INV-FE-006 | Khi fingerprint thay đổi, hiện cảnh báo đỏ nêu rõ rủi ro MITM và yêu cầu ADMIN xác nhận ghim lại (hộp thoại nhập tên node để xác nhận). |
| FR-INV-FE-007 | Xóa node: hộp thoại xác nhận nêu tên node và hệ quả; sau khi xóa, cập nhật danh sách bằng optimistic update và toast. |
| FR-INV-FE-008 | Tắt giám sát: chỉ số hiển thị chuyển sang trạng thái “Đang tắt”, không hiển thị số cũ gây hiểu nhầm. |
| FR-INV-FE-009 | VIEWER không thấy nút thêm/sửa/xóa; OPERATOR chỉ thấy công tắc giám sát. |

## 9. Bảo mật riêng

- Bảng `NodeCredentials` tách riêng, chỉ Application layer được truy cập qua `ICredentialProtector`; không có endpoint công khai nào đọc bảng này.
- `GET /internal/nodes/{id}/credentials`: chỉ nghe trên cổng nội bộ, yêu cầu mTLS + scope, TTL token 10 phút, **mỗi lần gọi ghi một bản ghi audit** (`CREDENTIAL_ACCESSED` kèm `checkId`).
- Thông báo lỗi kết nối không được chứa credential hoặc chuỗi lệnh đầy đủ.
- Xóa node ⇒ xóa cứng bản ghi credential (không giữ lại bản mã).

## 10. Phụ thuộc & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Phụ thuộc | SQL Server `soe_inventory`, RabbitMQ, thư viện SSH.NET (cho `test-connection`), secret store (khóa AES) |
| Rủi ro | Inventory ngừng ⇒ Worker không lấy được credential ⇒ chu kỳ quét gián đoạn. Giảm thiểu: retry + circuit breaker phía Worker, cache credential trong RAM tối đa 60 giây (không ghi đĩa), cảnh báo `SoeScanCoverageLow` |
| Hiệu năng | `GET /nodes` p95 ≤ 300 ms với 2.000 node (index `(DeletedAt, Name)`), `test-connection` giới hạn 10/phút/user |
