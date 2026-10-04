#!/usr/bin/env python3
"""Небо «Ночной смены» (04.10.2026): текстуры метеорита и небесных островов + шаблоны островов (NBT).

Запуск: python3 tools/gen_sky.py  (нужен Pillow; ванильный клиент и Create берутся из кэша tools/planet_jars.py)

Выход:
  kubejs/assets/nightshift/textures/block/meteor_ore.png          — раскалённая метеоритная руда
  kubejs/assets/nightshift/textures/block/sky_crystal_cluster.png — друза небесного кристалла
  kubejs/assets/nightshift/textures/item/crushed_meteor_iron.png   — дроблёное метеоритное железо
  kubejs/data/nightshift/structure/sky/<вид>_<n>.nbt               — шаблоны островов (структура nightshift:sky_island)
  kubejs/data/nightshift/loot_table/chests/sky_*.json              — добыча сундуков и бочек островов

Острова строятся процедурно (без ручной стройки в игре): «перевёрнутый конус» из камня под слоем земли и травы,
снизу — сталактиты и корни, на нём одна из трёх построек:
  station — руины станции Axiomativ (стены из корпусов Create, мачта антенны, вывеска, турель-шалкер);
  airship — разбитый дирижабль (корпус из ели воткнулся в остров, рваная оболочка из шерсти, груз);
  nest    — гнездо стрекоз (кольцо из сена, корней и мха, яйца, паутина).
В каждом шаблоне — маркер (сущность minecraft:marker с тегами ns_sky_island и ns_isl_<вид>): по нему скрипт
kubejs/server_scripts/sky/20_sky_islands.js находит остров, когда игрок подлетает, и выпускает летунов.
Сундуки и бочки — с таблицами добычи nightshift:chests/sky_<вид>; друзы небесного кристалла — блоки
nightshift:sky_crystal_cluster (ломаются киркой, дают небесный кристалл).
Повторный запуск даёт те же файлы (фиксированные зёрна).
"""
import gzip
import io
import json
import math
import pathlib
import random
import struct
import zipfile

from PIL import Image

PACK = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path.home() / ".cache" / "nightshift-jars"
TEX_BLOCK = PACK / "kubejs/assets/nightshift/textures/block"
TEX_ITEM = PACK / "kubejs/assets/nightshift/textures/item"
STRUCT_OUT = PACK / "kubejs/data/nightshift/structure/sky"
DATA_VERSION = 3955  # Minecraft 1.21.1


# ---------------------------------------------------------------------------
# Текстуры — перекраска ванильных/Create (как tools/gen_wave_items.py)
# ---------------------------------------------------------------------------
def jar(name):
    from planet_jars import mod_jar, vanilla_jar  # качает в кэш, если файла ещё нет
    return vanilla_jar() if name == "minecraft" else mod_jar(name)


def load_png(zf, path):
    return Image.open(io.BytesIO(zf.read(path))).convert("RGBA")


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


def recolor(img, base, high=None, cut=1.0):
    base = [hexrgb(c) for c in base]
    high = [hexrgb(c) for c in high] if high else None
    px = [(x, y) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0]
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    ls = [lum(img.getpixel(p)) for p in px]
    lo, hi = min(ls), max(ls)
    out = img.copy()
    for p, l in zip(px, ls):
        t = (l - lo) / (hi - lo or 1)
        c = ramp(base, t / cut) if (high is None or t < cut) else ramp(high, (t - cut) / (1 - cut or 1))
        out.putpixel(p, c + (img.getpixel(p)[3],))
    return out


def textures():
    van = jar("minecraft")
    TEX_BLOCK.mkdir(parents=True, exist_ok=True)
    TEX_ITEM.mkdir(parents=True, exist_ok=True)
    # Метеоритная руда: тёмная оплавленная порода (глубинный сланец), «рудные» пиксели — раскалённые
    # (оранжевое ядро и голубой металлический отблеск, как у сырого метеоритного железа)
    src = load_png(van, "assets/minecraft/textures/block/deepslate_iron_ore.png")
    out = src.copy()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src.getpixel((x, y))
            sat = max(r, g, b) - min(r, g, b)
            l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            if sat > 28:  # вкрапления руды
                c = ramp([hexrgb("#7a1d05"), hexrgb("#ff6a14"), hexrgb("#ffd27a")], l * 1.6)
                if (x * 7 + y * 3) % 11 == 0:
                    c = hexrgb("#9fe8ff")
            else:
                c = ramp([hexrgb("#0d0a10"), hexrgb("#241a29"), hexrgb("#43354a")], l * 1.4)
            out.putpixel((x, y), c + (a,))
    out.save(TEX_BLOCK / "meteor_ore.png")
    # Друза небесного кристалла — аметистовый блок в цветах небесного кристалла
    recolor(load_png(van, "assets/minecraft/textures/block/amethyst_block.png"),
            ["#062236", "#1479a8", "#5fd4ff"], ["#dff8ff", "#ffffff"], 0.72).save(TEX_BLOCK / "sky_crystal_cluster.png")
    # Дроблёное метеоритное железо — дроблёное сырое железо Create в цветах метеоритного железа
    cr = jar("create")
    recolor(load_png(cr, "assets/create/textures/item/crushed_raw_iron.png"),
            ["#14121c", "#3b3552", "#6f6a8f"], ["#9fe8ff", "#e6fbff"], 0.8).save(TEX_ITEM / "crushed_meteor_iron.png")
    print("текстуры неба готовы")


