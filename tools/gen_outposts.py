#!/usr/bin/env python3
"""«Сеть форпостов» (04.10.2026): текстуры и генерация месторождений.

Пишет:
  kubejs/assets/nightshift/textures/{block,item}/*.png — перекраска ванильных текстур по яркости
      (как tools/gen_magic_items.py, без платной генерации);
  kubejs/data/nightshift/worldgen/{configured_feature,placed_feature}/outpost_*.json — диски месторождений,
      озёра жидкой серы, деревья гевеи;
  kubejs/data/nightshift/neoforge/biome_modifier/outpost_*.json — куда добавить (только новые чанки);
  kubejs/data/<мод>/neoforge/biome_modifier/*.json = neoforge:none — выключает руду, которая заменена форпостом
      (магнетит New Age, боксит TFMG, серная руда Gunsmithing);
  kubejs/data/nightshift/tags/… — грунт, который заменяет диск, и группы биомов.

Частоты — первое число в surface()/cave() в features(): «1 из N чанков подходящего биома». Подобраны на тестовом
сервере 04.10 (Chunky ±160–200 блоков вокруг биома, потом /outposts_scan): в своём биоме месторождение в 10–70 блоках
от любой точки, 15–40 чанков из 440 — за пару минут полёта находится наверняка.
Запуск: python3 tools/gen_outposts.py
"""
import io
import json
import pathlib
import random
import zipfile

from PIL import Image

PACK = pathlib.Path(__file__).resolve().parent.parent
TEX = PACK / "kubejs/assets/nightshift/textures"
DATA = PACK / "kubejs/data"
MC = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar"

