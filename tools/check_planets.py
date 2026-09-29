#!/usr/bin/env python3
"""Проверка датапака планет «Аксиоматив» и «Инь-Янь» без запуска Minecraft.

Что делает:
  1. каждый новый JSON сверяется ПО КЛЮЧАМ (рекурсивно) с аналогом из jar Northstar 0.6.6 или ванили 1.21.1:
     лишний ключ (нет у аналога) — ОШИБКА (скорее всего опечатка, кодек его молча проигнорирует
     или упадёт), недостающий — предупреждение (у кодеков Northstar/ванили много optional-полей);
  2. все ссылки (измерение → тип/настройки/биомы, биом → фичи/карверы, фича → блоки/теги, планета →
     центральное тело/спрайты, лут → предметы) разрешаются: в нашем датапаке, в jar Northstar, в ванили
     или среди блоков/предметов из kubejs/startup_scripts/planets/*.js;
  3. порядок фич в шагах генерации совпадает во всех биомах одного измерения (иначе «Feature order cycle»);
  4. скрипты планет: только var (Rhino KubeJS), есть lang ru_ru/en_us и текстура на каждый id;
  5. квесты с типом dimension ссылаются на существующие измерения.

jar-файлы качаются в кэш (tools/planet_jars.py). Запуск: python3 tools/check_planets.py
Код выхода 1, если есть ошибки.
"""
import json
import pathlib
import re
import sys

from planet_jars import PACK, mod_jar, vanilla_jar

DATA = PACK / "kubejs" / "data"
OURS = DATA / "nightshift"
NS = mod_jar("northstar-redux")
VAN = vanilla_jar()
NS_NAMES = set(NS.namelist())
VAN_NAMES = set(VAN.namelist())

errors, warnings, checked = [], [], []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def warn(where, msg):
    warnings.append(f"{where}: {msg}")


def rel(p):
    return str(p.relative_to(PACK))


def ns_json(path):
    return json.loads(NS.read("data/northstar/" + path))


def van_json(path):
    return json.loads(VAN.read("data/minecraft/" + path))


def split(rid):
    ns, _, path = rid.partition(":")
    return (ns, path) if path else ("minecraft", ns)


# ------------------------------------------------------------------ регистрируемое KubeJS
def kubejs_ids():
    blocks, items = set(), set()
    for js in (PACK / "kubejs" / "startup_scripts" / "planets").glob("*.js"):
        text = js.read_text()
        for m in re.finditer(r"\['(kubejs:[a-z0-9_]+)'", text):
            blocks.add(m.group(1))
        metals = re.search(r"NS_PLANET_METALS\s*=\s*\[([^\]]*)\]", text)
        for metal in re.findall(r"'([a-z_]+)'", metals.group(1)) if metals else []:
            items.update({f"kubejs:raw_{metal}", f"kubejs:crushed_raw_{metal}", f"kubejs:{metal}_ingot"})
    return blocks, items


KJS_BLOCKS, KJS_ITEMS = kubejs_ids()


def block_exists(rid):
    ns, path = split(rid)
    if rid in KJS_BLOCKS:
        return True
    if ns == "minecraft":
        return f"assets/minecraft/blockstates/{path}.json" in VAN_NAMES
    if ns == "northstar":
        return f"assets/northstar/blockstates/{path}.json" in NS_NAMES
    return False


def item_exists(rid):
    ns, path = split(rid)
    if rid in KJS_ITEMS or rid in KJS_BLOCKS:
        return True
    if ns == "minecraft":
        return f"assets/minecraft/models/item/{path}.json" in VAN_NAMES
    return False


def data_exists(rid, kind):
    """Файл реестра <kind> (например, worldgen/biome) у нас, в Northstar или в ванили."""
    ns, path = split(rid)
    if (DATA / ns / kind / f"{path}.json").is_file():
        return True
    if ns == "northstar":
        return f"data/northstar/{kind}/{path}.json" in NS_NAMES
    if ns == "minecraft":
        return f"data/minecraft/{kind}/{path}.json" in VAN_NAMES
    return False


