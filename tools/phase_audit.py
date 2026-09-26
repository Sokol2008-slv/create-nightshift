#!/usr/bin/env python3
"""Аудит фаз квестов: минимальная фаза каждого предмета по графу рецептов.

Источники: все рецепты и теги предметов из jar модов + ванильного клиента,
базовые фазы — блокировки AStages (kubejs/server_scripts/nightshift/02_items.js),
удалённые нами рецепты (event.remove({ id })) не учитываются.
phase(предмет) = max(блокировка, min по рецептам(max фаз ингредиентов)).
Предмет без рецепта и без блокировки — фаза 0 (добывается в мире).
Выход: список квестов, чья фаза ниже фазы предмета, и JSON с фазами для генератора.
"""
import glob, io, json, pathlib, re, sys, zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PACK / "tools"))
import gen_quests as G

recipes = {}   # id рецепта -> (выходы, [группы вариантов ингредиентов])
tags = {}      # тег -> set(значений)


def add_tag(name, vals, replace):
    s = tags.setdefault(name, set())
    if replace:
        s.clear()
    for v in vals:
        if isinstance(v, dict):
            v = v.get("id")
        if v:
            s.add(v)


def ing_options(x):
    """Ингредиент рецепта → список вариантов ('item:…' / '#tag')."""
    if x is None:
        return None
    if isinstance(x, str):
        return [x if x.startswith("#") else x]
    if isinstance(x, list):
        out = []
        for y in x:
            o = ing_options(y)
            if o:
                out += o
        return out or None
    if isinstance(x, dict):
        if "fluid" in x:
            f = x["fluid"]
            return ["fluid:" + (f["id"] if isinstance(f, dict) else f)]
        if "fluid_tag" in x:
            return ["#fluid:" + x["fluid_tag"]]
        if x.get("type") in ("fluid_stack", "fluid_tag", "neoforge:single", "create:fluid"):
            return None
        if "item" in x:
            it = x["item"]
            return [it["id"] if isinstance(it, dict) else it]
        if "tag" in x:
            return ["#" + x["tag"]]
        if "id" in x and ":" in str(x["id"]):
            return [x["id"]]
        if "ingredient" in x:
            return ing_options(x["ingredient"])
        if "items" in x:
            return ing_options(x["items"])
        if "children" in x:
            return ing_options(x["children"])
    return None


def outputs_of(d):
    outs = []
    for k in ("result", "results", "output", "outputs"):
        v = d.get(k)
        if v is None:
            continue
        for r in (v if isinstance(v, list) else [v]):
            if isinstance(r, str):
                outs.append(r)
            elif isinstance(r, dict):
                i = r.get("id") or r.get("item")
                if isinstance(i, dict):
                    i = i.get("id")
                if not i or (r.get("chance") is not None and r.get("chance") < 0.5):
                    continue
                outs.append("fluid:" + i if "amount" in r and "count" not in r else i)
    return outs


def groups_of(d):
    gs = []
    if isinstance(d.get("key"), dict):
        for v in d["key"].values():
            o = ing_options(v)
            if o:
                gs.append(o)
    for k in ("ingredients", "ingredient", "base", "addition", "template"):
        v = d.get(k)
        if v is None:
            continue
        if k == "ingredients" and isinstance(v, list):
            for y in v:
                o = ing_options(y)
                if o:
                    gs.append(o)
        else:
            o = ing_options(v)
            if o:
                gs.append(o)
    for st in d.get("sequence", []) or []:  # sequenced_assembly
        for y in (st.get("ingredients") or [])[1:]:
            o = ing_options(y)
            if o:
                gs.append(o)
    return gs


SKIP_NS = ("create_compressed:", "create_recycle:", "creategoggles:crushing/")  # упаковка/распаковка/переработка — не новый источник
loaded = set()


def cond_ok(c):
    if isinstance(c, list):
        return all(cond_ok(x) for x in c)
    t = c.get("type", "")
    if t == "neoforge:mod_loaded":
        return c.get("modid") in loaded
    if t == "neoforge:not":
        return not cond_ok(c.get("value", {}))
    if t == "neoforge:and":
        return all(cond_ok(x) for x in c.get("values", []))
    if t == "neoforge:or":
        return any(cond_ok(x) for x in c.get("values", []))
    return True


pending = []


