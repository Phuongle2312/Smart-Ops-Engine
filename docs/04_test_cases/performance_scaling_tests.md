# Test Cases — Hiệu năng, Mở rộng & Chịu lỗi

> Tham chiếu: [nfr.md](../01_architecture/nfr.md) · [deployment_scaling.md](../01_architecture/deployment_scaling.md)
> Môi trường: staging Kubernetes, 500 node SSH giả lập (container `openssh-server`, độ trễ mô phỏng 200–800 ms), dữ liệu 90 ngày.

## 1. Hiệu năng API (k6)

| ID | Kịch bản | Cấu hình tải | Chỉ tiêu | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-PERF-API-001 | `GET /nodes` phân trang | 30 VU, 5 phút | p95 ≤ 300 ms, lỗi 0% | P1 | NFR-PERF-001 |
| TC-PERF-API-002 | `GET /metrics/latest` (500 node) | 30 VU, 5 phút | p95 ≤ 400 ms | P1 | NFR-PERF-003 |
| TC-PERF-API-003 | `GET /nodes/{id}/metrics?range=30d` | 20 VU, 5 phút | p95 ≤ 700 ms, ≤ 500 điểm/phản hồi | P1 | NFR-PERF-004 |
| TC-PERF-API-004 | `GET /incidents` với 100.000 bản ghi | 20 VU | p95 ≤ 300 ms | P1 | NFR-PERF-001 |
| TC-PERF-API-005 | Ghi: tạo/sửa node | 10 VU | p95 ≤ 500 ms | P2 | NFR-PERF-002 |
| TC-PERF-API-006 | Đăng nhập (Argon2id) | 10 VU | p95 ≤ 700 ms, CPU Identity < 80% | P2 | SRS IDN §10 |
| TC-PERF-API-007 | Hỗn hợp thực tế (80% đọc / 20% ghi) | 50 VU, 15 phút | p95 tổng ≤ 400 ms, lỗi < 0,1% | P1 | NFR-PERF-001 |
| TC-PERF-API-008 | Spike test | 10 → 200 VU trong 30 giây | Không lỗi 5xx kéo dài; hệ thống hồi phục < 2 phút | P2 | NFR-AVL-001 |
| TC-PERF-API-009 | Soak test | 30 VU, 4 giờ | Không rò rỉ bộ nhớ (RSS ổn định), không tăng độ trễ theo thời gian | P2 | NFR-MNT |

## 2. Đường ống giám sát

| ID | Kịch bản | Cách thực hiện | Chỉ tiêu | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-PERF-MON-001 | Độ phủ chu kỳ 500 node | Chạy 10 chu kỳ 5 phút với 2 worker | ≥ 99% node được quét mỗi chu kỳ | P1 | NFR-SCL-001 |
| TC-PERF-MON-002 | Thời gian một lần quét | Đo `soe_check_duration_seconds` | p95 ≤ 5 giây | P1 | NFR-PERF-005 |
| TC-PERF-MON-003 | Mở rộng ngang worker | Chạy cùng tải với 2 → 4 → 8 worker | Thời gian hoàn tất chu kỳ giảm ≥ 40% khi gấp đôi worker (tới khi chạm giới hạn DB) | P1 | NFR-SCL-002 |
| TC-PERF-MON-004 | KEDA tự scale | Bơm 5.000 lệnh quét vào queue | Số pod worker tăng theo độ sâu queue (20 msg/pod), tối đa 30; giảm lại sau `cooldownPeriod` | P1 | deployment §4 |
| TC-PERF-MON-005 | Quy mô 2.000 node | Tăng số node giả lập | Vẫn đạt độ phủ ≥ 99% với ≤ 10 worker | P2 | NFR-SCL-003 |
| TC-PERF-MON-006 | Ghi metric 1.000/phút | Bơm event | Queue `metrics.metric-collected` không dồn > 500; CPU pod < 70% | P1 | NFR-SCL-005 |
| TC-PERF-MON-007 | Độ trễ cảnh báo đầu-cuối | Kích hoạt vượt ngưỡng trên 50 node đồng thời | p95 từ `collectedAt` tới lúc email/webhook rời hệ thống ≤ 60 giây | P1 | NFR-PERF-010 |
| TC-PERF-MON-008 | Node chậm không chặn node khác | 50 node treo (timeout 30s) + 450 node bình thường | Node bình thường vẫn được quét đúng hạn | P1 | NFR-AVL-005 |

## 3. Realtime & Frontend

