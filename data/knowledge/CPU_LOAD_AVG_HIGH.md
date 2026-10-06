---
code: CPU_LOAD_AVG_HIGH
title: Load average vượt số core
---

## Nguyên nhân thường gặp

- Quá nhiều tiến trình chờ CPU hoặc chờ I/O (đĩa chậm).
- Số worker cấu hình vượt số core.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
uptime
nproc
iostat -x 1 3
```

## Hướng xử lý

1. So sánh load với `nproc`; load > 2×core là bất thường.
2. Nếu `iowait` cao: kiểm tra đĩa; nếu không: giảm số worker.
3. Theo dõi lại sau 15 phút.

## Khi nào leo thang

Load cao kéo dài >1 giờ: xem xét thêm core hoặc tách tải.
