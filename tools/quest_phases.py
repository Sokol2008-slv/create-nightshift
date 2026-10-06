#!/usr/bin/env python3
"""Фазы квест-бука по настоящим рецептам «Вахты» (06.10.2026).

Источник рецептов — указатель «Планшета инженера», снятый с сервера после всех правок KubeJS
(tools/data/tablet-ways.json.gz: предмет/жидкость → способы: машина, нагрев, раскладка крафтеров, входы).
Снять заново: временный серверный скрипт /qbdump (см. docs/quests/PHASES.md, раздел «Как пересчитать»).

Для каждого предмета считаем самую раннюю фазу: фаза(предмет) = min по способам(max(фазы входов, фазы машин,
ворота способа)). Ворота — то, что не делается рецептом или назначено границей фазы:
  горелка всполоха (нагрев, котёл) — фаза 2; деплоер и крафтеры сверх девяти из ящика — 3; продукт месторождения
  (экструдер на форпосте) — 4; заряд молнии за 15-ю волну (электромедь) и ток — 5; нефть — 6; метеорит и
  острова (полёт) — 7; планеты и ядро навигации (50-я волна) — 8.
Кроме фазы для предмета запоминаем «чем ограничен» — ворота, которые дали максимум в лучшей цепочке.

Использование:
  quest_phases.py                 — сверка квестов: фаза главы ≥ фазы предмета (код выхода 1 при нарушении)
  quest_phases.py --md            — переписать таблицу docs/quests/PHASES.md
  quest_phases.py --item ID ...   — фаза и цепочка для предметов
Фаза главы — поле "phase" главы в спеке (tools/quests/*.json); главы без фазы не сверяются (справочник, FAQ).
"""
import gzip
import io
import json
import pathlib
import re
import sys
import zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PACK / "tools"))
import gen_quests as G  # noqa: E402

INF = 99
PHASE_NAMES = {0: "Прибытие", 1: "Механика", 2: "Пар и латунь", 3: "Деплоер и логистика", 4: "Форпосты",
               5: "Ток", 6: "Сталь и нефть", 7: "Небо", 8: "Космос"}

# --- ворота: предмет → (фаза, почему). Нижняя граница: предмет не раньше этой фазы, даже если рецепт дешевле.
GATES = {
    "create:blaze_burner": (2, "горелка всполоха"),
    "create:deployer": (3, "деплоер"),
    "create:mechanical_crafter": (3, "крафтеры сверх 9 из ящика"),
    "nightshift:lightning_charge": (5, "волна 15: заряд молнии"),
    "fluid:tfmg:crude_oil": (6, "нефть: качалка"),
    "tfmg:crude_oil_bucket": (6, "нефть: качалка"),
    "nightshift:meteor_ore": (7, "метеорит: волна 10 и полёт"),
    "nightshift:meteor_iron": (7, "метеорит: волна 10 и полёт"),
    "nightshift:navigation_core": (8, "волна 50: ядро навигации"),
    "nightshift:star_fragment": (8, "волна 70: звёздный осколок"),
}
# Награды набегов и особых стадий: предмет → волна (волны 1–14 — любые фазы 1–4, 15 открывает фазу 5)
WAVE_KEYS = {
    "nightshift:coil_core": 22, "nightshift:afterburner_blueprint": 24, "nightshift:otk_armor_plate": 26,
    "nightshift:runner_badge": 28, "nightshift:spirit_essence": 32, "nightshift:prism_lens": 34,
    "nightshift:queen_heart": 36, "nightshift:bastion_core": 38, "nightshift:convoy_seal": 43,
}
for _k, _w in WAVE_KEYS.items():
    GATES[_k] = (5, f"волна {_w}")
# Аэроклуб: удостоверения пилота — налёт на самолёте (самолёт — фаза «Небо»)
for _k in ("nightshift:pilot_license_1", "nightshift:pilot_license_2", "nightshift:pilot_license_3"):
    GATES[_k] = (7, "налёт в аэроклубе")

