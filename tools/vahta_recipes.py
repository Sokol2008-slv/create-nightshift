#!/usr/bin/env python3
"""«Вахта»: перенос рецептов верстака на машины Create.

Читает выгрузку рецептов и тегов (tools/data/*.json.gz), учитывает удаления/добавления
из kubejs/server_scripts/**, классифицирует ВСЕ рецепты верстака (docs/VAHTA.md, п.3) и пишет:

  kubejs/server_scripts/vahta/10_machine_recipes.js — create:mixing и create:cutting;
  docs/VAHTA-RECIPES-lists.md                       — полные списки по категориям (автоген);
  tools/data/vahta-recipes-stats.json               — цифры для отчёта docs/VAHTA-RECIPES.md.

Запуск: python3 tools/vahta_recipes.py [--quiet]
Без сторонних пакетов.

Модель поведения Create 6 (проверить вживую, см. docs/VAHTA-RECIPES.md):
  * миксер берёт бесформенный рецепт, если ингредиентов > 1 и рецепт не «квадратное сжатие»;
  * пресс берёт любой рецепт верстака из 4 или 9 одинаковых ингредиентов (canCompress);
  * при нескольких подходящих рецептах бассейн берёт произвольный (фильтр бассейна сужает выбор по выходу).
"""
import collections
import gzip
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'tools', 'data')
OUT_JS = os.path.join(ROOT, 'kubejs', 'server_scripts', 'vahta', '10_machine_recipes.js')
OUT_LISTS = os.path.join(ROOT, 'docs', 'VAHTA-RECIPES-lists.md')
OUT_STATS = os.path.join(DATA, 'vahta-recipes-stats.json')

QUIET = '--quiet' in sys.argv

VANILLA_SHAPED = ('minecraft:crafting_shaped', 'crafting_shaped')
VANILLA_SHAPELESS = ('minecraft:crafting_shapeless', 'crafting_shapeless')

# Формы из дерева/камня: суффиксы выходного предмета (без namespace).
FORM_SUFFIXES = (
    '_stairs', '_slab', '_vertical_slab', '_wall', '_fence', '_fence_gate', '_door', '_trapdoor',
    '_button', '_pressure_plate', '_pane', '_panel', '_post', '_beam', '_pillar', '_layer', '_sheet',
    '_step', '_corner', '_window', '_bars',
)
FORM_EXCLUDE = ('_wall_sign', '_wall_hanging_sign', '_wall_torch', '_wall_banner', '_wall_head', '_wall_skull')

STICKS = {'minecraft:stick'}

# Предметы-контейнеры: в верстаке остаётся пустая тара, в бассейне — иначе (проверить вживую).
CONTAINER_EXTRA = {'minecraft:honey_bottle', 'minecraft:dragon_breath', 'minecraft:experience_bottle',
                   'minecraft:potion', 'minecraft:splash_potion', 'minecraft:lingering_potion'}


def log(*a):
    if not QUIET:
        print(*a)


# ---------------------------------------------------------------------------
# Загрузка
# ---------------------------------------------------------------------------
RECIPES = json.load(gzip.open(os.path.join(DATA, 'recipes-dump.json.gz')))
TAGS_RAW = json.load(gzip.open(os.path.join(DATA, 'item-tags-dump.json.gz')))


def _merge_neoforge_tags():
    """05.10: в выгрузке нет общих тегов самого NeoForge (c:storage_blocks/copper и ещё ~240 — лежат в его jar,
    а не в модах). Без них рецепты на «любой медный блок» считались незагружаемыми и не попадали в миксер
    (Переполнение 0 Sophisticated Backpacks). Добавляем теги из jar NeoForge сервера."""
    import glob, re, zipfile
    jars = sorted(glob.glob(os.path.expanduser('~/mc-nightshift-server/libraries/net/neoforged/neoforge/*/neoforge-*-universal.jar')))
    if not jars:
        return 0
    n = 0
    with zipfile.ZipFile(jars[-1]) as z:
        for name in z.namelist():
            m = re.match(r'data/([^/]+)/tags/item/(.+)\.json$', name)
            if not m:
                continue
            tag = m.group(1) + ':' + m.group(2)
            vals = json.loads(z.read(name)).get('values', [])
            have = TAGS_RAW.setdefault(tag, [])
            for v in vals:
                if v not in have:
                    have.append(v)
                    n += 1
    return n


NEOFORGE_TAG_VALUES = _merge_neoforge_tags()

# Моды, которые реально загружены: пространства имён id рецептов из выгрузки (у каждого мода с контентом
# есть хоть один свой рецепт) + ядро.
LOADED = {k.split(':')[0] for k in RECIPES} | {'minecraft', 'c', 'neoforge', 'kubejs'}

_tag_cache = {}


def tag_items(tag, stack=()):
    """Раскрыть тег рекурсивно -> frozenset предметов (только из загруженных модов)."""
    if tag in _tag_cache:
        return _tag_cache[tag]
    if tag in stack:
        return frozenset()
    out = set()
    for v in TAGS_RAW.get(tag, []):
        if isinstance(v, dict):
            v = v.get('id', '')
        v = v.rstrip('?')
        if v.startswith('#'):
            out |= tag_items(v[1:], stack + (tag,))
        elif v.split(':')[0] in LOADED:
            out.add(v)
    res = frozenset(out)
    _tag_cache[tag] = res
    return res


# ---------------------------------------------------------------------------
# Условия загрузки рецепта (neoforge:conditions)
# ---------------------------------------------------------------------------
UNKNOWN_CONDITIONS = collections.Counter()


def cond_ok(c):
    t = c.get('type', '')
    if t == 'neoforge:mod_loaded':
        return c.get('modid') in LOADED
    if t == 'neoforge:not':
        return not cond_ok(c['value'])
    if t == 'neoforge:and':
        return all(cond_ok(x) for x in c['values'])
    if t == 'neoforge:or':
        return any(cond_ok(x) for x in c['values'])
    if t == 'neoforge:true':
        return True
    if t == 'neoforge:false':
        return False
    if t == 'neoforge:tag_empty':
        return len(tag_items(c['tag'])) == 0
    if t == 'neoforge:item_exists':
        return c['item'].split(':')[0] in LOADED
    # конфиги модов (createfood:enabled, sophisticatedcore:item_enabled, ...) — по умолчанию включены
    UNKNOWN_CONDITIONS[t] += 1
    return True


def recipe_loads(j):
    return all(cond_ok(c) for c in j.get('neoforge:conditions', []))


# ---------------------------------------------------------------------------
# KubeJS: удаления и добавления (распознаётся литеральный синтаксис пака)
# ---------------------------------------------------------------------------
class JSParseError(Exception):
    pass


