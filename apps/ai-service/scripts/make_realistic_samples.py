"""Sinh ảnh lỗi MÔ PHỎNG trông như chụp màn hình / chụp màn hình bằng điện thoại (không phải ảnh thật).

Khác `benchmark.render` (chữ trơn trên nền đen): ảnh có cửa sổ terminal (thanh tiêu đề, prompt, log bình thường xen lẫn
dòng lỗi, dấu thời gian), mỗi mã lỗi hai biến thể — ảnh chụp màn hình sạch (.png) và ảnh "chụp màn hình bằng điện thoại"
(xoay nhẹ, mờ, nhiễu, viền tối, nén JPEG). Lưu tại data/error-images/simulated/<tài nguyên>/<mã>/ — KHÔNG nằm trong thư mục
`<tài nguyên>/<mã>/` mà benchmark coi là ảnh thật. Ảnh chụp từ máy thật vẫn là nguồn đánh giá độ chính xác đáng tin.

    .venv\\Scripts\\python scripts\\make_realistic_samples.py
"""
import csv
import datetime
import io
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.taxonomy import ERROR_TYPES  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "data" / "error-images" / "simulated"
FONT = next((p for p in ("C:/Windows/Fonts/CascadiaMono.ttf", "C:/Windows/Fonts/consola.ttf",
                         "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf") if Path(p).exists()), None)

