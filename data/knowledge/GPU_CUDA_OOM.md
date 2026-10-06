---
code: GPU_CUDA_OOM
title: CUDA out of memory
---

## Nguyên nhân thường gặp

- Batch size / kích thước mô hình vượt VRAM.
- Nhiều tiến trình cùng dùng một GPU.
- Tiến trình cũ treo, giữ VRAM.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
nvidia-smi
nvidia-smi --query-compute-apps=pid,used_memory --format=csv
```

## Hướng xử lý

1. Xem tiến trình nào đang giữ VRAM; dừng tiến trình treo.
2. Giảm batch size, dùng mixed precision hoặc gradient checkpointing.
3. Phân lại job sang GPU khác còn trống.

## Khi nào leo thang

VRAM đầy dù không có job nào chạy: nghi lỗi driver, báo quản trị GPU.