def tag_exists(rid, kind):
    ns, path = split(rid.lstrip("#"))
    if (DATA / ns / "tags" / kind / f"{path}.json").is_file():
        return True
    if ns == "minecraft":
        return f"data/minecraft/tags/{kind}/{path}.json" in VAN_NAMES
    if ns == "northstar":
        return f"data/northstar/tags/{kind}/{path}.json" in NS_NAMES
    return ns == "c"  # теги c:* собирает NeoForge из всех модов — наличие не проверить


# ------------------------------------------------------------------ сверка по ключам
def compare(ours, ref, where, path="$", optional=()):
    """Рекурсивно: ключи ours должны быть подмножеством ключей ref (с учётом известных optional)."""
    if isinstance(ours, dict) and isinstance(ref, dict):
        # «type»-диспетчеризация (density function, surface rule, placement…): при разных type ключи
        # законно разные — сравниваем только если type совпадает
        if "type" in ours and "type" in ref and ours["type"] != ref["type"]:
            return
        for k in ours:
            if k not in ref:
                if k in optional:
                    continue
                err(where, f"ключ {path}.{k} отсутствует у аналога — опечатка или неверная версия формата")
            else:
                compare(ours[k], ref[k], where, f"{path}.{k}", optional)
        for k in ref:
            if k not in ours and k not in optional:
                warn(where, f"нет ключа {path}.{k} (у аналога есть; ок, если поле optional)")
    elif isinstance(ours, list) and isinstance(ref, list):
        if ours and ref and all(isinstance(x, dict) for x in ours + ref):
            for i, x in enumerate(ours):
                compare(x, ref[min(i, len(ref) - 1)], where, f"{path}[{i}]", optional)
    elif type(ours) is not type(ref) and not (isinstance(ours, (int, float)) and isinstance(ref, (int, float))):
        # строка вместо объекта и т.п. допустимы у кодеков either/listOrSingle — только предупреждаем
        warn(where, f"{path}: тип {type(ours).__name__}, у аналога {type(ref).__name__}")


def check_file(p, ref, ref_name, optional=()):
    ours = json.loads(p.read_text())
    compare(ours, ref, rel(p), optional=optional)
    checked.append(f"{rel(p)}  ~  {ref_name}")
    return ours


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


# ------------------------------------------------------------------ проверки по типам файлов
def check_planets():
    for p in sorted((OURS / "northstar" / "planet").glob("*.json")):
        q = check_file(p, ns_json("northstar/planet/mercury.json"), "northstar:planet/mercury",
                       optional=("class", "axial_tilt", "notes", "can_be_observed", "science_weight_exp"))
        cb = q.get("central_body")
        if cb and not data_exists(cb, "northstar/planet"):
            err(rel(p), f"central_body {cb} не найден")
        # renderer-строка = SimplePlanetRenderer(texture) — спрайт атласа northstar «planets»
        # (assets/<ns>/textures/planet/<path>.png, atlases/planets.json: directory source «planet»)
        sprites = [q["renderer"]] if isinstance(q["renderer"], str) else []
        tex = q.get("texture", [])
        sprites += [tex] if isinstance(tex, str) else [t if isinstance(t, str) else t["texture"] for t in tex]
        for s in sprites:
            ns, path = split(s)
            ok = (PACK / "kubejs" / "assets" / ns / "textures" / "planet" / f"{path}.png").is_file() or \
                 f"assets/{ns}/textures/planet/{path}.png" in NS_NAMES
            if not ok:
                err(rel(p), f"спрайт {s} не найден (assets/{ns}/textures/planet/{path}.png)")
        mercury = ns_json("northstar/planet/mercury.json")["required_science"]
        if p.stem == "axiomativ" and not q["required_science"] > mercury:
            err(rel(p), f"required_science {q['required_science']} должен быть выше, чем у Меркурия ({mercury})")