# Особые источники без рецепта (событие, лавка, набег) — не «добыча с первого дня»
SOURCES = {
    "nightshift:star_shard": (0, "звездопад ночью"),
    "nightshift:shift_token": (1, "жетоны: тир, гонки, контракты"),
    "nightshift:supply_crate": (1, "снабженец"),
    "dmr:dragon_egg": (1, "снабженец или ящик снабжения: с волны 5"),
    "nightshift:horde_shard": (1, "добыча набегов"),
    "nightshift:night_heart": (1, "награда набегов (волны 5+)"),
    "tfmg:fireclay_ball": (0, "добыча: огнеупорная глина"),
    "create_new_age:thorium": (0, "добыча: ториевая руда"),
    "creategbd:guardian_beam_capacitor": (1, "стражи океанских монументов"),
    "creategbd:elder_guardian_beam_capacitor": (1, "древние стражи монументов"),
    "cataclysm:black_steel_nugget": (5, "Cataclysm: структуры и боссы"),
    "create_dragons_plus:blaze_upgrade_smithing_template": (1, "лут Незера"),
    "minecraft:netherite_upgrade_smithing_template": (1, "лут Незера (бастион)"),
    "dmr:dragon_armor": (1, "снабженец, лут"),
    "irons_spellbooks:scroll": (1, "лут, свитки магов"),
}
for _c in ("cabbage", "tomato", "onion", "rice", "rice_panicle"):
    SOURCES["farmersdelight:" + _c] = (0, "грядка Farmer's Delight")
# Делается не рецептом, а в мире (отливка, застывание): предмет → что нужно (фаза — максимум)
MADE = {
    "aeronautics:levitite": ["fluid:aeronautics:levitite_blend"],
    "createbigcannons:cast_iron_cannon_barrel": ["fluid:createbigcannons:molten_cast_iron", "createbigcannons:casting_sand"],
    "createbigcannons:cast_iron_autocannon_barrel": ["fluid:createbigcannons:molten_cast_iron", "createbigcannons:casting_sand"],
    "createbigcannons:cast_iron_sliding_breechblock": ["fluid:createbigcannons:molten_cast_iron", "createbigcannons:casting_sand"],
    "createbigcannons:steel_autocannon_breech": ["fluid:createbigcannons:molten_steel", "createbigcannons:casting_sand"],
    "createbigcannons:steel_autocannon_recoil_spring": ["fluid:createbigcannons:molten_steel", "createbigcannons:casting_sand"],
}

# Природное сырьё по измерениям (то, что не делается или делается дороже, чем добывается)
NETHER = {"minecraft:" + n for n in (
    "netherrack", "soul_sand", "soul_soil", "basalt", "blackstone", "gilded_blackstone", "crimson_stem", "warped_stem",
    "crimson_nylium", "warped_nylium", "nether_wart", "nether_wart_block", "warped_wart_block", "shroomlight",
    "crimson_fungus", "warped_fungus", "weeping_vines", "twisting_vines", "blaze_rod", "ghast_tear", "magma_cream",
    "wither_skeleton_skull", "nether_quartz_ore", "nether_gold_ore", "quartz", "glowstone", "glowstone_dust",
    "ancient_debris", "crying_obsidian", "magma_block")}
END = {"minecraft:" + n for n in ("end_stone", "chorus_fruit", "chorus_flower", "shulker_shell", "elytra",
                                  "dragon_breath", "dragon_head", "purpur_block")}
