# «Вахта» — правила «ручного крафта нет» (ветка `vahta-rules`)

Реализация решений 2, 4, 5, 7 из [`VAHTA.md`](VAHTA.md). Minecraft здесь не запускался — всё ниже
проверено только по дампам (`tools/data/*.json.gz`), по jar модов (ProjectE 1.21.1-PE1.1.0, Create
6.0.10 — распакованы и прочитаны `javap`) и `node --check`. **Живую проверку нужно сделать локально**
— список в конце.

## Файлы

| Файл | Что делает |
|---|---|
| `kubejs/server_scripts/vahta/10_no_hand_crafting.js` | п.1 верстак не открывается, п.2 сетка 2×2 чистится |
| `kubejs/server_scripts/vahta/20_recipes.js` | п.3 карманные верстаки, п.4 плавка руды, п.5 доски/палки + рецепты пилы |
| `kubejs/server_scripts/vahta/30_projecte.js` | п.6 рецепты с философским камнем и их замены |
| `kubejs/server_scripts/economy/30_recipes.js` | (изменён) камень больше не добавляется, стол трансмутаций в миксере |
| `config/ProjectE/custom_emc.json` | п.6 цены EMC |
| `index.toml`, `pack.toml` | хэши packwiz обновлены под новые и изменённые файлы |

Клиентские скрипты не понадобились: всё проверяется на сервере. Скрыть удалённые предметы
(философский камень, апгрейды крафта) из JEI можно отдельно, если будут мешать.

## 1. Верстак не открывается

`BlockEvents.rightClicked` без фильтра по id: отменяем ПКМ, если блок
- `minecraft:crafting_table` или `minecraft:crafter` (у ванильного крафтера окно 3×3 — тот же верстак);
- или id содержит `crafting_table` / `workbench` (кроме `create:mechanical_crafter`);
- или блок в теге `c:player_workstations/crafting_tables` / `c:workbench`.

Над хотбаром — одна из фраз («Руками здесь ничего не собрать — нужен механический крафтер» и т.п.),
не чаще раза в 3 с. Shift + предмет в руке не отменяем (так ставят блок на верстак). Творческий режим
не трогаем.

Поиск по дампу: в сборке **нет других блоков-верстаков**. В теге предметов `c:workbench` лежит только
`minecraft:crafting_table`, тега `c:player_workstations/crafting_tables` в дампе нет (это тег NeoForge,
а дамп собран из jar модов). Блоков `*workbench*` / `*crafting_table*` у модов тоже нет. FastWorkbench
только ускоряет ванильный верстак. Проверка по тегу и шаблону имени оставлена на случай новых модов.

## 2. Сетка 2×2 в инвентаре

Раз в 5 тиков (`NS_VAHTA_GRID_PERIOD`) по всем игрокам (кроме творческого режима и наблюдателей)
смотрим `player.inventoryMenu`, слоты 1–4. Всё, что там лежит, забираем (`slot.remove`) и отдаём игроку
через `player.give`: что не влезло, падает под ноги. Потом `menu.broadcastChanges()` и строка над
хотбаром. Вся обработка в `try/catch`: при первой ошибке п.2 выключается до перезагрузки скриптов,
в лог пишется `[vahta] сетка 2×2: …`, а сам тик сервера не ломается.

## 3. Карманные верстаки — удалённые рецепты

| id | Почему |
|---|---|
| `sophisticatedbackpacks:crafting_upgrade`, `sophisticatedstorage:crafting_upgrade` | сетка 3×3 в рюкзаке/хранилище |
| `sophisticatedstorage:backpack_crafting_upgrade_from_storage_crafting_upgrade`, `…storage_crafting_upgrade_from_backpack_crafting_upgrade` | перегонка апгрейда между модами |
| `sophisticatedbackpacks:stonecutter_upgrade`, `sophisticatedstorage:stonecutter_upgrade` + 2 перегонки | ручная резка камня (на вахте режет пила, `allowStonecuttingOnSaw`) |
| `sophisticated*:chipped/*_upgrade` + перегонки (21 id) | «верстаки» Chipped. Мода Chipped в сборке нет, рецепты под условием `mod_loaded`. Удалены на случай, если мод добавят; удаление несуществующего id ничего не ломает |
| `create:crafting/appliances/crafting_blueprint` | чертёж крафта Create: висит на стене и крафтит по ПКМ прямо из инвентаря |
| `minecraft:crafter` | ванильный автокрафтер: окно 3×3 + редстоун. Окно у крафтеров, найденных в мире (испытательные камеры), закрыто п.1 |

