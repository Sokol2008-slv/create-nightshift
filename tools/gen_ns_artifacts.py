#!/usr/bin/env python3
"""Артефакты смены — одна таблица на всё (01.10.2026, Георгий: «урон мобов не режем, делаем нас плотнее»,
«хоть 4 ряда сердец», «чем выше волна — тем выше шанс на крутой дроп», 7 уровней от обычного до божественного).

Из таблицы ARTS/TIERS генерируются:
  - kubejs/startup_scripts/vahta/30_ns_artifacts.js — предметы nightshift:art_*;
  - блок данных NS_ART в kubejs/server_scripts/raids/09_ns_artifacts.js (между «<ДАННЫЕ>» и «</ДАННЫЕ>»);
    логика эффектов и бросков — там же, руками;
  - kubejs/client_scripts/ns_artifacts_tooltips.js — подсказки (уровень, эффекты числами, слот, шанс);
  - названия в kubejs/assets/nightshift/lang/ru_ru.json и en_us.json (цвет по уровню — кодами §);
  - иконки kubejs/assets/nightshift/textures/item/art_*.png (перекраска ванильных + рамка цвета уровня)
    и значок слота textures/slot/relic.png (атлас Curios берёт всё из textures/slot/);
  - слот Curios «Реликвия» (4 шт.): kubejs/data/nightshift/curios/slots/relic.json, entities/relic.json,
    тег предметов kubejs/data/curios/tags/item/relic.json;
  - EMC 0 в config/ProjectE/custom_emc.json (ни купить, ни продать; список — и в tools/emc_lock_create.py);
  - глава квест-бука tools/quests/spec_artifacts.json (справка: эффекты, слот, шансы по волнам, билды).

Запуск: python3 tools/gen_ns_artifacts.py  (Pillow; иконки — из клиентского jar 1.21.1, как tools/gen_wave_items.py;
без jar иконки пропускаются). После — python3 tools/gen_quests.py и quest_lint.py artifacts.
"""
import io
import json
import math
import pathlib
import re
import zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
MC = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar"

SLOT = "relic"
SLOTS = 4
WAVES_MAX = 100

# Уровни: ключ, мн. число, название (м. р., строчными), англ., код цвета (§ в названиях, & в квест-буке), метод Text в KubeJS,
# цвет рамки иконки, с какой волны выпадает
TIERS = [
    dict(key="common", pl="обычные", ru="обычный", en="Common", code="f", text="white", rgb="#dcdcdc", frm=1),
    dict(key="rare", pl="редкие", ru="редкий", en="Rare", code="a", text="green", rgb="#55ff55", frm=1),
    dict(key="superrare", pl="сверхредкие", ru="сверхредкий", en="Super Rare", code="9", text="blue", rgb="#5f7dff", frm=8),
    dict(key="epic", pl="эпические", ru="эпический", en="Epic", code="5", text="darkPurple", rgb="#b43cff", frm=15),
    dict(key="legendary", pl="легендарные", ru="легендарный", en="Legendary", code="6", text="gold", rgb="#ffaa00", frm=27),
    dict(key="mythic", pl="мифические", ru="мифический", en="Mythic", code="c", text="red", rgb="#ff3b3b", frm=43),
    dict(key="divine", pl="божественные", ru="божественный", en="Divine", code="b", text="aqua", rgb="#55ffff", frm=90),
]
RAINBOW = "c6eab9d"  # божественный — имя радугой по буквам

# Шанс артефакта за победу (каждому защитнику свой бросок): 8 % на 1-й → 60 % на 100-й линейно,
# в Бесконечности +1,25 % за волну до 85 %. Первое прохождение — ×1,5 (до 95 %), каждая 10-я в первый раз — наверняка.
CHANCE = dict(**{"from": 0.08}, to=0.60, toWave=WAVES_MAX, infPerWave=0.0125, infMax=0.85, firstMult=1.5, firstMax=0.95, firstSureEvery=10)
# Распределение по уровням (%, сумма 100) на опорных волнах; между ними — линейно. 120 = Бесконечность 20 и дальше.
WEIGHTS = [
    [1, [78, 22, 0, 0, 0, 0, 0]],
    [8, [66, 28, 6, 0, 0, 0, 0]],
    [15, [55, 30, 12, 3, 0, 0, 0]],
    [27, [40, 30, 19, 9, 2, 0, 0]],
    [43, [28, 27, 23, 13, 7, 2, 0]],
    [60, [18, 22, 25, 18, 11, 6, 0]],
    [80, [10, 16, 23, 23, 16, 12, 0]],
    [90, [8, 14, 22, 24, 17, 14, 1]],
    [100, [6, 12, 20, 24, 19, 16, 3]],
    [120, [4, 10, 18, 24, 21, 17, 6]],
]
# Потолки суммы эффектов: срез урона ≤35 % (поверх — энергощит −50 % и броня с «Защитой», непробиваемости не надо)
CAPS = dict(dr=0.35, life=0.20, lifeCap=5, regen=2, thorns=0.5)
COMBAT_TICKS = 100  # «вне боя» — 5 с без полученного урона

