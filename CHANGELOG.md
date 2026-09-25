# CHANGELOG — Create: Ночная смена

## [0.3.0] — 2026-09-25

### Added
- **Квестовая книга FTB Quests** — 14 глав, 189 квестов на русском: основы Create, руда и её удвоение,
  латунь и поезда, первый самолёт, дирижабли и машины, подлодки, сталь и нефть, топливо и двигатели,
  электричество, космос (до Луны), пушки, автоматизация, «Ночная смена» (выживание в темноте).
  В описаниях — рецепты, сборка и тонкости; каждое утверждение сверено с рецептами/подсказками модов,
  все предметы проверены по jar-файлам. Клавиша R в книге — рецепт (FTB XMod Compat).
- Генератор книги `tools/gen_quests.py` (раскладка Sugiyama, без наложений и линий через карточки)
  и превью `tools/preview_quests.py`.
- Удобства: FTB Ultimine + Create Ultimine, Inventory Profiles Next, Carry On (+ совместимость
  с Aeronautics), TrashSlot, Just Enough Resources, Comforts, Traveler's Titles, Pick Up Notifier,
  RightClickHarvest.
- **Автообновление**: Prism-инстанс с pre-launch packwiz-installer — сборка подтягивает изменения
  при каждом запуске с `raw.githubusercontent.com/Sokol2008-slv/create-nightshift/main/pack.toml`.

### Removed
- e4steam: для этой сборки не годится (лимит Steam ~256 КБ/с → таймаут входа), а при сбое IPC
  Steam-клиента («fatal stalled cross-thread pipe») ронял игру при запуске.

### Fixed
- id квестов/глав теперь без старшего бита: FTB Quests 2101 не находит перевод для отрицательных id
  (главы «Безымянный», квесты без описаний).
- PreLaunchCommand в instance.cfg экранируется (`"\"$INST_JAVA\" -jar …"`), иначе Prism склеивал `java-jar`.

### Changed
- Моды FTB подключены как CurseForge-метаданные (packwiz), а не jar в репозитории —
  лицензии позволяют стороннее скачивание, jar в публичный репозиторий не кладём.
- Основной способ совместной игры — выделенный сервер; e4steam для этой сборки не тянет (лимит Steam ~256 КБ/с).

### Validation
- Чистая установка через packwiz-installer: 248 файлов, 220 модов, 14 глав, шейдеры и options.txt — без ошибок.
- Проверка фактов квестов: исправлено ~40 утверждений, в т.ч. тупики «титан только на Луне»
  (есть химический путь), «электролизёр до Марса», «известковый песок из мира» (дробление известняка),
  «жёрнов дробит руду» (нет, только дробильные колёса).

## [0.2.0] — 2026-09-25

### Added
- Хоррор через атмосферу: Face of Horror (лица в тёмных углах, шёпот, скримеры), Server-Side
  Horror (тихие жуткие события, фейковые игроки), The Boy And The Bath.
- Кромешная тьма: True Darkness Biomes (без шейдеров) и настройки Complementary — пещеры без
  минимального света, ночь ×0.35, новолуние почти чёрное, мерцание факелов.
- LambDynamicLights — факел в руке светит (важно при полной темноте).
- Оптимизация: More Culling, FastSuite/FastWorkbench/FastFurnace (быстрый поиск рецептов при
  автокрафте), Ksyxis, Let Me Despawn, Flerovium; ModernFix dynamic resources.

### Changed
- Память по умолчанию 10 ГБ; инструкция: 8 ГБ для ПК с 16 ГБ ОЗУ, ZGC только при 32 ГБ+.

### Removed
- Пробовали и убрали: Kenny, ArPhEx, Enhanced Celestials — бегают толпой и убивают, а нужен
  страх, а не раздражение; Create LazyTick — перезаписывает тот же метод, что Enchantable Machinery.

### Validation
- Сервер: `Done`, ошибок загрузки нет. Клиент: старт 48 с, вход в мир, шейдер и темнота активны.

## [0.1.0] — 2026-09-25

### Added
- Сборка на Minecraft 1.21.1 + NeoForge 21.1.251, около 190 модов, ~16 тыс. предметов.
- Create 6 со всеми крупными аддонами: Aeronautics (самолёты, дирижабли, машины), Deep Seas
  (подлодки), Northstar Redux (ракеты и планеты), TFMG Community Edition (нефть, бензин),
  Diesel Generators, Crafts & Additions и New Age (электричество), Steam 'n' Rails (поезда),
  Big Cannons, Ore Excavation, Mechanical Spawner и десятки мелких аддонов.
- Хоррор: The Knocker, Cave Dweller ReEvolved, The Obsessed, Imposter, The Afterdark.
- Мир: Tectonic + Terralith, YUNG's, Towns & Towers, Structory; Distant Horizons.
- Шейдеры Complementary Reimagined (по умолчанию), Unbound, MakeUp Ultra Fast.
- e4steam — приглашения друзей через Steam (jar с CurseForge в `mods/`), голосовой чат.
- Русский язык по умолчанию, `tools/sync.py` — раскладка модов на сервер/клиент.

### Changed
- TFMG заменён на TFMG Community Edition 1.3.1: Bits 'n' Bobs несовместим с TFMG ≤ 1.2.2.

### Fixed
- Убран Extra Gauges: его библиотека Deployer API несовместима с Create Factory Logistics.
- Убран Reese's Sodium Options: несовместим с Sodium Options API (нужен Sodium Extra).
- Голосовой чат на стандартном порту: e4steam сам находит порт Simple Voice Chat.
- Убраны Sodium Dynamic Lights и Sodium Options API: заброшены с 2025, конфликтуют с Sodium 0.8.
- Все «серверные» моды (YUNG's, Lithostitched, Liquid Fuel и др.) помечены как общие: мир
  хостится внутри клиента, без них у игроков падает Tectonic и не генерируются структуры.
- Добавлен Yeetus Experimentus — убирает окно «экспериментальные настройки» при входе в мир.

### Validation
- Выделенный сервер: 165 модов, `Done (9.9s)`, ошибок загрузки нет (только лут/рецепты под
  отсутствующие моды — безобидно).
- Клиент (Prism, RTX 4070 Ti SUPER): загрузка ~40 с, вход в мир, шейдер Complementary активен.
- e4steam: «Steam LAN share ready», голосовой чат проброшен через Steam (UDP).
