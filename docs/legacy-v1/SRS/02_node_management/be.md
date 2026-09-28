# 02 — Quản lý Node — Backend

> **Trạng thái:** `[BE v1.0 ✅]` CRUD cơ bản hoạt động. `[TODO ⚠️]` Một số điểm cần cải thiện ghi bên dưới.

---

## Entity: `Node`

**Class:** `com.soe.entity.Node` · **Bảng:** `Nodes`

| Field        | Kiểu Java  | SQL              | Ràng buộc            | Ghi chú                                              |
| :----------- | :--------- | :--------------- | :------------------- | :--------------------------------------------------- |
| `id`         | `Long`     | `BIGINT`         | PK, IDENTITY         |                                                      |
| `host`       | `String`   | `VARCHAR(45)`    | NOT NULL, UNIQUE     | IP hoặc hostname. Unique tránh thêm trùng server     |
| `name`       | `String`   | `VARCHAR(255)`   | NOT NULL             | Tên gợi nhớ (VD: `prod-web-01`)                     |
| `username`   | `String`   | `VARCHAR(100)`   | NOT NULL             | Tài khoản SSH                                        |
| `password`   | `String`   | `VARCHAR(MAX)`   | NULL                 | **AES/ECB encrypted** via `@Convert(CryptoConverter)` |
| `ssh_key`    | `String`   | `TEXT`           | NULL                 | Private key SSH — **AES/ECB encrypted**              |
| `port`       | `Integer`  | `INT`            | NOT NULL, Default 22 | `@Builder.Default = 22`                              |
| `description`| `String`   | `VARCHAR(500)`   | NULL                 |                                                      |
| `active`     | `boolean`  | `BIT`            | NOT NULL, Default 1  | `@Builder.Default = true`                            |

**Annotations Lombok:** `@Entity`, `@Table(name="Nodes")`, `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`

---

## Mã hóa AES — `CryptoConverter` + `AesEncryptionUtil`

### CryptoConverter (`com.soe.converter.CryptoConverter`)

JPA `AttributeConverter<String, String>` — mã hóa/giải mã minh bạch ở tầng persistence:

```java
@Converter
public class CryptoConverter implements AttributeConverter<String, String> {
    @Override public String convertToDatabaseColumn(String val) { return AesEncryptionUtil.encrypt(val); }
    @Override public String convertToEntityAttribute(String db)  { return AesEncryptionUtil.decrypt(db); }
}
```

Áp dụng trên Entity bằng: `@Convert(converter = CryptoConverter.class)`

### AesEncryptionUtil (`com.soe.util.AesEncryptionUtil`)

- Algorithm: `"AES"` (tương đương AES/ECB/PKCS5Padding)
- Key: đọc từ `@Value("${smartops.aes.secret-key}")` → inject vào `static byte[] KEY`
- Output: Base64-encoded ciphertext

```
Mã hóa: plaintext → AES/ECB encrypt → Base64 → lưu DB
Giải mã: DB value → Base64 decode → AES/ECB decrypt → plaintext (chỉ trong RAM)
```

**[TODO ⚠️]** AES/ECB không có IV — các giá trị giống nhau cho ciphertext giống nhau. Cần nâng lên AES/GCM (có random IV + Authentication Tag) ở v2.0 để bảo mật production.

---

## Repository: `NodeRepository`

```java
interface NodeRepository extends JpaRepository<Node, Long> {
    Optional<Node> findByHost(String host);   // Kiểm tra trùng host khi thêm mới
    Optional<Node> findByName(String name);   // Tìm theo tên hiển thị
    List<Node>     findByActiveTrue();        // Lấy Node đang giám sát (dùng bởi Scheduler)
}
```

---

## API Endpoints (`NodeController`)

**Base path:** `/api`

### GET `/api/nodes` — Danh sách tất cả Node

- Trả về `List<NodeResponse>` — **password không bao giờ xuất hiện trong response**.
- Không có phân trang (v1.0). v2.0 cần thêm `Pageable`.

**Response 200:**
```json
[
  { "id": 1, "name": "prod-web-01", "host": "192.168.1.10", "port": 22,
    "username": "ubuntu", "description": "...", "active": true }
]
```

### GET `/api/nodes/{id}` — Chi tiết một Node

- 200 `NodeResponse` nếu tìm thấy, 404 nếu không.

### POST `/api/nodes` — Thêm Node mới

**[TODO ⚠️]** Hiện tại Controller đang gọi `AesEncryptionUtil.encrypt(request.password())` thủ công trước khi set vào Entity. Điều này gây **double-encrypt** vì `CryptoConverter` sẽ encrypt lần nữa khi save. Cần bỏ dòng encrypt thủ công trong Controller.

**Request body (`NodeRequest`):**
```json
{
  "name": "prod-web-01",
  "host": "192.168.1.50",
  "port": 22,
  "username": "ubuntu",
  "password": "my-ssh-password",
  "description": "Máy chủ Production"
}
```

**Response 201 `NodeResponse`**

### PUT `/api/nodes/{id}/toggle-active` — Bật/Tắt giám sát

```json
// Response 200:
{
  "id": 1,
  "name": "prod-web-01",
  "active": false,
  "message": "Trạng thái giám sát Node đã được thay đổi."
}
```

### DELETE `/api/nodes/{id}` — Xóa Node

- 204 No Content nếu xóa thành công.
- 404 nếu Node không tồn tại.
- Incident_Logs liên quan vẫn còn trong DB (FK `node_id` giữ nguyên).

---

## DTOs (`NodeController` inner records)

```java
record NodeRequest(String name, String host, Integer port,
                   String username, String password, String description) {}

record NodeResponse(Long id, String name, String host, int port,
                    String username, String description, boolean active) {
    static NodeResponse from(Node node) { ... }  // Map từ Entity, ẩn password
}
```

---

## Điểm cần bổ sung v2.0 `[BE v2.0 🔜]`

| Tính năng                         | Mô tả                                                          |
| :-------------------------------- | :------------------------------------------------------------- |
| `PUT /api/nodes/{id}`             | Cập nhật đầy đủ: name, host, port, description, monitor flags |
| `monitor_disk/cpu/ram` fields     | Cột BIT trong DB để chọn tài nguyên cần giám sát per-Node     |
| `created_at`, `updated_at` fields | Timestamp audit trong Entity                                   |
| Phân trang GET `/api/nodes`       | `Pageable` parameter                                           |
| Kiểm tra duplicate host           | Validate `host` không trùng khi POST/PUT                       |
| JWT Security                      | Chỉ ADMIN được POST/PUT/DELETE, VIEWER chỉ GET                 |
| Audit Log                         | Ghi CREATE/UPDATE/DELETE vào `Audit_Logs`                      |

---

**Xem thêm:** [FE Node Management](fe.md) · [BE Scheduler](../03_health_check_scheduler/be.md) · [BE System Config](../09_system_config/be.md)
