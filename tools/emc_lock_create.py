#!/usr/bin/env python3
"""Технику модов Create — ни купить, ни продать (Георгий + Эльхан, 29.09).

Всем предметам модов семейства Create, кроме ресурсов и стройблоков, ставит EMC 0 в
config/ProjectE/custom_emc.json: такой предмет стол не сжигает и не продаёт, конденсатор и звено EMC его
не делают. Ресурсы (слитки, самородки, блоки металлов, руда, сырьё, пыль, самоцветы) и камни/дерево
остаются с ценой — их можно и купить, и продать.

Список предметов — выгрузка с сервера: админ-команда /emc_dump_items (kubejs/server_scripts/economy/
60_emc_dump.js) пишет kubejs/items_dump.json в папке сервера. После новых модов — выгрузить заново и
запустить:  python3 tools/emc_lock_create.py <путь к items_dump.json>
Старые нулевые записи заменяются целиком (все записи с "emc": 0 считаются сгенерированными).
"""
import json
import pathlib
import re
import sys

PACK = pathlib.Path(__file__).resolve().parent.parent
CUSTOM = PACK / 'config' / 'ProjectE' / 'custom_emc.json'
FAMILY_MODS = {'tfmg', 'railways', 'northstar', 'cbc_at', 'aeronautics', 'simulated', 'sable', 'copycats',
               'dndecor', 'dndesires', 'garnished', 'rechiseledcreate', 'interiors'}
RAW_RE = re.compile(r'(_ore$|^raw_|_raw_|:raw_)')
# ручные нули вне семейства Create (генератор пересоздаёт все нулевые записи — эти добавляет всегда)
MANUAL_ZERO = ['minecraft:nether_star']  # 29.09: звезду не продать и не купить (иначе ферма визеров = печатный станок)
# сплавы и полуфабрикаты — продукция завода, хоть и с тегом слитка/руды: блокируем в любом моде
# (иначе купил чужую сталь по тегу c:ingots/steel — и линия стали не нужна)
FACTORY_RE = re.compile(r'(brass|steel|bronze|cast_iron|andesite_alloy|crushed_)')


def family(ns):
    return ns.startswith('create') or ns in FAMILY_MODS


def main():
    dump = json.load(open(sys.argv[1] if len(sys.argv) > 1 else PACK.parent.parent / 'mc-nightshift-test/kubejs/items_dump.json'))['items']
    lock = []
    for it in dump:
        iid = it['id']
        if FACTORY_RE.search(iid.split(':')[1]) and (family(iid.split(':')[0]) or it['res']):
            lock.append(iid)
            continue
        if not family(iid.split(':')[0]) or it['res'] or it['build']:
            continue
        if RAW_RE.search(iid.split(':')[1]) or RAW_RE.search(iid):
            continue  # руда и сырьё без тегов (руда тория и т.п.)
        lock.append(iid)
    data = json.load(open(CUSTOM))
    locked = set(lock)
    # ручные цены на то, что теперь блокируется (сплавы), — убрать, иначе перебьют ноль
    kept = [e for e in data['entries'] if e.get('emc') != 0 and e.get('id') not in locked
            and not (e.get('tag') and FACTORY_RE.search(e['tag']))]
    have = {e.get('id') for e in kept}
    lock += [i for i in MANUAL_ZERO if i not in lock]
    data['entries'] = kept + [{'id': i, 'emc': 0} for i in sorted(lock) if i not in have]
    json.dump(data, open(CUSTOM, 'w'), ensure_ascii=False, indent=1)
    print('EMC 0: %d предметов, записей всего %d' % (len(lock), len(data['entries'])))


if __name__ == '__main__':
    main()
