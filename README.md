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
| Хоррор | Страх через атмосферу, а не толпы: The Knocker, Cave Dweller, The Obsessed, Imposter, Face of Horror, Boy and the Bath, Server-Side Horror, измерение The Afterdark; кромешная тьма ночью и в пещерах, свет факела в руке, объёмный звук |
| Мир | Tectonic + Terralith, все YUNG's, Towns & Towers, Structory, Create-структуры |
| Графика | Sodium + Iris, шейдеры Complementary Reimagined / Unbound / MakeUp Ultra Fast, Distant Horizons |
| Оптимизация | ModernFix (ресурсы по требованию), FerriteCore, Lithium, More Culling, Entity Culling, ImmediatelyFast, FastSuite, Ksyxis, Let Me Despawn и др. |

## Как поставить (каждому из троих)

1. Скачать и поставить **Prism Launcher** (prismlauncher.org) или **Modrinth App**.
2. Импортировать файл `Create-Nochnaya-Smena-<версия>.mrpack`:
   Prism → «Добавить экземпляр» → «Импорт» → выбрать файл.
3. Память в настройках экземпляра:
   - ПК с **16 ГБ** ОЗУ → выставить **8 ГБ**, больше не давать (иначе система убьёт игру);
   - ПК с **32 ГБ+** → **10 ГБ** и в «Аргументы JVM» вписать `-XX:+UseZGC -XX:+ZGenerational`.
   Перед игрой закрыть браузер с кучей вкладок и прочие тяжёлые программы.
4. Установить и запустить **Steam** (войти в аккаунт) — он нужен для приглашений.
   Minecraft запускать уже после Steam.
5. **Linux + Prism из Flatpak**: песочница не видит Steam. Один раз выполнить
   `flatpak override --user --filesystem=~/.steam --filesystem=~/.local/share/Steam org.prismlauncher.PrismLauncher`
   и перезапустить Prism.

## Как играть вместе (через Steam)

1. Хост заходит в свой мир → Esc → **«Открыть для сети»** → «Для друзей Steam».
2. Жмёт **«Пригласить друзей»** — приглашение приходит в Steam.
   Или копирует зелёный адрес `s-….steam` и кидает его в чат.
3. Друг принимает приглашение (или вставляет адрес в «Прямое подключение»).

Версия сборки у всех троих должна совпадать. Мир живёт на компьютере хоста.

Голосовой чат в игре — Simple Voice Chat, настройки и клавиша разговора — на **M**.
e4steam сам пробрасывает голос через Steam.

Хоррор-мод **Imposter** слушает голосовой чат и может передразнивать ваши голоса —
это его фишка. Кому некомфортно — выключить микрофон в меню голосового чата (M).

## Горячие клавиши

- **K** — шейдеры вкл/выкл (если лагает или в полёте глючит отрисовка кораблей).
  С шейдером ночь и пещеры кромешно тёмные — носите факел в руке, он светит.
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
