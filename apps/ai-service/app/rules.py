"""Luật từ khóa / regex trên văn bản OCR (FR-AI-004).

Mỗi mẫu có trọng số; độ tin cậy của một mã lỗi = tổng trọng số các mẫu khớp, tối đa 1.0.
"""
import re
from dataclasses import dataclass, field

# code -> [(regex, trọng số, nhãn hiển thị)]
PATTERNS: dict[str, list[tuple[str, float, str]]] = {
    "RAM_OOM_KILLER": [
        (r"out of memory:\s*kill(ed)? process", 0.9, "out of memory: killed process"),
        (r"invoked oom-killer", 0.9, "invoked oom-killer"),
        (r"oom[-_ ]?kill", 0.6, "oom-kill"),
    ],
    "RAM_JAVA_HEAP": [
        (r"java\.lang\.outofmemoryerror", 0.9, "java.lang.OutOfMemoryError"),
        (r"java heap space", 0.6, "Java heap space"),
        (r"gc overhead limit exceeded", 0.9, "GC overhead limit exceeded"),
    ],
    "RAM_SWAP_HIGH": [
        (r"swap[^\n]{0,30}(9\d|100)\s*%", 0.7, "swap >= 90%"),
        (r"swapfree:\s*0\s*kb", 0.7, "SwapFree: 0 kB"),
        (r"swap", 0.2, "swap"),
    ],
    "RAM_LEAK": [
        (r"memory leak", 0.7, "memory leak"),
        (r"leak", 0.25, "leak"),
    ],
    "CPU_HIGH_SUSTAINED": [
        (r"cpu[^\n]{0,30}(9[5-9]|100)(\.\d+)?\s*%", 0.7, "CPU >= 95%"),
        # OCR có thể làm mất dấu % (vd "99.6 us" trong dòng %Cpu(s) của top)
        (r"(9[5-9]|100)(\.\d+)?\s*(%\s*)?(cpu|us\b|user)", 0.7, "usage >= 95%"),
        (r"%cpu\(s\):\s*(9[5-9]|100)", 0.5, "%Cpu(s) >= 95"),
        (r"cpu usage", 0.2, "cpu usage"),
    ],
    "CPU_LOAD_AVG_HIGH": [
        (r"load\s*average:\s*\d{2,}\.\d+", 0.6, "load average >= 10"),
        (r"load\s*average", 0.3, "load average"),
    ],
    "CPU_THERMAL_THROTTLE": [
        (r"thermal throttl", 0.9, "thermal throttling"),
        (r"cpu clock throttled", 0.9, "CPU clock throttled"),
        (r"package temperature above threshold", 0.9, "package temperature above threshold"),
    ],
    "GPU_CUDA_OOM": [
        (r"cuda out of memory", 0.95, "CUDA out of memory"),
        (r"cuda error:\s*out of memory", 0.95, "CUDA error: out of memory"),
        (r"cudaerrormemoryallocation", 0.9, "cudaErrorMemoryAllocation"),
    ],
    "GPU_OVERHEAT": [
        (r"(hw|sw)\s*thermal\s*slowdown", 0.9, "thermal slowdown"),
        (r"gpu[^\n]{0,30}(8[5-9]|9\d)\s*c\b", 0.6, "GPU >= 85C"),
        # OCR hay tách nhãn và giá trị ra hai dòng ("GPU Current Temp" / "91C")
        (r"current temp\W{0,4}(8[5-9]|9\d)\s*c", 0.6, "Current Temp >= 85C"),
        (r"gpu temp", 0.25, "gpu temp"),
    ],
    "GPU_XID_ERROR": [
        (r"nvrm:\s*xid", 0.95, "NVRM: Xid"),
        (r"\bxid\s*\(?[^\n]{0,20}\d{2,3}\b", 0.6, "Xid <mã>"),
    ],
    "GPU_ECC_ERROR": [
        (r"uncorrectable ecc", 0.9, "uncorrectable ECC"),
        (r"volatile uncorr", 0.7, "Volatile Uncorr. ECC"),
        (r"ecc error", 0.7, "ECC error"),
    ],
}

_COMPILED = {
    code: [(re.compile(rx, re.IGNORECASE), w, label) for rx, w, label in pats]
    for code, pats in PATTERNS.items()
}


_SIZE = re.compile(r"(\d+(?:\.\d+)?)\s*(ki|mi|gi|ti|k|m|g|t)b?", re.IGNORECASE)
_UNIT = {"k": 1, "m": 1024, "g": 1024**2, "t": 1024**3}


def _swap_nearly_full(text: str) -> bool:
    """`free -h`: sau "Swap:" là tổng rồi đã dùng; true nếu đã dùng ≥ 90% tổng.

    Chỉ xét hai giá trị đầu — cột thứ ba (free) gần bằng tổng nghĩa là swap còn trống, không phải đầy.
    """
    m = re.search(r"swap:", text, re.IGNORECASE)
    if not m:
        return False
    sizes = [float(n) * _UNIT[u[0].lower()] for n, u in _SIZE.findall(text[m.end():m.end() + 80])[:2]]
    return len(sizes) == 2 and sizes[0] * 0.9 <= sizes[1] <= sizes[0]


@dataclass
class RuleMatch:
    code: str
    confidence: float
    evidence: list[str] = field(default_factory=list)


def classify_text(text: str) -> RuleMatch | None:
    """Trả mã lỗi có điểm cao nhất, hoặc None nếu không mẫu nào khớp."""
    if not text or not text.strip():
        return None
    best: RuleMatch | None = None
    for code, pats in _COMPILED.items():
        score, evidence = 0.0, []
        for rx, weight, label in pats:
            if rx.search(text):
                score += weight
                evidence.append(f"Khớp mẫu: {label}")
        if code == "RAM_SWAP_HIGH" and _swap_nearly_full(text):
            score += 0.7
            evidence.append("Khớp mẫu: Swap đã dùng >= 90% (free -h)")
        if score > 0 and (best is None or score > best.confidence):
            best = RuleMatch(code, min(1.0, round(score, 2)), evidence)
    return best
