import io

import pytest
from PIL import Image

from app.config import Settings
from app.knowledge import KeywordRetriever, KnowledgeBase


@pytest.fixture
def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), "white").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def cfg() -> Settings:
    # Dùng thư mục data/ thật của repo để đọc runbook; test không ghi vào đó
    return Settings(_env_file=None, api_key="", qdrant_url="")


@pytest.fixture
def kb(cfg) -> KnowledgeBase:
    kb = KnowledgeBase(cfg.knowledge_dir, KeywordRetriever())
    kb.reload()
    return kb
