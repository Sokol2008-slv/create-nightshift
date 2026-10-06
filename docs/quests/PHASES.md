# Фазы квест-бука: предмет → фаза → чем ограничен

Сгенерировано `tools/quest_phases.py --md` (06.10.2026) по указателю рецептов «Планшета инженера», снятому
с сервера после всех правок KubeJS (`tools/data/tablet-ways.json.gz`, 10 400 предметов, 290 жидкостей).

**Как считается фаза.** Для каждого предмета — самая ранняя фаза, в которой его можно сделать на «Вахте»:
фаза = min по рецептам(max(фазы входов, фазы машин способа, ворота)). Машина способа — по типу рецепта:
миксер/пресс/пила/жернов/вентилятор — ящик вахтовика (фаза 0); нагрев — горелка всполоха; крафтеры больше
9 клеток — новые крафтеры (латунь); деплоер, дозатор, дробильные колёса, сборка по шагам — свои машины по их
рецептам; экструдер на месторождении — форпост; электризатор и катушка Теслы — ещё и ток. Кузнечный стол
закрыт. Сырьё без рецепта — добыча (Незер — фаза 1, Край — 3, планеты — 8), особые источники (звездопад,
жетоны, набеги) — своя фаза. «Чем ограничен» — ворота, давшие максимум в самой дешёвой цепочке.

Правило книги: **фаза главы ≥ фазы предмета** (`quest_phases.py` без ключей пишет «РАНО» и возвращает 1).
Стоять позже можно (например, склад Create — фаза 1, а в книге в фазе 3 у поездов).

## Фазы и ворота

| Фаза | Глава | Первый квест (ворота в книге) | Требует | Ограничители фазы |
|---|---|---|---|---|
| 0 | Фаза 0 · Прибытие (`phase0`) | Прибытие | — | ящик и машины Create |
| 1 | Фаза 1 · Механика (`phase1`) | Вал и вращение | Сборочный пост (phase0) | ящик и машины Create |
| 2 | Фаза 2 · Пар и латунь (`phase2`) | Горелка всполоха | Слитки и листы: пресс (phase1) | горелка всполоха |
| 3 | Фаза 3 · Деплоер, поезда и склад (`phase3`) | Деплоер и механическая рука | Латунь (phase2), Электронная лампа (phase2) | деплоер, крафтеры сверх 9 из ящика |
| 4 | Фаза 4 · Форпосты (`phase4`) | Форпосты: как это работает | Дробильные колёса (phase3) | продукт месторождения (экструдер на форпосте) |
| 5 | Фаза 5 · Ток (`phase5`) | Генератор: заряд молнии | Волна 15: заряд молнии (altar) | волна 15: заряд молнии, ключи особых стадий (волны 22–43) |
| 6 | Фаза 6 · Сталь и нефть (`phase6`) | Чугун | Деплоер и механическая рука (phase3) | нефть: качалка |
| 7 | Фаза 7 · Небо (`phase7`) | Корпус самолёта | Бокситовый карьер (phase4) | метеорит: волна 10 и полёт, налёт в аэроклубе |
| 8 | Фаза 8 · Космос (`phase8`) | Ядро навигации — 50-я волна | Волна 50: ядро навигации (altar) | волна 50: ядро навигации, волна 70: звёздный осколок |

## Несостыковки, найденные при раскладке (06.10.2026)

- **Квесты на «исчезнувшие» предметы.** Almost Unified сводит свинец, стальной лист и сталь к TFMG: ни один рецепт не
  выдаёт `cgs:lead_ingot`, `cgs:steel_sheet`, `createbigcannons:steel_ingot` — квесты «Свинец», «Сталь для ружей»,
  «Стальные стволы» были невыполнимы. Теперь в них `tfmg:lead_ingot`, `tfmg:heavy_plate`, `tfmg:steel_ingot`.
- **Сталь — фаза 2, а не 6.** Миксер с нагревом: 2 железных слитка + уголь → 2 стали (`createbigcannons:mixing/alloy_steel`),
  ещё рецепт CGS с суперогнём. Поэтому ворота фазы 6 — деплоер (стальные механизмы TFMG) и нефть, а не сама сталь.
- **Склад Create 6 — фаза 1.** Упаковщик, складской передатчик, тикер и квакопорт делаются без латуни (железо, редстоун,
  картон, хранилище). В книге они в фазе 3 рядом с поездами — раньше можно, просто незачем.
- **Экструдер — фаза 1** (миксер: 3 белого стекла, андезитовый корпус, вал). Форпосты начинаются с загрузчика чанков
  (Незер: светокамень, жемчуг Края, якорь возрождения) и дробильных колёс (фаза 3) для боксита и серы.
- **Дробильные колёса — фаза 3.** Сборка 5×5 на 21 механическом крафтере, а крафтер — латунный корпус + лампа: без латуни
  есть только 9 крафтеров из ящика. То же со всеми рецептами крупнее 9 клеток (генератор C&A — есть раскладка 3×3).
- **Электромедь требует деплоер** (фаза 3) кроме заряда молнии — ворота фазы 5 двойные: волна 15 и деплоер.
- **Самолёт — фаза 4.** Биплан Immersive Aircraft — алюминий и кварцевое стекло с форпостов, ни тока, ни стали. Штуковины
  Simulated / Aeronautics (пропеллер, портативный двигатель) летают уже в фазе 2–3. Метеориты — с 10-й волны и полётом.
- **Прокатный стан и электризатор** собираются в фазе 1 (без электромеди), но без тока бесполезны — стоят в фазе 5.
- **Рассудок до фазы 4.** Успокоительное и настойка жизни — споры «Грибных пещер» (фаза 4); раньше — только травяной чай
  (миксер с нагревом, фаза 2). В «Первой ночи» больше не советуем таблетки.
- **Дубли предметов:** «Горелка под котлом» и «Горелка всполоха» — один предмет (оставлены обе: первая про нагрев котла);
  12 квестов-дублей удалены (см. CHANGELOG).
