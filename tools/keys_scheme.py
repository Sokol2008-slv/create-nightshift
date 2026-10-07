#!/usr/bin/env python3
"""Раскладка смены — один источник для всех (07.10.2026, Георгий: «создавай прям чётко по клавишам… чтобы потом все
использовали одни бинды»).

Правила раскладки:
  - «Всегда» — действия, которые работают без предмета в руке (квесты, карта, рюкзак, дракон, магия, джетпак, голос):
    у каждого СВОЯ клавиша, ни с чем не совпадает.
  - «В руке» — клавиши оружия, палочек, инструментов ProjectE, биноклей: в руке одна вещь, поэтому у разных вещей
    клавиши могут совпадать (R — перезарядка у ружья и вращение у палочки), а со «всегда» — нет. У палочек занятые
    буквы — с Ctrl (Ctrl + V — режим палочки).
  - «Верхом» — дракон, самолёт, машина TFMG, пульт управления: Backspace — выйти (из самолёта, брони, пульта).
  - Редкие переключатели брони — цифровой блок.

Выход (не править руками — менять здесь и запускать):
  config/axiomativ/keys.json             — аддон ставит раскладку всем один раз на версию, «Сброс» ведёт к ней
  config/defaultoptions/keybindings.txt  — Default Options: те же умолчания для новых установок
  kubejs/server_scripts/hud/31_keys.js   — /smena keys
  kubejs/assets/nightshift_keys/lang     — русские названия клавиш, что в модах по-английски
  docs/KEYS.md                           — таблица
Проверка: имена — по выгрузке клавиш клиента (/nskeys dump → ~/projects/ns-patches/keys-dump-*.tsv), совпадения —
по правилам выше. Запуск: python3 tools/keys_scheme.py [путь к выгрузке]
"""
import csv
import glob
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = 1  # поднять — раскладка снова встанет у всех при следующем запуске игры

K = "key.keyboard."
ALT, SHIFT, CTRL = ":ALT", ":SHIFT", ":CONTROL"
OFF = "key.keyboard.unknown"