def js_literal(s, i, env):
    """Мини-парсер JS-литералов: строки, числа, массивы, объекты, Fluid.of(...), имена var."""
    def ws(i):
        while i < len(s) and s[i] in ' \t\r\n':
            i += 1
        if s.startswith('//', i):
            i = s.index('\n', i) if '\n' in s[i:] else len(s)
            return ws(i)
        return i
    i = ws(i)
    ch = s[i]
    if ch in '\'"':
        j = i + 1
        buf = ''
        while s[j] != ch:
            if s[j] == '\\':
                j += 1
            buf += s[j]
            j += 1
        return buf, j + 1
    if ch == '[':
        arr = []
        i = ws(i + 1)
        while s[i] != ']':
            v, i = js_literal(s, i, env)
            arr.append(v)
            i = ws(i)
            if s[i] == ',':
                i = ws(i + 1)
        return arr, i + 1
    if ch == '{':
        obj = {}
        i = ws(i + 1)
        while s[i] != '}':
            m = re.compile(r'(?:[\'"]([^\'"]+)[\'"]|([A-Za-z0-9_$]+))\s*:').match(s, i)
            if not m:
                raise JSParseError(s[i:i + 30])
            v, i = js_literal(s, m.end(), env)
            obj[m.group(1) or m.group(2)] = v
            i = ws(i)
            if s[i] == ',':
                i = ws(i + 1)
        return obj, i + 1
    m = re.compile(r'Fluid\.of\(\s*[\'"]([^\'"]+)[\'"]\s*(?:,\s*(\d+))?\s*\)').match(s, i)
    if m:
        return {'fluid': m.group(1), 'amount': int(m.group(2) or 1000)}, m.end()
    m = re.compile(r'-?\d+(\.\d+)?').match(s, i)
    if m:
        return float(m.group(0)), m.end()
    m = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*').match(s, i)
    if m and m.group(0) in env:
        return env[m.group(0)], m.end()
    raise JSParseError(s[i:i + 40])


def js_args(s, i, env):
    """s[i] == '(' -> список аргументов вызова."""
    args = []
    i += 1
    while True:
        while s[i] in ' \t\r\n,':
            i += 1
        if s[i] == ')':
            return args, i + 1
        v, i = js_literal(s, i, env)
        args.append(v)


def parse_kubejs():
    removed, added, notes = set(), [], []
    base = os.path.join(ROOT, 'kubejs', 'server_scripts')
    for dp, _, fns in os.walk(base):
        for fn in sorted(fns):
            if not fn.endswith('.js'):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, ROOT)
            if os.path.abspath(path) == os.path.abspath(OUT_JS):
                continue  # собственный вывод не учитываем
            src = open(path, encoding='utf-8').read()
            # var X = [ ... ]  (массивы литералов)
            env = {}
            for m in re.finditer(r'\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(?=[\[{])', src):
                try:
                    env[m.group(1)], _ = js_literal(src, m.end(), env)
                except (JSParseError, IndexError, ValueError):
                    pass
            # event.remove({ id: '...' }) и event.remove({ id: ARR[i] }) / forEach(ARR)
            for m in re.finditer(r'event\.remove\(\s*\{\s*id\s*:\s*([^}]+)\}', src):
                arg = m.group(1).strip()
                if arg[0] in '\'"':
                    removed.add(arg.strip('\'"'))
                else:
                    mname = re.match(r'[\w$]+', arg)
                    arr = env.get(mname.group(0)) if mname else None
                    if arr is None:
                        # forEach(function (id) { event.remove({id: id}) }) — ищем массив по forEach
                        fe = re.findall(r'([\w$]+)\.forEach\(', src)
                        arr = next((env[x] for x in fe if isinstance(env.get(x), list)), None)
                        if arr is None:
                            fk = re.findall(r'Object\.keys\(([\w$]+)\)', src)
                            arr = next((list(env[x]) for x in fk if isinstance(env.get(x), dict)), None)
                            if arr is not None:
                                notes.append('%s: условное удаление по фазе (%d id) — не рецепты верстака, не учитываем' % (rel, len(arr)))
                                continue
                    if isinstance(arr, list):
                        # список списков (var lists = [NS_VAHTA_POCKET_IDS, …]; remove({id: lists[l][i]})) —
                        # раньше вложенные массивы молча пропускались, и миксер снова делал карманные верстаки
                        for x in arr:
                            if isinstance(x, str):
                                removed.add(x)
                            elif isinstance(x, list):
                                removed.update(y for y in x if isinstance(y, str))
                    else:
                        notes.append('%s: не распознано удаление %r' % (rel, arg))
            # добавления
            for m in re.finditer(r'event\.(shaped|shapeless|recipes\.create\.(mixing|cutting))\s*\(', src):
                kind = m.group(2) or m.group(1)
                try:
                    args, end = js_args(src, m.end() - 1, env)
                except (JSParseError, IndexError, ValueError) as e:
                    notes.append('%s: не разобран вызов %s (%s)' % (rel, kind, e))
                    continue
                mid = re.compile(r'\s*\.id\(\s*[\'"]([^\'"]+)[\'"]').match(src, end)
                rid = mid.group(1) if mid else None
                if not rid:
                    # цепочки вида .heated().id(...)
                    mid = re.compile(r'(?:\s*\.\w+\(\))*\s*\.id\(\s*[\'"]([^\'"]+)[\'"]').match(src, end)
                    rid = mid.group(1) if mid else 'kubejs:%s_%d' % (fn, m.start())
                added.append({'kind': kind, 'args': args, 'id': rid, 'file': rel,
                              'heated': bool(re.compile(r'(?:\s*\.\w+\(\))*?\s*\.(heated|superheated)\(').match(src, end))})
    return removed, added, notes


def kjs_stack(s):
    m = re.match(r'(\d+)x\s+(.+)', s)
    return (m.group(2), int(m.group(1))) if m else (s, 1)


def kjs_ing(s):
    return {'tag': s[1:]} if s.startswith('#') else {'item': s}