- **Буровая** (аддон 0.7.0) — в рецепте электромедь, поэтому фаза 5, хотя ставится на месторождения фазы 4.

## Квесты по главам

Фаза предмета меньше фазы главы — можно сделать раньше (квест стоит там, где предмет нужен по сюжету).

### Путь смены

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Как читать эту книгу | `minecraft:written_book` | 0 | добыча |
| Фаза 0 · Прибытие | `create:mechanical_crafter` | 0 | ящик вахтовика |
| Фаза 0 · Прибытие | `minecraft:oak_planks` | 0 | добыча / ящик |
| Фаза 0 · Прибытие | `minecraft:stone_pickaxe` | 0 | добыча / ящик |
| Фаза 0 · Прибытие | `minecraft:torch` | 0 | добыча / ящик |
| Фаза 1 · Механика | `create:iron_sheet` | 0 | добыча / ящик |
| Фаза 1 · Механика | `create:andesite_alloy` | 0 | добыча / ящик |
| Фаза 1 · Механика | `create:andesite_casing` | 0 | добыча / ящик |
| Фаза 1 · Механика | `projecte:transmutation_table` | 0 | добыча / ящик |
| Фаза 2 · Пар и латунь | `create:blaze_burner` | 2 | горелка всполоха |
| Фаза 2 · Пар и латунь | `create:brass_ingot` | 2 | горелка всполоха |
| Фаза 2 · Пар и латунь | `create:brass_casing` | 2 | горелка всполоха |
| Фаза 2 · Пар и латунь | `create:electron_tube` | 1 | Незер |
| Фаза 2 · Пар и латунь | `create:steam_engine` | 0 | добыча / ящик |
| Фаза 3 · Деплоер, поезда и склад | `create:crushing_wheel` | 3 | крафтеры сверх 9 из ящика |
| Фаза 3 · Деплоер, поезда и склад | `create:crushed_raw_iron` | 3 | крафтеры сверх 9 из ящика |
| Фаза 3 · Деплоер, поезда и склад | `create:deployer` | 3 | деплоер |
| Фаза 3 · Деплоер, поезда и склад | `create:precision_mechanism` | 3 | деплоер |
| Фаза 3 · Деплоер, поезда и склад | `create:controls` | 3 | деплоер |
| Фаза 4 · Форпосты | `create_power_loader:andesite_chunk_loader` | 1 | Незер |
| Фаза 4 · Форпосты | `createaddition:capacitor` | 4 | форпост: Солеварня |
| Фаза 4 · Форпосты | `create_new_age:redstone_magnet` | 4 | форпост: Магнитная аномалия |
| Фаза 4 · Форпосты | `nightshift:smokeless_powder` | 4 | форпост: Серный источник |
| Фаза 4 · Форпосты | `tfmg:rubber_sheet` | 4 | форпост: Каучуковая плантация |
| Фаза 5 · Ток | `nightshift:electric_copper` | 5 | волна 15: заряд молнии |
| Фаза 5 · Ток | `createaddition:rolling_mill` | 0 | добыча / ящик |
| Фаза 5 · Ток | `createaddition:alternator` | 5 | волна 15: заряд молнии |
| Фаза 5 · Ток | `createaddition:copper_spool` | 0 | добыча / ящик |
| Фаза 5 · Ток | `createaddition:connector` | 0 | добыча / ящик |
| Фаза 5 · Ток | `axiomativ:tesla_tower` | 5 | волна 15: заряд молнии |
| Фаза 6 · Сталь и нефть | `tfmg:steel_ingot` | 2 | горелка всполоха |
| Фаза 6 · Сталь и нефть | `tfmg:crude_oil_bucket` | 6 | нефть: качалка |
| Фаза 6 · Сталь и нефть | `tfmg:steel_distillation_controller` | 3 | крафтеры сверх 9 из ящика |
| Фаза 6 · Сталь и нефть | `tfmg:diesel_bucket` | 6 | нефть: качалка |
| Фаза 6 · Сталь и нефть | `tfmg:regular_engine` | 2 | горелка всполоха |
| Фаза 7 · Небо | `immersive_aircraft:biplane` | 4 | форпост: Бокситовый карьер |
| Фаза 7 · Небо | `immersive_aircraft:rotary_cannon` | 0 | добыча / ящик |
| Фаза 7 · Небо | `nightshift:pilot_license_3` | 7 | налёт в аэроклубе |
| Фаза 7 · Небо | `nightshift:meteor_iron` | 7 | метеорит: волна 10 и полёт |
| Фаза 8 · Космос | `nightshift:navigation_core` | 8 | волна 50: ядро навигации |
| Фаза 8 · Космос | `northstar:iron_space_suit_chestpiece` | 4 | форпост: Торфяник |
| Фаза 8 · Космос | `axiomativ:interplanetary_alloy` | 8 | планета |
| Фаза 8 · Космос | `nightshift:star_pickaxe` | 8 | планета |
| Фаза 8 · Космос | `kubejs:axiomite_ingot` | 8 | планета |

### Фаза 0 · Прибытие — фаза 0

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Прибытие | `minecraft:written_book` | 0 | добыча |
| Инженерные очки | `create:goggles` | 0 | добыча / ящик |
| Гаечный ключ | `create:wrench` | 0 | добыча / ящик |
| Сборочный пост | `create:mechanical_crafter` | 0 | ящик вахтовика |
| Заглушка слота | `create:crafter_slot_cover` | 0 | добыча / ящик |
| Пила: доски и палки | `minecraft:oak_planks` | 0 | добыча / ящик |
| Кирка и спуск в шахту | `minecraft:stone_pickaxe` | 0 | добыча / ящик |
| Первый клинок | `minecraft:stone_sword` | 0 | добыча / ящик |
| Лук и арбалет | `minecraft:bow` | 0 | добыча / ящик |
| Щит | `minecraft:shield` | 0 | добыча / ящик |
| Стена и сколько её грызут | `minecraft:cobblestone` | 0 | добыча / ящик |
| Коридор-ловушка | `minecraft:iron_bars` | 0 | добыча / ящик |
| Козырёк от пауков | `minecraft:cobblestone_slab` | 0 | добыча / ящик |
| Запас света | `minecraft:torch` | 0 | добыча / ящик |
| Точка возрождения | `minecraft:red_bed` | 0 | добыча / ящик |

