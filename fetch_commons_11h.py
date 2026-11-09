# -*- coding: utf-8 -*-
"""fetch_commons_11h.py — 2026-11h 批次 Commons 真实照片下载
9 正选 + 6 备选；浏览器 UA、逐张 13s 间隔、429 退避 120s、魔法字节校验。
元数据从 commons_candidates_11h.json 读取，输出 commons_picks_11h.json。
"""
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "brand_real_11h"
OUT.mkdir(exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# 本地文件名 -> Commons File 标题（正选 9 + 备选 6）
PICKS = {
    # 主题 1 solar-flare-field：太阳实拍 / H-alpha / 太阳观测台
    "solar-flare-field-cover.jpg": "File:The Sun by the Atmospheric Imaging Assembly of NASA's Solar Dynamics Observatory - 20100819.jpg",
    "solar-flare-field-fig1.jpg": "File:Sun in Hydrogen Alpha - 12-27-16.jpg",
    "solar-flare-field-fig2.jpg": "File:Big Bear Solar Observatory domes.jpg",
    "solar-flare-field-alt1.jpg": "File:McMath-Pierce Solar Telescope with starfield.jpg",
    "solar-flare-field-alt2.jpg": "File:The Sun with sunspots (iau1508d).jpg",
    # 主题 2 gut-nad-precursor：菌落培养 / 结肠组织 / 细胞培养
    "gut-nad-precursor-cover.jpg": "File:Bacterial cell culture on agar plate (Microscope conformation).jpg",
    "gut-nad-precursor-fig1.jpg": "File:Colon, low mag.jpg",
    "gut-nad-precursor-fig2.jpg": "File:Bioreactor for cell culture in the laboratory.jpg",
    "gut-nad-precursor-alt1.jpg": "File:Sterile 24-Well Cell Culture Plate Used in Laboratory Research.jpg",
    "gut-nad-precursor-alt2.jpg": "File:Drosophila melanogaster laboratory culture-vial.jpg",
    # 主题 3 long-livephoto：手机双摄 / 摄像头模组 / 生活场景
    "long-livephoto-cover.jpg": "File:Motorola Moto X4 (X1900-7) - dual lens-9174.jpg",
    "long-livephoto-fig1.jpg": "File:SAMSUNG Galaxy S22 Ultra REAR CAMERA MODULES.jpg",
    "long-livephoto-fig2.jpg": "File:202606 A sports sandal and a smartphone on Shalun beach.jpg",
    "long-livephoto-alt1.jpg": "File:IPhone camera.jpeg",
    "long-livephoto-alt2.jpg": "File:Fairphone 3 modules on display.jpg",
}


def magic_ok(p):
    b = p.read_bytes()[:12]
    return (b.startswith(b"\xff\xd8\xff") or b.startswith(b"\x89PNG")
            or (b[:4] == b"RIFF" and b[8:12] == b"WEBP"))


def download(title, dest):
    name = title.replace("File:", "", 1).replace(" ", "_")
    url = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
           + urllib.parse.quote(name, safe="") + "?width=2000")
    cmd = ["curl", "-sSL", "--max-time", "120", "-A", UA,
           "-w", "%{http_code}", "-o", str(dest), url]
    for attempt in range(4):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=140)
            code = (r.stdout or "").strip()[-3:]
            if code == "200" and dest.exists() and magic_ok(dest) and dest.stat().st_size > 20000:
                return True, code, dest.stat().st_size
            if code == "429":
                print("    429 -> 冷却 120s", flush=True)
                time.sleep(120)
                continue
            print("    尝试 %d: code=%s size=%s" % (
                attempt + 1, code, dest.stat().st_size if dest.exists() else 0), flush=True)
        except Exception as e:
            print("    异常 %s" % e, flush=True)
        time.sleep(15)
    return False, code if 'code' in dir() else "?", 0


def main():
    cand = json.loads((ROOT / "commons_candidates_11h.json").read_text(encoding="utf8"))
    info = cand["info"]
    result = {}
    for i, (local, title) in enumerate(PICKS.items(), 1):
        meta = info.get(title)
        if not meta:
            print("[%02d] %-40s 元数据缺失！" % (i, local), flush=True)
            continue
        dest = OUT / local
        print("[%02d/15] %s" % (i, local), flush=True)
        if dest.exists() and magic_ok(dest) and dest.stat().st_size > 20000:
            print("    已存在，跳过 (%d KB)" % (dest.stat().st_size // 1024), flush=True)
        else:
            ok, code, size = download(title, dest)
            print("    %s code=%s %d KB" % ("OK" if ok else "FAIL", code, size // 1024), flush=True)
            if not ok:
                continue
        result[local] = {
            "title": title,
            "commons_page": meta.get("page"),
            "artist": meta.get("artist"),
            "license": meta.get("license"),
            "w": meta.get("w"), "h": meta.get("h"),
        }
        if i < len(PICKS):
            time.sleep(13)
    (ROOT / "commons_picks_11h.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf8")
    print("DONE %d/15" % len(result), flush=True)


if __name__ == "__main__":
    main()