**Crafting Tweaks** оставлен: он только добавляет кнопки (повернуть/сбалансировать/очистить) к уже
открытому окну крафта. Верстак не открывается, а сетку 2×2 очищает п.2, так что кнопкам не с чем
работать. **Polymorph** (выбор результата при конфликте рецептов) тоже работает только в окне крафта.

Не удалены (решить отдельно): `sophisticatedbackpacks:smithing_upgrade` и `anvil_upgrade`
(ручная кузня и наковальня). Это не крафт по сетке, но тоже «руками». См. «Известные дыры».

## 4. Печь руду не плавит — 218 рецептов

Удалены все `minecraft:smelting` и `minecraft:blasting`, у которых вход — руда, сырая руда или блок
руды: теги `c:ores*`, `c:raw_materials*`, `c:storage_blocks/raw_*`, `minecraft:*_ores`, имена `*_ore`,
`*_ore_*`, `raw_*_block`, а также `raw_*`, если на выходе слиток, самоцвет или пыль (так отсекается
еда вроде `raw_apple_pie`). Пришлось добавлять эти правила, потому что тегов NeoForge в дампе нет, и
ванильные `raw_iron/copper/gold` иначе не находились.

| Мод | Шт. | Что |
|---|---|---|
| `minecraft` | 42 | все ванильные руды (включая глубинные и незер) + `raw_iron/copper/gold` |
| `northstar` | 152 | руды Луны/Марса/Меркурия/Венеры, `raw_titanium_ore`, `raw_tungsten_ore`, `raw_martian_iron_ore` |
| `tfmg` | 9 | `raw_lead/nickel/lithium` |
| `cgs` | 6 | свинцовая руда и `raw_lead` |
| `createpropulsion` | 5 | платиновая руда и `raw_platinum` |
| `create` | 4 | цинковая руда и `raw_zinc` |

Полный список — в конце документа и в `NS_VAHTA_ORE_SMELT_IDS`.

**Crushed-руду не трогали.** `create:crushed_raw_*` и её рецепты плавки остаются: вентилятор Create
(bulk smelting/blasting) плавит по этим же типам рецептов. Путь: руда → дробилка → (промывка) →
вентилятор или печь. Отдельных модовых «печей», которые принимали бы руду, в дампе нет: все 23 014
рецептов проверены по типам. Руда на входе встречается ещё только в машинах (`create:cutting`
сырых алмаза и изумруда у COE, `dndesires:seething`, `northstar:engraving`), их не трогали.

Побочный эффект: вентилятор тоже больше не плавит сырую руду напрямую (`raw_iron` → слиток), только
дроблёную. Так и задумано.

## 5. Доски только пилой

Удалены рецепты верстака «бревно/древесина/стебель → доски» (17 id: 11 ванильных пород, включая
бамбук, 4 породы `northstar`, 2 `garnished`) и `minecraft:stick` («доски → палки»). Рецепт
`minecraft:stick_from_bamboo_item` (бамбук → палка) оставлен: доски в нём не участвуют.