### Фаза 1 · Механика — фаза 1

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Вал и вращение | `create:shaft` | 0 | добыча / ящик |
| Шестерня | `create:cogwheel` | 0 | добыча / ящик |
| Большая шестерня | `create:large_cogwheel` | 0 | добыча / ящик |
| Лента, депо и шлюзы | `create:belt_connector` | 0 | добыча / ящик |
| Фильтр: пила, чаша, шлюз | `create:filter` | 0 | добыча / ящик |
| Водяное колесо | `create:water_wheel` | 0 | добыча / ящик |
| Большое водяное колесо | `create:large_water_wheel` | 0 | добыча / ящик |
| Ветряк: подшипник и паруса | `create:windmill_bearing` | 0 | добыча / ящик |
| Первый металл: жернов и промывка | `minecraft:iron_nugget` | 0 | добыча / ящик |
| Просеиватель и сетки | `createsifter:sifter` | 0 | добыча / ящик |
| Слитки и листы: пресс | `minecraft:iron_ingot` | 0 | добыча / ящик |
| Железная броня | `minecraft:iron_chestplate` | 0 | добыча / ящик |
| Алмазная броня | `minecraft:diamond_chestplate` | 0 | добыча / ящик |
| Самопал | `cgs:flintlock` | 0 | добыча / ящик |
| Андезитовый сплав — миксером | `create:andesite_alloy` | 0 | добыча / ящик |
| Разметчик базы | `nightshift:base_marker` | 0 | добыча / ящик |
| Блок базы и алтарь | `nightshift:base_core` | 0 | добыча / ящик |
| Андезитовый корпус | `create:andesite_casing` | 0 | добыча / ящик |
| Пила в полу | `create:mechanical_saw` | 0 | добыча / ящик |
| Вентилятор с лавой | `create:encased_fan` | 0 | добыча / ящик |
| Мясорубка | `create:mechanical_saw` | 0 | добыча / ящик |
| Стол трансмутации | `projecte:transmutation_table` | 0 | добыча / ящик |
| Столовая открыта | `minecraft:bread` | 0 | добыча / ящик |
| Нож | `farmersdelight:flint_knife` | 0 | добыча / ящик |
| Разделочная доска | `farmersdelight:cutting_board` | 0 | добыча / ящик |
| Кастрюля | `farmersdelight:cooking_pot` | 0 | добыча / ящик |
| Огонь: плита и сковорода | `farmersdelight:stove` | 0 | добыча / ящик |
| Суп дня | `farmersdelight:bone_broth` | 0 | добыча / ящик |
| Дикие грядки | `farmersdelight:cabbage_seeds` | 0 | добыча / ящик |
| Посадка | `farmersdelight:tomato_seeds` | 0 | добыча / ящик |
| Богатая почва | `farmersdelight:organic_compost` | 0 | добыча / ящик |
| Урожай | `farmersdelight:tomato` | 0 | грядка Farmer's Delight |
| Кухня без рук | `farmersdelight:tomato_sauce` | 0 | добыча / ящик |
| Праздничный бургер | `farmersdelight:hamburger` | 0 | добыча / ящик |
| Хлеб на потоке | `create:dough` | 0 | добыча / ящик |
| Насест | `create_integrated_farming:roost` | 0 | добыча / ящик |
| Рыболовная сеть | `create_integrated_farming:fishing_net` | 0 | добыча / ящик |
| Сладкий цех | `create:bar_of_chocolate` | 0 | добыча / ящик |
| Мясо из клетки | `cagedmobs:hopping_mob_cage` | 0 | добыча / ящик |
| Медь и цинк | `create:zinc_ingot` | 0 | добыча / ящик |
| Экструдер: своя порода | `create_mechanical_extruder:mechanical_extruder` | 0 | добыча / ящик |
| Рудная порода | `create:crimsite` | 0 | добыча / ящик |