# Mỗi mã: (host, dòng lệnh, danh sách dòng) — dòng bắt đầu bằng "!" là dòng lỗi (tô đỏ/vàng)
SCENES: dict[str, tuple[str, str, list[str]]] = {
    "RAM_OOM_KILLER": ("srv-app-03", "sudo dmesg -T | tail -n 14", [
        "[Mon Oct  5 02:14:07 2026] eth0: Link is Up - 10Gbps/Full",
        "[Mon Oct  5 02:31:44 2026] systemd[1]: Started Session 4412 of user ops.",
        "!{t} java invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0",
        "!{t} Mem-Info: active_anon:3811204 inactive_anon:112008 isolated_anon:0",
        "!{t} Out of memory: Killed process 4121 (java) total-vm:18432100kB, anon-rss:15882304kB",
        "!{t} oom_reaper: reaped process 4121 (java), now anon-rss:0kB, file-rss:0kB",
        "[Mon Oct  5 02:36:12 2026] systemd[1]: app-server.service: Main process exited, code=killed, status=9/KILL",
        "[Mon Oct  5 02:36:12 2026] systemd[1]: app-server.service: Failed with result 'signal'."]),
    "RAM_JAVA_HEAP": ("srv-app-01", "tail -n 16 /var/log/app/server.log", [
        "2026-10-05 09:12:41.220 INFO  [http-nio-8080-exec-4] c.s.OrderService - order 88213 accepted",
        "2026-10-05 09:12:42.004 WARN  [GC-monitor] c.s.Heap - old gen 96% used, GC pause 4.8s",
        "!2026-10-05 09:12:43.511 ERROR [http-nio-8080-exec-7] o.a.c.c.C.[.[.[/] - Servlet.service() threw",
        "!java.lang.OutOfMemoryError: Java heap space",
        "!    at java.base/java.util.Arrays.copyOf(Arrays.java:3512)",
        "!    at com.soe.report.ExportJob.collect(ExportJob.java:142)",
        "!    at com.soe.report.ExportJob.run(ExportJob.java:88)",
        "2026-10-05 09:12:43.980 INFO  [main] c.s.Shutdown - heap dump written to /var/dumps/java_pid2210.hprof"]),
    "RAM_SWAP_HIGH": ("srv-db-02", "free -h && vmstat 1 3", [
        "               total        used        free      shared  buff/cache   available",
        "!Mem:            15Gi        14Gi       112Mi       1.1Gi       820Mi       214Mi",
        "!Swap:          8.0Gi       7.9Gi       100Mi",
        "procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----",
        " r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st",
        "!12  9 8281088 114688  18240 840112 5120 9344  8210 10110 5120 9902 14 22  9 55  0",
        "!11 10 8283136 109312  18228 838988 4980 8800  8044  9870 4988 9760 12 24  8 56  0"]),
    "RAM_LEAK": ("srv-api-02", "ps -o pid,rss,etime,cmd -p 3077; tail -n 8 /var/log/memwatch.log", [
        "  PID   RSS     ELAPSED CMD",
        " 3077 7129088 2-04:11:09 /opt/api-server/bin/api-server --port 9000",
        "2026-10-05 00:00:01 memwatch: api-server RSS=2.1GB",
        "2026-10-05 02:00:01 memwatch: api-server RSS=3.4GB",
        "!2026-10-05 04:00:01 memwatch: api-server RSS=4.9GB (+1.5GB / 2h)",
        "!2026-10-05 06:00:01 memwatch: api-server RSS=6.8GB (+1.9GB / 2h)",
        "!2026-10-05 06:00:01 memwatch: WARNING possible memory leak in process api-server (monotonic growth 6h)"]),
    "CPU_HIGH_SUSTAINED": ("srv-batch-01", "top -b -n 1 | head -n 12", [
        "top - 02:10:11 up 12 days,  4:02,  2 users,  load average: 15.92, 15.30, 14.88",
        "Tasks: 312 total,   3 running, 309 sleeping,   0 stopped,   0 zombie",
        "!%Cpu(s): 99.6 us,  0.2 sy,  0.0 ni,  0.1 id,  0.0 wa,  0.0 hi,  0.1 si,  0.0 st",
        "MiB Mem :  15953.1 total,   6120.4 free,   7011.9 used,   2820.8 buff/cache",
        "    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND",
        "!   3310 ops       20   0 4212244   1.8g  21344 R 100.0  11.6  1842:17 python3",
        "!   3311 ops       20   0 4212244   1.7g  21344 R  99.7  11.1  1841:55 python3",
        "!   3312 ops       20   0 4108120   1.6g  21344 R  99.3  10.4  1839:02 python3",
        "    921 root      20   0  234112  18420  11204 S   0.7   0.1   2:14.90 rsyslogd"]),
    "CPU_LOAD_AVG_HIGH": ("srv-web-04", "uptime; nproc; ps -eo stat | grep -c '^D'", [
        "!02:10:11 up 12 days,  4:02,  2 users,  load average: 48.21, 45.10, 40.77",
        "8",
        "!37",
        "sar -q 1 3",
        "Linux 5.15.0-91-generic (srv-web-04)  10/05/2026  _x86_64_  (8 CPU)",
        "!02:10:12  runq-sz  plist-sz   ldavg-1   ldavg-5  ldavg-15   blocked",
        "!02:10:13       41       612     48.21     45.10     40.77        37"]),
    "CPU_THERMAL_THROTTLE": ("srv-edge-01", "sudo dmesg -T | grep -i thermal | tail -n 8", [
        "[Mon Oct  5 01:58:20 2026] intel_pstate: Turbo disabled by BIOS or unavailable on processor",
        "!{t} CPU0: Core temperature above threshold, cpu clock throttled (total events = 912)",
        "!{t} CPU4: Core temperature above threshold, cpu clock throttled (total events = 912)",
        "!{t} CPU0: Package temperature above threshold, cpu clock throttled (total events = 4107)",
        "{t} CPU0: Core temperature/speed normal",
        "!{t} CPU2: Package temperature above threshold, cpu clock throttled (total events = 4108)"]),
    "GPU_CUDA_OOM": ("gpu-train-01", "python train.py --epochs 40 --batch-size 64", [
        "Epoch 12/40: 100%|██████████| 780/780 [04:11<00:00,  3.1it/s, loss=0.412]",
        "Epoch 13/40:  62%|██████▏   | 482/780 [02:34<01:35,  3.1it/s, loss=0.398]",
        "Traceback (most recent call last):",
        '  File "train.py", line 88, in <module>',
        "    loss = model(batch).mean()",
        '  File "/opt/venv/lib/python3.10/site-packages/torch/nn/modules/module.py", line 1501, in _call_impl',
        "!torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB",
        "!(GPU 0; 24.00 GiB total capacity; 22.31 GiB already allocated; 1.12 GiB free; 22.80 GiB reserved)"]),
    "GPU_OVERHEAT": ("gpu-train-02", "nvidia-smi -q -d TEMPERATURE,PERFORMANCE | head -n 18", [
        "==============NVSMI LOG==============",
        "Attached GPUs                             : 1",
        "GPU 00000000:3B:00.0",
        "    Temperature",
        "!        GPU Current Temp                  : 91 C",
        "        GPU Shutdown Temp                 : 100 C",
        "!        GPU Slowdown Temp                 : 90 C",
        "    Clocks Throttle Reasons",
        "!        HW Slowdown                       : Active",
        "!        HW Thermal Slowdown               : Active",
        "        SW Power Cap                      : Not Active"]),
    "GPU_XID_ERROR": ("gpu-infer-01", "sudo dmesg -T | grep -i nvrm | tail -n 6", [
        "[Mon Oct  5 03:02:10 2026] NVRM: loading NVIDIA UNIX x86_64 Kernel Module  535.129.03",
        "!{t} NVRM: Xid (PCI:0000:3b:00): 79, pid=1234, name=python, GPU has fallen off the bus.",
        "!{t} NVRM: GPU 0000:3b:00.0: GPU has fallen off the bus.",
        "!{t} NVRM: A GPU crash dump has been created. If possible, please run",
        "{t} NVRM: nvidia-bug-report.sh as root to collect this data before",
        "{t} NVRM: the NVIDIA kernel module is unloaded."]),
    "GPU_ECC_ERROR": ("gpu-train-03", "nvidia-smi -q -d ECC | head -n 16", [
        "GPU 00000000:3B:00.0",
        "    Ecc Mode",
        "        Current                           : Enabled",
        "    ECC Errors",
        "        Volatile",
        "            SRAM Correctable              : 0",
        "!            DRAM Correctable              : 17",
        "!            DRAM Uncorrectable            : 3",
        "!{t} NVRM: uncorrectable ECC error detected on GPU 0, Volatile Uncorr. ECC : 3"]),
}

