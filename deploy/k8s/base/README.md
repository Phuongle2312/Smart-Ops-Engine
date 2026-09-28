# k8s/base — manifest dùng chung (Kustomize)

> Trạng thái: 🔜 **Khung** — sẽ hiện thực ở M5. Đặc tả:
> [docs/01_architecture/deployment_scaling.md §3](../../../docs/01_architecture/deployment_scaling.md)

## Tệp dự kiến

| Tệp | Nội dung |
|---|---|
| `namespace.yaml` | Namespace `soe` |
| `<service>-deployment.yaml` | Deployment + Service + HPA + PodDisruptionBudget cho từng service |
| `gateway-ingress.yaml` | Ingress + TLS (cert-manager) — chỉ Gateway lộ ra ngoài |
| `networkpolicy.yaml` | Deny-all mặc định; chỉ mở đúng chiều gọi cần thiết |
| `monitoring-worker-scaledobject.yaml` | KEDA ScaledObject theo độ sâu queue RabbitMQ |
| `migration-job.yaml` | Job chạy migration trước khi rollout |
| `secrets.example.yaml` | Mẫu SealedSecret / ExternalSecret (không chứa giá trị thật) |
| `kustomization.yaml` | Gom các tệp trên |

## Ràng buộc bắt buộc cho mọi Deployment

- `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`
- `resources.requests/limits` đầy đủ; `readinessProbe` `/health/ready`, `livenessProbe` `/health/live`
- `PodDisruptionBudget: minAvailable: 1`; rolling update `maxUnavailable: 0`
- `topologySpreadConstraints` trải pod trên nhiều node
- Chỉ `monitoring-worker` được phép egress SSH (cổng 22) ra dải mạng máy chủ đích
