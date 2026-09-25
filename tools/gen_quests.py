#!/usr/bin/env python3
"""Генератор квестовой книги FTB Quests 2101 (MC 1.21.1) для «Create: Ночная смена».

Вход: спецификации глав (JSON) из tools/quests/*.json:
  {"chapters":[{"key","title","icon","subtitle","quests":[
     {"key","type":"item"|"checkmark","item","count","title","desc":[...],"deps":[...],"goal"}]}]}
Выход: config/ftbquests/quests/ — data.snbt, chapter_groups.snbt, chapters/*.snbt,
lang/ru_ru.snbt и lang/en_us.snbt (тексты русские в обоих, чтобы язык клиента не мешал).

Каждый предмет перепроверяется по jar-файлам (assets/<ns>/models/item/<path>.json,
включая вложенные jar-in-jar и ванильный клиент) — иначе в книге будет «Missing Item».
id квестов детерминированные (md5 ключа), повторная генерация не ломает прогресс игроков.
"""
import hashlib
import io
import json
import pathlib
import re
import sys
import zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
SPEC_DIR = PACK / "tools" / "quests"
OUT = PACK / "config" / "ftbquests" / "quests"
MODS = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/instances/CreateNightshift/.minecraft/mods"
VANILLA = pathlib.Path.home() / ".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar"

# Порядок глав в книге
ORDER = ["welcome", "create_basics", "ore_processing", "brass_logistics_trains",
         "first_plane", "airships_cars", "submarines",
         "steel_oil", "fuel_engines", "electricity",
         "space", "big_cannons", "automation_extras", "night_shift"]

ITEM_RE = re.compile(r"^assets/([^/]+)/models/item/(.+)\.json$")


def scan_zip(zf, items):
    for name in zf.namelist():
        m = ITEM_RE.match(name)
        if m:
            items.add(f"{m.group(1)}:{m.group(2)}")
        elif name.startswith("META-INF/jarjar/") and name.endswith(".jar"):
            with zipfile.ZipFile(io.BytesIO(zf.read(name))) as inner:
                scan_zip(inner, items)


def known_items():
    items = set()
    for jar in list(MODS.glob("*.jar")) + [VANILLA]:
        with zipfile.ZipFile(jar) as zf:
            scan_zip(zf, items)
    return items


def qid(*parts):
    return hashlib.md5(":".join(parts).encode()).hexdigest()[:16].upper()


