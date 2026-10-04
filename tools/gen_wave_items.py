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
# тактический ядерный заряд: радиоактивный жёлто-зелёный с чёрным
recolor(van("firework_star"), ["#0d0d06", "#2e3a08", "#8fb514"], ["#d4f23a", "#fbff9e"], 0.75).save(OUT / "tactical_nuke.png")
recolor(van("recovery_compass_00"), ["#1c050b", "#5e1424", "#7a1a2e", "#a3283f"], ["#5d8f45", "#85bb65", "#c6e6a8"], 0.75).save(OUT / "star_navigator.png")
print("текстуры наград волн готовы")
# 30.09: Звёздный осколок (веха 70-й волны, сердцевина Звёздной кирки) — звезда Незера в цветах бренда;
# Стабилитовая кирка — свет и тьма стабилита (белый ↔ графит) с денежно-зелёными бликами
recolor(van("nether_star"), ["#1c050b", "#5e1424", "#a3283f"], ["#85bb65", "#c6e6a8", "#f4fff0"], 0.72).save(OUT / "star_fragment.png")
recolor(van("netherite_pickaxe"), ["#16161b", "#3c3c46", "#9ea3ad", "#eef0f4"], ["#85bb65", "#c6e6a8"], 0.9).save(OUT / "stabilite_pickaxe.png")

# 01.10: броня из межпланетного сплава — незеритовая в цветах сплава (бордо + денежный зелёный); иконки и слои модели
def van_path(path):
    with zipfile.ZipFile(MC) as z:
        return Image.open(io.BytesIO(z.read("assets/minecraft/textures/" + path + ".png"))).convert("RGBA")


ALLOY_BASE, ALLOY_HIGH = ["#1c050b", "#5e1424", "#94243a"], ["#5d8f45", "#85bb65", "#c6e6a8"]
for part in ("helmet", "chestplate", "leggings", "boots"):
    recolor(van("netherite_" + part), ALLOY_BASE, ALLOY_HIGH, 0.78).save(OUT / ("alloy_" + part + ".png"))
ARMOR = PACK / "kubejs/assets/nightshift/textures/models/armor"
ARMOR.mkdir(parents=True, exist_ok=True)
for layer in ("1", "2"):
    recolor(van_path("models/armor/netherite_layer_" + layer), ALLOY_BASE, ALLOY_HIGH, 0.78).save(ARMOR / ("alloy_layer_" + layer + ".png"))
# 04.10: ключевые предметы особых стадий (raids/45_special_stages.js)
recolor(van("heart_of_the_sea"), ["#2a1404", "#9a4a24", "#d97a3c"], ["#7fe9ff", "#e0fbff"], 0.7).save(OUT / "coil_core.png")          # Механоиды
recolor(van("paper"), ["#0b1d33", "#1f4fa8", "#4fb6ff"], ["#bfe9ff", "#ffffff"], 0.8).save(OUT / "afterburner_blueprint.png")     # Воздушный бой
recolor(van("iron_ingot"), ["#1a1d22", "#4b5563", "#9ca3af"], ["#e5c07b", "#fff1c1"], 0.82).save(OUT / "otk_armor_plate.png")     # Бронеколонна
recolor(van("gold_nugget"), ["#3a0c0c", "#a3283f", "#e5484d"], ["#fde68a", "#fffbe6"], 0.7).save(OUT / "runner_badge.png")        # Побег
recolor(van("ghast_tear"), ["#120a2a", "#5b3fa8", "#a78bfa"], ["#e9d5ff", "#ffffff"], 0.7).save(OUT / "spirit_essence.png")       # Духи
recolor(van("fermented_spider_eye"), ["#1a0606", "#5e1424", "#94243a"], ["#85bb65", "#c6e6a8"], 0.75).save(OUT / "queen_heart.png")  # Штурм гнезда
recolor(van("ender_pearl"), ["#1d1a10", "#7a6a2c", "#e8d27a"], ["#f4fbff", "#ffffff"], 0.62).save(OUT / "prism_lens.png")  # Невидимки, Блэкаут
recolor(van("netherite_scrap"), ["#101418", "#2f4a3a", "#5f8f6f"], ["#c6f2d0", "#ffffff"], 0.75).save(OUT / "bastion_core.png")  # Осада форпоста
recolor(van("name_tag"), ["#24160a", "#7a4a1c", "#c98a3e"], ["#ffe08a", "#fff7d6"], 0.7).save(OUT / "convoy_seal.png")  # Конвой
# 04.10: общие материалы второй фазы (метеорит, небесные острова, фактории)
recolor(van("raw_iron"), ["#14121c", "#3b3552", "#6f6a8f"], ["#9fe8ff", "#e6fbff"], 0.8).save(OUT / "meteor_iron.png")             # Метеоритное железо (сырое)
recolor(van("iron_ingot"), ["#16141f", "#45405e", "#8a85ad"], ["#a6ecff", "#f0fdff"], 0.82).save(OUT / "meteor_iron_ingot.png")   # Слиток метеоритного железа
recolor(van("amethyst_shard"), ["#062236", "#1479a8", "#5fd4ff"], ["#dff8ff", "#ffffff"], 0.7).save(OUT / "sky_crystal.png")      # Небесный кристалл
recolor(van("gold_nugget"), ["#2b1a06", "#8a5a1c", "#d39a3e"], ["#ffe7a3", "#fffbe8"], 0.7).save(OUT / "shift_token.png")         # Жетон смены
