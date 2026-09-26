# Аудит утечек ресурсов по фазам — Create: Ночная смена (NeoForge 1.21.1)

Метод: программное сканирование zip-содержимого всех ~219 jar модов + ванильного клиента
python+zipfile: `data/*/worldgen/{configured_feature,placed_feature}`, `data/*/neoforge/biome_modifier`,
все `data/*/recipe*/**/*.json` (32285 файлов), все `data/*/loot_table/**/*.json` (14461 файлов,
целевая выборка по `chests|entities|gameplay|archaeology` — 85 совпадений по ключевым ресурсам),
конфиг AlmostUnified из `config/almostunified/`. Полные сырые данные лежат рядом в `raw/*.json`
(index.json, configured_features.json, placed_features.json, biome_modifiers.json, crush_leaks.json,
loot_hits.json) — на случай, если нужно перепроверить конкретный файл.

Village-трейды и часть «общеизвестных» механик (руинный портал, поводок vs Lead-металл) не хранятся
в датапаках модов — это захардкоженный ванильный Java-код, приведены по документированному поведению
1.21, отдельно помечено, что не подтверждено сканированием байткода.

---

## P0 «Выживший»

Собственной руды нет. Единственный канал утечки — лут.

| Таблица | Утёкший предмет |
|---|---|
| `minecraft:chests/{abandoned_mineshaft, simple_dungeon, ancient_city, igloo_chest, shipwreck_supply, stronghold_crossing, underwater_ruin_big/small, woodland_mansion}` | `minecraft:coal` |
| `minecraft:chests/village/{butcher, fisher, snowy_house, toolsmith}` | `minecraft:coal` |
| `minecraft:archaeology/{ocean_ruin_cold, ocean_ruin_warm, trail_ruins_common}` | `minecraft:coal` |
| `minecraft:entities/wither_skeleton` | `minecraft:coal` |
| YungsBetter{Strongholds,NetherFortresses,DesertTemples} `chests/{armoury,common,prison_lg,keep,lab}` | `minecraft:coal` |

**Notes:** уголь физически лежит почти в любой ранней структуре, до которой P0-игрок доходит без
инструментов. Блокировка не ломает прогрессию — дерево (planks/logs) остаётся топливом печи.

---

## P1 «Разнорабочий»

### ores_to_hide
| Блок | Показывать как |
|---|---|
| `minecraft:iron_ore`, `minecraft:deepslate_iron_ore` | камень / глубинный сланец |
| `minecraft:copper_ore`, `minecraft:deepslate_copper_ore` | камень / глубинный сланец |
| `minecraft:coal_ore`, `minecraft:deepslate_coal_ore` | камень / глубинный сланец |
| андезит (природная примесь, `minecraft:ore`-фича `minecraft:ore_andesite`-аналог в толще камня) | обычный камень |

### items_to_lock
`raw_iron, iron_nugget, iron_ingot, iron_block, raw_copper, create:copper_nugget, copper_ingot,
copper_block, coal, andesite, create:andesite_alloy, create:andesite_casing`

### recipes_to_remove_or_lock — САМОЕ ВАЖНОЕ В АУДИТЕ
| ID | Мод | Вход (P0!) | Выход | Severity |
|---|---|---|---|---|
| `create:crushing/tuff` | create-1.21.1-6.0.10.jar (дублируется createaddition-1.7.1.jar, +electrum_nugget) | `minecraft:tuff` | `gold_nugget`(0.1), `copper_nugget`(0.1), `zinc_nugget`(0.1), `iron_nugget`(0.1) | **КРИТИЧНО** |
| `create:crushing/diorite` | create | `minecraft:diorite` | `minecraft:quartz`(0.25) | **КРИТИЧНО** |
| `createsifter:sifting/gravel_andesite` (сито + `andesite_mesh`, крафт из `create:andesite_alloy`) | createsifter | `minecraft:gravel` | `copper_nugget`(0.3), `zinc_nugget`(0.4), `iron_nugget`(0.4), `gold_nugget`(0.2), `coal`(0.1), `flint`(0.5) | **КРИТИЧНО** |
| `create:splashing/red_sand` | create | `minecraft:red_sand` | `gold_nugget`(0.125) | высокая |
| `create:splashing/soul_sand` | create | `minecraft:soul_sand` | `quartz`(0.125), `gold_nugget`(0.02) | высокая (soul_sand практически только в Nether) |
| `create:splashing/gravel` | create | `minecraft:gravel` | `iron_nugget`(0.125) | средняя (ресурс и так P1) |

