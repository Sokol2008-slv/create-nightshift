#!/usr/bin/env python3
"""Иконки «Развлечений смены» (05.10.2026, поток T): Маяк трассы и Ящик снабжения. 16×16, рисуются кодом.

Маяк трассы — бирюзовое кольцо трассы (с бликом сверху), внутри — клетчатый финишный флажок на латунном древке.
Ящик снабжения — деревянный ящик в стальных уголках, поперёк — изумрудная лента Axiomativ, на ней бордовая печать «?».

Запуск: python3 tools/gen_fun_items.py → kubejs/assets/nightshift/textures/item/{race_beacon,supply_crate}.png
"""
import math
import pathlib

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / "kubejs/assets/nightshift/textures/item"
CLEAR = (0, 0, 0, 0)


def hexrgb(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def pal(*hexes):
    return [hexrgb(h) for h in hexes]


TEAL = pal("#0d3b3f", "#14605f", "#1f8a83", "#2fb7a8", "#6fe3d2", "#c8fff6")
BRASS = pal("#4a3205", "#7a5408", "#b07d0c", "#d9a514", "#f2c623", "#fff3b0")
WOOD = pal("#3b2412", "#563419", "#734722", "#8f5b2d", "#a8703a", "#c08a4f")
STEEL = pal("#1c1f22", "#2e3338", "#434a51", "#5d666f", "#848e97", "#c3cbd2")
EMERALD = pal("#0f3d2f", "#1b6b52", "#2a8c6c", "#3daa88", "#7fd4b6")
BORDO = pal("#4a1218", "#7a1f28", "#a52c37", "#c53a47", "#e0707a")
WHITE = hexrgb("#f4f4f4")
BLACK = hexrgb("#1a1a1a")


def px(img, x, y, c):
    if 0 <= x < 16 and 0 <= y < 16:
        img.putpixel((x, y), c)


def rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            px(img, x, y, c)


def race_beacon():
    img = Image.new("RGBA", (16, 16), CLEAR)
    cx, cy = 7.5, 7.5
    # кольцо: толщина ~1.6 пикселя, свет сверху-слева
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - cx, y - cy)
            if 5.4 <= d <= 7.2:
                ang = math.atan2(y - cy, x - cx)  # −π…π, вверх — отрицательный y
                light = -math.sin(ang) * 0.6 - math.cos(ang) * 0.4  # 1 — сверху-слева
                k = 2 + round(light * 2)
                if d > 6.7:
                    k -= 1
                px(img, x, y, TEAL[max(0, min(5, k))])
    # блик
    for x, y in ((4, 2), (5, 1), (3, 3)):
        px(img, x, y, TEAL[5])
    # древко флажка
    for y in range(4, 12):
        px(img, 6, y, BRASS[3] if y < 8 else BRASS[2])
    px(img, 6, 12, BRASS[1])
    # клетчатый флажок 4×3
    for fy in range(3):
        for fx in range(4):
            c = WHITE if (fx + fy) % 2 == 0 else BLACK
            px(img, 7 + fx, 4 + fy, c)
    # «колыхание» нижнего края
    px(img, 10, 7, BLACK)
    return img


def supply_crate():
    img = Image.new("RGBA", (16, 16), CLEAR)
    # корпус 14×12
    rect(img, 1, 3, 15, 15, WOOD[3])
    # доски: горизонтальные щели
    for y in (6, 9, 12):
        for x in range(1, 15):
            px(img, x, y, WOOD[1])
    # волокна
    for x, y in ((3, 4), (9, 5), (12, 7), (4, 8), (10, 10), (2, 11), (7, 13), (13, 13)):
        px(img, x, y, WOOD[4])
    # крышка чуть светлее
    rect(img, 1, 2, 15, 4, WOOD[4])
    for x in range(1, 15):
        px(img, x, 2, WOOD[5])
        px(img, x, 14, WOOD[0])
    for y in range(2, 15):
        px(img, 1, y, WOOD[2] if y > 2 else WOOD[5])
        px(img, 14, y, WOOD[1])
    # стальные уголки
    for (x, y) in ((1, 2), (14, 2), (1, 14), (14, 14)):
        px(img, x, y, STEEL[4])
    for (x, y) in ((2, 2), (1, 3), (13, 2), (14, 3), (1, 13), (2, 14), (14, 13), (13, 14)):
        px(img, x, y, STEEL[3])
    # изумрудная лента поперёк
    for x in range(1, 15):
        px(img, x, 7, EMERALD[3])
        px(img, x, 8, EMERALD[2])
    px(img, 1, 7, EMERALD[4])
    # бордовая печать с «?»
    rect(img, 6, 6, 10, 10, BORDO[3])
    for x in range(6, 10):
        px(img, x, 6, BORDO[4])
        px(img, x, 9, BORDO[1])
    q = [(7, 6), (8, 6), (8, 7), (7, 8)]
    for x, y in q:
        px(img, x, y, WHITE)
    px(img, 7, 9, hexrgb("#ffd7da"))
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    race_beacon().save(OUT / "race_beacon.png")
    supply_crate().save(OUT / "supply_crate.png")
    print("иконки: race_beacon.png, supply_crate.png →", OUT)


if __name__ == "__main__":
    main()