# ---------------------------------------------------------------------------
# NBT: минимальный кодировщик (gzip, big-endian), только нужные типы
# ---------------------------------------------------------------------------
class Byte(int):
    pass


class Int(int):
    pass


class Double(float):
    pass


class NList:
    def __init__(self, tag, items):
        self.tag, self.items = tag, items


TAG_BYTE, TAG_INT, TAG_DOUBLE, TAG_STRING, TAG_LIST, TAG_COMPOUND = 1, 3, 6, 8, 9, 10


def tag_of(v):
    if isinstance(v, Byte):
        return TAG_BYTE
    if isinstance(v, (Int, int)) and not isinstance(v, bool):
        return TAG_INT
    if isinstance(v, (Double, float)):
        return TAG_DOUBLE
    if isinstance(v, str):
        return TAG_STRING
    if isinstance(v, NList):
        return TAG_LIST
    if isinstance(v, dict):
        return TAG_COMPOUND
    raise TypeError(type(v))


def w_str(out, s):
    b = s.encode("utf-8")
    out.write(struct.pack(">H", len(b)))
    out.write(b)


def w_payload(out, t, v):
    if t == TAG_BYTE:
        out.write(struct.pack(">b", v))
    elif t == TAG_INT:
        out.write(struct.pack(">i", v))
    elif t == TAG_DOUBLE:
        out.write(struct.pack(">d", v))
    elif t == TAG_STRING:
        w_str(out, v)
    elif t == TAG_LIST:
        out.write(struct.pack(">bi", v.tag if v.items else 0, len(v.items)))
        for it in v.items:
            w_payload(out, v.tag, it)
    elif t == TAG_COMPOUND:
        for k, x in v.items():
            tt = tag_of(x)
            out.write(struct.pack(">b", tt))
            w_str(out, k)
            w_payload(out, tt, x)
        out.write(b"\x00")


