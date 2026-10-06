"""Đo hiệu năng + độ chính xác của vision LLM và embedding qua Ollama.

Chạy từ apps/ai-service (nên chạy TRÊN MÁY SẼ TRIỂN KHAI — số đo phụ thuộc phần cứng):

    .venv\\Scripts\\python scripts\\benchmark.py --model qwen2.5vl:7b --runs 3

Nguồn ảnh:
- Mặc định dùng ảnh thật trong data/error-images/<tài nguyên>/<mã lỗi>/ (nhãn = tên thư mục).
- Thiếu ảnh thật (hoặc --synthetic) thì tự vẽ ảnh chữ mô phỏng log lỗi — chỉ để kiểm tra chức năng/độ trễ,
  KHÔNG phản ánh độ chính xác với ảnh chụp thật.

Script không tự tải model: thiếu model sẽ in lệnh `ollama pull` để bạn tự chạy.
"""
import argparse
import base64
import io
import json
import os
import platform
import statistics
import sys
import time
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings  # noqa: E402
from app.knowledge import chunk, parse_markdown  # noqa: E402
from app.taxonomy import ERROR_TYPES  # noqa: E402
from app.vision import VisionUnavailable, build_prompt, parse_vision_json  # noqa: E402

SYNTHETIC_TEXT = {
    "RAM_OOM_KILLER": ["kernel: Out of memory: Killed process 4121 (java) total-vm:18432100kB",
                       "kernel: java invoked oom-killer: gfp_mask=0x100cca"],
    "RAM_JAVA_HEAP": ["Exception in thread \"main\" java.lang.OutOfMemoryError: Java heap space",
                      "    at com.soe.Worker.run(Worker.java:88)"],
    "RAM_SWAP_HIGH": ["              total   used   free", "Mem:          15Gi   14Gi  120Mi", "Swap:        8.0Gi  7.9Gi  100Mi  (99%)"],
    "RAM_LEAK": ["Memory growth detected: RSS 2.1GB -> 6.8GB in 6h", "possible memory leak in process api-server"],
    "CPU_HIGH_SUSTAINED": ["top - 02:10:11 up 12 days", "%Cpu(s): 99.6 us, 0.2 sy", "PID 3310 python3  CPU 100.0%"],
    "CPU_LOAD_AVG_HIGH": ["02:10:11 up 12 days, load average: 48.21, 45.10, 40.77", "nproc: 8"],
    "CPU_THERMAL_THROTTLE": ["CPU0: Package temperature above threshold, cpu clock throttled (total events = 912)"],
    "GPU_CUDA_OOM": ["RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB",
                     "(GPU 0; 24.00 GiB total capacity; 22.31 GiB already allocated)"],
    "GPU_OVERHEAT": ["GPU 0: Temp 91C  Pwr 300W", "Clocks Throttle Reasons: HW Thermal Slowdown : Active"],
    "GPU_XID_ERROR": ["NVRM: Xid (PCI:0000:3b:00): 79, pid=1234, GPU has fallen off the bus."],
    "GPU_ECC_ERROR": ["Volatile Uncorr. ECC : 3", "NVRM: uncorrectable ECC error detected on GPU 0"],
}


def render(lines: list[str]) -> bytes:
    img = Image.new("RGB", (1000, 120 + 34 * len(lines)), (20, 20, 24))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=22)
    for i, line in enumerate(lines):
        draw.text((20, 40 + 34 * i), line, fill=(235, 90, 90), font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def load_images(images_dir: Path, synthetic: bool) -> tuple[list[tuple[str, bytes, str]], str]:
    """Trả ([(tên, ảnh PNG, mã lỗi đúng)], nguồn)."""
    real = []
    if images_dir.exists() and not synthetic:
        for code in ERROR_TYPES:
            folder = images_dir / ERROR_TYPES[code].resource.lower() / code.lower()
            for p in sorted(folder.glob("*.*")) if folder.exists() else []:
                if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                    real.append((p.name, p.read_bytes(), code))
    if real:
        return real, "ảnh thật trong data/error-images"
    return [(f"{code}.png", render(lines), code) for code, lines in SYNTHETIC_TEXT.items()], "ảnh mô phỏng (vẽ chữ)"


def percentile(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(round(p * (len(s) - 1))))]