**В Create 6.0.10 нет рецептов пилы для ванильных брёвен.** В jar, в `data/create/recipe/cutting/`,
лежат только `andesite_alloy`, `bamboo_planks` (доски → мозаика) и `compat/*` для модов, которых в
сборке нет. В дампе с ванильными брёвнами работают только формы для литья (CBC). Поэтому добавлены
свои `create:cutting` (id `nightshift:vahta/cutting/<ns>/<предмет>`):
- бревно/древесина → окорённое (1:1), для всех пород, у которых есть окорённый вариант;
- окорённое бревно/древесина → **6 досок** (бамбук: окорённый блок → 3 доски), `northstar:calorian_log` → 6 сразу (окорённого нет);
- `garnished:stripped_nut_wood` и `stripped_sepia_hyphae` → 6 досок (остальные рецепты пилы у Garnished уже есть);
- `#minecraft:planks` → **2 палки** (`nightshift:vahta/cutting/planks_to_sticks`).

Итого 51 рецепт для брёвен и 1 для палок. Если окажется, что Create всё-таки режет ванильные брёвна
кодом, в JEI появятся дубли — тогда удалить наши `strip` и `planks`.
Учтите: на ванильные брёвна у пилы теперь несколько рецептов (окорка + 20+ форм CBC). Без фильтра
пила перебирает их по очереди, поэтому для досок ставьте фильтр на окорённое бревно / доски.

## 6. ProjectE

**Философский камень убран.** Его рецепты `projecte:philosophers_stone` и `_alt` уже удалялись в
`economy/30_recipes.js`. Там же камень добавлялся как `nightshift:projecte/philosophers_stone`
(латунь + механизм точности + алмаз) — эту строку я убрал. В `vahta/30_projecte.js` удалены все 29
рецептов из дампа, где камень был ключом:
- `projecte:conversions/*`, 12 шт. (железо ↔ золото, алмаз ↔ изумруд, уголь ↔ древесный уголь и т.п.) —
  без замены: это ручная алхимия, её заменяет стол за EMC;
- топливо `projecte:alchemical_coal`, `mobius_fuel`, `aeternalis_fuel` и `projectexpansion:fuel/item/*`
  (11 цветов) — **замена в миксере**, иначе не будет тёмной материи:
  4 угля + редстоун, нагрев → алхимический уголь;
  дальше по цепочке 4 предыдущего + светокаменная пыль, перегрев → следующее
  (алх. уголь → мобиус → этерналис → magenta → pink → purple → violet → blue → cyan → green → lime → yellow → orange → white);
- `projecte:interdiction_torch`: камень в центре заменён механизмом точности;
- `projectexpansion:basic_alchemical_book`: камень заменён тёмной материей;
- `projecte:transmutation_table` (оригинал).

**Стол трансмутаций** (`nightshift:projecte/transmutation_table`, миксер без нагрева):
4 андезитовых сплава + андезитовый корпус + 2 редстоуна + 2 камня. Появляется сразу после первых
машин: сплав → корпус. Набор ингредиентов уникален, поэтому это миксер, а не крафтер (правило 3 из
`VAHTA.md`). Раньше стол требовал латунный блок, обсидиан и камень (P3).
Альтернатива, если редстоун на старте вахты окажется далеко: заменить его на 2 медных слитка.

### Цены EMC (`config/ProjectE/custom_emc.json`)

Формат сверен по коду ProjectE 1.21.1-PE1.1.0 (`CustomEMCParser`):
`{"comment": "...", "entries": [{"id": "ns:item", "emc": N} | {"tag": "ns:tag", "emc": N}]}`.
Файл читается из `config/ProjectE/custom_emc.json`.

| Что | EMC (по умолчанию → вахта) |
|---|---|
| руды, сырая руда, блоки сырой руды | **0 → 0** (не купить, не сжечь) |
| железный слиток (`+ #c:ingots/iron`) | 256 → **1024** |
| медный слиток | 128 → **512** |
| цинковый слиток | 128 (PEI) → **512** |
| латунный слиток | выводилось из рецепта → **768** |
| золотой слиток | 2048 → **4096** |
| уголь / редстоун | 128 / 64 → **256 / 128** |
| алх. уголь / мобиус / этерналис | 512 / 2048 / 8192 → **1152 / 4992 / 20352** (= стоимость новых рецептов в миксере) |
| булыжник, камень, глубинный сланец, андезит/диорит/гранит, туф, земля, песок, гравий, стекло, незерак, базальт, чернит, эндерняк, камни Create (известняк, скория, асурин и др.) | 1–16 → **1** |
| кальцит, глина (комок) | 32 / 16 → **4** |
| бетон и сухой бетон (16 цветов) | выводилось → **2** |
| доски (все 19 из `#minecraft:planks`) | 8 → **4** |

