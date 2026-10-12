# Ảnh lỗi mẫu

Ảnh lấy từ Wikimedia Commons (nguồn + giấy phép trong `manifest.csv`). Ảnh GPL / CC BY / CC BY-SA cần ghi nguồn khi phân phối lại.

Cột `nhan` để trống: các ảnh này **chưa khớp mã lỗi** trong `apps/ai-service/app/taxonomy.py` (là memtest, htop, kernel panic, BSOD…),
nên chưa dùng làm đáp án chuẩn cho `benchmark.py`. Gán nhãn thủ công hoặc qua `POST /library/images` khi có ảnh đúng loại
(CUDA OOM, OOM killer, Xid…) — nên chụp từ máy thật.
