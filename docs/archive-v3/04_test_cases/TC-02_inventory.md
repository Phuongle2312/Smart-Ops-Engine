# TC-02 — Inventory Service (`INV`)

> SRS: [02_inventory.md](../02_srs/02_inventory.md) · Use case: [UC-02_node.md](../03_usecases/UC-02_node.md)

## 1. Backend — API, bảo mật & CSDL

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INV-API-001 | Tạo node bằng mật khẩu | ADMIN đăng nhập | `POST /api/v1/nodes` | `{"name":"prod-app-02","host":"192.168.1.15","port":22,"username":"deploy","authType":"PASSWORD","password":"secret123"}` | 201 + `Location`; response **không** có `password`/`sshKey`; có `hasCredential=true` | Functional | P1 | FR-INV-001, 004 |
| TC-INV-API-002 | Credential được mã hóa AES-GCM | TC-001 vừa chạy | Truy vấn bảng `NodeCredentials` | — | `SecretCipher` là nhị phân, có `KeyId`, không chứa chuỗi `secret123`; hai node cùng mật khẩu có ciphertext khác nhau (nonce ngẫu nhiên) | Security | P1 | FR-INV-003, NFR-SEC-003 |
| TC-INV-API-003 | Không double-encrypt | Node vừa tạo | Chạy `test-connection` | — | Kết nối thành công ⇒ credential giải mã ra đúng plaintext (lỗi v1 không tái diễn) | Regression | P1 | FR-INV-003 |
| TC-INV-API-004 | Tạo node bằng SSH key | ADMIN | `POST /nodes` với `authType=SSH_KEY` | private key hợp lệ | 201; key được mã hóa; response không chứa key | Functional | P1 | FR-INV-001 |
| TC-INV-API-005 | Trùng host:port | Đã có node `192.168.1.10:22` | `POST /nodes` cùng host+port | — | 409 `SOE-INV-409`, thông báo “Đã có node sử dụng 192.168.1.10:22.” | Validation | P1 | FR-INV-002 |
| TC-INV-API-006 | Cùng host khác port | Đã có `192.168.1.10:22` | `POST /nodes` port 2222 | — | 201 (hợp lệ) | Functional | P2 | BR-INV-002 |
| TC-INV-API-007 | Trùng tên node | Đã có `prod-web-01` | `POST /nodes` cùng tên | — | 409 `SOE-INV-410` | Validation | P2 | BR-INV-002 |
| TC-INV-API-008 | Thiếu trường bắt buộc | — | `POST /nodes` thiếu `name`, `host` | `{"port":22}` | 400 với `errors.name`, `errors.host` bằng tiếng Việt | Validation | P1 | SRS §6 |
| TC-INV-API-009 | Port ngoài phạm vi | — | `POST /nodes` | `port: 70000` | 400 “Port phải nằm trong khoảng 1–65535” | Validation | P1 | SRS §6 |
| TC-INV-API-010 | Host chứa ký tự shell | — | `POST /nodes` | `host: "1.2.3.4; rm -rf /"` | 400; không có lệnh nào được thực thi | Security | P1 | BR-INV-001 |
| TC-INV-API-011 | Thiếu credential khi tạo | — | `POST /nodes` không password/sshKey | — | 400 “Chọn Password hoặc SSH Key và nhập giá trị” | Validation | P1 | BR-INV-003 |
| TC-INV-API-012 | Trường lạ trong body | — | `POST /nodes` thêm `"isAdmin": true` | — | 400 (UnmappedMemberHandling = Disallow) — chống mass assignment | Security | P1 | OWASP API3 |
| TC-INV-API-013 | Mount path không hợp lệ | — | `POST /nodes` | `diskMountPath: "/tmp; ls"` | 400 | Security | P1 | BR-INV-007 |
| TC-INV-API-014 | Danh sách có phân trang | ≥ 25 node | `GET /nodes?page=2&pageSize=10` | — | 200; đúng `totalItems`, `totalPages`; không có trường credential | Functional | P1 | FR-INV-012 |
| TC-INV-API-015 | `pageSize` vượt giới hạn | — | `GET /nodes?pageSize=1000` | — | 400 hoặc tự giới hạn 100 (theo hợp đồng) | Security | P2 | OWASP API4 |
| TC-INV-API-016 | Tìm kiếm & lọc | Có node tag `env=prod` | `GET /nodes?search=web&tag=env:prod&isActive=true` | — | Chỉ trả node khớp mọi điều kiện | Functional | P2 | FR-INV-012, 013 |
| TC-INV-API-017 | Chi tiết node | Node tồn tại | `GET /nodes/{id}` | — | 200, đủ thông tin, không có credential | Functional | P1 | FR-INV-004 |
| TC-INV-API-018 | Node không tồn tại | — | `GET /nodes/{guid-lạ}` | — | 404 `SOE-INV-404` | Functional | P2 | — |
| TC-INV-API-019 | Sửa node giữ nguyên credential | Node có mật khẩu | `PUT /nodes/{id}` đổi tên, không gửi password | — | 200; `test-connection` vẫn thành công ⇒ credential cũ còn nguyên | Functional | P1 | FR-INV-005 |
| TC-INV-API-020 | Đổi credential | Node tồn tại | `PUT /nodes/{id}` với `changeCredential:true` + mật khẩu mới | — | 200; ciphertext thay đổi; kết nối dùng mật khẩu mới | Functional | P1 | FR-INV-005 |
| TC-INV-API-021 | Đổi host xóa fingerprint | Node đã ghim host key | `PUT /nodes/{id}` đổi host | — | `hostKeyFingerprint` = null, cần ghim lại | Security | P2 | UC-INV-02/A2 |
| TC-INV-API-022 | Sửa cờ giám sát | Node tồn tại | `PUT /nodes/{id}` `monitorCpu:false` | — | 200; `NodeUpdatedV1.changedFields` chứa `monitorCpu`; Monitoring ngừng thu CPU | Integration | P2 | FR-INV-008 |
| TC-INV-API-023 | Chu kỳ riêng ngoài phạm vi | — | `PUT /nodes/{id}` `checkIntervalSeconds: 10` | — | 400 “Chu kỳ quét từ 60 đến 3600 giây” | Validation | P2 | FR-INV-009 |
| TC-INV-API-024 | Xung đột chỉnh sửa đồng thời | Hai request cùng lúc | `PUT` hai lần với `rowVersion` cũ | — | Request sau nhận 409 | Reliability | P2 | D2 |
| TC-INV-API-025 | Bật/tắt giám sát | Node active | `PUT /nodes/{id}/monitoring` `{isActive:false}` | — | 200; phát `NodeMonitoringToggledV1`; node không còn trong lệnh quét chu kỳ sau | Functional | P1 | FR-INV-006 |
| TC-INV-API-026 | OPERATOR bật/tắt được | Đăng nhập OPERATOR | như trên | — | 200 | Security | P2 | RBAC |
| TC-INV-API-027 | VIEWER bật/tắt bị chặn | Đăng nhập VIEWER | như trên | — | 403 | Security | P1 | NFR-SEC-008 |
| TC-INV-API-028 | Xóa node (soft delete) | Node có sự cố & metric | `DELETE /nodes/{id}` | — | 204; `DeletedAt` khác null; bản ghi credential bị xóa cứng; lịch sử metric/sự cố vẫn truy vấn được | Functional | P1 | FR-INV-007, BR-INV-004 |
| TC-INV-API-029 | Xóa rồi tạo lại cùng host | Node đã xóa | `POST /nodes` cùng host:port | — | 201 (ràng buộc unique chỉ áp dụng cho node chưa xóa) | Functional | P2 | BR-INV-002 |
| TC-INV-API-030 | OPERATOR tạo node | Đăng nhập OPERATOR | `POST /nodes` | — | 403 | Security | P1 | NFR-SEC-008 |
| TC-INV-API-031 | Kiểm tra kết nối thành công | `node-ok` | `POST /nodes/{id}/test-connection` | — | 200 `{success:true, durationMs, fingerprint}` | Functional | P1 | FR-INV-010 |
| TC-INV-API-032 | Kiểm tra kết nối sai mật khẩu | `node-authfail` | như trên | — | 200 `{success:false, failureKind:"AuthFailed"}`; thông báo **không** chứa mật khẩu | Security | P1 | FR-INV-010 |
| TC-INV-API-033 | Kiểm tra kết nối timeout | `node-timeout` | như trên | — | `failureKind:"ConnectTimeout"`, thời gian ≈ 10 giây | Reliability | P2 | FR-MON-008 |
| TC-INV-API-034 | Rate limit test-connection | ADMIN | Gọi 11 lần/phút | — | Lần thứ 11 trả 429 | Security | P2 | OWASP API6 |
| TC-INV-API-035 | API nội bộ lấy credential — có scope | Token client-credentials đúng scope | `GET /internal/nodes/{id}/credentials` | — | 200 với secret giải mã; audit ghi `CREDENTIAL_ACCESSED` | Security | P1 | FR-INV-014 |
| TC-INV-API-036 | API nội bộ — token người dùng | Bearer token của ADMIN | như trên | — | 403 (chỉ chấp nhận token dịch vụ có scope) | Security | P1 | FR-INV-014 |
| TC-INV-API-037 | API nội bộ không lộ ra Gateway | — | `GET /api/v1/internal/nodes/{id}/credentials` qua Gateway | — | 404 (route không khai báo) | Security | P1 | FR-GW-001 |
| TC-INV-INT-001 | Event khi tạo node | Test harness | Tạo node | — | `NodeCreatedV1` publish đúng một lần sau commit; nội dung không chứa credential | Integration | P1 | FR-INV-015, ADR-04 |
| TC-INV-INT-002 | Outbox khi transaction thất bại | Ép lỗi sau khi ghi | Tạo node lỗi | — | Không có node, **không** có event nào được publish | Reliability | P1 | NFR-AVL-002 |
| TC-INV-INT-003 | Xoay khóa mã hóa | Có `KeyId=K1` | Thêm `K2`, chạy job mã hóa lại | — | Bản ghi chuyển sang `K2`, giải mã vẫn đúng, không downtime | Security | P2 | FR-INV-016 |
| TC-INV-SEC-001 | Log không chứa credential | — | Tạo node + quét, đọc log | — | Không tìm thấy mật khẩu/private key trong log của mọi service | Security | P1 | NFR-SEC-007 |
| TC-INV-SEC-002 | Host key khác bản ghim bị chặn | `node-hostkey` đã ghim | Đổi host key trên máy chủ rồi quét | — | Kết nối bị hủy **trước** khi gửi credential; `failureKind=HostKeyMismatch`; sự cố `HOST_KEY_MISMATCH` mở | Security | P1 | FR-INV-011, BR-INV-006 |
| TC-INV-SEC-003 | Ghim lại host key cần ADMIN | Sự cố host key đang mở | OPERATOR gọi `POST /nodes/{id}/host-key/pin` | — | 403; ADMIN gọi → 204 + audit `NODE_HOSTKEY_PINNED` | Security | P1 | UC-INV-05 |
| TC-INV-SEC-004 | BOLA — truy cập node bằng id đoán | Đăng nhập VIEWER | `GET /nodes/{id}` của node bất kỳ | — | 200 (VIEWER được xem) nhưng `PUT/DELETE` → 403; id là GUID không đoán tuần tự được | Security | P1 | OWASP API1 |