**Notes:** это фундаментальные ванильные рецепты Create (не аддон!) — тряска/дробление/помол самого
обычного камня выдаёт золото, цинк и кварц ещё до нахождения соответствующей руды. Без правки этого
блока вся система фаз обходится Crushing Wheel-ом за первые 10 минут.

---

## P2 «Латунь»

### ores_to_hide
| Блок | Показывать как |
|---|---|
| `create:zinc_ore`, `create:deepslate_zinc_ore` | камень / глубинный сланец |
| `minecraft:gold_ore`, `minecraft:deepslate_gold_ore` | камень / глубинный сланец |
| `minecraft:nether_gold_ore` | незеррак (неактуально раньше P3, приведено для полноты) |
| `createpropulsion:platinum_ore`, `deepslate_platinum_ore` | камень / глубинный сланец — **платина не описана в исходном ТЗ фаз, нужно решение дизайнера** |

### items_to_lock
`create:raw_zinc, zinc_nugget, zinc_ingot, zinc_block, raw_gold, gold_nugget, gold_ingot, gold_block,
create:brass_ingot, brass_nugget, brass_block, brass_sheet`

### recipes_to_remove_or_lock
| ID | Вход | Выход | Severity |
|---|---|---|---|
| `createsifter:sifting/gravel_brass` (сито `brass_mesh`) | `minecraft:gravel` | `lapis_lazuli`(0.1), `amethyst_shard`(0.1), плюс P1-нагетты | высокая |
| `createsifter:sifting/gravel_advanced_brass` | `minecraft:gravel` | `diamond`(0.05), `emerald`(0.02), `lapis_lazuli`(0.2) | **КРИТИЧНО** |
| `createsifter:sifting/sand_brass` | `minecraft:sand` | `redstone`×2 (0.15), `crushed_raw_gold`(0.25) | высокая |
| `createsifter:sifting/dust_brass` (`createsifter:dust` = помол/дробление песка) | `createsifter:dust` | `glowstone_dust`(0.2), `redstone`×2 (0.35) | высокая |
| `createsifter:sifting/crushed_netherrack_brass` и `_advanced_brass` | дроблёный незеррак | `netherite_scrap` (0.01 / 0.02), `gold_nugget`, `quartz`, `blaze_powder` | **КРИТИЧНО** |
| `createoreexcavation:drilling/gold`, `/copper`, `/zinc` | вход: `drill` = тег `createoreexcavation:drills` (базовое сверло крафтится из ЖЕЛЕЗА) | `raw_gold`, `raw_zinc`, `raw_copper` | средняя |

**Notes:** латунное сито (P2, нужен только `brass_ingot`) уже даёт лазурит, редстоун, алмаз, изумруд
и даже осколок незерита из ГРАВИЯ/ПЕСКА — то есть весь контент P3 открывается одним крафтом сита сразу
после закрытия P2. Платина (`createpropulsion`) и `hardened_diamond` (`createoreexcavation`) —
незадокументированные в ТЗ ресурсы, требуют явного решения (платину предлагается отнести к P2 или P4).

---

## P3 «Пар и глубина»

### ores_to_hide
| Блок | Показывать как |
|---|---|
| `minecraft:redstone_ore`, `deepslate_redstone_ore` | камень / глубинный сланец |
| `minecraft:lapis_ore`, `deepslate_lapis_ore` | камень / глубинный сланец |
| `minecraft:diamond_ore`, `deepslate_diamond_ore` | камень / глубинный сланец |
| `minecraft:emerald_ore`, `deepslate_emerald_ore` | камень / глубинный сланец |
| `minecraft:nether_quartz_ore` | незеррак |
| `minecraft:ancient_debris` | незеррак/базальт (неактуально, последний пункт фазы) |
| `minecraft:glowstone` (кластер, НЕ ore-фича — светящийся блок потолка Nether) | см. notes — простое «disguise» тут не работает |
| `tfmg:sulfur` | физически генерируется уже в P3-доступном Nether, хотя ресурс относится к P4 — см. блок P4 |

