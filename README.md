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

Сборка обновляется **сама** при каждом запуске — ставится один раз:

1. Скачать и поставить **Prism Launcher** (prismlauncher.org).
2. Prism → «Добавить экземпляр» → «Импорт» → выбрать `Create-Nochnaya-Smena.zip` (присылает Жора).
3. Запустить. Перед игрой откроется окошко packwiz — оно само скачает/обновит моды
   (первый раз ~250 файлов, дальше — только изменения).
4. Память: 8 ГБ, если в компе 16 ГБ ОЗУ; 10 ГБ, если 32+ (правый клик по сборке → «Изменить» → «Настройки»).

Под капотом: в экземпляре стоит pre-launch команда
`"$INST_JAVA" -jar packwiz-installer-bootstrap.jar https://raw.githubusercontent.com/Sokol2008-slv/create-nightshift/main/pack.toml`.

## Как играть вместе

Мир крутится на **выделенном сервере** у Жоры (адрес уже есть в списке серверов импортированной сборки):
«Сетевая игра» → «Ночная смена». Голос — в Discord.

Steam-приглашения (e4steam) убраны в 0.3.0: лимит Steam ~256 КБ/с не пропускает вход в сборку
на 200+ модов (таймаут через 30 с), а при сбое Steam-клиента мод ронял игру целиком.

## Квестовая книга

Кнопка книги — в инвентаре (FTB Quests). 14 глав: от первого андезитового сплава до самолёта,
подлодки, нефти, электричества и полёта на Луну. Прогресс общий, если объединиться в команду:
`/ftbteams party create НочнаяСмена`, `/ftbteams party invite <ник>`.
Клавиша **R** на предмете в квесте — рецепт (FTB XMod Compat).

## Горячие клавиши

- **K** — шейдеры вкл/выкл (если лагает или в полёте глючит отрисовка кораблей).
  С шейдером ночь и пещеры кромешно тёмные — носите факел в руке, он светит.
- **O** — выбор шейдера (MakeUp Ultra Fast — для слабых видеокарт)
- **W** (над предметом в JEI) — Ponder, анимированная подсказка Create
- **`** (обратная кавычка, удерживать) + копать — FTB Ultimine, жила руды целиком
- Кнопки сортировки у края инвентаря и сундука — Inventory Profiles Next
- **Shift + ПКМ** пустой рукой по сундуку — поднять его вместе с содержимым (Carry On)

## Для сборщика

Квесты генерируются из `tools/quests/*.json`: `python3 tools/gen_quests.py`
(каждый предмет проверяется по jar-файлам), превью раскладки — `python3 tools/preview_quests.py`.


Пак управляется [packwiz](https://packwiz.infra.link/). Правки — в этой папке, затем:

```bash
packwiz refresh
python3 tools/sync.py server ~/mc-nightshift-server   # раскладка на тест-сервер
bash ~/mc-nightshift-server/run_verify.sh             # проверка загрузки
packwiz mr export -o dist/Create-Nochnaya-Smena-<версия>.mrpack
```

Моды только с CurseForge (FTB Quests/Library/Teams/XMod Compat/Ultimine) подключены
CurseForge-метаданными packwiz (`mode = metadata:curseforge`): автообновление и `tools/sync.py`
качают их по file-id. Jar-файлы в репозиторий не кладём.
