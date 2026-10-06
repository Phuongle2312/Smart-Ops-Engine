---
code: GPU_XID_ERROR
title: NVRM Xid (lỗi driver / phần cứng GPU)
---

## Nguyên nhân thường gặp

- Xid 13/31: lỗi truy cập bộ nhớ trong ứng dụng.
- Xid 48/63/64: lỗi bộ nhớ GPU (phần cứng).
- Xid 79: GPU rơi khỏi bus PCIe.
- Driver không tương thích.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
dmesg -T | grep -i "NVRM: Xid"
nvidia-smi -q | grep -i -E "xid|retired|pending"
```

## Hướng xử lý

1. Ghi lại mã Xid cụ thể trong `dmesg`.
2. Xid 13/31: kiểm tra ứng dụng/CUDA; Xid 48/63/64/79: nghi phần cứng.
3. Khởi động lại GPU hoặc máy trong khung bảo trì.

## Khi nào leo thang

Xid phần cứng (48, 63, 64, 79) hoặc lặp lại: báo nhà cung cấp để thay GPU.
