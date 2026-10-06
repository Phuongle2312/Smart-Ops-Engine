# Smart Ops Engine v3 — Bộ tài liệu đặc tả (.NET Microservices)

> **Phiên bản tài liệu:** 3.0-draft · **Ngày:** 2026-09-21 · **Trạng thái:** Đang soạn (Đợt 1: Tổng quan & Kiến trúc)
>
> Bộ tài liệu này đặc tả **bản build lại** của Smart Ops Engine trên nền **.NET 8 + Microservices**.
> Tài liệu v1 (Spring Boot monolith) vẫn giữ tại [`docs/legacy-v1/SRS`](legacy-v1/SRS/README.md) và [`docs/legacy-v1/test_cases`](legacy-v1/test_cases/README.md) để tham chiếu nghiệp vụ.

---

## 1. Hệ thống là gì?

**Smart Ops Engine (SOE)** giám sát sức khỏe máy chủ (CPU / RAM / Disk) qua SSH theo chu kỳ, phát hiện vượt ngưỡng, quản lý vòng đời sự cố và cảnh báo đa kênh (Email, Webhook: Slack / Teams / Discord / Generic), hiển thị realtime trên dashboard web.

## 2. Tiêu chí thiết kế bắt buộc

| # | Tiêu chí | Hiện thực trong tài liệu |
|---|----------|--------------------------|
| 1 | API bằng **.NET**, bảo vệ API an toàn | ASP.NET Core 8, JWT RS256, RBAC policy, rate limiting, OWASP API Top 10 → [api_gateway_security.md](01_architecture/api_gateway_security.md) |
| 2 | Frontend đáp ứng **hiệu năng** | Performance budget, TanStack Query, code-splitting, virtualization → [frontend_architecture.md](01_architecture/frontend_architecture.md) §4 |
| 3 | Frontend **chống lỗ hổng bảo mật** | Token in-memory, cookie HttpOnly, CSP, chống XSS/CSRF → [frontend_architecture.md](01_architecture/frontend_architecture.md) §5 |
| 4 | Frontend **validate dữ liệu** | react-hook-form + zod, đồng bộ với FluentValidation → [frontend_architecture.md](01_architecture/frontend_architecture.md) §6 |
| 5 | Backend **Microservice** | 8 service + Gateway, database-per-service → [system_architecture.md](01_architecture/system_architecture.md) |
| 6 | **Docker** | Dockerfile multi-stage, docker-compose → [deployment_scaling.md](01_architecture/deployment_scaling.md) |
| 7 | **Queue** | RabbitMQ + MassTransit, outbox, retry, DLQ → [messaging_events.md](01_architecture/messaging_events.md) |
| 8 | **Gateway** | YARP → [api_gateway_security.md](01_architecture/api_gateway_security.md) |
| 9 | **Scale** | Stateless service, Kubernetes HPA, KEDA theo độ dài queue, SignalR Redis backplane → [deployment_scaling.md](01_architecture/deployment_scaling.md) |
| 10 | Cấu trúc theo **SOLID** | Clean Architecture từng service + bảng ánh xạ SOLID → [solid_clean_architecture.md](01_architecture/solid_clean_architecture.md) |

## 3. Mục lục

```
docs/
 ├── README.md                              ← (file này)
 ├── 00_overview/
 │    ├── vision_scope.md                   ← Mục tiêu, phạm vi, stakeholder, ràng buộc
 │    └── glossary.md                       ← Thuật ngữ
 ├── 01_architecture/
 │    ├── system_architecture.md            ← C4, service catalog, luồng chính
 │    ├── solid_clean_architecture.md       ← Cấu trúc solution, layer, SOLID
 │    ├── messaging_events.md               ← RabbitMQ, event catalog, outbox, DLQ
 │    ├── api_gateway_security.md           ← YARP, JWT, RBAC, rate limit, OWASP
 │    ├── data_architecture.md              ← DB-per-service, ERD, retention
 │    ├── deployment_scaling.md             ← Docker, Compose, K8s, HPA/KEDA, CI/CD
 │    ├── observability.md                  ← Log, trace, metric, health, SLO
 │    ├── frontend_architecture.md          ← React: cấu trúc, performance, security, validation
 │    └── nfr.md                            ← Yêu cầu phi chức năng có số đo
 ├── 02_srs/                                ← SRS từng service (01…09)
 ├── 03_usecases/                           ← Use case (UC-01…UC-07)
 ├── 04_test_cases/                         ← Test case theo module + bảo mật/hiệu năng/contract
 └── 05_traceability_matrix.md              ← Ma trận truy vết FR ↔ UC ↔ TC ↔ NFR
```