def kubejs_to_json(a):
    """Добавленный в KubeJS рецепт -> JSON как в выгрузке."""
    args = a['args']
    if a['kind'] == 'shaped':
        out, n = kjs_stack(args[0])
        key = {k: (kjs_ing(v) if isinstance(v, str) else [kjs_ing(x) for x in v]) for k, v in args[2].items()}
        return {'type': 'minecraft:crafting_shaped', 'pattern': args[1], 'key': key, 'result': {'id': out, 'count': n}}
    if a['kind'] == 'shapeless':
        out, n = kjs_stack(args[0])
        ings = []
        for s in args[1]:
            it, c = kjs_stack(s)
            ings += [kjs_ing(it)] * c
        return {'type': 'minecraft:crafting_shapeless', 'ingredients': ings, 'result': {'id': out, 'count': n}}
    # mixing / cutting
    outs = args[0] if isinstance(args[0], list) else [args[0]]
    ins = args[1] if isinstance(args[1], list) else [args[1]]
    results, ings = [], []
    for o in outs:
        if isinstance(o, dict):
            results.append({'id': o['fluid'], 'amount': o['amount']})
        else:
            it, c = kjs_stack(o)
            results.append({'id': it, 'count': c})
    for s in ins:
        if isinstance(s, dict):
            ings.append({'type': 'fluid_stack', 'fluid': s['fluid'], 'amount': s['amount']})
        else:
            it, c = kjs_stack(s)
            ings += [kjs_ing(it)] * c
    j = {'type': 'create:' + a['kind'], 'ingredients': ings, 'results': results}
    if a['heated']:
        j['heat_requirement'] = 'heated'
    return j


# ---------------------------------------------------------------------------
# Нормализация ингредиентов
# ---------------------------------------------------------------------------
class Unsupported(Exception):
    """Ингредиент/результат, который нельзя честно перенести (компоненты, свой тип и т.п.)."""


def norm_ing(x):
    """-> (frozenset предметов, представление для KubeJS: str | list[str])."""
    if isinstance(x, list):
        items, reps = set(), []
        for y in x:
            s, r = norm_ing(y)
            items |= s
            reps += r if isinstance(r, list) else [r]
        return frozenset(items), reps
    if not isinstance(x, dict):
        raise Unsupported('ингредиент не объект')
    t = x.get('type')
    if t is None or t == 'neoforge:single':
        if 'item' in x:
            it = x['item']
            return (frozenset([it]) if it.split(':')[0] in LOADED else frozenset()), it
        if 'tag' in x:
            return tag_items(x['tag']), '#' + x['tag']
        raise Unsupported('ингредиент без item/tag: %s' % json.dumps(x))
    if t == 'neoforge:compound':
        return norm_ing(x.get('children') or x.get('ingredients'))
    if t == 'neoforge:intersection':
        sets = [norm_ing(c)[0] for c in x['children']]
        s = frozenset.intersection(*sets) if sets else frozenset()
        return s, sorted(s)
    if t == 'neoforge:difference':
        s = norm_ing(x['base'])[0] - norm_ing(x['subtracted'])[0]
        return s, sorted(s)
    if t == 'neoforge:components':
        raise Unsupported('ингредиент с компонентами (NBT)')
    raise Unsupported('ингредиент своего типа %s' % t)


def is_fluid_ing(x):
    return isinstance(x, dict) and ('fluid' in x or 'fluids' in x or 'fluid_tag' in x or 'amount' in x
                                    or 'fluid' in str(x.get('type', '')))


def crafting_result(j):
    r = j.get('result')
    if not isinstance(r, dict) or 'id' not in r or not isinstance(r['id'], str):
        raise Unsupported('результат в старом формате (1.20: item/nbt) — в 1.21.1 не грузится')
    if r.get('components') or r.get('nbt'):
        raise Unsupported('результат с компонентами/NBT')
    return r['id'], int(r.get('count', 1))


# ---------------------------------------------------------------------------
# Сбор рецептов
# ---------------------------------------------------------------------------
KJS_REMOVED, KJS_ADDED, KJS_NOTES = parse_kubejs()

ALL = {}  # id -> {'src', 'json'}
for rid, v in RECIPES.items():
    ALL[rid] = {'src': v['src'], 'json': v['json']}
for a in KJS_ADDED:
    try:
        ALL[a['id']] = {'src': a['file'], 'json': kubejs_to_json(a)}
    except Exception as e:  # noqa: BLE001 — нераспознанное добавление просто отмечаем
        KJS_NOTES.append('%s: не удалось перевести %s %s (%s)' % (a['file'], a['kind'], a['id'], e))

stats = collections.Counter()
skipped = collections.defaultdict(list)   # причина -> [id]


def ns_ok(item_id):
    return item_id.split(':')[0] in LOADED


LIVE = {}
for rid, v in ALL.items():
    if rid in KJS_REMOVED:
        skipped['удалён в kubejs/server_scripts'].append(rid)
        continue
    if not recipe_loads(v['json']):
        skipped['условие загрузки ложно (мода нет и т.п.)'].append(rid)
        continue
    LIVE[rid] = v

CRAFT_TYPES_SPECIAL_HINT = ('crafting', 'shaped', 'shapeless', 'upgrade', 'tier', 'transform_module',
                            'backpack', 'generic_wood_storage', 'shulker_box_from', 'decorated_pot')
MECH_TYPES = ('create:mechanical_crafting', 'create_jetpack:copy_components_mechanical_crafting')


def is_craftingish(j):
    """Рецепт верстака (в т.ч. свой serializer мода)?"""
    t = str(j.get('type', ''))
    if t in MECH_TYPES:
        return False
    if t in VANILLA_SHAPED or t in VANILLA_SHAPELESS or 'crafting_special' in t:
        return True
    shaped_like = 'pattern' in j and 'key' in j
    shapeless_like = 'ingredients' in j and 'result' in j and 'results' not in j
    if (shaped_like or shapeless_like) and any(h in t for h in CRAFT_TYPES_SPECIAL_HINT):
        return True
    return t in ('minecraft:crafting_decorated_pot', 'minecraft:crafting_transmute')


class Rec:
    """Нормализованный рецепт: слоты (frozenset предметов) + представления для JS."""
    __slots__ = ('id', 'src', 'kind', 'slots', 'reps', 'out', 'count', 'heated', 'fluids', 'grid', 'raw_ings')

    def __init__(self, rid, src, kind):
        self.id, self.src, self.kind = rid, src, kind
        self.slots, self.reps, self.fluids, self.grid = [], [], [], None
        self.out, self.count, self.heated, self.raw_ings = None, 1, False, []


