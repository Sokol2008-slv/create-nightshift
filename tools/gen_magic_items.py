#!/usr/bin/env python3
"""Текстуры наших посохов (магия, 01.10) — перекраской ванильных, как tools/gen_wave_items.py (без платной генерации).
Древко — стержень блейза в цветах бренда (бордо), навершие — нарисованная сфера:
  - Посох молнии: бордо + электро-голубая сфера с жёлтой искрой;
  - Посох сплава: бордо + денежно-зелёная сфера (цвет межпланетного сплава);
  - Посох равновесия: графит/белое древко (стабилит) + сфера «инь-янь» — белое и бордо, зелёный блик.
Запуск: python3 tools/gen_magic_items.py"""
import io
import pathlib
import zipfile

from PIL import Image

PACK = pathlib.Path(__file__).resolve().parent.parent
OUT = PACK / "kubejs/assets/nightshift/textures/item"
MC = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar"


def van(name):
    with zipfile.ZipFile(MC) as z:
        return Image.open(io.BytesIO(z.read("assets/minecraft/textures/item/" + name + ".png"))).convert("RGBA")


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(stops, t):
    t = min(1.0, max(0.0, t))
    seg = t * (len(stops) - 1)
    i = min(int(seg), len(stops) - 2)
    f = seg - i
    a, b = stops[i], stops[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))


def recolor(img, stops):
    """Перекраска по яркости исходника в градиент stops (тёмный → светлый)."""
    stops = [hexrgb(c) for c in stops]
    px = [(x, y) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        out.putpixel(p, ramp(stops, (l - lo) / (hi - lo or 1)) + (255,))
    return out


# Сфера 6×6 в правом верхнем углу (поверх конца стержня). Символы: o — контур, d/m/l — тень/тон/свет, s — блик.
ORB = [
    ".oooo.",
    "odmmlo",
    "odmlso",
    "oddmlo",
    "odddmo",
    ".oooo.",
]
# «инь-янь»: Y — светлая половина, N — тёмная, s — блик
ORB_YY = [
    ".oooo.",
    "oNNYYo",
    "oNYYso",
    "oNNYYo",
    "oNNNYo",
    ".oooo.",
]


def staff(shaft_stops, orb_pal, orb=ORB, spark=None):
    img = recolor(van("blaze_rod"), shaft_stops)
    ox, oy = 10, 0  # левый верхний угол сферы
    # стираем верхний кончик стержня под сферой, чтобы он не торчал по краям
    for y in range(oy, oy + 6):
        for x in range(ox, min(16, ox + 6)):
            img.putpixel((x, y), (0, 0, 0, 0))
    for y, row in enumerate(orb):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            img.putpixel((ox + x, oy + y), hexrgb(orb_pal[ch]) + (255,))
    if spark:  # искра у сферы
        for (x, y) in spark[0]:
            img.putpixel((x, y), hexrgb(spark[1]) + (255,))
    return img


BORDEAUX = ["#1c050b", "#4a0f1d", "#7a1a2e", "#a3283f"]
OUT.mkdir(parents=True, exist_ok=True)
staff(BORDEAUX, {"o": "#0a1a3a", "d": "#1f4fa8", "m": "#4fb6ff", "l": "#bfe9ff", "s": "#fff27a"},
      spark=([(9, 2), (8, 1), (15, 6), (9, 6)], "#fff27a")).save(OUT / "lightning_staff.png")
staff(BORDEAUX, {"o": "#1c050b", "d": "#3f6b2e", "m": "#5d8f45", "l": "#85bb65", "s": "#e9ffd9"}).save(OUT / "alloy_staff.png")
staff(["#16161b", "#3c3c46", "#9ea3ad", "#eef0f4"], {"o": "#1c050b", "N": "#7a1a2e", "Y": "#eef0f4", "s": "#85bb65"},
      orb=ORB_YY).save(OUT / "balance_staff.png")
print("текстуры посохов готовы")
