# Inventory Service (`INV`) — M2

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/02_inventory.md](../../../../../docs/02_srs/02_inventory.md)

## Phạm vi

Sở hữu danh mục Node: thông tin kết nối SSH, credential (mã hóa AES-256-GCM), cờ giám sát, host key
đã ghim, tag. Là **nơi duy nhất** được giải mã credential và chỉ cấp cho Monitoring Worker qua API
nội bộ có mTLS.

## Yêu cầu phụ trách

`FR-INV-001` … `FR-INV-017` (backend) · `FR-INV-FE-001` … `FR-INV-FE-009` (giao diện Nodes)
· Quy tắc nghiệp vụ `BR-INV-001` … `BR-INV-008`

## Việc cần làm

- [ ] `SOE.Inventory.Domain` — `Node` (aggregate), `NodeCredential`, VO `HostAddress`/`SshPort`, domain event
- [ ] `SOE.Inventory.Application` — CRUD node, toggle giám sát, test kết nối, ghim host key, danh sách có lọc/phân trang
- [ ] `SOE.Inventory.Infrastructure` — EF Core (`soe_inventory`), `ICredentialProtector` (AES-256-GCM, có key versioning), `ISshConnectionTester` (SSH.NET)
- [ ] `SOE.Inventory.Api` — endpoint công khai + `/internal/nodes/{id}/credentials` (mTLS, scope riêng, ghi audit mỗi lần gọi)
- [ ] Contracts: `NodeCreatedV1`, `NodeUpdatedV1`, `NodeMonitoringToggledV1`, `NodeDeletedV1`
- [ ] Test: `tests/SOE.Inventory.UnitTests` theo `docs/04_test_cases/TC-02_inventory.md`

## Bẫy đã biết (rút từ v1)

- Chỉ mã hóa credential tại **một điểm** trong Infrastructure — không encrypt thủ công ở controller (lỗi double-encrypt của v1).
- Không dùng `StrictHostKeyChecking=no`: fingerprint khác bản đã ghim thì từ chối kết nối.
- `(host, port)` phải unique trong các node chưa xóa; xóa node là soft delete nhưng **xóa cứng bản ghi credential**.
