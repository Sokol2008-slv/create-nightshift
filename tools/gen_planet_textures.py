#!/usr/bin/env python3
"""Текстуры планет «Аксиоматив» и «Инь-Янь»: руды, сырьё, дроблёная руда, слитки и спрайты планет.

Только перекраска существующих текстур (ванильный клиент 1.21.1, Create 6.0.10) — без генерации
картинок «с нуля» внешними сервисами. Спрайты планет (20×20 и маленькие *_sky) рисуются здесь же
по пикселям. Запуск: python3 tools/gen_planet_textures.py (нужен Pillow: pip install pillow).

Выход:
  kubejs/assets/kubejs/textures/block/*.png   — руды (KubeJS берёт kubejs:block/<id>)
  kubejs/assets/kubejs/textures/item/*.png    — raw_*, crushed_raw_*, *_ingot
  kubejs/assets/nightshift/textures/planet/*.png — спрайты атласа Northstar «planets»
    (атлас собирает папку textures/planet/ из всех пространств имён: nightshift:axiomativ →
    assets/nightshift/textures/planet/axiomativ.png)
"""
import io
import math
import pathlib
import random

from PIL import Image

from planet_jars import PACK, mod_jar, vanilla_jar

BLOCK_OUT = PACK / "kubejs/assets/kubejs/textures/block"
ITEM_OUT = PACK / "kubejs/assets/kubejs/textures/item"
PLANET_OUT = PACK / "kubejs/assets/nightshift/textures/planet"

VAN = vanilla_jar()
CREATE = mod_jar("create")


def load(zf, path):
    return Image.open(io.BytesIO(zf.read(path))).convert("RGBA")


def van(name):
    return load(VAN, f"assets/minecraft/textures/{name}.png")


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def ramp(stops, t):
    """Линейный градиент по списку цветов, t в [0, 1]."""
    t = min(1.0, max(0.0, t))
    seg = t * (len(stops) - 1)
    i = min(int(seg), len(stops) - 2)
    f = seg - i
    a, b = stops[i], stops[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))


def recolor(img, stops, mask=None):
    """Перекраска по яркости: самый тёмный пиксель → stops[0], самый светлый → stops[-1].
    stops может быть парой (основа, блики, порог) — цвета бренда: бордо в тенях, зелёный в бликах."""
    if isinstance(stops, tuple):
        return recolor_split(img, *stops, mask=mask)
    stops = [hexrgb(s) for s in stops]
    px = [(x, y) for y in range(img.height) for x in range(img.width)
          if img.getpixel((x, y))[3] > 0 and (mask is None or mask(x, y))]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        c = ramp(stops, (l - lo) / (hi - lo or 1))
        out.putpixel(p, c + (img.getpixel(p)[3],))
    return out


def ore(base_rock, ore_tex, rock_of_ore, stops, threshold=24):
    """Вырезает «вкрапления» из ванильной руды (пиксели, отличные от её породы), красит их
    и кладёт на нашу породу."""
    out = base_rock.copy()
    spots = [(x, y) for y in range(16) for x in range(16)
             if sum(abs(a - b) for a, b in zip(ore_tex.getpixel((x, y))[:3], rock_of_ore.getpixel((x, y))[:3])) > threshold]
    ls = [lum(ore_tex.getpixel(p)) for p in spots]
    lo, hi = min(ls), max(ls)
    if isinstance(stops, tuple):  # (основа, блики, порог) — как в recolor_split
        base, high, cut = [hexrgb(c) for c in stops[0]], [hexrgb(c) for c in stops[1]], stops[2]
        pick = lambda t: ramp(base, t / cut) if t < cut else ramp(high, (t - cut) / (1 - cut or 1))
    else:
        st = [hexrgb(s) for s in stops]
        pick = lambda t: ramp(st, t)
    for p, l in zip(spots, ls):
        out.putpixel(p, pick((l - lo) / (hi - lo or 1)) + (255,))
    return out


def split_diag(img, dark, light):
    """Стабилит: предмет пополам по диагонали — тёмная и светлая половины (инь и ян)."""
    a = recolor(img, dark)
    b = recolor(img, light)
    out = img.copy()
    for y in range(img.height):
        for x in range(img.width):
            out.putpixel((x, y), (a if x + y < img.width else b).getpixel((x, y)))
    return out


def recolor_split(img, base, highlight, cut, mask=None):
    """Как recolor, но пиксели ярче порога cut (0..1) красятся отдельной палитрой бликов."""
    base = [hexrgb(c) for c in base]
    highlight = [hexrgb(c) for c in highlight]
    px = [(x, y) for y in range(img.height) for x in range(img.width)
          if img.getpixel((x, y))[3] > 0 and (mask is None or mask(x, y))]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        t = (l - lo) / (hi - lo or 1)
        c = ramp(base, t / cut) if t < cut else ramp(highlight, (t - cut) / (1 - cut or 1))
        out.putpixel(p, c + (img.getpixel(p)[3],))
    return out


# --- палитры ---------------------------------------------------------------------------------
# цвета бренда Axiomativ (Георгий, 30.09): бордо/вино + денежный зелёный в бликах
AXIOMITE = (["#1c050b", "#4a0f1d", "#7a1a2e", "#a3283f"], ["#5d8f45", "#85bb65", "#c6e6a8"], 0.9)
STAB_ORE_LIGHT = ["#a9a4bd", "#e2dff0", "#ffffff"]             # светлая руда: серо-сиреневый → белый
STAB_ORE_DARK = ["#050507", "#221f2e", "#4d4962"]              # тёмная руда: почти чёрный → тёмно-графитовый
STAB_RAW_LIGHT = ["#b5b0c4", "#eeecf6", "#ffffff"]             # светлое сырьё
STAB_RAW_DARK = ["#000000", "#121118", "#34313f"]              # тёмное сырьё
STAB_DARK = ["#050505", "#3a3a3a", "#8c8466"]
STAB_LIGHT = ["#9d9784", "#e4dfcc", "#ffffff"]