def main() -> int:
    cfg = Settings(_env_file=None)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=cfg.ollama_url)
    ap.add_argument("--model", default=cfg.vision_model)
    ap.add_argument("--embed-model", default=cfg.embed_model)
    ap.add_argument("--runs", type=int, default=1, help="số lần đo mỗi ảnh (sau 1 lần khởi động)")
    ap.add_argument("--limit", type=int, default=0, help="chỉ đo N ảnh đầu (0 = tất cả)")
    ap.add_argument("--synthetic", action="store_true", help="bỏ qua ảnh thật, dùng ảnh mô phỏng")
    ap.add_argument("--timeout", type=float, default=cfg.vision_timeout_s)
    ap.add_argument("--json", type=Path, help="ghi kết quả chi tiết ra file JSON")
    args = ap.parse_args()
    base = args.url.rstrip("/")

    print(f"Máy: {platform.processor() or platform.machine()} | {os.cpu_count()} luồng | {platform.platform()}")
    try:
        tags = httpx.get(f"{base}/api/tags", timeout=5).json()
    except httpx.HTTPError as exc:
        print(f"\nKhông kết nối được Ollama tại {base}: {exc}")
        print("Cài Ollama (https://ollama.com/download) hoặc: docker compose -f deploy/docker/docker-compose.yml up -d ollama")
        return 2
    installed = {m["name"] for m in tags.get("models", [])}

    def has(name: str) -> bool:
        return name in installed or f"{name}:latest" in installed

    missing = [m for m in (args.model, args.embed_model) if not has(m)]
    if missing:
        print("\nThiếu model: " + ", ".join(missing))
        for m in missing:
            print(f"  ollama pull {m}")
        return 2

    images, source = load_images(cfg.images_dir, args.synthetic)
    if args.limit:
        images = images[: args.limit]
    print(f"Vision: {args.model} | Nguồn ảnh: {source} ({len(images)} ảnh) | {args.runs} lần/ảnh\n")

    def classify(png: bytes):
        payload = {
            "model": args.model, "stream": False, "format": "json", "options": {"temperature": 0},
            "messages": [{"role": "user", "content": build_prompt("", ""),
                          "images": [base64.b64encode(png).decode()]}],
        }
        t0 = time.monotonic()
        resp = httpx.post(f"{base}/api/chat", json=payload, timeout=args.timeout)
        wall = time.monotonic() - t0
        resp.raise_for_status()
        data = resp.json()
        return wall, data, parse_vision_json(data["message"]["content"])

    # Khởi động: lần gọi đầu tính cả thời gian nạp model vào RAM
    print("Khởi động (nạp model)...", flush=True)
    try:
        warm, _, _ = classify(images[0][1])
    except (httpx.HTTPError, VisionUnavailable, KeyError) as exc:
        print(f"Lần gọi đầu thất bại: {exc}")
        return 1
    print(f"  lần đầu (gồm nạp model): {warm:.1f}s\n")

    rows, latencies, tps, correct, failed = [], [], [], 0, 0
    print(f"{'ảnh':28} {'đúng':22} {'dự đoán':22} {'conf':>5} {'giây':>7} {'tok/s':>6}")
    for name, png, expected in images:
        for _ in range(args.runs):
            try:
                wall, data, result = classify(png)
            except (httpx.HTTPError, VisionUnavailable, KeyError) as exc:
                failed += 1
                print(f"{name:28} {expected:22} LỖI: {exc}")
                continue
            ev_s = (data.get("eval_duration") or 0) / 1e9
            rate = (data.get("eval_count") or 0) / ev_s if ev_s else 0.0
            ok = result.code == expected
            correct += ok
            latencies.append(wall)
            tps.append(rate)
            rows.append({"image": name, "expected": expected, "predicted": result.code, "confidence": result.confidence,
                         "seconds": round(wall, 2), "tokens_per_s": round(rate, 1), "correct": ok,
                         "prompt_tokens": data.get("prompt_eval_count"), "output_tokens": data.get("eval_count")})
            print(f"{name[:28]:28} {expected:22} {result.code:22} {result.confidence:5.2f} {wall:7.1f} {rate:6.1f} "
                  f"{'' if ok else '✗'}")

    # Embedding: nạp toàn bộ runbook
    docs = [parse_markdown(p) for p in sorted(cfg.knowledge_dir.glob("*.md"))]
    texts = [c for d in docs for c in chunk(d)]
    emb_s = None
    if texts:
        t0 = time.monotonic()
        httpx.post(f"{base}/api/embed", json={"model": args.embed_model, "input": texts}, timeout=300).raise_for_status()
        emb_s = time.monotonic() - t0

    print("\n=== TỔNG KẾT ===")
    if latencies:
        n = len(latencies)
        p50, p95 = statistics.median(latencies), percentile(latencies, 0.95)
        print(f"Vision: {n} lần đo, {failed} lỗi | trung bình {statistics.mean(latencies):.1f}s | p50 {p50:.1f}s | "
              f"p95 {p95:.1f}s | tối đa {max(latencies):.1f}s | ~{statistics.mean(tps):.1f} token/s")
        print(f"Chính xác: {correct}/{n} = {100 * correct / n:.0f}%  ({source})")
        verdict = "ĐẠT" if p95 <= 120 else "KHÔNG ĐẠT"
        print(f"Yêu cầu NFR-AI-002 (vision ≤ 120 giây/ảnh): p95 = {p95:.1f}s → {verdict}")
    if emb_s is not None:
        print(f"Embedding: {len(texts)} đoạn runbook trong {emb_s:.1f}s")
    if args.json:
        args.json.write_text(json.dumps({"model": args.model, "source": source, "rows": rows}, ensure_ascii=False, indent=2),
                             encoding="utf-8")
        print(f"Đã ghi chi tiết: {args.json}")
    return 0 if latencies else 1


if __name__ == "__main__":
    sys.exit(main())
