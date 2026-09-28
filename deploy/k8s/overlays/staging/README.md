# k8s/overlays/staging

> Trạng thái: 🔜 **Khung** — M5.

Ghi đè lên `../../base` cho môi trường staging:

- `replicas`: 2 cho mọi service; worker `minReplicaCount: 2`, `maxReplicaCount: 10`
- Tài nguyên thấp hơn production
- Host: `soe-staging.example.com`
- Mức log `Debug` cho service đang theo dõi; bật sampling trace 100%
- Dữ liệu ẩn danh, dùng cho kiểm thử hiệu năng và quét DAST trước mỗi release
