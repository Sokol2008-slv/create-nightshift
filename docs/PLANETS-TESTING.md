# Проверка планет «Аксиоматив» и «Инь-Янь» на локальном сервере

Что сделано и почему — [`PLANETS.md`](PLANETS.md). Здесь — чек-лист: команда → что должно получиться → где
искать ошибку. Нужен **тестовый** мир (новые измерения и чанки останутся в мире навсегда), оператор, креатив.

## 0. До запуска

```
python3 tools/check_planets.py      # «Ошибок нет»
python3 tools/sync.py server <папка сервера>   # или скопировать kubejs/ и config/ вручную
```
Убедиться, что на сервере и клиенте есть `kubejs/data/nightshift/…`, `kubejs/data/kubejs/loot_table/…`,
`kubejs/startup_scripts/planets/`, `kubejs/server_scripts/planets/`, `kubejs/assets/kubejs/`,
`kubejs/assets/nightshift/textures/planet/`. **Startup-скрипты требуют полного перезапуска** (не `/reload`)
и сервера, и клиента.

## 1. Старт сервера — лог

```
grep -nE "nightshift|axiomativ|yin_yang|stabilite|axiomite" logs/latest.log | grep -iE "error|warn|fail|exception"
grep -n "Feature order cycle\|Failed to parse\|Unbound values\|tried to reference planet\|is referenced by planet dimensions" logs/latest.log
```
Должно быть пусто. Вероятные ошибки и где чинить:

| В логе | Причина | Файл |
|---|---|---|
| `Failed to parse nightshift:…` / `No key … in MapLike` | ключ/значение не по кодеку | указанный JSON; сверить с аналогом из `check_planets.py` |
| `Unbound values in registry … nightshift:…` | ссылка на несуществующий биом/фичу/карвер | `worldgen/biome/*.json`, `placed_feature/*.json` |
| `Feature order cycle found` | разный порядок фич в биомах одного измерения | `worldgen/biome/*.json` (скрипт это ловит) |
| `Dimension "…" tried to reference planet "…" which doesn't exist` | опечатка в `planet` | `northstar/planet_dimension/*.json` |
| `Unknown registry element … minecraft:dimension_type` | тип измерения не загрузился | `dimension_type/*.json` |
| измерений нет вовсе, но и ошибок нет | KubeJS не подал `kubejs/data` в загрузку мира | проверить `kubejs/data` на сервере; план Б — перенести датапак в `world/datapacks/nightshift_planets/` с `pack.mcmeta` |

В игре: `/kubejs errors` (startup и server) — пусто.

## 2. Блоки, предметы, текстуры, перевод

```
/give @s kubejs:axiomite_ore
/give @s kubejs:deepslate_axiomite_ore
/give @s kubejs:light_stabilite_ore
/give @s kubejs:dark_stabilite_ore
/give @s kubejs:raw_axiomite
/give @s kubejs:crushed_raw_axiomite
/give @s kubejs:axiomite_ingot
/give @s kubejs:raw_light_stabilite
/give @s kubejs:raw_dark_stabilite
/give @s kubejs:stabilite_ingot
```
Ожидание: у всех своя текстура (не фиолетово-чёрная), русские имена («Аксиомитовая руда», «Тёмная стабилитовая
руда», «Дроблёный рудный аксиомит»…). Если имя вида `Axiomite Ore` в русском клиенте — не подхватился
`kubejs/assets/kubejs/lang/ru_ru.json`.

## 3. Лут руды

Поставить все 4 руды. Сломать:
- рукой / деревянной киркой → **ничего** (нужен инструмент), каменной → ничего;
- железной киркой: аксиомит → `raw_axiomite`; стабилит → ничего (нужна алмазная);
- алмазной: светлая → `raw_light_stabilite`, тёмная → `raw_dark_stabilite`; с Удачей III — от 1 до 4;
- с шёлковым касанием → сам блок руды.

Если руда роняет **сама себя** без шёлкового касания — наш `kubejs/data/kubejs/loot_table/blocks/*.json` не перекрыл
таблицу KubeJS. Проверить: `/loot give @s loot kubejs:blocks/axiomite_ore` (должно дать сырьё).

## 4. Рецепты (JEI)

- `raw_axiomite` → Дробление: 1 дроблёный + 50% ещё + 75% самородок опыта; блок руды → 2 + 50% + 75%.
- `crushed_raw_axiomite` → Обдув/печь (огонь) и доменка (лава) → `axiomite_ingot`. Для стабилита дробилки/печи нет.
- Печь **не** плавит `raw_*` и руду (так задумано правилами «Вахты»).
- Стабилит: `raw_light_stabilite` + `raw_dark_stabilite` в межпланетное точило → `stabilite_ingot` (JEI: `axiomativ:planetary_grinding`); одну половинку ни печь, ни дробилка, ни точило не обработают.
- Вживую: дробилка + вентилятор над лавой — слиток выходит.