# (группа, область, [(как показать, что делает, {имя клавиши: значение})])
# область: always | hand:<вещь> | ride:<транспорт> | gui | mod (модификатор вроде Alt у Create — совпадать можно)
SCHEME = [
    ("Смена", "always", [
        ("L", "книга квестов; Alt + L — трекер квестов",
         {"key.ftbquests.quests": K + "l", "key.ftbquests.cycle_pinned_tracker": K + "l" + ALT}),
        ("J", "планшет инженера; Shift + J — панель целей",
         {"key.axiomativ.tablet.open": K + "j", "key.axiomativ.tablet.hud": K + "j" + SHIFT}),
        ("' (Э)", "ранец снабжения", {"key.axiomativ.supply_open": K + "apostrophe"}),
        ("B", "рюкзак; Alt + B — рюкзак ↔ сундук, на который смотришь",
         {"key.sophisticatedbackpacks.open_backpack": K + "b", "key.sophisticatedbackpacks.inventory_interaction": K + "b" + ALT}),
        ("Alt + 1 / Alt + 2", "рюкзак: улучшение в слоте 1 / 2 вкл/выкл",
         {"key.sophisticatedbackpacks.toggle_upgrade_1": K + "1" + ALT, "key.sophisticatedbackpacks.toggle_upgrade_2": K + "2" + ALT}),
        ("K", "стол трансмутации (ProjectE, если надет)", {"key.projecte.curios.open_transmutation_tablet": K + "k"}),
        ("` (Ё)", "Ultimine — зажать и копать; ↑ / ↓ — форма", {"key.ftbultimine": K + "grave.accent"}),
        ("C", "зум (как в OptiFine)", {"justzoom.keybinds.keybind.zoom": K + "c"}),
        ("Alt + G / Alt + H", "склад Create с собой / настройки сети",
         {"create_mobile_packages.keyinfo.open_portable_stock_ticker": K + "g" + ALT,
          "create_mobile_packages.keyinfo.open_player_networks_screen": K + "h" + ALT}),
        ("Alt + U", "история смертей (где лежат вещи)", {"key.corpse.death_history": K + "u" + ALT}),
    ]),
    ("Карта и связь", "always", [
        ("M", "карта мира", {"gui.xaero_open_map": K + "m"}),
        ("U", "список меток", {"gui.xaero_waypoints_key": K + "u"}),
        ("N", "новая метка", {"gui.xaero_new_waypoint": K + "n"}),
        ("Num +", "быстрая метка там, где стоишь", {"gui.xaero_instant_waypoint": K + "keypad.add"}),
        ("Z", "мини-карта крупно", {"gui.xaero_enlarge_map": K + "z"}),
        ("Мышь 5", "метка команде; зажать — колесо меток", {"key.pingwheel.ping_location": "key.mouse.5"}),
        ("Мышь 4", "рация: говорить (зажать)", {"key.push_to_talk": "key.mouse.4"}),
        ("Alt + V / Alt + M / Alt + N", "голосовой чат: меню / микрофон / выключить совсем",
         {"key.voice_chat": K + "v" + ALT, "key.mute_microphone": K + "m" + ALT, "key.disable_voice_chat": K + "n" + ALT}),
    ]),
    ("Дракон, магия, джетпак", "always", [
        ("V", "позвать дракона; Shift + V — команды дракону",
         {"dmr.keybind.summon_dragon": K + "v", "dmr.keybind.dragon_command": K + "v" + SHIFT}),
        ("Y", "колесо заклинаний (зажать)", {"key.irons_spellbooks.spell_wheel": K + "y"}),
        ("H", "применить заклинание", {"key.irons_spellbooks.spellbook_cast": K + "h"}),
        ("G", "джетпак: двигатель; Shift + G — зависание",
         {"key.jetpack.toggle_active.description": K + "g", "key.jetpack.toggle_hover.description": K + "g" + SHIFT}),
        ("F4", "оружие: подсказки клавиш", {"key.ntgl.key_tips": K + "f4"}),
    ]),
    ("Оружие в руке", "hand:gun", [
        ("R / Alt + R", "перезарядить / разрядить", {"key.ntgl.reload": K + "r", "key.ntgl.unload": K + "r" + ALT}),
        ("X", "удар прикладом", {"key.ntgl.melee": K + "x"}),
        ("Alt + X", "режим огня", {"key.ntgl.fire_select": K + "x" + ALT}),
        ("I / Alt + I", "осмотр / тип патронов", {"key.ntgl.inspect": K + "i", "key.ntgl.ammo_select": K + "i" + ALT}),
        ("; (Ж)", "обвесы: приклад, прицел, магазин", {"key.ntgl.attachments": K + "semicolon"}),
    ]),
    ("Инструменты ProjectE в руке", "hand:pe", [
        ("R", "огненный снаряд", {"key.projecte.fire_projectile": K + "r"}),
        ("X", "заряд (разбег)", {"key.projecte.charge": K + "x"}),
        ("Alt + X", "сменить режим", {"key.projecte.mode": K + "x" + ALT}),
        ("I", "доп. функция", {"key.projecte.extra_function": K + "i"}),
    ]),
    ("Палочки в руке (Building Wands)", "hand:wand", [
        ("Ctrl + Y", "меню палочки", {"key.wands.wand_menu": K + "y" + CTRL}),
        ("Ctrl + V", "режим", {"key.wands.wand_mode": K + "v" + CTRL}),
        ("Ctrl + H", "действие", {"key.wands.wand_action": K + "h" + CTRL}),
        ("Ctrl + U", "отменить", {"key.wands.wand_undo": K + "u" + CTRL}),
        ("R / X / I", "вращение / ориентация / инвертировать",
         {"key.wands.wand_rotate": K + "r", "key.wands.wand_orientation": K + "x", "key.wands.wand_invert": K + "i"}),
        ("Ctrl + Z / Ctrl + C", "добавить блок в выделение / очистить палочку",
         {"key.wands.inc_sel_block": K + "z" + CTRL, "key.wands.clear_wand": K + "c" + CTRL}),
        ("P / Ctrl + J / Ctrl + N", "палитра: режим / меню / следующая",
         {"key.wands.wand_palette_mode": K + "p", "key.wands.palette_menu": K + "j" + CTRL, "key.wands.cycle_palette": K + "n" + CTRL}),
        ("Ctrl + G / Ctrl + K", "закрепить точку / заливка круга",
         {"key.wands.pin": K + "g" + CTRL, "key.wands.wand_fill_circle": K + "k" + CTRL}),
    ]),
    ("Другое в руке", "hand:other", [
        ("R (бинокль)", "бинокль радара: навести", {"create_radar.key.binocular.use": K + "r"}, "hand:binocular"),
        ("R (посох)", "посох физики: режим поворота", {"simulated.keyinfo.rotate_mode": K + "r"}, "hand:staff"),
    ]),
    ("Верхом и за штурвалом", "ride", [
        ("Left Alt (дракон)", "дракон: атака", {"dmr.keybind.attack": K + "left.alt"}, "ride:dragon"),
        ("Left Alt (самолёт)", "самолёт: разгонные ракеты", {"key.immersive_aircraft.boost": K + "left.alt"}, "ride:plane"),
        ("Backspace (выйти)", "выйти: из самолёта, из брони NTGL, с пульта управления",
         {"key.immersive_aircraft.dismount": K + "backspace"}, "ride:plane"),
        ("", "", {"key.ntgl.leave": K + "backspace"}, "ride:armor"),
        ("", "", {"create_tweaked_controllers.keybind.controller_exit": K + "backspace"}, "ride:controller"),
        ("X (пушка)", "пушка Create: наведение / движение", {"key.createbigcannons.pitch_mode": K + "x"}, "ride:cannon"),
        ("PgUp / PgDn (TFMG)", "машина TFMG: передача выше / ниже",
         {"tfmg.keyinfo.transmission_shift_up": K + "page.up", "tfmg.keyinfo.transmission_shift_down": K + "page.down"}, "ride:tfmg"),
        ("Home / End (TFMG)", "машина TFMG: двигатель / своя кнопка",
         {"tfmg.keyinfo.engine_start": K + "home", "tfmg.keyinfo.custom_button": K + "end"}, "ride:tfmg"),
    ]),
    ("Броня и редкое — цифровой блок", "always", [
        ("Num 6 / 7 / 8 / 9", "броня Cataclysm: способность / шлем / нагрудник / ботинки",
         {"key.cataclysm.ability": K + "keypad.6", "key.cataclysm.helmet_ability": K + "keypad.7",
          "key.cataclysm.chestplate_ability": K + "keypad.8", "key.cataclysm.boots_ability": K + "keypad.9"}),
        ("Num / и Num *", "броня ProjectE: шлем / ботинки",
         {"key.projecte.helmet_toggle": K + "keypad.divide", "key.projecte.boots_toggle": K + "keypad.multiply"}),
        ("Num −", "шлем-реактор (Guardian Beam)", {"key.creategbd.beam_reactor_toggle": K + "keypad.subtract"}),
        ("Num ,", "призвать незеритового голема", {"key.golemoverhaul.netherite_golem_summon": K + "keypad.decimal"}),
        ("Num Enter", "сила ArPhEx", {"key.arphex.power_bind": K + "keypad.enter"}),
        ("Alt + T", "навигатор поездов: настройки маршрута", {"key.createrailwaysnavigator.route_overlay_options": K + "t" + ALT}),
        ("Alt + ; (Ж)", "орган: настройка MIDI", {"key.pipeorgans.midi_config": K + "semicolon" + ALT}),
    ]),
]

