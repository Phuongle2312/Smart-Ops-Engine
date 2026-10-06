import pytest

from app.ocr import NullOcr
from app.pipeline import DiagnosisPipeline
from app.preprocess import InvalidImageError
from app.vision import VisionResult, VisionUnavailable


class FakeOcr:
    available = True

    def __init__(self, text):
        self.text = text

    def extract(self, png_bytes):
        return self.text


class FakeVision:
    def __init__(self, result=None, error=False):
        self.result, self.error, self.calls = result, error, 0

    def classify(self, png_bytes, ocr_text="", note=""):
        self.calls += 1
        if self.error:
            raise VisionUnavailable("down")
        return self.result


def run(cfg, kb, png, ocr, vision, note=""):
    return DiagnosisPipeline(cfg, ocr, vision, kb).run(png, "srv-01", note)


def test_strong_rule_skips_vision(cfg, kb, png_bytes):
    vision = FakeVision(VisionResult("RAM_LEAK", 0.9))
    d = run(cfg, kb, png_bytes, FakeOcr("RuntimeError: CUDA out of memory"), vision)
    assert d.error_code == "GPU_CUDA_OOM" and d.decision == "auto_notify" and d.source == "rules"
    assert vision.calls == 0
    assert d.runbook and d.runbook["code"] == "GPU_CUDA_OOM"


def test_vision_used_when_no_ocr_text(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, NullOcr(), FakeVision(VisionResult("GPU_OVERHEAT", 0.9)))
    assert d.error_code == "GPU_OVERHEAT" and d.decision == "needs_review" and d.source == "vision"
    assert d.confidence == pytest.approx(0.72)


def test_agreement_combines_independent_evidence(cfg, kb, png_bytes):
    # luật 0.3 + vision 0.7*0.8=0.56 -> noisy-or = 1 - 0.7*0.44 = 0.69
    d = run(cfg, kb, png_bytes, FakeOcr("load average: 5.0"), FakeVision(VisionResult("CPU_LOAD_AVG_HIGH", 0.7)))
    assert d.source == "rules+vision" and d.confidence == pytest.approx(0.69)


def test_vision_alone_never_reaches_auto_notify(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, NullOcr(), FakeVision(VisionResult("GPU_CUDA_OOM", 1.0)))
    assert d.decision == "needs_review" and d.confidence < cfg.threshold_auto


def test_decent_rule_plus_agreeing_vision_reaches_auto(cfg, kb, png_bytes):
    # luật 0.6 (mẫu yếu "oom-kill") + vision 0.9*0.8=0.72 -> 1 - 0.4*0.28 = 0.89
    d = run(cfg, kb, png_bytes, FakeOcr("oom-kill"), FakeVision(VisionResult("RAM_OOM_KILLER", 0.9)))
    assert d.decision == "auto_notify" and d.source == "rules+vision"


def test_vision_weight_is_configurable(cfg, kb, png_bytes):
    cfg2 = cfg.model_copy(update={"vision_weight": 1.0})
    d = run(cfg2, kb, png_bytes, NullOcr(), FakeVision(VisionResult("GPU_CUDA_OOM", 0.9)))
    assert d.confidence == pytest.approx(0.9)


def test_calibration_is_explained_in_evidence(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, NullOcr(), FakeVision(VisionResult("GPU_CUDA_OOM", 0.9)))
    assert any("quy đổi 72%" in e for e in d.evidence)


def test_disagreement_penalised_and_warned(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, FakeOcr("load average"), FakeVision(VisionResult("RAM_LEAK", 0.9)))
    # vision 0.9*0.8=0.72 thắng luật 0.3, bị phạt ×0.8 vì bất đồng -> 0.58
    assert d.error_code == "RAM_LEAK" and d.confidence == pytest.approx(0.58)
    assert any("không thống nhất" in w for w in d.warnings)


def test_vision_failure_degrades_to_rules(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, FakeOcr("load average: 5.0"), FakeVision(error=True))
    assert d.error_code == "CPU_LOAD_AVG_HIGH" and d.source == "rules" and d.decision == "unknown"
    assert any("Vision không khả dụng" in w for w in d.warnings)


def test_nothing_recognised_is_unknown(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, NullOcr(), FakeVision(VisionResult("UNKNOWN", 0.2)))
    assert d.error_code == "UNKNOWN" and d.decision == "unknown" and d.runbook is None


def test_vision_disabled_still_works(cfg, kb, png_bytes):
    d = run(cfg, kb, png_bytes, FakeOcr("hello"), None)
    assert d.decision == "unknown" and "Vision đang tắt" in d.warnings


def test_invalid_image_rejected(cfg, kb):
    with pytest.raises(InvalidImageError):
        run(cfg, kb, b"not an image", NullOcr(), None)
