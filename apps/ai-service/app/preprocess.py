"""Tiền xử lý ảnh: kiểm tra hợp lệ, đổi RGB, thu nhỏ, tính SHA-256 (FR-AI-002)."""
import hashlib
import io
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP"}


class InvalidImageError(ValueError):
    pass


@dataclass
class PreparedImage:
    sha256: str
    png_bytes: bytes
    width: int
    height: int


def prepare_image(raw: bytes, max_mb: int, max_side: int) -> PreparedImage:
    if not raw:
        raise InvalidImageError("Ảnh rỗng")
    if len(raw) > max_mb * 1024 * 1024:
        raise InvalidImageError(f"Ảnh vượt quá {max_mb} MB")
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = img.format
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("Không đọc được ảnh") from exc
    if fmt not in ALLOWED_FORMATS:
        raise InvalidImageError(f"Định dạng {fmt} không được hỗ trợ (chỉ PNG/JPEG/WEBP)")

    img = img.convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return PreparedImage(
        sha256=hashlib.sha256(raw).hexdigest(),
        png_bytes=buf.getvalue(),
        width=img.width,
        height=img.height,
    )