# Без клавиши: дублируют кнопки в окнах, крафта руками нет, или конфликтовали в личных раскладках
UNBOUND = [
    "key.saveToolbarActivator", "key.loadToolbarActivator",  # творческий режим
    "key.craftingtweaks.compress_one", "key.craftingtweaks.compress_stack", "key.craftingtweaks.compress_all",
    "key.craftingtweaks.refill_last", "key.craftingtweaks.refill_last_stack",  # верстака нет
    "gui.xaero_open_settings",  # ] — в окне рюкзака «перенести в инвентарь»; настройки — с экрана карты
    "gui.xaero_minimap_settings", "key.advancements", "key.socialInteractions", "iris.keybind.reload", "key.curios.open.desc",
    "key.kubejs.kubedex", "key.voice_chat_group", "key.hide_icons", "placebo.toggleWings", "placebo.toggleTrails",
    "key.sophisticatedbackpacks.toggle_upgrade_3", "key.sophisticatedbackpacks.toggle_upgrade_4", "key.sophisticatedbackpacks.toggle_upgrade_5",
]
# Русские названия клавиш и разделов, которые в модах остались по-английски (kubejs/assets/nightshift_keys/lang)
RU = {
    "key.ftbquests.cycle_pinned_tracker": "Трекер квестов: показать / скрыть",
    "key.projecte.curios.open_transmutation_tablet": "Открыть стол трансмутации",
    "key.ftbultimine": "Ultimine (зажать)",
    "justzoom.keybinds.keybind.zoom": "Зум",
    "gui.xaero_open_map": "Открыть карту мира",
    "gui.xaero_open_settings": "Настройки карты мира",
    "key.jetpack.toggle_active.description": "Джетпак: двигатель вкл/выкл",
    "key.jetpack.toggle_hover.description": "Джетпак: зависание вкл/выкл",
    "key.jetpack.activate_elytra.description": "Джетпак: раскрыть элитры",
    "key.wands.cycle_palette": "Следующая палитра",
    "key.wands.pin": "Закрепить точку",
    "key.wands.toggle_stair_slab": "Ступени / плиты",
    "create_radar.key.binocular.use": "Бинокль: навести",
    "create_radar.key.binocular.fire": "Бинокль: огонь по цели",
    "create_radar.key.categories.create_radar ": "Радар Create",
    "create_tweaked_controllers.keybind.controller_exit": "Встать с пульта",
    "create_tweaked_controllers.keybind.mouse_focus": "Пульт: управлять мышью",
    "create_tweaked_controllers.keybind.mouse_reset": "Пульт: курсор в центр",
    "key.projecte.helmet_toggle": "Шлем ProjectE: эффекты вкл/выкл",
    "key.projecte.boots_toggle": "Ботинки ProjectE: эффекты вкл/выкл",
    "key.creategbd.beam_reactor_toggle": "Шлем-реактор: луч",
    "key.arphex.power_bind": "Сила ArPhEx",
    "key.kubejs.kubedex": "Kubedex (справочник KubeJS)",
    "key.categories.movement.jetpack": "Джетпак (Create Jetpack)",
    "key.categories.ftbultimine": "Ultimine",
    "justzoom.keybinds.category": "Зум",
    "Xaero's World Map": "Карта мира (Xaero)",
    "Xaero's Minimap": "Мини-карта и метки (Xaero)",
    "Create: Tweaked Controllers": "Пульт управления (Tweaked Controllers)",
    "Create: The Factory Must Grow": "Машины TFMG",
    "key.createbigcannons.category": "Пушки Create",
    "key.category.creategbd.main": "Guardian Beam (шлем-реактор)",
    "category.createrailwaysnavigator.crn": "Навигатор поездов",
    "Create: Mobile Packages": "Склад с собой (Mobile Packages)",
}

