#!/usr/bin/env python3
"""Превью раскладки глав FTB Quests: рисует узлы и линии зависимостей так,
как их расставил генератор, и ищет наложения карточек.
Картинки — в dist/quest-preview/<глава>.png."""
import json
import math
import pathlib
import re

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

PACK = pathlib.Path(__file__).resolve().parent.parent
Q = PACK / "config" / "ftbquests" / "quests"
OUT = PACK / "dist" / "quest-preview"
OUT.mkdir(parents=True, exist_ok=True)

lang_text = (Q / "lang" / "ru_ru.snbt").read_text()
titles = dict(re.findall(r'^\t(quest\.[0-9A-F]{16}\.title|chapter\.[0-9A-F]{16}\.title): "(.*)"$', lang_text, re.M))

problems = []
for f in sorted((Q / "chapters").glob("*.snbt")):
    t = f.read_text()
    cid = re.search(r'^\tid: "([0-9A-F]{16})"', t, re.M).group(1)
    quests = []
    for block in re.findall(r"\t\t\{\n(.*?)\n\t\t\}", t, re.S):
        qid = re.search(r'\tid: "([0-9A-F]{16})"', block).group(1)
        deps = re.findall(r'"([0-9A-F]{16})"', (re.search(r"dependencies: \[(.*?)\]", block) or [None, ""])[1] if re.search(r"dependencies: \[(.*?)\]", block) else "")
        x = float(re.search(r"\tx: (-?[\d.]+)d", block).group(1))
        y = float(re.search(r"\ty: (-?[\d.]+)d", block).group(1))
        size = float(re.search(r"\tsize: ([\d.]+)d", block).group(1))
        quests.append((qid, x, y, size, deps))
    pos = {q[0]: q for q in quests}
    # наложения: расстояние между центрами меньше суммы полуразмеров + зазор
    for i, a in enumerate(quests):
        for b in quests[i + 1:]:
            if math.hypot(a[1] - b[1], a[2] - b[2]) < (a[3] + b[3]) / 2 + 0.25:
                problems.append(f"{f.stem}: наложение «{titles.get('quest.'+a[0]+'.title')}» и «{titles.get('quest.'+b[0]+'.title')}»")
    # линии, проходящие сквозь чужие карточки
    def seg_dist(px, py, ax_, ay, bx, by):
        dx, dy = bx - ax_, by - ay
        L = dx * dx + dy * dy
        t = max(0, min(1, ((px - ax_) * dx + (py - ay) * dy) / L)) if L else 0
        return math.hypot(px - (ax_ + t * dx), py - (ay + t * dy))
    for qid, x, y, size, deps in quests:
        for dpid in deps:
            if dpid not in pos:
                continue
            _, x0, y0, _, _ = pos[dpid]
            for oid, ox, oy, osz, _ in quests:
                if oid in (qid, dpid):
                    continue
                if seg_dist(ox, oy, x0, y0, x, y) < osz / 2:
                    problems.append(f"{f.stem}: линия «{titles.get('quest.'+dpid+'.title')}» → «{titles.get('quest.'+qid+'.title')}» режет «{titles.get('quest.'+oid+'.title')}»")
    fig, ax = plt.subplots(figsize=(14, 8))
    ax.set_facecolor("#1e1e24")
    for qid, x, y, size, deps in quests:
        for d in deps:
            if d in pos:
                ax.plot([pos[d][1], x], [-pos[d][2], -y], color="#8a8aa0", lw=1, zorder=1)
    for qid, x, y, size, deps in quests:
        ax.add_patch(plt.Rectangle((x - size / 2, -y - size / 2), size, size,
                                   color="#e0a030" if size > 1 else "#5a8fd0", zorder=2))
        ax.text(x, -y - size / 2 - 0.12, titles.get(f"quest.{qid}.title", "?")[:22],
                ha="center", va="top", fontsize=7, color="white", zorder=3)
    xs = [q[1] for q in quests]; ys = [-q[2] for q in quests]
    ax.set_xlim(min(xs) - 1.5, max(xs) + 1.5); ax.set_ylim(min(ys) - 1.5, max(ys) + 1.2)
    ax.set_aspect("equal"); ax.axis("off")
    ax.set_title(titles.get(f"chapter.{cid}.title", f.stem), color="white")
    fig.patch.set_facecolor("#1e1e24")
    fig.savefig(OUT / f"{f.stem}.png", dpi=90, bbox_inches="tight")
    plt.close(fig)

print(f"превью: {OUT}")
print("\n".join(problems) if problems else "наложений нет")