### Фаза 2 · Пар и латунь — фаза 2

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Горелка всполоха | `create:blaze_burner` | 2 | горелка всполоха |
| Травяной чай | `nightshift:herbal_tea` | 2 | горелка всполоха |
| Эссенция волшебства | `irons_spellbooks:arcane_essence` | 2 | горелка всполоха |
| Книга заклинаний | `irons_spellbooks:copper_spell_book` | 0 | добыча / ящик |
| Свитки | `irons_spellbooks:scroll` | 1 | лут, свитки магов |
| Начертательный стол | `irons_spellbooks:inscription_table` | 0 | добыча / ящик |
| Кузница свитков | `irons_spellbooks:scroll_forge` | 1 | Незер |
| Чернила | `irons_spellbooks:common_ink` | 2 | горелка всполоха |
| Алхимический котёл | `irons_spellbooks:alchemist_cauldron` | 2 | горелка всполоха |
| Волшебная наковальня | `irons_spellbooks:arcane_anvil` | 0 | добыча / ящик |
| Мантия странствующего мага | `irons_spellbooks:wandering_magician_chestplate` | 2 | горелка всполоха |
| Роба волшебника | `irons_spellbooks:wizard_chestplate` | 2 | горелка всполоха |
| Посохи мода | `irons_spellbooks:graybeard_staff` | 2 | горелка всполоха |
| Чугун и плавка | `createbigcannons:cast_iron_ingot` | 2 | горелка всполоха |
| Формы и отливка | `createbigcannons:casting_sand` | 0 | добыча / ящик |
| Сверление | `createbigcannons:cast_iron_cannon_barrel` | 2 | горелка всполоха |
| Казённик и затвор | `createbigcannons:cast_iron_sliding_breechblock` | 2 | горелка всполоха |
| Снаряды | `createbigcannons:bag_of_grapeshot` | 0 | добыча / ящик |
| Автопушка | `createbigcannons:cast_iron_autocannon_barrel` | 2 | горелка всполоха |
| Автоподача патронов | `cbc_firepower_components:autocannon_ammo_feed` | 2 | горелка всполоха |
| Латунь | `create:brass_ingot` | 2 | горелка всполоха |
| Пневмомолот | `cgs:hammer` | 2 | горелка всполоха |
| Незеритовая головка | `cgs:hammer_netherite` | 1 | лут Незера (бастион) |
| Булава | `minecraft:mace` | 0 | добыча / ящик |
| Трезубец | `minecraft:trident` | 0 | добыча / ящик |
| Незеритовая броня | `minecraft:netherite_chestplate` | 1 | лут Незера (бастион) |
| Латунный корпус | `create:brass_casing` | 2 | горелка всполоха |
| Шаблон голема | `modulargolems:metal_golem_template` | 0 | добыча / ящик |
| Голые части: пила | `modulargolems:metal_golem_body` | 0 | добыча / ящик |
| Часть из металла | `modulargolems:metal_golem_legs` | 0 | добыча / ящик |
| Голем в сборе | `modulargolems:metal_golem_holder` | 0 | добыча / ящик |
| Улучшения | `modulargolems:empty_upgrade` | 0 | добыча / ящик |
| Бессмертный голем | `modulargolems:recycle` | 1 | Незер |
| Жезл команды | `modulargolems:command_wand` | 0 | добыча / ящик |
| Андезитовый голем | `creategolemsgalore:industrial_iron_hat` | 0 | добыча / ящик |
| Электронная лампа | `create:electron_tube` | 1 | Незер |
| Уборка без рук | `create_integrated_farming:vacuum_harvester` | 2 | горелка всполоха |
| Пар: котёл из баков | `create:fluid_tank` | 0 | добыча / ящик |
| Горелка под котлом | `create:blaze_burner` | 2 | горелка всполоха |
| Вода для котла | `create:mechanical_pump` | 0 | добыча / ящик |
| Паровой двигатель | `create:steam_engine` | 0 | добыча / ящик |
| Яйцо дракона | `dmr:dragon_egg` | 1 | снабженец или ящик снабжения: с волны 5 |
| Приручение | `minecraft:cod` | 0 | добыча / ящик |
| Седло | `minecraft:saddle` | 0 | добыча / ящик |
| Броня и сундук | `dmr:dragon_armor` | 1 | снабженец, лут |
| Свисток | `dmr:dragon_whistle.red` | 0 | добыча / ящик |

### Фаза 3 · Деплоер, поезда и склад — фаза 3

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Деплоер и механическая рука | `create:deployer` | 3 | деплоер |
| Деплоер с мечом | `create:deployer` | 3 | деплоер |
| Охота на стражей | `creategbd:guardian_beam_capacitor` | 1 | стражи океанских монументов |
| Лазерная турель | `creategbd:basic_laser_turret` | 3 | крафтеры сверх 9 из ящика |
| Продвинутая турель | `creategbd:advanced_laser_turret` | 3 | крафтеры сверх 9 из ящика |
| Реактивный ранец | `create_jetpack:jetpack` | 3 | крафтеры сверх 9 из ящика |
| Портативная дрель | `create_sa:portable_drill` | 3 | деплоер |
| Экзоскелеты | `create_sa:andesite_exoskeleton_chestplate` | 3 | крафтеры сверх 9 из ящика |
| Магнитная блокопушка | `create_sa:block_picker` | 1 | Незер |
| Латунный дрон | `create_sa:brass_drone_item` | 3 | деплоер |
| Механизм точности | `create:precision_mechanism` | 3 | деплоер |
| Упаковщик и квакопорт | `create:packager` | 0 | добыча / ящик |
| Складской тикер | `create:stock_ticker` | 0 | добыча / ящик |
| Рюкзак | `sophisticatedbackpacks:backpack` | 0 | добыча / ящик |
| Улучшение «Кормление» | `sophisticatedbackpacks:feeding_upgrade` | 0 | добыча / ящик |
| Складской контроллер | `sophisticatedstorage:controller` | 1 | Незер |
| Механический рассадник | `create_mechanical_spawner:mechanical_spawner` | 3 | крафтеры сверх 9 из ящика |
| Жидкости призыва | `create_mechanical_spawner:spawn_fluid_random_bucket` | 2 | горелка всполоха |
| Сборщик добычи | `create_mechanical_spawner:loot_collector` | 3 | крафтеры сверх 9 из ящика |
| Люк опыта | `create_enchantment_industry:experience_hatch` | 1 | Незер |
| Механическое точило | `create_enchantment_industry:mechanical_grindstone` | 0 | добыча / ящик |
| Всполох-чародей | `create_enchantment_industry:blaze_enchanter` | 2 | горелка всполоха |
| Дробильные колёса | `create:crushing_wheel` | 3 | крафтеры сверх 9 из ящика |
| Мифрил | `irons_spellbooks:mithril_ingot` | 3 | крафтеры сверх 9 из ящика |
| Сфера улучшения | `irons_spellbooks:upgrade_orb` | 3 | крафтеры сверх 9 из ящика |
| Броня школы | `irons_spellbooks:pyromancer_chestplate` | 3 | деплоер |
| Меч эха | `create_deep_dark:echo_sword` | 3 | деплоер |
| Броня эха | `create_deep_dark:echo_armor_chestplate` | 3 | деплоер |
| Шлем-излучатель | `creategbd:beam_reactor_helmet` | 3 | крафтеры сверх 9 из ящика |
| Дроблёная руда | `create:crushed_raw_iron` | 3 | крафтеры сверх 9 из ящика |
| Катализатор: груда руды | `create_compressed:crushed_iron_pile` | 3 | крафтеры сверх 9 из ящика |
| Латунный экструдер | `create_mechanical_extruder:mechanical_brass_extruder` | 3 | крафтеры сверх 9 из ящика |
| Детектор рудных жил | `createoreexcavation:vein_finder` | 1 | Незер |
| Пробоотборник | `createoreexcavation:sample_drill` | 3 | деплоер |
| Атлас рудных жил | `createoreexcavation:vein_atlas` | 0 | добыча / ящик |
| Буровая установка | `createoreexcavation:drilling_machine` | 3 | крафтеры сверх 9 из ящика |
| Сменный бур | `createoreexcavation:drill` | 0 | добыча / ящик |
| Сканер жил | `nightshift:vein_scanner` | 2 | горелка всполоха |
| Очиститель жилы | `nightshift:vein_cleaner` | 0 | добыча / ящик |
| Железнодорожный корпус | `create:railway_casing` | 3 | крафтеры сверх 9 из ящика |
| Рельсы | `create:track` | 3 | деплоер |
| Стрелочный перевод | `railways:track_switch_andesite` | 0 | добыча / ящик |
| Железнодорожная станция | `create:track_station` | 3 | крафтеры сверх 9 из ящика |
| Контроллер поезда | `create:controls` | 3 | деплоер |
| Первый поезд | `create:schedule` | 3 | крафтеры сверх 9 из ящика |
| Свисток вызова поезда | `railways:conductor_whistle` | 2 | горелка всполоха |
| Фактории: первый заказ | `nightshift:shift_token` | 1 | жетоны: тир, гонки, контракты |
| Касса на премию | `nightshift:shift_token` | 1 | жетоны: тир, гонки, контракты |
| Полная касса | `nightshift:shift_token` | 1 | жетоны: тир, гонки, контракты |
| Поезд до фактории | `create:portable_storage_interface` | 0 | добыча / ящик |

