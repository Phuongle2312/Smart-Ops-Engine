---
code: RAM_SWAP_HIGH
title: Swap sử dụng cao
---

## Nguyên nhân thường gặp

- RAM thật gần đầy nên kernel đẩy sang swap, hệ thống chậm.
- Tiến trình nền chiếm RAM bất thường.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
free -h
vmstat 1 5
swapon --show
```

## Hướng xử lý

1. Tìm tiến trình chiếm RAM/swap nhiều nhất.
2. Dừng hoặc khởi động lại tiến trình bất thường.
3. Sau khi RAM ổn định, xả swap bằng `swapoff -a && swapon -a` (chỉ khi RAM trống đủ lớn).

## Khi nào leo thang

Swap vẫn >80% sau khi xử lý: lên kế hoạch nâng RAM.