# Верхний мир: руда, камень, растения — добываются руками и киркой с первого дня
OVERWORLD = {"minecraft:" + n for n in (
    "cobblestone", "stone", "andesite", "diorite", "granite", "deepslate", "cobbled_deepslate", "tuff", "calcite",
    "dirt", "grass_block", "sand", "red_sand", "gravel", "clay_ball", "clay", "flint", "ice", "snowball", "obsidian",
    "raw_iron", "raw_copper", "raw_gold", "coal", "diamond", "emerald", "lapis_lazuli", "redstone", "amethyst_shard",
    "sugar_cane", "kelp", "bamboo", "cactus", "vine", "lily_pad", "pumpkin", "melon_slice", "wheat_seeds",
    "sweet_berries", "glow_berries", "cocoa_beans", "brown_mushroom", "red_mushroom", "apple", "egg", "feather",
    "leather", "string", "bone", "gunpowder", "spider_eye", "rotten_flesh", "ender_pearl", "slime_ball",
    "ink_sac", "glow_ink_sac", "prismarine_shard", "prismarine_crystals", "honeycomb", "phantom_membrane",
    "water_bucket", "lava_bucket", "milk_bucket", "snow_block", "packed_ice", "mud", "moss_block", "dripstone_block",
    "pointed_dripstone", "copper_ore", "iron_ore", "coal_ore", "oak_log", "spruce_log", "birch_log", "jungle_log",
    "acacia_log", "dark_oak_log", "mangrove_log", "cherry_log", "oak_leaves", "dandelion", "poppy", "white_tulip",
    "allium", "azure_bluet", "cornflower", "oxeye_daisy", "sunflower", "beef", "porkchop", "chicken", "mutton",
    "cod", "salmon", "rabbit", "potato", "carrot", "beetroot", "wheat", "torchflower_seeds", "nautilus_shell",
    "turtle_scute", "heart_of_the_sea", "echo_shard", "sculk", "trident")} | {
    "create:raw_zinc", "create:zinc_ore", "create:deepslate_zinc_ore", "create:limestone", "create:scoria",
    "create:asurine", "create:crimsite", "create:ochrum", "create:veridium", "tfmg:lead_ore", "tfmg:raw_lead",
    "tfmg:nickel_ore", "tfmg:raw_nickel", "tfmg:lithium_ore", "tfmg:raw_lithium", "cgs:raw_lead"}
FLUIDS_FREE = {"fluid:minecraft:water", "fluid:minecraft:lava", "fluid:minecraft:milk", "fluid:minecraft:flowing_water",
               "fluid:minecraft:flowing_lava"}
NETHER_PHASE = 1  # портал: обсидиан из вёдер ящика + огниво (железо с промывки)
END_PHASE = 3     # око Края: жемчуг + огненный порошок; крепость; оседлать Край — не раньше деплоера (условно)

# Тип рецепта модов → машины (все нужны). Не указанный тип — способ не считается (машину не знаем).
TYPE_MACH = {
    "farmersdelight:cutting": ["farmersdelight:cutting_board"],
    "sliceanddice:cutting": ["sliceanddice:slicer"],
    "farmersdelight:cooking": ["farmersdelight:cooking_pot"],
    "dndesires:sanding": ["create:encased_fan"],
    "dndesires:seething": ["create:encased_fan", "create:blaze_burner"],
    "dndesires:freezing": ["create:encased_fan", "minecraft:powder_snow_bucket"],
    "dndesires:hydraulic_compacting": ["dndesires:hydraulic_press"],
    "dndesires:dragon_breathing": ["create:encased_fan", "minecraft:dragon_head"],
    "garnished:freezing": ["create:encased_fan", "minecraft:powder_snow_bucket"],
    "createsifter:sifting": ["createsifter:sifter"],
    "createdieselgenerators:wire_cutting": ["create:deployer"],
    "createdieselgenerators:compression_molding": ["create:mechanical_press", "create:basin"],
    "createdieselgenerators:hammering": ["create:mechanical_press"],
    "createdieselgenerators:basin_fermenting": ["create:basin"],
    "createdieselgenerators:bulk_fermenting": ["createdieselgenerators:bulk_fermenter"],
    "createdieselgenerators:distillation": ["createdieselgenerators:distillation_controller"],
    "createbigcannons:melting": ["create:basin", "create:blaze_burner"],
    "tfmg:casting": ["tfmg:casting_basin"],
    "tfmg:coking": ["tfmg:coke_oven"],
    "tfmg:winding": ["tfmg:winding_machine"],
    "tfmg:polarizing": ["tfmg:polarizer"],
    "tfmg:vat_machine_recipe": ["tfmg:steel_vat"],
    "tfmg:distillation": ["tfmg:steel_distillation_controller"],
    "tfmg:industrial_blasting": ["tfmg:blast_furnace_output"],
    "tfmg:hot_blast": ["tfmg:blast_stove"],
    "northstar:freezing": ["northstar:freezer"],
    "northstar:electrolysis": ["northstar:electrolysis_machine"],
    "northstar:engraving": ["northstar:laser_engraver"],
    "create_enchantment_industry:grinding": ["create_enchantment_industry:mechanical_grindstone"],
    "cataclysm:weapon_fusion": ["cataclysm:mechanical_fusion_anvil"],
    "create_dragons_plus:freezing": ["create:encased_fan", "minecraft:powder_snow_bucket"],
    "create_dragons_plus:ending": ["create:encased_fan", "minecraft:dragon_head"],
}
for _c in ("lime", "brown", "green", "red", "black", "white", "orange", "magenta", "light_blue", "yellow", "pink",
           "gray", "light_gray", "cyan", "purple", "blue"):
    TYPE_MACH[f"garnished:{_c}_dye_blowing"] = ["create:encased_fan"]