### Фаза 4 · Форпосты — фаза 4

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Форпосты: как это работает | `create_mechanical_extruder:mechanical_extruder` | 0 | добыча / ящик |
| Атлас месторождений | `nightshift:deposit_atlas` | 3 | деплоер |
| Андезитовый загрузчик чанков | `create_power_loader:empty_andesite_chunk_loader` | 1 | Незер |
| Латунный загрузчик чанков | `create_power_loader:empty_brass_chunk_loader` | 3 | крафтеры сверх 9 из ящика |
| Загрузчик чанков | `create_power_loader:andesite_chunk_loader` | 1 | Незер |
| Грибные пещеры | `nightshift:spores` | 4 | форпост: Грибные пещеры |
| Успокоительное | `nightshift:sedative` | 4 | форпост: Грибные пещеры |
| Настойка жизни | `nightshift:life_tonic` | 4 | форпост: Грибные пещеры |
| Торфяник | `nightshift:air_filter` | 4 | форпост: Торфяник |
| Высотный конденсатор | `nightshift:helium_canister` | 4 | форпост: Высотный конденсатор |
| Ледник | `nightshift:radiator` | 4 | форпост: Ледник |
| Балластная цистерна | `create_submarine:ballast_tank` | 0 | добыча / ящик |
| Балластный клапан | `create_submarine:ballast_vent` | 0 | добыча / ящик |
| Водомёт и винт | `create_submarine:water_thruster` | 0 | добыча / ящик |
| Прочное стекло | `create_submarine:iron_pressurizer` | 0 | добыча / ящик |
| Подлодка на глубине! | `create_submarine:barometer` | 0 | добыча / ящик |
| Электролизёр | `create_submarine:electrolyzer` | 1 | Незер |
| Кислородный диффузор | `create_submarine:oxygene_diffuser` | 4 | форпост: Торфяник |
| Солеварня | `nightshift:rock_salt` | 4 | форпост: Солеварня |
| Конденсатор | `createaddition:capacitor` | 4 | форпост: Солеварня |
| Магнитная аномалия | `nightshift:magnetite_dust` | 4 | форпост: Магнитная аномалия |
| Серный источник | `tfmg:sulfur_dust` | 4 | форпост: Серный источник |
| Каучуковая плантация | `tfmg:rubber_sheet` | 4 | форпост: Каучуковая плантация |
| Колёсное крепление | `offroad:wheel_mount` | 0 | добыча / ящик |
| Шины | `offroad:tire` | 4 | форпост: Каучуковая плантация |
| Бур-вездеход | `offroad:borehead_bearing` | 0 | добыча / ящик |
| Оружейный порох | `nightshift:smokeless_powder` | 4 | форпост: Серный источник |
| Пороховой заряд | `createbigcannons:powder_charge` | 4 | форпост: Серный источник |
| Крепление и выстрел | `createbigcannons:cannon_mount` | 4 | форпост: Серный источник |
| Бумажные патроны | `cgs:paper_cartridge` | 4 | форпост: Серный источник |
| Свинец | `tfmg:lead_ingot` | 3 | крафтеры сверх 9 из ящика |
| Сталь для ружей | `tfmg:heavy_plate` | 2 | горелка всполоха |
| Револьвер | `cgs:revolver` | 2 | горелка всполоха |
| Дробовик | `cgs:shotgun` | 3 | крафтеры сверх 9 из ящика |
| Гвоздемёт | `cgs:nailgun` | 3 | крафтеры сверх 9 из ящика |
| Гатлинг | `cgs:gatling` | 3 | крафтеры сверх 9 из ящика |
| Картофельная пушка | `create:potato_cannon` | 3 | деплоер |
| Осколочная граната | `cgs:frag_grenade` | 2 | горелка всполоха |
| Ракетница | `cgs:launcher` | 3 | крафтеры сверх 9 из ящика |
| Всполохомёт | `cgs:blazegun` | 3 | крафтеры сверх 9 из ящика |
| Кварцевый карьер | `nightshift:quartz_glass` | 4 | форпост: Кварцевый карьер |
| Линза | `nightshift:lens` | 4 | форпост: Кварцевый карьер |
| Модули брони | `nightshift:module_spring_boots` | 3 | деплоер |
| Прибор ночного видения | `nightshift:module_night_vision` | 4 | форпост: Кварцевый карьер |
| Бокситовый карьер | `tfmg:aluminum_ingot` | 4 | форпост: Бокситовый карьер |
| Обсерватория | `nightshift:star_chart` | 4 | форпост: Обсерватория |

