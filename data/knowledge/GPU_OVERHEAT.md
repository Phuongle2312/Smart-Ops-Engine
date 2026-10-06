---
code: GPU_OVERHEAT
title: GPU nhiệt độ cao / thermal slowdown
---

## Nguyên nhân thường gặp

- Quạt GPU lỗi, luồng khí trong case kém.
- Tải liên tục ở công suất tối đa.
- Nhiệt độ phòng máy cao.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
nvidia-smi -q -d TEMPERATURE,PERFORMANCE
nvidia-smi --query-gpu=temperature.gpu,clocks_throttle_reasons.active --format=csv
```

## Hướng xử lý

1. Kiểm tra tốc độ quạt và vệ sinh bụi.
2. Giảm power limit tạm thời (`nvidia-smi -pl <W>`) khi người phụ trách đã cho phép.
3. Cải thiện làm mát phòng máy.

## Khi nào leo thang

GPU >90 °C kéo dài hoặc tự tắt: dừng job và báo bộ phận phần cứng.