# Атрибуты: ключ эффекта → id атрибута, операция (модификатор nightshift:relic_<ключ>)
ATTRS = [
    ("hp", "minecraft:generic.max_health", "ADD_VALUE"),
    ("armor", "minecraft:generic.armor", "ADD_VALUE"),
    ("tough", "minecraft:generic.armor_toughness", "ADD_VALUE"),
    ("kb", "minecraft:generic.knockback_resistance", "ADD_VALUE"),
    ("speed", "minecraft:generic.movement_speed", "ADD_MULTIPLIED_BASE"),
    ("dmg", "minecraft:generic.attack_damage", "ADD_VALUE"),
    ("iframes", "artifacts:generic.invincibility_ticks", "ADD_VALUE"),  # то же, чем работает Крест-ожерелье мода Artifacts
]


def A(key, tier, ru, en, base, pal, fx, about):
    return dict(key=key, id="nightshift:art_" + key, tier=tier, ru=ru, en=en, base=base, pal=pal, fx=fx, about=about)


# Эффекты: hp — здоровье; armor, tough — броня и её прочность; kb — сопротивление отбрасыванию (0–1);
# speed — скорость (доля); dmg — урон в ближнем бою; iframes — тики неуязвимости после удара (+);
# dr — срез входящего урона (доля); life — вампиризм (доля нанесённого), lifeCap — не больше HP за удар;
# regen — HP/с вне боя; thorns — доля урона ближнего боя обратно; shield — {dur, cd} тиков полной неуязвимости
# после удара и перезарядка; wind — второе дыхание {cd, after}: перезарядка и тики неуязвимости после спасения.
# Лучшие 4 по здоровью: 18 + 14 + 12 + 8 = 52 → с пятью «Сердцами ночи» 20 + 10 + 52 = 82 HP (4 ряда сердец).
ARTS = [
    A("patch", 0, "Заплатка вахтовика", "Shift Worker's Patch", "rabbit_hide", ["#2a1d14", "#6b4c33", "#b08a62", "#e0c9a6"],
      dict(hp=4), "Первые лишние сердца — пришить и забыть."),
    A("badge", 0, "Жетон смены", "Shift Token", "name_tag", ["#1d2228", "#4c5866", "#9aa7b4", "#e3eaf0"],
      dict(armor=1, speed=0.05), "Быстрее к алтарю — и от него, если что-то пошло не так."),
    A("thermos", 0, "Термос бригадира", "Foreman's Thermos", "honey_bottle", ["#14261c", "#2f5a3e", "#5f9a6e", "#cfe8c8"],
      dict(regen=0.5), "Лечит между подволнами, если по тебе не попадают."),
    A("buckle", 1, "Стальная пряжка", "Steel Buckle", "chain", ["#1b1f24", "#4a525c", "#8f9aa6", "#dfe6ee"],
      dict(hp=6, kb=0.1), "Первый шаг к «плотному» билду."),
    A("qc_stripe", 1, "Нашивка ОТК", "QC Patch", "globe_banner_pattern", ["#10230f", "#2b5a28", "#5aa84f", "#d6f5c8"],
      dict(dr=0.05), "Срез считается до брони и складывается с «Защитой» и энергощитом."),
    A("watch_charm", 1, "Оберег сторожа", "Watchman's Charm", "rabbit_foot", ["#2a1b12", "#6d4a2f", "#b98d5d", "#f1dcb8"],
      dict(iframes=6, armor=1), "Удар в передышку проходит только разницей с прошлым — толпа бьёт реже."),
    A("fang", 2, "Клык кровососа", "Bloodsucker's Fang", "bone", ["#2a0d10", "#7a1f28", "#d6c7b0", "#fffaf0"],
      dict(life=0.05, lifeCap=2, dmg=1), "Считается весь урон, нанесённый тобой, и стрелы из твоего лука тоже."),
    A("pauldron", 2, "Наплечник из сплава", "Alloy Pauldron", "armadillo_scute", ["#1c050b", "#5e1424", "#94243a", "#85bb65"],
      dict(armor=4, tough=2), "Прочность брони режет именно крупные удары — против боссов."),
    A("collar", 2, "Шипастый ошейник", "Spiked Collar", "lead", ["#141414", "#3f3a36", "#8a8178", "#e8e2da"],
      dict(thorns=0.25, armor=1), "Стрелы и заклинания не отражает — только удары вплотную."),
    A("stone_heart", 3, "Каменное сердце", "Stone Heart", "heart_pottery_sherd", ["#17151a", "#46424d", "#857f8c", "#cfc9d6"],
      dict(hp=8, kb=0.25, speed=-0.05), "Цена — шаг медленнее: против быстрых волн подумай дважды."),
    A("rosary", 3, "Чётки дозорного", "Sentinel's Rosary", "amethyst_shard", ["#1a0b2a", "#4a2178", "#8d5bd1", "#e5d2ff"],
      dict(iframes=12, dr=0.05), "Передышка складывается с Оберегом сторожа и Крест-ожерельем."),
    A("butcher_glove", 3, "Перчатка мясника", "Butcher's Glove", "leather", ["#240a12", "#5c1a2c", "#9c3a52", "#e6a8b6"],
      dict(life=0.10, lifeCap=3, dmg=2), "Лучше с быстрым оружием: лечение — с каждого удара."),
    A("titan_blood", 4, "Кровь титана", "Titan's Blood", "dragon_breath", ["#2a0a05", "#7a1d0e", "#d4471c", "#ffd86b"],
      dict(hp=12, regen=0.5), "Основа танка."),
    A("visor", 4, "Щиток бригадира", "Foreman's Visor", "turtle_helmet", ["#2b1a02", "#7a4f08", "#d99a1c", "#fff0b0"],
      dict(dr=0.12, armor=3, kb=0.2), "Самый большой срез урона среди артефактов."),
    A("second_wind", 4, "Жетон второго дыхания", "Second Wind Token", "totem_of_undying", ["#2b1d02", "#80600c", "#e6c440", "#fffbe0"],
      dict(hp=4, wind=dict(cd=6000, after=40)), "Срабатывает раньше тотема бессмертия — тотем остаётся целым."),
    A("hourglass", 5, "Песочные часы смены", "Shift Hourglass", "clock_00", ["#2a0505", "#7a1010", "#e0402c", "#ffe08a"],
      dict(shield=dict(dur=20, cd=120), armor=2), "Щит включает удар моба или снаряда; огонь и яд его не тратят. Ни урона, ни отбрасывания."),
    A("horde_heart", 5, "Сердце орды", "Horde Heart", "heart_of_the_sea", ["#1f0306", "#661020", "#d02c40", "#ffb3b3"],
      dict(hp=14, life=0.06, lifeCap=3, regen=0.5), "Здоровье, вампиризм и лечение вне боя в одном слоте."),
    A("vakhta_heart", 6, "Сердце Вахты", "Heart of the Watch", "nether_star", ["#04262a", "#0f6f78", "#3fd6d6", "#f0ffff"],
      dict(hp=18, armor=4, dr=0.10, regen=1.0), "Лучший артефакт танка."),
    A("halo", 6, "Нимб бессменного", "Halo of the Unrelieved", None, ["#3a2a05", "#a77b12", "#ffe27a", "#ffffff"],
      dict(shield=dict(dur=20, cd=80), wind=dict(cd=2400, after=60), life=0.10, lifeCap=4), "С Песочными часами не складывается: работает лучший щит — этот."),
]

