#!/usr/bin/env python3
"""Материалы големов из планетных металлов Northstar (ветка feat/golems-planet).

Пишет:
  kubejs/data/modulargolems/modulargolems_config/materials/nightshift_planet.json — материалы (статы, модификаторы);
  kubejs/data/nightshift/recipe/golems/<материал>_assemble_<часть>.json — сборка части на линии Create
    (sequenced_assembly: деплоер с слитком -> пресс -> ...), по образцу рецептов самого мода;
  kubejs/assets/nightshift/textures/entity/{metal_golem,humanoid_golem,dog_golem}/<материал>.png — перекраска
    текстур железа (только PIL, без генерации);
  kubejs/assets/modulargolems/lang/{ru_ru,en_us}.json — названия материалов.
Материал = nightshift:<имя>, текстуры мод берёт по assets/<ns>/textures/entity/<тип>/<имя>.png.
Запуск: python3 tools/gen_golem_planet.py  (нужны jar modulargolems в ~/mc-nightshift-server/mods)
"""
import io, json, pathlib, zipfile
from PIL import Image

PACK = pathlib.Path(__file__).resolve().parent.parent
JAR = pathlib.Path.home() / "mc-nightshift-server/mods/modulargolems-3.1.43.jar"
NS = "nightshift"
P = "modulargolems:"

# Ключ, слиток, названия, статы, модификаторы, палитра (тень, середина, свет), сборка (слиток, шаги-«добавки»)
MATS = {
    "titanium": dict(
        ingot="northstar:titanium_ingot", ru="Титан", en="Titanium",
        stats={"attack": 40.0, "max_health": 400.0, "knockback_resistance": 1.0, "sweep": 2.0, "weight": -0.2},
        mods={"fire_immune": 1, "explosion_resistant": 1, "damage_cap": 1},
        pal=((28, 34, 44), (120, 138, 156), (222, 232, 242)),
        extra=["create:precision_mechanism"]),
    "martian_steel": dict(
        ingot="northstar:martian_steel_ingot", ru="Марсианская сталь", en="Martian Steel",
        stats={"attack": 50.0, "max_health": 550.0, "knockback_resistance": 1.0, "sweep": 2.0, "regen": 2.0},
        mods={"fire_immune": 1, "thunder_immune": 1, "projectile_reject": 1, "damage_cap": 2},
        pal=((52, 16, 10), (168, 74, 40), (240, 168, 110)),
        extra=["create:precision_mechanism", "create:precision_mechanism"]),
    "tungsten": dict(
        ingot="northstar:tungsten_ingot", ru="Вольфрам", en="Tungsten",
        stats={"attack": 65.0, "max_health": 750.0, "knockback_resistance": 1.0, "sweep": 3.0, "regen": 4.0, "weight": 0.2},
        mods={"fire_immune": 1, "thunder_immune": 1, "explosion_resistant": 2, "magic_resistant": 2,
              "projectile_reject": 1, "armor_penetration": 2, "damage_cap": 3},
        pal=((10, 10, 16), (58, 60, 78), (132, 138, 170)),
        extra=["create:precision_mechanism", "create:precision_mechanism", "create:precision_mechanism"]),
    "lunar_sapphire": dict(
        ingot="northstar:polished_lunar_sapphire", ru="Лунный сапфир", en="Lunar Sapphire",
        stats={"attack": 35.0, "max_health": 480.0, "regen": 8.0, "weight": -0.4},
        mods={"magic_immune": 1, "thunder_immune": 1, "swim": 1},
        pal=((8, 22, 70), (44, 110, 210), (170, 226, 255)),
        extra=["create:precision_mechanism"]),
}
# часть -> (число циклов, как у мода)
PARTS = {"metal_golem_body": 9, "metal_golem_arm": 9, "metal_golem_legs": 9,
         "humanoid_golem_body": 6, "humanoid_golem_arms": 6, "humanoid_golem_legs": 6,
         "dog_golem_body": 6, "dog_golem_legs": 3}
