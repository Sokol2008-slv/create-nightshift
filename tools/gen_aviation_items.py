#!/usr/bin/env python3
"""Иконки авиации пака (04.10.2026, поток D): удостоверения пилота III/II/I, аэрофотоаппарат, аэрофотоплёнка,
недособранная авиатехника, сигнальная ракета снабжения (07.10). 16×16, рисуются кодом (без исходников).

Удостоверение — синяя корочка с «крылышками» и звездой; ступень видна по цвету крыльев и рамки: III — медь, II —
серебро, I — золото (у Пилота I ещё и свечение предмета, его включает startup-скрипт). Аэрофотоаппарат — латунная
коробка с объективом и ремешком. Плёнка — чёрная кассета с выдвинутой лентой.

Запуск: python3 tools/gen_aviation_items.py → kubejs/assets/nightshift/textures/item/*.png
"""
import math
import pathlib
import random

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / "kubejs/assets/nightshift/textures/item"
CLEAR = (0, 0, 0, 0)


def hexrgb(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def pal(*hexes):
    return [hexrgb(h) for h in hexes]


NAVY = pal("#0b1530", "#13224a", "#1c3266", "#274585", "#3559a3", "#4a72c2")
COPPER = pal("#4a2418", "#6e3524", "#904931", "#b26247", "#d67b5b", "#f0a07c")
SILVER = pal("#3a3f45", "#5d656e", "#848e97", "#a3adb5", "#cfd6dc", "#f2f5f7")
GOLD = pal("#4a3205", "#7a5408", "#b07d0c", "#d9a514", "#f2c623", "#fff3b0")
BRASS = pal("#592424", "#724731", "#9e6947", "#bf8e55", "#d7aa5e", "#f1d17a")
STEEL = pal("#1c1f22", "#2e3338", "#434a51", "#5d666f", "#848e97", "#a3adb5")
GLASS = pal("#0f2a33", "#174452", "#2a6b7c", "#4fa8c0", "#9fe3f0", "#e6fbff")
FILM = pal("#2a1a0a", "#5a3a12", "#8a5a1c", "#b8823a")


def px(img, x, y, c):
    if 0 <= x < 16 and 0 <= y < 16:
        img.putpixel((x, y), c)


def rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            px(img, x, y, c)


def license_icon(metal, stars):
    img = Image.new("RGBA", (16, 16), CLEAR)
    # корочка 14×11
    rect(img, 1, 3, 15, 14, NAVY[2])
    for x in range(1, 15):
        px(img, x, 3, NAVY[4])
        px(img, x, 13, NAVY[0])
    for y in range(3, 14):
        px(img, 1, y, NAVY[4])
        px(img, 14, y, NAVY[0])
    # рамка-тиснение металлом
    for x in range(2, 14):
        px(img, x, 4, metal[2])
        px(img, x, 12, metal[1])
    for y in range(4, 13):
        px(img, 2, y, metal[2])
        px(img, 13, y, metal[1])
    # крылышки: два крыла и щиток посередине
    wing = [(3, 7), (4, 6), (4, 7), (5, 6), (5, 7), (5, 8), (6, 7), (6, 8)]
    for x, y in wing:
        px(img, x, y, metal[4])
        px(img, 15 - x, y, metal[4])
    for x, y in ((4, 8), (11, 8), (3, 8), (12, 8)):
        px(img, x, y, metal[3])
    rect(img, 7, 6, 9, 10, metal[5])
    px(img, 7, 9, metal[3])
    px(img, 8, 9, metal[2])
    # звёзды ступени под крыльями
    xs = {1: [8], 2: [7, 9], 3: [6, 8, 10]}[stars]
    for x in xs:
        px(img, x, 11, metal[5])
    return img


def camera_icon():
    img = Image.new("RGBA", (16, 16), CLEAR)
    # ремешок
    for x in range(3, 13):
        px(img, x, 2, FILM[1] if x % 3 else FILM[2])
    px(img, 2, 3, FILM[1])
    px(img, 13, 3, FILM[1])
    # корпус 12×8 латунь
    rect(img, 2, 4, 14, 12, BRASS[3])
    for x in range(2, 14):
        px(img, x, 4, BRASS[5])
        px(img, x, 11, BRASS[1])
    for y in range(4, 12):
        px(img, 2, y, BRASS[4])
        px(img, 13, y, BRASS[1])
    # видоискатель и кнопка
    rect(img, 3, 3, 6, 4, STEEL[3])
    px(img, 11, 3, (194, 49, 49, 255))
    # объектив снизу (камера смотрит вниз — аэрофото)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 8.5)
            if 2.4 <= d < 3.4:
                px(img, x, y, STEEL[4] if x + y < 16 else STEEL[1])
            elif d < 2.4:
                px(img, x, y, GLASS[2])
    px(img, 6, 7, GLASS[5])
    px(img, 7, 7, GLASS[4])
    px(img, 6, 8, GLASS[4])
    # тубус объектива вниз
    rect(img, 6, 12, 10, 14, STEEL[2])
    px(img, 6, 12, STEEL[4])
    rect(img, 6, 14, 10, 15, STEEL[1])
    return img


def film_icon():
    img = Image.new("RGBA", (16, 16), CLEAR)
    # кассета — цилиндр
    rect(img, 2, 3, 9, 13, STEEL[1])
    for y in range(3, 13):
        px(img, 2, y, STEEL[3])
        px(img, 3, y, STEEL[2])
        px(img, 8, y, STEEL[0])
    rect(img, 3, 2, 8, 3, STEEL[4])
    rect(img, 3, 13, 8, 14, STEEL[0])
    px(img, 5, 1, STEEL[3])
    # ярлык
    rect(img, 3, 6, 8, 9, (194, 49, 49, 255))
    px(img, 4, 7, (255, 230, 120, 255))
    px(img, 6, 7, (255, 230, 120, 255))
    # лента с перфорацией
    rect(img, 9, 5, 15, 11, FILM[2])
    for x in range(9, 15):
        px(img, x, 5, FILM[1])
        px(img, x, 10, FILM[1])
        if x % 2 == 0:
            px(img, x, 6, FILM[0])
            px(img, x, 9, FILM[0])
    rect(img, 10, 7, 14, 9, FILM[3])
    return img


def incomplete_icon():
    img = Image.new("RGBA", (16, 16), CLEAR)
    rnd = random.Random(7)
    # латунная рама с шестернёй — «недособранная авиатехника»
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            a = math.atan2(y - 7.5, x - 7.5)
            tooth = 5.0 + (1.0 if math.cos(a * 8) > 0.3 else 0)
            if 2.0 <= d < tooth:
                px(img, x, y, STEEL[rnd.randint(2, 4)] if x + y < 16 else STEEL[rnd.randint(1, 2)])
    for x in range(3, 13):
        px(img, x, 7, BRASS[4])
        px(img, x, 8, BRASS[2])
    return img


def flare_icon():
    """Сигнальная ракета снабжения (07.10): красная гильза с белой полосой, латунный колпачок, хвост дыма."""
    img = Image.new("RGBA", (16, 16), CLEAR)
    RED = pal("#4a0c0c", "#7a1414", "#a81d1d", "#cf2b2b", "#ee4a3a", "#ff8a6a")
    # гильза — наискосок снизу слева вверх направо
    for i in range(8):
        x, y = 4 + i, 12 - i
        px(img, x, y, RED[3])
        px(img, x - 1, y, RED[2])
        px(img, x, y + 1, RED[1])
        px(img, x - 1, y - 1, RED[4])
    for i in (3, 4):  # белая полоса
        px(img, 4 + i, 12 - i, (235, 235, 235, 255))
        px(img, 3 + i, 12 - i, (200, 200, 200, 255))
    # колпачок
    px(img, 12, 4, BRASS[4])
    px(img, 12, 5, BRASS[3])
    px(img, 11, 4, BRASS[2])
    px(img, 13, 3, BRASS[5])
    # фитиль и дым
    px(img, 3, 13, (60, 60, 60, 255))
    px(img, 2, 14, (150, 150, 150, 200))
    px(img, 1, 15, (200, 200, 200, 140))
    px(img, 2, 15, (180, 180, 180, 120))
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icons = {
        "pilot_license_3": license_icon(COPPER, 1),
        "pilot_license_2": license_icon(SILVER, 2),
        "pilot_license_1": license_icon(GOLD, 3),
        "aerial_camera": camera_icon(),
        "aerial_film": film_icon(),
        "incomplete_avionics": incomplete_icon(),
        "supply_flare": flare_icon(),
    }
    for name, img in icons.items():
        img.save(OUT / f"{name}.png")
    print("иконки авиации:", ", ".join(icons))


if __name__ == "__main__":
    main()