STYLES = {  # nền, chữ thường, chữ lỗi, thanh tiêu đề, chữ tiêu đề
    "ubuntu": ((48, 10, 36), (238, 238, 236), (255, 110, 100), (60, 56, 54), (223, 219, 210)),
    "dark": ((12, 12, 12), (204, 204, 204), (241, 92, 92), (31, 31, 31), (230, 230, 230)),
    "solar": ((0, 43, 54), (147, 161, 161), (220, 100, 70), (7, 54, 66), (200, 210, 210)),
}


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.truetype(FONT, size) if FONT else ImageFont.load_default(size=size)


def screenshot(code: str, style: str, rng: random.Random) -> Image.Image:
    host, cmd, lines = SCENES[code]
    bg, fg, err, bar, bar_fg = STYLES[style]
    f, fs = font(17), font(14)
    t = f"[Mon Oct  5 03:{rng.randint(10, 58):02d}:{rng.randint(0, 59):02d} 2026]"
    prompt = f"ops@{host}:~$ "
    rows = [(prompt + cmd, fg)] + [((l[1:] if l.startswith("!") else l).replace("{t}", t),
                                    err if l.startswith("!") else fg) for l in lines] + [(prompt, fg)]
    cw = int(f.getlength("M"))
    width = min(1500, max(900, max(len(r[0]) for r in rows) * cw + 48))
    height = 44 + 26 * len(rows) + 20
    img = Image.new("RGB", (width, height), bg)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, width, 34], fill=bar)
    for i, c in enumerate(((237, 106, 94), (245, 191, 79), (97, 197, 84))):
        d.ellipse([14 + i * 22, 11, 26 + i * 22, 23], fill=c)
    d.text((width // 2 - 110, 8), f"ops@{host}: ~", fill=bar_fg, font=fs)
    for i, (text, color) in enumerate(rows):
        d.text((16, 46 + 26 * i), text[: (width - 32) // cw], fill=color, font=f)
    d.rectangle([16 + cw * len(rows[-1][0]), 48 + 26 * (len(rows) - 1), 16 + cw * (len(rows[-1][0]) + 1),
                 48 + 26 * (len(rows) - 1) + 18], fill=fg)  # con trỏ
    return img


def photo_effect(img: Image.Image, rng: random.Random) -> Image.Image:
    """Giả lập chụp màn hình bằng điện thoại: nền bàn, xoay nhẹ, mờ, nhiễu, tối góc."""
    w, h = img.size
    canvas = Image.new("RGB", (int(w * 1.18), int(h * 1.3)), (38, 34, 32))
    canvas.paste(img.filter(ImageFilter.GaussianBlur(0.7)), (int(w * 0.09), int(h * 0.15)))
    canvas = canvas.rotate(rng.uniform(-2.2, 2.2), resample=Image.BICUBIC, fillcolor=(30, 28, 27), expand=False)
    cw, ch = canvas.size
    noise = Image.effect_noise((cw, ch), 18).convert("RGB")
    canvas = Image.blend(canvas, noise, 0.07)
    vignette = Image.radial_gradient("L").resize((cw, ch))
    dark = Image.new("RGB", (cw, ch), (0, 0, 0))
    canvas = Image.composite(dark, canvas, vignette.point(lambda v: int(v * 0.45)))
    return canvas.resize((int(cw * 0.85), int(ch * 0.85)), Image.LANCZOS)


def main() -> int:
    rng = random.Random(20261005)
    rows = []
    for code, etype in ERROR_TYPES.items():
        folder = OUT / etype.resource.lower() / code.lower()
        folder.mkdir(parents=True, exist_ok=True)
        for n, style in enumerate(("ubuntu", "dark", "solar")):
            shot = screenshot(code, style, rng)
            variants = {f"{style}-screenshot.png": shot}
            if n < 2:  # hai biến thể "chụp bằng điện thoại"
                buf = io.BytesIO()
                photo_effect(shot, rng).save(buf, format="JPEG", quality=rng.randint(72, 82))
                variants[f"{style}-photo.jpg"] = Image.open(io.BytesIO(buf.getvalue()))
                (folder / f"{style}-photo.jpg").write_bytes(buf.getvalue())
            shot.save(folder / f"{style}-screenshot.png")
            for name in variants:
                rows.append([f"simulated/{etype.resource.lower()}/{code.lower()}/{name}", code, etype.resource,
                             "mô phỏng bằng scripts/make_realistic_samples.py", "CC0 (tự sinh)",
                             datetime.date.today().isoformat(), "script"])
    manifest = REPO / "data" / "error-images" / "manifest.csv"
    existing = manifest.read_text(encoding="utf-8") if manifest.exists() else ""
    with manifest.open("a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        for r in rows:
            if r[0] not in existing:
                w.writerow(r)
    print(f"Đã tạo {len(rows)} ảnh tại {OUT}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