def scan(zf):
    for n in zf.namelist():
        if n.endswith("neoforge.mods.toml"):
            loaded.update(re.findall(r'modId\s*=\s*"([^"]+)"', zf.read(n).decode("utf8", "ignore")))
            continue
        m = re.match(r"^data/([^/]+)/recipes?/(.+)\.json$", n)
        if m and "/recipe/" in n:
            try:
                d = json.loads(zf.read(n))
            except Exception:
                continue
            if not isinstance(d, dict) or "neoforge:conditions" in d:
                pass
            pending.append((f"{m.group(1)}:{m.group(2)}", d))
            continue
        m = re.match(r"^data/([^/]+)/tags/(items?|fluids?)/(.+)\.json$", n)
        if m:
            try:
                d = json.loads(zf.read(n))
                fl = m.group(2).startswith("fluid")
                vals = d.get("values", [])
                if fl:
                    vals = [("#fluid:" + v[1:]) if isinstance(v, str) and v.startswith("#") else ("fluid:" + (v["id"] if isinstance(v, dict) else v)) for v in vals]
                add_tag(("fluid:" if fl else "") + f"{m.group(1)}:{m.group(3)}", vals, d.get("replace", False))
            except Exception:
                pass
        elif n.startswith("META-INF/jarjar/") and n.endswith(".jar"):
            with zipfile.ZipFile(io.BytesIO(zf.read(n))) as inner:
                scan(inner)


jars = list(G.MODS.glob("*.jar")) + [G.VANILLA]
nf = list(pathlib.Path.home().glob("mc-nightshift-test/libraries/net/neoforged/neoforge/*/neoforge-*-universal.jar"))
for j in jars + nf:
    try:
        with zipfile.ZipFile(j) as zf:
            scan(zf)
    except Exception as e:
        print("пропущен", j, e, file=sys.stderr)
for rid, d in pending:
    if not isinstance(d, dict) or rid.startswith(SKIP_NS):
        continue
    if "neoforge:conditions" in d and not cond_ok(d["neoforge:conditions"]):
        continue
    rtype = str(d.get("type", ""))
    if ":" in rtype and rtype.split(":")[0] not in loaded and rtype.split(":")[0] != "minecraft":
        continue
    outs, gs = outputs_of(d), groups_of(d)
    if "sequenced_assembly" in rtype:
        outs = outs[:1]  # остальное в results — побочный «мусор» сборки
    if outs and gs:
        recipes[rid] = (outs, gs)
# наши рецепты (KubeJS) — только удаления
removed = set()
for js in (PACK / "kubejs" / "server_scripts").rglob("*.js"):
    removed |= set(re.findall(r"remove\(\{\s*id:\s*'([^']+)'", js.read_text()))
for r in removed:
    recipes.pop(r, None)
# базовые фазы — блокировки AStages
lock = {"fluid:tfmg:crude_oil": 4, "fluid:tfmg:heavy_oil": 4, "fluid:tfmg:sulfuric_acid": 4}
# Естественные источники: дроп мобов, рыбалка и прочий «игровой» лут (не сундуки) — фаза 0,
# если предмет не заперт явно. Вёдра с жидкостями зачерпывают, а не крафтят — фаза ведра (P1).
natural = set()


def scan_loot(zf):
    for n in zf.namelist():
        if re.match(r"^data/[^/]+/loot_tables?/(entities|gameplay)/.+\.json$", n):
            natural.update(re.findall(r'"name"\s*:\s*"([a-z0-9_.-]+:[a-z0-9_/.-]+)"', zf.read(n).decode("utf8", "ignore")))
        elif n.startswith("META-INF/jarjar/") and n.endswith(".jar"):
            with zipfile.ZipFile(io.BytesIO(zf.read(n))) as inner:
                scan_loot(inner)


for j in jars:
    try:
        with zipfile.ZipFile(j) as zf:
            scan_loot(zf)
    except Exception:
        pass
SCOOPED = {"minecraft:lava_bucket", "minecraft:water_bucket", "minecraft:milk_bucket", "minecraft:powder_snow_bucket",
           "minecraft:cod_bucket", "minecraft:salmon_bucket", "minecraft:pufferfish_bucket", "minecraft:tropical_fish_bucket",
           "minecraft:axolotl_bucket", "minecraft:tadpole_bucket"}
src = (PACK / "kubejs/server_scripts/nightshift/02_items.js").read_text()
for m in re.finditer(r"lockItems\('[^']+',\s*'nightshift_p(\d)',([^)]*)\)", src, re.S):
    for it in re.findall(r"'([^']+)'", m.group(2)):
        lock[it] = int(m.group(1))