### items_to_lock
`redstone, lapis_lazuli, diamond, emerald, quartz, glowstone_dust, glowstone, netherite_scrap,
netherite_ingot, netherite_upgrade_smithing_template, ancient_debris`

### recipes_to_remove_or_lock
| ID | Проблема | Severity |
|---|---|---|
| `createoreexcavation:drilling/diamond`, `/emerald`, `/lapis`, `/redstone`, `/hardened_diamond` | все веткииспользуют `"drill": {"tag":"createoreexcavation:drills"}` — тег включает БАЗОВОЕ ЖЕЛЕЗНОЕ сверло (P1!). Жилы этих ресурсов размечены `biomeWhitelist: is_overworld` — Nether для них вообще не нужен | **КРИТИЧНО — обходит и П3, и необходимость похода в Nether** |
| `createsifter` gravel_advanced_brass / sand_brass / dust_brass / crushed_netherrack_(advanced_)brass | см. таблицу P2 — открываются латунным ситом раньше самой фазы | **КРИТИЧНО, дубль из P2** |
| `create_ultimate_factory:crushing_soulsand` | `minecraft:soul_sand` → `glowstone_dust`(0.125) | средняя (дублирует утечку) |

### loot_to_strip
| Источник | Предметы |
|---|---|
| Ванильные структуры: `desert_pyramid, jungle_temple, buried_treasure, shipwreck_treasure, end_city_treasure, stronghold_{corridor,crossing,crypt,trap,treasure}, nether_bridge, bastion_{bridge,hoglin_stable,other,treasure}, trial_chambers/*, abandoned_mineshaft, simple_dungeon, woodland_mansion` | diamond, emerald, lapis_lazuli, redstone, quartz, glowstone_dust, ancient_debris, netherite_scrap/ingot, netherite_upgrade_smithing_template |
| **Все ~14 сундуков деревень** (armorer, butcher, desert_house, fisher, fletcher, mason, plains_house, savanna_house, shepherd, snowy_house, taiga_house, tannery, temple, toolsmith, weaponsmith) | почти везде `emerald`; temple — ещё lapis+redstone; toolsmith/weaponsmith — diamond |
| Archaeology: `desert_pyramid, desert_well, ocean_ruin_cold/warm, trail_ruins_common` | diamond, emerald |
| Entities: `evoker, vindicator` (emerald), `witch` (glowstone_dust + redstone) | — |
| `gameplay/hero_of_the_village/cleric_gift` | lapis_lazuli, redstone |
| `gameplay/piglin_bartering` | quartz |
| YungsBetter{DesertTemples,JungleTemples,NetherFortresses,Strongholds,WitchHuts} — свои сундуки | дублируют тот же список в увеличенном масштабе (больше структур = больше точек утечки) |
| Northstar `lunar_base_chest`/`martian_base_chest` | redstone — не проблема, это уже P6-локация |

**Notes:** P3 — самая «дырявая» фаза по лут-таблицам: буквально любая ванильная структура и любой
деревенский сундук содержит алмаз/изумруд/лазурит/редстоун. Плюс фермер даёт изумруды за урожай уже в
P0 без металла (см. general_notes → трейды) — а изумруды тратятся у священника/каменщика/торговца на
редстоун/лазурит/кварц и готовые алмазные инструменты. `glowstone` — не жила, а кластерная генерация;
простое скрытие текстурой может не сработать так же чисто, как для рудных блоков в толще камня —
нужна отдельная механика (запрет добычи/иная модель).

---

## P4 «Сталь и нефть»

