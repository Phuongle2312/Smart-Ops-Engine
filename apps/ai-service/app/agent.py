"""AI Agent chẩn đoán sự cố: vòng lặp LLM ↔ công cụ.

Khác `pipeline.py` (luồng cố định ảnh → OCR → luật → vision), ở đây LLM TỰ quyết định gọi công cụ nào,
theo thứ tự nào, và khi nào đủ thông tin để kết luận (công cụ `finish`). Mọi công cụ đều chỉ ĐỌC —
agent chỉ gợi ý, không thực thi lệnh sửa lỗi.

Vòng lặp: [mục tiêu] → LLM chọn công cụ → chạy → kết quả đưa lại LLM → ... → finish (hoặc hết số bước).
"""
import json
import logging
from dataclasses import asdict, dataclass, field

import httpx

from .config import Settings
from .knowledge import KnowledgeBase
from .llm import ChatLLM, LLMError
from .pipeline import DiagnosisPipeline
from .preprocess import InvalidImageError
from .taxonomy import ERROR_TYPES, get_type

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Bạn là agent chẩn đoán sự cố máy chủ (RAM/CPU/GPU) cho đội vận hành. Quy tắc:\n"
    "1. Dùng công cụ để thu thập bằng chứng, KHÔNG đoán. Có ảnh thì gọi analyze_image trước.\n"
    "2. Nếu kết quả mơ hồ hoặc độ tin cậy thấp, đối chiếu thêm: get_node_metrics (số liệu thật của máy) "
    "và search_runbook / get_runbook (tri thức nội bộ).\n"
    "3. Khi đủ bằng chứng, gọi finish đúng một lần. Không đủ bằng chứng thì finish với UNKNOWN.\n"
    "4. Chỉ gợi ý hướng xử lý cho người phụ trách; không bao giờ tự thực thi lệnh sửa lỗi.\n"
    "Trả lời bằng tiếng Việt."
)


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": properties, "required": required},
    }}


TOOLS = [
    _tool("analyze_image",
          "Phân tích ảnh lỗi đính kèm (OCR + luật + vision). Trả mã lỗi, độ tin cậy, bằng chứng.", {}, []),
    _tool("get_node_metrics",
          "Lấy CPU/RAM/Disk gần đây của máy chủ từ hệ thống giám sát (tóm tắt min/max/mới nhất).",
          {"node_id": {"type": "string", "description": "ID số của node"},
           "range": {"type": "string", "enum": ["24h", "7d", "30d"]}}, ["node_id"]),
    _tool("search_runbook", "Tìm tri thức/runbook nội bộ liên quan tới một mô tả lỗi.",
          {"query": {"type": "string"}}, ["query"]),
    _tool("get_runbook", "Lấy runbook đầy đủ (nguyên nhân, kiểm tra, xử lý) theo mã lỗi.",
          {"code": {"type": "string", "enum": list(ERROR_TYPES)}}, ["code"]),
    _tool("finish", "Kết thúc và đưa kết luận cuối cùng cho người phụ trách.",
          {"error_code": {"type": "string", "enum": [*ERROR_TYPES, "UNKNOWN"]},
           "confidence": {"type": "number", "description": "0..1"},
           "summary": {"type": "string", "description": "Nguyên nhân khả dĩ và căn cứ"},
           "recommended_steps": {"type": "array", "items": {"type": "string"}}},
          ["error_code", "confidence", "summary"]),
]


@dataclass
class Step:
    n: int
    tool: str
    args: dict
    result: str  # đã cắt ngắn để hiển thị


@dataclass
class AgentResult:
    status: str  # finished | max_steps | llm_error
    error_code: str
    resource: str
    severity: str
    confidence: float
    summary: str
    recommended_steps: list[str]
    trace: list[Step] = field(default_factory=list)
    llm: str = ""
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class _Run:
    """Trạng thái một lần chạy: ảnh, node, kết quả analyze_image gần nhất, kết luận."""

    def __init__(self, image: bytes | None, node_id: str) -> None:
        self.image, self.node_id = image, node_id
        self.analysis: dict | None = None
        self.finish: dict | None = None