def check_planet_dimensions():
    for p in sorted((OURS / "northstar" / "planet_dimension").glob("*.json")):
        q = check_file(p, ns_json("northstar/planet_dimension/mars.json"), "northstar:planet_dimension/mars",
                       optional=("dimension_above", "dimension_below", "is_orbit", "longitude_offset", "latitude_offset"))
        if not data_exists(q["planet"], "northstar/planet"):
            err(rel(p), f"planet {q['planet']} не найдена")
        for key in ("dimension", "dimension_above", "dimension_below"):
            if key in q and not data_exists(q[key], "dimension"):
                err(rel(p), f"{key} {q[key]} — нет файла dimension/")
        comp = q.get("atmosphere", {}).get("composition", [])
        for c in ([comp] if isinstance(comp, dict) else comp):
            ns, path = split(c["fluid"])
            if ns == "northstar" and f"assets/northstar/models/item/{path}_bucket.json" not in NS_NAMES:
                warn(rel(p), f"жидкость {c['fluid']}: не нашёл ведро в Northstar — проверь id")
    # одна запись planet_dimension на измерение (иначе PlanetTracker бросит IllegalStateException)
    seen = {}
    for p in list((OURS / "northstar" / "planet_dimension").glob("*.json")):
        dim = json.loads(p.read_text())["dimension"]
        if dim in seen:
            err(rel(p), f"измерение {dim} уже привязано в {seen[dim]}")
        seen[dim] = rel(p)
    for n in NS_NAMES:
        if n.startswith("data/northstar/northstar/planet_dimension/") and n.endswith(".json"):
            dim = json.loads(NS.read(n))["dimension"]
            if dim in seen:
                err(seen[dim], f"измерение {dim} уже привязано в Northstar ({n})")


def check_dimensions():
    feature_steps = {}
    for p in sorted((OURS / "dimension").glob("*.json")):
        q = json.loads(p.read_text())
        bs = q["generator"]["biome_source"]
        if bs["type"] == "minecraft:checkerboard":
            # у Northstar checkerboard нет — сверяем с кодеком ванили CheckerboardColumnBiomeSource
            ref = {"type": "minecraft:noise", "generator": {"type": "minecraft:noise", "settings": "",
                   "biome_source": {"type": "minecraft:checkerboard", "biomes": [], "scale": 2}}}
            compare({"type": "minecraft:noise", "generator": q["generator"]}, ref, rel(p))
            checked.append(f"{rel(p)}  ~  ванильный кодек minecraft:checkerboard (biomes, scale 0..62)")
            if not 0 <= bs.get("scale", 2) <= 62:
                err(rel(p), "scale вне 0..62")
            biomes = bs["biomes"]
            side = 2 ** (bs.get("scale", 2) + 4)
            checked.append(f"    checkerboard: сторона квадрата {side} блоков, биомов {len(biomes)}")
        else:
            check_file(p, ns_json("dimension/mercury.json"), "northstar:dimension/mercury")
            biomes = [b["biome"] for b in bs["biomes"]]
        if not data_exists(q["type"], "dimension_type"):
            err(rel(p), f"type {q['type']} — нет dimension_type")
        if not data_exists(q["generator"]["settings"], "worldgen/noise_settings"):
            err(rel(p), f"settings {q['generator']['settings']} — нет noise_settings")
        for b in biomes:
            if not data_exists(b, "worldgen/biome"):
                err(rel(p), f"биом {b} не найден")
        # порядок фич по шагам — общий для всех биомов измерения
        order_err = feature_order(biomes)
        if order_err:
            err(rel(p), order_err)
        feature_steps[p.stem] = biomes
        # у каждого измерения — физика Sable и привязка Northstar
        dim_id = f"nightshift:{p.stem}"
        if not (OURS / "dimension_physics" / f"{p.stem}.json").is_file():
            warn(rel(p), "нет dimension_physics (Sable возьмёт земную гравитацию)")
        pds = [json.loads(x.read_text())["dimension"] for x in (OURS / "northstar" / "planet_dimension").glob("*.json")]
        if dim_id not in pds:
            err(rel(p), "нет northstar/planet_dimension для этого измерения — ракета не увидит планету")