# Ящик вахтовика (бригадиру) — машины первого дня
KIT = {"create:mechanical_mixer", "create:basin", "create:mechanical_press", "create:mechanical_saw",
       "create:millstone", "create:encased_fan", "create:depot", "create:hand_crank", "create:water_wheel",
       "create:shaft", "create:cogwheel", "create:large_cogwheel", "create:wrench", "create:goggles",
       "create:andesite_funnel", "minecraft:furnace"}
METHOD_MACH = {
    "MIXER": ["create:mechanical_mixer", "create:basin"], "COMPACT": ["create:mechanical_press", "create:basin"],
    "PRESS": ["create:mechanical_press"], "DEPLOYER": ["create:deployer"], "APPLY": [],
    "POLISH": ["create:sand_paper"], "SAW": ["create:mechanical_saw"], "SAW_STONE": ["create:mechanical_saw"],
    "CRUSHER": ["create:crushing_wheel"], "MILLSTONE": ["create:millstone"], "WASH": ["create:encased_fan"],
    "HAUNT": ["create:encased_fan", "minecraft:soul_sand"], "SMOKE": ["create:encased_fan"],
    "FAN_SMELT": ["create:encased_fan"], "CAMPFIRE": ["minecraft:campfire"], "SPOUT": ["create:spout"],
    "DRAIN": ["create:item_drain"], "EXTRUDER": ["create_mechanical_extruder:mechanical_extruder"],
    "OUTPOST": ["create_mechanical_extruder:mechanical_extruder"], "ENERGISER": ["create_new_age:basic_energiser", "@power"],
    "ROLLING": ["createaddition:rolling_mill"], "CHARGING": ["createaddition:tesla_coil", "@power"],
    "GRINDSTONE": ["axiomativ:planetary_grindstone"],
}
POWER = ["createaddition:alternator", "create_new_age:generator_coil", "tfmg:generator"]


NATURAL_RE = re.compile(r"(_ore$|:raw_|:wild_|_sapling$|_log$|_leaves$|_seeds$|_stone$|_sand$|_dirt$|_cluster$)")


def natural(it):
    """Предмет без единого рецепта: откуда он берётся. Неизвестное — INF (нет пути): пусть человек посмотрит."""
    ns = it.split(":", 1)[0]
    if ns == "northstar" or (ns == "kubejs" and re.search(r"(_ore$|:raw_)", it)):
        return (8, "планета")
    if ns == "minecraft" or (NATURAL_RE.search(it) and not it.endswith("_piece")):
        return (0, "добыча")
    return (INF, "нет рецепта")


