# 09 — Cấu hình hệ thống — Backend

> **Trạng thái:** `[BE v1.0 ✅]` Cấu hình cơ bản hoạt động. Một số mục cần bảo mật `[TODO ⚠️]`.

---

## File `application.properties` hiện tại

### Server

```properties
server.port=8080
```

### Database (SQL Server)

```properties
spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=smart_ops_engine;encrypt=true;trustServerCertificate=true
spring.datasource.username=sa
spring.datasource.password=<plaintext>   # [TODO ⚠️] Đưa ra biến môi trường DB_PASSWORD
spring.datasource.driverClassName=com.microsoft.sqlserver.jdbc.SQLServerDriver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.SQLServerDialect
```

> `ddl-auto=update` tự động tạo/cập nhật schema từ Entity khi khởi động. Phù hợp dev, cần đổi thành `validate` ở production.

### Email SMTP (Office 365)

```properties
spring.mail.host=smtp.office365.com
spring.mail.port=587
spring.mail.username=your-email@yourdomain.com
spring.mail.password=<plaintext>   # [TODO ⚠️] Đưa ra biến môi trường MAIL_PASSWORD
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
```

### Smart Ops Engine Custom Config

```properties
# Mã hóa SSH credentials
smartops.aes.secret-key=<32-char-string>   # [TODO ⚠️] Đưa ra biến môi trường AES_SECRET_KEY

# Email nhận cảnh báo
smartops.alert.recipient.email=ops-team@example.com

# Scheduler
smartops.scheduler.disk-check-interval-ms=300000   # 5 phút (fixedDelay)
smartops.scheduler.daily-report-cron=0 0 8 * * MON-FRI
```

---

## Bảng cấu hình đầy đủ

### Cấu hình v1.0 (đang dùng)

| Khóa                                       | Giá trị mặc định      | Biến môi trường   | Ghi chú                              |
| :----------------------------------------- | :-------------------- | :---------------- | :----------------------------------- |
| `server.port`                              | `8080`                | `SERVER_PORT`     |                                      |
| `spring.datasource.url`                    | localhost:1433        | `DB_URL`          |                                      |
| `spring.datasource.username`               | `sa`                  | `DB_USERNAME`     |                                      |
| `spring.datasource.password`               | *(plaintext)*         | `DB_PASSWORD`     | **Bắt buộc dùng env var production** |
| `spring.mail.host`                         | `smtp.office365.com`  | —                 |                                      |
| `spring.mail.port`                         | `587`                 | —                 |                                      |
| `spring.mail.username`                     | *(email)*             | `MAIL_USERNAME`   |                                      |
| `spring.mail.password`                     | *(plaintext)*         | `MAIL_PASSWORD`   | **Bắt buộc dùng env var production** |
| `smartops.aes.secret-key`                  | *(32-char string)*    | `AES_SECRET_KEY`  | **Bắt buộc dùng env var production** |
| `smartops.alert.recipient.email`           | *(email quản lý)*     | —                 |                                      |
| `smartops.scheduler.disk-check-interval-ms`| `300000`              | —                 | milliseconds                         |
| `smartops.scheduler.daily-report-cron`     | `0 0 8 * * MON-FRI`  | —                 | Spring Cron expression               |

### Cấu hình v2.0 kế hoạch

| Khóa                                  | Giá trị mặc định | Biến môi trường  | Ghi chú                     |
| :------------------------------------ | :--------------- | :--------------- | :-------------------------- |
| `smartops.jwt.secret`                 | *(64 ký tự)*     | `JWT_SECRET`     | HMAC-SHA256 signing key     |
| `smartops.jwt.access-ttl-seconds`     | `3600`           | —                | 1 giờ                       |
| `smartops.jwt.refresh-ttl-days`       | `7`              | —                | 7 ngày                      |
| `smartops.threshold.disk-warning`     | `80`             | —                | Disk warning (%)            |
| `smartops.threshold.disk-critical`    | `90`             | —                | Disk critical (%)           |
| `smartops.threshold.cpu-warning`      | `75`             | —                | CPU warning (%)             |
| `smartops.threshold.cpu-critical`     | `90`             | —                | CPU critical (%)            |
| `smartops.threshold.ram-warning`      | `80`             | —                | RAM warning (%)             |
| `smartops.threshold.ram-critical`     | `90`             | —                | RAM critical (%)            |
| `smartops.metrics.retention-days`     | `90`             | —                | Xóa Node_Metrics sau N ngày |

---

## Cấu hình production khuyến nghị

### `application.properties` production

```properties
# Thay plaintext bằng biến môi trường
spring.datasource.password=${DB_PASSWORD}
spring.mail.password=${MAIL_PASSWORD}
smartops.aes.secret-key=${AES_SECRET_KEY}
smartops.jwt.secret=${JWT_SECRET}

# Tắt SQL logging
spring.jpa.show-sql=false

# Không tự động alter schema
spring.jpa.hibernate.ddl-auto=validate

# HTTPS
server.ssl.enabled=true
server.ssl.key-store-type=PKCS12
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=${SSL_KEYSTORE_PASSWORD}
```

### `application-prod.yml` profile (alternative)

```yaml
spring:
  datasource:
    url: jdbc:sqlserver://${DB_HOST}:1433;databaseName=${DB_NAME};encrypt=true
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
```

Activate: `SPRING_PROFILES_ACTIVE=prod` environment variable.

---

## Phụ thuộc Maven (`pom.xml`) — v1.0

```xml
spring-boot-starter-web
spring-boot-starter-validation
spring-boot-starter-data-jpa
spring-boot-starter-mail
com.microsoft.sqlserver:mssql-jdbc       (runtime)
com.h2database:h2                        (runtime — cho test)
org.projectlombok:lombok                 (optional)
com.github.mwiede:jsch:0.2.17           (SSH client)
com.github.oshi:oshi-core:6.6.3         (hardware metrics — chưa dùng)
spring-boot-starter-test                 (test scope)
```

### Cần thêm cho v2.0

```xml
spring-boot-starter-security
io.jsonwebtoken:jjwt-api:0.12.x
io.jsonwebtoken:jjwt-impl:0.12.x
io.jsonwebtoken:jjwt-jackson:0.12.x
spring-boot-starter-websocket
spring-boot-starter-aop
net.javacrumbs.shedlock:shedlock-spring:5.x
net.javacrumbs.shedlock:shedlock-provider-jdbc-template:5.x
```

---

## Biến môi trường — checklist trước khi deploy production

```
[ ] DB_PASSWORD          — Mật khẩu SQL Server
[ ] MAIL_USERNAME        — Email gửi cảnh báo
[ ] MAIL_PASSWORD        — App password / SMTP password
[ ] AES_SECRET_KEY       — 32 ký tự ngẫu nhiên (AES-256 key)
[ ] JWT_SECRET           — 64 ký tự ngẫu nhiên (HMAC-SHA256 key)
[ ] SSL_KEYSTORE_PASSWORD — Nếu dùng HTTPS
```

---

**Xem thêm:** [BE Auth](../01_auth/be.md) · [BE Node Management](../02_node_management/be.md)
