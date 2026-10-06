# Triển khai & Khả năng mở rộng — Docker, Compose, Kubernetes

---

## 1. Đóng gói container

`Dockerfile` chuẩn cho mọi service .NET (multi-stage, non-root, không chứa SDK):

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["src/BuildingBlocks/", "BuildingBlocks/"]
COPY ["src/Services/Inventory/", "Services/Inventory/"]
RUN dotnet restore "Services/Inventory/SOE.Inventory.Api/SOE.Inventory.Api.csproj"
RUN dotnet publish "Services/Inventory/SOE.Inventory.Api/SOE.Inventory.Api.csproj" \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
RUN adduser -D -u 10001 soe
WORKDIR /app
COPY --from=build /app/publish .
USER 10001
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/health/live || exit 1
ENTRYPOINT ["dotnet", "SOE.Inventory.Api.dll"]
```

Frontend:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf   # CSP + cache + gzip/brotli
USER nginx
```

**Quy tắc image:** tag theo `git sha` (không dùng `latest` ở prod), quét Trivy trong CI, image read-only filesystem, `securityContext` drop mọi capability.

## 2. Môi trường dev — `docker-compose.yml`

| Dịch vụ | Image | Cổng host | Ghi chú |
|---|---|---|---|
| `gateway` | soe/gateway | 8080 | Điểm vào duy nhất |
| `identity`, `inventory`, `monitoring-api`, `metrics`, `incident`, `notification`, `realtime`, `audit` | soe/* | (không mở ra host) | Mạng nội bộ `soe-net` |
| `monitoring-worker` | soe/monitoring-worker | — | `deploy.replicas: 2`, không mở cổng |
| `sqlserver` | mcr.microsoft.com/mssql/server:2022-latest | 1433 | Volume `mssql-data` |
| `rabbitmq` | rabbitmq:3.13-management | 5672, 15672 | Volume `rabbit-data` |
| `redis` | redis:7-alpine | 6379 | |
| `seq` | datalust/seq | 5341, 8081 | Log tập trung (dev) |
| `jaeger` | jaegertracing/all-in-one | 16686 | Trace |
| `mailhog` | mailhog/mailhog | 8025 | SMTP giả để test email |
| `frontend` | soe/frontend | 5173 | |

```yaml
# trích
services:
  monitoring-worker:
    image: soe/monitoring-worker:${TAG}
    environment:
      - ConnectionStrings__Default=Server=sqlserver;Database=soe_monitoring;...
      - RabbitMq__Host=amqp://rabbitmq:5672
      - Inventory__InternalBaseUrl=http://inventory:8080
    depends_on: [rabbitmq, sqlserver, inventory]
    deploy:
      replicas: 2
      resources: { limits: { cpus: "0.5", memory: 512M } }
    restart: unless-stopped
```

Lệnh thường dùng:

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --scale monitoring-worker=5
```

`.env.example` liệt kê mọi biến (không chứa giá trị thật): `SQL_SA_PASSWORD`, `SOE_CRYPTO__KEYS__K1`, `JWT_PRIVATE_KEY_PEM`, `SMTP__PASSWORD`…

## 3. Kubernetes (staging / production)

```
deploy/k8s/
 ├── base/
 │    ├── namespace.yaml                 # soe
 │    ├── <service>-deployment.yaml      # + Service, HPA, PDB
 │    ├── gateway-ingress.yaml           # TLS, cert-manager
 │    ├── networkpolicy.yaml             # deny-all + allow theo nhãn
 │    ├── secrets.example.yaml           # dùng SealedSecret/ExternalSecret ở thực tế
 │    └── migration-job.yaml
 └── overlays/{staging,production}/      # Kustomize: replica, tài nguyên, cấu hình
```

Thiết lập bắt buộc cho mỗi Deployment:

```yaml
spec:
  replicas: 2
  template:
    spec:
      securityContext: { runAsNonRoot: true, runAsUser: 10001, fsGroup: 10001 }
      containers:
        - name: app
          resources:
            requests: { cpu: "100m", memory: "192Mi" }
            limits:   { cpu: "500m", memory: "512Mi" }
          readinessProbe: { httpGet: { path: /health/ready, port: 8080 }, periodSeconds: 10 }
          livenessProbe:  { httpGet: { path: /health/live,  port: 8080 }, periodSeconds: 20 }
          startupProbe:   { httpGet: { path: /health/live,  port: 8080 }, failureThreshold: 30 }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
```

Kèm `PodDisruptionBudget: minAvailable: 1` cho mọi service, `NetworkPolicy` mặc định deny-all: chỉ Gateway được gọi API service; chỉ service được gọi SQL/RabbitMQ/Redis; chỉ `monitoring-worker` được mở kết nối egress SSH (cổng 22) ra dải mạng máy chủ đích.

## 4. Chiến lược mở rộng

| Thành phần | Trạng thái | Cách scale | Ngưỡng |
|---|---|---|---|
| Gateway | Stateless | HPA theo CPU 60% và RPS | 2 → 10 pod |
| API service (Identity, Inventory, Metrics, Incident, Notification, Audit) | Stateless | HPA CPU 70% | 2 → 6 pod |
| **Monitoring Worker** | Stateless, tiêu thụ queue | **KEDA** theo độ dài `monitoring.commands.check-node` | 2 → 30 pod, 20 message/pod |
| Monitoring Scheduler | Có trạng thái lịch (Quartz cluster) | 2 pod (HA), chỉ một pod chạy trigger | cố định |
| Realtime | Kết nối dài hạn | HPA theo số kết nối (custom metric) + Redis backplane | 2 → 8 pod |
| SQL Server | Có trạng thái | Scale dọc + read replica cho truy vấn metric nếu cần | — |
| RabbitMQ | Cluster | 3 node, quorum queue | — |
| Redis | Cluster/Sentinel | 3 node | — |

```yaml
# KEDA ScaledObject cho worker
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: monitoring-worker, namespace: soe }
spec:
  scaleTargetRef: { name: monitoring-worker }
  minReplicaCount: 2
  maxReplicaCount: 30
  cooldownPeriod: 120
  triggers:
    - type: rabbitmq
      metadata:
        protocol: amqp
        queueName: monitoring.commands.check-node
        mode: QueueLength
        value: "20"
      authenticationRef: { name: rabbitmq-auth }
```

**Tính toán năng lực (dùng cho NFR-SCL-001):**

- 500 node, chu kỳ 5 phút ⇒ 500 lệnh quét / 300 giây ≈ **1,7 msg/s**.
- Một lần quét SSH ≈ 1,5 s (kết nối + 3 lệnh); một worker với `ConcurrentMessageLimit = 8` xử lý ≈ 5,3 msg/s.
- ⇒ 2 worker đủ cho 500 node; 30 worker phục vụ ~7.500 node. Điểm nghẽn kế tiếp là SQL Server ghi metric (giảm tải bằng ghi theo lô + partition).

**Giới hạn phải tuân thủ khi scale:**

1. Mọi service **không giữ trạng thái trong bộ nhớ tiến trình** (cache chỉ ở Redis, có TTL).
2. Job định kỳ chỉ chạy một nơi: Quartz clustered (Monitoring), hoặc `DistributedLock` qua Redis (job rollup, retention, daily report).
3. SignalR dùng WebSocket + Redis backplane ⇒ **không cần sticky session**.
4. Consumer phải idempotent (xem [messaging_events.md](messaging_events.md) §4.2) vì scale ⇒ khả năng xử lý lặp tăng.

## 5. Cấu hình & bí mật

| Nguồn | Dùng cho |
|---|---|
| `appsettings.json` | Giá trị mặc định không nhạy cảm |
| Biến môi trường (`SOE_` prefix, `__` cho cấp lồng) | Ghi đè theo môi trường |
| K8s `Secret` (ExternalSecret → Azure Key Vault) | Chuỗi kết nối, khóa AES, khóa ký JWT, mật khẩu SMTP, secret webhook |
| `ConfigMap` | Cấu hình YARP, mức log, feature flag |

Quy tắc: **không secret nào nằm trong image hoặc repo**; ứng dụng fail-fast khi thiếu secret bắt buộc; `IOptions<T>` kèm validation (`ValidateOnStart`).

## 6. CI/CD (GitHub Actions — phác thảo)

| Job | Nội dung | Chặn merge? |
|---|---|---|
| `build-test` | `dotnet build` + unit test + coverage gate + ArchitectureTests | ✔ |
| `integration-test` | Testcontainers (SQL Server, RabbitMQ) cho từng service | ✔ |
| `contract-test` | So schema event với snapshot | ✔ |
| `frontend` | `npm ci`, lint, `vitest`, `npm run build`, kiểm tra bundle budget | ✔ |
| `security` | gitleaks, CodeQL, `dotnet list package --vulnerable`, `npm audit --audit-level=high`, Trivy | ✔ |
| `e2e` | Playwright trên compose dựng tạm | ✔ (nhánh chính) |
| `publish` | Build & push image theo `git sha` | — |
| `deploy-staging` | Kustomize apply + migration job + smoke test | tự động |
| `deploy-prod` | Duyệt thủ công, rolling update, theo dõi SLO 30 phút, rollback tự động nếu lỗi tăng | thủ công |

**Thứ tự triển khai an toàn:** migration job → service backend (rolling, maxSurge 1, maxUnavailable 0) → gateway → frontend.

## 7. Vận hành

| Tình huống | Xử lý |
|---|---|
| Queue dồn > 1000 message | KEDA tự tăng worker; nếu không giảm → kiểm tra Inventory (credential API) và mạng SSH |
| DLQ > 0 | Cảnh báo; xem message trong Management UI, sửa lỗi, shovel về queue gốc |
| SQL Server đầy | Kiểm tra partition `MetricSnapshots`; chạy retention job thủ công |
| Rò rỉ kết nối SSH | Worker có `SemaphoreSlim` giới hạn kết nối đồng thời và timeout cứng; restart pod là an toàn (không mất message nhờ ack sau khi xử lý) |
| Cần dừng giám sát khẩn cấp | Tắt trigger Quartz qua API `PUT /api/v1/system-config/scheduler {enabled:false}` (ADMIN, ghi audit) |