### ores_to_hide
| Блок | Показывать как |
|---|---|
| `tfmg:lead_ore`, `deepslate_lead_ore` | камень / глубинный сланец |
| `cgs:lead_ore`, `cgs:deepslate_lead_ore` | **ДУБЛЬ реестра** — отдельная руда от tfmg, см. notes |
| `tfmg:nickel_ore`, `deepslate_nickel_ore` | камень / глубинный сланец |
| `tfmg:lithium_ore`, `deepslate_lithium_ore` | камень / глубинный сланец |
| `tfmg:sulfur` | генерируется как **слой породы Nether** вперемешку с blackstone/basalt/scorchia/magma_block, вес 4 из ~12 — не жила, а часть terrain-blend |
| `cgs:sulfur_ore` | **ДУБЛЬ реестра** |
| `tfmg:oil_deposit`, `tfmg:oil_well` (подземные залежи, Overworld) | — |

### items_to_lock
`tfmg:raw_lead, lead_ingot, lead_nugget, raw_lead_block, raw_nickel, nickel_ingot, nickel_bars,
raw_lithium, lithium_ingot, crushed_raw_lithium, sulfur, sulfur_dust, sulfuric_acid, crude_oil,
heavy_oil, steel_ingot, steel_block, cast_iron_ingot, nitrate_dust`

### recipes_to_remove_or_lock
| ID | Проблема | Severity |
|---|---|---|
| `data/create/recipe/crushing/dirt.json` (физически лежит внутри `tfmg-*.jar`, регистрируется в namespace `create`!) | дробление ОБЫЧНОЙ ЗЕМЛИ (P0) даёт `tfmg:nitrate_dust` (0.05) — селитра для взрывчатки без всякой химии TFMG | средняя |

**Notes:** главная находка фазы — `tfmg:sulfur` физически генерируется как ЧАСТЬ terrain-блендинга
Nether (наравне с blackstone/basalt), доступного уже в P3. Значит серу можно накопать голыми руками на
фазу раньше положенного. Отдельно: **cgs** (create-gunsmithing) регистрирует СВОИ `lead_ore`/`sulfur_ore`,
не совпадающие с tfmg-блоками. AlmostUnified (`config/almostunified/unification/materials.json`, тег
`c:ores/{material}` присутствует в списке унификации) чинит только РЕЦЕПТЫ (сведение к одному
каноническому ингту/крашеной руде), но НЕ мешает cgs-варианту руды физически генерироваться в мире —
обе руды нужно прятать отдельно.

---

## P5 «Энергия»

### ores_to_hide
`create_new_age:thorium_ore` → камень, `create_new_age:thorium_ore_e` (вариант текстуры) → камень.

### items_to_lock
`create_new_age:thorium, radioactive_thorium`

**Notes:** урана как отдельного ресурса в паке **не обнаружено** — мод New Age построен целиком
вокруг тория (`thorium_ore` → реактор `reactor_core_working/disabled`). Упоминание урана в исходном ТЗ
не подтвердилось: Mekanism/Big Reactors в списке модов отсутствуют. Единственная связанная строка —
`createsifter:recipe/blasting/yellorium_ingot.json` — но она висит за условием
`neoforge:conditions: mod_loaded:bigreactors`, которого в паке нет → рецепт **мёртв, не активен**,
не является утечкой.

---

## P6 «Космос»

### ores_to_hide (Northstar, 4 планеты × ~10 базовых + ~10 deep-вариантов = ~120 блоков)
- `northstar:mars_*_ore` / `mars_deep_*_ore`: copper, diamond, emerald, gold, iron, lapis, quartz,
  redstone, titanium, zinc
- `northstar:mercury_*_ore` / `mercury_deep_*_ore`: copper, diamond, glowstone, gold, iron, lapis,
  redstone, titanium, tungsten, zinc (+ опечатка в моде — `mercurys_deep_titanium_ore` дублирует
  `mercury_deep_titanium_ore`)
- `northstar:moon_*_ore` / `moon_deep_*_ore`: copper, diamond, emerald, glowstone, gold, iron, lapis,
  quartz, redstone, titanium, zinc
- `northstar:venus_*_ore` / `venus_deep_*_ore`: coal, copper, diamond, emerald, glowstone, gold, iron,
  lapis, quartz, redstone, titanium, zinc
- предметы «сырая руда»: `raw_titanium_ore, raw_martian_iron_ore, raw_tungsten_ore, raw_glowstone_ore`
- `createpropulsion:platinum_ore` — если решено отнести платину к P6