def load_ways():
    d = json.load(gzip.open(PACK / "tools" / "data" / "tablet-ways.json.gz", "rt"))
    ways = dict(d["items"])
    for f, ws in d["fluids"].items():
        ways["fluid:" + f] = ws
    return ways


def mob_drops():
    """Дроп ванильных мобов (loot_table/entities ванильного клиента): природное сырьё, даже если есть рецепт.
    Моды не берём: их мобы роняют что угодно (латунь, сталь) — это не путь игрока."""
    out = set()
    if G.VANILLA.is_file():
        with zipfile.ZipFile(G.VANILLA) as zf:
            for n in zf.namelist():
                if re.match(r"^data/minecraft/loot_tables?/entities/.+\.json$", n):
                    out.update(re.findall(r'"name"\s*:\s*"(minecraft:[a-z0-9_]+)"', zf.read(n).decode("utf8", "ignore")))
    return out


class Phases:
    def __init__(self):
        self.ways = load_ways()
        self.val = {}    # предмет → фаза
        self.why = {}    # предмет → ворота (подпись), которые дали максимум
        self.best = {}   # предмет → индекс лучшего способа (или подпись источника)
        base = {}
        for it in OVERWORLD | (mob_drops() - NETHER - END) | KIT | FLUIDS_FREE:
            base[it] = (0, "добыча / ящик")
        for it in NETHER:
            base[it] = (NETHER_PHASE, "Незер")
        for it in END:
            base[it] = (END_PHASE, "Край")
        self.base = base

    def gate(self, it):
        return GATES.get(it)

    def way_cost(self, w):
        """(фаза, подпись ворот) способа при текущих значениях."""
        m, t = w["m"], w["t"]
        if m == "SMITHING":
            return INF, "кузнечный стол закрыт"
        if m == "OTHER":
            mach = TYPE_MACH.get(t)
            if mach is None:
                return INF, f"машина {t} не учтена"
        elif m == "CRAFTERS":
            cells = sum(n["c"] for n in w["in"] if not n["f"])
            mach = ["create:mechanical_crafter"] if cells > 9 else []
        elif m == "ASSEMBLY":
            mach = list(w["mc"])
        else:
            mach = list(METHOD_MACH.get(m, []))
        if m in ("MIXER", "COMPACT") or (m == "OTHER" and w["h"]):
            if w["h"] >= 1:
                mach.append("create:blaze_burner")
            if w["h"] >= 2:
                mach.append("create:blaze_cake")
        if any("armor_trim_smithing_template" in o for n in w["in"] for o in n["o"]):
            # отделка брони: «эта же вещь с узором» — не способ её получить
            return INF, "отделка брони"
        if not w["in"] and m != "OUTPOST":
            return INF, "способ без входов"
        best, why = 0, "добыча / ящик"
        if m == "OUTPOST":
            best, why = 4, "форпост: " + w.get("op", "?")
        for mc in mach:
            if mc == "@power":
                p, y = self.power()
            else:
                p, y = self.get(mc)
            if p > best:
                best, why = p, y
        for n in w["in"]:
            opts = n["o"] or ["fluid:" + f for f in n["f"]]
            p, y = min((self.get(o) for o in opts), default=(INF, "нет входа"), key=lambda x: x[0])
            if p > best:
                best, why = p, y
        return best, why

    def power(self):
        return min((self.get(g) for g in POWER), key=lambda x: x[0])

    def get(self, it):
        v = self.val.get(it)
        if v is not None:
            return v
        if it in SOURCES:
            return SOURCES[it]
        if it.startswith("fluid:") and ":flowing_" in it:
            return self.get(it.replace(":flowing_", ":", 1))
        if it in MADE:
            return max((self.get(x) for x in MADE[it]), key=lambda x: x[0])
        if it.endswith("_bucket") and it not in self.ways and not it.startswith("fluid:"):
            # ведро жидкости — зачерпнуть или налить дозатором: фаза жидкости
            fl = self.get("fluid:" + it[:-len("_bucket")])
            if fl[0] < INF:
                return fl
        if it not in self.ways:
            return natural(it)
        return (INF, "не найден способ")

    def compute(self):
        items = set(self.ways) | set(self.base) | set(GATES)
        for it in items:
            if it in self.base:
                self.val[it] = self.base[it]
                self.best[it] = "source"
            elif it not in self.ways:
                # без рецепта и не в списках: природное (Верхний мир) или особый источник из GATES
                self.val[it] = (0, "добыча") if it not in GATES else GATES[it]
                self.best[it] = "source"
            g = GATES.get(it)
            if g and it in self.val and self.val[it][0] < g[0]:
                self.val[it] = g
        # особый источник у предмета с рецептом (Сердце ночи — и из набегов, и из звёзд): берём меньшую фазу
        for it, v in SOURCES.items():
            if it in self.ways:
                self.val[it] = v
                self.best[it] = "src"
        for _ in range(200):
            changed = False
            for it, ws in self.ways.items():
                if self.best.get(it) == "source" and it not in GATES:
                    continue
                cur = self.val.get(it, (INF, "не найден способ"))
                for i, w in enumerate(ws):
                    c = self.way_cost(w)
                    g = GATES.get(it)
                    if g and c[0] < g[0]:
                        c = g
                    if c[0] < cur[0]:
                        cur = c
                        self.best[it] = i
                        changed = True
                self.val[it] = cur
            if not changed:
                break

    def chain(self, it, depth=0, seen=None, maxd=6):
        """Строки цепочки лучшего способа: только ветви, которые несут максимум фазы."""
        seen = seen or set()
        p, why = self.get(it)
        b = self.best.get(it)
        pad = "  " * depth
        if it in seen or depth > maxd:
            return []
        seen.add(it)
        if b in (None, "source") or not isinstance(b, int):
            return [f"{pad}{it} — ф{p} ({why})"]
        w = self.ways[it][b]
        lines = [f"{pad}{it} — ф{p} ({why}) ← {w['l']} [{w['r']}]"]
        for n in w["in"]:
            opts = n["o"] or ["fluid:" + f for f in n["f"]]
            o = min(opts, key=lambda x: self.get(x)[0])
            if self.get(o)[0] == p and p > 0:
                lines += self.chain(o, depth + 1, seen, maxd)
        return lines


