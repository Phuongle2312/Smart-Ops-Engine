"""Kiểm thử đầu-cuối: ảnh lỗi -> nhận diện (ai-service) -> incident -> email cảnh báo (ảnh + cách xử lý).

Chạy bằng Python của ai-service (có Pillow), từ gốc repo:

    apps\\ai-service\\.venv\\Scripts\\python tools\\scripts\\e2e_diagnosis.py

Điều kiện: ai-service chạy ở :8001 (docker compose local) và Ollama đang chạy.
Script tự: mở SMTP giả (127.0.0.1:2525, KHÔNG gửi email thật), chạy backend profile dev (H2), tạo node + người phụ trách,
đẩy ảnh qua POST /api/diagnose, đọc email nhận được, kiểm tra nội dung rồi tắt backend.
Email lưu ở tools/scripts/e2e-output/ (.eml + .html xem được bằng trình duyệt).

Gửi THẬT: thêm `--real --to <email>` và đặt trước biến môi trường SMTP_HOST/SMTP_PORT/SMTP_AUTH/SMTP_STARTTLS/
SMTP_USERNAME/SMTP_PASSWORD (xem apps/backend/.env.example). Không mở SMTP giả; kết quả xác nhận qua log backend.
"""
import email
import argparse
import email.policy
import io
import json
import os
import re
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "e2e-output"
BACKEND = "http://localhost:8080"
OWNER = "owner.a@test.local"
ADMIN = "admin@test.local"


SIM = REPO / "data" / "error-images" / "simulated"
_RES = {"RAM": "ram", "GPU": "gpu", "CPU": "cpu"}


def sample_image(code: str) -> bytes:
    """Ảnh mô phỏng 'chụp bằng điện thoại' (xem apps/ai-service/scripts/make_realistic_samples.py)."""
    path = SIM / _RES[code.split("_")[0]] / code.lower() / "ubuntu-photo.jpg"
    if not path.exists():
        raise SystemExit(f"Thiếu {path} — chạy apps/ai-service/scripts/make_realistic_samples.py trước.")
    return path.read_bytes()

# (mã lỗi mong đợi, nhãn)
CASES = ["RAM_OOM_KILLER", "GPU_CUDA_OOM", "CPU_HIGH_SUSTAINED"]


class _Sink(socketserver.StreamRequestHandler):
    mails: list[bytes] = []

    def handle(self):
        w = lambda s: self.wfile.write((s + "\r\n").encode())  # noqa: E731
        w("220 sink")
        while line := self.rfile.readline():
            cmd = line.decode(errors="replace").strip().upper()
            if cmd.startswith("DATA"):
                w("354 go")
                buf = []
                while (row := self.rfile.readline()) not in (b".\r\n", b""):
                    buf.append(row)
                _Sink.mails.append(b"".join(buf))
                w("250 queued")
            elif cmd.startswith("QUIT"):
                w("221 bye")
                return
            else:
                w("250 ok")


