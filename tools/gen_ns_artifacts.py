#!/usr/bin/env python3
"""Артефакты смены — одна таблица на всё (01.10.2026, Георгий: «урон мобов не режем, делаем нас плотнее»,
«хоть 4 ряда сердец», «чем выше волна — тем выше шанс на крутой дроп», 7 уровней от обычного до божественного;
ночью 02.10: «если есть идеи для артов и редкого дропа — действуй, креативь на полную»).

Три источника артефактов (поле pool):
  - wave  — обычные: бросок за любую победу, шанс и уровень растут с волной (19 шт.);
  - theme — артефакты арены: только за победу на АРЕНЕ в её теме (Шахта, Каньон пауков, Вечная мерзлота, Пекло,
            Край, Кошмар, Звёздная бездна) — «ходим на Мерзлоту за сердцем метели»;
  - boss  — трофеи боссов ArPhEx и Cataclysm: за победу на волне, где этот босс был.
Переплавка: 3 обычных артефакта одного уровня → 1 случайный следующего (до мифического); трофеи и артефакты
арены не переплавляются, божественные — только из волн.

Из таблиц генерируются:
  - kubejs/startup_scripts/vahta/30_ns_artifacts.js — предметы nightshift:art_*;
  - блок данных NS_ART в kubejs/server_scripts/raids/09_ns_artifacts.js (между «<ДАННЫЕ>» и «</ДАННЫЕ>»);
    логика эффектов, бросков и переплавки — там же, руками;
  - kubejs/client_scripts/ns_artifacts_tooltips.js — подсказки (уровень, эффекты числами, слот, где выпадает);
  - названия в kubejs/assets/nightshift/lang/ru_ru.json и en_us.json (цвет по уровню — кодами §);
  - иконки kubejs/assets/nightshift/textures/item/art_*.png (перекраска ванильных + рамка цвета уровня)
    и значок слота textures/slot/relic.png (атлас Curios берёт всё из textures/slot/);
  - слот Curios «Реликвия» (4 шт.): kubejs/data/nightshift/curios/slots/relic.json, entities/relic.json,
    тег предметов kubejs/data/curios/tags/item/relic.json;
  - EMC 0 в config/ProjectE/custom_emc.json (tools/emc_lock_create.py берёт id из стартового скрипта);
  - глава квест-бука tools/quests/spec_artifacts.json (справка: эффекты, шансы, арена, трофеи, переплавка, билды).

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

# Уровни: ключ, род. падеж мн. ч. (для «3 обычных → 1 редкий»), мн. число, название (м. р., строчными), англ., код цвета (§ в названиях, & в квест-буке), метод Text в KubeJS,
# цвет рамки иконки, с какой волны выпадает из обычных бросков
TIERS = [
    dict(key="common", gen="обычных", pl="обычные", ru="обычный", en="Common", code="f", text="white", rgb="#dcdcdc", frm=1),
    dict(key="rare", gen="редких", pl="редкие", ru="редкий", en="Rare", code="a", text="green", rgb="#55ff55", frm=1),
    dict(key="superrare", gen="сверхредких", pl="сверхредкие", ru="сверхредкий", en="Super Rare", code="9", text="blue", rgb="#5f7dff", frm=8),
    dict(key="epic", gen="эпических", pl="эпические", ru="эпический", en="Epic", code="5", text="darkPurple", rgb="#b43cff", frm=15),
    dict(key="legendary", gen="легендарных", pl="легендарные", ru="легендарный", en="Legendary", code="6", text="gold", rgb="#ffaa00", frm=27),
    dict(key="mythic", gen="мифических", pl="мифические", ru="мифический", en="Mythic", code="c", text="red", rgb="#ff3b3b", frm=43),
    dict(key="divine", gen="божественных", pl="божественные", ru="божественный", en="Divine", code="b", text="aqua", rgb="#55ffff", frm=90),
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
CAPS = dict(dr=0.35, life=0.20, lifeCap=5, regen=2, thorns=0.5, dodge=0.25, killHeal=8, hp=60)  # hp — здоровье от артефактов
COMBAT_TICKS = 100  # «вне боя» — 5 с без полученного урона

# Темы арены (ключи и волны — как NSG.nsArenaThemeFor в 70_nightshift_arena.js). chance — шанс артефакта арены
# каждому защитнику за победу на арене в этой теме; первое прохождение волны — ×2.
THEMES = [
    dict(key="shaft", ru="Шахта", waves="1–15", chance=0.12),
    dict(key="canyon", ru="Каньон пауков", waves="16–29", chance=0.12),
    dict(key="frost", ru="Вечная мерзлота", waves="30–44", chance=0.12),
    dict(key="inferno", ru="Пекло", waves="45–59", chance=0.12),
    dict(key="ender", ru="Край", waves="60–69", chance=0.12),
    dict(key="nightmare", ru="Кошмар", waves="70–99", chance=0.12),
    dict(key="abyss", ru="Звёздная бездна", waves="100+ и Бесконечность", chance=0.04),
]
THEME_FIRST_MULT = 2
THEME_TIER_WEIGHT = {3: 6, 4: 3, 5: 1, 6: 1}  # внутри темы: эпический чаще, мифический реже

# Боссы: id → (имя, когда приходит). ArPhEx — NSG.NS_MOD_BOSSES (08_modded_waves.js), Cataclysm — NS_CATACLYSM_BOSSES.
BOSSES = {
    "arphex:spider_goliath": ("Голиаф", "волна 15"),
    "arphex:spider_matriarch": ("Паучиха-матриарх", "волны 20 и 55"),
    "arphex:termite_tunneler_king": ("Термитный король", "волна 25"),
    "arphex:arthropleura_abomination": ("Артроплевра-мерзость", "волны 30 и 55"),
    "arphex:scorpioid_bloodluster": ("Скорпиоид-кровопийца", "волны 35 и 60"),
    "arphex:draconic_voidlasher": ("Пустотный драконохвост", "волны 40 и 65"),
    "arphex:arachnoid_trisector": ("Арахноид-трисектор", "волны 45 и 60"),
    "arphex:diabolos_decimator": ("Диаболос-истребитель", "волны 50 и 65"),
    "cataclysm:amethyst_crab": ("Аметистовый краб", "волны 70–84"),
    "cataclysm:clawdian": ("Клаудиан", "волны 78–92"),
    "cataclysm:kobolediator": ("Кобольдиатор", "волны 70–84"),
    "cataclysm:aptrgangr": ("Аптргангр", "волны 75–89"),
    "cataclysm:wadjet": ("Уаджет", "волны 72–86, 90"),
    "cataclysm:ender_golem": ("Голем Края", "волны 76–90"),
    "cataclysm:the_prowler": ("Рыскун", "волны 74–88"),
    "cataclysm:ender_guardian": ("Страж Края", "с 80-й"),
    "cataclysm:ignis": ("Игнис", "с 82-й"),
    "cataclysm:maledictus": ("Маледиктус", "с 85-й"),
    "cataclysm:the_harbinger": ("Предвестник", "с 87-й"),
    "cataclysm:ancient_remnant": ("Древний реликт", "с 90-й"),
    "cataclysm:netherite_monstrosity": ("Незеритовое чудовище", "с 92-й"),
    "cataclysm:scylla": ("Сцилла", "с 95-й"),
}
TROPHY_CHANCE = {4: 0.15, 5: 0.10}  # каждому защитнику за победу на волне с боссом; первое прохождение — наверняка одному

# Переплавка: n одного уровня → 1 следующего; результат не выше maxTier (мифический)
REFORGE = dict(n=3, maxTier=5)

# Атрибуты: ключ эффекта → id атрибута, операция (модификатор nightshift:relic_<ключ>)
ATTRS = [
    ("hp", "minecraft:generic.max_health", "ADD_VALUE"),
    ("armor", "minecraft:generic.armor", "ADD_VALUE"),
    ("tough", "minecraft:generic.armor_toughness", "ADD_VALUE"),
    ("kb", "minecraft:generic.knockback_resistance", "ADD_VALUE"),
    ("speed", "minecraft:generic.movement_speed", "ADD_MULTIPLIED_BASE"),
    ("dmg", "minecraft:generic.attack_damage", "ADD_VALUE"),
    ("aspd", "minecraft:generic.attack_speed", "ADD_MULTIPLIED_BASE"),
    ("mine", "minecraft:player.block_break_speed", "ADD_MULTIPLIED_BASE"),
    ("iframes", "artifacts:generic.invincibility_ticks", "ADD_VALUE"),  # то же, чем работает Крест-ожерелье мода Artifacts
]

# Эффекты зелий — по-русски (ArPhEx: свои «паутина», «некроз», «паралич»… — проверено по lang мода 5.0.2)
EFF = {
    "minecraft:poison": "яд", "minecraft:slowness": "замедление", "minecraft:wither": "иссушение", "minecraft:weakness": "слабость",
    "minecraft:mining_fatigue": "усталость", "minecraft:darkness": "Тьма", "minecraft:blindness": "слепота",
    "minecraft:fire_resistance": "огнестойкость", "minecraft:night_vision": "ночное зрение",
    "minecraft:water_breathing": "подводное дыхание", "minecraft:strength": "сила", "minecraft:speed": "скорость",
    "arphex:webbed": "паутина пауков", "arphex:necrosis": "некроз", "arphex:constricted": "хватка краба",
    "arphex:paralysis": "паралич", "arphex:moth_curse": "ужас моли", "arphex:splintered_sanity": "расколотый рассудок",
    "arphex:supergravity": "сверхтяжесть", "arphex:chaos_controlled": "контроль хаоса",
    "arphex:voidlasher_chaos_control": "хаос драконохвоста",
}
DMG = {"fall": "падение", "freeze": "мороз и рыхлый снег"}
ROMAN = ["I", "II", "III", "IV", "V"]


def A(key, tier, ru, en, base, pal, fx, about, pool="wave", theme=None, bosses=None):
    return dict(key=key, id="nightshift:art_" + key, tier=tier, ru=ru, en=en, base=base, pal=pal, fx=fx, about=about,
                pool=pool, theme=theme, bosses=bosses or [])


# Эффекты: hp — здоровье; armor, tough — броня и её прочность; kb — сопротивление отбрасыванию (0–1);
# speed — скорость (доля); dmg — урон в ближнем бою; aspd — скорость атаки (доля); mine — скорость копания (доля);
# iframes — тики неуязвимости после удара (+); dr — срез входящего урона (доля); life — вампиризм (доля нанесённого),
# lifeCap — не больше HP за удар; regen — HP/с вне боя; thorns — доля урона ближнего боя обратно;
# shield — {dur, cd} тиков полной неуязвимости после удара моба и перезарядка; wind — второе дыхание {cd, after, tp}:
# перезарядка, тики неуязвимости после спасения, телепорт в сторону; buffs — [[эффект, уровень]] постоянно;
# immune — эффекты, которые не накладываются; noDmg — типы урона, которых нет; hitFx / hurtFx — [[эффект, уровень, тики]]
# на моба, которого бьёшь / который бьёт тебя вплотную; hitFire / hurtFire — поджог на секунды; killHeal, killFx —
# за убийство; aura — {r, dmg, fire} огненная аура; dodge — шанс уклониться от удара моба; featherfall — медленное
# падение с Shift; sanity — во тьме рассудок не падает (Sanity: Renewed), урона тьмы нет.
ARTS = [
    # ---------------- обычные (волны) ----------------
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
      dict(dr=0.12, armor=3, kb=0.2), "Самый большой срез урона среди артефактов волн."),
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

    # ---------------- артефакты арены (только победа на арене в своей теме) ----------------
    A("shaft_helmet", 3, "Каска проходчика", "Tunneler's Hard Hat", "iron_helmet", ["#2a2205", "#7a6510", "#e0c030", "#fff7c0"],
      dict(armor=3, mine=0.3, immune=["minecraft:mining_fatigue"]), "Копать и строить оборону между волнами — быстрее.",
      pool="theme", theme="shaft"),
    A("shaft_mace", 3, "Шахтёрский обушок", "Miner's Mace", "mace", ["#1d1a17", "#4f4740", "#9a8f84", "#e6ddd2"],
      dict(dmg=2, aspd=0.10), "Тяжёлый, но послушный в руке.", pool="theme", theme="shaft"),
    A("canyon_silk", 3, "Паучий шёлк", "Spider Silk", "string", ["#2a2a33", "#6e6e80", "#c8c8d8", "#ffffff"],
      dict(speed=0.10, immune=["arphex:webbed", "minecraft:slowness", "minecraft:poison"]), "Паутина пауков ArPhEx больше не держит.",
      pool="theme", theme="canyon"),
    A("canyon_gland", 4, "Ядовитая железа", "Venom Gland", "fermented_spider_eye", ["#0e1f08", "#2f5a12", "#7fc23a", "#e8ffb0"],
      dict(dmg=2, hitFx=[["minecraft:wither", 0, 80]]), "Иссушение берёт и пауков, которым яд нипочём.", pool="theme", theme="canyon"),
    A("frost_shard", 3, "Осколок вечной мерзлоты", "Permafrost Shard", "prismarine_shard", ["#0a1a2a", "#2a5a8a", "#8fd0ff", "#f0fbff"],
      dict(armor=2, hurtFx=[["minecraft:slowness", 2, 60]]), "Сильнее всего против тех, кто бьёт часто: богомолов и скорпионов.", pool="theme", theme="frost"),
    A("frost_heart", 4, "Сердце метели", "Blizzard Heart", "snowball", ["#0c1c2c", "#3a7ab0", "#bfe8ff", "#ffffff"],
      dict(hp=10, noDmg=["freeze"], immune=["minecraft:slowness"]), "Мороз не берёт, а холодное сердце бьётся ровно.",
      pool="theme", theme="frost"),
    A("inferno_ash", 4, "Пепельное сердце", "Ash Heart", "fire_charge", ["#120a08", "#3d2620", "#8a5a40", "#ffb070"],
      dict(hp=6, buffs=[["minecraft:fire_resistance", 0]], hurtFire=5), "В Пекле — спасение: лава и огонь больше не страшны.",
      pool="theme", theme="inferno"),
    A("inferno_crown", 5, "Корона пекла", "Crown of the Inferno", "golden_helmet", ["#2a0800", "#8a1f00", "#ff6a10", "#ffe080"],
      dict(dmg=3, hitFire=4, buffs=[["minecraft:fire_resistance", 0]]), "Огнестойких не берёт: визер-скелеты и пылающие и так горят.", pool="theme", theme="inferno"),
    A("ender_feather", 4, "Перо Края", "Ender Feather", "feather", ["#140a1f", "#3d1f5c", "#9a5ad0", "#f0d8ff"],
      dict(speed=0.10, noDmg=["fall"], featherfall=True), "С крыши арены — вниз без последствий.",
      pool="theme", theme="ender"),
    A("ender_void", 5, "Осколок пустоты", "Void Shard", "echo_shard", ["#05030a", "#1f1033", "#5a2a99", "#c9a0ff"],
      dict(hp=8, dodge=0.15), "Примерно каждый седьмой удар моба уходит в пустоту.", pool="theme", theme="ender"),
    A("nightmare_lantern", 5, "Фонарь кошмара", "Nightmare Lantern", "soul_lantern", ["#04121a", "#0f3a4a", "#3fb0c8", "#d0fbff"],
      dict(hp=8, buffs=[["minecraft:night_vision", 0]], sanity=True,
           immune=["minecraft:darkness", "minecraft:blindness", "arphex:moth_curse", "arphex:splintered_sanity"]),
      "Тьма больше не съедает рассудок.", pool="theme", theme="nightmare"),
    A("nightmare_claw", 4, "Коготь кошмара", "Nightmare Claw", "phantom_membrane", ["#14040a", "#4a0f22", "#a02848", "#ffb0c8"],
      dict(dmg=4, life=0.06, lifeCap=3), "Бьёт глубоко и пьёт понемногу.", pool="theme", theme="nightmare"),
    A("abyss_star", 6, "Осколок звезды", "Star Shard", "end_crystal", ["#05051a", "#2a2a7a", "#8a8aff", "#ffffff"],
      dict(hp=12, dr=0.08, speed=0.10, shield=dict(dur=20, cd=100)), "Из Звёздной бездны — только с сотой и дальше.",
      pool="theme", theme="abyss"),

    # ---------------- трофеи боссов ----------------
    A("tr_matriarch", 4, "Хитин матриарх", "Matriarch Chitin", "turtle_scute", ["#0a0a0a", "#2a2018", "#6a5038", "#c8a878"],
      dict(armor=4, tough=2, immune=["minecraft:poison", "arphex:necrosis"]), "Пауки-отшельники и заразители больше не страшны.",
      pool="boss", bosses=["arphex:spider_goliath", "arphex:spider_matriarch"]),
    A("tr_termite", 4, "Панцирь подземного короля", "Underking's Carapace", "shulker_shell", ["#1a1008", "#5a3a18", "#a87838", "#f0d098"],
      dict(hp=10, armor=2, kb=0.3, mine=0.25), "Толстый панцирь и привычка рыть.",
      pool="boss", bosses=["arphex:termite_tunneler_king", "arphex:arthropleura_abomination"]),
    A("tr_scorpioid", 4, "Жало скорпиоида", "Scorpioid Stinger", "pointed_dripstone", ["#1a0505", "#6a1010", "#d04030", "#ffd0a0"],
      dict(life=0.08, lifeCap=3, hitFx=[["minecraft:poison", 1, 60], ["minecraft:slowness", 0, 60]]), "Вампиризм ядом: травит и пьёт.",
      pool="boss", bosses=["arphex:scorpioid_bloodluster"]),
    A("tr_voidlasher", 4, "Хвост драконохвоста", "Voidlasher Tail", "breeze_rod", ["#08031a", "#2a0f5a", "#7a3ad0", "#e0c8ff"],
      dict(speed=0.15, hurtFx=[["minecraft:weakness", 1, 80]],
           immune=["arphex:supergravity", "arphex:chaos_controlled", "arphex:voidlasher_chaos_control"]),
      "Ударившего вплотную хлещет пустотой.", pool="boss", bosses=["arphex:draconic_voidlasher"]),
    A("tr_trisector", 5, "Клинок трисектора", "Trisector Blade", "iron_sword", ["#0a0a12", "#3a3a5a", "#9a9ac8", "#f0f0ff"],
      dict(dmg=4, aspd=0.15), "Режет быстро и глубоко.", pool="boss", bosses=["arphex:arachnoid_trisector"]),
    A("tr_diabolos", 5, "Рог диаболоса", "Diabolos Horn", "goat_horn", ["#1a0202", "#6a0808", "#d02020", "#ffb080"],
      dict(hp=6, dmg=3, killHeal=4), "Каждое убийство — глоток жизни.", pool="boss", bosses=["arphex:diabolos_decimator"]),
    A("tr_amethyst", 4, "Аметистовый панцирь", "Amethyst Carapace", "nautilus_shell", ["#1a0a2a", "#5a2a8a", "#b07ae0", "#f5e0ff"],
      dict(armor=4, thorns=0.2, immune=["arphex:constricted"]), "Колется в ответ, а краб-душитель его не сожмёт.",
      pool="boss", bosses=["cataclysm:amethyst_crab", "cataclysm:clawdian"]),
    A("tr_gladiator", 4, "Медальон гладиатора", "Gladiator's Medallion", "ender_pearl", ["#2a1a02", "#7a5008", "#e0a820", "#fff4c0"],
      dict(dmg=2, killFx=[["minecraft:strength", 0, 120], ["minecraft:speed", 0, 120]]), "Арена любит тех, кто добивает.",
      pool="boss", bosses=["cataclysm:kobolediator", "cataclysm:aptrgangr", "cataclysm:wadjet"]),
    A("tr_golem", 4, "Ядро голема", "Golem Core", "firework_star", ["#0a0a14", "#2a2a4a", "#7070b0", "#d0d0ff"],
      dict(kb=1.0, armor=3, tough=2, immune=["arphex:paralysis"]), "Ни босс, ни взрыв не сдвинут с места.",
      pool="boss", bosses=["cataclysm:ender_golem", "cataclysm:the_prowler"]),
    A("tr_guardian", 5, "Око Стража Края", "Eye of the Ender Guardian", "ender_eye", ["#03140f", "#0a4a3a", "#30c0a0", "#d0fff0"],
      dict(hp=6, wind=dict(cd=3600, after=40, tp=True)), "Смертельный удар — и ты уже в нескольких блоках отсюда.",
      pool="boss", bosses=["cataclysm:ender_guardian"]),
    A("tr_ignis", 5, "Ядро Игниса", "Ignis Core", "magma_cream", ["#2a0800", "#8a2000", "#ff7a10", "#fff0a0"],
      dict(buffs=[["minecraft:fire_resistance", 0]], aura=dict(r=4, dmg=2, fire=3)), "Чем гуще толпа у алтаря, тем лучше.",
      pool="boss", bosses=["cataclysm:ignis"]),
    A("tr_maledictus", 5, "Венец Маледиктуса", "Maledictus Crown", "skull_banner_pattern", ["#0a0a0a", "#2a1a2a", "#6a4a7a", "#d8c8e8"],
      dict(dmg=3, hitFx=[["minecraft:wither", 1, 60], ["minecraft:weakness", 0, 60]], immune=["minecraft:wither"]),
      "Ослабленный моб бьёт слабее — меньше урона по тебе.", pool="boss", bosses=["cataclysm:maledictus", "cataclysm:the_harbinger"]),
    A("tr_remnant", 5, "Ожерелье реликта", "Remnant's Necklace", "ominous_trial_key", ["#2a1a05", "#7a5a18", "#d8b058", "#fff4d0"],
      dict(dr=0.12, buffs=[["minecraft:water_breathing", 0]], immune=["minecraft:slowness", "minecraft:blindness"]),
      "Древняя защита и дыхание под водой.", pool="boss", bosses=["cataclysm:ancient_remnant", "cataclysm:scylla"]),
    A("tr_monstrosity", 5, "Незеритовое сердце", "Netherite Heart", "netherite_ingot", ["#0a0606", "#3a2a28", "#7a6560", "#d8c8c0"],
      dict(hp=12, armor=4, tough=2, speed=-0.05), "Тяжёлое, как само чудовище.", pool="boss", bosses=["cataclysm:netherite_monstrosity"]),
]

# ---------------- эндгейм: «Пробуждение артефактов» (02.10, Георгий: «крафты и механики замутить, новый эндгейм») ----------------
# Набеги → завод Create → артефакты. Осколки орды падают с мобов набега в «копилку» набега (раздаётся победителям вместе
# с добычей — убитые турелью в 40 блоках и на арене, которую после набега откатывают, не теряются).
# Шанс осколка с моба: волны 1–15 — 0,5 → 1,5 %, 16–70 — 1,5 → 6 %, дальше +0,05 % за волну до 8 %; ванильные мобы ×0,5;
# босс — 4–8 наверняка.
SHARDS = dict(early=[1, 0.005, 15, 0.015], mid=[16, 0.015, 70, 0.06], latePerWave=0.0005, max=0.08, vanillaMult=0.5, boss=[4, 8])
# Завод: дробилка — осколок → пыль (+10 % ещё одна), жернова — 1 к 1; миксер с супернагревом — 16 пыли + звёздный
# осколок + 1000 мБ лавы → эссенция пробуждения; рычаг магии — 8 пыли + 8 арканной эссенции (Iron's Spells) + осколок + лава.
# Звёздный осколок продаётся за EMC (131 072) — рычаг экономики. Итого ~14,5 осколка орды на эссенцию.
ESSENCE = dict(dust=16, dustMagic=8, arcane=8, lava=1000, crushBonus=0.10)
# Пробуждение — сборка Create по шагам (деплоер: эссенция → пресс → наполнитель: 250 мБ лавы), кругов = эссенций.
# Пробуждаются эпические и выше: +50 % к числам, перезарядки на треть короче; потолки суммы — прежние (+ здоровье ≤60).
AWAKEN = dict(mult=1.5, minTier=3, essences={3: 2, 4: 3, 5: 4, 6: 5}, lava=250)
MATERIALS = [
    # ключ, имя, англ., ванильная основа, палитра, подсказка
    ("horde_shard", "Осколок орды", "Horde Shard", "echo_shard", ["#14030a", "#4a0a24", "#a01a48", "#ff7aa8"],
     "Падает с мобов набега в копилку набега — раздаётся победителям. Дробилка Create → пыль орды."),
    ("horde_dust", "Пыль орды", "Horde Dust", "glowstone_dust", ["#1a0510", "#5a1030", "#c03060", "#ffb0d0"],
     "Миксер с супернагревом: 16 пыли + звёздный осколок + 1000 мБ лавы → эссенция пробуждения."),
    ("awakening_essence", "Эссенция пробуждения", "Awakening Essence", "experience_bottle", ["#1a0a02", "#7a3a08", "#ffb020", "#fff8d0"],
     "Пробуждает артефакт: сборка Create по шагам — деплоер (эссенция), пресс, наполнитель (лава)."),
]
INCOMPLETE = ("incomplete_awakening", "Пробуждаемый артефакт", "Awakening Artifact", "nether_star", ["#0a0a0a", "#3a2a40", "#8a6aa0", "#d8c8e8"])


def awaken_fx(fx):
    """Числа ×1,5 (минус скорости не усиливаем), перезарядки ÷1,5, длительности ×1,5, уровни эффектов — прежние."""
    m = AWAKEN["mult"]
    out = {}
    for k, v in fx.items():
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            if k == "speed" and v < 0:
                out[k] = v
            else:
                out[k] = round(v * m, 4)
                if k in ("hp", "iframes"):
                    out[k] = int(round(v * m))
                if k == "kb":
                    out[k] = min(1.0, out[k])
        elif k == "shield":
            out[k] = dict(dur=int(round(v["dur"] * m)), cd=int(round(v["cd"] / m)))
        elif k == "wind":
            out[k] = dict(v, after=int(round(v["after"] * m)), cd=int(round(v["cd"] / m)))
        elif k == "aura":
            out[k] = dict(r=int(round(v["r"] * m)), dmg=round(v["dmg"] * m, 2), fire=int(round(v["fire"] * m)))
        elif k in ("hitFx", "hurtFx", "killFx"):
            out[k] = [[e[0], e[1], int(round(e[2] * m))] for e in v]
        else:
            out[k] = v
    return out


def awaken_art(a):
    aw = dict(a)
    aw.update(key=a["key"] + "_aw", id=a["id"] + "_aw", ru=a["ru"] + " ✦", en=a["en"] + " ✦", fx=awaken_fx(a["fx"]),
              pool="awakened", base_pool=a["pool"], base_id=a["id"], base_ru=a["ru"], theme=None, bosses=[],
              about="Пробуждённый: +50 % к числам, перезарядки на треть короче.")
    return aw


ARTS += [awaken_art(a) for a in list(ARTS) if a["tier"] >= AWAKEN["minTier"]]

# Шутки для квест-бука (серым курсивом, через раз)
JOKES = {
    "how": "— Отдел кадров: «Четыре слота — не ограничение, а корпоративная культура. Пятый выдают посмертно».",
    "rare": "— ОТК: «Нашивку получает тот, кто прошёл проверку. Проверка — пережить волну».",
    "epic": "Чётки дозорного перебирают не для молитвы, а чтобы считать секунды до следующего удара.",
    "mythic": "Песочные часы смены: одна секунда бессмертия, потом шесть секунд объяснительной.",
    "odds": "— Бухгалтерия EMC: «Артефакты на баланс не ставим. Их нельзя купить — только выстрадать».",
    "builds": "Идеальный билд — тот, в котором ты дожил до раздачи добычи.",
    "arena": "— Турбюро Axiomativ: «Мерзлота, Пекло, Край. Всё включено, кроме возвращения».",
    "trophies_cm": "— Отдел трофеев: «Голову Игниса на стену не вешать. Она до сих пор горячая».",
    "reforge": "— Бухгалтерия: «Три старых в одно новое — это не потеря, это оптимизация склада».",
}


# --------------------------------------------------------------------------
# Числа: те же формулы, что в 09_ns_artifacts.js (nsArtChance, nsArtWeights, бросок арены и трофеев)
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


def wave_arts(tier=None):
    return [a for a in ARTS if a["pool"] == "wave" and (tier is None or a["tier"] == tier)]


def per_item(d, tier):
    """Шанс конкретного артефакта волн уровня tier за одну победу на волне d (без первого прохождения), доля."""
    return chance(d) * weights(d)[tier] / 100 / len(wave_arts(tier))


def theme_of(key):
    return next(t for t in THEMES if t["key"] == key)


def theme_item_chance(a):
    """Шанс этого артефакта арены за победу на арене в его теме (без первого прохождения), доля."""
    pool = [x for x in ARTS if x["pool"] == "theme" and x["theme"] == a["theme"]]
    w = sum(THEME_TIER_WEIGHT[x["tier"]] for x in pool)
    return theme_of(a["theme"])["chance"] * THEME_TIER_WEIGHT[a["tier"]] / w


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


def eff(e):
    """[id, уровень(, тики)] → «Иссушение II на 3 с»"""
    name = EFF[e[0]]
    s = name[0].upper() + name[1:] + " " + ROMAN[e[1]]
    if len(e) > 2:
        s += f" на {num(e[2] / 20)} с"
    return s


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
        out.append((True, "отбрасывания нет вовсе" if fx["kb"] >= 1 else f"+{round(fx['kb'] * 100)} % сопротивления отбрасыванию"))
    if fx.get("speed"):
        s = fx["speed"]
        out.append((s > 0, f"{'+' if s > 0 else '−'}{round(abs(s) * 100)} % скорости"))
    if fx.get("dmg"):
        out.append((True, f"+{num(fx['dmg'])} урона в ближнем бою"))
    if fx.get("aspd"):
        out.append((True, f"+{round(fx['aspd'] * 100)} % скорости атаки"))
    if fx.get("mine"):
        out.append((True, f"+{round(fx['mine'] * 100)} % скорости копания"))
    if fx.get("dr"):
        out.append((True, f"−{round(fx['dr'] * 100)} % входящего урона"))
    if fx.get("iframes"):
        out.append((True, f"неуязвимость после удара дольше на {num(fx['iframes'] / 20, 2)} с (как Крест-ожерелье)"))
    if fx.get("dodge"):
        out.append((True, f"уклонение {round(fx['dodge'] * 100)} %: удар моба проходит мимо"))
    if fx.get("life"):
        out.append((True, f"вампиризм {round(fx['life'] * 100)} % нанесённого урона (до {num(fx['lifeCap'])} HP за удар)"))
    if fx.get("regen"):
        out.append((True, f"вне боя +{num(fx['regen'])} HP/с (5 с без урона)"))
    if fx.get("thorns"):
        out.append((True, f"отражает {round(fx['thorns'] * 100)} % урона ближнего боя обратно"))
    if fx.get("buffs"):
        out.append((True, "постоянно: " + ", ".join(EFF[b[0]] for b in fx["buffs"])))
    if fx.get("immune"):
        out.append((True, "иммунитет: " + ", ".join(EFF[i] for i in fx["immune"])))
    if fx.get("noDmg"):
        out.append((True, "нет урона: " + ", ".join(DMG[i] for i in fx["noDmg"])))
    if fx.get("sanity"):
        out.append((True, "во тьме рассудок не падает, урона тьмы нет"))
    if fx.get("featherfall"):
        out.append((True, "медленное падение, пока зажат Shift"))
    if fx.get("hitFx"):
        out.append((True, "твои удары: " + ", ".join(eff(e) for e in fx["hitFx"])))
    if fx.get("hitFire"):
        out.append((True, f"твои удары поджигают на {num(fx['hitFire'])} с"))
    if fx.get("hurtFx"):
        out.append((True, "ударившему тебя вплотную: " + ", ".join(eff(e) for e in fx["hurtFx"])))
    if fx.get("hurtFire"):
        out.append((True, f"ударившего тебя вплотную поджигает на {num(fx['hurtFire'])} с"))
    if fx.get("killHeal"):
        out.append((True, f"убийство лечит {num(fx['killHeal'])} HP"))
    if fx.get("killFx"):
        out.append((True, "за убийство: " + ", ".join(eff(e) for e in fx["killFx"])))
    if fx.get("aura"):
        au = fx["aura"]
        out.append((True, f"огненная аура: монстры в {au['r']} блоках горят и получают {num(au['dmg'])} урона в секунду"))
    if fx.get("shield"):
        sh = fx["shield"]
        out.append((True, f"после удара моба — {num(sh['dur'] / 20)} с полной неуязвимости, перезарядка {num(sh['cd'] / 20)} с"))
    if fx.get("wind"):
        w = fx["wind"]
        tp = " и телепорт на несколько блоков в сторону" if w.get("tp") else ""
        out.append((True, f"второе дыхание: смертельный удар оставляет 1 HP, {num(w['after'] / 20)} с неуязвимости{tp}; раз в {num(w['cd'] / 1200)} мин"))
    return out


def item_name(a, en=False):
    name = a["en"] if en else a["ru"]
    if a["tier"] == 6:
        return "".join(("§" + RAINBOW[i % len(RAINBOW)] + ch) if ch != " " else ch for i, ch in enumerate(name))
    return "§" + TIERS[a["tier"]]["code"] + name


def drop_line(t):
    """«с волны 43: ≈0,3 % на 43-й, ≈2 % на 70-й, ≈4,8 % на 100-й» — шанс одного артефакта волн уровня за набег."""
    frm = TIERS[t]["frm"]
    waves = [frm] + [w for w in (15, 50, 100) if w > frm]
    parts = [f"≈{pct(per_item(w, t))} % на {wave_label(w)}" for w in waves]
    if t >= 5:
        parts.append(f"≈{pct(per_item(120, t))} % в Бесконечности (∞20)")
    return f"с волны {frm}: " + ", ".join(parts)


def theme_line(a):
    T = theme_of(a["theme"])
    return f"только на арене «{T['ru']}» (волны {T['waves']}): ≈{pct(theme_item_chance(a))} % за победу, первое прохождение ×{THEME_FIRST_MULT}"


def boss_names(a):
    return ", ".join(f"{BOSSES[b][0]} ({BOSSES[b][1]})" for b in a["bosses"])


def trophy_line(a):
    return f"трофей: {boss_names(a)} — {round(TROPHY_CHANCE[a['tier']] * 100)} % каждому за победу, первое прохождение — наверняка одному"


def kind_word(a):
    return {"wave": "артефакт смены", "theme": "артефакт арены", "boss": "трофей босса"}[a.get("base_pool", a["pool"])]


def plural(n, one, few, many):
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} {one}"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return f"{n} {few}"
    return f"{n} {many}"


def essences(tier):
    return plural(AWAKEN["essences"][tier], "эссенция", "эссенции", "эссенций")


def where_line(a):
    if a["pool"] == "awakened":
        return f"Пробуждение: «{a['base_ru']}» + {essences(a['tier'])} пробуждения — сборка Create: деплоер, пресс, наполнитель (лава)"
    if a["pool"] == "theme":
        return "Выпадает " + theme_line(a)
    if a["pool"] == "boss":
        return trophy_line(a)[0].upper() + trophy_line(a)[1:]
    return "Выпадает в набегах " + drop_line(a["tier"]) + " за победу"


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
        "// По одному create на предмет — tools/gen_quests.py и tools/emc_lock_create.py находят id по тексту event.create('…').",
        "// Правило Rhino: только var.",
        "// ==========================================================================",
        "StartupEvents.registry('item', function (event) {",
    ]
    for pool, title in (("wave", "волны"), ("theme", "арена"), ("boss", "трофеи боссов"), ("awakened", "пробуждённые")):
        for t, T in enumerate(TIERS):
            arts = [x for x in ARTS if x["tier"] == t and x["pool"] == pool]
            if not arts:
                continue
            lines.append(f"\t// {title}: {T['ru']}")
            for a in arts:
                glow = ".glow(true)" if t >= 5 or pool in ("boss", "awakened") else ""
                extra = ".tag('nightshift:awakened_artifacts')" if pool == "awakened" else ""
                lines.append(f"\tevent.create('{a['id']}').texture('nightshift:item/art_{a['key']}').maxStackSize(1).fireResistant().tag('curios:{SLOT}'){extra}{glow}")
    lines.append("\t// пробуждение: осколок орды (набеги) → пыль орды (дробилка) → эссенция пробуждения (миксер, супернагрев)")
    for key, *_ in MATERIALS:
        glow = ".glow(true)" if key == "awakening_essence" else ""
        lines.append(f"\tevent.create('nightshift:{key}').texture('nightshift:item/{key}').fireResistant(){glow}")
    lines.append(f"\tevent.create('nightshift:{INCOMPLETE[0]}', 'create:sequenced_assembly').texture('nightshift:item/{INCOMPLETE[0]}').maxStackSize(1).fireResistant()")
    lines.append("})")
    write(PACK / "kubejs/startup_scripts/vahta/30_ns_artifacts.js", "\n".join(lines) + "\n")


def gen_data_block():
    items = {}
    for a in ARTS:
        e = dict(tier=a["tier"], name=a["ru"], pool=a["pool"])
        if a["theme"]:
            e["theme"] = a["theme"]
        if a.get("base_id"):
            e["base"] = a["base_id"]
        e.update(a["fx"])
        items[a["id"]] = e
    trophies = {}
    for a in ARTS:
        for b in a["bosses"]:
            trophies[b] = a["id"]
    data = dict(
        slot=SLOT,
        slots=SLOTS,
        tiers=[dict(key=T["key"], name=T["ru"], gen=T["gen"], **{"from": T["frm"]}) for T in TIERS],
        items=items,
        byTier=[[a["id"] for a in wave_arts(t)] for t in range(len(TIERS))],
        chance=CHANCE,
        weights=WEIGHTS,
        caps=CAPS,
        combatTicks=COMBAT_TICKS,
        attrs=[list(x) for x in ATTRS],
        themes={T["key"]: dict(name=T["ru"], chance=T["chance"], items=[a["id"] for a in ARTS if a["theme"] == T["key"]]) for T in THEMES},
        themeFirstMult=THEME_FIRST_MULT,
        themeTierWeight={str(k): v for k, v in THEME_TIER_WEIGHT.items()},
        trophies=trophies,
        bossNames={b: v[0] for b, v in BOSSES.items()},
        trophyChance={str(k): v for k, v in TROPHY_CHANCE.items()},
        reforge=REFORGE,
        shards=SHARDS,
    )
    # компактно: ключ верхнего уровня — строка, артефакт — строка
    one = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    rows = []
    for k, v in data.items():
        if k in ("items", "themes", "trophies", "bossNames"):
            rows.append(f'\t"{k}": {{\n' + ",\n".join(f"\t\t{one(i)}: {one(e)}" for i, e in v.items()) + "\n\t}")
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
        head = ("Пробуждённый " + T["ru"] if a["pool"] == "awakened" else T["ru"].capitalize()) + " " + kind_word(a)
        rows = [f"Text.{T['text']}({js_str(head)})"]
        for good, txt in fx_lines(a["fx"]):
            rows.append(f"Text.{'green' if good else 'red'}({js_str(txt[0].upper() + txt[1:])})")
        slot = f"Слот «Реликвия» ({SLOTS} шт.) — кнопка Curios в инвентаре. Второй такой же не наденется."
        if a["pool"] == "awakened":
            slot += " С обычной версией вместе не наденется."
        if a["pool"] != "wave":
            slot += " В переплавку не идёт."
        rows.append(f"Text.gray({js_str(slot)})")
        rows.append(f"Text.darkGray({js_str(where_line(a))})")
        lines.append(f"\tevent.add('{a['id']}', [")
        lines.append(",\n".join("\t\t" + r for r in rows))
        lines.append("\t])")
    lines.append("})")
    write(PACK / "kubejs/client_scripts/ns_artifacts_tooltips.js", "\n".join(lines) + "\n")


def dump_like(text, data):
    """JSON в том же виде, что уже лежит в файле (отступ, \\u-экранирование, перевод строки в конце) —
    lang правят несколько генераторов, чужое форматирование не трогаем."""
    m = re.search(r"\n([ \t]+)\"", text)
    indent = m.group(1) if m else "\t"
    ascii_ = bool(re.search(r"\\u0[0-9a-fA-F]{3}", text))
    out = json.dumps(data, ensure_ascii=ascii_, indent=indent)
    return out + ("\n" if text.endswith("\n") else "")


def gen_lang():
    for loc, en in (("ru_ru", False), ("en_us", True)):
        f = PACK / "kubejs/assets/nightshift/lang" / f"{loc}.json"
        text = f.read_text()
        data = json.loads(text)
        for a in ARTS:
            data["item.nightshift.art_" + a["key"]] = item_name(a, en)
        for key, ru, eng, *_ in MATERIALS:
            data["item.nightshift." + key] = eng if en else ru
        data["item.nightshift." + INCOMPLETE[0]] = INCOMPLETE[2] if en else INCOMPLETE[1]
        data["curios.identifier." + SLOT] = "Relic" if en else "Реликвия"
        data["curios.modifiers." + SLOT] = "When worn as relic:" if en else "Когда надето как реликвия:"
        f.write_text(dump_like(text, data))
        print("  ", f.relative_to(PACK))


def gen_curios():
    write(PACK / f"kubejs/data/nightshift/curios/slots/{SLOT}.json",
          json.dumps({"size": SLOTS, "order": 5, "icon": f"nightshift:slot/{SLOT}", "add_cosmetic": False, "validators": ["curios:tag"]}, indent=2) + "\n")
    write(PACK / f"kubejs/data/nightshift/curios/entities/{SLOT}.json",
          json.dumps({"entities": ["minecraft:player"], "slots": [SLOT]}, indent=2) + "\n")
    write(PACK / f"kubejs/data/curios/tags/item/{SLOT}.json",
          json.dumps({"replace": False, "values": [a["id"] for a in ARTS]}, indent=2) + "\n")
    write(PACK / "kubejs/data/nightshift/tags/item/awakened_artifacts.json",
          json.dumps({"replace": False, "values": [a["id"] for a in ARTS if a["pool"] == "awakened"]}, indent=2) + "\n")


def gen_recipes():
    """Рецепты пробуждения — только машины Create («Вахта»: руками не крафтят)."""
    inc = "nightshift:" + INCOMPLETE[0]
    lava = lambda n: {"type": "neoforge:single", "amount": n, "fluid": "minecraft:lava"}
    star = {"item": "nightshift:star_fragment"}
    dust = {"item": "nightshift:horde_dust"}
    E = ESSENCE
    rec = [
        ("crush_horde_shard", {"type": "create:crushing", "ingredients": [{"item": "nightshift:horde_shard"}], "processing_time": 150,
                               "results": [{"id": "nightshift:horde_dust"}, {"id": "nightshift:horde_dust", "chance": E["crushBonus"]}]}),
        ("mill_horde_shard", {"type": "create:milling", "ingredients": [{"item": "nightshift:horde_shard"}], "processing_time": 300,
                              "results": [{"id": "nightshift:horde_dust"}]}),
        ("essence", {"type": "create:mixing", "heat_requirement": "superheated",
                     "ingredients": [dust] * E["dust"] + [star, lava(E["lava"])], "results": [{"id": "nightshift:awakening_essence"}]}),
    ]
    magic = ("essence_magic", {"type": "create:mixing", "heat_requirement": "superheated",
                               "ingredients": [dust] * E["dustMagic"] + [{"item": "irons_spellbooks:arcane_essence"}] * E["arcane"] + [star, lava(E["lava"])],
                               "results": [{"id": "nightshift:awakening_essence"}]})
    step = [
        {"type": "create:deploying", "ingredients": [{"item": inc}, {"item": "nightshift:awakening_essence"}], "results": [{"id": inc}]},
        {"type": "create:pressing", "ingredients": [{"item": inc}], "results": [{"id": inc}]},
        {"type": "create:filling", "ingredients": [{"item": inc}, lava(AWAKEN["lava"])], "results": [{"id": inc}]},
    ]
    for a in ARTS:
        if a["pool"] != "awakened":
            continue
        rec.append(("art_" + a["key"], {"type": "create:sequenced_assembly", "ingredient": {"item": a["base_id"]}, "loops": AWAKEN["essences"][a["tier"]],
                                        "results": [{"id": a["id"]}], "sequence": step, "transitional_item": {"id": inc}}))
    one = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    lines = [
        "// ==========================================================================",
        "// Пробуждение артефактов — рецепты завода (СГЕНЕРИРОВАНО tools/gen_ns_artifacts.py — правки в таблице генератора).",
        "// Осколок орды (копилка набега, raids/09_ns_artifacts.js) → дробилка/жернова → пыль орды → миксер с супернагревом",
        "// (+ звёздный осколок, лава; или + арканная эссенция Iron's Spells) → эссенция пробуждения → сборка по шагам:",
        "// артефакт + эссенции (деплоер), пресс, наполнитель (лава) → пробуждённый артефакт (art_<id>_aw). Только машины.",
        "// Правило Rhino: только var.",
        "// ==========================================================================",
        "ServerEvents.recipes(function (event) {",
    ]
    for rid, j in rec:
        lines.append(f"\tevent.custom({one(j)}).id('nightshift:awakening/{rid}')")
    lines.append("\t// рычаг магии — только если Iron's Spells в сборке")
    lines.append(f"\tif (Platform.isLoaded('irons_spellbooks')) event.custom({one(magic[1])}).id('nightshift:awakening/{magic[0]}')")
    lines.append("})")
    write(PACK / "kubejs/server_scripts/vahta/75_ns_awakening.js", "\n".join(lines) + "\n")


def gen_emc():
    f = PACK / "config/ProjectE/custom_emc.json"
    data = json.loads(f.read_text())
    have = {e.get("id") for e in data["entries"]}
    added = 0
    ids = [a["id"] for a in ARTS] + ["nightshift:" + m[0] for m in MATERIALS] + ["nightshift:" + INCOMPLETE[0]]
    for i in ids:
        if i not in have:
            data["entries"].append({"id": i, "emc": 0})
            added += 1
    if added:
        f.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print("  ", f.relative_to(PACK), f"(+{added} записей EMC 0)")


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


def frame(img, tier, dotted=False):
    """Рамка цвета уровня: прозрачные пиксели рядом с рисунком (по 4 соседям); божественный — радуга по кругу.
    dotted — трофей босса: рамка пунктиром (через пиксель), чтобы отличался от артефактов волн."""
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
            alpha = 200 if tier >= 1 else 150
            if dotted and (x + y) % 2:
                c, alpha = (255, 255, 255), 230
            out.putpixel((x, y), c + (alpha,))
    return out


def sparkle(img):
    """Пробуждённый: золотая звёздочка-«искра» в правом верхнем углу поверх иконки."""
    out = img.copy()
    core = (255, 250, 210, 255)
    ray = (255, 205, 60, 255)
    for x, y, c in ((13, 2, core), (13, 1, ray), (13, 3, ray), (12, 2, ray), (14, 2, ray), (13, 0, (255, 230, 120, 200)),
                    (15, 2, (255, 230, 120, 200)), (11, 2, (255, 230, 120, 160)), (13, 4, (255, 230, 120, 160))):
        out.putpixel((x, y), c)
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
        "....########....",
        "...#..#..#..#...",
        "..#..#....#..#..",
        "..############..",
        "...#..#..#..#...",
        "....#..#.#.#....",
        ".....#.#..#.....",
        "......#.##......",
        ".......##.......",
    ]
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == "#":
                im.putpixel((x, y + 4), (85, 85, 85, 255))
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
        van = lambda name: Image.open(io.BytesIO(z.read("assets/minecraft/textures/item/" + name + ".png"))).convert("RGBA")
        for a in ARTS:
            base = halo_base() if a["base"] is None else van(a["base"])
            img = frame(recolor(base, a["pal"]), a["tier"], dotted=a.get("base_pool", a["pool"]) == "boss")
            if a["pool"] == "awakened":
                img = sparkle(img)
            img.save(out / f"art_{a['key']}.png")
        for key, _ru, _en, tex, pal, _tip in MATERIALS:
            recolor(van(tex), pal).save(out / f"{key}.png")
        recolor(van(INCOMPLETE[3]), INCOMPLETE[4]).save(out / f"{INCOMPLETE[0]}.png")
    slot = PACK / f"kubejs/assets/nightshift/textures/slot/{SLOT}.png"
    slot.parent.mkdir(parents=True, exist_ok=True)
    slot_icon().save(slot)
    print("  ", out.relative_to(PACK) / "art_*.png", f"({len(ARTS)} шт.) и", slot.relative_to(PACK))


# --------------------------------------------------------------------------
# Квест-бук
# --------------------------------------------------------------------------
def amp(t):
    return "&" + TIERS[t]["code"]


def art_line(a, with_where=False):
    fx = "; ".join(txt for _, txt in fx_lines(a["fx"]))
    s = f"{amp(a['tier'])}{a['ru']}&r — {fx}. {a['about']}"
    return s


def gen_quests():
    icons = ["patch", "qc_stripe", "fang", "rosary", "second_wind", "hourglass", "vakhta_heart"]
    best_hp = sorted((a["fx"].get("hp", 0) for a in ARTS if a["pool"] != "awakened"), reverse=True)[:SLOTS]
    n_theme = len([a for a in ARTS if a["pool"] == "theme"])
    n_boss = len([a for a in ARTS if a["pool"] == "boss"])
    quests = []
    how = [
        "Артефакты смены делают &aтебя плотнее&r: мобов не ослабляем — переживаешь поздние волны за счёт своего билда.",
        f"Надеваются в слоты &eРеликвия&r — их {SLOTS}: инвентарь → кнопка Curios (значок у куклы игрока). {SLOTS} слота — {SLOTS} решения: больше здоровья, меньше урона, вампиризм, трофей босса или бессмертие на секунду — выбирай.",
        "&cОдинаковые не складываются&r: второй такой же в слот не встанет. Разные — суммируются; неуязвимость после удара и второе дыхание — работает лучший из надетых.",
        "{@pagebreak}",
        f"Где взять — три источника: &6артефакты волн&r ({len(wave_arts())}) — бросок за любую победу; &dартефакты арены&r ({n_theme}) — только за победу на арене в её теме; &6трофеи боссов&r ({n_boss}) — за победу на волне с этим боссом.",
        f"Лишние артефакты волн — в &eпереплавку&r: {REFORGE['n']} одного уровня → 1 следующего (/nsart reforge или кнопка у алтаря).",
        "Ни купить, ни продать: EMC у них нет. После смерти и смены надетого эффекты включаются за секунду; /nsart — что даёт твой билд.",
        "{@pagebreak}",
        f"Потолки суммы: срез урона ≤{round(CAPS['dr'] * 100)} %, вампиризм ≤{round(CAPS['life'] * 100)} % (до {CAPS['lifeCap']} HP за удар), лечение вне боя ≤{CAPS['regen']} HP/с, отражение ≤{round(CAPS['thorns'] * 100)} %, уклонение ≤{round(CAPS['dodge'] * 100)} %.",
        f"Здоровье: 20 + &d5 Сердец ночи&r (+10) + 4 лучших по здоровью (+{sum(best_hp)}) = &a{30 + sum(best_hp)} HP&r — больше четырёх рядов сердец. Потолок здоровья от артефактов — +{CAPS['hp']} (пробуждённые доходят до него за три слота), срез урона упирается в {round(CAPS['dr'] * 100)} %.",
        "Артефакты мода Artifacts (крест-ожерелье, кристальное сердце…) носятся в своих слотах и складываются с этими.",
        "&7&o" + JOKES["how"] + "&r",
    ]
    quests.append(dict(key="how", type="checkmark", item="nightshift:art_badge", title="Как это работает: слоты, билды, шансы",
                       desc=how, deps=[], shape="diamond", size=1.3, pos=[0.0, 0.0]))
    # таблица шансов по волнам
    odds = ["Шанс артефакта волн за победу и уровень, если выпал. Строки — для обычного прохождения.", ""]
    for d in (1, 15, 30, 50, 70, 100, 110, 120):
        w = weights(d)
        tiers = " · ".join(f"{amp(t)}{TIERS[t]['ru']} {num(w[t], 0) if w[t] >= 1 else '<1'}&r" for t in range(len(TIERS)) if w[t] > 0)
        label = f"Волна {d}" if d <= WAVES_MAX else f"Бесконечность {d - WAVES_MAX}"
        odds.append(f"&e{label}&r — артефакт {pct(chance(d))} %: {tiers}")
        if d == 50:
            odds.append("{@pagebreak}")
    odds += ["", "Первое прохождение: шанс ×1,5 (до 95 %), каждая 10-я волна — наверняка. Божественные — только с 90-й и очень редко.",
             "Артефакты арены и трофеи боссов — отдельные броски сверх этого.",
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
        build("Стена", ["visor", "tr_remnant", "rosary", "qc_stripe"], "−34 % урона до брони и длинная передышка после удара."),
        "{@pagebreak}",
        build("Бессмертный", ["hourglass", "second_wind", "rosary", "ender_void"], "Щит 1 с раз в 6 с, второе дыхание раз в 5 мин, уклонение 15 %. Нимб бессменного заменяет сразу часы и жетон — щит и дыхание не складываются, работает лучший."),
        build("Вампир", ["butcher_glove", "horde_heart", "tr_scorpioid", "halo"], "Вампиризм 20 % (потолок), до 5 HP за удар; удары травят и замедляют."),
        build("Поджигатель", ["tr_ignis", "inferno_crown", "inferno_ash", "tr_diabolos"], "Аура жжёт всё рядом, удары поджигают, атакующие горят, убийства лечат; огонь тебе не страшен."),
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
        arts = wave_arts(t)
        desc = [f"{amp(t)}{T['pl'].capitalize()}&r артефакты волн ({len(arts)}) — {intro[t]}", ""]
        for a in arts:
            desc.append(art_line(a))
        desc += ["{@pagebreak}",
                 f"Слот: &eРеликвия&r. Выпадает каждый из {len(arts)} — {drop_line(t)} за победу (без первого прохождения)."]
        jk = JOKES.get(T["key"])
        if jk:
            desc.append("&7&o" + jk + "&r")
        key = "tier_" + T["key"]
        quests.append(dict(key=key, type="checkmark", item="nightshift:art_" + icons[t], title=f"{amp(t)}{T['pl'].capitalize()}&r артефакты",
                           desc=desc, deps=[prev], optional=True, shape="circle", pos=[round(2.2 * (t + 1), 2), 0.0]))
        prev = key
    # переплавка
    reforge = [
        f"Лишние артефакты волн не пропадают: &e{REFORGE['n']} одного уровня → 1 случайный следующего&r.",
        "Как: команда &e/nsart reforge&r или кнопка «[Переплавить 3 → 1]» в меню алтаря. Берутся артефакты из инвентаря (не из слотов) — самого низкого уровня, где их набралось три; сначала повторы.",
        f"Потолок — &cмифический&r: три легендарных дают мифический, божественные только из волн. Трофеи боссов и артефакты арены в переплавку не идут.",
        "&7&o" + JOKES["reforge"] + "&r",
    ]
    quests.append(dict(key="reforge", type="checkmark", item="minecraft:blast_furnace", title="Переплавка 3 → 1", desc=reforge,
                       deps=["tier_common"], optional=True, shape="circle", pos=[2.2, 2.2]))
    # арена
    arena = [f"Арена меняет облик по номеру волны — и у каждой темы свои &dартефакты арены&r. Падают &eтолько за победу на арене&r в этой теме: так у арены появляется смысл фарма.",
             f"Шанс — отдельный бросок каждому защитнику сверх обычного артефакта; первое прохождение волны — ×{THEME_FIRST_MULT}. Внутри темы эпический выпадает чаще мифического."]
    for i, T in enumerate(THEMES):
        if i % 2 == 0:
            arena.append("{@pagebreak}")
        arena.append(f"&e{T['ru']}&r (волны {T['waves']}, {round(T['chance'] * 100)} % за победу):")
        for a in [x for x in ARTS if x["theme"] == T["key"]]:
            arena.append(art_line(a))
    arena.append("&7&o" + JOKES["arena"] + "&r")
    quests.append(dict(key="arena", type="checkmark", item="nightshift:art_frost_shard", title="&dАртефакты арены&r", desc=arena,
                       deps=["tier_epic"], optional=True, shape="circle", pos=[8.8, -2.2]))

    # трофеи
    def trophy_quest(key, title, icon, prefix, pos, dep, intro_line, joke=None):
        desc = [intro_line,
                f"Трофей падает за победу на волне, где был босс: легендарный — {round(TROPHY_CHANCE[4] * 100)} %, мифический — {round(TROPHY_CHANCE[5] * 100)} % каждому защитнику; при &eпервом прохождении&r волны с боссом — наверняка одному из вас. Трофей занимает слот «Реликвия» — это и есть выбор."]
        arts = [a for a in ARTS if a["pool"] == "boss" and a["bosses"][0].startswith(prefix)]
        for i, a in enumerate(arts):
            if i % 3 == 0:
                desc.append("{@pagebreak}")
            desc.append(art_line(a) + f" &7{'Боссы' if len(a['bosses']) > 1 else 'Босс'}: {boss_names(a)}.&r")
        if joke:
            desc.append("&7&o" + JOKES[joke] + "&r")
        quests.append(dict(key=key, type="checkmark", item=icon, title=title, desc=desc, deps=[dep], optional=True, shape="circle", pos=pos))

    trophy_quest("trophies_arphex", "&6Трофеи боссов ArPhEx&r", "nightshift:art_tr_matriarch", "arphex:", [11.0, 2.2], "tier_legendary",
                 "Боссы ArPhEx приходят каждую 5-ю волну с 15-й по 65-ю. С каждого — свой трофей по характеру: хитин, жало, рог.")
    trophy_quest("trophies_cataclysm", "&cТрофеи боссов Cataclysm&r", "nightshift:art_tr_ignis", "cataclysm:", [13.2, 2.2], "tier_mythic",
                 "Боссы L_Ender's Cataclysm — с 70-й волны: мини-боссы до 92-й, настоящие — с 80-й. Их трофеи — самые сильные в паке.",
                 "trophies_cm")
    # ветка «Пробуждение»: осколки → пыль → эссенция → пробуждение
    E = ESSENCE
    sh = SHARDS
    n_aw = len([a for a in ARTS if a["pool"] == "awakened"])
    per_ess = E["dust"] / (1 + E["crushBonus"])
    quests.append(dict(key="aw_shard", type="item", item="nightshift:horde_shard", title="&dОсколок орды&r", deps=["reforge"], pos=[2.2, 4.4], desc=[
        "Сырьё эндгейма: завод делает из осколков эссенцию, а она &eпробуждает артефакты&r.",
        "Падают с мобов набега — не на землю, а в &eкопилку набега&r: что выбили вы и ваши турели, после победы получает каждый защитник вместе с добычей. Провал — копилка сгорает.",
        f"Шанс с моба: волны 1–15 — {num(sh['early'][1] * 100)}–{num(sh['early'][3] * 100)} %, 16–70 — {num(sh['mid'][1] * 100)}–{num(sh['mid'][3] * 100)} %, дальше до {num(sh['max'] * 100)} %; ванильные мобы — вдвое реже. Босс — {sh['boss'][0]}–{sh['boss'][1]} осколков наверняка.",
        "Сколько в копилке прямо сейчас — команда /nsart.",
        "&7&o— Отдел снабжения: «Орда не знает, что её разбирают на запчасти. Не говорите ей».&r",
    ]))
    quests.append(dict(key="aw_dust", type="item", item="nightshift:horde_dust", title="Пыль орды", deps=["aw_shard"], pos=[4.4, 4.4], desc=[
        "Пыль — то, что дробилка достаёт из осколка; из неё варят эссенцию.",
        f"&eДробильные колёса&r: осколок → пыль + {round(E['crushBonus'] * 100)} % ещё одна. &eЖернова&r: 1 к 1 и медленнее. Хочешь быстрее — больше колёс и оборотов.",
        "Руками не мелется: «Вахта» — руками только собирать.",
    ]))
    quests.append(dict(key="aw_essence", type="item", item="nightshift:awakening_essence", title="&6Эссенция пробуждения&r", deps=["aw_dust"], pos=[6.6, 4.4], desc=[
        "Эссенция — то, чем пробуждают артефакт: одна эссенция на круг сборки.",
        f"&eМиксер с супернагревом&r (горелка всполоха на торте всполоха): {E['dust']} пыли орды + звёздный осколок + {E['lava']} мБ лавы.",
        f"&dРычаг магии&r: {E['dustMagic']} пыли + {E['arcane']} арканной эссенции (Iron's Spells, добыча набегов) + звёздный осколок + лава — пыли вдвое меньше.",
        f"Звёздный осколок — веха 70-й волны и добыча Кошмара, покупается за EMC (131 072). Итого ~{round(per_ess)} осколков орды на эссенцию.",
        "&7&o— Столовая: «Эссенция пробуждения — не кофе. Пить её запрещено. Особенно вам».&r",
    ]))
    ex = next(a for a in ARTS if a["key"] == "horde_heart_aw")
    quests.append(dict(key="aw_awaken", type="checkmark", item="nightshift:art_horde_heart_aw", title="&6Пробуждение ✦&r", deps=["aw_essence"], pos=[8.8, 4.4],
                       goal=True, desc=[
        "Пробуждённый артефакт — та же вещь, но сильнее: &a+50 % к числам&r, перезарядки щита и второго дыхания на треть короче, эффекты держатся дольше.",
        f"Как: &eсборка по шагам&r Create — артефакт на ленте проходит деплоер (эссенция), пресс и наполнитель ({AWAKEN['lava']} мБ лавы). Кругов — сколько эссенций: эпический {AWAKEN['essences'][3]}, легендарный {AWAKEN['essences'][4]}, мифический {AWAKEN['essences'][5]}, божественный {AWAKEN['essences'][6]}.",
        "{@pagebreak}",
        f"Пробуждаются эпические и выше — артефакты волн, арены и трофеи боссов, всего {n_aw}. Имя — со звёздочкой ✦.",
        f"Потолки суммы прежние: срез урона ≤{round(CAPS['dr'] * 100)} %, вампиризм ≤{round(CAPS['life'] * 100)} %, уклонение ≤{round(CAPS['dodge'] * 100)} %; здоровье от артефактов — не больше +{CAPS['hp']}. Обычный и пробуждённый одного вида вместе не наденутся. В переплавку пробуждённые не идут.",
        "Пример: " + art_line(ex),
        "&7&o— ОТК: «Пробуждённый артефакт проверен прессом. Трижды. Претензии — к прессу».&r",
    ]))
    spec = {"chapters": [{"key": "artifacts", "title": "Артефакты смены", "icon": "nightshift:art_hourglass",
                          "subtitle": "7 уровней, 4 слота «Реликвия»: волны, арена, трофеи, переплавка, пробуждение", "quests": quests}]}
    write(PACK / "tools/quests/spec_artifacts.json", json.dumps(spec, ensure_ascii=False, indent=1) + "\n")


def report():
    print("\nШанс за победу и уровни:")
    for d in (1, 8, 15, 27, 30, 43, 50, 70, 90, 100, 110, 120):
        w = weights(d)
        print(f"  волна {d:>3}: {pct(chance(d)):>5} %  " + "  ".join(f"{TIERS[t]['key'][:4]} {w[t]:4.1f}" for t in range(7)))
    hp = sorted((a["fx"].get("hp", 0) for a in ARTS if a["pool"] != "awakened"), reverse=True)[:SLOTS]
    hpa = sorted((a["fx"].get("hp", 0) for a in ARTS), reverse=True)[:SLOTS]
    print(f"  лучшие {SLOTS} по здоровью: +{sum(hp)} → {30 + sum(hp)} HP; с пробуждёнными +{sum(hpa)}, потолок +{CAPS['hp']} → {30 + min(CAPS['hp'], sum(hpa))} HP")
    print(f"  артефактов: волны {len(wave_arts())}, арена {len([a for a in ARTS if a['pool'] == 'theme'])}, трофеи {len([a for a in ARTS if a['pool'] == 'boss'])}, пробуждённые {len([a for a in ARTS if a['pool'] == 'awakened'])}, всего {len(ARTS)}")
    print(f"  эссенция: ~{ESSENCE['dust'] / (1 + ESSENCE['crushBonus']):.1f} осколков орды; пробуждение: " + ", ".join(f"{TIERS[t]['ru']} {n} эсс." for t, n in AWAKEN["essences"].items()))
    missing = [b for b in BOSSES if not any(b in a["bosses"] for a in ARTS)]
    if missing:
        print("  ВНИМАНИЕ: боссы без трофея:", ", ".join(missing))


def check():
    """Опечатки в таблице — до генерации: эффекты и боссы должны быть в словарях, темы — в THEMES."""
    keys = {T["key"] for T in THEMES}
    for a in ARTS:
        fx = a["fx"]
        for k in ("buffs", "immune", "hitFx", "hurtFx", "killFx"):
            for e in fx.get(k, []):
                eid = e if isinstance(e, str) else e[0]
                assert eid in EFF, f"{a['key']}: эффект {eid} без русского имени (EFF)"
        for dmg in fx.get("noDmg", []):
            assert dmg in DMG, f"{a['key']}: урон {dmg} без русского имени (DMG)"
        assert a["pool"] != "theme" or a["theme"] in keys, f"{a['key']}: тема {a['theme']}"
        for b in a["bosses"]:
            assert b in BOSSES, f"{a['key']}: босс {b}"
    assert len({a["key"] for a in ARTS}) == len(ARTS), "повтор ключа"


def main():
    check()
    print("Артефакты смены:")
    gen_startup()
    gen_data_block()
    gen_tooltips()
    gen_lang()
    gen_curios()
    gen_recipes()
    gen_emc()
    gen_icons()
    gen_quests()
    report()


if __name__ == "__main__":
    main()