Самородки, металлические блоки, плиты, ступени, кирпичи и т.п. ProjectE выводит сам из рецептов.

**Почему так.**
- Руды. У ProjectE по умолчанию включены мапперы-«чёрные списки» (`OreBlacklistMapper`,
  `RawMaterialsBlacklistMapper`): они ставят EMC = 0 всем `c:ores` и `c:raw_materials`, причём как
  значение *after*, так что `custom_emc.json` их не перебьёт. Я их не выключал: руду нельзя купить за
  EMC вообще, её дают только шахта и машины. Это самый сильный вариант «руда дорогая». Если захотите
  продавать руду за EMC, выключите эти два маппера в серверном конфиге маппинга ProjectE (`mapping`,
  раздел мапперов; файл создаётся при первом запуске) и добавьте в `custom_emc.json`, например,
  `raw_iron` 1536, `iron_ore` 2048 (дороже слитка — переработка выгоднее).
- Слитки. Главный «бесплатный» источник EMC — булыжник (генератор + бур). Булыжник стоит 1, при
  `covalenceLoss = 0.5` и округлении вверх сжигается тоже за 1. Значит, железный слиток = 1024
  булыжника, это ~10 минут работы одного бура. Машинная линия (дробилка → промывка → вентилятор) даёт
  слиток из каждой сырой руды за секунды, да ещё с бонусными самородками. Разница на порядки, так
  что EMC остаётся «докупить недостающее», а не заменой производства. Сжечь слиток — получить
  половину (512), то есть выкупать металлы через EMC невыгодно.
- Стройблоки по 1–4: стол трансмутаций — удобный «строительный магазин», это и есть смысл раннего стола.
  Эксплойты «купил дешёвое → переработал → сжёг дороже» закрыты `covalenceLoss = 0.5`: чтобы
  заработать, переработка должна удваивать цену. Я проверил доски (бревно 32 → 6 досок по 4 = 24),
  бетон (8 песка/гравия + краситель → 8 сухого бетона по 2) и латунь (медь + цинк = 1024 → 2 латуни
  по 768, сжигание 768) — прибыли нет.
- Топливо ProjectE: цены равны стоимости ингредиентов новых рецептов (уголь 256 ×4 + редстоун 128 и т.д.),
  чтобы ProjectE не выводил их из несуществующих рецептов с камнем.

**Связанное, не трогал (решить):**
- `kubejs/data/nightshift/pe_custom_conversions/nightshift_units.json`: металлы TFMG, Northstar и др.
  (свинец 512, никель 1024, литий 2048, платина 4096, …). Теперь свинец дешевле железа (1024).
  Для согласованности их стоит умножить на 2–4. Отдельно не менял, потому что от этих цен зависят
  зонды жил;
- `nightshift_probes.json`: зонды стоят «1000 × цена единицы» по *старым* ценам. После подъёма
  железа/меди/золота зонды относительно подешевели (железный = 250 слитков вместо 1000);
- кто победит при совпадении id — `custom_emc.json` или `pe_custom_conversions` датапака — по коду
  не выяснил (оба ставят *before*). Поэтому совпадающих id в двух файлах нет.

## Известные дыры: другие «ручные» окна в модах сборки

