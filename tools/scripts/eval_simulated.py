r"""Đo độ chính xác nhận diện trên ảnh mô phỏng trong data/error-images/simulated/ (nhãn = tên thư mục).
Chạy: apps\ai-service\.venv\Scripts\python tools\scripts\eval_simulated.py   (cần ai-service :8001)"""
import json, sys, urllib.request, uuid
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "data" / "error-images" / "simulated"


def diagnose(path: Path) -> dict:
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("http://localhost:8001/diagnose", body,
                                 {"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(req, timeout=300))


sys.stdout.reconfigure(encoding="utf-8")
per = defaultdict(lambda: [0, 0])
for p in sorted(ROOT.glob("*/*/*.*")):
    want = p.parent.name.upper()
    d = diagnose(p)
    ok = d["error_code"] == want
    per[want][0] += ok
    per[want][1] += 1
    print(("✓" if ok else "✗"), want.ljust(22), p.name.ljust(22), d["error_code"].ljust(22),
          f'{d["confidence"]:.2f}', d["decision"], d["source"], f'{d["elapsed_ms"]/1000:.0f}s', flush=True)
tot = sum(v[0] for v in per.values()); n = sum(v[1] for v in per.values())
print(f"\nĐúng {tot}/{n} ({100*tot/n:.0f}%)")
