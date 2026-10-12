import json

import httpx

from app import llm as llm_mod
from app.agent import DiagnosisAgent
from app.llm import LLMError, LLMReply, OllamaChat, OpenAIChat, ToolCall
from app.ocr import NullOcr
from app.pipeline import DiagnosisPipeline
from app.vision import VisionResult


class StubVision:
    def classify(self, png_bytes, ocr_text="", note=""):
        return VisionResult("GPU_XID_ERROR", 0.9, ["Vision: Xid 79"])


class ScriptedLLM:
    """LLM giả: trả lần lượt các phản hồi đã định sẵn, ghi lại tin nhắn nhận được."""
    name = "scripted"

    def __init__(self, replies):
        self.replies, self.seen = list(replies), []

    def chat(self, messages, tools):
        self.seen.append(list(messages))
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def call(name, **args):
    return LLMReply("", [ToolCall(f"id-{name}", name, args)])


def make_agent(cfg, kb, replies):
    pipeline = DiagnosisPipeline(cfg, NullOcr(), StubVision(), kb)
    llm = ScriptedLLM(replies)
    return DiagnosisAgent(cfg, llm, pipeline, kb), llm


def test_agent_uses_tools_then_finishes(cfg, kb, png_bytes):
    agent, llm = make_agent(cfg, kb, [
        call("analyze_image"),
        call("get_runbook", code="GPU_XID_ERROR"),
        call("finish", error_code="GPU_XID_ERROR", confidence=0.9, summary="Xid 79", recommended_steps=["Reset GPU"]),
    ])
    r = agent.run(png_bytes, "1")
    assert r.status == "finished" and r.error_code == "GPU_XID_ERROR" and r.resource == "GPU"
    assert [s.tool for s in r.trace] == ["analyze_image", "get_runbook", "finish"]
    assert r.recommended_steps == ["Reset GPU"]
    # kết quả công cụ được đưa lại cho LLM ở lượt sau
    assert any(m["role"] == "tool" and "GPU_XID_ERROR" in m["content"] for m in llm.seen[1])


def test_agent_clamps_confidence_and_rejects_unknown_code(cfg, kb):
    agent, _ = make_agent(cfg, kb, [call("finish", error_code="BOGUS", confidence=7, summary="x")])
    r = agent.run(None)
    assert r.error_code == "UNKNOWN" and r.confidence <= 0.5


def test_agent_survives_tool_errors_and_unknown_tools(cfg, kb):
    agent, _ = make_agent(cfg, kb, [
        call("get_node_metrics", node_id="abc"),
        call("rm_rf", path="/"),
        call("finish", error_code="UNKNOWN", confidence=0.1, summary="không đủ"),
    ])
    r = agent.run(None)
    assert r.status == "finished"
    assert "node_id" in r.trace[0].result and "không tồn tại" in r.trace[1].result


def test_agent_no_image_for_analyze(cfg, kb):
    agent, _ = make_agent(cfg, kb, [call("analyze_image"), call("finish", error_code="UNKNOWN", confidence=0, summary="")])
    assert "Không có ảnh" in agent.run(None).trace[0].result


def test_agent_max_steps_falls_back_to_analysis(cfg, kb, png_bytes):
    cfg.agent_max_steps = 2
    agent, _ = make_agent(cfg, kb, [call("analyze_image"), call("search_runbook", query="gpu")])
    r = agent.run(png_bytes)
    assert r.status == "max_steps" and r.error_code == "GPU_XID_ERROR" and r.warnings


def test_agent_llm_error(cfg, kb):
    agent, _ = make_agent(cfg, kb, [LLMError("hết hạn mức")])
    r = agent.run(None)
    assert r.status == "llm_error" and r.error_code == "UNKNOWN" and "hết hạn mức" in r.warnings[0]


def test_agent_metrics_tool(cfg, kb, monkeypatch):
    cfg.backend_url = "http://backend"
    pts = [{"timestamp": "t", "cpu": 40, "ram": 90, "disk": 10}, {"timestamp": "t2", "cpu": 100, "ram": 95, "disk": 10}]
    monkeypatch.setattr(httpx, "get", lambda *a, **k: httpx.Response(200, json=pts, request=httpx.Request("GET", a[0])))
    agent, _ = make_agent(cfg, kb, [call("get_node_metrics", node_id="3"), call("finish", error_code="UNKNOWN", confidence=0, summary="")])
    out = json.loads(agent.run(None).trace[0].result)
    assert out["cpu"]["max"] == 100 and out["points"] == 2