### items_to_lock
`northstar:titanium_ingot/nugget/block, tungsten_ingot/nugget/block, martian_steel_ingot,
lunar_sapphire_shard/crystal, enriched_glowstone_ore, rutile_concentrate, titanium_tetrachloride`

### loot_to_strip
`northstar:lunar_base_chest / martian_base_chest / martian_base_seed_chest` → `lunar_sapphire_shard,
martian_steel_ingot, dormant_martian_sapling/seed` (не проблема, если долёт легитимно после P6).

**Notes — САМОЕ ВАЖНОЕ:** все 120 планетных руд смелтятся blasting-рецептами НАПРЯМУЮ в ванильные
`minecraft:iron_ingot / gold_ingot / diamond / copper_ingot` и т.д. (проверено на `mars_*_ore`). Это не
проблема сама по себе — планеты и так недостижимы без ракеты. Настоящий риск — **sequence break**:
ракета (`northstar:rocket_station/rocket_thruster/rocket_combustion_chamber`) требует
`c:plates/titanium` и `c:ingots/titanium`, а титан **полностью синтезируется на Земле химическим
путём**, минуя руду вообще:
`rutile_concentrate ×2 + create:zinc_ingot + хлор/углерод → titanium_tetrachloride`
(`northstar:recipe/mixing/titanium1.json`) → `sequenced_assembly` с чередованием `filling`/`pressing`
(лава → titanium_tetrachloride → вода) → `titanium_ingot`. Этот путь требует только **P2** (zinc_ingot)
+ продвинутую химию TFMG-уровня (условно P4), но **не требует явно ни P3 (алмазы/редстоун/незерит),
ни P5 (торий/реактор)**. Формально игрок может собрать ракету и улететь на Марс, проскочив P3 и P5, если
рецепты ракетных деталей не завязаны явно на материал этих фаз. **Рекомендация: либо вплести в рецепт
ракетных деталей материал P3/P5 (незеритовая деталь, реакторный сплав), либо жёстко заблокировать сами
блоки ракеты через AStages независимо от цепочки ресурсов.**

---

## Прочее (не завязано на конкретную фазу, но важно)

### Village-трейды (захардкожены в ванильном Java, датапак-трейдов от модов не найдено —
проверены все 138 хитов по `trade`/`villager` в датапаках, все они про структуры/тэги, не про сделки)
- **Farmer** покупает урожай (пшеница/морковь/картофель/свёкла) за изумруды — чистый P0-доход без
  единого металла. Это стартовый насос эмеральдов для всей остальной экономики.
- **Cleric** ПРОДАЁТ `redstone` и `lapis_lazuli` за изумруды (P3-ресурсы за P0-валюту), выше —
  `ender_pearl`, `bottle o'enchanting`.
- **Mason** ПРОДАЁТ `quartz` (P3) и терракоту за изумруды.
- **Wandering Trader** ПРОДАЁТ `lapis_lazuli`, `quartz`, `coal` за изумруды — доступен с первого дня,
  не завязан ни на одну структуру.
- **Toolsmith/Weaponsmith/Armorer** на верхнем уровне продают ГОТОВЫЕ diamond-инструменты/оружие/броню
  за изумруды — не даёт сырой алмаз, но обходит саму необходимость руды алмаза для инструментов.
- В инстансе есть experimental datapack `data/minecraft/datapacks/trade_rebalance` — если включён в
  настройках мира (Java 1.21 фича с trial-vault ключами), часть трейдов заменена. **Не подтверждено —
  нужно проверить world settings отдельно, аудит jar-ов этого не показывает.**

**Рекомендация:** либо полностью блокировать торговлю с профессиональными жителями до открытия
соответствующей фазы (AStages «Villager trades: lock»), либо руками вычистить самые дешёвые offers
(redstone/lapis/quartz/coal) через datapack override `VillagerTrades`.

### Прочие источники
- **Ruined Portal chest** (ванильный, не сканировался байткодом — общеизвестное поведение 1.21):
  золотые самородки/слитки, огниво, обсидиан — минорная утечка золота (P2) на структуре, которая есть
  и в Overworld, и в Nether, доступна с первого дня.