# Шутки для квест-бука (серым курсивом, через раз)
JOKES = {
    "how": "— Отдел кадров: «Четыре слота — не ограничение, а корпоративная культура. Пятый выдают посмертно».",
    "rare": "— ОТК: «Нашивку получает тот, кто прошёл проверку. Проверка — пережить волну».",
    "epic": "Чётки дозорного перебирают не для молитвы, а чтобы считать секунды до следующего удара.",
    "mythic": "Песочные часы смены: одна секунда бессмертия, потом шесть секунд объяснительной.",
    "odds": "— Бухгалтерия EMC: «Артефакты на баланс не ставим. Их нельзя купить — только выстрадать».",
    "builds": "Идеальный билд — тот, в котором ты дожил до раздачи добычи.",
}


# --------------------------------------------------------------------------
# Числа: те же формулы, что в 09_ns_artifacts.js (nsArtChance, nsArtWeights)
# --------------------------------------------------------------------------
def chance(d, first=False):
    C = CHANCE
    d = max(1, d)
    p = C["from"] + (C["to"] - C["from"]) * (d - 1) / (C["toWave"] - 1) if d <= C["toWave"] else min(C["infMax"], C["to"] + C["infPerWave"] * (d - C["toWave"]))
    if first:
        p = 1.0 if d % C["firstSureEvery"] == 0 else min(C["firstMax"], p * C["firstMult"])
    return p


def weights(d):
    d = max(1, d)
    W = WEIGHTS
    row = list(W[-1][1])
    if d <= W[0][0]:
        row = list(W[0][1])
    else:
        for (a, ra), (b, rb) in zip(W, W[1:]):
            if a <= d <= b:
                f = (d - a) / (b - a)
                row = [x + (y - x) * f for x, y in zip(ra, rb)]
                break
    row = [0 if d < TIERS[t]["frm"] else w for t, w in enumerate(row)]
    s = sum(row)
    return [w * 100 / s for w in row]