def quest_items(spec_chapters):
    """(глава, ключ, предмет, фаза главы) для каждого квеста-предмета и задач-предметов."""
    for ch in spec_chapters:
        for q in ch["quests"]:
            its = []
            if q.get("tasks"):
                its = [t["item"] for t in q["tasks"] if "item" in t]
            elif q["type"] == "item":
                its = [q["item"]]
            for it in its:
                yield ch, q, it


def main():
    P = Phases()
    P.compute()
    if "--item" in sys.argv:
        for it in sys.argv[sys.argv.index("--item") + 1:]:
            print("\n".join(P.chain(it)))
        return
    specs = G.load_specs()
    bad = 0
    rows = []
    for ch, q, it in quest_items(specs):
        p, why = P.get(it)
        if (it in KIT or it == "create:mechanical_crafter") and p > 0:
            # в ящике вахтовика уже есть (9 крафтеров и машины первого дня): квест на сам предмет — фаза 0
            p, why = 0, "ящик вахтовика"
        cp = q.get("phase", ch.get("phase"))
        rows.append((ch, q, it, p, why, cp))
        if cp is not None and p > cp and p < INF:
            bad += 1
            print(f"РАНО: {ch['key']}/{q['key']}: {it} — глава в фазе {cp}, предмет доступен с фазы {p} ({why})")
        if p >= INF:
            print(f"нет пути: {ch['key']}/{q['key']}: {it} ({why})")
    if "--md" in sys.argv:
        write_md(P, rows)
    print(f"квестовых предметов: {len(rows)}, раньше своей фазы: {bad}")
    sys.exit(1 if bad else 0)


