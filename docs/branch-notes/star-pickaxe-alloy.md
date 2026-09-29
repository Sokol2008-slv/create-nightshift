# Ветка feat/star-pickaxe-alloy (от next, 30.09.2026)

## Что сделано
1. **Руды планет только Звёздной киркой.** Лут-таблицы `kubejs/data/kubejs/loot_table/blocks/{axiomite_ore,deepslate_axiomite_ore,light_stabilite_ore,dark_stabilite_ore}.json`:
   на пул добавлено условие `minecraft:match_tool` с `items: "#nightshift:star_tools"`. Тег — `kubejs/data/nightshift/tags/item/star_tools.json`
   (сейчас `nightshift:star_pickaxe`; «звёздный бур» потом добавить строкой в тег; предмет ещё и получает тег в startup-регистрации).
   - Почему лут-таблица: это единственный слой, через который проходит ЛЮБАЯ добыча (кирка, механический бур Create, взрыв, деплоер, `/loot`).
     Файл в `kubejs/data/kubejs/loot_table/blocks/` перекрывает виртуальную таблицу KubeJS (пак kubejs/data идёт после неё) — проверено на витрине: таблица `kubejs:blocks/axiomite_ore` с моим условием реально исполняется.
   - Сверху `NativeEvents` на `BlockEvent$BreakEvent` (`server_scripts/vahta/55_star_gate.js`): игрок с другим инструментом (не креатив) не ломает блок вовсе,
     в actionbar «Нужна звёздная кирка (награда 70-й волны)» (ключ `nightshift.msg.star_pickaxe_needed`), не чаще раза в 3 с. Буры Create BreakEvent игрока не создают — там работает только лут-таблица (блок ломается, дропа нет).
2. **Звёздный навигатор** `nightshift:star_navigator` (startup, `20_wave_items.js`; текстура — перекраска recovery_compass, `tools/gen_wave_items.py`).
   Рецепт (механический крафтер): `ACA / PNP / _D_` — A межпланетный сплав, C `northstar:advanced_circuit`, P `create:precision_mechanism`, N `nightshift:navigation_core`, D `northstar:circuit`.
   Ингредиенты нарочно НЕ с наших планет (иначе круг: чтобы долететь, нужен предмет с планеты).
   Хук — `EntityTravelToDimensionEvent` (NeoForge, отменяемый, вызывается из `Entity.changeDimension`): цель `nightshift:axiomativ` / `nightshift:yin_yang` (орбит у них нет).
   Правило: если среди игроков (сам игрок либо пассажиры ракеты/лодки) у кого-то нет навигатора в инвентаре (креатив пропускается) — перелёт отменён, всем в группе сообщение.
   Без игроков (пустая ракета, мобы) — пропускаем. Запасной слой — `PlayerChangedDimensionEvent`: прибывший без навигатора возвращается на общий спавн Земли (`execute in minecraft:overworld run tp`).
   Ракета Northstar: `RocketContraptionEntity.changeDimension` вызывает родительский changeDimension (событие для ракеты) до переноса пассажиров, при отмене возвращает null — по байткоду ракета просто не переносится.
3. **Големы**: материал `interplanetary_alloy` в `tools/gen_golem_planet.py` (атака 85, здоровье 1000, sweep 4, regen 8; fire/thunder/magic_immune, explosion_resistant 2, projectile_reject, armor_penetration 3, damage_cap 3, thorn 1; сборка на линии Create с 4 механизмами),
   перегенерированы `nightshift_planet.json`, рецепты `nightshift/recipe/golems/interplanetary_alloy_*`, 3 текстуры, lang. Уровни модификаторов не выше максимума в конфигах других паков-материалов.
4. **Ещё одна Звёздная кирка**: `nightshift:vahta/star_pickaxe_copy` — `AAA / _P_ / _S_`, A сплав, P `minecraft:netherite_pickaxe`, S `kubejs:stabilite_ingot`. Первая по-прежнему награда 70-й волны.
5. **EMC** (`config/ProjectE/custom_emc.json`): навигатор 131072; слитки аксиомита и стабилита 40960; сырьё (raw ×3) и 4 блока руды 20480; дроблёный аксиомит 0. Сплав EMC не получил (автоматом не считается — точило не из ProjectE) — осознанно, иначе дыра для трансмутации.
6. Lang ru/en, подсказки предметов (`client_scripts/wave_items_tooltips.js`), `packwiz refresh`, CHANGELOG.

## Файлы
`kubejs/server_scripts/vahta/55_star_gate.js` (новый), `kubejs/startup_scripts/vahta/20_wave_items.js`, `kubejs/data/kubejs/loot_table/blocks/*.json`, `kubejs/data/nightshift/tags/item/star_tools.json`,
`tools/gen_wave_items.py`, `tools/gen_golem_planet.py` + результаты генерации, `config/ProjectE/custom_emc.json`, lang, `CHANGELOG.md`.

## Как проверено (витрина ~/mc-nightshift-test, только server_scripts/data + reload)
- `/loot spawn ... mine <блок> <инструмент>`: star_pickaxe выдаёт raw_axiomite / raw_dark_stabilite; netherite_pickaxe и diamond_pickaxe — «Dropped 0 items».
- Рецепты навигатора, копии кирки и golems/interplanetary_alloy_* присутствуют в менеджере рецептов (в тестовой копии навигатор подменён компасом, т.к. предмет — startup); ошибок KubeJS от новых скриптов нет (старые ошибки чужих рецептов в логе были и раньше).
- Перелёт: тестовые сущности + прямой вызов `changeDimension` (сам `/tp` для мобов событие не вызывает): корова — пропущена; лодка с пассажиром без «навигатора» — отменена (null); с обоими «с навигатором» — перенесена; лодка с двумя (один без) — отменена. Тесты чистились: сущности убиты, forceload снят, тест-скрипты удалены.
- `server.getLevel`, `getSharedSpawnPos`, `scheduleInTicks` работают в KubeJS.

## Требует рестарта
`startup_scripts/vahta/20_wave_items.js` (предмет навигатора + тег на кирке) и lang/текстуры. До рестарта рецепт навигатора ссылается на несуществующий предмет; проверить после рестарта `/give @s nightshift:star_navigator`.

## Не проверено / риски
- Реальный полёт ракеты Northstar без навигатора и с ним (нет игрока-тестера): вывод по байткоду. Что делает ракета после отмены (статус DESCENDING, приземление рядом с местом старта? зависание в воздухе?) — смотреть вживую; если зависает, добавить в обработчик принудительную посадку/сообщение.
- BreakEvent-обработчик и actionbar не проверены с живым игроком (проверена только лут-таблица); `block.kjs$getKey()` вызывается в try/catch — при ошибке в консоли `[star_gate] сломан блок руды`, блок ломается как раньше (лут-таблица всё равно защитит).
- Запасной возврат на Землю — на общий спавн мира, не на точку старта ракеты.
- Существующие игроки, уже находящиеся на планетах, не затронуты (событие только при перелёте). Креатив обходит проверки.
- Навигатор нужен всем пассажирам; вошедший на планету через сторонний портал/команду без события попадает под запасной слой.
- Навигатор/сплав в фазовые теги (phase_*) не добавлялись.
