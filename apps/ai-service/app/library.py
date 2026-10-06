"""Thư viện ảnh lỗi (FR-AI-010) và phản hồi đúng/sai (FR-AI-011)."""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from .preprocess import prepare_image
from .taxonomy import ERROR_TYPES

MANIFEST_HEADER = ["file", "nhan", "tai_nguyen", "nguon", "giay_phep", "ngay_them", "nguoi_gan_nhan"]


def add_image(
    images_dir: Path,
    raw: bytes,
    error_code: str,
    source: str,
    license_: str,
    labeler: str,
    max_mb: int,
    max_side: int,
) -> Path:
    """Lưu ảnh vào <images_dir>/<tài nguyên>/<mã>/<sha256[:16]>.png và ghi manifest.csv."""
    if error_code not in ERROR_TYPES:
        raise ValueError(f"Mã lỗi không thuộc taxonomy: {error_code}")
    etype = ERROR_TYPES[error_code]
    img = prepare_image(raw, max_mb, max_side)

    folder = images_dir / etype.resource.lower() / error_code.lower()
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"{img.sha256[:16]}.png"
    if dest.exists():
        return dest  # ảnh trùng (cùng hash) — không thêm lần nữa
    dest.write_bytes(img.png_bytes)

    manifest = images_dir / "manifest.csv"
    new_file = not manifest.exists() or manifest.stat().st_size == 0
    with manifest.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(MANIFEST_HEADER)
        w.writerow([
            dest.relative_to(images_dir).as_posix(), error_code, etype.resource,
            source, license_, datetime.now(timezone.utc).date().isoformat(), labeler,
        ])
    return dest


def add_feedback(path: Path, diagnosis_id: str, correct: bool, correct_code: str = "", comment: str = "") -> None:
    if not correct and correct_code and correct_code not in ERROR_TYPES:
        raise ValueError(f"Mã lỗi không thuộc taxonomy: {correct_code}")
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "diagnosis_id": diagnosis_id,
        "correct": correct,
        "correct_code": correct_code,
        "comment": comment,
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