NOTES = """## Несостыковки, найденные при раскладке (06.10.2026)

- **Квесты на «исчезнувшие» предметы.** Almost Unified сводит свинец, стальной лист и сталь к TFMG: ни один рецепт не
  выдаёт `cgs:lead_ingot`, `cgs:steel_sheet`, `createbigcannons:steel_ingot` — квесты «Свинец», «Сталь для ружей»,
  «Стальные стволы» были невыполнимы. Теперь в них `tfmg:lead_ingot`, `tfmg:heavy_plate`, `tfmg:steel_ingot`.
- **Сталь — фаза 2, а не 6.** Миксер с нагревом: 2 железных слитка + уголь → 2 стали (`createbigcannons:mixing/alloy_steel`),
  ещё рецепт CGS с суперогнём. Поэтому ворота фазы 6 — деплоер (стальные механизмы TFMG) и нефть, а не сама сталь.
- **Склад Create 6 — фаза 1.** Упаковщик, складской передатчик, тикер и квакопорт делаются без латуни (железо, редстоун,
  картон, хранилище). В книге они в фазе 3 рядом с поездами — раньше можно, просто незачем.
- **Экструдер — фаза 1** (миксер: 3 белого стекла, андезитовый корпус, вал). Форпосты начинаются с загрузчика чанков
  (Незер: светокамень, жемчуг Края, якорь возрождения) и дробильных колёс (фаза 3) для боксита и серы.
- **Дробильные колёса — фаза 3.** Сборка 5×5 на 21 механическом крафтере, а крафтер — латунный корпус + лампа: без латуни
  есть только 9 крафтеров из ящика. То же со всеми рецептами крупнее 9 клеток (генератор C&A — есть раскладка 3×3).
- **Электромедь требует деплоер** (фаза 3) кроме заряда молнии — ворота фазы 5 двойные: волна 15 и деплоер.
- **Самолёт — фаза 4.** Биплан Immersive Aircraft — алюминий и кварцевое стекло с форпостов, ни тока, ни стали. Штуковины
  Simulated / Aeronautics (пропеллер, портативный двигатель) летают уже в фазе 2–3. Метеориты — с 10-й волны и полётом.
- **Прокатный стан и электризатор** собираются в фазе 1 (без электромеди), но без тока бесполезны — стоят в фазе 5.
- **Рассудок до фазы 4.** Успокоительное и настойка жизни — споры «Грибных пещер» (фаза 4); раньше — только травяной чай
  (миксер с нагревом, фаза 2). В «Первой ночи» больше не советуем таблетки.
- **Дубли предметов:** «Горелка под котлом» и «Горелка всполоха» — один предмет (оставлены обе: первая про нагрев котла);
  12 квестов-дублей удалены (см. CHANGELOG).
- **Буровая** (аддон 0.7.0) — в рецепте электромедь, поэтому фаза 5, хотя ставится на месторождения фазы 4.
"""

RECOUNT = """## Как пересчитать

1. Тестовый сервер: временный скрипт `zz_qbdump.js` в `kubejs/server_scripts/` сервера (не в пак) с командой `/qbdump` —
   обходит `TabletNet.serverIndex(server)` планшета (все рецепты после KubeJS, с машинами, нагревом, раскладкой крафтеров)
   и пишет строки `QBDUMP {...}` в лог. Скрипт и rcon-клиент — `~/projects/ns-patches/agentQB/`.
2. Строки из `logs/latest.log` → `tools/data/tablet-ways.json.gz` (`{"items": {id: [способ]}, "fluids": {...}}`).
3. `python3 tools/quest_phases.py` — сверка (код 1 при «РАНО»), `--md` — этот файл, `--item ID` — цепочка предмета.
"""