## 2. Frontend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INV-E2E-001 | Hiển thị danh sách node | Có ≥ 5 node | Mở `/app/nodes` | — | Bảng hiển thị tên (link), host monospace, port badge, thanh CPU/RAM/Disk có màu + nhãn chữ, công tắc giám sát | UI/UX | P1 | FR-INV-FE-001 |
| TC-INV-E2E-002 | Màu thanh tiến trình theo ngưỡng | Node có Disk 45 / 85 / 92 | Quan sát | — | Lần lượt xanh / vàng / đỏ, kèm nhãn “Bình thường / Cảnh báo / Nguy cấp” | UI/UX | P2 | FR-INV-FE-001, NFR-USA-004 |
| TC-INV-E2E-003 | Mở modal thêm node | ADMIN | Bấm “Thêm máy chủ” | — | Modal mở, tab Password active, 3 checkbox giám sát bật, focus ở ô đầu tiên, đóng được bằng `Esc` | UI/UX | P1 | FR-INV-FE-003 |
| TC-INV-E2E-004 | Chuyển tab xác thực | Modal mở | Bấm tab SSH Key rồi quay lại | — | Trường hiển thị đúng theo tab; giá trị đã nhập không bị mất ngoài ý muốn | Functional | P2 | FR-INV-FE-003 |
| TC-INV-E2E-005 | Validate client | Modal mở | Nhập tên rỗng, host `abc def`, port `70000`, bấm Lưu | — | 3 lỗi tiếng Việt hiển thị dưới từng ô; không có request nào được gửi | Validation | P1 | FR-INV-FE-004 |
| TC-INV-E2E-006 | Lỗi 409 map vào field | Có node trùng host | Nhập host trùng, Lưu | — | Lỗi hiển thị dưới ô Host (không chỉ toast) | Validation | P1 | FR-INV-FE-004 |
| TC-INV-E2E-007 | Kiểm tra kết nối trong modal | Modal mở với thông tin `node-ok` | Bấm “Kiểm tra kết nối” | — | Hiện trạng thái đang thử rồi kết quả thành công kèm thời gian | Functional | P2 | FR-INV-FE-005 |
| TC-INV-E2E-008 | Thêm node thành công | Modal hợp lệ | Bấm Lưu | — | Modal đóng; node xuất hiện ở bảng; toast “Đã thêm máy chủ …” | Functional | P1 | UC-INV-01 |
| TC-INV-E2E-009 | Sửa node không đổi mật khẩu | Node có credential | Mở modal sửa, đổi tên, Lưu | — | Ô mật khẩu hiển thị `••••••••`; request **không** chứa trường password; tên cập nhật | Security | P1 | FR-INV-FE-003 |
| TC-INV-E2E-010 | Gạt công tắc giám sát | OPERATOR | Gạt tắt | — | Cập nhật optimistic; chỉ số chuyển “Đang tắt”; toast; API lỗi thì rollback | Functional | P1 | FR-INV-FE-008 |
| TC-INV-E2E-011 | Xác nhận xóa node | ADMIN | Bấm biểu tượng thùng rác | — | Hộp thoại nêu tên node + hệ quả, nút Xóa màu đỏ, Hủy đóng không thay đổi | UI/UX | P1 | FR-INV-FE-007 |
| TC-INV-E2E-012 | Xóa node thành công | Hộp thoại mở | Bấm Xóa | — | Hàng biến mất, toast, danh sách không cần tải lại thủ công | Functional | P1 | UC-INV-04 |
| TC-INV-E2E-013 | Cảnh báo host key đổi | Node có sự cố host key | Mở trang node | — | Cảnh báo đỏ giải thích rủi ro; xác nhận ghim lại yêu cầu gõ đúng tên node | Security | P1 | FR-INV-FE-006 |
| TC-INV-E2E-014 | Quyền hiển thị | Đăng nhập VIEWER | Mở `/app/nodes` | — | Không thấy nút Thêm/Sửa/Xóa và công tắc | Security | P1 | FR-INV-FE-009 |
| TC-INV-E2E-015 | Tìm kiếm có debounce | ≥ 100 node | Gõ nhanh 8 ký tự | — | Chỉ ~1 request được gửi sau khi ngừng gõ 300 ms | Performance | P2 | FR-INV-FE-002 |
| TC-INV-E2E-016 | Bộ lọc lưu trong URL | Đang lọc | Sao chép URL, mở tab mới | — | Bộ lọc được khôi phục nguyên trạng | UI/UX | P3 | FR-INV-FE-002 |
| TC-INV-E2E-017 | Virtualization bảng lớn | 1.000 node | Cuộn bảng | — | DOM chỉ giữ ~30–50 hàng; cuộn mượt ≥ 50 fps | Performance | P2 | NFR-PERF-024 |