### Фаза 5 · Ток — фаза 5

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Генератор: заряд молнии | `nightshift:lightning_charge` | 5 | волна 15: заряд молнии |
| Посох молнии | `nightshift:lightning_staff` | 5 | волна 15: заряд молнии |
| Молния в деплоере | `create:deployer` | 3 | деплоер |
| Электрическая медь | `nightshift:electric_copper` | 5 | волна 15: заряд молнии |
| Катушка динамо и магниты | `create_new_age:generator_coil` | 5 | волна 15: заряд молнии |
| Генератор TFMG | `tfmg:generator` | 5 | волна 15: заряд молнии |
| Узел снабжения | `axiomativ:supply_node` | 5 | волна 15: заряд молнии |
| Ранец снабжения | `axiomativ:supply_pack` | 5 | волна 15: заряд молнии |
| Ретранслятор снабжения | `axiomativ:supply_relay` | 5 | волна 15: заряд молнии |
| Дрон-помощник | `axiomativ:helper_drone` | 5 | волна 15: заряд молнии |
| Гнездо дронов | `axiomativ:drone_nest` | 5 | волна 15: заряд молнии |
| Улучшения дрона | `axiomativ:drone_upgrade_speed` | 5 | волна 15: заряд молнии |
| Пульт дрона | `axiomativ:drone_remote` | 5 | волна 15: заряд молнии |
| Прокатный стан | `createaddition:rolling_mill` | 0 | добыча / ящик |
| Генератор переменного тока | `createaddition:alternator` | 5 | волна 15: заряд молнии |
| Электризатор: зарядка током | `create_new_age:basic_energiser` | 0 | добыча / ящик |
| Нагреватель под котлом | `create_new_age:heater` | 1 | Незер |
| Котельная: теплообменник | `axiomativ:heat_exchanger` | 5 | волна 15: заряд молнии |
| Тепловой вентиль | `axiomativ:heat_valve` | 5 | волна 15: заряд молнии |
| ТЭН: тепло из тока | `axiomativ:heating_element` | 5 | волна 15: заряд молнии |
| Ремонтная стойка | `axiomativ:repair_rack` | 5 | волна 15: заряд молнии |
| Тепло: солнце и трубы | `create_new_age:basic_solar_heating_plate` | 4 | форпост: Кварцевый карьер |
| Двигатель Стирлинга | `create_new_age:stirling_engine` | 0 | добыча / ящик |
| Атом: торий | `create_new_age:thorium` | 0 | добыча: ториевая руда |
| Ядерное топливо | `create_new_age:nuclear_fuel` | 3 | деплоер |
| Ядерный реактор | `create_new_age:reactor_rod` | 4 | форпост: Ледник |
| Провод: медная катушка | `createaddition:connector` | 0 | добыча / ящик |
| Высоковольтный соединитель | `createaddition:large_connector` | 4 | форпост: Каучуковая плантация |
| Тесла-башня | `axiomativ:tesla_tower` | 5 | волна 15: заряд молнии |
| Секции: растим башню | `axiomativ:tesla_tower_coil` | 5 | волна 15: заряд молнии |
| Прожектор: видеть невидимок | `axiomativ:searchlight` | 5 | волна 15: заряд молнии |
| Накопитель: аккумулятор | `createaddition:modular_accumulator` | 4 | форпост: Солеварня |
| Буровая установка | `axiomativ:drilling_rig` | 5 | волна 15: заряд молнии |
| Энергощит | `axiomativ:energy_shield_mk1` | 5 | волна 15: заряд молнии |
| Электромотор: ток во вращение | `createaddition:electric_motor` | 4 | форпост: Магнитная аномалия |
| Энергофорпост: ячейка | `axiomativ:energy_cell` | 5 | волна 15: заряд молнии |
| Зарядная станция | `axiomativ:charging_station` | 5 | волна 15: заряд молнии |
| Геотермальный генератор | `axiomativ:geothermal_generator` | 5 | волна 15: заряд молнии |
| Гидрогенератор | `axiomativ:hydro_generator` | 5 | волна 15: заряд молнии |
| Разрядная станция | `axiomativ:discharging_station` | 5 | волна 15: заряд молнии |
| Поезд с ячейками | `create:portable_storage_interface` | 0 | добыча / ящик |
| Диспетчерская | `axiomativ:dispatch_monitor` | 5 | волна 15: заряд молнии |
| Датчик диспетчерской | `axiomativ:dispatch_sensor` | 5 | волна 15: заряд молнии |