def feature_order(biomes):
    for step in range(11):
        pos = {}
        for b in biomes:
            ns, path = split(b)
            f = DATA / ns / "worldgen" / "biome" / f"{path}.json"
            if not f.is_file():
                continue
            feats = json.loads(f.read_text())["features"]
            lst = feats[step] if step < len(feats) else []
            for i, a in enumerate(lst):
                for c in lst[i + 1:]:
                    if (c, a) in pos:
                        return f"шаг {step}: {a} и {c} в разном порядке в {pos[(c, a)]} и {b} — Feature order cycle"
                    pos[(a, c)] = b
    return None


def check_dimension_types():
    for p in sorted((OURS / "dimension_type").glob("*.json")):
        q = check_file(p, ns_json("dimension_type/mars.json"), "northstar:dimension_type/mars")
        if q["effects"] not in ("northstar:space", "northstar:orbit", "northstar:mars", "northstar:venus",
                                "minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"):
            err(rel(p), f"effects {q['effects']} — нет таких DimensionSpecialEffects (Northstar: space/orbit/mars/venus)")
        if q["min_y"] % 16 or q["height"] % 16:
            err(rel(p), "min_y и height должны быть кратны 16")


def check_physics():
    for p in sorted((OURS / "dimension_physics").glob("*.json")):
        q = check_file(p, ns_json("dimension_physics/mars.json"), "northstar:dimension_physics/mars (формат Sable)",
                       optional=("priority", "universal_drag", "pressure_function", "magnetic_north", "ignore_chunks"))
        if not data_exists(q["dimension"], "dimension"):
            err(rel(p), f"dimension {q['dimension']} не найдено")
        pd = OURS / "northstar" / "planet_dimension" / f"{p.stem}.json"
        if pd.is_file():
            g = json.loads(pd.read_text()).get("gravity", 9.807)
            if abs(-q["base_gravity"][1] - g) > 0.05:
                warn(rel(p), f"гравитация Sable {q['base_gravity'][1]} не совпадает с Northstar {g}")


def check_noise_settings():
    ref = ns_json("worldgen/noise_settings/mercury.json")
    for p in sorted((OURS / "worldgen" / "noise_settings").glob("*.json")):
        q = check_file(p, ref, "northstar:worldgen/noise_settings/mercury")
        for o in walk(q):
            if "Name" in o and not block_exists(o["Name"]):
                err(rel(p), f"блок {o['Name']} не найден")
            if o.get("type") == "minecraft:biome":
                for b in o["biome_is"]:
                    if not data_exists(b, "worldgen/biome"):
                        err(rel(p), f"surface_rule: биом {b} не найден")
        # density functions: ссылки на ванильные/northstar функции должны существовать
        for s in re.findall(r'"([a-z_]+:[a-z_/]+)"', json.dumps(q["noise_router"])):
            ns, path = split(s)
            if "/" in path and not (data_exists(s, "worldgen/density_function") or data_exists(s, "worldgen/noise")):
                err(rel(p), f"noise_router: {s} не найден")


def check_biomes():
    ref = ns_json("worldgen/biome/mercury_hills.json")
    for p in sorted((OURS / "worldgen" / "biome").glob("*.json")):
        q = check_file(p, ref, "northstar:worldgen/biome/mercury_hills", optional=("particle",))
        if len(q["features"]) != 11:
            err(rel(p), "features: должно быть 11 шагов генерации")
        for step in q["features"]:
            for f in step:
                if not data_exists(f, "worldgen/placed_feature"):
                    err(rel(p), f"placed_feature {f} не найдена")
        for c in q["carvers"].get("air", []):
            if not data_exists(c, "worldgen/configured_carver"):
                err(rel(p), f"карвер {c} не найден")
        part = q["effects"].get("particle")
        if part:
            ptype = part["options"]["type"]
            if f"assets/minecraft/particles/{split(ptype)[1]}.json" not in VAN_NAMES:
                err(rel(p), f"частица {ptype} не найдена")
            compare(part, van_json("worldgen/biome/basalt_deltas.json")["effects"]["particle"], rel(p), "$.effects.particle")