## 5. Измерения — телепорт

```
/gamemode spectator
/execute in nightshift:axiomativ run tp @s 0 200 0
```
Ожидание: F3 показывает `nightshift:axiomativ`, биом «Стальные равнины» или «Мёрзлая литейная»; серые туфовые горы,
верх — гладкий базальт или снег; небо серо-стальное, звёзды и планеты Northstar видны.
```
/locate biome nightshift:axiomativ_frozen_foundry
/locate biome nightshift:axiomativ_steel_plains
```
Оба должны находиться (если один не находится в радиусе — поправить `temperature` в `dimension/axiomativ.json`).
Под землёй: ниже y ≈ 0…8 порода переходит в глубинный сланец; на y −40…100 — аксиомит в туфе/сланце,
железная руда; ниже y −16 изредка блоки сырого железа. Пещеры есть (если нет — карверы/тег
`nightshift:planet_carver_replaceables`).

```
/execute in nightshift:yin_yang run tp @s 0 200 0
```
Ожидание: у (0, 0) стык четырёх квадратов: по диагонали — одинаковые. Пройти по X от −20 до 20 и по Z — биом
меняется ровно на X = 0 и Z = 0. Инь: чернокамень, чёрное небо и туман, белый пепел в воздухе. Ян: снег сверху,
кальцит, белое небо днём, тёмный пепел, ледяные шпили.
```
/locate biome nightshift:yin_yang_yang
/execute in nightshift:yin_yang run tp @s 8200 200 100
```
Второй — уже в соседнем квадрате (граница на X = 8192): биом должен смениться.

Шов: в Инь спуститься до y 20 → −20: выше 8 — чернокамень, между 8 и −8 — смесь чернокамня и кальцита, ниже −8 —
кальцит. В Ян — наоборот. **Стабилит** — светлая руда только в биоме Ян (на кальците), тёмная только в Инь (на чернокамне), y −8…72. Удобно смотреть в режиме наблюдателя. Если руды мало/много — `count` в
`worldgen/placed_feature/yin_yang_ore_{light,dark}_stabilite.json`.

Вернуться: `/execute in minecraft:overworld run tp @s ~ 100 ~`.

## 6. Northstar: карта, наука, ракета

1. Телескоп → карта: в системе Солнца есть **Аксиоматив** (за Марсом, 2,2 а.е.) и **Инь-Янь** (на орбите Земли,
   позади неё). Спрайты свои (голубовато-серый шарик, чёрно-белый значок), не фиолетово-чёрный квадрат.
   Если имя «Axiomativ» вместо «Аксиоматив» — lang; если нет планет совсем — `northstar/planet/*.json` не загрузились.
2. Сделать запись (ночь, бумага) → Астрономический стол: «… / 8» для Аксиоматива, «… / 7» для Инь-Янь.
3. Быстрый тест полёта (креатив): **творческий атлас** из вкладки Northstar «Предметы» (открыты все планеты),
   ракета с **творческим баком** (бесконечное топливо) и **творческим мотором** (ускорители), межпланетный навигатор.
   В Ракетной станции в списке направлений — «Аксиоматив» и «Инь-Янь» с подписью «Поверхность» (перевод `northstar.planet.dimension.surface` добавлен в наш ru_ru — у Northstar его нет).
4. Полёт с Земли: ракета поднимается, переносится на планету **в те же X/Z**, садится. Скафандр: без него —
   удушье (воздух не пригоден), на Аксиоматив ещё и холод −120 °C.
5. Без творческих блоков: станция должна требовать больше ускорителей для Аксиоматива (11 м/с²), чем для Марса.
6. Обратный полёт на Землю работает.

## 7. Квесты

Глава «Космос», после «Марс, Венера, Меркурий»: 5 новых квестов. Вход в измерение (телепортом тоже) засчитывает
«Аксиоматив: штаб компании» / «Инь-Янь: планета равновесия»; сырьё в инвентаре — «Аксиомит» / «Стабилит…»;
«Отчёт в штаб» — галочка. Если задача входа не засчиталась — проверить `type: "dimension"` в
`config/ftbquests/quests/chapters/space.snbt`.

## 8. Фазы (только если `NS_OPEN_WORLD = false`)

`07_dimensions.js`: без стадии `nightshift_p6` вход в `nightshift:axiomativ` и `nightshift:yin_yang` закрыт, как у
планет Northstar.

## Что прислать, если что-то не так

`logs/latest.log` (кусок вокруг ошибки), вывод `/kubejs errors`, координаты и скриншот с F3.
