import pytest

from app.rules import classify_text


@pytest.mark.parametrize(
    "text,code",
    [
        ("RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB", "GPU_CUDA_OOM"),
        ("kernel: Out of memory: Killed process 1234 (java)", "RAM_OOM_KILLER"),
        ("Exception in thread main java.lang.OutOfMemoryError: Java heap space", "RAM_JAVA_HEAP"),
        ("NVRM: Xid (PCI:0000:3b:00): 79, GPU has fallen off the bus", "GPU_XID_ERROR"),
        ("Volatile Uncorr. ECC 3  uncorrectable ECC error", "GPU_ECC_ERROR"),
        ("CPU core 3: Package temperature above threshold, cpu clock throttled", "CPU_THERMAL_THROTTLE"),
    ],
)
def test_strong_patterns_reach_auto_threshold(text, code):
    m = classify_text(text)
    assert m is not None and m.code == code and m.confidence >= 0.85


def test_cuda_oom_is_not_mistaken_for_system_oom():
    assert classify_text("CUDA out of memory").code == "GPU_CUDA_OOM"


def test_no_match_returns_none():
    assert classify_text("hello world") is None
    assert classify_text("") is None


def test_weak_signal_stays_below_review_threshold():
    m = classify_text("load average")
    assert m is not None and m.confidence < 0.6
