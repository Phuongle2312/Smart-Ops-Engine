import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.agent import DiagnosisAgent
from app.llm import LLMReply, ToolCall
from app.config import Settings, get_settings
from app.knowledge import KeywordRetriever, KnowledgeBase
from app.ocr import NullOcr
from app.pipeline import DiagnosisPipeline
from app.vision import VisionResult

from tests.test_agent import ScriptedLLM  # noqa: E402

H = {"X-API-Key": "secret"}


class StubVision:
    def classify(self, png_bytes, ocr_text="", note=""):
        return VisionResult("GPU_XID_ERROR", 0.9, ["Vision: Xid 79"])

    def ping(self):
        return True


def png():
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "black").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def client(tmp_path):
    real = Settings(_env_file=None)
    cfg = Settings(_env_file=None, data_dir=tmp_path, api_key="secret")
    kb = KnowledgeBase(real.knowledge_dir, KeywordRetriever())
    kb.reload()
    vision = StubVision()
    main.app.state.svc = {
        "kb": kb, "ocr": NullOcr(), "ollama": vision,
        "pipeline": DiagnosisPipeline(cfg, NullOcr(), vision, kb),
        "agent": DiagnosisAgent(cfg, ScriptedLLM([
            LLMReply("", [ToolCall("1", "analyze_image", {})]),
            LLMReply("", [ToolCall("2", "finish", {"error_code": "GPU_XID_ERROR", "confidence": 0.9, "summary": "ok"})]),
        ]), DiagnosisPipeline(cfg, NullOcr(), vision, kb), kb),
    }
    main.app.dependency_overrides[get_settings] = lambda: cfg
    with TestClient(main.app) as c:
        yield c, cfg
    main.app.dependency_overrides.clear()
    del main.app.state.svc


def test_health_is_open(client):
    c, _ = client
    r = c.get("/health")
    assert r.status_code == 200 and r.json()["runbooks"] == 11


def test_diagnose_requires_key(client):
    c, _ = client
    assert c.post("/diagnose", files={"file": ("a.png", png(), "image/png")}).status_code == 401


def test_diagnose_ok(client):
    c, _ = client
    r = c.post("/diagnose", headers=H, data={"node_id": "srv-01"}, files={"file": ("a.png", png(), "image/png")})
    body = r.json()
    assert r.status_code == 200
    assert body["error_code"] == "GPU_XID_ERROR" and body["node_id"] == "srv-01"
    assert body["runbook"]["code"] == "GPU_XID_ERROR"


def test_diagnose_rejects_bad_image(client):
    c, _ = client
    r = c.post("/diagnose", headers=H, files={"file": ("a.png", b"junk", "image/png")})
    assert r.status_code == 400


def test_library_image_and_manifest(client):
    c, cfg = client
    r = c.post("/library/images", headers=H, data={"error_code": "GPU_CUDA_OOM", "source": "tự chụp", "labeler": "an"},
               files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 200
    saved = cfg.images_dir / r.json()["saved"]
    assert saved.exists() and saved.parent.name == "gpu_cuda_oom"
    manifest = cfg.images_dir / "manifest.csv"
    assert "GPU_CUDA_OOM" in manifest.read_text(encoding="utf-8")
    # ảnh trùng không ghi manifest lần hai
    c.post("/library/images", headers=H, data={"error_code": "GPU_CUDA_OOM"},
           files={"file": ("a.png", png(), "image/png")})
    assert manifest.read_text(encoding="utf-8").count("GPU_CUDA_OOM") == 1


def test_library_rejects_unknown_code(client):
    c, _ = client
    r = c.post("/library/images", headers=H, data={"error_code": "NOPE"},
               files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 400


def test_feedback_recorded(client):
    c, cfg = client
    r = c.post("/feedback", headers=H, json={"diagnosis_id": "x", "correct": False, "correct_code": "RAM_LEAK"})
    assert r.status_code == 200
    rec = json.loads(cfg.feedback_file.read_text(encoding="utf-8").splitlines()[0])
    assert rec["correct"] is False and rec["correct_code"] == "RAM_LEAK"
    bad = c.post("/feedback", headers=H, json={"diagnosis_id": "x", "correct": False, "correct_code": "BAD"})
    assert bad.status_code == 400


def test_reindex(client):
    c, _ = client
    assert c.post("/knowledge/reindex", headers=H).json()["runbooks"] == 11


def test_agent_endpoint(client):
    c, _ = client
    assert c.post("/agent/diagnose", files={"file": ("a.png", png(), "image/png")}).status_code == 401
    r = c.post("/agent/diagnose", headers=H, data={"node_id": "1"}, files={"file": ("a.png", png(), "image/png")})
    body = r.json()
    assert r.status_code == 200 and body["status"] == "finished" and body["error_code"] == "GPU_XID_ERROR"
    assert [s["tool"] for s in body["trace"]] == ["analyze_image", "finish"]