# Не трогаем — как в модах (для таблицы): модификаторы Create на Alt/Ctrl/Shift, стрелки форм и сеток, окна JEI/рюкзака
KEEP = [
    ("Left Alt / Ctrl / Shift", "модификаторы Create и меню рельсов, копикатов, ручных пил — как в модах"),
    ("O / Alt + K", "шейдеры: список / вкл-выкл"),
    ("Num 0–5", "Jade: настройки, подсказки, рецепты"),
    ("[ / ] в окне рюкзака", "переложить в рюкзак / в инвентарь; колёсико — сортировка"),
    ("R / U в окнах", "JEI: рецепт / применения; P / Shift + P — закрепить / цель смены"),
]


def binds():
    out = {}
    for group, gscope, rows in SCHEME:
        for row in rows:
            show, what, b = row[:3]
            scope = row[3] if len(row) > 3 else gscope
            for name, val in b.items():
                assert name not in out, "дважды: " + name
                out[name] = (val, scope, group, show)
    for name in UNBOUND:
        assert name not in out, "и в раскладке, и без клавиши: " + name
        out[name] = (OFF, "off", "", "")
    return out


def conflicts(table, dump):
    """Совпадения: «всегда» — ни с чем (кроме окон GUI и модификаторов); «в руке» и «верхом» — только внутри своей вещи."""
    ctx = {r["name"]: r["context"] for r in dump.values()}
    eff = {}  # имя → (значение, область): раскладка, а для прочих — умолчание мода
    for name, r in dump.items():
        if name in table:
            eff[name] = (table[name][0], table[name][1])
        else:
            eff[name] = (r["default"], "other")
    by = {}
    for name, (val, scope) in eff.items():
        if val.startswith(OFF):
            continue
        by.setdefault(val, []).append((name, scope))
    bad = []
    for val, lst in by.items():
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                (a, sa), (b, sb) = lst[i], lst[j]
                ca, cb = ctx.get(a, "UNIVERSAL"), ctx.get(b, "UNIVERSAL")
                if ca == "GUI" and cb == "GUI":
                    pass  # окна: проверяем ниже только против «всегда»
                if "GUI" in (ca, cb) and "UNIVERSAL" not in (ca, cb) and ca != cb:
                    continue  # окно и мир не пересекаются
                if ca.startswith("JEI") or cb.startswith("JEI") or ca.startswith("net.p3pp3r") or cb.startswith("net.p3pp3r"):
                    continue  # свои окна JEI и рюкзака
                if "mod" in (sa, sb):
                    continue
                if "always" not in (sa, sb):
                    # обе не «всегда»: совпадать нельзя только внутри одной вещи / одного транспорта
                    if sa == sb and sa != "other":
                        bad.append((val, a, sa, b, sb))
                    continue
                if sa == "other" and sb == "other":
                    continue
                bad.append((val, a, sa, b, sb))
    return bad


