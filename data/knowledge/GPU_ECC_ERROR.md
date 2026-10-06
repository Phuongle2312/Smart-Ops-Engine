---
code: GPU_ECC_ERROR
title: Lỗi ECC bộ nhớ GPU
---

## Nguyên nhân thường gặp

- Lỗi ECC có thể sửa được tích lũy: bộ nhớ GPU đang xuống cấp.
- Lỗi ECC không sửa được: nguy cơ sai kết quả, GPU có thể bị loại khỏi dịch vụ.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
nvidia-smi -q -d ECC
nvidia-smi --query-gpu=ecc.errors.uncorrected.volatile.total --format=csv
```

## Hướng xử lý

1. Ghi lại số lỗi corrected/uncorrected.
2. Dừng job quan trọng trên GPU có lỗi uncorrected.
3. Reset GPU để xóa lỗi volatile; nếu lỗi quay lại là lỗi phần cứng.

## Khi nào leo thang

Có lỗi uncorrected hoặc page retirement: báo nhà cung cấp để thay GPU.