| ID | Kịch bản | Cách thực hiện | Chỉ tiêu | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-PERF-RTM-001 | 200 kết nối SignalR | Công cụ tạo tải WebSocket | CPU pod < 60%, p95 độ trễ đẩy ≤ 2 giây, 0 kết nối rớt | P1 | NFR-SCL-004 |
| TC-PERF-FE-001 | LCP Dashboard | Lighthouse CI, Fast 3G mô phỏng, 500 node | LCP ≤ 2,5 giây | P1 | NFR-PERF-020 |
| TC-PERF-FE-002 | INP | Lighthouse CI + thao tác lọc/chuyển trang | INP ≤ 200 ms | P1 | NFR-PERF-021 |
| TC-PERF-FE-003 | CLS | Lighthouse CI | ≤ 0,1 | P2 | NFR-PERF-022 |
| TC-PERF-FE-004 | Kích thước bundle | Script kiểm tra sau `vite build` | JS khởi tạo ≤ 250 KB gzip; tổng trên Dashboard ≤ 450 KB | P1 | NFR-PERF-023 |
| TC-PERF-FE-005 | Bảng 1.000 dòng | Playwright trace khi cuộn | ≥ 50 fps, không tác vụ dài > 50 ms | P2 | NFR-PERF-024 |
| TC-PERF-FE-006 | Số request khi mở Dashboard | Playwright network assert | ≤ 6 request | P1 | FR-MET-FE-002 |
| TC-PERF-FE-007 | Chart 30 ngày | Đo thời gian render | ≤ 500 điểm, render < 300 ms | P2 | FR-MET-FE-006 |

## 4. Chịu lỗi (chaos)

| ID | Kịch bản | Cách thực hiện | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-PERF-CHA-001 | Kill worker giữa chừng | `kubectl delete pod` worker khi đang quét | Message chưa ack được xử lý lại; không mất lệnh, không trùng snapshot | P1 | NFR-AVL-002, 003 |
| TC-PERF-CHA-002 | RabbitMQ ngừng 10 phút | Dừng broker rồi bật lại | Outbox giữ event; sau khi phục hồi, mọi event được phát; không mất cảnh báo | P1 | NFR-AVL-004 |
| TC-PERF-CHA-003 | SQL Server ngắt kết nối tạm | Restart container DB | Service retry, health `ready` = false trong lúc mất DB, tự phục hồi | P1 | NFR-AVL-004 |
| TC-PERF-CHA-004 | Redis ngừng | Dừng Redis | Rate limit chuyển chế độ dự phòng, SignalR vẫn hoạt động trong từng instance, không sập | P2 | UC-RTM-01/E4 |
| TC-PERF-CHA-005 | SMTP ngừng | Dừng MailHog 10 phút | Cảnh báo retry rồi vào DLQ; sau khi phục hồi, gửi lại thành công qua resend | P1 | NFR-AVL-004 |
| TC-PERF-CHA-006 | Inventory ngừng | Dừng service 5 phút | Worker mở circuit breaker, lệnh quét retry; sau phục hồi, chu kỳ trở lại bình thường | P1 | SRS INV §10 |
| TC-PERF-CHA-007 | Mất một replica Gateway | Xóa 1 trong 2 pod | Không request nào lỗi (PDB + readiness) | P1 | NFR-AVL-008 |
| TC-PERF-CHA-008 | Hai scheduler cùng chạy | Scale scheduler lên 3 | Không có lệnh quét trùng | P1 | NFR-AVL-006 |
| TC-PERF-CHA-009 | Độ trễ mạng SSH cao | Thêm 2 giây độ trễ | Quét vẫn thành công trong timeout; độ phủ chu kỳ giảm nhưng KEDA bù bằng worker | P2 | NFR-PERF-005 |
| TC-PERF-CHA-010 | Khôi phục từ backup | Restore `soe_incident` từ bản sao lưu | Dữ liệu đúng tới RPO 15 phút; chuỗi hash audit còn nguyên vẹn | P2 | NFR-AVL-007 |

## 5. Quy trình chạy

```bash
k6 run --vus 30 --duration 5m tests/perf/api_read.js
```

```bash
kubectl -n soe scale deployment/monitoring-worker --replicas=8
```

- Mỗi lần chạy ghi lại: phiên bản build, cấu hình tài nguyên, số replica, kết quả p50/p95/p99, tỷ lệ lỗi, đồ thị Grafana kèm theo.
- Kết quả được so với lần chạy trước; suy giảm > 20% ở bất kỳ chỉ tiêu P1 nào là lỗi chặn phát hành.