def snbt_str(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def load_specs():
    chapters = {}
    for f in sorted(SPEC_DIR.glob("*.json")):
        for ch in json.loads(f.read_text())["chapters"]:
            if ch["key"] in chapters:
                # дополнение главы из другого файла (например, квест про команду)
                chapters[ch["key"]]["quests"].extend(ch["quests"])
            else:
                chapters[ch["key"]] = ch
    return [chapters[k] for k in ORDER if k in chapters] + \
           [c for k, c in chapters.items() if k not in ORDER]


def layout(quests):
    """Раскладка по уровням: x — глубина в дереве, y — по среднему y родителей."""
    by_key = {q["key"]: q for q in quests}
    depth = {}

    def d(k, seen=()):
        if k in depth:
            return depth[k]
        if k in seen:
            raise SystemExit(f"цикл зависимостей на {k}")
        deps = [x for x in by_key[k].get("deps", []) if x in by_key]
        depth[k] = 0 if not deps else 1 + max(d(x, seen + (k,)) for x in deps)
        return depth[k]

    for q in quests:
        d(q["key"])

    # Sugiyama-lite: длинные связи режем невидимыми узлами, чтобы они занимали
    # место в промежуточных колонках и линии не проходили сквозь карточки.
    size = {q["key"]: (1.6 if q.get("goal") else 1.0) for q in quests}
    level = dict(depth)
    pred = {k: [] for k in by_key}
    succ = {k: [] for k in by_key}
    for q in quests:
        for p in q.get("deps", []):
            if p not in by_key:
                continue
            prev = p
            for lv in range(depth[p] + 1, depth[q["key"]]):
                dummy = f"~{p}>{q['key']}@{lv}"
                level[dummy], size[dummy] = lv, 0.9
                pred[dummy], succ[dummy] = [], []
                succ[prev].append(dummy); pred[dummy].append(prev)
                prev = dummy
            succ[prev].append(q["key"]); pred[q["key"]].append(prev)
    levels = {}
    for k in level:
        levels.setdefault(level[k], []).append(k)
    top = max(levels)

    def reorder(lv, nbrs, ref):
        idx = {k: i for i, k in enumerate(levels[ref])}
        cur = {k: i for i, k in enumerate(levels[lv])}
        def bary(k):
            ns = [idx[n] for n in nbrs[k] if n in idx]
            return sum(ns) / len(ns) if ns else cur[k]
        levels[lv].sort(key=lambda k: (bary(k), cur[k]))

    for _ in range(8):  # проходы вниз и вверх уменьшают пересечения
        for lv in range(1, top + 1):
            reorder(lv, pred, lv - 1)
        for lv in range(top - 1, -1, -1):
            reorder(lv, succ, lv + 1)

    GAP = 0.6
    y = {}

    def place(lv, desired):
        # ставим узлы по порядку, как можно ближе к желаемому y, не ближе GAP
        row = levels[lv]
        out, last = [], None
        for k in row:
            want = desired.get(k, 0.0)
            if last is not None:
                want = max(want, out[-1] + (size[last] + size[k]) / 2 + GAP)
            out.append(want)
            last = k
        shift = sum(o - desired.get(k, o) for o, k in zip(out, row)) / len(row)
        for o, k in zip(out, row):
            y[k] = o - shift

    first = levels[0]
    total = sum(size[k] for k in first) + GAP * (len(first) - 1)
    acc = -total / 2
    for k in first:
        y[k] = acc + size[k] / 2
        acc += size[k] + GAP
    for lv in range(1, top + 1):
        desired = {}
        for k in levels[lv]:
            ps = [y[p] for p in pred[k] if p in y]
            desired[k] = sum(ps) / len(ps) if ps else 0.0
        place(lv, desired)
    # финальный проход: если прямая линия связи режет чужую карточку,
    # отодвигаем карточку (и соседей по колонке за ней) от линии
    X = {k: level[k] * 2.2 for k in by_key}
    edges = [(p, q["key"]) for q in quests for p in q.get("deps", []) if p in by_key]
    for _ in range(40):
        moved = False
        for a, b in edges:
            for k in by_key:
                if k in (a, b) or not (X[a] < X[k] < X[b]):
                    continue
                t = (X[k] - X[a]) / (X[b] - X[a])
                line_y = y[a] + t * (y[b] - y[a])
                need = size[k] / 2 + 0.35
                if abs(y[k] - line_y) < need:
                    delta = (line_y + need - y[k]) if y[k] >= line_y else (line_y - need - y[k])
                    col = [n for n in by_key if level[n] == level[k]]
                    for n in col:
                        if (delta > 0 and y[n] >= y[k]) or (delta < 0 and y[n] <= y[k]):
                            y[n] += delta
                    moved = True
        if not moved:
            break
    return {k: (X[k], y[k]) for k in by_key}


def main():
    items = known_items()
    specs = load_specs()
    errors = []
    lang = {"file.0000000000000001.title": "Create: Ночная смена"}
    chapter_dir = OUT / "chapters"
    chapter_dir.mkdir(parents=True, exist_ok=True)
    for old in chapter_dir.glob("*.snbt"):
        old.unlink()

    total = 0
    for order, ch in enumerate(specs):
        ck = ch["key"]
        cid = qid("chapter", ck)
        if ch["icon"] not in items:
            errors.append(f"{ck}: иконка главы {ch['icon']} не найдена")
        lang[f"chapter.{cid}.title"] = ch["title"]
        if ch.get("subtitle"):
            lang[f"chapter.{cid}.chapter_subtitle"] = [ch["subtitle"]]
        keys = {q["key"] for q in ch["quests"]}
        pos = layout(ch["quests"])
        out_quests = []
        for q in ch["quests"]:
            k = q["key"]
            if q["item"] not in items:
                errors.append(f"{ck}/{k}: предмет {q['item']} не найден")
            for dep in q.get("deps", []):
                if dep not in keys:
                    errors.append(f"{ck}/{k}: зависимость {dep} не найдена")
            quest_id = qid(ck, k)
            task_id = qid(ck, k, "task")
            goal = q.get("goal", False)
            x, y = pos[k]
            lines = ["\t\t{"]
            deps = [qid(ck, dep) for dep in q.get("deps", []) if dep in keys]
            if deps:
                lines.append("\t\t\tdependencies: [" + ", ".join(snbt_str(x) for x in deps) + "]")
            if q["type"] == "checkmark":
                lines.append("\t\t\ticon: { id: " + snbt_str(q["item"]) + " }")
            lines.append(f"\t\t\tid: {snbt_str(quest_id)}")
            lines.append("\t\t\trewards: [{ id: " + snbt_str(qid(ck, k, "reward")) +
                         f", type: \"xp\", xp: {50 if goal else 10} }}]")
            lines.append("\t\t\tshape: " + snbt_str("hexagon" if goal else "rsquare"))
            lines.append(f"\t\t\tsize: {1.6 if goal else 1.0}d")
            if q["type"] == "checkmark":
                lines.append("\t\t\ttasks: [{ id: " + snbt_str(task_id) + ', type: "checkmark" }]')
            else:
                cnt = int(q.get("count", 1))
                extra = f", count: {cnt}L" if cnt > 1 else ""
                lines.append("\t\t\ttasks: [{ id: " + snbt_str(task_id) + extra +
                             ", item: { count: 1, id: " + snbt_str(q["item"]) + ' }, type: "item" }]')
            lines.append(f"\t\t\tx: {x:.2f}d")
            lines.append(f"\t\t\ty: {y:.2f}d")
            lines.append("\t\t}")
            out_quests.append("\n".join(lines))
            lang[f"quest.{quest_id}.title"] = q["title"]
            if q.get("desc"):
                lang[f"quest.{quest_id}.quest_desc"] = q["desc"]
            total += 1
        body = "\n".join([
            "{",
            "\tdefault_hide_dependency_lines: false",
            '\tdefault_quest_shape: ""',
            f"\tfilename: {snbt_str(ck)}",
            '\tgroup: ""',
            "\ticon: { id: " + snbt_str(ch["icon"]) + " }",
            f"\tid: {snbt_str(cid)}",
            "\timages: [ ]",
            f"\torder_index: {order}",
            "\tquest_links: [ ]",
            "\tquests: [",
            "\n".join(out_quests),
            "\t]",
            "}",
        ])
        (chapter_dir / f"{ck}.snbt").write_text(body + "\n")

    (OUT / "chapter_groups.snbt").write_text("{\n\tchapter_groups: [ ]\n}\n")
    (OUT / "data.snbt").write_text("""{
\tdefault_autoclaim_rewards: "disabled"
\tdefault_consume_items: false
\tdefault_quest_disable_jei: false
\tdefault_quest_shape: "rsquare"
\tdefault_reward_team: false
\tdetection_delay: 20
\tdisable_gui: false
\tdrop_book_on_death: false
\tdrop_loot_crates: false
\temergency_items_cooldown: 300
\tfallback_locale: "en_us"
\tgrid_scale: 0.5d
\thide_excluded_quests: false
\ticon: { id: "create:goggles" }
\tlock_message: ""
\tloot_crate_no_drop: { boss: 0, monster: 600, passive: 4000 }
\tpause_game: false
\tprogression_mode: "flexible"
\tshow_lock_icons: false
\tverify_on_load: false
\tversion: 13
}
""")
    lang_dir = OUT / "lang"
    lang_dir.mkdir(exist_ok=True)
    rows = []
    for key in sorted(lang):
        v = lang[key]
        if isinstance(v, list):
            if len(v) == 1:
                rows.append(f"\t{key}: [{snbt_str(v[0])}]")
            else:
                rows.append(f"\t{key}: [\n" + "\n".join(f"\t\t{snbt_str(x)}" for x in v) + "\n\t]")
        else:
            rows.append(f"\t{key}: {snbt_str(v)}")
    text = "{\n" + "\n".join(rows) + "\n}\n"
    for loc in ("ru_ru", "en_us"):
        (lang_dir / f"{loc}.snbt").write_text(text)

    print(f"глав: {len(specs)}, квестов: {total}, предметов в индексе: {len(items)}")
    if errors:
        print("ОШИБКИ:")
        for e in errors:
            print("  " + e)
        sys.exit(1)


if __name__ == "__main__":
    main()
