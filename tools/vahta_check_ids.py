#!/usr/bin/env python3
"""Сверка id в скриптах «Вахты» с дампом рецептов и тегов сборки.

Вытаскивает из JS все строки вида 'ns:path' (а также '#ns:tag' и '2x ns:id') и проверяет:
  - предметы/блоки/жидкости — встречаются ли в рецептах или тегах дампа
    (рецепты под условием mod_loaded отсутствующего мода не считаются);
  - '#теги' — есть ли такой тег предметов в дампе или во входах рецептов (теги NeoForge);
  - типы рецептов (для event.custom) — есть ли такой тип в дампе;
  - id рецептов (для event.remove) — есть ли такой рецепт в дампе;
  - свои id (vahta:...) пропускаются.
Дополнительно ищет конфликты: для event.recipes.create.<тип>(..., 'вход') — другие рецепты
того же типа с тем же единственным входом, которые скрипт не удаляет (Create выберет любой).

Запуск: python3 tools/vahta_check_ids.py [файлы.js ...]
По умолчанию — kubejs/server_scripts/vahta/*.js. Код выхода 1, если есть незнакомые id.
"""
import glob
import gzip
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECIPES = os.path.join(ROOT, 'tools', 'data', 'recipes-dump.json.gz')
TAGS = os.path.join(ROOT, 'tools', 'data', 'item-tags-dump.json.gz')
OWN_NS = ('vahta', 'nightshift')

ID_RE = re.compile(r"""['"](#?)(?:(\d+)x\s+)?([a-z0-9_.-]+:[a-z0-9_./-]+)['"]""")
ID_KEYS = ('item', 'id', 'fluid', 'block', 'blocks', 'output', 'result')


def load():
    recipes = json.load(gzip.open(RECIPES))
    tags = json.load(gzip.open(TAGS))
    return recipes, tags


def conditions_ok(j, present):
    for c in j.get('neoforge:conditions', []) or []:
        if c.get('type') == 'neoforge:mod_loaded' and c.get('modid') not in present:
            return False
        if c.get('type') == 'neoforge:not':
            return False  # «мод не загружен» — не разбираем, такие рецепты не учитываем
    return True


def walk_ids(o, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ID_KEYS and isinstance(v, str) and ':' in v and not v.startswith('#'):
                out.add(v)
            walk_ids(v, out)
    elif isinstance(o, list):
        for x in o:
            walk_ids(x, out)


def walk_tags(o, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'tag' and isinstance(v, str):
                out.add(v)
            walk_tags(v, out)
    elif isinstance(o, list):
        for x in o:
            walk_tags(x, out)


def known_ids(recipes, tags):
    present = {'minecraft', 'c', 'neoforge'} | {k.split(':')[0] for k in recipes}
    present |= {v.get('src', '').split('-')[0] for v in recipes.values()}
    ids = set()
    for v in recipes.values():
        if conditions_ok(v['json'], present):
            walk_ids(v['json'], ids)
    for vals in tags.values():
        for x in vals:
            if isinstance(x, str) and not x.startswith('#'):
                ids.add(x)
            elif isinstance(x, dict) and isinstance(x.get('id'), str) and not x['id'].startswith('#'):
                ids.add(x['id'])
    return ids, present


def known_tags(recipes, tags):
    # теги самого NeoForge (c:raw_materials/iron и т.п.) в дамп тегов не попали,
    # но встречаются во входах рецептов модов — их считаем известными
    known = set(tags)
    for v in recipes.values():
        walk_tags(v['json'], known)
    return known


def single_input(j):
    ing = j.get('ingredients')
    if not isinstance(ing, list) or len(ing) != 1 or not isinstance(ing[0], dict):
        return None
    i = ing[0]
    if 'item' in i:
        return i['item']
    if 'tag' in i:
        return '#' + i['tag']
    return None


def main(argv):
    files = argv or sorted(glob.glob(os.path.join(ROOT, 'kubejs', 'server_scripts', 'vahta', '*.js')))
    recipes, tags = load()
    ids, present = known_ids(recipes, tags)
    tag_names = known_tags(recipes, tags)
    types = {v['json'].get('type') for v in recipes.values()}

    unknown = []
    removed = set()
    checked = 0
    n_recipe_ids = 0
    for path in files:
        src = open(path, encoding='utf-8').read()
        # комментарии не проверяем
        code = re.sub(r'//[^\n]*', '', src)
        for m in ID_RE.finditer(code):
            is_tag, _, value = m.group(1), m.group(2), m.group(3)
            ns = value.split(':')[0]
            line = code.count('\n', 0, m.start()) + 1
            if ns in OWN_NS:
                continue
            checked += 1
            if is_tag:
                if value not in tag_names:
                    unknown.append((path, line, '#' + value, 'нет такого тега предметов'))
                continue
            if value in recipes:
                removed.add(value)  # для поиска конфликтов: вдруг это event.remove
            if value in ids or value in types:
                continue
            if value in recipes:
                n_recipe_ids += 1
                continue
            why = 'мод не в сборке' if ns not in present else 'нет в рецептах/тегах'
            unknown.append((path, line, value, why))

        # конфликты: create.<тип>(выходы, 'вход')
        for m in re.finditer(r"event\.recipes\.create\.(\w+)\((.*?),\s*'(#?[a-z0-9_.:/-]+)'\)", code):
            rtype, inp = 'create:' + m.group(1), m.group(3)
            for rid, v in recipes.items():
                j = v['json']
                if j.get('type') != rtype or rid in removed or not conditions_ok(j, present):
                    continue
                if single_input(j) == inp:
                    line = code.count('\n', 0, m.start()) + 1
                    print('КОНФЛИКТ %s:%d %s %s — уже есть %s' % (os.path.relpath(path, ROOT), line, rtype, inp, rid))

    print('проверено строк-id: %d, из них id рецептов (удаление): %d' % (checked, n_recipe_ids))
    if unknown:
        print('НЕЗНАКОМЫЕ id (%d):' % len(unknown))
        for path, line, value, why in unknown:
            print('  %s:%d  %s  — %s' % (os.path.relpath(path, ROOT), line, value, why))
        return 1
    print('все id известны')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