def per_item(d, tier):
    """Шанс конкретного артефакта уровня tier за одну победу на волне d (без первого прохождения), доля."""
    n = len([a for a in ARTS if a["tier"] == tier])
    return chance(d) * weights(d)[tier] / 100 / n


def num(x, digits=1):
    s = f"{x:.{digits}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s.replace(".", ",")


def pct(x):
    """Доля → «2,4» (проценты без знака): до 1 % — два знака, дальше один."""
    v = x * 100
    if v == 0:
        return "0"
    if v < 0.1:
        return "<0,1"
    return num(v, 2 if v < 1 else 1)


def wave_label(d):
    return f"∞{d - WAVES_MAX}" if d > WAVES_MAX else f"{d}-й"


# --------------------------------------------------------------------------
# Тексты эффектов
# --------------------------------------------------------------------------
def hearts(hp):
    h = hp / 2
    n = int(h) if h == int(h) else None
    if n is None:
        return num(h) + " сердца"
    word = "сердце" if n % 10 == 1 and n % 100 != 11 else "сердца" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "сердец"
    return f"{n} {word}"


def fx_lines(fx):
    """Эффекты по-русски: [(хорошо?, текст)]"""
    out = []
    if fx.get("hp"):
        out.append((True, f"+{num(fx['hp'])} к здоровью ({hearts(fx['hp'])})"))
    if fx.get("armor"):
        out.append((True, f"+{num(fx['armor'])} брони"))
    if fx.get("tough"):
        out.append((True, f"+{num(fx['tough'])} прочности брони"))
    if fx.get("kb"):
        out.append((True, f"+{round(fx['kb'] * 100)} % сопротивления отбрасыванию"))
    if fx.get("speed"):
        s = fx["speed"]
        out.append((s > 0, f"{'+' if s > 0 else '−'}{round(abs(s) * 100)} % скорости"))
    if fx.get("dmg"):
        out.append((True, f"+{num(fx['dmg'])} урона в ближнем бою"))
    if fx.get("dr"):
        out.append((True, f"−{round(fx['dr'] * 100)} % входящего урона"))
    if fx.get("iframes"):
        out.append((True, f"неуязвимость после удара дольше на {num(fx['iframes'] / 20, 2)} с (как Крест-ожерелье)"))
    if fx.get("life"):
        out.append((True, f"вампиризм {round(fx['life'] * 100)} % нанесённого урона (до {num(fx['lifeCap'])} HP за удар)"))
    if fx.get("regen"):
        out.append((True, f"вне боя +{num(fx['regen'])} HP/с (5 с без урона)"))
    if fx.get("thorns"):
        out.append((True, f"отражает {round(fx['thorns'] * 100)} % урона ближнего боя обратно"))
    if fx.get("shield"):
        sh = fx["shield"]
        out.append((True, f"после удара моба — {num(sh['dur'] / 20)} с полной неуязвимости, перезарядка {num(sh['cd'] / 20)} с"))
    if fx.get("wind"):
        w = fx["wind"]
        out.append((True, f"второе дыхание: смертельный удар оставляет 1 HP и {num(w['after'] / 20)} с неуязвимости, раз в {num(w['cd'] / 1200)} мин"))
    return out


def fx_lines_en(fx):
    out = []
    if fx.get("hp"):
        out.append(f"+{num(fx['hp'])} max health")
    if fx.get("armor"):
        out.append(f"+{num(fx['armor'])} armor")
    if fx.get("tough"):
        out.append(f"+{num(fx['tough'])} armor toughness")
    if fx.get("kb"):
        out.append(f"+{round(fx['kb'] * 100)}% knockback resistance")
    if fx.get("speed"):
        out.append(f"{'+' if fx['speed'] > 0 else '-'}{round(abs(fx['speed']) * 100)}% speed")
    if fx.get("dmg"):
        out.append(f"+{num(fx['dmg'])} melee damage")
    if fx.get("dr"):
        out.append(f"-{round(fx['dr'] * 100)}% incoming damage")
    if fx.get("iframes"):
        out.append(f"+{num(fx['iframes'] / 20, 2)} s invulnerability after a hit")
    if fx.get("life"):
        out.append(f"lifesteal {round(fx['life'] * 100)}% (max {num(fx['lifeCap'])} HP per hit)")
    if fx.get("regen"):
        out.append(f"+{num(fx['regen'])} HP/s out of combat")
    if fx.get("thorns"):
        out.append(f"reflects {round(fx['thorns'] * 100)}% melee damage")
    if fx.get("shield"):
        out.append(f"{num(fx['shield']['dur'] / 20)} s full invulnerability after a hit, cooldown {num(fx['shield']['cd'] / 20)} s")
    if fx.get("wind"):
        out.append(f"second wind: a lethal hit leaves 1 HP, every {num(fx['wind']['cd'] / 1200)} min")
    return out