### Фаза 6 · Сталь и нефть — фаза 6

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Чугун | `tfmg:cast_iron_ingot` | 2 | горелка всполоха |
| Коксовая печь | `tfmg:coke_oven` | 2 | горелка всполоха |
| Коксовая пыль — топливо домны | `tfmg:coal_coke_dust` | 3 | крафтеры сверх 9 из ящика |
| Огнеупорный кирпич | `tfmg:fireproof_bricks` | 0 | добыча / ящик |
| Воздухонагреватель | `tfmg:blast_stove` | 2 | горелка всполоха |
| Доменная печь | `tfmg:blast_furnace_output` | 2 | горелка всполоха |
| Флюс: известняковый песок | `tfmg:limesand` | 3 | крафтеры сверх 9 из ящика |
| Первая сталь | `tfmg:steel_ingot` | 2 | горелка всполоха |
| Укрепления домны | `tfmg:blast_furnace_reinforcement` | 2 | горелка всполоха |
| Стальные стволы | `tfmg:steel_ingot` | 2 | горелка всполоха |
| Фугасы и взрыватели | `createbigcannons:he_shell` | 4 | форпост: Серный источник |
| Магазин на 3 выстрела | `cbc_firepower_components:cannon_magazine_loader` | 4 | форпост: Серный источник |
| Компактные лафеты | `cbc_firepower_components:compact_autocannon_mount` | 4 | форпост: Серный источник |
| Крупнокалиберная автопушка | `cbc_firepower_components:large_autocannon_breech` | 3 | деплоер |
| Сканер поверхности | `tfmg:surface_scanner` | 3 | деплоер |
| Гравий, песок и пыль | `minecraft:sand` | 0 | добыча / ящик |
| Обсидиан | `minecraft:obsidian` | 0 | добыча / ящик |
| Земля и ил | `minecraft:dirt` | 0 | добыча / ящик |
| Призрачная обработка | `minecraft:soul_sand` | 1 | Незер |
| Туф, кальцит, капельник | `minecraft:tuff` | 0 | добыча / ящик |
| Незерак без Незера | `minecraft:netherrack` | 1 | Незер |
| Синий лёд | `minecraft:blue_ice` | 0 | добыча / ящик |
| Базальт | `minecraft:basalt` | 1 | Незер |
| Эндерняк | `minecraft:end_stone` | 3 | Край |
| Фабрика блоков | `createsifter:brass_sifter` | 2 | горелка всполоха |
| Радар | `create_radar:radar_bearing` | 4 | форпост: Магнитная аномалия |
| Монитор и связь | `create_radar:monitor` | 3 | деплоер |
| Сетевой контроллер | `create_radar:network_filterer` | 3 | деплоер |
| Наводчики | `create_radar:auto_yaw_controller` | 3 | деплоер |
| Разрешение на выстрел | `create_radar:fire_controller` | 3 | деплоер |
| ПВО | `minecraft:phantom_membrane` | 0 | добыча / ящик |
| Нефтяная качалка | `tfmg:pumpjack_base` | 3 | деплоер |
| Нефть | `tfmg:crude_oil_bucket` | 6 | нефть: качалка |
| Второй путь: колонна CDG | `createdieselgenerators:distillation_controller` | 0 | добыча / ящик |
| Дизельный двигатель | `createdieselgenerators:diesel_engine` | 2 | горелка всполоха |
| Топливо без нефти | `createdieselgenerators:bulk_fermenter` | 0 | добыча / ящик |
| Перегонная башня TFMG | `tfmg:steel_distillation_controller` | 3 | крафтеры сверх 9 из ящика |
| Бензин, дизель, керосин | `tfmg:diesel_bucket` | 6 | нефть: качалка |
| Двигатель TFMG | `tfmg:regular_engine` | 2 | горелка всполоха |
| Большой двигатель | `tfmg:large_engine` | 4 | форпост: Ледник |
| Мотор на ходу | `tfmg:gasoline_bucket` | 6 | нефть: качалка |

### Фаза 7 · Небо — фаза 7

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Корпус самолёта | `immersive_aircraft:hull` | 4 | форпост: Бокситовый карьер |
| Физический сборщик | `simulated:physics_assembler` | 0 | добыча / ящик |
| Первая штуковина | `create:super_glue` | 0 | добыча / ящик |
| Авиаторские очки | `aeronautics:aviators_goggles` | 0 | добыча / ящик |
| Пропеллер | `aeronautics:andesite_propeller` | 0 | добыча / ящик |
| Пропеллер своими руками | `aeronautics:propeller_bearing` | 2 | горелка всполоха |
| Гироскоп: вертолёт | `aeronautics:gyroscopic_propeller_bearing` | 4 | форпост: Бокситовый карьер |
| Портативный двигатель | `simulated:red_portable_engine` | 0 | добыча / ящик |
| Руль: штурвал и подшипник | `simulated:swivel_bearing` | 0 | добыча / ящик |
| Газ | `simulated:throttle_lever` | 2 | горелка всполоха |
| Взлёт! | `simulated:steering_wheel` | 0 | добыча / ящик |
| Датчик высоты | `simulated:altitude_sensor` | 0 | добыча / ящик |
| Крылья | `createpropulsion:wing` | 0 | добыча / ящик |
| Реактивный двигатель | `createpropulsion:thruster` | 2 | горелка всполоха |
| Пульт управления | `aeroworks:control_desk` | 3 | деплоер |
| Оболочка аэростата | `aeronautics:white_envelope` | 4 | форпост: Высотный конденсатор |
| Горелка аэростата | `aeronautics:adjustable_burner` | 0 | добыча / ящик |
| Левитит | `aeronautics:levitite` | 4 | форпост: Высотный конденсатор |
| Биплан: готовый самолёт | `immersive_aircraft:biplane` | 4 | форпост: Бокситовый карьер |
| Ангар-док | `axiomativ:hangar_dock` | 5 | волна 15: заряд молнии |
| Аэроклуб: Пилот III | `nightshift:pilot_license_3` | 7 | налёт в аэроклубе |
| Пилот II | `nightshift:pilot_license_2` | 7 | налёт в аэроклубе |
| Пилот I | `nightshift:pilot_license_1` | 7 | налёт в аэроклубе |
| Грузовой дирижабль | `immersive_aircraft:cargo_airship` | 7 | налёт в аэроклубе |
| Форсаж I | `axiomativ:afterburner_1` | 7 | налёт в аэроклубе |
| Форсаж II | `axiomativ:afterburner_2` | 7 | налёт в аэроклубе |
| Форсаж III | `axiomativ:afterburner_3` | 7 | налёт в аэроклубе |
| Аэрофотоаппарат | `nightshift:aerial_camera` | 7 | налёт в аэроклубе |
| Бронекорпус и экономайзер | `axiomativ:armored_hull` | 7 | налёт в аэроклубе |
| Энергопушка | `axiomativ:energy_cannon` | 7 | налёт в аэроклубе |
| Небесные острова | `nightshift:sky_crystal` | 0 | добыча / ящик |
| Звездопад | `nightshift:star_shard` | 0 | звездопад ночью |
| Кристалл из осколков | `nightshift:sky_crystal` | 0 | добыча / ящик |
| Сердце из звёзд | `nightshift:night_heart` | 1 | награда набегов (волны 5+) |
| Звёздный фонарь | `nightshift:star_lamp` | 4 | форпост: Обсерватория |
| Своя трасса | `nightshift:race_beacon` | 3 | деплоер |
| Метеорит | `nightshift:meteor_iron` | 7 | метеорит: волна 10 и полёт |
| Дроблёное метеоритное железо | `nightshift:crushed_meteor_iron` | 7 | метеорит: волна 10 и полёт |
| Слиток метеоритного железа | `nightshift:meteor_iron_ingot` | 7 | метеорит: волна 10 и полёт |
| Ранец снабжения Mk2 | `axiomativ:supply_pack_mk2` | 7 | метеорит: волна 10 и полёт |
| Межпространственный ретранслятор | `axiomativ:dimensional_relay` | 7 | метеорит: волна 10 и полёт |
| Антиграв | `axiomativ:antigrav_module` | 7 | метеорит: волна 10 и полёт |
| Рама врат | `axiomativ:gate_frame` | 5 | волна 15: заряд молнии |
| Врата перехода | `axiomativ:gate_controller` | 7 | метеорит: волна 10 и полёт |