def build_crafting(rid, v):
    j = v['json']
    t = j['type']
    r = Rec(rid, v['src'], 'shaped' if t in VANILLA_SHAPED else 'shapeless')
    r.out, r.count = crafting_result(j)
    if not ns_ok(r.out):
        raise LookupError('выход из отсутствующего мода')
    if r.kind == 'shaped':
        pat = j['pattern']
        # как ShapedRecipePattern: обрезать пустые строки/столбцы
        rows = [row for row in pat]
        cells = []
        keymap = {}
        for k, x in j['key'].items():
            keymap[k] = norm_ing(x)
        w = max(len(row) for row in rows)
        rows = [row.ljust(w) for row in rows]
        while rows and not rows[0].strip():
            rows.pop(0)
        while rows and not rows[-1].strip():
            rows.pop()
        cols = [c for c in range(w) if any(row[c] != ' ' for row in rows)]
        if cols:
            rows = [row[cols[0]:cols[-1] + 1] for row in rows]
        r.grid = (len(rows[0]) if rows else 0, len(rows))
        for row in rows:
            for ch in row:
                if ch == ' ':
                    cells.append(None)
                    continue
                s, rep = keymap[ch]
                cells.append(s)
                r.slots.append(s)
                r.reps.append(rep)
        r.raw_ings = cells
    else:
        for x in j['ingredients']:
            s, rep = norm_ing(x)
            r.slots.append(s)
            r.reps.append(rep)
        r.raw_ings = list(r.slots)
    for s, rep in zip(r.slots, r.reps):
        if not s:
            raise LookupError('пустой ингредиент (тег пуст или предмет из отсутствующего мода): %s' % rep)
    return r


def build_mixing(rid, v):
    j = v['json']
    r = Rec(rid, v['src'], 'mixing')
    r.heated = j.get('heat_requirement', 'none') != 'none'
    for x in j.get('ingredients', []):
        if is_fluid_ing(x):
            fx = {k: vv for k, vv in x.items() if k != 'amount'}
            r.fluids.append(json.dumps(fx, sort_keys=True))
            continue
        s, rep = norm_ing(x)
        n = int(x.get('count', 1)) if isinstance(x, dict) else 1
        for _ in range(n):
            r.slots.append(s)
            r.reps.append(rep)
    outs = []
    for o in j.get('results', []):
        if 'amount' in o and 'count' not in o and 'item' not in o:
            outs.append('fluid:' + str(o.get('id') or o.get('fluid')))
            continue
        it = o.get('id') or o.get('item')
        if isinstance(it, dict):
            it = it.get('id')
        outs.append(str(it))
    r.out = outs[0] if outs else '?'
    for s in r.slots:
        if not s:
            raise LookupError('пустой ингредиент')
    return r


# ---------------------------------------------------------------------------
# Классификация
# ---------------------------------------------------------------------------
SPECIAL = []          # (id, src, причина)
BROKEN = []           # рецепты верстака, которые в 1.21.1 не грузятся (старый формат)
MECH = []             # (id, src)
SINGLE = []           # бесформенные из одного ингредиента — миксер не берёт
PRESS = []            # квадратное сжатие
SHAPELESS = []        # Rec — миксер сам
SHAPED = []           # Rec — кандидаты
MIXING = []           # Rec — существующие create:mixing
STONECUT_OUT = collections.defaultdict(set)   # выход -> множество входов (stonecutting + create:cutting)
CUT_EXISTING_BY_IN = collections.defaultdict(set)

for rid, v in LIVE.items():
    j = v['json']
    t = str(j.get('type', ''))
    try:
        if t in MECH_TYPES:
            MECH.append((rid, v['src'], t))
        elif t == 'create:mixing':
            MIXING.append(build_mixing(rid, v))
        elif t in ('minecraft:stonecutting', 'create:cutting'):
            if t == 'minecraft:stonecutting':
                ins, _ = norm_ing(j['ingredient'])
                outs = [j['result']['id']] if isinstance(j.get('result'), dict) else []
            else:
                ins = frozenset().union(*[norm_ing(x)[0] for x in j['ingredients']]) if j.get('ingredients') else frozenset()
                outs = []
                for o in j.get('results', []):
                    it = o.get('id') or o.get('item')
                    outs.append(it.get('id') if isinstance(it, dict) else it)
            for o in outs:
                STONECUT_OUT[o] |= ins
        elif is_craftingish(j):
            if t not in VANILLA_SHAPED + VANILLA_SHAPELESS:
                SPECIAL.append((rid, v['src'], 'свой serializer: ' + t))
                continue
            try:
                r = build_crafting(rid, v)
            except Unsupported as e:
                if 'старом формате' in str(e) or 'без item/tag' in str(e):
                    raise LookupError('битый формат 1.21.1: ' + str(e))
                SPECIAL.append((rid, v['src'], str(e)))
                continue
            if len(r.slots) in (4, 9) and len(set(r.raw_ings)) == 1 and None not in r.raw_ings:
                PRESS.append(r)
            elif r.kind == 'shapeless':
                (SINGLE if len(r.slots) == 1 else SHAPELESS).append(r)
            else:
                SHAPED.append(r)
    except Unsupported as e:
        skipped['не разобран: ' + str(e)].append(rid)
    except LookupError as e:
        skipped['не загрузится: ' + str(e).split(':')[0]].append(rid)
        if str(e).startswith('битый'):
            BROKEN.append((rid, v['src'], str(e)))
    except (KeyError, TypeError, ValueError, IndexError) as e:
        skipped['битый JSON (%s)' % type(e).__name__].append(rid)

# ---------------------------------------------------------------------------
# Коллизии мультимножеств
# ---------------------------------------------------------------------------
_set_ids = {}


def sid(s):
    if s not in _set_ids:
        _set_ids[s] = len(_set_ids)
    return _set_ids[s]


_inter = {}


def intersects(a, b):
    ia, ib = sid(a), sid(b)
    if ia == ib:
        return True
    k = (ia, ib) if ia < ib else (ib, ia)
    v = _inter.get(k)
    if v is None:
        v = _inter[k] = not a.isdisjoint(b)
    return v


def multiset_collide(r1, r2):
    """Есть ли перестановка слотов, где каждая пара ингредиентов пересекается (двудольное паросочетание)."""
    a, b = r1.slots, r2.slots
    if len(a) != len(b) or sorted(r1.fluids) != sorted(r2.fluids):
        return False
    n = len(a)
    adj = [[j for j in range(n) if intersects(a[i], b[j])] for i in range(n)]
    if any(not x for x in adj):
        return False
    match = [-1] * n

    def aug(i, seen):
        for j in adj[i]:
            if j in seen:
                continue
            seen.add(j)
            if match[j] < 0 or aug(match[j], seen):
                match[j] = i
                return True
        return False
    return all(aug(i, set()) for i in range(n))


def same_output(r1, r2):
    return r1.out == r2.out