- **Suspicious sand/gravel** (археология) — уже учтено выше в P1/P3 `loot_to_strip` (`archaeology/*`):
  даёт `coal`, `diamond`, `emerald` напрямую кистью, без крафта инструментов вообще.
- **Piglin bartering** — учтено в P3 (`gameplay/piglin_bartering` → `quartz`): фактически обменивает
  P2-ресурс (золото) на P3-лут напрямую, минуя добычу quartz-руды.

### Исключены как ложные срабатывания
- `minecraft:lead` в лут-таблицах `ancient_city`, `trail_ruins_common`, `woodland_mansion` — это
  **поводок** (верёвка для животных), НЕ металл. Ложное срабатывание по regex `\blead\b`.
- `createsifter:recipe/blasting/yellorium_ingot.json` — мёртвый рецепт (см. блок P5).
- `create:recipe/crushing/compat/exnihilosequentia/dust.json` — условный рецепт под мод
  `exnihilosequentia`, которого в паке нет — не активен.

---

## Сводка и рекомендации по дизайну фаз

**Обнаружено утечек:**
- Ore-generation: ~120+ рудных блоков задокументировано по 6 фазам (без учёта Northstar — 8
  «настоящих» модовых руд P1–P5 + andesite-блоб + tfmg:sulfur как terrain-blend; с Northstar — ещё
  ~120 планетных дублей P6).
- Recipe-leaks: **6 критичных** (создающих ресурс фазы N из материалов фазы N-2 и ниже, нулевым
  усилием) + ~10 средних/минорных. Самые опасные: `create:crushing/tuff`, `create:crushing/diorite`,
  `createsifter` gravel/sand/dust-сифтинг всех тиров, `createoreexcavation` drilling алмаза/изумруда/
  лазурита/редстоуна базовым железным сверлом.
- Loot-leaks: 85 таблиц с хитами, из них **P3 доминирует** (76 таблиц) — практически весь ванильный
  dungeon-loot и village-loot набит алмазом/изумрудом/лазуритом/редстоуном/кварцем/незеритом.
- Trade-leaks: 5 явных ванильных сделок (farmer→cleric/mason/wandering trader→toolsmith), не
  датапак-управляемые, требуют отдельного механизма блокировки (не «ores: hide»).

**Самые неожиданные находки:**
1. Native-рецепты самого **Create** (не аддона!) — `crushing/tuff` и `crushing/diorite` — превращают
   обычный камень в золото/цинк/кварц без единой руды.
2. `createoreexcavation` — базовое ЖЕЛЕЗНОЕ сверло бурит алмазные/изумрудные/лазуритные/редстоуновые
   жилы **в Overworld**, без апгрейда и без похода в Nether.
3. `tfmg:sulfur` (P4-ресурс) физически вплетён в terrain-blend Nether, доступного с P3.
4. Два разных мода (`tfmg` и `cgs`) регистрируют СВОИ, физически разные блоки для одного и того же
   «lead» и «sulfur» — AlmostUnified чинит только рецепты, не world-gen, нужно прятать оба.
5. Путь синтеза титана (Northstar) не требует ни P3, ни P5 — потенциальный sequence-break прямо в P6.

**Что стоит поправить в самом дизайне фаз (не в скрытии, а в списке фаз):**
- Указать явную судьбу **платины** (`createpropulsion`) и **hardened_diamond** (`createoreexcavation`)
  — оба не описаны в исходном ТЗ.
- Уран не существует в паке — стоит убрать пункт «уран если есть» как неактуальный либо заменить на
  «уран отсутствует, реакторная цепочка P5 — только торий».
- `glowstone` (кластер потолка Nether) и нефть (`tfmg:oil_deposit`, fluid-залежь) — это не «жилы» в
  привычном смысле; чистое `Ores: hide` может не сработать так же, как для блоков руды в толще камня —
  нужен отдельный механизм (запрет добычи/иная модель/блокировка структуры) уже на уровне
  реализации в AStages+KubeJS.
- Ракетные детали Northstar рекомендуется завязать явно на материал P3/P5, а не полагаться только на
  цепочку «титан ⇐ цинк + химия».
