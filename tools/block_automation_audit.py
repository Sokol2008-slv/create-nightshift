#!/usr/bin/env python3
"""Какие обычные блоки можно производить бесконечно машинами.

Граф рецептов берётся из tools/phase_audit.py (все рецепты jar: верстак — механический крафтер,
печи — вентилятор/печь, распил — механическая пила, Create, экструдер). Бесконечные источники:
булыжник (генератор лава+вода), вода, лава, деревья и саженцы, дроп мобов (Mechanical Spawner),
всё, что даёт экструдер. Выход — список блоков, которые из этого не получить.
"""
import contextlib, io, json, pathlib, re, runpy, sys, zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
with contextlib.redirect_stdout(io.StringIO()):
    A = runpy.run_path(str(PACK / "tools" / "phase_audit.py"))
recipes, tagitems, natural = A["recipes"], A["tagitems"], A["natural"]

# экструдер: blockIngredients/catalyst (блоки не расходуются, кроме отмеченных)
extr = {}
for j in A["jars"]:
    try:
        z = zipfile.ZipFile(j)
    except Exception:
        continue
    for n in z.namelist():
        if "/recipe/extruding/" in n and n.endswith(".json"):
            d = json.loads(z.read(n))
            ins = []
            bi = d.get("blockIngredients", {})
            for k in ("first", "second"):
                b = (bi.get(k) or {}).get("blocks")
                if b:
                    ins.append([b])
            cat = (d.get("catalyst") or {}).get("blocks")
            if cat:
                ins.append([cat])
            out = (d.get("result") or {}).get("id")
            if out:
                extr[n] = ([out], ins, d.get("requirements"))
for k, (outs, gs, req) in extr.items():
    recipes["extruder:" + k] = (outs, gs)

BASE = {"minecraft:water", "minecraft:lava", "fluid:minecraft:water", "fluid:minecraft:lava", "minecraft:cobblestone",
        "minecraft:snowball"}  # снег — снежные големы
# дроп мобов (фермы Mechanical Spawner); бартер пиглинов, рыбалка и подарки кошек — не генератор
mobdrops = set()
for j in A["jars"]:
    try:
        z = zipfile.ZipFile(j)
    except Exception:
        continue
    for n in z.namelist():
        if re.match(r"^data/[^/]+/loot_tables?/entities/.+\.json$", n):
            mobdrops.update(re.findall(r'"name"\s*:\s*"([a-z0-9_.-]+:[a-z0-9_/.-]+)"', z.read(n).decode("utf8", "ignore")))
BASE |= mobdrops
logs = tagitems.get("minecraft:logs", set()) | tagitems.get("minecraft:saplings", set()) | tagitems.get("minecraft:leaves", set())
BASE |= logs
# семена и растения, которые размножаются сами
BASE |= {"minecraft:wheat_seeds", "minecraft:sugar_cane", "minecraft:bamboo", "minecraft:cactus", "minecraft:kelp",
         "minecraft:vine", "minecraft:sweet_berries", "minecraft:glow_berries", "minecraft:moss_block", "minecraft:red_mushroom",
         "minecraft:brown_mushroom", "minecraft:crimson_fungus", "minecraft:warped_fungus", "minecraft:nether_wart",
         "minecraft:chorus_fruit", "minecraft:chorus_flower", "minecraft:pumpkin", "minecraft:melon_slice", "minecraft:carrot",
         "minecraft:potato", "minecraft:beetroot_seeds"}

reach = set(BASE)


def ok(opt):
    if opt.startswith("#"):
        return any(i in reach for i in tagitems.get(opt[1:], ()))
    return opt in reach


def selfish(outs, gs):
    # распил/переделка «камень → вариант того же камня» по тегу, в котором есть сам результат
    for g in gs:
        for o in g:
            if o.startswith("#") and any(x in tagitems.get(o[1:], ()) for x in outs):
                return True
    return False


changed = True
while changed:
    changed = False
    for rid, (outs, gs) in recipes.items():
        if selfish(outs, gs):
            continue
        if all(any(ok(o) for o in g) for g in gs):
            for o in outs:
                if o not in reach:
                    reach.add(o)
                    changed = True

TARGET = """ice dirt coarse_dirt rooted_dirt podzol mycelium mud clay clay_ball gravel sand red_sand sandstone red_sandstone
soul_sand soul_soil netherrack blackstone basalt smooth_basalt magma_block end_stone obsidian crying_obsidian
stone cobbled_deepslate deepslate tuff calcite dripstone_block pointed_dripstone andesite diorite granite
terracotta packed_ice blue_ice snow_block moss_block glowstone nether_bricks red_nether_bricks prismarine
purpur_block sculk amethyst_block quartz_block mud_bricks packed_mud""".split()
missing = [t for t in TARGET if "minecraft:" + t not in reach]
print("не автоматизируются:", " ".join(missing) or "—")
json.dump(sorted(reach), open(PACK / "dist" / "automatable.json", "w"))