def find_edges(pool):
    """Рёбра коллизий в пуле рецептов (разные выходы). Возвращает dict idx -> set(idx) и дубли-одного-выхода."""
    item_index = collections.defaultdict(set)
    for i, r in enumerate(pool):
        for s in set(r.slots):
            for it in s:
                item_index[it].add(i)
    pop = {it: len(v) for it, v in item_index.items()}
    edges = collections.defaultdict(set)
    same = collections.defaultdict(set)
    for i, r in enumerate(pool):
        # самый редкий ингредиент рецепта — любой конкурент обязан его пересекать
        rare = min(set(r.slots), key=lambda s: sum(pop[it] for it in s))
        cand = set()
        for it in rare:
            cand |= item_index[it]
        for k in cand:
            if k <= i:
                continue
            if multiset_collide(r, pool[k]):
                (same if same_output(r, pool[k]) else edges)[i].add(k)
                (same if same_output(r, pool[k]) else edges)[k].add(i)
    return edges, same


def is_form(r):
    path = r.out.split(':')[1]
    return path.endswith(FORM_SUFFIXES) and not path.endswith(FORM_EXCLUDE)


# Проход 1: все кандидаты в миксер вместе.
POOL = SHAPELESS + [r for r in MIXING if r.slots] + SHAPED
log('пул миксера: %d (бесформенных %d, create:mixing %d, фигурных %d)' % (len(POOL), len(SHAPELESS), len(MIXING), len(SHAPED)))
EDGES1, SAME1 = find_edges(POOL)
idx_of = {id(r): i for i, r in enumerate(POOL)}

form_cut = set()      # индексы фигурных форм, уходящих на пилу
for r in SHAPED:
    i = idx_of[id(r)]
    if EDGES1.get(i) and is_form(r):
        form_cut.add(i)

# Проход 2: без форм, ушедших на пилу.
POOL2 = [r for i, r in enumerate(POOL) if i not in form_cut]
EDGES2, SAME2 = find_edges(POOL2)
idx2 = {id(r): i for i, r in enumerate(POOL2)}


def components(edges, pool):
    seen, groups = set(), []
    for i in edges:
        if i in seen:
            continue
        comp, st = [], [i]
        seen.add(i)
        while st:
            x = st.pop()
            comp.append(x)
            for y in edges[x]:
                if y not in seen:
                    seen.add(y)
                    st.append(y)
        groups.append([pool[x] for x in comp])
    return groups


GROUPS1 = components(EDGES1, POOL)   # все коллизии (для отчёта)
GROUPS2 = components(EDGES2, POOL2)  # после ухода форм на пилу

MIX_GEN, CRAFTER, CUT_GEN, CUT_COVERED, ALREADY_MIX, DUP_SAME = [], [], [], [], [], []
HOMO_CRAFTER = []  # однородные и перехватчики — только механическим крафтерам (см. ниже)
# «2 андезита + 2 самородка → 1 сплав» перебивал create:mixing «1 + 1 → 1» (сплав вдвое дороже)
MIX_SKIP_IDS = {'create:crafting/materials/andesite_alloy', 'create:crafting/materials/andesite_alloy_from_zinc'}
UNIQUE_FORM_ON_SAW = []  # уникальная форма, но пила уже режет её через stonecutting — mixing не нужен
_gen_sig = set()


def sig(r):
    return (r.out, r.count, tuple(sorted(sid(s) for s in r.slots)))


for r in SHAPED:
    i = idx_of[id(r)]
    if i in form_cut:
        continue
    j = idx2[id(r)]
    if EDGES2.get(j):
        CRAFTER.append(r)
        continue
    # тот же выход уже делает миксер (бесформенный/create:mixing с пересекающимся набором)
    same = [POOL2[k] for k in SAME2.get(j, ())]
    same = [x for x in same if x.kind == 'shapeless' or (x.kind == 'mixing' and not x.heated)]
    if same:
        ALREADY_MIX.append((r, same[0]))
        continue
    if is_form(r):
        sc = STONECUT_OUT.get(r.out, frozenset())
        base = [x for x in r.slots if not x <= STICKS]
        if sc and base and all(not sc.isdisjoint(x) for x in base):
            UNIQUE_FORM_ON_SAW.append(r)
            continue
    if r.out.endswith(':deleted_mod_element'):  # заглушка удалённого предмета мода — рецепт не создать (ошибка KubeJS)
        continue
    if sig(r) in _gen_sig:
        DUP_SAME.append(r)
        continue
    # 05.10 (аудит): «однородные» рецепты (один вид ингредиента: 8 камня → печь, 3 меди → громоотвод, 2 сплава →
    # валы) в миксер НЕ переносим. Чаша Create берёт подходящий рецепт с наибольшим числом ингредиентов, и со
    # стаками в чаше такие рецепты перехватывали базовые (андезит → печи вместо сплава, медь+цинк → кираса вместо
    # латуни, булыжник → печь вместо лавы). Их по-прежнему делают механические крафтеры.
    if len({sid(x) for x in r.slots}) == 1 or r.id in MIX_SKIP_IDS:
        HOMO_CRAFTER.append(r)
        continue
    _gen_sig.add(sig(r))
    MIX_GEN.append(r)

# ---------------------------------------------------------------------------
# Пила: честный пересчёт
# ---------------------------------------------------------------------------
PLANKS = tag_items('minecraft:planks')
LOG_TAG_FOR_PLANK = {}
# бесформенный «#xxx_logs -> 4 доски» — по ВСЕМ рецептам, включая удалённые на вахте
# (сами рецепты «бревно → доски» руками убраны, но соответствие бревно↔доска нужно пиле)
for _rid, _v in ALL.items():
    _j = _v['json']
    if str(_j.get('type', '')) not in VANILLA_SHAPELESS or len(_j.get('ingredients', [])) != 1:
        continue
    _ing, _res = _j['ingredients'][0], _j.get('result') or {}
    _out = _res.get('id') or _res.get('item') if isinstance(_res, dict) else None
    if isinstance(_ing, dict) and 'tag' in _ing and _out in PLANKS and _res.get('count') == 4:
        LOG_TAG_FOR_PLANK[_out] = '#' + _ing['tag']
PLANKS_PER_LOG = 6   # «Вахта», п.5: 6 досок с бревна пилой


def bark_log(log_tag):
    """Тег брёвен -> единственное бревно в коре (без окорённых и блоков древесины) или None.
    Формы режем только из бревна в коре: окорённое бревно на пиле = одни доски,
    окорённая древесина = литейные формы пушек (vahta/20_recipes.js)."""
    items = [x for x in tag_items(log_tag.lstrip('#'))
             if 'stripped' not in x and not x.endswith(('_wood', '_hyphae'))]
    return items[0] if len(items) == 1 else None


METAL_WORDS = ('ingot', 'nugget', 'sheet', 'plate', 'rod', 'wire', 'alloy', 'scrap')
MAX_CUT_DEVIATION = 0.12   # неточный пересчёт допускаем до 12 %, иначе — крафтерам


