#!/usr/bin/env python3
"""Превью раскладки глав квест-бука картинкой — без игры (30.09).

Использование: quest_preview.py <папка для png> [ключ_главы ...]
Рисует карточки квестов на тех же координатах, что и tools/gen_quests.py (авто-раскладка или "pos"),
линии зависимостей внутри главы, короткие названия. Цвет: золото — цель (goal), серый — галочка/справка,
пунктир — optional, голубой — остальное. Сетка = 1 клетка FTB. Смотреть: пересекаются ли линии, не налезают ли
карточки, читается ли путь слева направо.
"""
import pathlib
import re
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_quests as G  # noqa: E402

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
CELL = 64  # пикселей на клетку


def clean(t):
    return re.sub(r"&[0-9a-fk-or]", "", t)


def render(ch, out):
    quests = ch["quests"]
    auto = G.layout([dict(q, deps=[d for d in q.get("deps", []) if ":" not in d]) for q in quests])
    pos = {q["key"]: tuple(q["pos"]) if "pos" in q else auto[q["key"]] for q in quests}
    size = {q["key"]: float(q.get("size", 1.6 if q.get("goal") else 1.0)) for q in quests}
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    pad = 2.5
    x0, y0 = min(xs) - pad, min(ys) - pad
    w = int((max(xs) - min(xs) + 2 * pad) * CELL)
    h = int((max(ys) - min(ys) + 2 * pad) * CELL) + 40
    img = Image.new("RGB", (max(w, 400), h), (40, 44, 52))
    dr = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 11)
    ft = ImageFont.truetype(FONT, 16)
    dr.text((10, 8), f"{clean(ch['title'])} — {len(quests)} квестов", font=ft, fill=(230, 230, 230))

    def px(p):
        return ((p[0] - x0) * CELL, (p[1] - y0) * CELL + 40)

    for gx in range(int(max(w, 400) / CELL) + 1):
        dr.line([(gx * CELL, 40), (gx * CELL, h)], fill=(48, 52, 60))
    keys = {q["key"] for q in quests}
    for q in quests:
        if q.get("hide_lines"):
            continue
        for d in q.get("deps", []):
            if d in keys:
                dr.line([px(pos[d]), px(pos[q["key"]])], fill=(170, 120, 120), width=2)
    for q in quests:
        cx, cy = px(pos[q["key"]])
        r = size[q["key"]] * CELL / 2 * 0.8
        if q.get("goal"):
            col = (200, 160, 40)
        elif q.get("type") == "checkmark":
            col = (120, 120, 130)
        else:
            col = (70, 130, 170)
        box = [cx - r, cy - r, cx + r, cy + r]
        dr.rectangle(box, fill=col, outline=(20, 20, 20), width=2)
        if q.get("optional"):
            dr.rectangle(box, outline=(240, 240, 240), width=1)
        title = clean(q["title"])
        lines, cur = [], ""
        for word in title.split():
            if len(cur) + len(word) > 16:
                lines.append(cur)
                cur = word
            else:
                cur = (cur + " " + word).strip()
        lines.append(cur)
        for i, ln in enumerate(lines[:3]):
            dr.text((cx - r, cy + r + 2 + i * 12), ln, font=f, fill=(220, 220, 220))
    path = out / f"{ch['key']}.png"
    img.save(path)
    return path


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    for ch in G.load_specs():
        if only and ch["key"] not in only:
            continue
        print(render(ch, out))


if __name__ == "__main__":
    main()
