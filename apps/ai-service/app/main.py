"""FastAPI — dịch vụ chẩn đoán lỗi từ ảnh. Chạy: uvicorn app.main:app --port 8001"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from . import library
from .agent import DiagnosisAgent
from .llm import OllamaChat, OpenAIChat
from .config import Settings, get_settings
from .knowledge import KeywordRetriever, KnowledgeBase, QdrantRetriever
from .ocr import build_ocr
from .pipeline import DiagnosisPipeline
from .preprocess import InvalidImageError
from .vision import OllamaVision

log = logging.getLogger("ai-service")


def build_state(cfg: Settings) -> dict:
    retriever = (
        QdrantRetriever(cfg.qdrant_url, cfg.qdrant_collection, cfg.ollama_url, cfg.embed_model)
        if cfg.qdrant_url
        else KeywordRetriever()
    )
    kb = KnowledgeBase(cfg.knowledge_dir, retriever)
    kb.reload()
    ollama = OllamaVision(cfg.ollama_url, cfg.vision_model, cfg.vision_timeout_s)
    ocr = build_ocr(cfg.ocr_enabled)
    pipeline = DiagnosisPipeline(cfg, ocr, ollama if cfg.vision_enabled else None, kb)
    llm = (
        OpenAIChat(cfg.llm_base_url, cfg.llm_api_key, cfg.llm_model, cfg.llm_timeout_s)
        if cfg.llm_provider == "openai"
        else OllamaChat(cfg.ollama_url, cfg.llm_model, cfg.llm_timeout_s)
    )
    agent = DiagnosisAgent(cfg, llm, pipeline, kb)
    return {"kb": kb, "ocr": ocr, "ollama": ollama, "pipeline": pipeline, "agent": agent}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not hasattr(app.state, "svc"):  # test có thể gắn sẵn state giả
        app.state.svc = build_state(get_settings())
    yield


app = FastAPI(title="Smart Ops Engine — AI Diagnosis", version="0.1.0", lifespan=lifespan)


def require_key(x_api_key: str = Header(default=""), cfg: Settings = Depends(get_settings)) -> None:
    if cfg.api_key and x_api_key != cfg.api_key:
        raise HTTPException(401, "Sai hoặc thiếu X-API-Key")


@app.get("/health")
def health(cfg: Settings = Depends(get_settings)) -> dict:
    svc = app.state.svc
    return {
        "status": "ok",
        "ocr": svc["ocr"].available,
        "vision_enabled": cfg.vision_enabled,
        "ollama_reachable": svc["ollama"].ping() if cfg.vision_enabled else False,
        "retrieval_mode": svc["kb"].mode,
        "runbooks": svc["kb"].runbook_count,
    }


@app.post("/diagnose", dependencies=[Depends(require_key)])
async def diagnose(
    file: UploadFile = File(...),
    node_id: str = Form(""),
    note: str = Form(""),
) -> dict:
    raw = await file.read()
    try:
        result = await run_in_threadpool(app.state.svc["pipeline"].run, raw, node_id, note)
    except InvalidImageError as exc:
        raise HTTPException(400, str(exc)) from exc
    return result.to_dict()


@app.post("/agent/diagnose", dependencies=[Depends(require_key)])
async def agent_diagnose(
    file: UploadFile | None = File(None),
    node_id: str = Form(""),
    note: str = Form(""),
) -> dict:
    """Agent tự chọn công cụ để chẩn đoán; ảnh là tùy chọn. Trả kết luận + `trace` từng bước."""
    raw = await file.read() if file else None
    result = await run_in_threadpool(app.state.svc["agent"].run, raw, node_id, note)
    return result.to_dict()


@app.post("/library/images", dependencies=[Depends(require_key)])
async def add_library_image(
    file: UploadFile = File(...),
    error_code: str = Form(...),
    source: str = Form(""),
    license: str = Form(""),
    labeler: str = Form(""),
    cfg: Settings = Depends(get_settings),
) -> dict:
    raw = await file.read()
    try:
        dest = library.add_image(
            cfg.images_dir, raw, error_code, source, license, labeler, cfg.max_image_mb, cfg.max_image_side
        )
    except (ValueError, InvalidImageError) as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"saved": dest.relative_to(cfg.images_dir).as_posix()}


class FeedbackIn(BaseModel):
    diagnosis_id: str
    correct: bool
    correct_code: str = ""
    comment: str = ""


@app.post("/feedback", dependencies=[Depends(require_key)])
def feedback(body: FeedbackIn, cfg: Settings = Depends(get_settings)) -> dict:
    try:
        library.add_feedback(cfg.feedback_file, body.diagnosis_id, body.correct, body.correct_code, body.comment)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"status": "recorded"}


@app.post("/knowledge/reindex", dependencies=[Depends(require_key)])
def reindex() -> dict:
    kb = app.state.svc["kb"]
    chunks = kb.reload()
    return {"runbooks": kb.runbook_count, "chunks": chunks, "mode": kb.mode}
