# Audit Service (`AUD`) — M4

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/08_audit.md](../../../../../docs/02_srs/08_audit.md)

## Phạm vi

Nhật ký kiểm toán **chỉ ghi thêm** (append-only): ai làm gì, với đối tượng nào, khi nào, từ đâu.
Dữ liệu đến từ integration event của các service, không từ client.

Thay thế cơ chế `logAudit()` chạy trong `localStorage` của frontend v1 — vốn không có giá trị pháp lý.

## Yêu cầu phụ trách

`FR-AUD-001` … `FR-AUD-010` · `FR-AUD-FE-001` … `FR-AUD-FE-007` · `BR-AUD-001` … `BR-AUD-006`

## Việc cần làm

- [ ] `SOE.Audit.Domain` — `AuditEntry` với chuỗi băm `Hash`/`PrevHash` (tamper-evident)
- [ ] `SOE.Audit.Application` — tra cứu có lọc, dòng thời gian theo đối tượng, kiểm tra toàn vẹn, xuất CSV
- [ ] `SOE.Audit.Infrastructure` — EF Core (`soe_audit`) partition theo tháng; **tài khoản SQL chỉ có INSERT/SELECT**
- [ ] Consumer `audit.all` nhận mọi event nghiệp vụ + `AuditRequestedV1`, ghi theo lô, idempotent
- [ ] Bộ lọc trường nhạy cảm: credential/secret/token luôn thành `"***"`
- [ ] Test: `docs/04_test_cases/TC-08_audit.md` (30 ca)

## Bẫy đã biết

- Lỗi ghi audit **không được** làm hỏng nghiệp vụ chính — cho vào DLQ và cảnh báo vận hành.
- IP và user agent lưu dạng băm có salt (giảm rủi ro dữ liệu cá nhân) nhưng vẫn so khớp được.
- Chỉ ADMIN được đọc; chính hành động tra cứu/xuất cũng phải ghi lại.
