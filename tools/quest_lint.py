#!/usr/bin/env python3
"""Проверка раскладки квест-бука без игры (30.09): «месиво» и оторванные ветки.

Использование: quest_lint.py [ключ_главы ...]
Для каждой главы: одиночки и отдельные куски (глава должна быть одним деревом — Георгий: «ветки не зависимы
друг от друга»), карточки внахлёст, линии сквозь чужие карточки, пересечения линий.
Координаты — как в gen_quests.py ("pos" или авто-раскладка); размер карточки 1.0, цель 1.6, "size" — свой.
Код выхода 1, если есть одиночки, куски, налезания или линии сквозь карточки.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_quests as G  # noqa: E402


def seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    cx, cy = ax + t * dx, ay + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def cross(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    if a in (c, d) or b in (c, d):
        return False
    return o(a, b, c) * o(a, b, d) < 0 and o(c, d, a) * o(c, d, b) < 0


def lint(ch):
    qs = ch["quests"]
    auto = G.layout([dict(q, deps=[d for d in q.get("deps", []) if ":" not in d]) for q in qs])
    pos = {q["key"]: tuple(q["pos"]) if "pos" in q else auto[q["key"]] for q in qs}
    size = {q["key"]: float(q.get("size", 1.6 if q.get("goal") else 1.0)) for q in qs}
    keys = set(pos)
    edges = [(d, q["key"]) for q in qs for d in q.get("deps", []) if d in keys and not q.get("hide_lines")]
    # связность — только по ВИДИМЫМ линиям: скрытая линия (hide_lines) в игре выглядит как оторванная ветка
    par = {k: k for k in keys}

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for a, b in edges:
        par[f(a)] = f(b)
    comps = {}
    for k in keys:
        comps.setdefault(f(k), []).append(k)
    problems = []
    if len(comps) > 1:
        parts = sorted(comps.values(), key=len)
        problems.append(f"кусков {len(comps)}: " + "; ".join(",".join(sorted(p)[:4]) + ("…" if len(p) > 4 else "") for p in parts[:-1]))
    hidden = [q["key"] for q in qs if q.get("hide_lines") and [d for d in q.get("deps", []) if d in keys]]
    if hidden:
        problems.append("скрытые линии: " + ", ".join(hidden))
    ks = sorted(keys)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            if max(abs(pos[a][0] - pos[b][0]), abs(pos[a][1] - pos[b][1])) < (size[a] + size[b]) / 2 + 0.2:
                problems.append(f"внахлёст: {a} / {b}")
    for a, b in edges:
        for k in keys - {a, b}:
            if seg_dist(pos[k], pos[a], pos[b]) < size[k] / 2 + 0.12:
                problems.append(f"линия {a}→{b} через {k}")
    crosses = sum(1 for i, e in enumerate(edges) for g in edges[i + 1:] if cross(pos[e[0]], pos[e[1]], pos[g[0]], pos[g[1]]))
    return problems, crosses


def main():
    only = set(sys.argv[1:])
    bad = False
    for ch in G.load_specs():
        if only and ch["key"] not in only:
            continue
        problems, crosses = lint(ch)
        mark = "OK " if not problems else "!! "
        print(f"{mark}{ch['key']:24} пересечений линий: {crosses}")
        for p in problems:
            print("     " + p)
        bad = bad or bool(problems)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