def is_metal(s, rep):
    names = [rep] + sorted(s)[:5]
    return any(w in n.split(':')[-1] for n in names for w in METAL_WORDS)


def plan_cut(r):
    """-> dict(input, count, exact, note) или None (не чистая форма)."""
    base = [(s, rep) for s, rep in zip(r.slots, r.reps) if not (s <= STICKS)]
    sticks = len(r.slots) - len(base)
    if not base or len({sid(s) for s, _ in base}) != 1:
        return None
    s, rep = base[0]
    if isinstance(rep, list):
        return None
    if sticks and not s <= PLANKS:
        return None
    covered = STONECUT_OUT.get(r.out, frozenset())
    if covered and not covered.isdisjoint(s):
        return {'covered': True}
    if is_metal(s, rep):
        return None   # металл — не «дерево/камень», форма остаётся крафтерам
    units = len(base) + 0.5 * sticks
    rate = r.count / units
    if abs(rate - round(rate)) < 1e-9 and rate >= 1:
        return {'input': rep, 'count': int(round(rate)), 'exact': True, 'per': '1 блок'}
    log_tag = LOG_TAG_FOR_PLANK.get(rep) if not rep.startswith('#') else None
    if log_tag:
        per_log = rate * PLANKS_PER_LOG
        log_tag = bark_log(log_tag) or log_tag
        if abs(per_log - round(per_log)) < 1e-9:
            return {'input': log_tag, 'count': int(round(per_log)), 'exact': True, 'per': 'бревно = 6 досок'}
        n = max(1, int(round(per_log)))
        if abs(n - per_log) / per_log > MAX_CUT_DEVIATION:
            return None
        return {'input': log_tag, 'count': n, 'exact': False, 'per': 'бревно = 6 досок',
                'honest': per_log}
    n = max(1, int(round(rate)))
    if abs(n - rate) / rate > MAX_CUT_DEVIATION:
        return None
    return {'input': rep, 'count': n, 'exact': False, 'per': '1 блок', 'honest': rate}


for i in sorted(form_cut):
    r = POOL[i]
    p = plan_cut(r)
    if p is None:
        CRAFTER.append(r)
    elif p.get('covered'):
        CUT_COVERED.append(r)
    else:
        CUT_GEN.append((r, p))

# одинаковые пары вход->выход на пиле — одна строка
_cut_seen = {}
CUT_DEDUP = []
for r, p in CUT_GEN:
    k = (p['input'], r.out)
    if k in _cut_seen:
        continue
    _cut_seen[k] = r
    CUT_DEDUP.append((r, p))

# ---------------------------------------------------------------------------
# Риски
# ---------------------------------------------------------------------------


def is_container(items):
    return any(it.endswith('_bucket') and it != 'minecraft:bucket' or it in CONTAINER_EXTRA for it in items)


def container_recipes(recs):
    return [r for r in recs if any(is_container(s) for s in r.slots)]


CONT_SHAPELESS = container_recipes(SHAPELESS)
CONT_MIXGEN = container_recipes(MIX_GEN)
OVER9 = [r for r in SHAPELESS + MIXING if len(r.slots) > 9]
MIX_DISTINCT_OVER9 = [r for r in SHAPELESS + MIX_GEN if len({sid(s) for s in r.slots}) > 9]

# Коллизии среди того, что миксер делает сам (бесформенные и create:mixing) — после проходов.
MIXER_COLLISIONS = [g for g in GROUPS2 if sum(1 for r in g if r.kind in ('shapeless', 'mixing')) >= 2]
MIX_DUP_WITH_EXISTING = [g for g in GROUPS2 if any(r.kind == 'mixing' for r in g) and any(r.kind == 'shapeless' for r in g)]

# ---------------------------------------------------------------------------
# Генерация JS
# ---------------------------------------------------------------------------


def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def js_ing(rep):
    if isinstance(rep, (list, tuple)):
        return 'Ingredient.of([' + ', '.join(js_str(x) for x in rep) + '])'
    return js_str(rep)


def js_out(item, n):
    return js_str(item if n == 1 else '%dx %s' % (n, item))


def rid_path(rid):
    ns, path = rid.split(':', 1)
    return '%s/%s' % (ns, re.sub(r'[^a-z0-9/._-]', '_', path.lower()))


def mod_of(r):
    return r.out.split(':')[0]