def item_name(a, en=False):
    name = a["en"] if en else a["ru"]
    if a["tier"] == 6:
        return "".join(("§" + RAINBOW[i % len(RAINBOW)] + ch) if ch != " " else ch for i, ch in enumerate(name))
    return "§" + TIERS[a["tier"]]["code"] + name


def drop_line(t):
    """«с волны 43: ≈0,3 % на 43-й, ≈2 % на 70-й, ≈4,8 % на 100-й» — шанс одного артефакта уровня за набег."""
    frm = TIERS[t]["frm"]
    waves = [frm] + [w for w in (15, 50, 100) if w > frm]
    parts = [f"≈{pct(per_item(w, t))} % на {wave_label(w)}" for w in waves]
    if t >= 5:
        parts.append(f"≈{pct(per_item(120, t))} % в Бесконечности (∞20)")
    return f"с волны {frm}: " + ", ".join(parts)


# --------------------------------------------------------------------------
# Файлы
# --------------------------------------------------------------------------
def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    print("  ", path.relative_to(PACK))


def gen_startup():
    lines = [
        "// ==========================================================================",
        "// Артефакты смены — предметы (СГЕНЕРИРОВАНО tools/gen_ns_artifacts.py — правки в таблице генератора).",
        "// Надеваются в слот Curios «Реликвия» (тег curios:relic), эффекты — server_scripts/raids/09_ns_artifacts.js,",
        "// подсказки — client_scripts/ns_artifacts_tooltips.js. Цвет имени по уровню — кодами § в lang.",
        "// По одному create на предмет — tools/gen_quests.py находит id по тексту event.create('…'). Правило Rhino: только var.",
        "// ==========================================================================",
        "StartupEvents.registry('item', function (event) {",
    ]
    for t, T in enumerate(TIERS):
        lines.append(f"\t// {T['ru']}")
        for a in [x for x in ARTS if x["tier"] == t]:
            glow = ".glow(true)" if t >= 5 else ""
            lines.append(f"\tevent.create('{a['id']}').texture('nightshift:item/art_{a['key']}').maxStackSize(1).fireResistant().tag('curios:{SLOT}'){glow}")
    lines.append("})")
    write(PACK / "kubejs/startup_scripts/vahta/30_ns_artifacts.js", "\n".join(lines) + "\n")


def gen_data_block():
    items = {}
    for a in ARTS:
        e = dict(tier=a["tier"], name=a["ru"])
        e.update(a["fx"])
        items[a["id"]] = e
    data = dict(
        slot=SLOT,
        slots=SLOTS,
        tiers=[dict(key=T["key"], name=T["ru"], **{"from": T["frm"]}) for T in TIERS],
        items=items,
        byTier=[[a["id"] for a in ARTS if a["tier"] == t] for t in range(len(TIERS))],
        chance=CHANCE,
        weights=WEIGHTS,
        caps=CAPS,
        combatTicks=COMBAT_TICKS,
        attrs=[list(x) for x in ATTRS],
    )
    # компактно: ключ верхнего уровня — строка, артефакт — строка
    one = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    rows = []
    for k, v in data.items():
        if k == "items":
            rows.append('\t"items": {\n' + ",\n".join(f"\t\t{one(i)}: {one(e)}" for i, e in v.items()) + "\n\t}")
        elif k == "weights":
            rows.append('\t"weights": [\n' + ",\n".join("\t\t" + one(r) for r in v) + "\n\t]")
        else:
            rows.append(f"\t{one(k)}: {one(v)}")
    body = "var NS_ART = {\n" + ",\n".join(rows) + "\n}"
    f = PACK / "kubejs/server_scripts/raids/09_ns_artifacts.js"
    src = f.read_text()
    new = re.sub(r"(// <ДАННЫЕ>[^\n]*\n).*?(\n// </ДАННЫЕ>)", lambda m: m.group(1) + body + m.group(2), src, count=1, flags=re.S)
    if new == src and body not in src:
        raise SystemExit("в 09_ns_artifacts.js не найден блок <ДАННЫЕ>")
    f.write_text(new)
    print("  ", f.relative_to(PACK), "(блок данных)")


def js_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def gen_tooltips():
    lines = [
        "// Подсказки артефактов смены (СГЕНЕРИРОВАНО tools/gen_ns_artifacts.py — правки в таблице генератора).",
        "// Эффекты — server_scripts/raids/09_ns_artifacts.js. Шанс — одного этого артефакта за победу (без первого прохождения).",
        "ItemEvents.modifyTooltips(event => {",
    ]
    for a in ARTS:
        T = TIERS[a["tier"]]
        rows = [f"Text.{T['text']}({js_str(T['ru'].capitalize() + ' артефакт смены')})"]
        for good, txt in fx_lines(a["fx"]):
            rows.append(f"Text.{'green' if good else 'red'}({js_str(txt[0].upper() + txt[1:])})")
        rows.append(f"Text.gray({js_str(f'Слот «Реликвия» ({SLOTS} шт.) — кнопка Curios в инвентаре. Второй такой же не наденется.')})")
        rows.append(f"Text.darkGray({js_str('Выпадает в набегах ' + drop_line(a['tier']) + ' за победу')})")
        lines.append(f"\tevent.add('{a['id']}', [")
        lines.append(",\n".join("\t\t" + r for r in rows))
        lines.append("\t])")
    lines.append("})")
    write(PACK / "kubejs/client_scripts/ns_artifacts_tooltips.js", "\n".join(lines) + "\n")


