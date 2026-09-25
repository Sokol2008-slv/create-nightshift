# CHANGELOG — Create: Ночная смена

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
