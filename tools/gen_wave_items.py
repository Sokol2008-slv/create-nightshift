#!/usr/bin/env python3
"""Текстуры наград волн набега — перекраской ванильных (без платной генерации).
Заряд молнии — электрический голубой с жёлтыми искрами; электрическая медь — медь с голубым свечением;
ядро навигации — бордо/зелёный (бренд Axiomativ); звёздная кирка — бордо с денежно-зелёными бликами;
звёздный навигатор — перекраска компаса возврата в те же цвета."""
import pathlib, zipfile, io
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


def recolor(img, base, high=None, cut=1.0):
    base = [hexrgb(c) for c in base]
    high = [hexrgb(c) for c in high] if high else None
    px = [(x, y) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        t = (l - lo) / (hi - lo or 1)
        c = ramp(base, t / cut) if (high is None or t < cut) else ramp(high, (t - cut) / (1 - cut or 1))
        out.putpixel(p, c + (img.getpixel(p)[3],))
    return out


OUT.mkdir(parents=True, exist_ok=True)
recolor(van("fire_charge"), ["#0a1a3a", "#1f4fa8", "#4fb6ff"], ["#bfe9ff", "#fff27a"], 0.8).save(OUT / "lightning_charge.png")
recolor(van("copper_ingot"), ["#3a1a0c", "#9a4a24", "#d97a3c"], ["#7fe9ff", "#e0fbff"], 0.82).save(OUT / "electric_copper.png")
recolor(van("heart_of_the_sea"), ["#1c050b", "#5e1424", "#94243a"], ["#5d8f45", "#85bb65", "#c6e6a8"], 0.7).save(OUT / "navigation_core.png")
recolor(van("netherite_pickaxe"), ["#1c050b", "#4a0f1d", "#7a1a2e", "#a3283f"], ["#5d8f45", "#85bb65", "#c6e6a8"], 0.85).save(OUT / "star_pickaxe.png")
recolor(van("recovery_compass_00"), ["#1c050b", "#5e1424", "#7a1a2e", "#a3283f"], ["#5d8f45", "#85bb65", "#c6e6a8"], 0.75).save(OUT / "star_navigator.png")
print("текстуры наград волн готовы")
