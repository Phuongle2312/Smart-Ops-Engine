# 07 — Audit Log — Backend

> **Trạng thái:** `[BE v2.0 🔜]` Chưa triển khai. Cần Spring AOP dependency.

---

## Mục đích

Ghi lại mọi hành động thay đổi dữ liệu (CREATE, UPDATE, DELETE, RESOLVE) của người dùng hoặc hệ thống vào bảng `Audit_Logs`. Phục vụ:
- Truy vết ai đã làm gì, lúc nào, từ IP nào.
- Compliance / audit trail khi có sự cố.
- Debug khi cần biết giá trị trước/sau khi thay đổi.

---

## Entity: `Audit_Logs`

**Bảng SQL Server:**

| Cột           | Kiểu           | Ràng buộc    | Mô tả                                                 |
| :------------ | :------------- | :----------- | :---------------------------------------------------- |
| `id`          | `BIGINT`       | PK, IDENTITY |                                                       |
| `user_id`     | `BIGINT`       | FK, NULL     | Người thực hiện (null = hệ thống tự động)             |
| `action`      | `VARCHAR(50)`  | NOT NULL     | `CREATE`, `UPDATE`, `DELETE`, `RESOLVE`, `ACKNOWLEDGE`, `TOGGLE` |
| `entity_type` | `VARCHAR(50)`  | NOT NULL     | `NODE`, `INCIDENT`, `USER`, `CHANNEL`                 |
| `entity_id`   | `BIGINT`       | NULL         | ID đối tượng bị tác động                             |
| `old_value`   | `TEXT`         | NULL         | Giá trị trước thay đổi (JSON serialize)               |
| `new_value`   | `TEXT`         | NULL         | Giá trị sau thay đổi (JSON serialize)                 |
| `ip_address`  | `VARCHAR(45)`  | NULL         | IP người thực hiện (từ `HttpServletRequest`)          |
| `created_at`  | `DATETIME2`    | NOT NULL     | Thời điểm ghi log (auto `LocalDateTime.now()`)        |

---

## Dependency cần thêm vào `pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

---

## Custom Annotation `@Auditable`

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action();       // "CREATE", "UPDATE", "DELETE", "RESOLVE"
    String entityType();   // "NODE", "INCIDENT", "CHANNEL"
}
```

**Dùng trên Service methods:**
```java
@Auditable(action = "CREATE", entityType = "NODE")
public Node createNode(NodeRequest request) { ... }

@Auditable(action = "DELETE", entityType = "NODE")
public void deleteNode(Long id) { ... }

@Auditable(action = "RESOLVE", entityType = "INCIDENT")
public IncidentLog resolveIncident(Long id, String resolution) { ... }
```

---

## AOP Aspect: `AuditAspect`

```java
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogRepository auditLogRepository;
    private final HttpServletRequest request;  // Request-scoped bean

    @Around("@annotation(auditable)")
    public Object auditMethod(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        // 1. Lấy user từ SecurityContext
        String userId = getCurrentUserId();
        String ip = getClientIp(request);

        // 2. Capture old value nếu cần (trước khi thực thi)
        String oldValue = captureOldValue(pjp, auditable);

        // 3. Thực thi method gốc
        Object result = pjp.proceed();

        // 4. Capture new value (sau khi thực thi)
        String newValue = objectToJson(result);

        // 5. Ghi Audit Log
        auditLogRepository.save(AuditLog.builder()
            .userId(userId)
            .action(auditable.action())
            .entityType(auditable.entityType())
            .entityId(extractEntityId(result))
            .oldValue(oldValue)
            .newValue(newValue)
            .ipAddress(ip)
            .createdAt(LocalDateTime.now())
            .build()
        );

        return result;
    }
}
```

---

## API Endpoint

### GET `/api/audit-logs`

**Quyền:** Chỉ `ROLE_ADMIN`.

**Query params:**
- `page` (default 0), `size` (default 20)
- `action`: `CREATE`, `UPDATE`, `DELETE`, `RESOLVE`, `ACKNOWLEDGE`
- `entityType`: `NODE`, `INCIDENT`, `CHANNEL`, `USER`
- `userId`: Lọc theo người thực hiện
- `from`, `to`: Khoảng thời gian (ISO 8601)

**Response 200:**
```json
{
  "content": [
    {
      "id": 501,
      "userId": 1, "username": "admin",
      "action": "RESOLVE", "entityType": "INCIDENT", "entityId": 102,
      "oldValue": "{\"status\":\"OPEN\"}",
      "newValue": "{\"status\":\"RESOLVED\",\"resolutionAction\":\"...\"}",
      "ipAddress": "192.168.1.100",
      "createdAt": "2026-06-24T09:00:00"
    }
  ],
  "totalElements": 150,
  "totalPages": 8,
  "page": 0,
  "size": 20
}
```

---

**Xem thêm:** [FE Audit Log](fe.md) · [BE Auth](../01_auth/be.md)