TEX = {"metal_golem": "iron", "humanoid_golem": "iron", "dog_golem": "iron"}


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def materials():
    d = {"ingredients": {}, "modifiers": {}, "partLimitation": {}, "repairIngredients": {}, "stats": {}}
    for k, m in MATS.items():
        mid = f"{NS}:{k}"
        d["ingredients"][mid] = {"item": m["ingot"]}
        d["repairIngredients"][mid] = {"item": m["ingot"]}
        d["modifiers"][mid] = {P + a: b for a, b in m["mods"].items()}
        d["stats"][mid] = {P + a: b for a, b in m["stats"].items()}
    w(PACK / "kubejs/data/modulargolems/modulargolems_config/materials/nightshift_planet.json", d)


def recipes():
    for k, m in MATS.items():
        for part, loops in PARTS.items():
            inc = {"id": f"modulargolems:incomplete_{part}"}  # результат шага
            inp = {"item": inc["id"]}  # вход шага (в ингредиентах ключ item, в результатах id)
            seq = [{"type": "create:deploying", "ingredients": [inp, {"item": m["ingot"]}], "results": [inc]},
                   {"type": "create:pressing", "ingredients": [inp], "results": [inc]}]
            for ex in m["extra"]:
                seq.append({"type": "create:deploying", "ingredients": [inp, {"item": ex}], "results": [inc]})
            seq.append({"type": "create:deploying", "ingredients": [inp, {"item": "create:wrench"}],
                        "keep_held_item": True, "results": [inc]})
            w(PACK / f"kubejs/data/nightshift/recipe/golems/{k}_assemble_{part}.json", {
                "type": "create:sequenced_assembly",
                "ingredient": {"item": f"modulargolems:{part}"},
                "loops": loops,
                "results": [{"id": f"modulargolems:{part}",
                             "components": {"modulargolems:part_material": f"{NS}:{k}"}}],
                "sequence": seq,
                "transitional_item": inc})


def recolor(src, pal):
    """Яркость исходника -> трёхточечный градиент тень/середина/свет, альфа сохраняется."""
    im = src.convert("RGBA")
    px = im.load()
    lums = sorted(0.299 * px[x, y][0] + 0.587 * px[x, y][1] + 0.114 * px[x, y][2]
                  for x in range(im.width) for y in range(im.height) if px[x, y][3] > 0)
    lo, hi = lums[int(len(lums) * 0.02)], lums[int(len(lums) * 0.98)]
    out = Image.new("RGBA", im.size)
    o = out.load()
    for x in range(im.width):
        for y in range(im.height):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            t = (0.299 * r + 0.587 * g + 0.114 * b - lo) / max(hi - lo, 1)
            t = min(max(t, 0.0), 1.0)
            if t < 0.5:
                c0, c1, u = pal[0], pal[1], t * 2
            else:
                c0, c1, u = pal[1], pal[2], (t - 0.5) * 2
            o[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * u) for i in range(3)) + (a,)
    return out


def textures():
    with zipfile.ZipFile(JAR) as z:
        for typ, base in TEX.items():
            src = Image.open(io.BytesIO(z.read(f"assets/modulargolems/textures/entity/{typ}/{base}.png")))
            for k, m in MATS.items():
                p = PACK / f"kubejs/assets/{NS}/textures/entity/{typ}/{k}.png"
                p.parent.mkdir(parents=True, exist_ok=True)
                recolor(src, m["pal"]).save(p)


def lang():
    for code, key in (("ru_ru", "ru"), ("en_us", "en")):
        w(PACK / f"kubejs/assets/modulargolems/lang/{code}.json",
          {f"golem_material.{NS}.{k}": m[key] for k, m in MATS.items()})


if __name__ == "__main__":
    materials(); recipes(); textures(); lang()
    print("готово")