def write_js():
    lines = []
    A = lines.append
    A('// ==========================================================================')
    A('// «Вахта» — рецепты верстака, перенесённые на машины Create.')
    A('// АВТОГЕНЕРАЦИЯ: tools/vahta_recipes.py (не править руками — перезапустить скрипт).')
    A('// Отчёт и правила: docs/VAHTA.md (п.3), docs/VAHTA-RECIPES.md.')
    A('//')
    A('// mix — фигурные рецепты с уникальным набором ингредиентов -> create:mixing')
    A('//       (бесформенные миксер делает сам: allowShapelessInMixer).')
    A('// cut — формы из дерева/камня с совпадающим набором -> create:cutting')
    A('//       (пила с фильтром выбирает выход; выход пересчитан по числу досок/блоков).')
    A('// Ванильные рецепты НЕ удаляются: механические крафтеры используют их')
    A('// (allowRegularCraftingInCrafter).')
    A('// Формат строки mix: [id, выход, [ингредиенты]]; cut: [id, выход, вход].')
    A('// «3x предмет» в ингредиентах mix разворачивается ниже в три отдельных ингредиента')
    A('// (как делает крафт: каждый слот — один предмет).')
    A('// ==========================================================================')
    A('')
    A('var vahtaMixRecipes = [')
    by_mod = collections.defaultdict(list)
    for r in MIX_GEN:
        by_mod[mod_of(r)].append(r)
    for mod in sorted(by_mod):
        A('\t// --- %s (%d) ---' % (mod, len(by_mod[mod])))
        for r in sorted(by_mod[mod], key=lambda x: x.id):
            cnt = collections.OrderedDict()
            for x in sorted(r.reps, key=lambda x: x if isinstance(x, str) else '~' + '|'.join(x)):
                k = x if isinstance(x, str) else tuple(x)
                cnt[k] = cnt.get(k, 0) + 1
            ings = ', '.join(js_ing(k) if isinstance(k, tuple) and n == 1 else
                             (js_ing(list(k)) + ', ') * (n - 1) + js_ing(list(k)) if isinstance(k, tuple) else
                             js_str(k if n == 1 else '%dx %s' % (n, k)) for k, n in cnt.items())
            tail = ''
            if any(is_container(s) for s in r.slots):
                tail = ' // остаток-контейнер: проверить вживую'
            A('\t[%s, %s, [%s]],%s' % (js_str('nightshift:vahta/mix/' + rid_path(r.id)), js_out(r.out, r.count), ings, tail))
    A(']')
    A('')
    A('var vahtaCutRecipes = [')
    by_mod = collections.defaultdict(list)
    for r, p in CUT_DEDUP:
        by_mod[mod_of(r)].append((r, p))
    for mod in sorted(by_mod):
        A('\t// --- %s (%d) ---' % (mod, len(by_mod[mod])))
        for r, p in sorted(by_mod[mod], key=lambda x: x[0].id):
            note = ''
            if not p['exact']:
                note = ' // честно %.2f (%s) — округлено' % (p['honest'], p['per'])
            elif p['per'] != '1 блок':
                note = ' // %s' % p['per']
            A('\t[%s, %s, %s],%s' % (js_str('nightshift:vahta/cut/' + rid_path(r.id)), js_out(r.out, p['count']), js_str(p['input']), note))
    A(']')
    A('')
    A('ServerEvents.recipes(function (event) {')
    A('\tvar vahtaFailed = 0')
    A('\t// [\'2x a\', \'#b\'] -> [\'a\', \'a\', \'#b\']')
    A('\tvar vahtaExpand = function (list) {')
    A('\t\tvar res = []')
    A('\t\tfor (var k = 0; k < list.length; k++) {')
    A('\t\t\tvar m = typeof list[k] === \'string\' ? /^(\\d+)x (.+)$/.exec(list[k]) : null')
    A('\t\t\tif (!m) { res.push(nsIng(list[k])); continue }')
    A('\t\t\tfor (var n = 0; n < parseInt(m[1], 10); n++) res.push(nsIng(m[2]))')
    A('\t\t}')
    A('\t\treturn res')
    A('\t}')
    A('\tfor (var vahtaI = 0; vahtaI < vahtaMixRecipes.length; vahtaI++) {')
    A('\t\tvar vahtaM = vahtaMixRecipes[vahtaI]')
    A('\t\ttry {')
    A('\t\t\tevent.recipes.create.mixing(vahtaM[1], vahtaExpand(vahtaM[2])).id(vahtaM[0])')
    A('\t\t} catch (vahtaErr) {')
    A('\t\t\tvahtaFailed++')
    A("\t\t\tconsole.warn('[vahta] mixing ' + vahtaM[0] + ': ' + vahtaErr)")
    A('\t\t}')
    A('\t}')
    A('\tfor (var vahtaJ = 0; vahtaJ < vahtaCutRecipes.length; vahtaJ++) {')
    A('\t\tvar vahtaC = vahtaCutRecipes[vahtaJ]')
    A('\t\ttry {')
    A('\t\t\tevent.recipes.create.cutting(vahtaC[1], nsIng(vahtaC[2])).id(vahtaC[0])')
    A('\t\t} catch (vahtaErr2) {')
    A('\t\t\tvahtaFailed++')
    A("\t\t\tconsole.warn('[vahta] cutting ' + vahtaC[0] + ': ' + vahtaErr2)")
    A('\t\t}')
    A('\t}')
    A("\tconsole.info('[vahta] машинные рецепты: mixing ' + vahtaMixRecipes.length + ', cutting ' + vahtaCutRecipes.length + ', ошибок ' + vahtaFailed)")
    A('})')
    A('')
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


# ---------------------------------------------------------------------------
# Списки (docs/VAHTA-RECIPES-lists.md) и статистика
# ---------------------------------------------------------------------------


def fmt_rec(r):
    ings = collections.Counter(x if isinstance(x, str) else '[' + '|'.join(x) + ']' for x in r.reps)
    ing = ', '.join(('%d×%s' % (n, k) if n > 1 else k) for k, n in sorted(ings.items()))
    extra = ''
    if r.kind == 'mixing':
        extra = ' +жидк.' if r.fluids else ''
        extra += ' (нагрев)' if r.heated else ''
    return '`%s` → %s%s ← %s%s' % (r.id, ('%d× ' % r.count if r.count > 1 else ''), r.out, ing, extra)


KIND_RU = {'shaped': 'фигурный', 'shapeless': 'бесформенный', 'mixing': 'create:mixing'}


def write_lists():
    L = []
    A = L.append
    A('# «Вахта» — полные списки рецептов верстака (автоген)')
    A('')
    A('Сгенерировано `tools/vahta_recipes.py`. Сводка и выводы — `docs/VAHTA-RECIPES.md`.')
    A('')

    def section(title, rows):
        A('## %s (%d)' % (title, len(rows)))
        A('')
        for x in rows:
            A('- ' + x)
        A('')

    section('Особые / свой serializer / NBT — механическим крафтерам, проверить вживую',
            ['`%s` (%s) — %s' % (rid, src, why) for rid, src, why in sorted(SPECIAL)])
    section('Фигурные с совпадающим набором — остаются механическим крафтерам',
            [fmt_rec(r) for r in sorted(CRAFTER, key=lambda r: r.id)])
    section('Коллизии среди того, что миксер делает сам (бесформенные и create:mixing)',
            ['; '.join('%s [%s]' % (fmt_rec(r), KIND_RU[r.kind]) for r in sorted(g, key=lambda r: r.id)) for g in MIXER_COLLISIONS])
    section('Формы на пилу, уже покрытые stonecutting/create:cutting (не генерируются)',
            [fmt_rec(r) for r in sorted(CUT_COVERED, key=lambda r: r.id)])
    section('Уникальные формы, которые пила уже режет через stonecutting (mixing не генерируется)',
            [fmt_rec(r) for r in sorted(UNIQUE_FORM_ON_SAW, key=lambda r: r.id)])
    section('Фигурные, выход которых миксер уже делает (есть бесформенный/create:mixing на тот же выход)',
            ['%s ≈ `%s`' % (fmt_rec(r), o.id) for r, o in sorted(ALREADY_MIX, key=lambda x: x[0].id)])
    section('Бесформенные из 1 ингредиента — миксер не берёт, одиночный механический крафтер',
            [fmt_rec(r) for r in sorted(SINGLE, key=lambda r: r.id)])
    section('Квадратное сжатие 2×2/3×3 — пресс делает сам',
            [fmt_rec(r) for r in sorted(PRESS, key=lambda r: r.id)])
    section('Рецепты с тарой (вёдра, бутылки) — бесформенные', [fmt_rec(r) for r in sorted(CONT_SHAPELESS, key=lambda r: r.id)])
    section('Рецепты с тарой (вёдра, бутылки) — сгенерированный mixing', [fmt_rec(r) for r in sorted(CONT_MIXGEN, key=lambda r: r.id)])
    section('Рецепты верстака, которые в 1.21.1 не грузятся (формат 1.20) — игнорируются',
            ['`%s` (%s) — %s' % x for x in sorted(BROKEN)])
    section('create:mechanical_crafting и родственные — механические крафтеры',
            ['`%s` (%s)' % (rid, t) for rid, src, t in sorted(MECH)])
    with open(OUT_LISTS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))