def write_md(P, rows):
    specs = {c["key"]: c for c in G.load_specs()}
    titles = {f"{c['key']}:{q['key']}": q["title"] for c in specs.values() for q in c["quests"]}
    clean = lambda t: re.sub(r"&[0-9a-fk-or]", "", t)
    out = ["# Фазы квест-бука: предмет → фаза → чем ограничен", "",
           "Сгенерировано `tools/quest_phases.py --md` (06.10.2026) по указателю рецептов «Планшета инженера», снятому",
           "с сервера после всех правок KubeJS (`tools/data/tablet-ways.json.gz`, 10 400 предметов, 290 жидкостей).", "",
           "**Как считается фаза.** Для каждого предмета — самая ранняя фаза, в которой его можно сделать на «Вахте»:",
           "фаза = min по рецептам(max(фазы входов, фазы машин способа, ворота)). Машина способа — по типу рецепта:",
           "миксер/пресс/пила/жернов/вентилятор — ящик вахтовика (фаза 0); нагрев — горелка всполоха; крафтеры больше",
           "9 клеток — новые крафтеры (латунь); деплоер, дозатор, дробильные колёса, сборка по шагам — свои машины по их",
           "рецептам; экструдер на месторождении — форпост; электризатор и катушка Теслы — ещё и ток. Кузнечный стол",
           "закрыт. Сырьё без рецепта — добыча (Незер — фаза 1, Край — 3, планеты — 8), особые источники (звездопад,",
           "жетоны, набеги) — своя фаза. «Чем ограничен» — ворота, давшие максимум в самой дешёвой цепочке.", "",
           "Правило книги: **фаза главы ≥ фазы предмета** (`quest_phases.py` без ключей пишет «РАНО» и возвращает 1).",
           "Стоять позже можно (например, склад Create — фаза 1, а в книге в фазе 3 у поездов).", "",
           "## Фазы и ворота", "",
           "| Фаза | Глава | Первый квест (ворота в книге) | Требует | Ограничители фазы |", "|---|---|---|---|---|"]
    gates_by_phase = {}
    for it, (p, why) in GATES.items():
        gates_by_phase.setdefault(p, set()).add(why)
    gates_by_phase.setdefault(4, set()).add("продукт месторождения (экструдер на форпосте)")
    keys = {w for w in gates_by_phase.get(5, set()) if w.startswith("волна ") and not w.startswith("волна 15")}
    if keys:
        gates_by_phase[5] = (gates_by_phase[5] - keys) | {"ключи особых стадий (волны 22–43)"}
    for ck, c in specs.items():
        if "phase" not in c:
            continue
        p = c["phase"]
        first = next((q for q in c["quests"] if not [d for d in q.get("deps", []) if ":" not in d]), c["quests"][0])
        ext = [clean(titles.get(d, d)) + f" ({d.split(':')[0]})" for d in first.get("deps", []) if ":" in d]
        out.append(f"| {p} | {clean(c['title'])} (`{ck}`) | {clean(first['title'])} | {', '.join(ext) or '—'} | "
                   f"{', '.join(sorted(gates_by_phase.get(p, []))) or 'ящик и машины Create'} |")
    out += ["", NOTES, "## Квесты по главам", "",
            "Фаза предмета меньше фазы главы — можно сделать раньше (квест стоит там, где предмет нужен по сюжету)."]
    cur = None
    for ch, q, it, p, why, cp in rows:
        if ch["key"] != cur:
            cur = ch["key"]
            out += ["", f"### {clean(ch['title'])}" + (f" — фаза {cp}" if cp is not None else ""), "",
                    "| Квест | Предмет | Фаза предмета | Чем ограничен |", "|---|---|---|---|"]
        ps = "—" if p >= INF else str(p)
        out.append(f"| {clean(q['title'])} | `{it}` | {ps} | {why} |")
    out += ["", RECOUNT]
    (PACK / "docs" / "quests" / "PHASES.md").write_text("\n".join(out) + "\n")
    print("записано docs/quests/PHASES.md")


if __name__ == "__main__":
    main()
