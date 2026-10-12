"""Client LLM có gọi công cụ (tool calling) — dùng cho agent.

Định dạng tin nhắn nội bộ (độc lập nhà cung cấp):
  {"role": "system"|"user", "content": str}
  {"role": "assistant", "content": str, "tool_calls": [{"id", "name", "args": dict}]}
  {"role": "tool", "tool_call_id": str, "name": str, "content": str}
Mỗi client tự chuyển sang định dạng của nhà cung cấp.
- OllamaChat: mô hình nội bộ (cần mô hình hỗ trợ tools, ví dụ qwen2.5, llama3.1).
- OpenAIChat: mọi API tương thích OpenAI — OpenAI (ChatGPT), Gemini qua endpoint
  https://generativelanguage.googleapis.com/v1beta/openai, hoặc máy chủ tương thích khác.
"""
import json
import uuid
from dataclasses import dataclass, field
from typing import Protocol

import httpx


class LLMError(RuntimeError):
    """LLM lỗi mạng / HTTP / trả dữ liệu không dùng được."""


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class LLMReply:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)


class ChatLLM(Protocol):
    name: str

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply: ...


def _post(url: str, payload: dict, headers: dict, timeout: float) -> dict:
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise LLMError(f"LLM lỗi: {exc} — {exc.response.text[:200]}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise LLMError(f"LLM lỗi: {exc}") from exc


def _as_dict(value) -> dict:
    """Tham số công cụ có thể là dict (Ollama) hoặc chuỗi JSON (OpenAI); sai định dạng → {}."""
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


_EMULATION_PROMPT = (
    "Bạn không có tính năng gọi công cụ gốc. Ở MỖI lượt, chỉ trả về MỘT đối tượng JSON duy nhất, không thêm chữ nào khác:\n"
    '{"tool": "<tên công cụ>", "args": {<tham số>}}\n'
    "Sau mỗi lần gọi bạn sẽ nhận kết quả công cụ ở tin nhắn kế tiếp. Khi đủ bằng chứng hãy gọi công cụ kết luận.\n"
    "Mọi nội dung văn bản trong tham số (tóm tắt, bước xử lý...) PHẢI viết bằng tiếng Việt.\n"
    "Các công cụ:\n"
)


def _extract_json_object(text: str) -> dict | None:
    """Lấy đối tượng JSON đầu tiên trong chuỗi (mô hình nhỏ hay bọc thêm chữ hoặc ```json)."""
    start = text.find("{")
    if start < 0:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


class OllamaChat:
    """Gọi công cụ gốc của Ollama; mô hình không hỗ trợ tools (vd qwen2.5vl) thì tự chuyển sang giả lập bằng prompt + JSON."""

    def __init__(self, base_url: str, model: str, timeout_s: float, num_gpu: int | None = None) -> None:
        self._url, self._model, self._timeout = base_url.rstrip("/"), model, timeout_s
        self._options = {"temperature": 0, **({"num_gpu": num_gpu} if num_gpu is not None else {})}
        self.name = f"ollama:{model}"
        self._emulate = False

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        if not self._emulate:
            try:
                return self._chat_native(messages, tools)
            except LLMError as exc:
                if "does not support tools" not in str(exc):
                    raise
                self._emulate = True
                self.name += " (giả lập tool-calling)"
        return self._chat_emulated(messages, tools)

    def _chat_emulated(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        catalog = "\n".join(
            f"- {t['function']['name']}: {t['function'].get('description', '')} "
            f"tham số: {json.dumps(t['function'].get('parameters', {}), ensure_ascii=False)}"
            for t in tools
        )
        out = []
        for m in messages:
            if m["role"] == "system":
                out.append({"role": "system", "content": m["content"] + "\n\n" + _EMULATION_PROMPT + catalog})
            elif m["role"] == "assistant" and m.get("tool_calls"):
                c = m["tool_calls"][0]
                out.append({"role": "assistant", "content": json.dumps({"tool": c["name"], "args": c["args"]}, ensure_ascii=False)})
            elif m["role"] == "tool":
                out.append({"role": "user", "content": f"Kết quả công cụ {m['name']}:\n{m['content']}"})
            else:
                out.append({"role": m["role"], "content": m["content"]})
        data = _post(
            f"{self._url}/api/chat",
            {"model": self._model, "stream": False, "format": "json", "messages": out, "options": self._options},
            {}, self._timeout,
        )
        try:
            content = data["message"].get("content") or ""
        except (KeyError, TypeError, AttributeError) as exc:
            raise LLMError("Ollama trả dữ liệu không đúng định dạng") from exc
        obj = _extract_json_object(content)
        if obj and isinstance(obj.get("tool"), str):
            return LLMReply("", [ToolCall(uuid.uuid4().hex[:8], obj["tool"], _as_dict(obj.get("args")))])
        return LLMReply(content)

    def _chat_native(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        out = []
        for m in messages:
            if m["role"] == "assistant" and m.get("tool_calls"):
                calls = [{"function": {"name": c["name"], "arguments": c["args"]}} for c in m["tool_calls"]]
                out.append({"role": "assistant", "content": m.get("content", ""), "tool_calls": calls})
            elif m["role"] == "tool":
                out.append({"role": "tool", "content": m["content"], "tool_name": m["name"]})
            else:
                out.append({"role": m["role"], "content": m["content"]})
        data = _post(
            f"{self._url}/api/chat",
            {"model": self._model, "stream": False, "messages": out, "tools": tools, "options": self._options},
            {}, self._timeout,
        )
        try:
            msg = data["message"]
            calls = [
                ToolCall(uuid.uuid4().hex[:8], c["function"]["name"], _as_dict(c["function"].get("arguments")))
                for c in msg.get("tool_calls") or []
            ]
            return LLMReply(msg.get("content") or "", calls)
        except (KeyError, TypeError) as exc:
            raise LLMError("Ollama trả dữ liệu không đúng định dạng") from exc


class OpenAIChat:
    def __init__(self, base_url: str, api_key: str, model: str, timeout_s: float) -> None:
        self._url, self._key, self._model, self._timeout = base_url.rstrip("/"), api_key, model, timeout_s
        self.name = f"openai-compatible:{model}"

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        out = []
        for m in messages:
            if m["role"] == "assistant" and m.get("tool_calls"):
                calls = [
                    {"id": c["id"], "type": "function",
                     "function": {"name": c["name"], "arguments": json.dumps(c["args"], ensure_ascii=False)}}
                    for c in m["tool_calls"]
                ]
                out.append({"role": "assistant", "content": m.get("content") or None, "tool_calls": calls})
            elif m["role"] == "tool":
                out.append({"role": "tool", "tool_call_id": m["tool_call_id"], "content": m["content"]})
            else:
                out.append({"role": m["role"], "content": m["content"]})
        data = _post(
            f"{self._url}/chat/completions",
            {"model": self._model, "messages": out, "tools": tools, "temperature": 0},
            {"Authorization": f"Bearer {self._key}"}, self._timeout,
        )
        try:
            msg = data["choices"][0]["message"]
            calls = [
                ToolCall(c["id"], c["function"]["name"], _as_dict(c["function"].get("arguments")))
                for c in msg.get("tool_calls") or []
            ]
            return LLMReply(msg.get("content") or "", calls)
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("API trả dữ liệu không đúng định dạng") from exc
