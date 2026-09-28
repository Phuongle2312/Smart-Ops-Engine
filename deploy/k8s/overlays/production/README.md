# k8s/overlays/production

> Trạng thái: 🔜 **Khung** — M5.

Ghi đè lên `../../base` cho môi trường production:

- `replicas` tối thiểu 2, HPA 2–6 cho API; worker KEDA 2–30 theo độ sâu queue
- Secret lấy từ Key Vault qua ExternalSecret, không dùng Secret tĩnh
- Host: `soe.example.com`, HSTS bật, chỉ TLS 1.2+
- Mức log `Information`, sampling trace 10% (100% cho request lỗi)
- Triển khai thủ công có phê duyệt; theo dõi SLO 30 phút sau rollout, tự rollback nếu tỷ lệ lỗi tăng