def gen_lang():
    for loc, en in (("ru_ru", False), ("en_us", True)):
        f = PACK / "kubejs/assets/nightshift/lang" / f"{loc}.json"
        data = json.loads(f.read_text())
        for a in ARTS:
            data["item.nightshift.art_" + a["key"]] = item_name(a, en)
        data["curios.identifier." + SLOT] = "Relic" if en else "Реликвия"
        data["curios.modifiers." + SLOT] = "When worn as relic:" if en else "Когда надето как реликвия:"
        f.write_text(json.dumps(data, ensure_ascii=False, indent="\t") + "\n")
        print("  ", f.relative_to(PACK))


def gen_curios():
    write(PACK / f"kubejs/data/nightshift/curios/slots/{SLOT}.json",
          json.dumps({"size": SLOTS, "order": 5, "icon": f"nightshift:slot/{SLOT}", "add_cosmetic": False, "validators": ["curios:tag"]}, indent=2) + "\n")
    write(PACK / f"kubejs/data/nightshift/curios/entities/{SLOT}.json",
          json.dumps({"entities": ["minecraft:player"], "slots": [SLOT]}, indent=2) + "\n")
    write(PACK / f"kubejs/data/curios/tags/item/{SLOT}.json",
          json.dumps({"replace": False, "values": [a["id"] for a in ARTS]}, indent=2) + "\n")


def gen_emc():
    f = PACK / "config/ProjectE/custom_emc.json"
    data = json.loads(f.read_text())
    have = {e.get("id") for e in data["entries"]}
    added = 0
    for a in ARTS:
        if a["id"] not in have:
            data["entries"].append({"id": a["id"], "emc": 0})
            added += 1
    if added:
        f.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print("  ", f.relative_to(PACK), f"(+{added} записей EMC 0)")
    lock = (PACK / "tools/emc_lock_create.py").read_text()
    missing = [a["id"] for a in ARTS if "'" + a["id"] + "'" not in lock]
    if missing:
        print("   ВНИМАНИЕ: в tools/emc_lock_create.py (MANUAL_ZERO) нет:", ", ".join(missing))


# --------------------------------------------------------------------------
# Иконки
# --------------------------------------------------------------------------
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


def recolor(img, pal):
    stops = [hexrgb(c) for c in pal]
    px = [(x, y) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        out.putpixel(p, ramp(stops, (l - lo) / (hi - lo or 1)) + (img.getpixel(p)[3],))
    return out


def hue(h):
    import colorsys
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h % 1.0, 0.75, 1.0))


