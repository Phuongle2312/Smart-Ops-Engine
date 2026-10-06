---
code: CPU_THERMAL_THROTTLE
title: CPU giảm xung vì nhiệt
---

## Nguyên nhân thường gặp

- Quạt hỏng hoặc bụi bẩn.
- Nhiệt độ phòng máy cao, luồng khí bị cản.
- Keo tản nhiệt khô.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
sensors
dmesg -T | grep -i thermal
cat /sys/devices/system/cpu/cpu0/thermal_throttle/core_throttle_count
```

## Hướng xử lý

1. Kiểm tra quạt, nhiệt độ phòng máy, khe thông gió.
2. Vệ sinh bụi, kiểm tra cảm biến nhiệt.
3. Tạm giảm tải máy cho tới khi nhiệt ổn định.

## Khi nào leo thang

Nhiệt độ CPU >90 °C hoặc máy tự tắt: báo ngay bộ phận cơ điện / nhà cung cấp phần cứng.