def group_summary(g):
    kinds = collections.Counter(r.kind for r in g)
    outs = sorted({r.out for r in g})
    return {'size': len(g), 'kinds': dict(kinds), 'sample': [fmt_rec(r) for r in sorted(g, key=lambda r: r.id)[:6]],
            'outs_sample': outs[:10], 'forms': sum(1 for r in g if r.kind == 'shaped' and is_form(r))}


def main():
    write_js()
    write_lists()
    by_mod_mix = collections.Counter(mod_of(r) for r in MIX_GEN)
    by_mod_cut = collections.Counter(mod_of(r) for r, _ in CUT_DEDUP)
    inexact = [(r.id, r.out, p) for r, p in CUT_DEDUP if not p['exact']]
    st = {
        'total_recipes': len(ALL),
        'kubejs_removed': sorted(KJS_REMOVED),
        'kubejs_added': [a['id'] for a in KJS_ADDED],
        'kubejs_notes': KJS_NOTES,
        'skipped': {k: len(v) for k, v in skipped.items()},
        'unknown_conditions_assumed_true': dict(UNKNOWN_CONDITIONS),
        'craft_total': len(SHAPELESS) + len(SINGLE) + len(SHAPED) + len(PRESS) + len(SPECIAL),
        'shapeless_mixer_auto': len(SHAPELESS),
        'shapeless_single': len(SINGLE),
        'press_auto': len(PRESS),
        'press_auto_shaped': sum(1 for r in PRESS if r.kind == 'shaped'),
        'shaped_total': len(SHAPED),
        'shaped_mix_generated': len(MIX_GEN),
        'shaped_dup_same_output': len(DUP_SAME),
        'shaped_already_in_mixer': len(ALREADY_MIX),
        'shaped_collisions_pass1': sum(1 for r in SHAPED if EDGES1.get(idx_of[id(r)])),
        'forms_to_saw': len(form_cut),
        'cut_generated': len(CUT_DEDUP),
        'cut_generated_before_dedup': len(CUT_GEN),
        'cut_covered_by_stonecutting': len(CUT_COVERED),
        'unique_form_on_saw': len(UNIQUE_FORM_ON_SAW),
        'cut_inexact': len(inexact),
        'cut_inexact_sample': [(a, b, round(p['honest'], 2), p['count'], p['input']) for a, b, p in inexact[:40]],
        'crafter_shaped': len(CRAFTER),
        'special': len(SPECIAL),
        'special_by_reason': dict(collections.Counter(w.split(':')[0] if w.startswith('свой') else w for _, _, w in SPECIAL)),
        'special_types': dict(collections.Counter(w for _, _, w in SPECIAL if w.startswith('свой'))),
        'mech_crafting': len(MECH),
        'mixing_existing': len(MIXING),
        'groups_pass1': len(GROUPS1),
        'groups_pass1_top': [group_summary(g) for g in sorted(GROUPS1, key=len, reverse=True)[:15]],
        'groups_pass2': len(GROUPS2),
        'groups_pass2_top': [group_summary(g) for g in sorted(GROUPS2, key=len, reverse=True)[:15]],
        'group_size_hist_pass1': dict(sorted(collections.Counter(len(g) for g in GROUPS1).items())),
        'mixer_collision_groups': len(MIXER_COLLISIONS),
        'mixer_collision_recipes': sum(len(g) for g in MIXER_COLLISIONS),
        'mixer_collisions_top': [group_summary(g) for g in sorted(MIXER_COLLISIONS, key=len, reverse=True)[:12]],
        'mixer_dup_with_existing_mixing': len(MIX_DUP_WITH_EXISTING),
        'mixer_dup_with_existing_mixing_sample': [group_summary(g) for g in MIX_DUP_WITH_EXISTING[:12]],
        'containers_shapeless': len(CONT_SHAPELESS),
        'containers_mixgen': len(CONT_MIXGEN),
        'containers_mixgen_sample': [fmt_rec(r) for r in CONT_MIXGEN[:15]],
        'containers_shapeless_sample': [fmt_rec(r) for r in CONT_SHAPELESS[:15]],
        'over9': [fmt_rec(r) for r in OVER9],
        'distinct_over9': [fmt_rec(r) for r in MIX_DISTINCT_OVER9],
        'mix_gen_list_ingredient': sum(1 for r in MIX_GEN if any(isinstance(x, list) for x in r.reps)),
        'mix_gen_by_mod': dict(by_mod_mix.most_common()),
        'cut_gen_by_mod': dict(by_mod_cut.most_common()),
        'mix_gen_forms_unique': sum(1 for r in MIX_GEN if is_form(r)),
        'mix_gen_sample': [fmt_rec(r) for r in MIX_GEN[:25]],
        'special_sample': SPECIAL[:60],
        'mech_by_mod': dict(collections.Counter(rid.split(':')[0] for rid, _, _ in MECH).most_common()),
        'single_sample': [fmt_rec(r) for r in SINGLE[:10]],
        'crafter_sample': [fmt_rec(r) for r in CRAFTER[:30]],
        'crafter_by_mod': dict(collections.Counter(mod_of(r) for r in CRAFTER).most_common()),
    }
    with open(OUT_STATS, 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
    log('рецептов всего (с kubejs): %d' % st['total_recipes'])
    for k in ('craft_total', 'shapeless_mixer_auto', 'shapeless_single', 'press_auto', 'shaped_total',
              'shaped_mix_generated', 'shaped_dup_same_output', 'shaped_already_in_mixer', 'forms_to_saw', 'cut_generated',
              'cut_covered_by_stonecutting', 'unique_form_on_saw', 'cut_inexact', 'crafter_shaped', 'special', 'mech_crafting',
              'mixer_collision_groups', 'containers_shapeless', 'containers_mixgen'):
        log('  %-32s %s' % (k, st[k]))
    log('пропущено:', st['skipped'])
    for n in KJS_NOTES:
        log('kubejs:', n)
    log('->', os.path.relpath(OUT_JS, ROOT), os.path.relpath(OUT_LISTS, ROOT), os.path.relpath(OUT_STATS, ROOT))


main()