def expand(t, seen=None):
    seen = seen or set()
    if t in seen:
        return set()
    seen.add(t)
    out = set()
    for v in tags.get(t, ()):
        out |= expand(v[1:], seen) if v.startswith("#") else {v}
    return out


tagitems = {t: expand(t) for t in tags}
by_out = {}
for rid, (outs, gs) in recipes.items():
    for o in outs:
        by_out.setdefault(o, []).append(gs)
INF = 99
phase = {}


def ph(x):
    if x.startswith("#"):
        its = tagitems.get(x[1:], set())
        return min((ph(i) for i in its), default=0)
    return phase.get(x, lock.get(x, 0 if x not in by_out else INF))


# Нижний мир открывается в P3 (nightshift/07_dimensions.js): его материалы и дроп — не раньше P3.
# Горелка со всполохом делается поимкой всполоха, а не крафтом — рецепта у неё нет.
FLOOR = {"create:blaze_burner": 3}
for n in ("netherrack", "soul_sand", "soul_soil", "basalt", "blackstone", "gilded_blackstone", "crimson_stem",
          "warped_stem", "crimson_hyphae", "warped_hyphae", "crimson_nylium", "warped_nylium", "nether_wart",
          "nether_wart_block", "warped_wart_block", "shroomlight", "crimson_fungus", "warped_fungus", "crimson_roots",
          "warped_roots", "weeping_vines", "twisting_vines", "nether_sprouts", "blaze_rod", "ghast_tear", "magma_cream",
          "wither_skeleton_skull", "nether_quartz_ore", "nether_gold_ore"):
    FLOOR["minecraft:" + n] = 3
for it, f in FLOOR.items():
    lock[it] = max(lock.get(it, 0), f)
for it in natural:
    by_out.pop(it, None)  # есть в мире — рецепт не нужен
for it in SCOOPED:
    by_out.pop(it, None)
    lock.setdefault(it, 1)
items = set(by_out) | set(lock)
for it in items:
    phase[it] = lock.get(it, 0) if it not in by_out else INF
for _ in range(300):
    changed = False
    for it in items:
        best = INF if it in by_out else 0
        for gs in by_out.get(it, []):
            cost = max((min(ph(o) for o in g) for g in gs), default=0)
            best = min(best, cost)
        # сырьё без рецепта или с рецептом-«упаковкой» (блок из слитков) — не ниже блокировки
        val = max(lock.get(it, 0), best if best < INF else (0 if it not in lock else lock[it]))
        if it in lock:
            val = max(val, lock[it])
        if val != phase.get(it):
            phase[it] = val
            changed = True
    if not changed:
        break
json.dump({k: v for k, v in phase.items() if v < INF}, open(PACK / "dist" / "item_phases.json", "w"), ensure_ascii=False)
# Теги nightshift:phase_N — AStages запирает каждый своей стадией (nightshift/02_items.js):
# машины и изделия из построек и сундуков нельзя подобрать до их фазы.
tagdir = PACK / "kubejs" / "data" / "nightshift" / "tags" / "item"
tagdir.mkdir(parents=True, exist_ok=True)
for n in range(1, 7):
    vals = sorted(k for k, v in phase.items() if v == n and not k.startswith("fluid:") and ":" in k)
    (tagdir / f"phase_{n}.json").write_text(json.dumps({"replace": True, "values": [{"id": v, "required": False} for v in vals]}, ensure_ascii=False, indent=1) + "\n")
    print(f"тег nightshift:phase_{n}: {len(vals)} предметов")

# сверка квестов
specs = G.load_specs()
bad = []
for ch in specs:
    cp = G.PHASE.get(ch["key"], 0)
    for q in ch["quests"]:
        if q["type"] != "item":
            continue
        need = phase.get(q["item"], 0)
        if need >= INF:
            need = -1
        have = q.get("phase", cp)
        if need > have:
            bad.append((ch["key"], q["key"], q["item"], have, need))
for b in bad:
    print(f"{b[0]}/{b[1]}: {b[2]} стоит в фазе {b[3]}, а доступен с фазы {b[4]}")
print(f"рецептов: {len(recipes)}, тегов: {len(tags)}, предметов с фазой: {sum(1 for v in phase.values() if v < INF)}; несоответствий: {len(bad)}")
