#!/usr/bin/env python3
"""Текстуры модулей брони (01.10) — перекраской ванильных шаблонов кузни, без платной генерации.
Модуль — «карта»: тело шаблона в бордо, руна — денежный зелёный (цвета бренда Axiomativ). Руна у каждого модуля своя,
по смыслу: молния-пружина (bolt), подъём (raiser), путь (wayfinder), шпиль-прыжок (spire), страж (ward), глаз (eye).
Руну отделяем по цвету: в ванильных шаблонах она насыщенно-голубая, тело — серое/коричневое.
Предметы — kubejs/startup_scripts/vahta/70_armor_modules.js."""
import colorsys
import io
import pathlib
import zipfile

from PIL import Image

PACK = pathlib.Path(__file__).resolve().parent.parent
OUT = PACK / "kubejs/assets/nightshift/textures/item"
MC = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar"

WINE = ["#1c050b", "#3d0c18", "#5e1424", "#7a1a2e", "#a3283f"]
MONEY = ["#3f6a2e", "#85bb65", "#d9f2c4"]
DIM_WINE = ["#12040a", "#2a0a12", "#3d0c18", "#5e1424"]
DIM_MONEY = ["#2a3a22", "#4f6a3e", "#7f9a6a"]


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


def card(img, body, glyph):
    """Тело карты — палитра body по яркости, голубая руна — палитра glyph по яркости."""
    body, glyph = [hexrgb(c) for c in body], [hexrgb(c) for c in glyph]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    groups = {"b": [], "g": []}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            groups["g" if s > 0.35 and 0.42 < h < 0.72 and v > 0.3 else "b"].append((x, y))
    out = img.copy()
    for key, pal in (("b", body), ("g", glyph)):
        pts = groups[key]
        if not pts:
            continue
        ls = [lum(img.getpixel(p)) for p in pts]
        lo, hi = min(ls), max(ls)
        for p, l in zip(pts, ls):
            out.putpixel(p, ramp(pal, (l - lo) / (hi - lo or 1)) + (img.getpixel(p)[3],))
    return out


OUT.mkdir(parents=True, exist_ok=True)
MODULES = {
    "module_spring_boots": "bolt",
    "module_step_assist": "raiser",
    "module_sprint": "wayfinder",
    "module_jump_springs": "spire",
    "module_armor_plate": "ward",
    "module_night_vision": "eye",
}
for item, rune in MODULES.items():
    card(van(rune + "_armor_trim_smithing_template"), WINE, MONEY).save(OUT / (item + ".png"))
# заготовка модуля (сборка по шагам) — та же карта, но тусклая
card(van("host_armor_trim_smithing_template"), DIM_WINE, DIM_MONEY).save(OUT / "incomplete_armor_module.png")
print("текстуры модулей брони готовы")