def check_features():
    ref_ore = ns_json("worldgen/placed_feature/mercury_ore_titanium.json")
    for p in sorted((OURS / "worldgen" / "configured_feature").glob("*.json")):
        q = check_file(p, ref_ore["feature"], "northstar:placed_feature/mercury_ore_titanium (inline feature)")
        for t in q["config"]["targets"]:
            if not block_exists(t["state"]["Name"]):
                err(rel(p), f"блок {t['state']['Name']} не найден")
            tg = t["target"].get("tag")
            if tg and not tag_exists(tg, "block"):
                err(rel(p), f"тег блоков {tg} не найден")
    for p in sorted((OURS / "worldgen" / "placed_feature").glob("*.json")):
        q = json.loads(p.read_text())
        f = q["feature"]
        if isinstance(f, str):
            if not data_exists(f, "worldgen/configured_feature"):
                err(rel(p), f"configured_feature {f} не найдена")
            ref = {"feature": "", "placement": ref_ore["placement"]}
            # для не-рудных фич — ванильный placed_feature с похожим размещением
            if not f.startswith("nightshift:"):
                ref = van_json("worldgen/placed_feature/ice_spike.json")
            compare(q, ref, rel(p))
            checked.append(f"{rel(p)}  ~  {'northstar:mercury_ore_titanium (placement)' if f.startswith('nightshift:') else 'minecraft:ice_spike (placement)'}")
        known = {"minecraft:count", "minecraft:in_square", "minecraft:height_range", "minecraft:biome",
                 "minecraft:heightmap", "minecraft:rarity_filter", "minecraft:count_on_every_layer"}
        for pl in q["placement"]:
            if pl["type"] not in known:
                warn(rel(p), f"размещение {pl['type']} не сверено")


def check_carvers():
    for p in sorted((OURS / "worldgen" / "configured_carver").glob("*.json")):
        name = p.stem.replace("planet_", "")
        q = check_file(p, van_json(f"worldgen/configured_carver/{name}.json"), f"minecraft:configured_carver/{name}")
        if not tag_exists(q["config"]["replaceable"], "block"):
            err(rel(p), f"тег {q['config']['replaceable']} не найден")


def check_tags():
    for p in sorted((OURS / "tags").rglob("*.json")):
        if not p.stem.startswith(("axiomativ_", "yin_yang_", "planet_")):
            continue  # чужие теги пака (не про планеты) тут не проверяем
        kind = p.parent.relative_to(OURS / "tags").as_posix()
        for v in json.loads(p.read_text())["values"]:
            v = v["id"] if isinstance(v, dict) else v
            if v.startswith("#"):
                ok = tag_exists(v, kind)
            elif kind == "block":
                ok = block_exists(v)
            elif kind == "worldgen/biome":
                ok = data_exists(v, "worldgen/biome")
            else:
                ok = True
            if not ok:
                err(rel(p), f"{v} не найден")
        checked.append(f"{rel(p)}  (ссылки)")


def check_loot():
    ref = van_json("loot_table/blocks/iron_ore.json")
    for p in sorted((DATA / "kubejs" / "loot_table" / "blocks").glob("*.json")):
        q = check_file(p, ref, "minecraft:loot_table/blocks/iron_ore")
        bid = "kubejs:" + p.stem
        if bid not in KJS_BLOCKS:
            err(rel(p), f"блок {bid} не регистрируется в startup_scripts/planets")
        for o in walk(q):
            if o.get("type") == "minecraft:item" and not item_exists(o["name"]):
                err(rel(p), f"предмет {o['name']} не найден")
    for b in KJS_BLOCKS:
        if not (DATA / "kubejs" / "loot_table" / "blocks" / f"{split(b)[1]}.json").is_file():
            err("startup_scripts/planets", f"у {b} нет своей таблицы лута — будет ронять сам себя")


