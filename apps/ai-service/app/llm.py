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


class OllamaChat:
    def __init__(self, base_url: str, model: str, timeout_s: float) -> None:
        self._url, self._model, self._timeout = base_url.rstrip("/"), model, timeout_s
        self.name = f"ollama:{model}"

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
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
            {"model": self._model, "stream": False, "messages": out, "tools": tools, "options": {"temperature": 0}},
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
