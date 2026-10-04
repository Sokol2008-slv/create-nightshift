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
               'dndecor', 'dndesires', 'garnished', 'rechiseledcreate', 'interiors',
               'cbc_firepower_components'}  # 01.10: CBC Firepower Components — лафеты, подача, магазины
RAW_RE = re.compile(r'(_ore$|^raw_|_raw_|:raw_)')
# ручные нули вне семейства Create (генератор пересоздаёт все нулевые записи — эти добавляет всегда)
MANUAL_ZERO = ['minecraft:nether_star', 'nightshift:life_tonic', 'nightshift:night_heart', 'nightshift:electric_copper']  # 29.09: звезду, настойку жизни и сердце ночи — не продать и не купить
# 30.09 (Георгий: «нельзя, чтобы наши слитки можно было покупать — тогда заряд слишком читерный»): металлы наших
# планет, Стабилитовая кирка и ядерный заряд — только добычей и крафтом
MANUAL_ZERO += ['kubejs:axiomite_ingot', 'kubejs:stabilite_ingot', 'kubejs:raw_axiomite', 'kubejs:raw_light_stabilite',
                'kubejs:raw_dark_stabilite', 'kubejs:crushed_raw_axiomite', 'kubejs:axiomite_ore', 'kubejs:deepslate_axiomite_ore',
                'kubejs:light_stabilite_ore', 'kubejs:dark_stabilite_ore', 'nightshift:stabilite_pickaxe', 'nightshift:tactical_nuke']
# 01.10: модули брони и энергощит — техника, только машинами
MANUAL_ZERO += ['nightshift:module_spring_boots', 'nightshift:module_step_assist', 'nightshift:module_sprint',
                'nightshift:module_jump_springs', 'nightshift:module_armor_plate', 'nightshift:module_night_vision',
                'nightshift:incomplete_armor_module', 'axiomativ:energy_shield_mk1', 'axiomativ:energy_shield_mk2']
# 04.10: тесла-башня (аддон 0.4.0) — оборона, только машинами
MANUAL_ZERO += ['axiomativ:tesla_tower', 'axiomativ:tesla_tower_coil', 'axiomativ:incomplete_tesla_tower_coil']
# 04.10: «Сеть форпостов» — месторождения, полуфабрикаты и продукция (алюминий, серная пыль, соль): только с форпоста.
# id предметов Ночной смены — из стартового скрипта (новые попадают сюда сами)
OUTPOSTS_JS = PACK / 'kubejs' / 'startup_scripts' / 'vahta' / '80_outposts.js'
if OUTPOSTS_JS.is_file():
    MANUAL_ZERO += [i for i in re.findall(r"create\('(nightshift:[a-z0-9_]+)'", OUTPOSTS_JS.read_text())
                    if i.split(':')[1] not in ('liquid_sulfur', 'electrolyte', 'helium', 'coolant')]
MANUAL_ZERO += ['nightshift:liquid_sulfur_bucket', 'nightshift:electrolyte_bucket', 'nightshift:helium_bucket', 'nightshift:coolant_bucket',
                'tfmg:aluminum_ingot', 'tfmg:aluminum_nugget', 'tfmg:aluminum_block', 'tfmg:sulfur_dust', 'cgs:sulfur', 'northstar:salt']
# 01.10: артефакты смены и материалы пробуждения (tools/gen_ns_artifacts.py) — ни купить, ни продать.
# id — из стартового скрипта, который пишет генератор (новые артефакты попадают сюда сами)
NS_ART_JS = PACK / 'kubejs' / 'startup_scripts' / 'vahta' / '30_ns_artifacts.js'
if NS_ART_JS.is_file():
    MANUAL_ZERO += re.findall(r"create\('(nightshift:[a-z0-9_]+)'", NS_ART_JS.read_text())  # и материалы пробуждения
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
