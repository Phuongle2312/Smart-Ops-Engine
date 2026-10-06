---
code: CPU_HIGH_SUSTAINED
title: CPU ~100% kéo dài
---

## Nguyên nhân thường gặp

- Tiến trình chạy vòng lặp / tải tính toán nặng.
- Tác vụ định kỳ (backup, quét virus) chồng giờ cao điểm.
- Bị tấn công hoặc có tiến trình lạ (ví dụ đào coin).

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
top -o %CPU -b -n 1 | head -15
ps aux --sort=-%cpu | head -10
```

## Hướng xử lý

1. Xác định tiến trình chiếm CPU; kiểm tra có đúng là tiến trình hợp lệ.
2. Tiến trình lạ: không tự xóa, báo bộ phận an ninh.
3. Tiến trình hợp lệ: dời lịch chạy, giới hạn bằng `nice`/`cpulimit` hoặc khởi động lại.

## Khi nào leo thang

CPU >90% quá 30 phút hoặc có tiến trình lạ: báo trưởng nhóm hạ tầng và bộ phận an ninh.