| Где | Что | Предложение |
|---|---|---|
| ванильный камнерез | ручная резка камня | закрыть так же, как верстак (добавить `minecraft:stonecutter` в `NS_VAHTA_BENCH_IDS`), пила уже умеет |
| кузнечный стол | незеритовые инструменты и отделка брони — только здесь, у Create нет кузнечной машины | оставить (это «собирать») или сделать `create:item_application`/`deploying` |
| наковальня, точило, ткацкий станок, картографический стол, варочная стойка | ручная обработка | по вкусу; зелья у Create делает миксер |
| Rechiseled (долото) | окно превращения блока в варианты, как камнерез | закрыть ПКМ долотом или удалить рецепт долота |
| Farmer's Delight: разделочная доска, кухонный котёл, сковорода | нарезка ножом по ПКМ, готовка в окне | Slice & Dice автоматизирует; котёл — «печь для еды», можно оставить |
| Some Assembly Required | сборка бутербродов руками на столе | оставить (еда) |
| Sophisticated Backpacks `smithing_upgrade`, `anvil_upgrade` | кузня и наковальня в рюкзаке | удалить, если кузня тоже «руками нельзя» |
| рюкзаки на мобах (Sophisticated Backpacks) | в них могут быть случайные апгрейды, в том числе крафт | проверить серверный конфиг SB: список апгрейдов для рюкзаков мобов / выключенные предметы |
| JEI «+» → сетка 2×2 | предметы переносятся в сетку и до 5 тиков лежат там; быстрый Shift+клик по результату может успеть | см. проверку ниже; если успевает, ставить период 1 |
| сундуки лута, торговцы | готовые предметы, в том числе верстачные | вне правил крафта, решить отдельно |
| найденные в мире `minecraft:crafter` | окно закрыто, но воронка + редстоун крафтят | это уже автоматизация, оставить |
| рецепты-«особые» типы (`sophisticatedcore:upgrade_next_tier`, `sophisticatedstorage:storage_tier_upgrade*`, окраска, клонирование карт и книг и т.п.) | работали только в сетке | проверить, берёт ли их механический крафтер (`allowRegularCraftingInCrafter`); если нет — переписать на `create:mechanical_crafting` |

## Что проверить вживую

**п.2 (сетка 2×2) — главное:**
1. В логе нет `[vahta] сетка 2×2: …`. Если есть, значит, не нашлось `player.inventoryMenu` /
   `getSlot` / `remove` / `give` / `broadcastChanges`. Имя из ошибки заменить на то, что видит Rhino.
2. Положить предмет в сетку 2×2: через ≤¼ с он в инвентаре, результат (слот 0) пустой, над хотбаром
   — строка. Проверить на клиенте, что предмет не «призрак» (закрыть/открыть инвентарь).
3. Полный инвентарь → предмет из сетки падает под ноги.
4. JEI «+» (перенос рецепта в сетку 2×2) и сразу Shift+клик по результату: успевает ли скрафтить.
   Если да — `NS_VAHTA_GRID_PERIOD = 1`.
5. Творческий режим — сетка работает (так задумано).

**п.4 (плавка руды):**
6. Печь и доменная печь не берут `raw_iron`, `iron_ore`, `deepslate_*_ore`, руду Northstar. JEI не
   показывает плавку руды.
7. Вентилятор Create: `create:crushed_raw_iron` (и другие crushed) в огне/лаве → слиток. Сырая руда
   под вентилятором **не** плавится.
8. Печь по-прежнему делает стекло, уголь из брёвен, еду, камень из булыжника.

**Остальное:**
9. ПКМ по верстаку и найденному `minecraft:crafter` → отмена и строка; Shift + блок в руке по
   верстаку → блок ставится.
10. Пила: `oak_log` → `stripped_oak_log` → 6 досок; доска → 2 палки. Нет ли дублей в JEI от
    собственных рецептов Create.
11. Миксер: стол трансмутаций (сплав ×4 + андезитовый корпус + редстоун ×2 + камень ×2), алхимический
    уголь (нагрев), мобиус/этерналис (перегрев). Синтаксис `'4x ns:item'` и `.superheated()` в
    kubejs-create 2101.
