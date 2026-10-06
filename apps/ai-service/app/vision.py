"""Vision LLM nội bộ qua Ollama (FR-AI-005)."""
import base64
import json
import logging
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from .taxonomy import ERROR_TYPES

log = logging.getLogger(__name__)


@dataclass
class VisionResult:
    code: str
    confidence: float
    evidence: list[str] = field(default_factory=list)


class VisionClassifier(Protocol):
    def classify(self, png_bytes: bytes, ocr_text: str = "", note: str = "") -> VisionResult: ...


class VisionUnavailable(RuntimeError):
    """Ollama lỗi / timeout / trả dữ liệu không dùng được."""


def build_prompt(ocr_text: str, note: str) -> str:
    codes = "\n".join(f"- {t.code}: {t.description}" for t in ERROR_TYPES.values())
    parts = [
        "Bạn là kỹ sư vận hành hệ thống. Đây là ảnh chụp màn hình / biểu đồ báo lỗi của một máy chủ.",
        "Xác định ảnh thuộc loại lỗi nào trong danh sách sau (chỉ chọn MỘT mã):",
        codes,
        "- UNKNOWN: không thuộc loại nào ở trên hoặc không đủ thông tin",
        'Chỉ trả về JSON: {"error_code": "<mã>", "confidence": <0..1>, "evidence": ["<chữ/số nhìn thấy trong ảnh>"]}',
        "Không bịa; nếu không chắc hãy trả UNKNOWN với confidence thấp.",
    ]
    if ocr_text.strip():
        parts.append(f"Văn bản OCR (có thể sai sót):\n{ocr_text[:1500]}")
    if note.strip():
        parts.append(f"Ghi chú của người báo: {note[:300]}")
    return "\n".join(parts)


def parse_vision_json(content: str) -> VisionResult:
    """Chuẩn hóa JSON do mô hình trả; mã ngoài taxonomy → UNKNOWN."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise VisionUnavailable("Mô hình không trả JSON hợp lệ") from exc
    if not isinstance(data, dict):
        raise VisionUnavailable("JSON của mô hình không phải object")
    code = str(data.get("error_code", "UNKNOWN")).strip().upper()
    if code not in ERROR_TYPES:
        code = "UNKNOWN"
    try:
        conf = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        conf = 0.0
    conf = max(0.0, min(1.0, conf))
    evidence = data.get("evidence") or []
    if not isinstance(evidence, list):
        evidence = [str(evidence)]
    return VisionResult(code, conf, [f"Vision: {str(e)[:200]}" for e in evidence[:5]])


class OllamaVision:
    def __init__(self, base_url: str, model: str, timeout_s: float) -> None:
        self._url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_s

    def classify(self, png_bytes: bytes, ocr_text: str = "", note: str = "") -> VisionResult:
        payload = {
            "model": self._model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
            "messages": [
                {
                    "role": "user",
                    "content": build_prompt(ocr_text, note),
                    "images": [base64.b64encode(png_bytes).decode()],
                }
            ],
        }
        try:
            resp = httpx.post(f"{self._url}/api/chat", json=payload, timeout=self._timeout)
            resp.raise_for_status()
            content = resp.json()["message"]["content"]
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise VisionUnavailable(f"Ollama lỗi: {exc}") from exc
        return parse_vision_json(content)

    def ping(self) -> bool:
        try:
            return httpx.get(f"{self._url}/api/tags", timeout=3).status_code == 200
        except httpx.HTTPError:
            return False
