"""OCR (FR-AI-003). RapidOCR là tùy chọn — không có thì trả chuỗi rỗng và service vẫn chạy."""
import io
import logging
from typing import Protocol

log = logging.getLogger(__name__)


class OcrEngine(Protocol):
    available: bool

    def extract(self, png_bytes: bytes) -> str: ...


class NullOcr:
    available = False

    def extract(self, png_bytes: bytes) -> str:
        return ""


class RapidOcrEngine:
    def __init__(self) -> None:
        from rapidocr_onnxruntime import RapidOCR  # import muộn: gói tùy chọn

        self._engine = RapidOCR()
        self.available = True

    def extract(self, png_bytes: bytes) -> str:
        import numpy as np
        from PIL import Image

        arr = np.array(Image.open(io.BytesIO(png_bytes)).convert("RGB"))
        result, _ = self._engine(arr)
        if not result:
            return ""
        return "\n".join(item[1] for item in result)


def build_ocr(enabled: bool) -> OcrEngine:
    if not enabled:
        return NullOcr()
    try:
        return RapidOcrEngine()
    except Exception as exc:  # thiếu gói hoặc không khởi tạo được
        log.warning("OCR không khả dụng (%s) — chỉ dùng vision LLM", exc)
        return NullOcr()