class DiagnosisAgent:
    def __init__(self, cfg: Settings, llm: ChatLLM, pipeline: DiagnosisPipeline, kb: KnowledgeBase) -> None:
        self._cfg, self._llm, self._pipeline, self._kb = cfg, llm, pipeline, kb

    # ---- công cụ (chỉ đọc) ----
    def _call_tool(self, run: _Run, name: str, args: dict) -> str:
        try:
            if name == "analyze_image":
                return self._analyze(run)
            if name == "get_node_metrics":
                return self._metrics(str(args.get("node_id") or run.node_id), str(args.get("range") or "24h"))
            if name == "search_runbook":
                hits = self._kb.related(str(args.get("query", "")), k=3)
                return json.dumps([{"title": h.title, "snippet": h.snippet[:400]} for h in hits], ensure_ascii=False)
            if name == "get_runbook":
                doc = self._kb.runbook(str(args.get("code", "")))
                return doc.content[:1800] if doc else "Không có runbook cho mã này"
            if name == "finish":
                run.finish = args
                return "Đã ghi nhận kết luận"
        except Exception as exc:  # công cụ lỗi không được làm sập vòng lặp — báo lại cho LLM tự xử lý
            log.warning("Công cụ %s lỗi: %s", name, exc)
            return f"Lỗi khi chạy công cụ: {exc}"
        return f"Công cụ không tồn tại: {name}"

    def _analyze(self, run: _Run) -> str:
        if not run.image:
            return "Không có ảnh đính kèm"
        try:
            d = self._pipeline.run(run.image, run.node_id)
        except InvalidImageError as exc:
            return f"Ảnh không hợp lệ: {exc}"
        run.analysis = d.to_dict()
        return json.dumps({
            "error_code": d.error_code, "confidence": d.confidence, "decision": d.decision,
            "evidence": d.evidence[:6], "ocr_text": d.ocr_text[:600], "warnings": d.warnings,
        }, ensure_ascii=False)

    def _metrics(self, node_id: str, rng: str) -> str:
        if not node_id.isdigit():
            return "Thiếu node_id số hợp lệ"
        if not self._cfg.backend_url:
            return "Chưa cấu hình AI_BACKEND_URL — không đọc được metrics"
        try:
            r = httpx.get(f"{self._cfg.backend_url.rstrip('/')}/api/nodes/{node_id}/metrics",
                          params={"range": rng}, timeout=10)
        except httpx.HTTPError as exc:
            return f"Không kết nối được backend: {exc}"
        if r.status_code == 404:
            return "Node không tồn tại"
        r.raise_for_status()
        pts = r.json()
        if not pts:
            return "Chưa có số liệu trong khoảng thời gian này"
        out: dict = {"points": len(pts), "latest": pts[-1]}
        for key in ("cpu", "ram", "disk"):
            vals = [p[key] for p in pts if p.get(key) is not None]
            if vals:
                out[key] = {"min": min(vals), "max": max(vals), "avg": round(sum(vals) / len(vals), 1)}
        return json.dumps(out, ensure_ascii=False)

    # ---- vòng lặp agent ----
    def run(self, image: bytes | None, node_id: str = "", note: str = "") -> AgentResult:
        run = _Run(image, node_id)
        goal = f"Chẩn đoán sự cố. Node: {node_id or 'không rõ'}. Có ảnh: {'có' if image else 'không'}."
        if note.strip():
            goal += f"\nGhi chú của người báo: {note[:500]}"
        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": goal}]
        trace: list[Step] = []
        warnings: list[str] = []
        status = "max_steps"

        for n in range(1, self._cfg.agent_max_steps + 1):
            try:
                reply = self._llm.chat(messages, TOOLS)
            except LLMError as exc:
                warnings.append(str(exc))
                status = "llm_error"
                break
            if not reply.tool_calls:
                # LLM trả lời thẳng mà không gọi công cụ: nhắc rồi tiếp tục (vẫn tính vào số bước)
                messages.append({"role": "assistant", "content": reply.content})
                messages.append({"role": "user", "content": "Hãy gọi một công cụ, hoặc finish nếu đã đủ bằng chứng."})
                continue
            messages.append({"role": "assistant", "content": reply.content,
                             "tool_calls": [{"id": c.id, "name": c.name, "args": c.args} for c in reply.tool_calls]})
            for call in reply.tool_calls:
                result = self._call_tool(run, call.name, call.args)
                trace.append(Step(n, call.name, call.args, result[:500]))
                messages.append({"role": "tool", "tool_call_id": call.id, "name": call.name, "content": result})
            if run.finish is not None:
                status = "finished"
                break

        return self._build(run, status, trace, warnings)

    def _build(self, run: _Run, status: str, trace: list[Step], warnings: list[str]) -> AgentResult:
        steps: list[str] = []
        if run.finish is not None:
            f = run.finish
            code = str(f.get("error_code", "UNKNOWN")).upper()
            try:
                conf = max(0.0, min(1.0, float(f.get("confidence", 0))))
            except (TypeError, ValueError):
                conf = 0.0
            raw_steps = f.get("recommended_steps")
            if isinstance(raw_steps, list):
                steps = [str(s)[:300] for s in raw_steps][:8]
            summary = str(f.get("summary", ""))[:1500]
        elif run.analysis:
            # Agent không kịp kết luận: dùng kết quả pipeline đã có, đánh dấu rõ
            code, conf = run.analysis["error_code"], run.analysis["confidence"] * 0.8
            summary = "Agent chưa kết luận; dùng kết quả phân tích ảnh gần nhất."
            warnings.append("Kết quả lấy từ analyze_image, chưa qua đối chiếu của agent")
        else:
            code, conf = "UNKNOWN", 0.0
            summary = "Không đủ bằng chứng để chẩn đoán."
        etype = get_type(code)  # mã ngoài taxonomy → UNKNOWN
        if etype.code == "UNKNOWN":
            conf = min(conf, 0.5)
        return AgentResult(status, etype.code, etype.resource, etype.severity, round(conf, 2), summary,
                           steps, trace, self._llm.name, warnings)
