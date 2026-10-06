# Messaging — RabbitMQ + MassTransit

> Mục tiêu: các service rời nhau về thời gian và về triển khai; không mất event; xử lý lặp không gây hậu quả kép; lỗi có nơi để xem và phát lại.

---

## 1. Hạ tầng

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Broker | RabbitMQ 3.13 (plugin `management`, `rabbitmq_prometheus`) | Cluster 3 node ở production, quorum queue |
| Thư viện | MassTransit 8 (`MassTransit.RabbitMQ`, `MassTransit.EntityFrameworkCore`) | Retry, outbox, scheduling, DLQ sẵn có |
| Serialization | System.Text.Json, camelCase | Kèm header `MessageType`, `MessageId`, `CorrelationId` |
| Bảng hỗ trợ | `OutboxMessage`, `OutboxState`, `InboxState` trong DB của từng service | MassTransit EF Outbox |

## 2. Quy ước đặt tên

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Contract (C# type) | `<Tên>V<n>` trong namespace `SOE.Contracts.<Module>` | `SOE.Contracts.Monitoring.MetricCollectedV1` |
| Exchange | MassTransit tự tạo theo tên type (`soe.contracts.monitoring:MetricCollectedV1`) | — |
| Queue consumer | `<service>.<consumer>` | `metrics.metric-collected`, `incident.metric-collected` |
| Queue command | `<service>.commands.<command>` | `monitoring.commands.check-node` |
| DLQ | `<queue>_error` (MassTransit mặc định) | `incident.metric-collected_error` |
| Queue tạm (Realtime) | `realtime.<instanceId>` (auto-delete, exclusive) | — |

**Command vs Event**

- **Command** (`CheckNodeV1`): gửi tới **một** queue đích (`Send`), đúng một nhóm consumer xử lý → dùng cho competing consumers.
- **Event** (`MetricCollectedV1`): `Publish` lên exchange fanout, mọi consumer quan tâm đều nhận một bản.

## 3. Danh mục thông điệp (Message Catalog)

### 3.1 Command

#### `CheckNodeV1` — yêu cầu quét một node

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `checkId` | Guid | ✔ | Định danh lần quét, dùng để idempotent |
| `nodeId` | Guid | ✔ | Node cần quét |
| `reason` | enum | ✔ | `Scheduled` / `Manual` / `Retry` |
| `requestedBy` | Guid? | | User khi `Manual` |
| `metrics` | string[] | ✔ | `["cpu","memory","disk"]` theo cờ giám sát |
| `requestedAt` | DateTimeOffset | ✔ | |

Gửi tới: `monitoring.commands.check-node` · Producer: Monitoring.Scheduler, Monitoring.Api (check-now) · Consumer: Monitoring.Worker (N replica).
TTL message: 1 chu kỳ quét (mặc định 300s) — quá hạn thì bỏ, vì lần quét sau đã tới.

### 3.2 Event

#### `MetricCollectedV1`

```json
{
  "checkId": "0f3d…",
  "nodeId": "b21a…",
  "nodeName": "prod-web-01",
  "collectedAt": "2026-09-23T08:30:12Z",
  "durationMs": 842,
  "cpuPercent": 42.5,
  "memoryPercent": 71.8,
  "diskPercent": 91.2,
  "diskMountPath": "/",
  "collectorType": "Ssh"
}
```
Producer: Monitoring.Worker · Consumer: `metrics.metric-collected`, `incident.metric-collected`, `realtime.<instance>`.
Giá trị `null` = không thu được metric đó (khác 0).

#### `NodeUnreachableV1`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `checkId`, `nodeId`, `nodeName` | | |
| `failureKind` | enum | `ConnectTimeout` / `AuthFailed` / `HostKeyMismatch` / `CommandTimeout` / `Unknown` |
| `errorMessage` | string | Đã lọc, **không chứa credential** |
| `attempt` | int | Lần thử thứ mấy (sau retry của worker) |
| `occurredAt` | DateTimeOffset | |

Consumer: `incident.node-unreachable`, `realtime.*`, `audit.*`.

#### Sự kiện Inventory

| Event | Trường chính | Consumer |
|---|---|---|
| `NodeCreatedV1` | nodeId, name, host, port, username, monitorCpu/Memory/Disk, intervalSeconds, isActive | Monitoring (read model), Realtime, Audit |
| `NodeUpdatedV1` | như trên + `changedFields[]` | Monitoring, Realtime, Audit |
| `NodeMonitoringToggledV1` | nodeId, isActive | Monitoring, Incident (đóng sự cố khi tắt), Realtime, Audit |
| `NodeDeletedV1` | nodeId | Monitoring (bỏ lịch), Metrics (xóa/ẩn dữ liệu), Incident (đóng sự cố), Realtime, Audit |

#### Sự kiện Incident

| Event | Trường chính | Consumer |
|---|---|---|
| `IncidentOpenedV1` | incidentId, nodeId, nodeName, type, severity, description, metricValue, threshold, detectedAt | Notification, Realtime, Audit |
| `IncidentEscalatedV1` | incidentId, fromSeverity, toSeverity, metricValue, occurredAt | Notification, Realtime, Audit |
| `IncidentAcknowledgedV1` | incidentId, userId, note, occurredAt | Realtime, Audit |
| `IncidentResolvedV1` | incidentId, resolvedBy (`User`/`System`), userId?, resolutionAction, resolvedAt, durationSeconds | Notification (thông báo đóng), Realtime, Audit |

#### Sự kiện Notification / Identity / Audit

| Event | Producer | Ghi chú |
|---|---|---|
| `AlertDispatchedV1` | Notification | channelId, incidentId, deliveryId, sentAt, latencyMs |
| `AlertFailedV1` | Notification | + `errorMessage`, `attempts`, `willRetry` |
| `DailyReportSentV1` | Notification | activeNodes, openIncidents, reportDate |
| `UserLoggedInV1` / `UserLoginFailedV1` / `UserLockedV1` / `UserChangedV1` | Identity | ip, userAgent (đã rút gọn) |
| `AuditRequestedV1` | mọi service | action, entityType, entityId, before/after (JSON đã lọc secret), userId, correlationId |

## 4. Độ tin cậy

### 4.1 Transactional Outbox (phía producer)

```csharp
services.AddMassTransit(x =>
{
    x.AddEntityFrameworkOutbox<IncidentDbContext>(o =>
    {
        o.UseSqlServer();
        o.QueryDelay = TimeSpan.FromSeconds(1);
        o.UseBusOutbox();          // Publish trong handler chỉ ghi outbox
    });
    ...
});
```
Event chỉ được đẩy lên broker sau khi transaction nghiệp vụ commit → **không có trạng thái “đã gửi mail nhưng chưa lưu sự cố”**.

### 4.2 Inbox / Idempotency (phía consumer)

- Bật `o.UseBusOutbox()` + `AddConfigureEndpointsCallback((ctx,_,cfg) => cfg.UseEntityFrameworkOutbox<TDbContext>(ctx))` → MassTransit ghi `InboxState` theo `MessageId`, bản trùng bị bỏ qua.
- Ngoài ra mỗi nghiệp vụ có khóa tự nhiên chống trùng:
  - Metrics: unique `(nodeId, collectedAt)`.
  - Incident: unique lọc `(nodeId, type)` với `status <> RESOLVED`.
  - Notification: unique `(incidentId, channelId, eventKind)` trong cửa sổ throttle.

### 4.3 Retry & DLQ

```csharp
cfg.ReceiveEndpoint("incident.metric-collected", e =>
{
    e.UseMessageRetry(r => r.Exponential(5,
        TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(2)));
    e.UseDelayedRedelivery(r => r.Intervals(
        TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15)));
    e.PrefetchCount = 32;
    e.ConcurrentMessageLimit = 8;
    e.ConfigureConsumer<MetricCollectedConsumer>(ctx);
});
```

| Chính sách | Giá trị |
|---|---|
| Retry tức thì (lỗi tạm) | 5 lần, exponential 1s → 30s |
| Redelivery có độ trễ (lỗi kéo dài) | 3 lần: 1 phút, 5 phút, 15 phút |
| Hết retry | Vào `<queue>_error` (DLQ), phát cảnh báo hạ tầng nếu DLQ > 0 |
| Lỗi không thể retry (validation, message sai schema) | Vào `<queue>_skipped`, không retry |
| Theo dõi | Alert khi DLQ depth > 0 trong 5 phút, hoặc queue depth > 1000 |

Phát lại message trong DLQ: dùng `rabbitmqadmin` / Management UI shovel về queue gốc sau khi fix; có runbook trong [observability.md](observability.md).

### 4.4 Thứ tự & tranh chấp

- Không giả định thứ tự giữa các message. Incident dùng `collectedAt` để bỏ qua snapshot cũ hơn bản đã xử lý (`LastProcessedAt`).
- Cập nhật aggregate dùng **optimistic concurrency** (`rowversion`); xung đột → retry handler.

## 5. Phiên bản hóa contract

| Quy tắc | Nội dung |
|---|---|
| R1 | Contract là **immutable**. Thay đổi không tương thích ⇒ tạo `V2`, giữ `V1` ít nhất 1 chu kỳ release. |
| R2 | Thêm trường **tùy chọn** (nullable, có default) được coi là tương thích ngược. |
| R3 | Producer phát cả `V1` và `V2` trong giai đoạn chuyển tiếp; consumer nâng cấp trước, producer dừng `V1` sau. |
| R4 | `SOE.Contracts` đóng gói thành NuGet nội bộ, đánh version SemVer; consumer ghim version. |
| R5 | `SOE.ContractTests` kiểm tra JSON schema snapshot của mọi contract — phá vỡ schema làm CI đỏ. |

## 6. Bảo mật đường truyền

| Yêu cầu | Cách làm |
|---|---|
| Kết nối broker | TLS (`amqps`), user riêng cho từng service, quyền `configure/write/read` giới hạn theo tiền tố queue của service đó |
| Không mang secret | Cấm đưa password/private key/token vào message; Worker lấy credential qua API nội bộ (ADR-04) |
| Dữ liệu cá nhân | Không đưa email người dùng vào event nếu không cần; audit lưu `userId`, tra cứu tên khi hiển thị |
| Kích thước | Message ≤ 256 KB; nội dung lớn (vd log lệnh) lưu ở service nguồn, message chỉ mang tham chiếu |

## 7. Bảng tóm tắt endpoint tiêu thụ

| Queue | Consumer | Message | Prefetch | Ghi chú |
|---|---|---|---|---|
| `monitoring.commands.check-node` | `CheckNodeConsumer` | `CheckNodeV1` | 8 | Điểm scale chính (KEDA) |
| `metrics.metric-collected` | `PersistMetricConsumer` | `MetricCollectedV1` | 64 | Ghi theo lô (batch) 100 ms |
| `incident.metric-collected` | `EvaluateThresholdConsumer` | `MetricCollectedV1` | 32 | |
| `incident.node-unreachable` | `NodeUnreachableConsumer` | `NodeUnreachableV1` | 16 | |
| `incident.node-lifecycle` | `NodeLifecycleConsumer` | `NodeDeletedV1`, `NodeMonitoringToggledV1` | 8 | Đóng sự cố liên quan |
| `notification.incident` | `IncidentAlertConsumer` | `IncidentOpened/Escalated/ResolvedV1` | 16 | Throttle + chọn channel |
| `audit.all` | `AuditConsumer` | `AuditRequestedV1` + mọi event nghiệp vụ | 64 | Ghi theo lô |
| `realtime.<instance>` | `RealtimeFanoutConsumer` | metric/incident/node events | 128 | Queue auto-delete |
| `monitoring.node-sync` | `NodeSyncConsumer` | `NodeCreated/Updated/Deleted/ToggledV1` | 8 | Cập nhật read model |
