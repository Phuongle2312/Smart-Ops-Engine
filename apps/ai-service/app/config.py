"""Cấu hình đọc từ biến môi trường tiền tố AI_ (xem .env.example)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/ai-service/app/config.py -> gốc repo (hoặc fallback trong container)
_parents = Path(__file__).resolve().parents
REPO_ROOT = _parents[3] if len(_parents) > 3 else _parents[-1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_", env_file=".env", extra="ignore")

    api_key: str = ""  # để trống = không yêu cầu X-API-Key

    data_dir: Path = REPO_ROOT / "data"

    ollama_url: str = "http://localhost:11434"
    vision_model: str = "qwen2.5vl:7b"
    embed_model: str = "bge-m3"
    vision_enabled: bool = True
    vision_timeout_s: float = 180.0
    # Mô hình vision tự báo confidence không hiệu chỉnh (luôn ~0.9). Nhân hệ số này để vision đứng một mình
    # không bao giờ đạt ngưỡng auto_notify (0.85) — cần luật OCR đồng thuận.
    vision_weight: float = 0.8

    qdrant_url: str = ""  # để trống = tìm kiếm theo từ khóa, không dùng vector
    qdrant_collection: str = "soe_knowledge"

    ocr_enabled: bool = True

    max_image_mb: int = 10
    max_image_side: int = 1600

    # Ngưỡng độ tin cậy (xem SRS mục 1)
    threshold_auto: float = 0.85
    threshold_review: float = 0.60

    @property
    def knowledge_dir(self) -> Path:
        return self.data_dir / "knowledge"

    @property
    def images_dir(self) -> Path:
        return self.data_dir / "error-images"

    @property
    def feedback_file(self) -> Path:
        return self.data_dir / "feedback" / "feedback.jsonl"


@lru_cache
def get_settings() -> Settings:
    return Settings()