def save(img, folder, name):
    folder.mkdir(parents=True, exist_ok=True)
    img.save(folder / f"{name}.png")
    print("  ", (folder / f"{name}.png").relative_to(PACK))


def blocks():
    stone, deepslate = van("block/stone"), van("block/deepslate")
    iron, deep_iron = van("block/iron_ore"), van("block/deepslate_iron_ore")
    diamond = van("block/diamond_ore")
    # аксиомит: на туфе (порода Аксиоматива) и на глубинном сланце
    save(ore(van("block/tuff"), iron, stone, AXIOMITE), BLOCK_OUT, "axiomite_ore")
    save(ore(deepslate, deep_iron, deepslate, AXIOMITE), BLOCK_OUT, "deepslate_axiomite_ore")
    # стабилит: светлая руда на кальците (биом Ян), тёмная на чернокамне (биом Инь)
    save(ore(van("block/calcite"), diamond, stone, STAB_ORE_LIGHT, 90), BLOCK_OUT, "light_stabilite_ore")
    save(ore(van("block/blackstone"), diamond, stone, STAB_ORE_DARK, 90), BLOCK_OUT, "dark_stabilite_ore")


def items():
    raw, ingot = van("item/raw_iron"), van("item/iron_ingot")
    crushed = load(CREATE, "assets/create/textures/item/crushed_raw_iron.png")
    save(recolor(raw, AXIOMITE), ITEM_OUT, "raw_axiomite")
    save(recolor(crushed, AXIOMITE), ITEM_OUT, "crushed_raw_axiomite")
    save(recolor(ingot, AXIOMITE), ITEM_OUT, "axiomite_ingot")
    save(recolor(raw, STAB_RAW_LIGHT), ITEM_OUT, "raw_light_stabilite")
    save(recolor(raw, STAB_RAW_DARK), ITEM_OUT, "raw_dark_stabilite")
    save(split_diag(ingot, STAB_DARK, STAB_LIGHT), ITEM_OUT, "stabilite_ingot")


def yinyang(x, y):
    """Символ инь-ян в круге радиуса 1: 1 — светлое, 0 — тёмное, None — вне круга."""
    if x * x + y * y > 1:
        return None
    if x * x + (y + 0.5) ** 2 <= 0.0225:   # тёмная точка в светлой капле
        return 0
    if x * x + (y - 0.5) ** 2 <= 0.0225:   # светлая точка в тёмной капле
        return 1
    if x * x + (y + 0.5) ** 2 <= 0.25:     # верхняя малая окружность — светлая
        return 1
    if x * x + (y - 0.5) ** 2 <= 0.25:     # нижняя — тёмная
        return 0
    return 1 if x > 0 else 0


def sky_yinyang(size, ss=16):
    img = Image.new("RGBA", (size, size))
    for py in range(size):
        for px in range(size):
            cov = light = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = ((px + (sx + 0.5) / ss) / size) * 2 - 1
                    y = ((py + (sy + 0.5) / ss) / size) * 2 - 1
                    v = yinyang(x, y)
                    if v is not None:
                        cov += 1
                        light += v
            if cov:
                g = round(12 + 238 * light / cov)
                img.putpixel((px, py), (g, g, g, round(255 * cov / ss / ss)))
    return img


def planets():
    rnd = random.Random(20260929)
    # Аксиоматив, вид с орбиты: бордовая поверхность, сетка заводских кварталов с зелёными огнями
    # (цвета бренда), светлые полярные шапки
    img = Image.new("RGBA", (20, 20))
    for y in range(20):
        for x in range(20):
            base = ramp([hexrgb("#3a0b16"), hexrgb("#6d1a2c"), hexrgb("#9e2a3f")], rnd.random() * 0.8 + 0.1)
            if y in (0, 1, 18, 19) or (y in (2, 17) and rnd.random() < 0.6):
                base = ramp([hexrgb("#d9c7c2"), hexrgb("#f6ecea")], rnd.random())
            elif (x % 5 == 2 or y % 5 == 2) and rnd.random() < 0.7:
                base = ramp([hexrgb("#5d8f45"), hexrgb("#a8e07a")], rnd.random())
            img.putpixel((x, y), base + (255,))
    save(img, PLANET_OUT, "axiomativ")
    # в небе — маленький винный диск
    sky = Image.new("RGBA", (4, 4))
    cols = ["#8e2439", "#b5405a", "#b5405a", "#6d1a2c"]
    for y in range(4):
        for x in range(4):
            sky.putpixel((x, y), hexrgb(cols[(x + y) // 2]) + (255,))
    save(sky, PLANET_OUT, "axiomativ_sky")
    # Инь-Янь с орбиты: шахматка светлых и тёмных четвертей, в каждой — точка противоположного цвета
    img = Image.new("RGBA", (20, 20))
    for y in range(20):
        for x in range(20):
            light = (x < 10) != (y < 10)
            if (x % 10) in (4, 5) and (y % 10) in (4, 5):
                light = not light
            g = rnd.randint(232, 255) if light else rnd.randint(4, 24)
            img.putpixel((x, y), (g, g, g, 255))
    save(img, PLANET_OUT, "yin_yang")
    save(sky_yinyang(6), PLANET_OUT, "yin_yang_sky")


if __name__ == "__main__":
    print("текстуры:")
    blocks()
    items()
    planets()
