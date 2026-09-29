# Стабилит: две половинки (ветка feat/stabilite-yinyang)

## Что сделано
- Две руды: `kubejs:light_stabilite_ore` (только биом `nightshift:yin_yang_yang`, на кальците) и
  `kubejs:dark_stabilite_ore` (только биом `nightshift:yin_yang_yin`, на чернокамне). Прежний `kubejs:stabilite_ore`
  переименован в `light_stabilite_ore` (в main его не было).
- Два сырья: `kubejs:raw_light_stabilite` («Светлый стабилит»), `kubejs:raw_dark_stabilite` («Тёмный стабилит»).
  `raw_stabilite` и `crushed_raw_stabilite` удалены (дроблёной руды у стабилита больше нет).
- Генерация: `yin_yang_ore_{light,dark}_stabilite` (жила 5, 6 попыток на чанк, трапеция y −8…72), каждая прописана
  только в `features` своего биома + `minecraft:biome`. «Шов» y −16…16 убран.
- Слиток `kubejs:stabilite_ingot` — только рецепт `axiomativ:planetary_grinding` (светлый + тёмный → 1, 300 тиков),
  id `nightshift:planets/planetary_grinding/stabilite_ingot`. Дробилка/печь/доменка для стабилита удалены; аксиомит не тронут.
- Текстуры (tools/gen_planet_textures.py, перекраска): светлые руда/сырьё — белые, тёмные — чёрные; слиток инь-ян (split_diag).
- Lang ru/en, квесты главы «Космос» (yy_stabilite → светлый, новый yy_stabilite_dark, новый yy_stabilite_ingot, отчёт зависит
  от слитка), документация PLANETS.md / PLANETS-TESTING.md, CHANGELOG.

## Файлы
startup_scripts/planets/10_ores.js; server_scripts/planets/10_ore_recipes.js; data/nightshift/worldgen/{configured_feature,placed_feature}/yin_yang_ore_{light,dark}_stabilite.json;
worldgen/biome/yin_yang_{yin,yang}.json; tags/block/planet_carver_replaceables.json; data/kubejs/loot_table/blocks/{light,dark}_stabilite_ore.json;
текстуры; lang; tools/quests/spec_space.json + сгенерированные config/ftbquests/*; index.toml.

## Как проверено
- Тестовый сервер (reload): формат рецепта точила `axiomativ:planetary_grinding` с `{"item":...}` парсится без ошибок
  (проверено временным рецептом на старых предметах; файл на сервере возвращён к исходному, reload сделан).
  С новыми предметами рецепт на текущей витрине падает ТОЛЬКО потому, что предметы ещё не зарегистрированы.
- Генератор квестов без ошибок; JSON worldgen собран скриптом; текстуры просмотрены.

## Требует рестарта сервера (не проверено вживую)
Регистрация блоков/предметов (startup), worldgen (датапак), лут-таблицы, lang/текстуры. После рестарта проверить:
/give обоих сырьев, рецепт в JEI на точиле, `/locate biome` Инь и Ян + руда в своём биоме, лут алмазной киркой,
что в Инь нет светлой руды и в Ян нет тёмной. В существующих мирах ранее сгенерированные чанки со старой рудой
(`stabilite_ore` на шве) останутся с пустыми блоками — только тестовые миры.
