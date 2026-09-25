# Create: Ночная смена

Сборка на троих: Create со всеми крупными аддонами, самолёты и подлодки, нефть и бензин,
электричество, поезда, космос, плюс хоррор-мобы, красивая генерация мира и шейдеры.

**Minecraft 1.21.1 · NeoForge 21.1.251 · ~190 модов**

## Что внутри

| Направление | Моды |
|---|---|
| Самолёты, дирижабли, машины | Create Aeronautics (+ Propulsion, Aeroworks), Immersive Aircraft + Man of Many Planes |
| Подводные лодки | Create Deep Seas |
| Космос и планеты | Create: Northstar Redux — ракета из блоков Create, Луна, Марс, Венера |
| Нефть, бензин, дизель | TFMG Community Edition, Create: Diesel Generators, Create: Liquid Fuel |
| Электричество | Create Crafts & Additions, Create: New Age |
| Поезда | Steam 'n' Rails, Railways Navigator, Blocks & Bogies |
| Оружие | Create Big Cannons (+ Advanced Technologies), Create: Gunsmithing |
| Автоматизация ресурсов | Ore Excavation (бесконечные жилы), Mechanical Spawner (мобы), Sifting, Molten Vents, Enchantment Industry, фермы и кухня |
| Хоррор | The Knocker, Cave Dweller ReEvolved, The Obsessed, Imposter, измерение The Afterdark, объёмный звук |
| Мир | Tectonic + Terralith, все YUNG's, Towns & Towers, Structory, Create-структуры |
| Графика | Sodium + Iris, шейдеры Complementary Reimagined / Unbound / MakeUp Ultra Fast, Distant Horizons |

## Как поставить (каждому из троих)

1. Скачать и поставить **Prism Launcher** (prismlauncher.org) или **Modrinth App**.
2. Импортировать файл `Create-Nochnaya-Smena-<версия>.mrpack`:
   Prism → «Добавить экземпляр» → «Импорт» → выбрать файл.
3. В настройках экземпляра выставить память **10–12 ГБ** (минимум 8).
4. Установить и запустить **Steam** (войти в аккаунт) — он нужен для приглашений.

## Как играть вместе (через Steam)

1. Хост заходит в свой мир → Esc → **«Открыть для сети»** → «Для друзей Steam».
2. Жмёт **«Пригласить друзей»** — приглашение приходит в Steam.
   Или копирует зелёный адрес `s-….steam` и кидает его в чат.
3. Друг принимает приглашение (или вставляет адрес в «Прямое подключение»).

Версия сборки у всех троих должна совпадать. Мир живёт на компьютере хоста.

Голосовой чат в игре — клавиша **V** (Simple Voice Chat).

## Горячие клавиши

- **K** — шейдеры вкл/выкл (если лагает или в полёте глючит отрисовка кораблей)
- **O** — выбор шейдера (MakeUp Ultra Fast — для слабых видеокарт)
- **W** (над предметом в JEI) — Ponder, анимированная подсказка Create

## Для сборщика

Пак управляется [packwiz](https://packwiz.infra.link/). Правки — в этой папке, затем:

```bash
packwiz refresh
python3 tools/sync.py server ~/mc-nightshift-server   # раскладка на тест-сервер
bash ~/mc-nightshift-server/run_verify.sh             # проверка загрузки
packwiz mr export -o dist/Create-Nochnaya-Smena-<версия>.mrpack
```

e4steam есть только на CurseForge, поэтому его jar лежит прямо в `mods/`
и уходит в сборку как override.