def test_openai_client_converts_messages(monkeypatch):
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, body=json, headers=headers)
        msg = {"tool_calls": [{"id": "c1", "function": {"name": "finish", "arguments": "{\"error_code\": \"UNKNOWN\"}"}}]}
        return httpx.Response(200, json={"choices": [{"message": msg}]}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "", "tool_calls": [{"id": "c0", "name": "analyze_image", "args": {}}]},
        {"role": "tool", "tool_call_id": "c0", "name": "analyze_image", "content": "ok"},
    ]
    reply = OpenAIChat("https://x/v1/", "KEY", "m", 5).chat(msgs, [])
    assert sent["url"] == "https://x/v1/chat/completions" and sent["headers"]["Authorization"] == "Bearer KEY"
    assert sent["body"]["messages"][1]["tool_calls"][0]["function"]["arguments"] == "{}"
    assert sent["body"]["messages"][2]["tool_call_id"] == "c0"
    assert reply.tool_calls[0].name == "finish" and reply.tool_calls[0].args == {"error_code": "UNKNOWN"}


def test_ollama_client_parses_tool_calls(monkeypatch):
    def fake_post(url, json, headers, timeout):
        msg = {"content": "", "tool_calls": [{"function": {"name": "search_runbook", "arguments": {"query": "q"}}}]}
        return httpx.Response(200, json={"message": msg}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    reply = OllamaChat("http://o", "qwen2.5:7b", 5).chat([{"role": "user", "content": "x"}], [])
    assert reply.tool_calls[0].args == {"query": "q"}


def test_llm_http_error_becomes_llmerror(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "post", boom)
    try:
        OllamaChat("http://o", "m", 1).chat([], [])
    except llm_mod.LLMError:
        return
    raise AssertionError("phải ném LLMError")


def test_ollama_falls_back_to_prompt_emulation_when_model_has_no_tools(monkeypatch):
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append(json)
        req = httpx.Request("POST", url)
        if "tools" in json:
            return httpx.Response(400, json={"error": "qwen2.5vl:3b does not support tools"}, request=req)
        return httpx.Response(
            200, json={"message": {"content": 'Được: {"tool": "get_runbook", "args": {"code": "RAM_LEAK"}}'}}, request=req)

    monkeypatch.setattr(httpx, "post", fake_post)
    tools = [{"type": "function", "function": {"name": "get_runbook", "description": "d", "parameters": {}}}]
    llm = OllamaChat("http://o", "qwen2.5vl:3b", 5)
    msgs = [{"role": "system", "content": "S"}, {"role": "user", "content": "x"},
            {"role": "assistant", "content": "", "tool_calls": [{"id": "1", "name": "search_runbook", "args": {"q": "a"}}]},
            {"role": "tool", "tool_call_id": "1", "name": "search_runbook", "content": "kq"}]
    reply = llm.chat(msgs, tools)
    assert reply.tool_calls[0].name == "get_runbook" and reply.tool_calls[0].args == {"code": "RAM_LEAK"}
    sent = calls[-1]
    assert "tools" not in sent and sent["format"] == "json" and "get_runbook" in sent["messages"][0]["content"]
    assert sent["messages"][-1] == {"role": "user", "content": "Kết quả công cụ search_runbook:\nkq"}
    llm.chat(msgs, tools)  # lần sau đi thẳng đường giả lập, không thử lại tools gốc
    assert "tools" not in calls[-1] and len(calls) == 3


def test_ollama_emulation_plain_text_reply_has_no_tool_calls(monkeypatch):
    def fake_post(url, json, headers, timeout):
        req = httpx.Request("POST", url)
        if "tools" in json:
            return httpx.Response(400, json={"error": "does not support tools"}, request=req)
        return httpx.Response(200, json={"message": {"content": "không rõ"}}, request=req)

    monkeypatch.setattr(httpx, "post", fake_post)
    reply = OllamaChat("http://o", "m", 5).chat([{"role": "user", "content": "x"}], [])
    assert reply.tool_calls == [] and reply.content == "không rõ"


def test_agent_replaces_non_vietnamese_conclusion_with_standard_description(cfg, kb):
    agent, _ = make_agent(cfg, kb, [
        call("finish", error_code="RAM_JAVA_HEAP", confidence=0.9, summary="堆内存不足", recommended_steps=["增加内存"]),
    ])
    r = agent.run(None, "1", "Java treo")
    assert r.error_code == "RAM_JAVA_HEAP"
    assert "堆" not in r.summary and r.summary.startswith("RAM_JAVA_HEAP:")
    assert r.recommended_steps and "runbook" in r.recommended_steps[0]
    assert any("tiếng Việt" in w for w in r.warnings)