def frame(img, tier):
    """Рамка цвета уровня: прозрачные пиксели рядом с рисунком (по 4 соседям); божественный — радуга по кругу."""
    from PIL import Image  # noqa: F401
    w, h = img.size
    out = img.copy()
    col = hexrgb(TIERS[tier]["rgb"])
    for y in range(h):
        for x in range(w):
            if img.getpixel((x, y))[3] > 0:
                continue
            near = any(0 <= x + dx < w and 0 <= y + dy < h and img.getpixel((x + dx, y + dy))[3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if not near:
                continue
            c = hue(math.atan2(y - 7.5, x - 7.5) / (2 * math.pi)) if tier == 6 else col
            out.putpixel((x, y), c + (200 if tier >= 1 else 150,))
    return out


def halo_base():
    """Нимб — своё кольцо 16×16 (ванильного нет): эллипс с бликом."""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((1, 4, 14, 11), outline=(150, 150, 150, 255), width=2)
    d.arc((2, 5, 13, 10), 200, 340, fill=(255, 255, 255, 255), width=1)
    d.point([(4, 6), (11, 6)], fill=(230, 230, 230, 255))
    d.line((3, 9, 12, 9), fill=(90, 90, 90, 255))
    return im


def slot_icon():
    """Значок пустого слота «Реликвия» в стиле Curios: контур самоцвета цветом (85, 85, 85)."""
    from PIL import Image
    rows = [
        "................",
        "................",
        "....########....",
        "...#..#..#..#...",
        "..#..#....#..#..",
        "..############..",
        "...#..#..#..#...",
        "....#..#.#.#....",
        ".....#.#..#.....",
        "......#.##......",
        ".......##.......",
        "................",
        "................",
        "................",
        "................",
        "................",
    ]
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == "#":
                im.putpixel((x, y + 2), (85, 85, 85, 255))
    return im


def gen_icons():
    try:
        from PIL import Image
    except ImportError:
        print("   нет Pillow — иконки пропущены")
        return
    if not MC.is_file():
        print("   нет клиентского jar 1.21.1 — иконки пропущены:", MC)
        return
    out = PACK / "kubejs/assets/nightshift/textures/item"
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(MC) as z:
        for a in ARTS:
            base = halo_base() if a["base"] is None else Image.open(io.BytesIO(z.read("assets/minecraft/textures/item/" + a["base"] + ".png"))).convert("RGBA")
            frame(recolor(base, a["pal"]), a["tier"]).save(out / f"art_{a['key']}.png")
    slot = PACK / f"kubejs/assets/nightshift/textures/slot/{SLOT}.png"
    slot.parent.mkdir(parents=True, exist_ok=True)
    slot_icon().save(slot)
    print("  ", out.relative_to(PACK) / "art_*.png", f"({len(ARTS)} шт.) и", slot.relative_to(PACK))


# --------------------------------------------------------------------------
# Квест-бук
# --------------------------------------------------------------------------
def amp(t):
    return "&" + TIERS[t]["code"]


def gen_quests():
    by_tier = [[a for a in ARTS if a["tier"] == t] for t in range(len(TIERS))]
    icons = ["patch", "qc_stripe", "fang", "rosary", "second_wind", "hourglass", "vakhta_heart"]
    best_hp = sorted((a["fx"].get("hp", 0) for a in ARTS), reverse=True)[:SLOTS]
    max_dr = sorted((a["fx"].get("dr", 0) for a in ARTS), reverse=True)[:SLOTS]
    quests = []
    how = [
        f"Артефакты смены делают &aтебя плотнее&r: мобов не ослабляем — переживаешь поздние волны за счёт своего билда.",
        f"Надеваются в слоты &eРеликвия&r — их {SLOTS}: инвентарь → кнопка Curios (значок у куклы игрока). {SLOTS} слота — {SLOTS} решения: больше здоровья, меньше урона, вампиризм или бессмертие на секунду — выбирай.",
        "&cОдинаковые не складываются&r: второй такой же в слот не встанет. Разные — суммируются; неуязвимость после удара и второе дыхание — работает лучший из надетых.",
        "{@pagebreak}",
        f"Потолки суммы: срез урона ≤{round(CAPS['dr'] * 100)} %, вампиризм ≤{round(CAPS['life'] * 100)} % (до {CAPS['lifeCap']} HP за удар), лечение вне боя ≤{CAPS['regen']} HP/с, отражение ≤{round(CAPS['thorns'] * 100)} %.",
        f"Здоровье: 20 + &d5 Сердец ночи&r (+10) + 4 лучших по здоровью (+{sum(best_hp)}) = &a{30 + sum(best_hp)} HP&r — четыре ряда сердец. Лучшие 4 по срезу урона — −{round(sum(max_dr) * 100)} %.",
        "Артефакты мода Artifacts (крест-ожерелье, кристальное сердце…) носятся в своих слотах и складываются с этими.",
        "{@pagebreak}",
        "Где взять: &6только набеги&r. За победу каждому защитнику — свой бросок; чем выше волна, тем выше шанс и уровень. Первое прохождение — шанс ×1,5, каждая 10-я волна в первый раз — артефакт наверняка.",
        "Ни купить, ни продать: EMC у них нет. После смерти и смены надетого эффекты включаются за секунду; /nsart — что даёт твой билд.",
        "&7&o" + JOKES["how"] + "&r",
    ]
    quests.append(dict(key="how", type="checkmark", item="nightshift:art_badge", title="Как это работает: слоты, билды, шансы",
                       desc=how, deps=[], shape="diamond", size=1.3, pos=[0.0, 0.0]))
    # таблица шансов по волнам
    odds = ["Шанс артефакта смены за победу и уровень, если выпал. Строки — для обычного прохождения.", ""]
    for d in (1, 15, 30, 50, 70, 100, 110, 120):
        w = weights(d)
        tiers = " · ".join(f"{amp(t)}{TIERS[t]['ru']} {num(w[t], 0) if w[t] >= 1 else '<1'}&r" for t in range(len(TIERS)) if w[t] > 0)
        label = f"Волна {d}" if d <= WAVES_MAX else f"Бесконечность {d - WAVES_MAX}"
        odds.append(f"&e{label}&r — артефакт {pct(chance(d))} %: {tiers}")
        if d == 50:
            odds.append("{@pagebreak}")
    odds += ["", f"Первое прохождение: шанс ×1,5 (до 95 %), каждая 10-я волна — наверняка. Божественные — только с 90-й и очень редко.",
             "&7&o" + JOKES["odds"] + "&r"]
    quests.append(dict(key="odds", type="checkmark", item="minecraft:clock", title="Шансы по волнам", desc=odds, deps=["how"],
                       optional=True, shape="circle", pos=[0.0, 2.2]))
    n = lambda k: next(a for a in ARTS if a["key"] == k)

    def build(title, keys, note):
        names = " + ".join(f"{amp(n(k)['tier'])}{n(k)['ru']}&r" for k in keys)
        return f"&e{title}&r: {names}. {note}"

    builds = [
        "Готовые сборки на 4 слота — от чего отталкиваться. Меняй под волну: против стрел и магии — срез урона, против толпы в ближнем — щит и отражение.",
        build("Танк", ["vakhta_heart", "horde_heart", "titan_blood", "stone_heart"], f"+52 HP → {30 + 52} HP с пятью Сердцами ночи, лечение вне боя 2 HP/с."),
        build("Без божественного", ["horde_heart", "titan_blood", "stone_heart", "buckle"], "+40 HP → 70 HP: реально к 60–70-й волне."),
        "{@pagebreak}",
        build("Стена", ["visor", "vakhta_heart", "rosary", "qc_stripe"], "−32 % урона до брони плюс дольше неуязвимость после удара."),
        build("Бессмертный", ["hourglass", "second_wind", "rosary", "watch_charm"], "Щит 1 с раз в 6 с, второе дыхание раз в 5 мин, передышка после удара +0,9 с. Нимб бессменного заменяет сразу часы и жетон — щит и дыхание не складываются, работает лучший."),
        build("Вампир", ["butcher_glove", "horde_heart", "fang", "halo"], "Вампиризм 20 % (потолок), до 5 HP за удар — лечишься, пока бьёшь."),
        "&7&o" + JOKES["builds"] + "&r",
    ]
    quests.append(dict(key="builds", type="checkmark", item="minecraft:armor_stand", title="Билды", desc=builds, deps=["how"],
                       optional=True, shape="circle", pos=[0.0, -2.2]))
    prev = "how"
    intro = {
        0: "первые лишние сердца, броня и лечение между подволнами.",
        1: "ощутимо: срез урона, длиннее передышка после удара.",
        2: "вампиризм, тяжёлая броня, отражение в ближнем бою.",
        3: "крупные бонусы с ценой: каменное сердце замедляет.",
        4: "основа позднего билда: много здоровья, большой срез урона, второе дыхание.",
        5: "то, ради чего гриндят 50+: секунда полной неуязвимости после удара и сердце орды.",
        6: "только с 90-й волны и очень редко, в основном в Бесконечности.",
    }
    for t, T in enumerate(TIERS):
        arts = by_tier[t]
        desc = [f"{amp(t)}{T['pl'].capitalize()}&r ({len(arts)}) — {intro[t]}", ""]
        for a in arts:
            fx = "; ".join(txt for _, txt in fx_lines(a["fx"]))
            desc.append(f"{amp(t)}{a['ru']}&r — {fx}. {a['about']}")
        desc += ["{@pagebreak}",
                 f"Слот: &eРеликвия&r. Выпадает каждый из {len(arts)} — {drop_line(t)} за победу (без первого прохождения)."]
        jk = JOKES.get(T["key"])
        if jk:
            desc.append("&7&o" + jk + "&r")
        key = "tier_" + T["key"]
        quests.append(dict(key=key, type="checkmark", item="nightshift:art_" + icons[t], title=f"{amp(t)}{T['pl'].capitalize()}&r артефакты",
                           desc=desc, deps=[prev], optional=True, shape="circle", pos=[round(2.2 * (t + 1), 2), 0.0]))
        prev = key
    spec = {"chapters": [{"key": "artifacts", "title": "Артефакты смены", "icon": "nightshift:art_hourglass",
                          "subtitle": "7 уровней, 4 слота «Реликвия», шансы по волнам", "quests": quests}]}
    write(PACK / "tools/quests/spec_artifacts.json", json.dumps(spec, ensure_ascii=False, indent=1) + "\n")


def report():
    print("\nШанс за победу и уровни:")
    for d in (1, 8, 15, 27, 30, 43, 50, 70, 90, 100, 110, 120):
        w = weights(d)
        print(f"  волна {d:>3}: {pct(chance(d)):>5} %  " + "  ".join(f"{TIERS[t]['key'][:4]} {w[t]:4.1f}" for t in range(7)))
    hp = sorted((a["fx"].get("hp", 0) for a in ARTS), reverse=True)[:SLOTS]
    print(f"  лучшие {SLOTS} по здоровью: +{sum(hp)} → {30 + sum(hp)} HP с пятью Сердцами ночи")


def main():
    print("Артефакты смены:")
    gen_startup()
    gen_data_block()
    gen_tooltips()
    gen_lang()
    gen_curios()
    gen_emc()
    gen_icons()
    gen_quests()
    report()


if __name__ == "__main__":
    main()