# ---------------------------------------------------------------------------
# Текстуры: (куда, ванильный исходник, градиент тёмный → светлый, искры)
# ---------------------------------------------------------------------------
BLOCKS = {
    "hevea_soil": ("block/rooted_dirt", ["#2e130b", "#7a3219", "#b85a32", "#d98a5a"], None),
    "hevea_log": ("block/jungle_log", ["#3f3d31", "#77776a", "#a9aa95", "#e4e3cf"], None),
    "salt_deposit": ("block/calcite", ["#9c7f86", "#d7bfc4", "#f3e6e8", "#ffffff"], None),
    "magnetic_anomaly": ("block/lodestone_side", ["#120e18", "#2f2542", "#5e4a8c", "#a989ff"], "#d9c8ff"),
    "sulfur_spring": ("block/tuff", ["#4a3a0a", "#8f7414", "#d8bb22", "#fff27a"], None),
    "quartz_vein": ("block/amethyst_block", ["#8fa2b6", "#cfdcea", "#eef5fb", "#ffffff"], "#ffffff"),
    "bauxite_deposit": ("block/granite", ["#4a1a0a", "#8e3c18", "#c4652e", "#e89a62"], None),
    "helium_ice": ("block/blue_ice", ["#6aa9c4", "#b7e3f2", "#e6f7ff", "#ffffff"], "#f3e8ff"),
    "permafrost": ("block/coarse_dirt", ["#2c3a46", "#5f7a90", "#a8c6da", "#e8f6ff"], None),
    "peat_bog": ("block/mud", ["#140d07", "#2f2011", "#523a20", "#7a5c36"], None),
    "mycelium_vein": ("block/mycelium_top", ["#1f1438", "#4a3796", "#6f8ae0", "#a8fbff"], "#c9fff5"),
    "star_stone": ("block/obsidian", ["#03051a", "#0f1844", "#253a86", "#5d78d6"], "#ffffff"),
}
ITEMS = {
    "latex": ("item/slime_ball", ["#8f8a72", "#d6d0b4", "#f3eedb", "#ffffff"]),
    "tapping_knife": ("item/iron_sword", ["#2a2522", "#6b5a4a", "#b9b9b9", "#f0f0f0"]),
    "rock_salt": ("item/raw_iron", ["#8a6970", "#cfadb3", "#efdde0", "#ffffff"]),
    "raw_magnetite": ("item/raw_iron", ["#120e18", "#2d2540", "#5a4a86", "#9a86d6"]),
    "magnetite_dust": ("item/gunpowder", ["#110d16", "#2d2540", "#54467c", "#8d7cc4"]),
    "sulfur_crust": ("item/raw_gold", ["#4a3a0a", "#9c7e16", "#e0c428", "#fff59a"]),
    "smokeless_powder": ("item/gunpowder", ["#14180c", "#333d1f", "#5d6b35", "#97a65a"]),
    "quartz_sand": ("item/sugar", ["#b3a988", "#ddd5b9", "#f2eedf", "#ffffff"]),
    "quartz_glass": ("block/glass", ["#7fb3c4", "#bfe4ee", "#e9f9fd", "#ffffff"]),
    "lens": ("item/ender_pearl", ["#4f8fa6", "#97d0e2", "#d8f3fb", "#ffffff"]),
    "helium_frost": ("item/snowball", ["#8f7fb8", "#c7b9ee", "#ebe3ff", "#ffffff"]),
    "helium_canister": ("item/honey_bottle", ["#3b6f86", "#7fbdd6", "#c8ecf8", "#ffffff"]),
    "cryo_crystal": ("item/prismarine_crystals", ["#1d5f86", "#3fa6d6", "#9fe4fb", "#ffffff"]),
    "radiator": ("block/copper_grate", ["#1b3c4a", "#2f7a8e", "#5cc2d6", "#b8f2fb"]),
    "peat": ("item/brick", ["#1a1009", "#3a2614", "#5e4224", "#87683f"]),
    "activated_carbon": ("item/charcoal", ["#07080c", "#171b26", "#2e3850", "#5d7196"]),
    "air_filter": ("item/flower_pot", ["#1a1c1f", "#3f454b", "#7b858e", "#c9d1d6"]),
    "glowcap": ("block/brown_mushroom", ["#241446", "#4f36a6", "#6fb6f0", "#c6fff4"]),
    "spores": ("item/glowstone_dust", ["#123d33", "#2a8a6e", "#5fd6a8", "#c8ffe8"]),
    "stardust": ("item/glowstone_dust", ["#1c2a6a", "#4a63c8", "#a8bcff", "#ffffff"], "#fff6c8"),
    "incomplete_star_chart": ("item/paper", ["#5f6a86", "#a7b4d0", "#d8e2f5", "#f4f8ff"]),
    "star_chart": ("item/filled_map", ["#5a410e", "#d2a83c", "#24398a", "#101a4c"], "#ffffff"),
}


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
    stops = [hexrgb(c) for c in stops]
    px = [(x, y) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        a = img.getpixel(p)[3]
        out.putpixel(p, ramp(stops, (l - lo) / (hi - lo or 1)) + (a,))
    return out


def sparkle(img, color, seed, n=7):
    """Искры-«звёзды» — месторождение видно на расстоянии."""
    rnd = random.Random(seed)
    c = hexrgb(color) + (255,)
    for _ in range(n):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        img.putpixel((x, y), c)
    return img


def textures():
    z = zipfile.ZipFile(MC)

    def van(path):
        im = Image.open(io.BytesIO(z.read("assets/minecraft/textures/" + path + ".png"))).convert("RGBA")
        # анимированные (полосой кадров) — берём первый кадр
        return im.crop((0, 0, im.width, im.width)) if im.height > im.width else im

    (TEX / "block").mkdir(parents=True, exist_ok=True)
    (TEX / "item").mkdir(parents=True, exist_ok=True)
    for name, (src, stops, spark) in BLOCKS.items():
        im = recolor(van(src), stops)
        if spark:
            im = sparkle(im, spark, name)
        im.save(TEX / "block" / (name + ".png"))
    for name, row in ITEMS.items():
        src, stops = row[0], row[1]
        im = recolor(van(src), stops)
        if name == "quartz_glass":
            # стекло как предмет: заливаем прозрачную середину голубоватой дымкой, иначе видна только рамка
            for y in range(1, im.height - 1):
                for x in range(1, im.width - 1):
                    if im.getpixel((x, y))[3] == 0:
                        im.putpixel((x, y), (196, 236, 246, 110))
        if len(row) > 2:
            # искры только по непрозрачному
            rnd = random.Random(name)
            c = hexrgb(row[2]) + (255,)
            spots = [(x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3] > 0]
            for x, y in rnd.sample(spots, min(6, len(spots))):
                im.putpixel((x, y), c)
        im.save(TEX / "item" / (name + ".png"))
    print("текстуры: блоков %d, предметов %d" % (len(BLOCKS), len(ITEMS)))


# ---------------------------------------------------------------------------
# Генерация мира
# ---------------------------------------------------------------------------
def state(name, props=None):
    s = {"Name": name}
    if props:
        s["Properties"] = props
    return {"type": "minecraft:simple_state_provider", "state": s}


# 06.10 (Георгий: «залежи — чтобы точно помещалось хотя бы 2 бура»): радиус не меньше 4 — пятно от 9 блоков в поперечнике.
# Места появления от радиуса не зависят (его выбирает сама фича после размещения) — координаты атласа верны.
def disk(block, rmin, rmax, half):
    return {"type": "minecraft:disk", "config": {
        "state_provider": {"fallback": state(block), "rules": []},
        "target": {"type": "minecraft:matching_block_tag", "tag": "nightshift:outpost_ground"},
        "radius": {"type": "minecraft:uniform", "min_inclusive": rmin, "max_inclusive": rmax},
        "half_height": half}}


def surface(chance, min_y=None, heightmap="WORLD_SURFACE_WG"):
    p = [{"type": "minecraft:rarity_filter", "chance": chance}, {"type": "minecraft:in_square"}]
    if min_y is not None:
        # «только если поверхность не ниже min_y»: ставим y = min_y и сверяем с картой высот, потом — на поверхность
        p += [{"type": "minecraft:height_range", "height": {"type": "minecraft:constant", "value": {"absolute": min_y}}},
              {"type": "minecraft:surface_relative_threshold_filter", "heightmap": heightmap, "max_inclusive": 0}]
    p += [{"type": "minecraft:heightmap", "heightmap": heightmap}, {"type": "minecraft:biome"}]
    return p


def cave(chance, ymin, ymax, max_steps=16, count=1):
    # окружение ищется только из воздуха пещеры: попыток count, из них в пустоту попадает малая часть
    return [{"type": "minecraft:count", "count": count}, {"type": "minecraft:rarity_filter", "chance": chance}, {"type": "minecraft:in_square"},
            {"type": "minecraft:height_range", "height": {"type": "minecraft:uniform",
                                                           "min_inclusive": {"absolute": ymin}, "max_inclusive": {"absolute": ymax}}},
            {"type": "minecraft:environment_scan", "direction_of_search": "down", "max_steps": max_steps,
             "target_condition": {"type": "minecraft:solid"},
             "allowed_search_condition": {"type": "minecraft:matching_blocks", "blocks": ["minecraft:air", "minecraft:cave_air"]}},
            {"type": "minecraft:biome"}]


# [имя, configured_feature, placement, биомы, шаг генерации]
def features():
    sulfur_lake = {"type": "minecraft:lake", "config": {
        "fluid": state("nightshift:liquid_sulfur", {"level": "0"}),
        "barrier": state("nightshift:sulfur_spring")}}
    hevea_tree = {"type": "minecraft:tree", "config": {
        "ignore_vines": True, "force_dirt": False,
        "minimum_size": {"type": "minecraft:two_layers_feature_size", "limit": 1, "lower_size": 0, "upper_size": 1},
        "dirt_provider": state("nightshift:hevea_soil"),
        "trunk_provider": state("nightshift:hevea_log"),
        "foliage_provider": state("minecraft:jungle_leaves", {"distance": "7", "persistent": "true", "waterlogged": "false"}),
        "trunk_placer": {"type": "minecraft:straight_trunk_placer", "base_height": 4, "height_rand_a": 2, "height_rand_b": 0},
        "foliage_placer": {"type": "minecraft:blob_foliage_placer", "radius": 2, "offset": 0, "height": 3},
        "decorators": []}}
    tree_place = [{"type": "minecraft:count", "count": 14}, {"type": "minecraft:in_square"},
                  {"type": "minecraft:heightmap", "heightmap": "WORLD_SURFACE_WG"},
                  {"type": "minecraft:block_predicate_filter", "predicate": {"type": "minecraft:all_of", "predicates": [
                      {"type": "minecraft:matching_blocks", "offset": [0, -1, 0], "blocks": "nightshift:hevea_soil"},
                      {"type": "minecraft:matching_blocks", "blocks": ["minecraft:air", "minecraft:short_grass", "minecraft:fern"]}]}},
                  {"type": "minecraft:biome"}]
    return [
        ("hevea_soil", disk("nightshift:hevea_soil", 4, 6, 2), surface(10), "#c:is_jungle", "underground_ores"),
        ("hevea_tree", hevea_tree, tree_place, "#c:is_jungle", "underground_decoration"),
        ("salt", disk("nightshift:salt_deposit", 4, 6, 2), surface(4), "#c:is_beach", "underground_ores"),
        ("magnetic_anomaly", disk("nightshift:magnetic_anomaly", 4, 6, 2), surface(18, 120), "#c:is_mountain", "underground_ores"),
        ("sulfur_surface", sulfur_lake, [{"type": "minecraft:rarity_filter", "chance": 5}, {"type": "minecraft:in_square"},
                                         {"type": "minecraft:heightmap", "heightmap": "WORLD_SURFACE_WG"}, {"type": "minecraft:biome"}],
         "#c:is_badlands", "lakes"),
        ("sulfur_deep", sulfur_lake, cave(8, -56, -12, 32)[:-1] + [
            {"type": "minecraft:surface_relative_threshold_filter", "heightmap": "OCEAN_FLOOR_WG", "max_inclusive": -16},
            {"type": "minecraft:biome"}], "#minecraft:is_overworld", "lakes"),
        ("quartz", disk("nightshift:quartz_vein", 4, 6, 2), surface(12), "#c:is_desert", "underground_ores"),
        ("bauxite", disk("nightshift:bauxite_deposit", 4, 6, 2), surface(5), "#nightshift:outpost_bauxite", "underground_ores"),
        ("helium", disk("nightshift:helium_ice", 4, 6, 2), surface(14, 180), "#c:is_mountain", "underground_ores"),
        ("permafrost", disk("nightshift:permafrost", 4, 6, 2), surface(8), "#c:is_icy", "underground_ores"),
        ("peat", disk("nightshift:peat_bog", 4, 6, 2), surface(7, None, "OCEAN_FLOOR_WG"), "#c:is_swamp", "underground_ores"),
        ("mycelium_surface", disk("nightshift:mycelium_vein", 4, 6, 2), surface(4), "#c:is_mushroom", "underground_ores"),
        ("mycelium_caves", disk("nightshift:mycelium_vein", 4, 5, 1), cave(3, -50, 40, 16, 6), "#nightshift:outpost_spore_caves", "underground_ores"),
        ("star_stone", disk("nightshift:star_stone", 4, 5, 2), surface(10, 200), "#c:is_mountain/peak", "underground_ores"),
    ]


GROUND = ["#minecraft:dirt", "#minecraft:sand", "#minecraft:base_stone_overworld", "#minecraft:terracotta",
          "minecraft:gravel", "minecraft:clay", "minecraft:calcite", "minecraft:sandstone", "minecraft:red_sandstone",
          "minecraft:snow_block", "minecraft:powder_snow", "minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice",
          "minecraft:dripstone_block", "minecraft:smooth_basalt", "minecraft:grass_block", "minecraft:mycelium",
          "minecraft:podzol", "minecraft:mud", "minecraft:moss_block", "minecraft:coarse_dirt"]


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def worldgen():
    ns = DATA / "nightshift"
    dump(ns / "tags/block/outpost_ground.json", {"replace": False, "values": [
        x if x.startswith("#") else {"id": x, "required": False} for x in GROUND]})
    dump(ns / "tags/worldgen/biome/outpost_bauxite.json", {"replace": False, "values": ["#c:is_savanna", "#c:is_plateau"]})
    dump(ns / "tags/worldgen/biome/outpost_spore_caves.json", {"replace": False, "values": [
        "#c:is_lush", {"id": "terralith:cave/fungal_caves", "required": False}]})
    n = 0
    for name, cf, placement, biomes, step in features():
        dump(ns / "worldgen/configured_feature" / ("outpost_" + name + ".json"), cf)
        dump(ns / "worldgen/placed_feature" / ("outpost_" + name + ".json"),
             {"feature": "nightshift:outpost_" + name, "placement": placement})
        dump(ns / "neoforge/biome_modifier" / ("outpost_" + name + ".json"),
             {"type": "neoforge:add_features", "biomes": biomes, "features": "nightshift:outpost_" + name, "step": step})
        n += 1
    # руда, которую заменил форпост, больше не генерируется (только в новых чанках; старые жилы остаются)
    for mod, f in (("create_new_age", "magnetite_block"), ("tfmg", "bauxite"), ("cgs", "add_sulfur_ore")):
        dump(DATA / mod / "neoforge/biome_modifier" / (f + ".json"), {"type": "neoforge:none"})
    print("генерация: месторождений %d, выключено руд 3" % n)


if __name__ == "__main__":
    textures()
    worldgen()