| Tài liệu | Trạng thái |
|---|---|
| [00_overview/vision_scope.md](00_overview/vision_scope.md) | ✅ Draft |
| [00_overview/glossary.md](00_overview/glossary.md) | ✅ Draft |
| [01_architecture/system_architecture.md](01_architecture/system_architecture.md) | ✅ Draft |
| [01_architecture/solid_clean_architecture.md](01_architecture/solid_clean_architecture.md) | ✅ Draft |
| [01_architecture/messaging_events.md](01_architecture/messaging_events.md) | ✅ Draft |
| [01_architecture/api_gateway_security.md](01_architecture/api_gateway_security.md) | ✅ Draft |
| [01_architecture/data_architecture.md](01_architecture/data_architecture.md) | ✅ Draft |
| [01_architecture/deployment_scaling.md](01_architecture/deployment_scaling.md) | ✅ Draft |
| [01_architecture/observability.md](01_architecture/observability.md) | ✅ Draft |
| [01_architecture/frontend_architecture.md](01_architecture/frontend_architecture.md) | ✅ Draft |
| [01_architecture/nfr.md](01_architecture/nfr.md) | ✅ Draft |
| [02_srs/](02_srs/README.md) — 9 SRS theo service | ✅ Draft |
| [03_usecases/](03_usecases/README.md) — 28 use case | ✅ Draft |
| [04_test_cases/](04_test_cases/README.md) — 9 module + bảo mật/hiệu năng/contract | ✅ Draft |
| [05_traceability_matrix.md](05_traceability_matrix.md) | ✅ Draft |
| [06_workplan.md](06_workplan.md) — phân chia công việc | ✅ |
| [07_huong_dan_chay_thu.md](07_huong_dan_chay_thu.md) — hướng dẫn chạy thử & phiếu ghi kết quả | ✅ |
| [SOE_UseCase_TestCase.xlsx](SOE_UseCase_TestCase.xlsx) — bảng Excel tổng hợp 28 use case (từng bước/luồng) + 532 test case v3 + 141 test case v1, có cột ghi kết quả; sinh bằng `python tools/scripts/build_test_docs.py` | ✅ |

## 4. Quy ước định danh (ID)

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Yêu cầu chức năng | `FR-<MOD>-NNN` | `FR-INV-003` |
| Yêu cầu phi chức năng | `NFR-<LOẠI>-NNN` | `NFR-SEC-010` |
| Quy tắc nghiệp vụ | `BR-<MOD>-NNN` | `BR-INC-002` |
| Use case | `UC-<MOD>-NN` | `UC-INC-03` |
| Test case | `TC-<MOD>-<CẤP>-NNN` | `TC-IDN-API-012` |
| Integration event | `<Tên>V<n>` (PascalCase) | `IncidentOpenedV1` |
| Mã lỗi API | `SOE-<MOD>-NNN` | `SOE-INV-409` |

**Mã module (`<MOD>`):**

| Mã | Module / Service |
|---|---|
| `IDN` | Identity Service — xác thực, người dùng, phân quyền |
| `INV` | Inventory Service — quản lý Node |
| `MON` | Monitoring Service — lập lịch & thu thập metric |
| `MET` | Metrics Service — lưu trữ & truy vấn lịch sử |
| `INC` | Incident Service — ngưỡng, phát hiện & vòng đời sự cố |
| `NTF` | Notification Service — kênh cảnh báo, email, webhook |
| `RTM` | Realtime Service — SignalR |
| `AUD` | Audit Service — nhật ký kiểm toán |
| `GW` | API Gateway & cấu hình hệ thống |
| `FE` | Yêu cầu chung phía Frontend |

**Loại NFR:** `PERF` (hiệu năng) · `SCL` (khả năng mở rộng) · `AVL` (sẵn sàng/tin cậy) · `SEC` (bảo mật) · `MNT` (bảo trì) · `OBS` (quan sát) · `USA` (khả dụng/UX) · `CMP` (tương thích).

**Cấp test (`<CẤP>`):** `UNIT` · `INT` (integration, Testcontainers) · `API` (qua Gateway) · `CON` (contract/messaging) · `E2E` (Playwright) · `SEC` · `PERF`.

**Mức ưu tiên (MoSCoW):** `Must` · `Should` · `Could` · `Won't (v3)`.

## 5. Quy ước viết

- Nội dung, label UI, thông báo lỗi hiển thị cho người dùng: **tiếng Việt**.
- Tên class, API, biến, event, cột DB: **tiếng Anh**.
- Thời gian lưu và truyền dưới dạng **UTC ISO-8601** (`2026-09-21T08:30:00Z`); FE hiển thị theo múi giờ người dùng (mặc định `Asia/Ho_Chi_Minh`).
- Sơ đồ dùng **Mermaid** (xem được trên GitHub / VS Code Markdown Preview).