def main():
    dumps = sys.argv[1:] or sorted(glob.glob(os.path.expanduser("~/projects/ns-patches/keys-dump-*.tsv")))
    dump = {r["name"]: r for r in csv.DictReader(open(dumps[-1], encoding="utf-8"), delimiter="\t")}
    table = binds()
    missing = [n for n in table if n not in dump]
    if missing:
        print("НЕТ В ИГРЕ:", missing)
    bad = conflicts(table, dump)
    # известные совпадения «как в модах»: Left Alt и Shift — модификаторы многих модов; стрелки — формы/сетки
    allowed = {K + "left.alt", K + "left.shift", K + "left.control", K + "up", K + "down", K + "left", K + "right",
               K + "space", "key.mouse.left", "key.mouse.right", "key.mouse.middle", K + "w", K + "tab", K + "grave.accent"}
    real = [b for b in bad if b[0] not in allowed]
    for v, a, sa, b, sb in real:
        print("СОВПАДЕНИЕ %-28s %s [%s]  ↔  %s [%s]" % (v, a, sa, b, sb))

    # 1) аддон
    keys = {n: v[0] for n, v in table.items()}
    (ROOT / "config/axiomativ").mkdir(parents=True, exist_ok=True)
    (ROOT / "config/axiomativ/keys.json").write_text(json.dumps({
        "_": "Раскладка смены — генерируется tools/keys_scheme.py (не править руками). Аддон Axiomativ ставит её всем "
             "один раз на версию; «Сброс» в «Управлении» возвращает к ней.",
        "version": VERSION, "keys": keys}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # 2) Default Options — те же умолчания (для новых установок до первого запуска аддона)
    (ROOT / "config/defaultoptions/keybindings.txt").write_text(
        "".join("key_%s:%s\n" % (n, v) for n, v in sorted(keys.items())), encoding="utf-8")
    # 3) /smena keys
    merged = [[group, [[r[0], r[1]] for r in rows if r[0]]] for group, _, rows in SCHEME]
    merged.append(["Как в модах", [list(x) for x in KEEP]])
    js = ("// Генерирует tools/keys_scheme.py из раскладки смены (07.10.2026) — не править руками.\n"
          "// /smena keys показывает эти строки; сама раскладка ставится у всех аддоном (config/axiomativ/keys.json).\n"
          "var NS_KEYS_VERSION = %d\nvar NS_KEYS_GROUPS = %s\n" % (VERSION, json.dumps(merged, ensure_ascii=False, indent=1)))
    (ROOT / "kubejs/server_scripts/hud/31_keys.js").write_text(js, encoding="utf-8")
    # 4) русские названия клавиш
    (ROOT / "kubejs/assets/nightshift_keys/lang").mkdir(parents=True, exist_ok=True)
    (ROOT / "kubejs/assets/nightshift_keys/lang/ru_ru.json").write_text(json.dumps(RU, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # 5) таблица
    md = ["# Раскладка смены v%d" % VERSION, "",
          "Одна на всех: аддон ставит её каждому один раз на версию (строка в чате при входе), «Сброс» в «Управлении» "
          "возвращает к ней, `/nskeys apply` — поставить заново, `/smena keys` — список в игре. Источник — "
          "`tools/keys_scheme.py`.", "",
          "Правила: **всегда** — у каждого действия своя клавиша; **в руке** — у разных вещей клавиши могут совпадать "
          "(в руке одна вещь); у палочек занятые буквы — с Ctrl; **Backspace — выйти** (самолёт, броня, пульт); "
          "редкое — цифровой блок.", ""]
    for g, rows in merged:
        md += ["## " + g, "", "| Клавиша | Что делает |", "|---|---|"]
        md += ["| %s | %s |" % (s.replace("|", "\\|"), w) for s, w in rows] + [""]
    md += ["Без клавиши (есть кнопки в окнах или не нужно на вахте): " + ", ".join("`%s`" % n for n in UNBOUND), ""]
    (ROOT / "docs/KEYS.md").write_text("\n".join(md), encoding="utf-8")
    print("клавиш в раскладке: %d (без клавиши %d), совпадений: %d" % (len(table) - len(UNBOUND), len(UNBOUND), len(real)))
    return 1 if (real or missing) else 0


if __name__ == "__main__":
    sys.exit(main())