### Фаза 8 · Космос — фаза 8

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Ядро навигации — 50-я волна | `nightshift:navigation_core` | 8 | волна 50: ядро навигации |
| Титан: варим на Земле | `northstar:titanium_ingot` | 3 | крафтеры сверх 9 из ящика |
| Закалённый механизм | `northstar:hardened_precision_mechanism` | 3 | деплоер |
| Ракетный ускоритель | `northstar:rocket_thruster` | 3 | крафтеры сверх 9 из ящика |
| Корпус и теплозащита | `create:industrial_iron_block` | 0 | добыча / ящик |
| Ракетное топливо | `northstar:biofuel_bucket` | 2 | горелка всполоха |
| Космические металлы | `northstar:titanium_ingot` | 3 | крафтеры сверх 9 из ящика |
| Схема и гравировальный станок | `northstar:circuit` | 3 | деплоер |
| Навигационный компьютер | `northstar:targeting_computer` | 4 | форпост: Обсерватория |
| Ракетная станция | `northstar:rocket_station` | 4 | форпост: Обсерватория |
| Контроллер ракеты | `northstar:rocket_controls` | 8 | волна 50: ядро навигации |
| Телескоп и записи | `northstar:astronomical_reading` | 8 | планета |
| Атлас и наука | `northstar:space_atlas` | 3 | крафтеры сверх 9 из ящика |
| Скафандр: все 4 части | `northstar:iron_space_suit_chestpiece` | 4 | форпост: Торфяник |
| Кислород: заправка | `northstar:oxygen_filler` | 4 | форпост: Торфяник |
| Сборка ракеты: по шагам | `northstar:rocket_controls` | 8 | волна 50: ядро навигации |
| Чек-лист перед стартом | `northstar:glowstone_torch` | 1 | Незер |
| Звёздная кирка — осколок 70-й волны | `nightshift:star_pickaxe` | 8 | планета |
| Автопосадка и Маяк | `northstar:auto_lander` | 8 | планета |
| Доставка с планет | `createendertransmission:item_transmitter` | 3 | крафтеры сверх 9 из ящика |
| Межпланетный навигатор | `northstar:interplanetary_navigator` | 8 | планета |
| Марсианская сталь | `northstar:martian_steel_ingot` | 8 | планета |
| Вольфрам с Меркурия | `northstar:tungsten_ingot` | 8 | планета |
| Межпланетное точило | `axiomativ:planetary_grindstone` | 8 | планета |
| Межпланетный сплав | `axiomativ:interplanetary_alloy` | 8 | планета |
| Звёздный навигатор | `nightshift:star_navigator` | 8 | планета |
| Аксиомит: руда → слиток | `kubejs:axiomite_ingot` | 8 | планета |
| Отчёт в штаб | `kubejs:axiomite_ingot` | 8 | планета |
| Отчёт в штаб | `kubejs:stabilite_ingot` | 8 | планета |
| Тактический ядерный заряд | `nightshift:tactical_nuke` | 8 | планета |
| Стабилит: две половинки | `kubejs:raw_light_stabilite` | 8 | планета |
| Стабилитовый слиток | `kubejs:stabilite_ingot` | 8 | планета |
| Стабилитовая кирка | `nightshift:stabilite_pickaxe` | 8 | планета |
| Квантовый ранец | `axiomativ:quantum_supply_pack` | 8 | планета |
| Броня из межпланетного сплава | `nightshift:alloy_chestplate` | 8 | планета |
| Энергощит Mk2 | `axiomativ:energy_shield_mk2` | 8 | планета |
| Генератор щита | `axiomativ:shield_generator` | 8 | планета |
| Посох сплава | `nightshift:alloy_staff` | 8 | планета |
| Посох равновесия | `nightshift:balance_staff` | 8 | планета |

### Набеги

| Квест | Предмет | Фаза предмета | Чем ограничен |
|---|---|---|---|
| Как ходит орда | `nightshift:base_marker` | 0 | добыча / ящик |
| Ящик снабжения | `nightshift:supply_crate` | 1 | снабженец |
| Осколок орды | `nightshift:horde_shard` | 1 | добыча набегов |
| Пыль орды | `nightshift:horde_dust` | 1 | добыча набегов |
| Эссенция пробуждения | `nightshift:awakening_essence` | 8 | волна 70: звёздный осколок |
| Сердце ночи | `nightshift:night_heart` | 1 | награда набегов (волны 5+) |
| Трофеи Cataclysm | `cataclysm:black_steel_ingot` | 5 | Cataclysm: структуры и боссы |

## Как пересчитать

1. Тестовый сервер: временный скрипт `zz_qbdump.js` в `kubejs/server_scripts/` сервера (не в пак) с командой `/qbdump` —
   обходит `TabletNet.serverIndex(server)` планшета (все рецепты после KubeJS, с машинами, нагревом, раскладкой крафтеров)
   и пишет строки `QBDUMP {...}` в лог. Скрипт и rcon-клиент — `~/projects/ns-patches/agentQB/`.
2. Строки из `logs/latest.log` → `tools/data/tablet-ways.json.gz` (`{"items": {id: [способ]}, "fluids": {...}}`).
3. `python3 tools/quest_phases.py` — сверка (код 1 при «РАНО»), `--md` — этот файл, `--item ID` — цепочка предмета.

