---
code: RAM_LEAK
title: Bộ nhớ tăng liên tục (nghi rò rỉ)
---

## Nguyên nhân thường gặp

- Ứng dụng giữ tham chiếu không giải phóng.
- Tiến trình chạy lâu không khởi động lại.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
ps -o pid,rss,etime,cmd -p <pid>
watch -n 60 "ps -o rss= -p <pid>"
```

## Hướng xử lý

1. Ghi lại RSS theo thời gian để xác nhận xu hướng tăng.
2. Khởi động lại dịch vụ để giải phóng bộ nhớ.
3. Báo nhóm phát triển kèm biểu đồ RAM.

## Khi nào leo thang

Cần restart định kỳ để duy trì dịch vụ: tạo ticket cho nhóm phát triển.
