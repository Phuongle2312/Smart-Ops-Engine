---
code: RAM_JAVA_HEAP
title: Java OutOfMemoryError (heap / GC overhead)
---

## Nguyên nhân thường gặp

- Heap (`-Xmx`) nhỏ hơn nhu cầu thực tế.
- Rò rỉ đối tượng (cache không giới hạn, listener không gỡ).
- GC overhead limit exceeded: ứng dụng dành gần hết thời gian cho GC.

## Lệnh chẩn đoán (chạy trực tiếp tại máy)

```
jcmd <pid> GC.heap_info
jmap -histo:live <pid> | head -20
grep -i -E "Xmx|Xms" /proc/<pid>/cmdline
```

## Hướng xử lý

1. Lấy heap dump (`jcmd <pid> GC.heap_dump file.hprof`) trước khi khởi động lại.
2. Khởi động lại dịch vụ để khôi phục.
3. Tăng `-Xmx` tạm thời nếu máy còn RAM trống.
4. Chuyển heap dump cho nhóm phát triển phân tích rò rỉ.

## Khi nào leo thang

Lặp lại sau khi tăng heap: chuyển nhóm phát triển, vì nhiều khả năng là lỗi ứng dụng.
