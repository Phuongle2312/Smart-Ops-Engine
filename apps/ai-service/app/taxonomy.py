"""Phân loại lỗi — nguồn duy nhất (xem docs/ai-diagnosis/SRS.md mục 2)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ErrorType:
    code: str
    resource: str  # RAM | CPU | GPU | NONE
    severity: str  # critical | high | medium | low
    description: str


ERROR_TYPES: dict[str, ErrorType] = {
    t.code: t
    for t in [
        ErrorType("RAM_OOM_KILLER", "RAM", "critical", "Kernel OOM killer kết thúc tiến trình"),
        ErrorType("RAM_JAVA_HEAP", "RAM", "high", "java.lang.OutOfMemoryError (heap / GC overhead)"),
        ErrorType("RAM_SWAP_HIGH", "RAM", "medium", "Swap sử dụng cao, hệ thống chậm"),
        ErrorType("RAM_LEAK", "RAM", "high", "Bộ nhớ tăng liên tục, nghi rò rỉ"),
        ErrorType("CPU_HIGH_SUSTAINED", "CPU", "high", "CPU ~100% kéo dài"),
        ErrorType("CPU_LOAD_AVG_HIGH", "CPU", "medium", "Load average vượt số core"),
        ErrorType("CPU_THERMAL_THROTTLE", "CPU", "high", "CPU giảm xung vì nhiệt"),
        ErrorType("GPU_CUDA_OOM", "GPU", "critical", "CUDA out of memory"),
        ErrorType("GPU_OVERHEAT", "GPU", "high", "GPU nhiệt độ cao / thermal slowdown"),
        ErrorType("GPU_XID_ERROR", "GPU", "critical", "NVRM Xid (driver / phần cứng)"),
        ErrorType("GPU_ECC_ERROR", "GPU", "critical", "Lỗi ECC bộ nhớ GPU"),
    ]
}

UNKNOWN = ErrorType("UNKNOWN", "NONE", "low", "Không nhận diện được")


def get_type(code: str) -> ErrorType:
    """Trả ErrorType theo mã; mã ngoài taxonomy → UNKNOWN."""
    return ERROR_TYPES.get(code, UNKNOWN)
