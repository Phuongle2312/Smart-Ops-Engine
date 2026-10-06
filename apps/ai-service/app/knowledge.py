"""Runbook + RAG (FR-AI-008, FR-AI-009, FR-AI-012).

- Runbook tra theo mã lỗi (xác định, không cần mô hình): data/knowledge/<MÃ>.md
- `related`: tìm các đoạn tri thức liên quan — vector (Qdrant + Ollama embed) nếu bật,
  ngược lại tìm theo từ khóa.
"""
import logging
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

log = logging.getLogger(__name__)


@dataclass
class Document:
    code: str  # mã lỗi, hoặc "" nếu là tri thức chung
    title: str
    content: str


@dataclass
class Related:
    title: str
    snippet: str
    score: float


def parse_markdown(path: Path) -> Document:
    """Đọc .md có front matter `---\\ncode: X\\ntitle: Y\\n---`."""
    text = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return Document(meta.get("code", ""), meta.get("title", path.stem), text.strip())


def chunk(doc: Document, size: int = 900) -> list[str]:
    """Cắt theo đoạn (dòng trống), gom lại tới ~size ký tự."""
    chunks, cur = [], ""
    for para in re.split(r"\n\s*\n", doc.content):
        if cur and len(cur) + len(para) > size:
            chunks.append(cur.strip())
            cur = ""
        cur += para + "\n\n"
    if cur.strip():
        chunks.append(cur.strip())
    return chunks


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"\w{3,}", s.lower()))


class Retriever(Protocol):
    mode: str

    def index(self, docs: list[Document]) -> int: ...
    def search(self, query: str, k: int = 3) -> list[Related]: ...


class KeywordRetriever:
    mode = "keyword"

    def __init__(self) -> None:
        self._chunks: list[tuple[str, str]] = []

    def index(self, docs: list[Document]) -> int:
        self._chunks = [(d.title, c) for d in docs for c in chunk(d)]
        return len(self._chunks)

    def search(self, query: str, k: int = 3) -> list[Related]:
        q = _tokens(query)
        if not q:
            return []
        scored = []
        for title, text in self._chunks:
            overlap = len(q & _tokens(text))
            if overlap:
                scored.append(Related(title, text[:300], round(overlap / len(q), 2)))
        return sorted(scored, key=lambda r: r.score, reverse=True)[:k]


class QdrantRetriever:
    mode = "vector"

    def __init__(self, qdrant_url: str, collection: str, ollama_url: str, embed_model: str) -> None:
        from qdrant_client import QdrantClient

        self._client = QdrantClient(url=qdrant_url, timeout=10)
        self._collection = collection
        self._ollama = ollama_url.rstrip("/")
        self._model = embed_model

    def _embed(self, texts: list[str]) -> list[list[float]]:
        resp = httpx.post(
            f"{self._ollama}/api/embed",
            json={"model": self._model, "input": texts},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["embeddings"]

    def index(self, docs: list[Document]) -> int:
        from qdrant_client.models import Distance, PointStruct, VectorParams

        items = [(d.title, c) for d in docs for c in chunk(d)]
        if not items:
            return 0
        vectors = self._embed([c for _, c in items])
        if self._client.collection_exists(self._collection):
            self._client.delete_collection(self._collection)
        self._client.create_collection(
            self._collection,
            vectors_config=VectorParams(size=len(vectors[0]), distance=Distance.COSINE),
        )
        self._client.upsert(
            self._collection,
            points=[
                PointStruct(
                    id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{t}:{i}")),
                    vector=v,
                    payload={"title": t, "text": c},
                )
                for i, ((t, c), v) in enumerate(zip(items, vectors))
            ],
        )
        return len(items)

    def search(self, query: str, k: int = 3) -> list[Related]:
        vec = self._embed([query])[0]
        res = self._client.query_points(self._collection, query=vec, limit=k)
        return [
            Related(p.payload["title"], p.payload["text"][:300], round(p.score, 2))
            for p in res.points
        ]


class KnowledgeBase:
    def __init__(self, knowledge_dir: Path, retriever: Retriever) -> None:
        self._dir = knowledge_dir
        self._retriever = retriever
        self._docs: list[Document] = []
        self._runbooks: dict[str, Document] = {}

    @property
    def mode(self) -> str:
        return self._retriever.mode

    @property
    def runbook_count(self) -> int:
        return len(self._runbooks)

    def reload(self) -> int:
        """Nạp lại runbook; cố gắng index vào retriever (lỗi retriever không làm hỏng runbook)."""
        self._docs = [parse_markdown(p) for p in sorted(self._dir.glob("*.md"))] if self._dir.exists() else []
        self._runbooks = {d.code: d for d in self._docs if d.code}
        try:
            return self._retriever.index(self._docs)
        except Exception as exc:
            log.warning("Không index được retriever (%s) — dùng tìm kiếm từ khóa", exc)
            self._retriever = KeywordRetriever()
            return self._retriever.index(self._docs)

    def runbook(self, code: str) -> Document | None:
        return self._runbooks.get(code)

    def related(self, query: str, k: int = 3) -> list[Related]:
        try:
            return self._retriever.search(query, k)
        except Exception as exc:
            log.warning("Tìm kiếm tri thức lỗi (%s) — chuyển sang từ khóa", exc)
            self._retriever = KeywordRetriever()
            self._retriever.index(self._docs)
            return self._retriever.search(query, k)