def write_nbt(path, root):
    buf = io.BytesIO()
    buf.write(struct.pack(">b", TAG_COMPOUND))
    w_str(buf, "")
    w_payload(buf, TAG_COMPOUND, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    # mtime=0 — одинаковый файл при повторном запуске
    with open(path, "wb") as f, gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:
        gz.write(buf.getvalue())


# ---------------------------------------------------------------------------
# Постройка шаблона
# ---------------------------------------------------------------------------
def S(name, **props):
    """Состояние блока: ('minecraft:stone', (('axis','y'),))"""
    if ":" not in name:
        name = "minecraft:" + name
    return (name, tuple(sorted((k, str(v).lower()) for k, v in props.items())))


class Build:
    def __init__(self):
        self.blocks = {}  # (x,y,z) -> state
        self.nbt = {}  # (x,y,z) -> nbt блок-сущности
        self.entities = []  # (x,y,z, nbt)

    def put(self, x, y, z, st, nbt=None):
        self.blocks[(x, y, z)] = st
        if nbt is not None:
            self.nbt[(x, y, z)] = nbt
        else:
            self.nbt.pop((x, y, z), None)

    def clear(self, x, y, z):
        self.blocks.pop((x, y, z), None)
        self.nbt.pop((x, y, z), None)

    def get(self, x, y, z):
        return self.blocks.get((x, y, z))

    def save(self, path):
        xs = [p[0] for p in self.blocks]
        ys = [p[1] for p in self.blocks]
        zs = [p[2] for p in self.blocks]
        mx, my, mz = min(xs), min(ys), min(zs)
        size = [max(xs) - mx + 1, max(ys) - my + 1, max(zs) - mz + 1]
        palette, index = [], {}
        blocks = []
        for (x, y, z), st in sorted(self.blocks.items(), key=lambda kv: (kv[0][1], kv[0][2], kv[0][0])):
            if st not in index:
                index[st] = len(palette)
                entry = {"Name": st[0]}
                if st[1]:
                    entry["Properties"] = dict(st[1])
                palette.append(entry)
            b = {"pos": NList(TAG_INT, [Int(x - mx), Int(y - my), Int(z - mz)]), "state": Int(index[st])}
            if (x, y, z) in self.nbt:
                b["nbt"] = self.nbt[(x, y, z)]
            blocks.append(b)
        ents = []
        for (x, y, z, enbt) in self.entities:
            ents.append({
                "pos": NList(TAG_DOUBLE, [Double(x - mx + 0.5), Double(y - my), Double(z - mz + 0.5)]),
                "blockPos": NList(TAG_INT, [Int(x - mx), Int(y - my), Int(z - mz)]),
                "nbt": enbt,
            })
        root = {
            "DataVersion": Int(DATA_VERSION),
            "size": NList(TAG_INT, [Int(v) for v in size]),
            "palette": NList(TAG_COMPOUND, palette),
            "blocks": NList(TAG_COMPOUND, blocks),
            "entities": NList(TAG_COMPOUND, ents),
        }
        write_nbt(path, root)
        return size, len(blocks), len(ents)


class Noise2:
    """Гладкий value-noise на решётке (детерминирован зерном)."""

    def __init__(self, seed, scale):
        self.seed, self.scale = seed, scale

    def lat(self, i, j):
        return random.Random(hash((self.seed, i, j)) & 0xFFFFFFFF).random()

    def __call__(self, x, z):
        fx, fz = x / self.scale, z / self.scale
        i, j = math.floor(fx), math.floor(fz)
        tx, tz = fx - i, fz - j
        sx, sz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
        a, b, c, d = self.lat(i, j), self.lat(i + 1, j), self.lat(i, j + 1), self.lat(i + 1, j + 1)
        return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz


GRASS = S("grass_block", snowy=False)
DIRT = S("dirt")
COARSE = S("coarse_dirt")
STONE = S("stone")
CRYSTAL = S("nightshift:sky_crystal_cluster")
LEAVES = S("oak_leaves", distance=1, persistent=True, waterlogged=False)
LOG = S("oak_log", axis="y")


def chest(table, facing="north"):
    return S("chest", facing=facing, type="single", waterlogged=False), {"id": "minecraft:chest", "LootTable": "nightshift:chests/" + table}


def barrel(table, facing="up"):
    return S("barrel", facing=facing, open=False), {"id": "minecraft:barrel", "LootTable": "nightshift:chests/" + table}


def marker(kind):
    return {"id": "minecraft:marker", "Tags": NList(TAG_STRING, ["ns_sky_island", "ns_isl_" + kind]), "data": {"kind": kind}}


def island(b, seed, rx, rz, depth, top, flat=0):
    """Остров: возвращает {(x,z): y верха}. flat — радиус ровной площадки в центре (под постройку)."""
    rng = random.Random(seed)
    n_edge, n_depth, n_top, n_mat = Noise2(seed + 1, 4.0), Noise2(seed + 2, 3.0), Noise2(seed + 3, 5.0), Noise2(seed + 4, 3.0)
    tops = {}
    for x in range(-rx - 3, rx + 4):
        for z in range(-rz - 3, rz + 4):
            r = math.hypot(x / rx, z / rz)
            edge = 1.0 + (n_edge(x, z) - 0.5) * 0.38
            if r > edge:
                continue
            rn = r / edge
            if flat and math.hypot(x, z) <= flat:
                ty = top
            else:
                ty = top + int(round((1 - rn * rn) * 1.4 + (n_top(x, z) - 0.5) * 1.6))
                if flat:
                    ty = min(ty, top + 1)
            d = int(round(depth * (1 - rn) ** 0.85 * (0.62 + 0.55 * n_depth(x, z)))) + 2
            by = ty - d
            for y in range(by, ty + 1):
                if y == ty:
                    st = GRASS
                elif y >= ty - 2:
                    st = COARSE if rng.random() < 0.08 else DIRT
                else:
                    m = n_mat(x + y * 0.7, z - y * 0.5)
                    st = S("andesite") if m < 0.22 else S("tuff") if m > 0.82 else S("calcite") if 0.5 < m < 0.53 else STONE
                    q = rng.random()
                    if q < 0.012:
                        st = S("coal_ore")
                    elif q < 0.02:
                        st = S("iron_ore")
                    elif q < 0.026:
                        st = S("copper_ore")
                b.put(x, y, z, st)
            tops[(x, z)] = ty
            # снизу — сталактиты и корни
            q = rng.random()
            if q < 0.05 and d > 4:
                n = rng.randint(1, 3)
                names = {1: ["tip"], 2: ["frustum", "tip"], 3: ["base", "frustum", "tip"]}[n]
                for k, th in enumerate(names):
                    b.put(x, by - 1 - k, z, S("pointed_dripstone", thickness=th, vertical_direction="down", waterlogged=False))
            elif q < 0.09:
                b.put(x, by - 1, z, S("hanging_roots", waterlogged=False))
    return tops


def decorate_top(b, rng, tops, skip=lambda x, z: False, grass=0.35, flowers=0.05):
    for (x, z), ty in tops.items():
        if skip(x, z) or b.get(x, ty + 1, z) is not None or b.get(x, ty, z) != GRASS:
            continue
        q = rng.random()
        if q < flowers:
            b.put(x, ty + 1, z, S(rng.choice(["dandelion", "poppy", "cornflower", "azure_bluet", "oxeye_daisy"])))
        elif q < grass:
            b.put(x, ty + 1, z, S("short_grass"))


def tree(b, x, z, ty, rng):
    h = rng.randint(4, 5)
    for y in range(ty + 1, ty + 1 + h):
        b.put(x, y, z, LOG)
    b.put(x, ty, z, DIRT)
    top = ty + h
    for dy in range(-2, 2):
        rad = 2 if dy < 0 else 1
        for dx in range(-rad, rad + 1):
            for dz in range(-rad, rad + 1):
                if abs(dx) == rad and abs(dz) == rad and (dy >= 0 or rng.random() < 0.5):
                    continue
                p = (x + dx, top + dy, z + dz)
                if b.get(*p) is None:
                    b.put(*p, LEAVES)


def crystals(b, rng, tops, n_top, n_under, avoid=lambda x, z: False):
    cells = [k for k in tops if not avoid(*k)]
    rng.shuffle(cells)
    placed = 0
    for (x, z) in cells:
        if placed >= n_top:
            break
        ty = tops[(x, z)]
        if b.get(x, ty + 1, z) is None or b.get(x, ty + 1, z) in (S("short_grass"),):
            b.put(x, ty + 1, z, CRYSTAL)
            if rng.random() < 0.4 and b.get(x, ty + 2, z) is None:
                b.put(x, ty + 2, z, CRYSTAL)
            placed += 1
    # снизу: самый нижний блок колонны → кристалл (видно из-под острова)
    rng.shuffle(cells)
    placed = 0
    for (x, z) in cells:
        if placed >= n_under:
            break
        ys = [p[1] for p in b.blocks if p[0] == x and p[2] == z and b.blocks[p] not in (S("hanging_roots", waterlogged=False),) and b.blocks[p][0] != "minecraft:pointed_dripstone"]
        if not ys:
            continue
        b.put(x, min(ys), z, CRYSTAL)
        placed += 1


def sign(lines, rotation=8):
    msgs = NList(TAG_STRING, [json.dumps({"text": t}, ensure_ascii=False) for t in lines])
    empty = NList(TAG_STRING, ['""'] * 4)
    return S("oak_sign", rotation=rotation, waterlogged=False), {
        "id": "minecraft:sign",
        "is_waxed": Byte(1),
        "front_text": {"messages": msgs, "color": "black", "has_glowing_text": Byte(1)},
        "back_text": {"messages": empty, "color": "black", "has_glowing_text": Byte(0)},
    }


# ---------------------------------------------------------------------------
# Руины станции Axiomativ
# ---------------------------------------------------------------------------
def station(seed):
    rng = random.Random(seed)
    b = Build()
    T = 18
    tops = island(b, seed, rng.randint(12, 14), rng.randint(11, 13), 16, T, flat=7)
    W = 5  # полуразмер здания
    collapsed = rng.choice([(1, 1), (1, -1), (-1, 1), (-1, -1)])  # обрушенный угол
    # пол
    for x in range(-W, W + 1):
        for z in range(-W, W + 1):
            if rng.random() < 0.1:
                continue  # провалы в полу — земля
            edge = abs(x) == W or abs(z) == W
            b.put(x, T, z, S("create:andesite_casing") if edge else S("polished_andesite") if (x + z) % 2 else S("andesite"))
    # стены с окнами и обрушениями
    for x in range(-W, W + 1):
        for z in range(-W, W + 1):
            if not (abs(x) == W or abs(z) == W):
                continue
            if z == W and abs(x) <= 1:
                continue  # проём двери (юг)
            in_collapse = x * collapsed[0] > 1 and z * collapsed[1] > 1
            h = rng.randint(0, 2) if in_collapse else (4 if rng.random() > 0.2 else rng.randint(2, 3))
            corner = abs(x) == W and abs(z) == W
            for k in range(1, h + 1):
                y = T + k
                if corner:
                    st = S("create:industrial_iron_block")
                elif k in (2, 3) and (x + z) % 3 == 0:
                    st = S("iron_bars", east=False, west=False, north=False, south=False, waterlogged=False) if rng.random() < 0.5 else S("create:industrial_iron_window")
                else:
                    st = S("create:brass_casing") if k == 1 else S("create:andesite_casing")
                b.put(x, y, z, st)
    # крыша: медная черепица, половина провалилась
    for x in range(-W, W + 1):
        for z in range(-W, W + 1):
            in_collapse = x * collapsed[0] > -1 and z * collapsed[1] > -1
            if in_collapse or rng.random() < 0.3:
                continue
            under = b.get(x, T + 4, z)
            if (abs(x) == W or abs(z) == W) and under is None:
                continue
            b.put(x, T + 5, z, S("create:weathered_copper_shingle_slab", type="bottom", waterlogged=False))
    # обломки крыши на полу
    for _ in range(10):
        x, z = rng.randint(-W + 1, W - 1), rng.randint(-W + 1, W - 1)
        if b.get(x, T + 1, z) is None:
            b.put(x, T + 1, z, rng.choice([S("create:weathered_copper_shingle_slab", type="bottom", waterlogged=False), S("create:andesite_casing"), S("cobblestone")]))
    # внутри: сундук, бочка, «пульт», фонарь
    st, nb = chest("sky_station", "south")
    b.put(-W + 1, T + 1, -W + 1, st, nb)
    st, nb = barrel("sky_station", "up")
    b.put(W - 1, T + 1, -W + 1, st, nb)
    b.put(-W + 1, T + 1, W - 2, S("create:brass_casing"))
    b.put(-W + 1, T + 2, W - 2, S("redstone_lamp", lit=False))
    b.put(0, T + 1, -W + 1, S("lantern", hanging=False, waterlogged=False))
    # второй сундук — под завалом снаружи
    sx, sz = collapsed[0] * (W + 2), collapsed[1] * (W - 1)
    sy = tops.get((sx, sz), T)
    st, nb = chest("sky_station", "north")
    b.put(sx, sy + 1, sz, st, nb)
    b.put(sx, sy + 2, sz, S("create:andesite_casing"))
    b.put(sx + collapsed[0], sy + 1, sz, S("cobblestone"))
    # вывеска у входа
    st, nb = sign(["АКСИОМАТИВ", "Станция «Небо-7»", "Посторонним", "вход воспрещён"], rotation=0)
    b.put(2, T + 1, W + 1, st, nb)
    # мачта антенны с громоотводом
    mx, mz = -collapsed[0] * 2, -collapsed[1] * 2
    for y in range(T + 1, T + 13):
        b.put(mx, y, mz, S("iron_bars", east=False, west=False, north=False, south=False, waterlogged=False) if y < T + 6 else S("chain", axis="y", waterlogged=False) if y % 2 else S("iron_bars", east=False, west=False, north=False, south=False, waterlogged=False))
    b.put(mx, T + 13, mz, S("lightning_rod", facing="up", powered=False, waterlogged=False))
    for d in (-1, 1):
        b.put(mx + d, T + 9, mz, S("iron_bars", east=True, west=True, north=False, south=False, waterlogged=False))
        b.put(mx, T + 9, mz + d, S("iron_bars", east=False, west=False, north=True, south=True, waterlogged=False))
    # турель «старой станции» — шалкер на угловой колонне (стреляет снарядами левитации по пилотам)
    tx, tz = -collapsed[0] * W, -collapsed[1] * W
    for y in range(T + 1, T + 6):
        b.put(tx, y, tz, S("create:industrial_iron_block"))
    b.entities.append((tx, T + 6, tz, {
        "id": "minecraft:shulker", "PersistenceRequired": Byte(1), "Color": Byte(7), "AttachFace": Byte(0),
        "Tags": NList(TAG_STRING, ["ns_sky_turret", "ns_sky_guard"]),
        "CustomName": json.dumps({"text": "Турель станции"}, ensure_ascii=False),
    }))
    b.entities.append((0, T + 1, 0, marker("station")))
    inside = lambda x, z: abs(x) <= W + 1 and abs(z) <= W + 1
    crystals(b, rng, tops, rng.randint(3, 4), rng.randint(2, 3), avoid=inside)
    decorate_top(b, rng, tops, skip=inside)
    return b


# ---------------------------------------------------------------------------
# Разбитый дирижабль
# ---------------------------------------------------------------------------
def airship(seed):
    rng = random.Random(seed)
    b = Build()
    T = 18
    tops = island(b, seed, rng.randint(13, 15), rng.randint(9, 11), 15, T)
    L = 8
    plank, keel = S("spruce_planks"), S("stripped_spruce_log", axis="x")
    hull = {}
    for x in range(-L, L + 1):
        h0 = T - 1 + (x + L) // 4  # корма зарылась в остров, нос задран
        taper = 1 if abs(x) >= L - 1 else 0
        for k in range(0, 4):
            half = [0, 1, 2, 2][k] - (taper if k > 0 else 0)
            y = h0 + k
            for z in range(-half, half + 1):
                shell = k == 0 or abs(z) == half or abs(x) == L
                if shell:
                    if rng.random() < 0.15:
                        continue  # пробоины
                    st = keel if k == 0 else (S("blackstone") if (rng.random() < 0.18 and z > 0) else plank)
                    hull[(x, y, z)] = st
                else:
                    hull[(x, y, z)] = None  # внутри — пусто
        # палуба
        for z in range(-1, 2):
            if rng.random() < 0.7:
                hull[(x, h0 + 4, z)] = S("spruce_slab", type="bottom", waterlogged=False)
    for p, st in hull.items():
        if st is None:
            b.clear(*p)
        else:
            b.put(*p, st)
    # оболочка: рваный эллипсоид из шерсти над корпусом, правый конец просел
    cy = T + 10
    n_hole = Noise2(seed + 9, 3.0)
    for x in range(-11, 12):
        for y in range(cy - 5, cy + 5):
            for z in range(-5, 6):
                sag = max(0, x - 3) * 0.35
                v = (x / 10.5) ** 2 + ((y - cy + sag) / 3.6) ** 2 + (z / 4.2) ** 2
                if 0.78 <= v <= 1.0 and n_hole(x + y * 0.3, z + y * 0.6) < 0.62:
                    b.put(x, y, z, S("white_wool") if rng.random() < 0.72 else S("light_gray_wool"))
    # тросы: цепи от палубы к оболочке
    for x in (-5, 4):
        h0 = T - 1 + (x + L) // 4
        for z in (-2, 2):
            for y in range(h0 + 4, cy - 3):
                if b.get(x, y, z) is None:
                    b.put(x, y, z, S("chain", axis="y", waterlogged=False))
    # мотор и винт на корме
    sx = -L - 1
    sy = T + 1
    b.put(sx, sy, 0, S("iron_block"))
    for dy, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        b.put(sx - 1, sy + dy, dz, S("iron_bars", east=False, west=False, north=dz != 0, south=dz != 0, waterlogged=False))
    b.put(sx - 1, sy, 0, S("create:andesite_casing"))
    # груз
    st, nb = chest("sky_airship", "east")
    b.put(-2, T - 1 + (-2 + L) // 4 + 1, 0, st, nb)
    st, nb = barrel("sky_airship_cargo", "up")
    b.put(3, T - 1 + (3 + L) // 4 + 1, 0, st, nb)
    # выпавший груз на острове
    spots = [k for k in tops if abs(k[1]) >= 4 and abs(k[0]) <= 9]
    rng.shuffle(spots)
    for i, (x, z) in enumerate(spots[:4]):
        ty = tops[(x, z)]
        if b.get(x, ty + 1, z) is not None:
            continue
        if i == 0:
            st, nb = chest("sky_airship", rng.choice(["north", "south", "east", "west"]))
            b.put(x, ty + 1, z, st, nb)
        elif i == 1:
            st, nb = barrel("sky_airship_cargo", "up")
            b.put(x, ty + 1, z, st, nb)
        else:
            b.put(x, ty + 1, z, rng.choice([S("spruce_planks"), S("white_wool"), S("hay_block", axis="y")]))
    b.entities.append((0, T + 2, -4 if (0, -4) in tops else 0, marker("airship")))
    near_hull = lambda x, z: abs(x) <= L + 2 and abs(z) <= 3
    crystals(b, rng, tops, rng.randint(2, 3), rng.randint(1, 2), avoid=near_hull)
    trees = [k for k in tops if not near_hull(*k) and abs(k[0]) < 10 and abs(k[1]) < 8]
    rng.shuffle(trees)
    for (x, z) in trees[:1]:
        tree(b, x, z, tops[(x, z)], rng)
    decorate_top(b, rng, tops, skip=near_hull)
    return b


# ---------------------------------------------------------------------------
# Гнездо стрекоз
# ---------------------------------------------------------------------------
def nest(seed):
    rng = random.Random(seed)
    b = Build()
    T = 18
    tops = island(b, seed, rng.randint(10, 12), rng.randint(10, 12), 14, T, flat=7)
    mats = [S("hay_block", axis="y")] * 5 + [S("mangrove_roots", waterlogged=False)] * 3 + [S("moss_block")] * 2 + [S("bone_block", axis="y")]
    for x in range(-7, 8):
        for z in range(-7, 8):
            r = math.hypot(x, z)
            if r < 3.2:
                b.put(x, T, z, S("mud") if rng.random() < 0.6 else S("moss_block"))
                if rng.random() < 0.3:
                    b.put(x, T + 1, z, S("moss_carpet"))
            elif r <= 6.6:
                h = 2 + (1 if 4.2 <= r <= 5.6 else 0) + (1 if rng.random() < 0.2 else 0)
                for k in range(1, h + 1):
                    b.put(x, T + k, z, rng.choice(mats))
                if rng.random() < 0.18:
                    b.put(x, T + h + 1, z, S("cobweb"))
    # яйца в чаше гнезда
    for (x, z) in [(1, 0), (-1, 1), (0, -2), (-2, -1)]:
        if rng.random() < 0.8:
            b.put(x, T + 1, z, S("turtle_egg", eggs=rng.randint(2, 4), hatch=0))
    st, nb = chest("sky_nest", "south")
    b.put(0, T + 1, 1, st, nb)
    # кости и сухие кусты вокруг
    for (x, z), ty in tops.items():
        if math.hypot(x, z) > 7.5 and b.get(x, ty + 1, z) is None and rng.random() < 0.04:
            b.put(x, ty + 1, z, rng.choice([S("bone_block", axis=rng.choice("xz")), S("dead_bush"), S("cobweb")]))
    b.entities.append((0, T + 2, 0, marker("nest")))
    in_nest = lambda x, z: math.hypot(x, z) <= 7
    crystals(b, rng, tops, rng.randint(4, 5), rng.randint(2, 3), avoid=in_nest)
    # кристаллы растут и прямо из гнезда
    for (x, z) in [(5, 0), (-4, 3), (0, -5)]:
        ty = max(y for (bx, y, bz) in b.blocks if bx == x and bz == z)
        b.put(x, ty + 1, z, CRYSTAL)
    trees = [k for k in tops if not in_nest(*k)]
    rng.shuffle(trees)
    for (x, z) in trees[:2]:
        tree(b, x, z, tops[(x, z)], rng)
    decorate_top(b, rng, tops, skip=in_nest, grass=0.25, flowers=0.02)
    return b


# ---------------------------------------------------------------------------
# Таблицы добычи сундуков островов: kubejs/data/nightshift/loot_table/chests/sky_*.json
# Пул: (броски, [(id, вес, мин, макс)]) — id None = пусто. Небесный кристалл — только отсюда, с друз и (позже) никак иначе.
# «Чертежи» — зонды жил (ставят бесконечную жилу в чанке, nightshift_economy_items.js); артефакты смены — редко.
# ---------------------------------------------------------------------------
LOOT_OUT = PACK / "kubejs/data/nightshift/loot_table/chests"
ART_LOW = ["art_patch", "art_badge", "art_thermos"]  # обычные (уровень 0)
ART_MID = ["art_buckle", "art_qc_stripe", "art_watch_charm"]  # редкие (1)
ART_HIGH = ["art_fang", "art_pauldron", "art_collar"]  # сверхредкие (2)
ART_TOP = ["art_stone_heart", "art_rosary", "art_butcher_glove"]  # эпические (3)
PROBES = ["coal", "copper", "iron", "zinc", "redstone", "gold", "lead", "nickel"]


def artifacts(empty, low, mid, high, top=0):
    pool = [(None, empty, 0, 0)]
    pool += [("nightshift:" + a, low, 1, 1) for a in ART_LOW]
    pool += [("nightshift:" + a, mid, 1, 1) for a in ART_MID]
    pool += [("nightshift:" + a, high, 1, 1) for a in ART_HIGH]
    if top:
        pool += [("nightshift:" + a, top, 1, 1) for a in ART_TOP]
    return (1, pool)


LOOT = {
    "sky_station": [
        (1, [("nightshift:sky_crystal", 1, 3, 5)]),
        ((3, 5), [("minecraft:iron_ingot", 10, 2, 6), ("minecraft:copper_ingot", 10, 4, 10), ("create:brass_ingot", 8, 2, 5),
                  ("create:andesite_alloy", 8, 4, 12), ("create:electron_tube", 6, 1, 3), ("create:precision_mechanism", 3, 1, 1),
                  ("minecraft:redstone", 8, 4, 12), ("minecraft:experience_bottle", 6, 2, 5), ("minecraft:firework_rocket", 5, 3, 8),
                  ("immersive_aircraft:gyroscope", 3, 1, 1), ("immersive_aircraft:telescope", 2, 1, 1)]),
        (1, [(None, 84, 0, 0)] + [("nightshift:vein_seed_" + p, 2, 1, 1) for p in PROBES]),
        artifacts(90, 2, 1, 1),
    ],
    "sky_airship": [
        (1, [("nightshift:sky_crystal", 1, 1, 3)]),
        ((1, 2), [("immersive_aircraft:enhanced_propeller", 4, 1, 1), ("immersive_aircraft:eco_engine", 3, 1, 1), ("immersive_aircraft:nether_engine", 1, 1, 1),
                  ("immersive_aircraft:steel_boiler", 3, 1, 1), ("immersive_aircraft:industrial_gears", 4, 1, 1), ("immersive_aircraft:sturdy_pipes", 4, 1, 1),
                  ("immersive_aircraft:gyroscope", 3, 1, 1), ("immersive_aircraft:hull_reinforcement", 3, 1, 1), ("immersive_aircraft:improved_landing_gear", 3, 1, 1),
                  ("immersive_aircraft:rotary_cannon", 1, 1, 1), ("immersive_aircraft:heavy_crossbow", 1, 1, 1), ("immersive_aircraft:bomb_bay", 1, 1, 1),
                  ("immersive_aircraft:telescope", 2, 1, 1)]),
        ((2, 4), [("minecraft:bread", 8, 2, 5), ("minecraft:cooked_beef", 6, 2, 4), ("minecraft:gunpowder", 6, 2, 6), ("minecraft:string", 6, 3, 8),
                  ("minecraft:leather", 5, 2, 5), ("minecraft:coal", 8, 4, 12), ("minecraft:firework_rocket", 5, 2, 6), ("immersive_aircraft:sail", 3, 1, 2)]),
        artifacts(94, 2, 1, 0),
    ],
    "sky_airship_cargo": [
        (1, [(None, 2, 0, 0), ("nightshift:sky_crystal", 1, 1, 1)]),
        ((2, 4), [("minecraft:coal", 10, 6, 16), ("minecraft:charcoal", 6, 6, 16), ("minecraft:gunpowder", 6, 2, 6), ("minecraft:bread", 6, 2, 6),
                  ("minecraft:dried_kelp_block", 4, 1, 3), ("minecraft:spruce_planks", 6, 8, 20), ("minecraft:chain", 4, 2, 6), ("minecraft:white_wool", 4, 2, 8)]),
    ],
    "sky_nest": [
        (1, [("nightshift:sky_crystal", 1, 2, 4)]),
        ((2, 4), [("minecraft:bone", 10, 2, 6), ("minecraft:string", 8, 2, 6), ("minecraft:feather", 8, 2, 6), ("minecraft:honeycomb", 5, 1, 4),
                  ("minecraft:slime_ball", 5, 1, 4), ("minecraft:phantom_membrane", 5, 1, 3), ("minecraft:ender_pearl", 2, 1, 2),
                  ("minecraft:experience_bottle", 5, 2, 4), ("minecraft:turtle_scute", 2, 1, 2)]),
        artifacts(88, 2, 1, 1, 1),
    ],
}


def loot_tables():
    LOOT_OUT.mkdir(parents=True, exist_ok=True)
    for name, pools in LOOT.items():
        out = []
        for rolls, entries in pools:
            pool = {"rolls": rolls if isinstance(rolls, int) else {"type": "minecraft:uniform", "min": rolls[0], "max": rolls[1]}, "entries": []}
            for (iid, w, lo, hi) in entries:
                if iid is None:
                    pool["entries"].append({"type": "minecraft:empty", "weight": w})
                    continue
                e = {"type": "minecraft:item", "name": iid}
                if w != 1 or len(entries) > 1:
                    e["weight"] = w
                if hi > 1:
                    e["functions"] = [{"function": "minecraft:set_count", "count": {"type": "minecraft:uniform", "min": lo, "max": hi} if lo != hi else lo}]
                pool["entries"].append(e)
            out.append(pool)
        table = {"type": "minecraft:chest", "pools": out, "random_sequence": "nightshift:chests/" + name}
        (LOOT_OUT / f"{name}.json").write_text(json.dumps(table, ensure_ascii=False, indent=2) + "\n")
    print("таблицы добычи островов: " + ", ".join(LOOT))


def structures():
    for kind, fn, seeds in (("station", station, (7101, 7102)), ("airship", airship, (7201, 7202)), ("nest", nest, (7301, 7302))):
        for i, seed in enumerate(seeds, 1):
            b = fn(seed)
            size, nb, ne = b.save(STRUCT_OUT / f"{kind}_{i}.nbt")
            print(f"{kind}_{i}: размер {size}, блоков {nb}, сущностей {ne}")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(PACK / "tools"))
    textures()
    structures()
    loot_tables()
