#!/usr/bin/env python3
"""Ночное небо «Ночной смены» (3.4.0, 05.10.2026): текстуры звездопада.

Запуск: python3 tools/gen_starfall.py  (нужен Pillow; ванильный клиент берётся из кэша tools/planet_jars.py)

Выход:
  kubejs/assets/nightshift/textures/block/fallen_star.png — упавшая звезда (светится, бьётся рукой до рассвета)
  kubejs/assets/nightshift/textures/block/star_lamp.png   — звёздный фонарь (латунная рамка, звёздная пыль)
  kubejs/assets/nightshift/textures/item/star_shard.png   — звёздный осколок
  kubejs/assets/nightshift/textures/item/deposit_atlas.png — атлас месторождений (shift/20_atlas.js)
Логика — kubejs/server_scripts/sky/40_night_sky.js, блоки — kubejs/startup_scripts/sky/20_night_sky_blocks.js.
"""
import math
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gen_sky import hexrgb, jar, load_png, ramp, recolor  # noqa: E402

PACK = pathlib.Path(__file__).resolve().parent.parent
TEX_BLOCK = PACK / "kubejs/assets/nightshift/textures/block"
TEX_ITEM = PACK / "kubejs/assets/nightshift/textures/item"


def fallen_star(van):
    # основа — светокамень, перекрашенный в холодный звёздный свет; поверх — четырёхлучевая звезда
    base = recolor(load_png(van, "assets/minecraft/textures/block/glowstone.png"),
                   ["#0b1430", "#2b4f9e", "#7fb6ff"], ["#d9f2ff", "#ffffff"], 0.7)
    out = base.copy()
    cx, cy = 7.5, 7.5
    for y in range(16):
        for x in range(16):
            dx, dy = abs(x - cx), abs(y - cy)
            # лучи креста и диагоналей, ядро
            ray = max(0.0, 1 - dx / 1.1) * max(0.0, 1 - dy / 8) + max(0.0, 1 - dy / 1.1) * max(0.0, 1 - dx / 8)
            diag = max(0.0, 1 - abs(dx - dy) / 1.0) * max(0.0, 1 - (dx + dy) / 9)
            core = max(0.0, 1 - math.hypot(dx, dy) / 3.2)
            k = min(1.0, ray * 1.2 + diag * 0.55 + core * 1.4)
            if k <= 0.05:
                continue
            src = out.getpixel((x, y))[:3]
            c = ramp([hexrgb("#9fd8ff"), hexrgb("#fff6c8"), hexrgb("#ffffff")], k)
            w = min(1.0, k * 1.3)
            out.putpixel((x, y), tuple(round(src[i] + (c[i] - src[i]) * w) for i in range(3)) + (255,))
    out.save(TEX_BLOCK / "fallen_star.png")


def star_shard(van):
    # осколок аметиста в цветах упавшей звезды: холодная синева и белое ядро
    img = recolor(load_png(van, "assets/minecraft/textures/item/amethyst_shard.png"),
                  ["#1b2a6b", "#4f86e8", "#b9e2ff"], ["#fff6c8", "#ffffff"], 0.74)
    img.save(TEX_ITEM / "star_shard.png")


def star_lamp(van):
    # латунная рамка в стиле Create, внутри — тёмное стекло и облако звёздной пыли со свечением к центру
    img = Image.new("RGBA", (16, 16))
    brass = [hexrgb("#6b4a1c"), hexrgb("#b4883c"), hexrgb("#f0c870")]
    for y in range(16):
        for x in range(16):
            edge = x in (0, 15) or y in (0, 15)
            if edge:
                t = 0.85 if (x == 0 or y == 0) else 0.25
                img.putpixel((x, y), ramp(brass, t) + (255,))
                continue
            d = math.hypot(x - 7.5, y - 7.5) / 7.5
            n = ((x * 37 + y * 91) % 17) / 17 * 0.12
            c = ramp([hexrgb("#e9f6ff"), hexrgb("#7fb2f2"), hexrgb("#24357a"), hexrgb("#121a40")], min(1.0, d * 0.95 + n))
            img.putpixel((x, y), c + (255,))
    for (x, y) in [(1, 1), (14, 1), (1, 14), (14, 14)]:
        img.putpixel((x, y), hexrgb("#f0c870") + (255,))  # заклёпки
    for (x, y, c) in [(4, 5, "#fff8d6"), (11, 4, "#ffffff"), (10, 11, "#fff3b0"), (4, 11, "#ffffff"), (7, 3, "#cfe9ff"), (12, 8, "#fff8d6")]:
        img.putpixel((x, y), hexrgb(c) + (255,))
    img.save(TEX_BLOCK / "star_lamp.png")


def deposit_atlas(van):
    # ванильная заполненная карта: рамка — в латунь вахты, на поле — цветные метки месторождений
    src = load_png(van, "assets/minecraft/textures/item/filled_map.png")
    img = src.copy()
    for y in range(16):
        for x in range(16):
            r, g, b, a = src.getpixel((x, y))
            if a and max(r, g, b) < 120:  # тёмная рамка и линии
                img.putpixel((x, y), ramp([hexrgb("#4a2f12"), hexrgb("#b4883c")], (r + g + b) / 360) + (a,))
    for (x, y, c) in [(5, 6, "#e0342a"), (10, 5, "#e0342a"), (8, 9, "#2aa4e0"), (6, 11, "#36c25a"), (11, 10, "#e0c32a")]:
        img.putpixel((x, y), hexrgb(c) + (255,))
    img.save(TEX_ITEM / "deposit_atlas.png")


def main():
    van = jar("minecraft")
    TEX_BLOCK.mkdir(parents=True, exist_ok=True)
    TEX_ITEM.mkdir(parents=True, exist_ok=True)
    fallen_star(van)
    star_shard(van)
    star_lamp(van)
    deposit_atlas(van)
    print("текстуры звездопада готовы")


if __name__ == "__main__":
    main()