def check_scripts_and_assets():
    for d in ("startup_scripts/planets", "server_scripts/planets"):
        for js in (PACK / "kubejs" / d).glob("*.js"):
            code = re.sub(r"//.*", "", js.read_text())
            if re.search(r"\b(const|let)\s", code):
                err(rel(js), "const/let запрещены (Rhino KubeJS) — только var")
            checked.append(f"{rel(js)}  (var-only)")
    langs = {loc: json.loads((PACK / f"kubejs/assets/kubejs/lang/{loc}.json").read_text()) for loc in ("ru_ru", "en_us")}
    for b in KJS_BLOCKS:
        path = split(b)[1]
        for loc, lang in langs.items():
            if f"block.kubejs.{path}" not in lang:
                err(f"lang/{loc}", f"нет block.kubejs.{path}")
        if not (PACK / f"kubejs/assets/kubejs/textures/block/{path}.png").is_file():
            err("textures", f"нет текстуры блока {path}")
    for i in KJS_ITEMS:
        path = split(i)[1]
        for loc, lang in langs.items():
            if f"item.kubejs.{path}" not in lang:
                err(f"lang/{loc}", f"нет item.kubejs.{path}")
        if not (PACK / f"kubejs/assets/kubejs/textures/item/{path}.png").is_file():
            err("textures", f"нет текстуры предмета {path}")
    for p in (OURS / "northstar" / "planet").glob("*.json"):
        key = f"nightshift.planets.{p.stem}.name"
        for loc, lang in langs.items():
            if key not in lang:
                err(f"lang/{loc}", f"нет {key} (имя планеты в звёздной карте)")
    for p in (OURS / "worldgen" / "biome").glob("*.json"):
        key = f"biome.nightshift.{p.stem}"
        for loc, lang in langs.items():
            if key not in lang:
                warn(f"lang/{loc}", f"нет {key}")
    # измерения закрыты по фазе вместе с планетами Northstar (при NS_OPEN_WORLD=false)
    dims = (PACK / "kubejs/server_scripts/nightshift/07_dimensions.js").read_text()
    for p in (OURS / "dimension").glob("*.json"):
        if f"'nightshift:{p.stem}'" not in dims:
            warn("07_dimensions.js", f"nightshift:{p.stem} не в списке фазовой блокировки")


def check_quests():
    for f in (PACK / "tools" / "quests").glob("*.json"):
        for ch in json.loads(f.read_text())["chapters"]:
            for q in ch["quests"]:
                if q["type"] == "dimension":
                    d = q["dimension"]
                    if not (data_exists(d, "dimension") or d in ("minecraft:overworld", "minecraft:the_nether", "minecraft:the_end")):
                        err(f"{f.name}/{q['key']}", f"измерение {d} не найдено")
                    checked.append(f"quests/{f.name}/{q['key']}  → {d}")


def main():
    for fn in (check_planets, check_planet_dimensions, check_dimensions, check_dimension_types, check_physics,
               check_noise_settings, check_biomes, check_features, check_carvers, check_tags, check_loot,
               check_scripts_and_assets, check_quests):
        fn()
    print("Сверено:")
    for c in checked:
        print("  " + c)
    if warnings:
        print(f"\nПредупреждения ({len(warnings)}):")
        for w_ in warnings:
            print("  " + w_)
    if errors:
        print(f"\nОШИБКИ ({len(errors)}):")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print(f"\nОшибок нет ({len(checked)} проверок).")


if __name__ == "__main__":
    main()
