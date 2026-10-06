"""Điều phối chẩn đoán: tiền xử lý → OCR → luật → (vision) → hợp nhất → runbook (FR-AI-001..008)."""
import time
import uuid
from dataclasses import asdict, dataclass, field

from .config import Settings
from .knowledge import KnowledgeBase
from .ocr import OcrEngine
from .preprocess import prepare_image
from .rules import classify_text
from .taxonomy import get_type
from .vision import VisionClassifier, VisionResult, VisionUnavailable


@dataclass
class Diagnosis:
    diagnosis_id: str
    image_sha256: str
    node_id: str
    error_code: str
    resource: str
    severity: str
    confidence: float
    decision: str
    source: str
    evidence: list[str]
    ocr_text: str
    runbook: dict | None
    related: list[dict]
    warnings: list[str] = field(default_factory=list)
    elapsed_ms: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def decide(confidence: float, code: str, cfg: Settings) -> str:
    if code == "UNKNOWN" or confidence < cfg.threshold_review:
        return "unknown"
    return "auto_notify" if confidence >= cfg.threshold_auto else "needs_review"


def calibrate_vision(vision: VisionResult, weight: float) -> VisionResult:
    """Quy đổi confidence tự báo của vision (không hiệu chỉnh) về mức dùng để quyết định."""
    if vision.code == "UNKNOWN":
        return vision
    effective = round(vision.confidence * weight, 2)
    note = f"Vision tự báo {round(vision.confidence * 100)}%, quy đổi {round(effective * 100)}% (hệ số {weight})"
    return VisionResult(vision.code, effective, vision.evidence + [note])


def merge(rule, vision, warnings: list[str]) -> tuple[str, float, str]:
    """Hợp nhất kết quả luật và vision (FR-AI-006). Trả (mã, độ tin cậy, nguồn)."""
    if vision and vision.code == "UNKNOWN":
        # Vision không nhận ra: giữ kết quả luật nếu có, không coi là "bất đồng"
        return (rule.code, rule.confidence, "rules") if rule else ("UNKNOWN", 0.0, "vision")
    if rule and not vision:
        return rule.code, rule.confidence, "rules"
    if vision and not rule:
        return vision.code, vision.confidence, "vision"
    if not rule and not vision:
        return "UNKNOWN", 0.0, "none"
    if rule.code == vision.code:
        # Hai nguồn độc lập cùng kết luận: gộp xác suất kiểu noisy-or, 1 - (1-a)(1-b)
        combined = 1 - (1 - rule.confidence) * (1 - vision.confidence)
        return rule.code, round(min(1.0, combined), 2), "rules+vision"
    warnings.append(f"Luật ({rule.code}) và vision ({vision.code}) không thống nhất")
    winner, src = (rule, "rules") if rule.confidence >= vision.confidence else (vision, "vision")
    return winner.code, round(winner.confidence * 0.8, 2), src


class DiagnosisPipeline:
    def __init__(self, cfg: Settings, ocr: OcrEngine, vision: VisionClassifier | None, kb: KnowledgeBase) -> None:
        self._cfg = cfg
        self._ocr = ocr
        self._vision = vision
        self._kb = kb

    def run(self, raw_image: bytes, node_id: str = "", note: str = "") -> Diagnosis:
        started = time.monotonic()
        cfg = self._cfg
        img = prepare_image(raw_image, cfg.max_image_mb, cfg.max_image_side)
        warnings: list[str] = []

        text = self._ocr.extract(img.png_bytes) if self._ocr.available else ""
        if not self._ocr.available:
            warnings.append("OCR không khả dụng — chỉ dùng vision")
        rule = classify_text(f"{text}\n{note}")

        vision = None
        if (not rule or rule.confidence < cfg.threshold_auto) and self._vision is not None:
            try:
                vision = calibrate_vision(self._vision.classify(img.png_bytes, text, note), cfg.vision_weight)
            except VisionUnavailable as exc:
                warnings.append(f"Vision không khả dụng: {exc}")
        elif self._vision is None and (not rule or rule.confidence < cfg.threshold_auto):
            warnings.append("Vision đang tắt")

        evidence = (rule.evidence if rule else []) + (vision.evidence if vision else [])
        code, confidence, source = merge(rule, vision, warnings)
        etype = get_type(code)
        runbook = self._kb.runbook(code)
        query = f"{etype.description} {text[:500]} {note}"
        own_title = runbook.title if runbook else None
        related = (
            [asdict(r) for r in self._kb.related(query, k=4) if r.title != own_title][:3]
            if code != "UNKNOWN" else []
        )

        return Diagnosis(
            diagnosis_id=str(uuid.uuid4()),
            image_sha256=img.sha256,
            node_id=node_id,
            error_code=etype.code,
            resource=etype.resource,
            severity=etype.severity,
            confidence=round(confidence, 2),
            decision=decide(confidence, etype.code, cfg),
            source=source,
            evidence=evidence,
            ocr_text=text,
            runbook={"code": runbook.code, "title": runbook.title, "content": runbook.content} if runbook else None,
            related=related,
            warnings=warnings,
            elapsed_ms=int((time.monotonic() - started) * 1000),
        )
