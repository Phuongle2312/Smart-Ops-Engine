---
code: RAM_OOM_KILLER
title: Kernel OOM killer kết thúc tiến trình
---

## Nguyên nhân thường gặp

- Tiến trình dùng quá nhiều RAM (rò rỉ bộ nhớ, tải tăng đột biến).
- Giới hạn bộ nhớ của container/cgroup quá thấp.
- Máy không có swap hoặc swap quá nhỏ.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
dmesg -T | grep -i -E "out of memory|oom"
free -h
ps aux --sort=-%mem | head -10
```

## Hướng xử lý

1. Xác định tiến trình bị kill trong `dmesg` và tiến trình đang chiếm nhiều RAM nhất.
2. Khởi động lại dịch vụ bị kill, theo dõi RAM trong 15 phút.
3. Nếu do tải tăng: tăng RAM hoặc giới hạn số worker/kết nối của ứng dụng.
4. Nếu do cgroup: nâng `memory.limit` của container.

## Khi nào leo thang

Lỗi lặp lại trong 24 giờ hoặc dịch vụ quan trọng bị kill: báo trưởng nhóm hạ tầng để xem xét nâng cấp RAM.