12. ProjectE: `/projecte reloadEMC` или перезапуск, лог маппинга без ошибок разбора `custom_emc.json`;
    железный слиток = 1024, булыжник = 1, руда = 0.
13. Лог KubeJS: нет ошибок `event.remove({ id })` / `create.cutting`.

## Приложение: удалённые рецепты плавки руды (218)

<details><summary>список id</summary>

```
cgs:lead_ingot_from_blasting_deepslate_lead_ore
cgs:lead_ingot_from_blasting_lead_ore
cgs:lead_ingot_from_blasting_raw_lead
cgs:lead_ingot_from_smelting_deepslate_lead_ore
cgs:lead_ingot_from_smelting_lead_ore
cgs:lead_ingot_from_smelting_raw_lead
create:blasting/zinc_ingot_from_ore
create:blasting/zinc_ingot_from_raw_ore
create:smelting/zinc_ingot_from_ore
create:smelting/zinc_ingot_from_raw_ore
createpropulsion:blasting/platinum_ingot_from_deepslate_platinum_ore
createpropulsion:blasting/platinum_ingot_from_platinum_ore
createpropulsion:smelting/platinum_ingot_from_deepslate_platinum_ore
createpropulsion:smelting/platinum_ingot_from_platinum_ore
createpropulsion:smelting/platinum_ingot_from_raw_platinum
minecraft:coal_from_blasting_coal_ore
minecraft:coal_from_blasting_deepslate_coal_ore
minecraft:coal_from_smelting_coal_ore
minecraft:coal_from_smelting_deepslate_coal_ore
minecraft:copper_ingot_from_blasting_copper_ore
minecraft:copper_ingot_from_blasting_deepslate_copper_ore
minecraft:copper_ingot_from_blasting_raw_copper
minecraft:copper_ingot_from_smelting_copper_ore
minecraft:copper_ingot_from_smelting_deepslate_copper_ore
minecraft:copper_ingot_from_smelting_raw_copper
minecraft:diamond_from_blasting_deepslate_diamond_ore
minecraft:diamond_from_blasting_diamond_ore
minecraft:diamond_from_smelting_deepslate_diamond_ore
minecraft:diamond_from_smelting_diamond_ore
minecraft:emerald_from_blasting_deepslate_emerald_ore
minecraft:emerald_from_blasting_emerald_ore
minecraft:emerald_from_smelting_deepslate_emerald_ore
minecraft:emerald_from_smelting_emerald_ore
minecraft:gold_ingot_from_blasting_deepslate_gold_ore
minecraft:gold_ingot_from_blasting_gold_ore
minecraft:gold_ingot_from_blasting_nether_gold_ore
minecraft:gold_ingot_from_blasting_raw_gold
minecraft:gold_ingot_from_smelting_deepslate_gold_ore
minecraft:gold_ingot_from_smelting_gold_ore
minecraft:gold_ingot_from_smelting_nether_gold_ore
minecraft:gold_ingot_from_smelting_raw_gold
minecraft:iron_ingot_from_blasting_deepslate_iron_ore
minecraft:iron_ingot_from_blasting_iron_ore
minecraft:iron_ingot_from_blasting_raw_iron
minecraft:iron_ingot_from_smelting_deepslate_iron_ore
minecraft:iron_ingot_from_smelting_iron_ore
minecraft:iron_ingot_from_smelting_raw_iron
minecraft:lapis_lazuli_from_blasting_deepslate_lapis_ore
minecraft:lapis_lazuli_from_blasting_lapis_ore
minecraft:lapis_lazuli_from_smelting_deepslate_lapis_ore
minecraft:lapis_lazuli_from_smelting_lapis_ore
minecraft:quartz
minecraft:quartz_from_blasting
minecraft:redstone_from_blasting_deepslate_redstone_ore
minecraft:redstone_from_blasting_redstone_ore
minecraft:redstone_from_smelting_deepslate_redstone_ore
minecraft:redstone_from_smelting_redstone_ore
northstar:blasting/iron_ingot_from_martian_ore
northstar:blasting/mars_copper_ore
northstar:blasting/mars_deep_copper_ore
northstar:blasting/mars_deep_diamond_ore
northstar:blasting/mars_deep_gold_ore
northstar:blasting/mars_deep_iron_ore
northstar:blasting/mars_deep_quartz_ore
northstar:blasting/mars_deep_redstone_ore
northstar:blasting/mars_deep_titanium_ore
northstar:blasting/mars_deep_zinc_ore
northstar:blasting/mars_diamond_ore
northstar:blasting/mars_gold_ore
northstar:blasting/mars_iron_ore
northstar:blasting/mars_quartz_ore
northstar:blasting/mars_redstone_ore
northstar:blasting/mars_titanium_ore
northstar:blasting/mars_zinc_ore
northstar:blasting/mercury_copper_ore
northstar:blasting/mercury_deep_copper_ore
northstar:blasting/mercury_deep_diamond_ore
northstar:blasting/mercury_deep_glowstone_ore
northstar:blasting/mercury_deep_gold_ore
northstar:blasting/mercury_deep_iron_ore
northstar:blasting/mercury_deep_lapis_ore
northstar:blasting/mercury_deep_redstone_ore
northstar:blasting/mercury_deep_titanium_ore
northstar:blasting/mercury_deep_tungsten_ore
northstar:blasting/mercury_deep_zinc_ore
northstar:blasting/mercury_diamond_ore
northstar:blasting/mercury_glowstone_ore
northstar:blasting/mercury_gold_ore
northstar:blasting/mercury_iron_ore
northstar:blasting/mercury_lapis_ore
northstar:blasting/mercury_redstone_ore
northstar:blasting/mercury_titanium_ore
northstar:blasting/mercury_tungsten_ore
northstar:blasting/mercury_zinc_ore
northstar:blasting/moon_copper_ore
northstar:blasting/moon_deep_copper_ore
northstar:blasting/moon_deep_diamond_ore
northstar:blasting/moon_deep_glowstone_ore
northstar:blasting/moon_deep_gold_ore
northstar:blasting/moon_deep_iron_ore
northstar:blasting/moon_deep_lapis_ore
northstar:blasting/moon_deep_redstone_ore
northstar:blasting/moon_deep_titanium_ore
northstar:blasting/moon_deep_zinc_ore
northstar:blasting/moon_diamond_ore
northstar:blasting/moon_glowstone_ore
northstar:blasting/moon_gold_ore
northstar:blasting/moon_iron_ore
northstar:blasting/moon_lapis_ore
northstar:blasting/moon_redstone_ore
northstar:blasting/moon_titanium_ore
northstar:blasting/moon_zinc_ore
northstar:blasting/titanium_ingot_from_raw
northstar:blasting/tungsten_ingot_from_raw
northstar:blasting/venus_coal_ore
northstar:blasting/venus_copper_ore
northstar:blasting/venus_deep_copper_ore
northstar:blasting/venus_deep_diamond_ore
northstar:blasting/venus_deep_glowstone_ore
northstar:blasting/venus_deep_gold_ore
northstar:blasting/venus_deep_iron_ore
northstar:blasting/venus_deep_quartz_ore
northstar:blasting/venus_deep_redstone_ore
northstar:blasting/venus_deep_titanium_ore
northstar:blasting/venus_deep_zinc_ore
northstar:blasting/venus_diamond_ore
northstar:blasting/venus_glowstone_ore
northstar:blasting/venus_gold_ore
northstar:blasting/venus_iron_ore
northstar:blasting/venus_quartz_ore
northstar:blasting/venus_redstone_ore
northstar:blasting/venus_titanium_ore
northstar:blasting/venus_zinc_ore
northstar:smelting/iron_ingot_from_martian_ore
northstar:smelting/mars_copper_ore
northstar:smelting/mars_deep_copper_ore
northstar:smelting/mars_deep_diamond_ore
northstar:smelting/mars_deep_gold_ore
northstar:smelting/mars_deep_iron_ore
northstar:smelting/mars_deep_quartz_ore
northstar:smelting/mars_deep_redstone_ore
northstar:smelting/mars_deep_titanium_ore
northstar:smelting/mars_deep_zinc_ore
northstar:smelting/mars_diamond_ore
northstar:smelting/mars_gold_ore
northstar:smelting/mars_iron_ore
northstar:smelting/mars_quartz_ore
northstar:smelting/mars_redstone_ore
northstar:smelting/mars_titanium_ore
northstar:smelting/mars_zinc_ore
northstar:smelting/mercury_copper_ore
northstar:smelting/mercury_deep_copper_ore
northstar:smelting/mercury_deep_diamond_ore
northstar:smelting/mercury_deep_glowstone_ore
northstar:smelting/mercury_deep_gold_ore
northstar:smelting/mercury_deep_iron_ore
northstar:smelting/mercury_deep_lapis_ore
northstar:smelting/mercury_deep_redstone_ore
northstar:smelting/mercury_deep_titanium_ore
northstar:smelting/mercury_deep_tungsten_ore
northstar:smelting/mercury_deep_zinc_ore
northstar:smelting/mercury_diamond_ore
northstar:smelting/mercury_glowstone_ore
northstar:smelting/mercury_gold_ore
northstar:smelting/mercury_iron_ore
northstar:smelting/mercury_lapis_ore
northstar:smelting/mercury_redstone_ore
northstar:smelting/mercury_titanium_ore
northstar:smelting/mercury_tungsten_ore
northstar:smelting/mercury_zinc_ore
northstar:smelting/moon_copper_ore
northstar:smelting/moon_deep_copper_ore
northstar:smelting/moon_deep_diamond_ore
northstar:smelting/moon_deep_glowstone_ore
northstar:smelting/moon_deep_gold_ore
northstar:smelting/moon_deep_iron_ore
northstar:smelting/moon_deep_lapis_ore
northstar:smelting/moon_deep_redstone_ore
northstar:smelting/moon_deep_titanium_ore
northstar:smelting/moon_deep_zinc_ore
northstar:smelting/moon_diamond_ore
northstar:smelting/moon_glowstone_ore
northstar:smelting/moon_gold_ore
northstar:smelting/moon_iron_ore
northstar:smelting/moon_lapis_ore
northstar:smelting/moon_redstone_ore
northstar:smelting/moon_titanium_ore
northstar:smelting/moon_zinc_ore
northstar:smelting/titanium_ingot_from_raw
northstar:smelting/tungsten_ingot_from_raw
northstar:smelting/venus_coal_ore
northstar:smelting/venus_copper_ore
northstar:smelting/venus_deep_copper_ore
northstar:smelting/venus_deep_diamond_ore
northstar:smelting/venus_deep_glowstone_ore
northstar:smelting/venus_deep_gold_ore
northstar:smelting/venus_deep_iron_ore
northstar:smelting/venus_deep_quartz_ore
northstar:smelting/venus_deep_redstone_ore
northstar:smelting/venus_deep_titanium_ore
northstar:smelting/venus_deep_zinc_ore
northstar:smelting/venus_diamond_ore
northstar:smelting/venus_glowstone_ore
northstar:smelting/venus_gold_ore
northstar:smelting/venus_iron_ore
northstar:smelting/venus_quartz_ore
northstar:smelting/venus_redstone_ore
northstar:smelting/venus_titanium_ore
northstar:smelting/venus_zinc_ore
tfmg:blasting/lead_ingot_blasting
tfmg:blasting/lithium_ingot_blasting
tfmg:blasting/nickel_ingot_blasting
tfmg:smelting/lead_ingot
tfmg:smelting/lead_ingot_blasting
tfmg:smelting/lithium_ingot
tfmg:smelting/lithium_ingot_blasting
tfmg:smelting/nickel_ingot
tfmg:smelting/nickel_ingot_blasting
```

</details>