def http(method, path, body=None, headers=None, timeout=30):
    req = urllib.request.Request(BACKEND + path, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return r.status, (json.loads(raw) if raw[:1] in (b"{", b"[") else raw)


def post_json(path, obj):
    return http("POST", path, json.dumps(obj).encode(), {"Content-Type": "application/json"})


def post_image(node_id: int, png: bytes, name: str):
    b = "----e2e"
    parts = (f'--{b}\r\nContent-Disposition: form-data; name="nodeId"\r\n\r\n{node_id}\r\n'
             f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
             f'Content-Type: image/jpeg\r\n\r\n').encode() + png + f"\r\n--{b}--\r\n".encode()
    return http("POST", "/api/diagnose", parts, {"Content-Type": f"multipart/form-data; boundary={b}"})


def _subject(mail: bytes) -> str:
    return email.message_from_bytes(mail, policy=email.policy.default)["Subject"]


def check(mail: bytes, code: str, png: bytes) -> list[tuple[str, bool]]:
    msg = email.message_from_bytes(mail, policy=email.policy.default)
    html = msg.get_body(preferencelist=("html",)).get_content()
    inline = [p for p in msg.walk() if (p.get("Content-ID") or "").strip("<>") == "error-image"]
    return [
        ("gửi đúng người phụ trách", OWNER in (msg["To"] or "")),
        ("tiêu đề có mã lỗi", code in (msg["Subject"] or "")),
        ("có ảnh lỗi nhúng, đúng byte gốc", bool(inline) and inline[0].get_payload(decode=True) == png),
        ("HTML tham chiếu ảnh (cid:error-image)", "cid:error-image" in html),
        ("có mục 'Hướng xử lý'", "Hướng xử lý" in html),
        ("runbook có tiêu đề + danh sách", "<h4" in html and "<li>" in html),
    ]


def save(mail: bytes, code: str, png: bytes):
    OUT.mkdir(exist_ok=True)
    (OUT / f"{code}.eml").write_bytes(mail)
    msg = email.message_from_bytes(mail, policy=email.policy.default)
    html = msg.get_body(preferencelist=("html",)).get_content()
    import base64
    html = html.replace("cid:error-image", "data:image/jpeg;base64," + base64.b64encode(png).decode())
    (OUT / f"{code}.html").write_text(html, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--real", action="store_true", help="gửi email thật qua SMTP trong biến môi trường")
    ap.add_argument("--to", default="", help="email người phụ trách nhận (bắt buộc với --real)")
    args = ap.parse_args()
    if args.real:
        return main_real(args)
    try:
        urllib.request.urlopen("http://localhost:8001/health", timeout=5)
    except Exception:
        print("ai-service chưa chạy ở :8001 — bật docker compose local trước.")
        return 2

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    sink = socketserver.ThreadingTCPServer(("127.0.0.1", 2525), _Sink)
    threading.Thread(target=sink.serve_forever, daemon=True).start()

    env = {**os.environ, "SMTP_HOST": "127.0.0.1", "SMTP_PORT": "2525", "ALERT_RECIPIENT_EMAIL": ADMIN}
    backend = subprocess.Popen(
        ["cmd", "/c", str(REPO / "apps/backend/mvnw.cmd"), "-q", "spring-boot:run", "-Dspring-boot.run.profiles=dev"],
        cwd=REPO / "apps/backend", env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
    failed = 0
    try:
        print("Đang chờ backend khởi động...")
        for _ in range(60):
            try:
                http("GET", "/api/nodes", timeout=3)
                break
            except Exception:
                time.sleep(3)
        else:
            print("Backend không khởi động được.")
            return 2

        _, node = post_json("/api/nodes", {"name": "srv-e2e-01", "host": "10.0.0.9", "port": 22,
                                           "username": "ops", "password": "x", "description": "e2e"})
        post_json(f"/api/nodes/{node['id']}/owners", {"fullName": "Người Phụ Trách", "email": OWNER, "escalationOrder": 1})

        images = {c: sample_image(c) for c in CASES}
        for code, png in images.items():
            status, _ = post_image(node["id"], png, f"{code}.jpg")
            print(f"gửi ảnh {code}: HTTP {status}")

        deadline = time.time() + 300
        while len(_Sink.mails) < len(CASES) and time.time() < deadline:
            time.sleep(3)
        print(f"\nNhận {len(_Sink.mails)}/{len(CASES)} email\n")

        for code in CASES:
            png = images[code]
            mail = next((m for m in _Sink.mails if code in (_subject(m) or "")), None)
            print(f"== {code}")
            if mail is None:
                print("   ✗ không thấy email (có thể nhận diện sai mã lỗi)")
                failed += 1
                continue
            save(mail, code, png)
            for label, ok in check(mail, code, png):
                print(f"   {'✓' if ok else '✗'} {label}")
                failed += not ok
        _, incidents = http("GET", "/api/incidents")
        print("\nIncident:", [(i["incidentType"], i.get("aiConfidence")) for i in incidents])
        print(f"Email xem được tại: {OUT}")
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend.pid)], capture_output=True)
        sink.shutdown()
    print("\nKẾT QUẢ:", "ĐẠT" if not failed else f"{failed} kiểm tra lỗi")
    return 1 if failed else 0


def main_real(args) -> int:
    global OWNER
    if not args.to or not os.environ.get("SMTP_HOST"):
        print("Cần --to <email> và biến môi trường SMTP_HOST (và SMTP_USERNAME/SMTP_PASSWORD nếu SMTP yêu cầu).")
        return 2
    try:
        urllib.request.urlopen("http://localhost:8001/health", timeout=5)
    except Exception:
        print("ai-service chưa chạy ở :8001.")
        return 2
    OWNER = args.to
    log = OUT / "backend-real.log"
    OUT.mkdir(exist_ok=True)
    env = {**os.environ, "ALERT_RECIPIENT_EMAIL": os.environ.get("ALERT_RECIPIENT_EMAIL") or args.to}
    with log.open("w", encoding="utf-8") as lf:
        backend = subprocess.Popen(
            ["cmd", "/c", str(REPO / "apps/backend/mvnw.cmd"), "-q", "spring-boot:run", "-Dspring-boot.run.profiles=dev"],
            cwd=REPO / "apps/backend", env=env, stdout=lf, stderr=subprocess.STDOUT)
        try:
            for _ in range(60):
                try:
                    http("GET", "/api/nodes", timeout=3)
                    break
                except Exception:
                    time.sleep(3)
            _, node = post_json("/api/nodes", {"name": "srv-e2e-01", "host": "10.0.0.9", "port": 22,
                                               "username": "ops", "password": "x", "description": "e2e"})
            post_json(f"/api/nodes/{node['id']}/owners", {"fullName": "Người nhận thử", "email": OWNER, "escalationOrder": 1})
            for code in CASES:
                status, _ = post_image(node["id"], sample_image(code), f"{code}.jpg")
                print(f"gửi ảnh {code}: HTTP {status}")
            deadline = time.time() + 300
            sent = failed = 0
            while sent + failed < len(CASES) and time.time() < deadline:
                time.sleep(3)
                txt = log.read_text(encoding="utf-8", errors="replace")
                sent = txt.count("[EMAIL] Diagnosis report sent")
                failed = txt.count("Gửi email chẩn đoán thất bại")
        finally:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend.pid)], capture_output=True)
    print(f"\nĐã gửi: {sent}/{len(CASES)} email tới {OWNER}; lỗi SMTP: {failed}")
    return 0 if sent == len(CASES) else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
