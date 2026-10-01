// ==========================================================================
// Ночная смена — артефакты смены (01.10.2026, Георгий: «урон мобов не режем, делаем нас плотнее»;
// «хоть 4 ряда сердец»; «гриндить волны ради крутого артефакта — чем выше волна, тем выше шанс»;
// 02.10: «если есть идеи для артов и редкого дропа — действуй, креативь на полную»).
//
// 7 уровней: обычный, редкий, сверхредкий, эпический, легендарный, мифический, божественный. Три источника:
//  - артефакты волн — бросок каждому защитнику за любую победу (NSG.nsNsArtifactRoll), шанс и уровень растут с волной;
//  - артефакты арены — только за победу на арене в её теме (тот же nsNsArtifactRoll с ctx = {arena, theme});
//  - трофеи боссов ArPhEx и Cataclysm — NSG.nsNsBossTrophyRoll: шанс каждому, первое прохождение — наверняка одному.
// Переплавка: 3 артефакта волн одного уровня → 1 случайный следующего (до мифического) — /nsart reforge и кнопка
// NSG.nsNsArtifactReforgeText(player) для меню алтаря. Трофеи и артефакты арены не переплавляются.
//
// Надеваются в свой слот Curios «Реликвия» (4 слота — это и есть билд). Слот, тег и предметы — датапаком и
// стартовым скриптом (tools/gen_ns_artifacts.py), интеграции KubeJS↔Curios в паке нет: эффекты считаем здесь.
//  - раз в секунду (и сразу после смены надетого — CurioChangeEvent) смотрим слоты «Реликвия» через Java-API
//    Curios и ставим постоянные модификаторы атрибутов с id nightshift:relic_<стат>. Чужие модификаторы
//    (nightshift:penalty — проклятие, раны, «Сердца ночи») не трогаем. Постоянные — чтобы при входе в игру
//    здоровье сверх 20 не обрезалось до загрузки скрипта;
//  - там же: постоянные эффекты (огнестойкость, ночное зрение…), снятие эффектов, к которым иммунитет, лечение вне
//    боя, огненная аура, «во тьме рассудок не падает»; раз в 4 тика — медленное падение с Shift;
//  - LivingIncomingDamageEvent: щит после удара, нет урона от падения/мороза, уклонение, срез урона;
//    LivingDamageEvent$Pre: второе дыхание (и телепорт в сторону — на следующем тике);
//    LivingDamageEvent$Post: «был в бою», щит, отражение, эффекты и поджог ударившего, вампиризм, эффекты и поджог
//    от твоих ударов; LivingDeathEvent: лечение и эффекты за убийство; MobEffectEvent$Applicable: иммунитеты;
//  - одинаковые не складываются: второй такой же в слот не встанет (CurioCanEquipEvent), эффекты — по уникальным id.
//    Неуязвимость после удара, второе дыхание и аура не суммируются — работает лучший.
// Эндгейм «Пробуждение» (02.10): осколки орды падают с мобов набега в копилку набега (NSG.nsNsHordeShardTake —
// раздаёт набег победителям), завод Create делает из них эссенцию (vahta/75_ns_awakening.js), сборка по шагам
// пробуждает артефакт эпического уровня и выше (art_<id>_aw: +50 % к числам). Обычный и пробуждённый одного
// вида вместе не надеваются; здоровье от артефактов — не больше caps.hp.
// Справка — глава квест-бука «Артефакты смены» (tools/quests/spec_artifacts.json).
// Команды: /nsart — что даёт надетое; /nsart reforge — переплавка; /nsart odds <волна> — шансы;
// оператор: /nsart roll <волна> [first], /nsart rolltheme <тема> — 1000 бросков.
//
// ВАЖНО (30.09): исключение внутри нативного обработчика роняет сервер — тело КАЖДОГО обработчика в try/catch.
// KubeJS 2101 переименовывает для JS часть методов Mojang (RemapForJS, проверено javap 01.10): getStringUUID →
// getStringUuid, Level.getGameTime → getTime, DamageSource.getMsgId → getType, getEntity → getActual,
// getDirectEntity → getImmediate; Entity.hurt скрыт (есть attack(источник, урон)), level — свойство, а не метод;
// AttributeInstance.removeModifier неоднозначен в Rhino. Поэтому — перебор имён (nsArtCall) и обходы ниже.
// Правило Rhino: только var.
// ==========================================================================

// <ДАННЫЕ> — генерирует tools/gen_ns_artifacts.py, руками не править (правка таблицы там и перезапуск)
var NS_ART = {
	"slot": "relic",
	"slots": 4,
	"tiers": [{"key": "common", "name": "обычный", "gen": "обычных", "from": 1}, {"key": "rare", "name": "редкий", "gen": "редких", "from": 1}, {"key": "superrare", "name": "сверхредкий", "gen": "сверхредких", "from": 8}, {"key": "epic", "name": "эпический", "gen": "эпических", "from": 15}, {"key": "legendary", "name": "легендарный", "gen": "легендарных", "from": 27}, {"key": "mythic", "name": "мифический", "gen": "мифических", "from": 43}, {"key": "divine", "name": "божественный", "gen": "божественных", "from": 90}],
	"items": {
		"nightshift:art_patch": {"tier": 0, "name": "Заплатка вахтовика", "pool": "wave", "hp": 4},
		"nightshift:art_badge": {"tier": 0, "name": "Жетон смены", "pool": "wave", "armor": 1, "speed": 0.05},
		"nightshift:art_thermos": {"tier": 0, "name": "Термос бригадира", "pool": "wave", "regen": 0.5},
		"nightshift:art_buckle": {"tier": 1, "name": "Стальная пряжка", "pool": "wave", "hp": 6, "kb": 0.1},
		"nightshift:art_qc_stripe": {"tier": 1, "name": "Нашивка ОТК", "pool": "wave", "dr": 0.05},
		"nightshift:art_watch_charm": {"tier": 1, "name": "Оберег сторожа", "pool": "wave", "iframes": 6, "armor": 1},
		"nightshift:art_fang": {"tier": 2, "name": "Клык кровососа", "pool": "wave", "life": 0.05, "lifeCap": 2, "dmg": 1},
		"nightshift:art_pauldron": {"tier": 2, "name": "Наплечник из сплава", "pool": "wave", "armor": 4, "tough": 2},
		"nightshift:art_collar": {"tier": 2, "name": "Шипастый ошейник", "pool": "wave", "thorns": 0.25, "armor": 1},
		"nightshift:art_stone_heart": {"tier": 3, "name": "Каменное сердце", "pool": "wave", "hp": 8, "kb": 0.25, "speed": -0.05},
		"nightshift:art_rosary": {"tier": 3, "name": "Чётки дозорного", "pool": "wave", "iframes": 12, "dr": 0.05},
		"nightshift:art_butcher_glove": {"tier": 3, "name": "Перчатка мясника", "pool": "wave", "life": 0.1, "lifeCap": 3, "dmg": 2},
		"nightshift:art_titan_blood": {"tier": 4, "name": "Кровь титана", "pool": "wave", "hp": 12, "regen": 0.5},
		"nightshift:art_visor": {"tier": 4, "name": "Щиток бригадира", "pool": "wave", "dr": 0.12, "armor": 3, "kb": 0.2},
		"nightshift:art_second_wind": {"tier": 4, "name": "Жетон второго дыхания", "pool": "wave", "hp": 4, "wind": {"cd": 6000, "after": 40}},
		"nightshift:art_hourglass": {"tier": 5, "name": "Песочные часы смены", "pool": "wave", "shield": {"dur": 20, "cd": 120}, "armor": 2},
		"nightshift:art_horde_heart": {"tier": 5, "name": "Сердце орды", "pool": "wave", "hp": 14, "life": 0.06, "lifeCap": 3, "regen": 0.5},
		"nightshift:art_vakhta_heart": {"tier": 6, "name": "Сердце Вахты", "pool": "wave", "hp": 18, "armor": 4, "dr": 0.1, "regen": 1.0},
		"nightshift:art_halo": {"tier": 6, "name": "Нимб бессменного", "pool": "wave", "shield": {"dur": 20, "cd": 80}, "wind": {"cd": 2400, "after": 60}, "life": 0.1, "lifeCap": 4},
		"nightshift:art_shaft_helmet": {"tier": 3, "name": "Каска проходчика", "pool": "theme", "theme": "shaft", "armor": 3, "mine": 0.3, "immune": ["minecraft:mining_fatigue"]},
		"nightshift:art_shaft_mace": {"tier": 3, "name": "Шахтёрский обушок", "pool": "theme", "theme": "shaft", "dmg": 2, "aspd": 0.1},
		"nightshift:art_canyon_silk": {"tier": 3, "name": "Паучий шёлк", "pool": "theme", "theme": "canyon", "speed": 0.1, "immune": ["arphex:webbed", "minecraft:slowness", "minecraft:poison"]},
		"nightshift:art_canyon_gland": {"tier": 4, "name": "Ядовитая железа", "pool": "theme", "theme": "canyon", "dmg": 2, "hitFx": [["minecraft:wither", 0, 80]]},
		"nightshift:art_frost_shard": {"tier": 3, "name": "Осколок вечной мерзлоты", "pool": "theme", "theme": "frost", "armor": 2, "hurtFx": [["minecraft:slowness", 2, 60]]},
		"nightshift:art_frost_heart": {"tier": 4, "name": "Сердце метели", "pool": "theme", "theme": "frost", "hp": 10, "noDmg": ["freeze"], "immune": ["minecraft:slowness"]},
		"nightshift:art_inferno_ash": {"tier": 4, "name": "Пепельное сердце", "pool": "theme", "theme": "inferno", "hp": 6, "buffs": [["minecraft:fire_resistance", 0]], "hurtFire": 5},
		"nightshift:art_inferno_crown": {"tier": 5, "name": "Корона пекла", "pool": "theme", "theme": "inferno", "dmg": 3, "hitFire": 4, "buffs": [["minecraft:fire_resistance", 0]]},
		"nightshift:art_ender_feather": {"tier": 4, "name": "Перо Края", "pool": "theme", "theme": "ender", "speed": 0.1, "noDmg": ["fall"], "featherfall": true},
		"nightshift:art_ender_void": {"tier": 5, "name": "Осколок пустоты", "pool": "theme", "theme": "ender", "hp": 8, "dodge": 0.15},
		"nightshift:art_nightmare_lantern": {"tier": 5, "name": "Фонарь кошмара", "pool": "theme", "theme": "nightmare", "hp": 8, "buffs": [["minecraft:night_vision", 0]], "sanity": true, "immune": ["minecraft:darkness", "minecraft:blindness", "arphex:moth_curse", "arphex:splintered_sanity"]},
		"nightshift:art_nightmare_claw": {"tier": 4, "name": "Коготь кошмара", "pool": "theme", "theme": "nightmare", "dmg": 4, "life": 0.06, "lifeCap": 3},
		"nightshift:art_abyss_star": {"tier": 6, "name": "Осколок звезды", "pool": "theme", "theme": "abyss", "hp": 12, "dr": 0.08, "speed": 0.1, "shield": {"dur": 20, "cd": 100}},
		"nightshift:art_tr_matriarch": {"tier": 4, "name": "Хитин матриарх", "pool": "boss", "armor": 4, "tough": 2, "immune": ["minecraft:poison", "arphex:necrosis"]},
		"nightshift:art_tr_termite": {"tier": 4, "name": "Панцирь подземного короля", "pool": "boss", "hp": 10, "armor": 2, "kb": 0.3, "mine": 0.25},
		"nightshift:art_tr_scorpioid": {"tier": 4, "name": "Жало скорпиоида", "pool": "boss", "life": 0.08, "lifeCap": 3, "hitFx": [["minecraft:poison", 1, 60], ["minecraft:slowness", 0, 60]]},
		"nightshift:art_tr_voidlasher": {"tier": 4, "name": "Хвост драконохвоста", "pool": "boss", "speed": 0.15, "hurtFx": [["minecraft:weakness", 1, 80]], "immune": ["arphex:supergravity", "arphex:chaos_controlled", "arphex:voidlasher_chaos_control"]},
		"nightshift:art_tr_trisector": {"tier": 5, "name": "Клинок трисектора", "pool": "boss", "dmg": 4, "aspd": 0.15},
		"nightshift:art_tr_diabolos": {"tier": 5, "name": "Рог диаболоса", "pool": "boss", "hp": 6, "dmg": 3, "killHeal": 4},
		"nightshift:art_tr_amethyst": {"tier": 4, "name": "Аметистовый панцирь", "pool": "boss", "armor": 4, "thorns": 0.2, "immune": ["arphex:constricted"]},
		"nightshift:art_tr_gladiator": {"tier": 4, "name": "Медальон гладиатора", "pool": "boss", "dmg": 2, "killFx": [["minecraft:strength", 0, 120], ["minecraft:speed", 0, 120]]},
		"nightshift:art_tr_golem": {"tier": 4, "name": "Ядро голема", "pool": "boss", "kb": 1.0, "armor": 3, "tough": 2, "immune": ["arphex:paralysis"]},
		"nightshift:art_tr_guardian": {"tier": 5, "name": "Око Стража Края", "pool": "boss", "hp": 6, "wind": {"cd": 3600, "after": 40, "tp": true}},
		"nightshift:art_tr_ignis": {"tier": 5, "name": "Ядро Игниса", "pool": "boss", "buffs": [["minecraft:fire_resistance", 0]], "aura": {"r": 4, "dmg": 2, "fire": 3}},
		"nightshift:art_tr_maledictus": {"tier": 5, "name": "Венец Маледиктуса", "pool": "boss", "dmg": 3, "hitFx": [["minecraft:wither", 1, 60], ["minecraft:weakness", 0, 60]], "immune": ["minecraft:wither"]},
		"nightshift:art_tr_remnant": {"tier": 5, "name": "Ожерелье реликта", "pool": "boss", "dr": 0.12, "buffs": [["minecraft:water_breathing", 0]], "immune": ["minecraft:slowness", "minecraft:blindness"]},
		"nightshift:art_tr_monstrosity": {"tier": 5, "name": "Незеритовое сердце", "pool": "boss", "hp": 12, "armor": 4, "tough": 2, "speed": -0.05},
		"nightshift:art_stone_heart_aw": {"tier": 3, "name": "Каменное сердце ✦", "pool": "awakened", "base": "nightshift:art_stone_heart", "hp": 12, "kb": 0.375, "speed": -0.05},
		"nightshift:art_rosary_aw": {"tier": 3, "name": "Чётки дозорного ✦", "pool": "awakened", "base": "nightshift:art_rosary", "iframes": 18, "dr": 0.075},
		"nightshift:art_butcher_glove_aw": {"tier": 3, "name": "Перчатка мясника ✦", "pool": "awakened", "base": "nightshift:art_butcher_glove", "life": 0.15, "lifeCap": 4.5, "dmg": 3.0},
		"nightshift:art_titan_blood_aw": {"tier": 4, "name": "Кровь титана ✦", "pool": "awakened", "base": "nightshift:art_titan_blood", "hp": 18, "regen": 0.75},
		"nightshift:art_visor_aw": {"tier": 4, "name": "Щиток бригадира ✦", "pool": "awakened", "base": "nightshift:art_visor", "dr": 0.18, "armor": 4.5, "kb": 0.3},
		"nightshift:art_second_wind_aw": {"tier": 4, "name": "Жетон второго дыхания ✦", "pool": "awakened", "base": "nightshift:art_second_wind", "hp": 6, "wind": {"cd": 4000, "after": 60}},
		"nightshift:art_hourglass_aw": {"tier": 5, "name": "Песочные часы смены ✦", "pool": "awakened", "base": "nightshift:art_hourglass", "shield": {"dur": 30, "cd": 80}, "armor": 3.0},
		"nightshift:art_horde_heart_aw": {"tier": 5, "name": "Сердце орды ✦", "pool": "awakened", "base": "nightshift:art_horde_heart", "hp": 21, "life": 0.09, "lifeCap": 4.5, "regen": 0.75},
		"nightshift:art_vakhta_heart_aw": {"tier": 6, "name": "Сердце Вахты ✦", "pool": "awakened", "base": "nightshift:art_vakhta_heart", "hp": 27, "armor": 6.0, "dr": 0.15, "regen": 1.5},
		"nightshift:art_halo_aw": {"tier": 6, "name": "Нимб бессменного ✦", "pool": "awakened", "base": "nightshift:art_halo", "shield": {"dur": 30, "cd": 53}, "wind": {"cd": 1600, "after": 90}, "life": 0.15, "lifeCap": 6.0},
		"nightshift:art_shaft_helmet_aw": {"tier": 3, "name": "Каска проходчика ✦", "pool": "awakened", "base": "nightshift:art_shaft_helmet", "armor": 4.5, "mine": 0.45, "immune": ["minecraft:mining_fatigue"]},
		"nightshift:art_shaft_mace_aw": {"tier": 3, "name": "Шахтёрский обушок ✦", "pool": "awakened", "base": "nightshift:art_shaft_mace", "dmg": 3.0, "aspd": 0.15},
		"nightshift:art_canyon_silk_aw": {"tier": 3, "name": "Паучий шёлк ✦", "pool": "awakened", "base": "nightshift:art_canyon_silk", "speed": 0.15, "immune": ["arphex:webbed", "minecraft:slowness", "minecraft:poison"]},
		"nightshift:art_canyon_gland_aw": {"tier": 4, "name": "Ядовитая железа ✦", "pool": "awakened", "base": "nightshift:art_canyon_gland", "dmg": 3.0, "hitFx": [["minecraft:wither", 0, 120]]},
		"nightshift:art_frost_shard_aw": {"tier": 3, "name": "Осколок вечной мерзлоты ✦", "pool": "awakened", "base": "nightshift:art_frost_shard", "armor": 3.0, "hurtFx": [["minecraft:slowness", 2, 90]]},
		"nightshift:art_frost_heart_aw": {"tier": 4, "name": "Сердце метели ✦", "pool": "awakened", "base": "nightshift:art_frost_heart", "hp": 15, "noDmg": ["freeze"], "immune": ["minecraft:slowness"]},
		"nightshift:art_inferno_ash_aw": {"tier": 4, "name": "Пепельное сердце ✦", "pool": "awakened", "base": "nightshift:art_inferno_ash", "hp": 9, "buffs": [["minecraft:fire_resistance", 0]], "hurtFire": 7.5},
		"nightshift:art_inferno_crown_aw": {"tier": 5, "name": "Корона пекла ✦", "pool": "awakened", "base": "nightshift:art_inferno_crown", "dmg": 4.5, "hitFire": 6.0, "buffs": [["minecraft:fire_resistance", 0]]},
		"nightshift:art_ender_feather_aw": {"tier": 4, "name": "Перо Края ✦", "pool": "awakened", "base": "nightshift:art_ender_feather", "speed": 0.15, "noDmg": ["fall"], "featherfall": true},
		"nightshift:art_ender_void_aw": {"tier": 5, "name": "Осколок пустоты ✦", "pool": "awakened", "base": "nightshift:art_ender_void", "hp": 12, "dodge": 0.225},
		"nightshift:art_nightmare_lantern_aw": {"tier": 5, "name": "Фонарь кошмара ✦", "pool": "awakened", "base": "nightshift:art_nightmare_lantern", "hp": 12, "buffs": [["minecraft:night_vision", 0]], "sanity": true, "immune": ["minecraft:darkness", "minecraft:blindness", "arphex:moth_curse", "arphex:splintered_sanity"]},
		"nightshift:art_nightmare_claw_aw": {"tier": 4, "name": "Коготь кошмара ✦", "pool": "awakened", "base": "nightshift:art_nightmare_claw", "dmg": 6.0, "life": 0.09, "lifeCap": 4.5},
		"nightshift:art_abyss_star_aw": {"tier": 6, "name": "Осколок звезды ✦", "pool": "awakened", "base": "nightshift:art_abyss_star", "hp": 18, "dr": 0.12, "speed": 0.15, "shield": {"dur": 30, "cd": 67}},
		"nightshift:art_tr_matriarch_aw": {"tier": 4, "name": "Хитин матриарх ✦", "pool": "awakened", "base": "nightshift:art_tr_matriarch", "armor": 6.0, "tough": 3.0, "immune": ["minecraft:poison", "arphex:necrosis"]},
		"nightshift:art_tr_termite_aw": {"tier": 4, "name": "Панцирь подземного короля ✦", "pool": "awakened", "base": "nightshift:art_tr_termite", "hp": 15, "armor": 3.0, "kb": 0.45, "mine": 0.375},
		"nightshift:art_tr_scorpioid_aw": {"tier": 4, "name": "Жало скорпиоида ✦", "pool": "awakened", "base": "nightshift:art_tr_scorpioid", "life": 0.12, "lifeCap": 4.5, "hitFx": [["minecraft:poison", 1, 90], ["minecraft:slowness", 0, 90]]},
		"nightshift:art_tr_voidlasher_aw": {"tier": 4, "name": "Хвост драконохвоста ✦", "pool": "awakened", "base": "nightshift:art_tr_voidlasher", "speed": 0.225, "hurtFx": [["minecraft:weakness", 1, 120]], "immune": ["arphex:supergravity", "arphex:chaos_controlled", "arphex:voidlasher_chaos_control"]},
		"nightshift:art_tr_trisector_aw": {"tier": 5, "name": "Клинок трисектора ✦", "pool": "awakened", "base": "nightshift:art_tr_trisector", "dmg": 6.0, "aspd": 0.225},
		"nightshift:art_tr_diabolos_aw": {"tier": 5, "name": "Рог диаболоса ✦", "pool": "awakened", "base": "nightshift:art_tr_diabolos", "hp": 9, "dmg": 4.5, "killHeal": 6.0},
		"nightshift:art_tr_amethyst_aw": {"tier": 4, "name": "Аметистовый панцирь ✦", "pool": "awakened", "base": "nightshift:art_tr_amethyst", "armor": 6.0, "thorns": 0.3, "immune": ["arphex:constricted"]},
		"nightshift:art_tr_gladiator_aw": {"tier": 4, "name": "Медальон гладиатора ✦", "pool": "awakened", "base": "nightshift:art_tr_gladiator", "dmg": 3.0, "killFx": [["minecraft:strength", 0, 180], ["minecraft:speed", 0, 180]]},
		"nightshift:art_tr_golem_aw": {"tier": 4, "name": "Ядро голема ✦", "pool": "awakened", "base": "nightshift:art_tr_golem", "kb": 1.0, "armor": 4.5, "tough": 3.0, "immune": ["arphex:paralysis"]},
		"nightshift:art_tr_guardian_aw": {"tier": 5, "name": "Око Стража Края ✦", "pool": "awakened", "base": "nightshift:art_tr_guardian", "hp": 9, "wind": {"cd": 2400, "after": 60, "tp": true}},
		"nightshift:art_tr_ignis_aw": {"tier": 5, "name": "Ядро Игниса ✦", "pool": "awakened", "base": "nightshift:art_tr_ignis", "buffs": [["minecraft:fire_resistance", 0]], "aura": {"r": 6, "dmg": 3.0, "fire": 4}},
		"nightshift:art_tr_maledictus_aw": {"tier": 5, "name": "Венец Маледиктуса ✦", "pool": "awakened", "base": "nightshift:art_tr_maledictus", "dmg": 4.5, "hitFx": [["minecraft:wither", 1, 90], ["minecraft:weakness", 0, 90]], "immune": ["minecraft:wither"]},
		"nightshift:art_tr_remnant_aw": {"tier": 5, "name": "Ожерелье реликта ✦", "pool": "awakened", "base": "nightshift:art_tr_remnant", "dr": 0.18, "buffs": [["minecraft:water_breathing", 0]], "immune": ["minecraft:slowness", "minecraft:blindness"]},
		"nightshift:art_tr_monstrosity_aw": {"tier": 5, "name": "Незеритовое сердце ✦", "pool": "awakened", "base": "nightshift:art_tr_monstrosity", "hp": 18, "armor": 6.0, "tough": 3.0, "speed": -0.05}
	},
	"byTier": [["nightshift:art_patch", "nightshift:art_badge", "nightshift:art_thermos"], ["nightshift:art_buckle", "nightshift:art_qc_stripe", "nightshift:art_watch_charm"], ["nightshift:art_fang", "nightshift:art_pauldron", "nightshift:art_collar"], ["nightshift:art_stone_heart", "nightshift:art_rosary", "nightshift:art_butcher_glove"], ["nightshift:art_titan_blood", "nightshift:art_visor", "nightshift:art_second_wind"], ["nightshift:art_hourglass", "nightshift:art_horde_heart"], ["nightshift:art_vakhta_heart", "nightshift:art_halo"]],
	"chance": {"from": 0.08, "to": 0.6, "toWave": 100, "infPerWave": 0.0125, "infMax": 0.85, "firstMult": 1.5, "firstMax": 0.95, "firstSureEvery": 10},
	"weights": [
		[1, [78, 22, 0, 0, 0, 0, 0]],
		[8, [66, 28, 6, 0, 0, 0, 0]],
		[15, [55, 30, 12, 3, 0, 0, 0]],
		[27, [40, 30, 19, 9, 2, 0, 0]],
		[43, [28, 27, 23, 13, 7, 2, 0]],
		[60, [18, 22, 25, 18, 11, 6, 0]],
		[80, [10, 16, 23, 23, 16, 12, 0]],
		[90, [8, 14, 22, 24, 17, 14, 1]],
		[100, [6, 12, 20, 24, 19, 16, 3]],
		[120, [4, 10, 18, 24, 21, 17, 6]]
	],
	"caps": {"dr": 0.35, "life": 0.2, "lifeCap": 5, "regen": 2, "thorns": 0.5, "dodge": 0.25, "killHeal": 8, "hp": 60},
	"combatTicks": 100,
	"attrs": [["hp", "minecraft:generic.max_health", "ADD_VALUE"], ["armor", "minecraft:generic.armor", "ADD_VALUE"], ["tough", "minecraft:generic.armor_toughness", "ADD_VALUE"], ["kb", "minecraft:generic.knockback_resistance", "ADD_VALUE"], ["speed", "minecraft:generic.movement_speed", "ADD_MULTIPLIED_BASE"], ["dmg", "minecraft:generic.attack_damage", "ADD_VALUE"], ["aspd", "minecraft:generic.attack_speed", "ADD_MULTIPLIED_BASE"], ["mine", "minecraft:player.block_break_speed", "ADD_MULTIPLIED_BASE"], ["iframes", "artifacts:generic.invincibility_ticks", "ADD_VALUE"]],
	"themes": {
		"shaft": {"name": "Шахта", "chance": 0.12, "items": ["nightshift:art_shaft_helmet", "nightshift:art_shaft_mace"]},
		"canyon": {"name": "Каньон пауков", "chance": 0.12, "items": ["nightshift:art_canyon_silk", "nightshift:art_canyon_gland"]},
		"frost": {"name": "Вечная мерзлота", "chance": 0.12, "items": ["nightshift:art_frost_shard", "nightshift:art_frost_heart"]},
		"inferno": {"name": "Пекло", "chance": 0.12, "items": ["nightshift:art_inferno_ash", "nightshift:art_inferno_crown"]},
		"ender": {"name": "Край", "chance": 0.12, "items": ["nightshift:art_ender_feather", "nightshift:art_ender_void"]},
		"nightmare": {"name": "Кошмар", "chance": 0.12, "items": ["nightshift:art_nightmare_lantern", "nightshift:art_nightmare_claw"]},
		"abyss": {"name": "Звёздная бездна", "chance": 0.04, "items": ["nightshift:art_abyss_star"]}
	},
	"themeFirstMult": 2,
	"themeTierWeight": {"3": 6, "4": 3, "5": 1, "6": 1},
	"trophies": {
		"arphex:spider_goliath": "nightshift:art_tr_matriarch",
		"arphex:spider_matriarch": "nightshift:art_tr_matriarch",
		"arphex:termite_tunneler_king": "nightshift:art_tr_termite",
		"arphex:arthropleura_abomination": "nightshift:art_tr_termite",
		"arphex:scorpioid_bloodluster": "nightshift:art_tr_scorpioid",
		"arphex:draconic_voidlasher": "nightshift:art_tr_voidlasher",
		"arphex:arachnoid_trisector": "nightshift:art_tr_trisector",
		"arphex:diabolos_decimator": "nightshift:art_tr_diabolos",
		"cataclysm:amethyst_crab": "nightshift:art_tr_amethyst",
		"cataclysm:clawdian": "nightshift:art_tr_amethyst",
		"cataclysm:kobolediator": "nightshift:art_tr_gladiator",
		"cataclysm:aptrgangr": "nightshift:art_tr_gladiator",
		"cataclysm:wadjet": "nightshift:art_tr_gladiator",
		"cataclysm:ender_golem": "nightshift:art_tr_golem",
		"cataclysm:the_prowler": "nightshift:art_tr_golem",
		"cataclysm:ender_guardian": "nightshift:art_tr_guardian",
		"cataclysm:ignis": "nightshift:art_tr_ignis",
		"cataclysm:maledictus": "nightshift:art_tr_maledictus",
		"cataclysm:the_harbinger": "nightshift:art_tr_maledictus",
		"cataclysm:ancient_remnant": "nightshift:art_tr_remnant",
		"cataclysm:scylla": "nightshift:art_tr_remnant",
		"cataclysm:netherite_monstrosity": "nightshift:art_tr_monstrosity"
	},
	"bossNames": {
		"arphex:spider_goliath": "Голиаф",
		"arphex:spider_matriarch": "Паучиха-матриарх",
		"arphex:termite_tunneler_king": "Термитный король",
		"arphex:arthropleura_abomination": "Артроплевра-мерзость",
		"arphex:scorpioid_bloodluster": "Скорпиоид-кровопийца",
		"arphex:draconic_voidlasher": "Пустотный драконохвост",
		"arphex:arachnoid_trisector": "Арахноид-трисектор",
		"arphex:diabolos_decimator": "Диаболос-истребитель",
		"cataclysm:amethyst_crab": "Аметистовый краб",
		"cataclysm:clawdian": "Клаудиан",
		"cataclysm:kobolediator": "Кобольдиатор",
		"cataclysm:aptrgangr": "Аптргангр",
		"cataclysm:wadjet": "Уаджет",
		"cataclysm:ender_golem": "Голем Края",
		"cataclysm:the_prowler": "Рыскун",
		"cataclysm:ender_guardian": "Страж Края",
		"cataclysm:ignis": "Игнис",
		"cataclysm:maledictus": "Маледиктус",
		"cataclysm:the_harbinger": "Предвестник",
		"cataclysm:ancient_remnant": "Древний реликт",
		"cataclysm:netherite_monstrosity": "Незеритовое чудовище",
		"cataclysm:scylla": "Сцилла"
	},
	"trophyChance": {"4": 0.15, "5": 0.1},
	"reforge": {"n": 3, "maxTier": 5},
	"shards": {"early": [1, 0.005, 15, 0.015], "mid": [16, 0.015, 70, 0.06], "latePerWave": 0.0005, "max": 0.08, "vanillaMult": 0.5, "boss": [4, 8]}
}
// </ДАННЫЕ>

function nsArtClass(name) {
	try {
		return Java.loadClass(name)
	} catch (e) {
		console.warn('[nightshift] артефакты смены: класс ' + name + ' недоступен: ' + e)
		return null
	}
}
var NS_ART_CURIOS = nsArtClass('top.theillusivec4.curios.api.CuriosApi')
var NS_ART_EV_IN = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
var NS_ART_EV_PRE = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingDamageEvent$Pre')
var NS_ART_EV_POST = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingDamageEvent$Post')
var NS_ART_EV_DEATH = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingDeathEvent')
var NS_ART_EV_APPL = nsArtClass('net.neoforged.neoforge.event.entity.living.MobEffectEvent$Applicable')
var NS_ART_APPL_RES = nsArtClass('net.neoforged.neoforge.event.entity.living.MobEffectEvent$Applicable$Result')
var NS_ART_EV_EQUIP = nsArtClass('top.theillusivec4.curios.api.event.CurioCanEquipEvent')
var NS_ART_EV_CHANGE = nsArtClass('top.theillusivec4.curios.api.event.CurioChangeEvent')
var NS_ART_TRI = nsArtClass('net.neoforged.neoforge.common.util.TriState')
var NS_ART_REG = nsArtClass('net.minecraft.core.registries.BuiltInRegistries')
var NS_ART_RL = nsArtClass('net.minecraft.resources.ResourceLocation')
var NS_ART_MOD = nsArtClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
var NS_ART_OP = nsArtClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
var NS_ART_DTT = nsArtClass('net.minecraft.tags.DamageTypeTags')
var NS_ART_MEI = nsArtClass('net.minecraft.world.effect.MobEffectInstance')
var NS_ART_ENEMY = nsArtClass('net.minecraft.world.entity.monster.Enemy')

var NS_ART_P = {} // uuid → сумма эффектов надетого (null — ничего не надето)
var NS_ART_M = {} // uuid → {hurt, shieldUntil, shieldReady, fill, windTold, san} — память боя
var NS_ART_DIRTY = {} // uuid → пересчитать на ближайшем тике (сменили надетое, возродился, вошёл)
var NS_ART_TP = {} // uuid → телепорт второго дыхания на ближайшем тике (не внутри события урона)
// сколько игроков онлайн с артефактами / с эффектами от своих ударов / за убийство / с медленным падением /
// с иммунитетами — быстрый выход из обработчиков (урон по мобам от турелей идёт сотнями в секунду)
var NS_ART_ANY = 0
var NS_ART_HIT = 0
var NS_ART_KILL = 0
var NS_ART_FF = 0
var NS_ART_IMM = 0
var NS_ART_HOLDERS = {} // id атрибута → Holder (или false)
var NS_ART_EFFECTS = {} // id эффекта → Holder (или false)

// --------------------------------------------------------------------------
// Шансы выпадения (числа — в блоке данных: NS_ART.chance, NS_ART.weights, NS_ART.themes, NS_ART.trophyChance)
// --------------------------------------------------------------------------

// Шанс получить артефакт волн за победу на волне d (выше 100 — Бесконечность). first — первое прохождение:
// шанс ×firstMult, каждая firstSureEvery-я волна в первый раз — наверняка.
function nsArtChance(d, first) {
	var C = NS_ART.chance
	d = Math.max(1, Number(d) || 1)
	var p = d <= C.toWave ? C.from + ((C.to - C.from) * (d - 1)) / (C.toWave - 1) : Math.min(C.infMax, C.to + C.infPerWave * (d - C.toWave))
	if (first) p = d % C.firstSureEvery === 0 ? 1 : Math.min(C.firstMax, p * C.firstMult)
	return p
}

// Распределение по уровням на волне d: 7 чисел в процентах (сумма 100). Между опорными волнами — линейно,
// уровень до своей волны (tiers[t].from) — 0.
function nsArtWeights(d) {
	var W = NS_ART.weights
	d = Math.max(1, Number(d) || 1)
	var row = W[W.length - 1][1].slice()
	if (d <= W[0][0]) row = W[0][1].slice()
	else {
		for (var i = 0; i + 1 < W.length; i++) {
			if (d >= W[i][0] && d <= W[i + 1][0]) {
				var f = (d - W[i][0]) / (W[i + 1][0] - W[i][0])
				row = []
				for (var t = 0; t < W[i][1].length; t++) row.push(W[i][1][t] + (W[i + 1][1][t] - W[i][1][t]) * f)
				break
			}
		}
	}
	var sum = 0
	for (var k = 0; k < row.length; k++) {
		if (d < NS_ART.tiers[k].from) row[k] = 0
		sum += row[k]
	}
	for (var j = 0; j < row.length; j++) row[j] = sum > 0 ? (row[j] * 100) / sum : 0
	return row
}

// Бросок уровня по весам; страховка от погрешности — последний уровень с ненулевым весом
function nsArtPickTier(w) {
	var r = Math.random() * 100
	var last = 0
	for (var t = 0; t < w.length; t++) {
		if (w[t] <= 0) continue
		last = t
		if (r < w[t]) return t
		r -= w[t]
	}
	return last
}

// Тема арены из ctx (только победа НА арене): {name, chance, items} или null
function nsArtTheme(ctx) {
	if (!ctx || !ctx.arena || !ctx.theme) return null
	return NS_ART.themes[String(ctx.theme)] || null
}

// Артефакт арены: шанс темы (первое прохождение ×themeFirstMult), внутри темы — по весу уровня
function nsArtThemeRoll(ctx, first) {
	var T = nsArtTheme(ctx)
	if (!T || !T.items.length) return null
	if (Math.random() >= Math.min(1, T.chance * (first ? NS_ART.themeFirstMult : 1))) return null
	var total = 0
	for (var i = 0; i < T.items.length; i++) total += NS_ART.themeTierWeight[String(NS_ART.items[T.items[i]].tier)] || 1
	var r = Math.random() * total
	for (var j = 0; j < T.items.length; j++) {
		r -= NS_ART.themeTierWeight[String(NS_ART.items[T.items[j]].tier)] || 1
		if (r < 0) return T.items[j]
	}
	return T.items[T.items.length - 1]
}

// Добыча набега — для КАЖДОГО защитника отдельно: [] или строки [id, 1, id, пояснение] (формат nsGiveLoot).
// d — номер волны (выше 100 — Бесконечность), first — первое прохождение,
// ctx (необязательно) — {arena: true/false, theme: 'frost'|…} — артефакт арены в теме волны. Трофеи боссов здесь
// НЕ бросаются — для них NSG.nsNsBossTrophyRoll (там «наверняка одному» на всю команду).
NSG.nsNsArtifactRoll = function (d, first, ctx) {
	var out = []
	try {
		if (Math.random() < nsArtChance(d, first)) {
			var t = nsArtPickTier(nsArtWeights(d))
			var pool = NS_ART.byTier[t]
			var id = pool[Math.floor(Math.random() * pool.length)]
			out.push([id, 1, id, NS_ART.tiers[t].name + ' артефакт смены'])
		}
	} catch (e) {
		console.warn('[nightshift] артефакт смены: бросок не удался: ' + e)
	}
	try {
		var th = nsArtThemeRoll(ctx, first)
		if (th) out.push([th, 1, th, 'артефакт арены «' + nsArtTheme(ctx).name + '»'])
	} catch (e2) {
		console.warn('[nightshift] артефакт арены: бросок не удался: ' + e2)
	}
	return out
}

// Трофей босса id: {id, name, tier, chance, boss} или null
NSG.nsNsBossTrophyFor = function (bossId) {
	var tid = NS_ART.trophies[String(bossId)]
	if (!tid) return null
	var e = NS_ART.items[tid]
	return { id: tid, name: e.name, tier: e.tier, chance: NS_ART.trophyChance[String(e.tier)] || 0.1, boss: NS_ART.bossNames[String(bossId)] || String(bossId) }
}

// Трофеи боссов за победу: bosses — id убитых в волне боссов (повторы не важны), players — защитники с добычей.
// Каждому — шанс трофея (легендарный 15 %, мифический 10 %); first — первое прохождение волны: один случайный
// защитник получает трофей наверняка. Возвращает [{player, line}], line — строка добычи для nsGiveLoot.
NSG.nsNsBossTrophyRoll = function (d, first, bosses, players) {
	var out = []
	try {
		var list = bosses || []
		var ps = players || []
		var seen = {}
		for (var b = 0; b < list.length; b++) {
			var bid = String(list[b])
			var tr = NSG.nsNsBossTrophyFor(bid)
			if (!tr || seen[tr.id]) continue
			seen[tr.id] = true
			var lucky = first && ps.length ? Math.floor(Math.random() * ps.length) : -1
			for (var i = 0; i < ps.length; i++) {
				if (i === lucky || Math.random() < tr.chance) out.push({ player: ps[i], line: [tr.id, 1, tr.id, 'трофей: ' + tr.boss] })
			}
		}
	} catch (e) {
		console.warn('[nightshift] трофей босса: бросок не удался: ' + e)
	}
	return out
}

function nsArtPct(x) {
	if (x > 0 && x < 1) return '<1'
	return String(Math.round(x))
}

// Подсказка у алтаря: «Артефакт смены: 34 % — обычный 24 %, редкий 26 %, …»; first — с учётом первого прохождения;
// ctx (необязательно) — {arena, theme, bosses}: добавит артефакт арены и трофеи боссов волны
NSG.nsNsArtifactHoverText = function (d, first, ctx) {
	try {
		var w = nsArtWeights(d)
		var parts = []
		for (var t = 0; t < w.length; t++) if (w[t] > 0) parts.push(NS_ART.tiers[t].name + ' ' + nsArtPct(w[t]) + ' %')
		var head = 'Артефакт смены: ' + nsArtPct(nsArtChance(d, false) * 100) + ' %'
		if (first) head += ' (первое прохождение — ' + nsArtPct(nsArtChance(d, true) * 100) + ' %)'
		var s = head + ' — ' + parts.join(', ')
		var T = nsArtTheme(ctx)
		if (T) s += '. Арена «' + T.name + '»: артефакт арены ' + nsArtPct(Math.min(1, T.chance * (first ? NS_ART.themeFirstMult : 1)) * 100) + ' %'
		var seen = {}
		var bs = (ctx && ctx.bosses) || []
		for (var b = 0; b < bs.length; b++) {
			var tr = NSG.nsNsBossTrophyFor(bs[b])
			if (!tr || seen[tr.id]) continue
			seen[tr.id] = true
			s += '. Трофей «' + tr.name + '»: ' + nsArtPct(tr.chance * 100) + ' %' + (first ? ', одному — наверняка' : '')
		}
		return s
	} catch (e) {
		return 'Артефакт смены: шанс растёт с волной'
	}
}

// Это артефакт смены (любой: волн, арены, трофей)? и его уровень 0–6 (-1 — нет)
NSG.nsNsArtifactIs = function (id) {
	return !!NS_ART.items[String(id)]
}
NSG.nsNsArtifactTier = function (id) {
	var e = NS_ART.items[String(id)]
	return e ? e.tier : -1
}
NSG.nsNsArtifactWeights = nsArtWeights
NSG.nsNsArtifactChance = nsArtChance

// --------------------------------------------------------------------------
// Что надето и сколько это даёт
// --------------------------------------------------------------------------

function nsArtItemId(stack) {
	try {
		if (stack == null || stack.isEmpty()) return ''
		return String(NS_ART_REG.ITEM.getKey(stack.getItem()))
	} catch (e) {
		return ''
	}
}

// Ячейки слота «Реликвия» игрока (IDynamicStackHandler) или null
function nsArtRelicStacks(entity) {
	if (!NS_ART_CURIOS || entity == null) return null
	var inv = NS_ART_CURIOS.getCuriosInventory(entity).orElse(null)
	if (inv == null) return null
	var h = inv.getStacksHandler(NS_ART.slot).orElse(null)
	return h == null ? null : h.getStacks()
}

// Вид артефакта: у пробуждённого — id обычного (одного вида вместе не носят)
function nsArtBase(id) {
	var e = NS_ART.items[id]
	return e && e.base ? e.base : id
}

// Уникальные по виду id надетых артефактов смены (обычный и пробуждённый одного вида — считается пробуждённый)
function nsArtWorn(player) {
	var out = []
	var st = nsArtRelicStacks(player)
	if (st == null) return out
	var byBase = {}
	for (var i = 0; i < st.getSlots(); i++) {
		var id = nsArtItemId(st.getStackInSlot(i))
		if (!id || !NS_ART.items[id]) continue
		var b = nsArtBase(id)
		if (!byBase[b] || NS_ART.items[id].pool === 'awakened') byBase[b] = id
	}
	for (var k in byBase) out.push(byBase[k])
	return out
}

var NS_ART_SUM_KEYS = ['hp', 'armor', 'tough', 'kb', 'speed', 'dmg', 'aspd', 'mine', 'iframes', 'dr', 'life', 'lifeCap', 'regen', 'thorns', 'dodge', 'killHeal']

// [[эффект, уровень, тики]] → в словарь {эффект: [уровень, тики]}, больший уровень и дольше
function nsArtMergeFx(into, list) {
	for (var i = 0; i < (list || []).length; i++) {
		var e = list[i]
		var cur = into[e[0]]
		into[e[0]] = cur ? [Math.max(cur[0], e[1]), Math.max(cur[1], e[2] || 0)] : [e[1], e[2] || 0]
	}
}

// Сумма эффектов с потолками NS_ART.caps; щит, второе дыхание и аура — лучший из надетых
function nsArtSum(ids) {
	var a = { ids: ids, shield: null, wind: null, aura: null, buffs: {}, immune: {}, noDmg: {}, hitFx: {}, hurtFx: {}, killFx: {}, hitFire: 0, hurtFire: 0, featherfall: false, sanity: false }
	for (var k = 0; k < NS_ART_SUM_KEYS.length; k++) a[NS_ART_SUM_KEYS[k]] = 0
	for (var i = 0; i < ids.length; i++) {
		var e = NS_ART.items[ids[i]]
		for (var s = 0; s < NS_ART_SUM_KEYS.length; s++) if (e[NS_ART_SUM_KEYS[s]]) a[NS_ART_SUM_KEYS[s]] += e[NS_ART_SUM_KEYS[s]]
		if (e.shield && (!a.shield || e.shield.cd < a.shield.cd)) a.shield = e.shield
		if (e.wind) {
			var tp = !!e.wind.tp || (a.wind ? a.wind.tp : false)
			var best = !a.wind || e.wind.cd < a.wind.cd ? e.wind : a.wind
			a.wind = { cd: best.cd, after: best.after, tp: tp }
		}
		if (e.aura && (!a.aura || e.aura.dmg > a.aura.dmg)) a.aura = e.aura
		for (var b = 0; b < (e.buffs || []).length; b++) a.buffs[e.buffs[b][0]] = Math.max(a.buffs[e.buffs[b][0]] || 0, e.buffs[b][1])
		for (var m = 0; m < (e.immune || []).length; m++) a.immune[e.immune[m]] = true
		for (var n = 0; n < (e.noDmg || []).length; n++) a.noDmg[e.noDmg[n]] = true
		nsArtMergeFx(a.hitFx, e.hitFx)
		nsArtMergeFx(a.hurtFx, e.hurtFx)
		nsArtMergeFx(a.killFx, e.killFx)
		if (e.hitFire) a.hitFire = Math.max(a.hitFire, e.hitFire)
		if (e.hurtFire) a.hurtFire = Math.max(a.hurtFire, e.hurtFire)
		if (e.featherfall) a.featherfall = true
		if (e.sanity) a.sanity = true
	}
	var C = NS_ART.caps
	a.dr = Math.min(C.dr, a.dr)
	a.life = Math.min(C.life, a.life)
	a.lifeCap = Math.min(C.lifeCap, a.lifeCap)
	a.regen = Math.min(C.regen, a.regen)
	a.thorns = Math.min(C.thorns, a.thorns)
	a.dodge = Math.min(C.dodge, a.dodge)
	a.killHeal = Math.min(C.killHeal, a.killHeal)
	a.kb = Math.min(1, a.kb)
	if (C.hp) a.hp = Math.min(C.hp, a.hp)
	a.hasImmune = Object.keys(a.immune).length > 0
	a.hasHit = a.life > 0 || a.hitFire > 0 || Object.keys(a.hitFx).length > 0
	a.hasKill = a.killHeal > 0 || Object.keys(a.killFx).length > 0
	return a
}

function nsArtHolder(attrId) {
	if (NS_ART_HOLDERS[attrId] !== undefined) return NS_ART_HOLDERS[attrId]
	var h = false
	try {
		var o = NS_ART_REG.ATTRIBUTE.getHolder(NS_ART_RL.parse(attrId))
		if (o.isPresent()) h = o.get()
	} catch (e) {}
	if (!h) console.warn('[nightshift] артефакты смены: атрибута ' + attrId + ' нет — этот эффект пропускается')
	NS_ART_HOLDERS[attrId] = h
	return h
}

function nsArtEffect(effId) {
	if (NS_ART_EFFECTS[effId] !== undefined) return NS_ART_EFFECTS[effId]
	var h = false
	try {
		var o = NS_ART_REG.MOB_EFFECT.getHolder(NS_ART_RL.parse(effId))
		if (o.isPresent()) h = o.get()
	} catch (e) {}
	if (!h) console.warn('[nightshift] артефакты смены: эффекта ' + effId + ' нет — пропускается')
	NS_ART_EFFECTS[effId] = h
	return h
}

// Эффект сущности: quiet — без частиц (постоянные эффекты артефактов)
function nsArtGive(e, effId, amp, ticks, quiet) {
	var h = nsArtEffect(effId)
	if (!h) return
	e.addEffect(quiet ? new NS_ART_MEI(h, ticks, amp, true, false) : new NS_ART_MEI(h, ticks, amp))
}

function nsArtIgnite(e, seconds) {
	try {
		e.igniteForSeconds(seconds)
	} catch (x) {
		try {
			e.setSecondsOnFire(seconds)
		} catch (y) {}
	}
}

function nsArtEffectId(inst) {
	try {
		return String(inst.getEffect().getRegisteredName())
	} catch (x) {}
	try {
		return String(NS_ART_REG.MOB_EFFECT.getKey(inst.getEffect().value()))
	} catch (y) {
		return ''
	}
}

// Модификаторы атрибутов nightshift:relic_<стат>: меняем только то, что разошлось с надетым
function nsArtApplyAttrs(player, a) {
	for (var i = 0; i < NS_ART.attrs.length; i++) {
		var key = NS_ART.attrs[i][0]
		var h = nsArtHolder(NS_ART.attrs[i][1])
		if (!h) continue
		var inst = player.getAttribute(h)
		if (inst == null) continue
		var rl = NS_ART_RL.parse('nightshift:relic_' + key)
		var want = a ? a[key] || 0 : 0
		var cur = inst.getModifier(rl)
		var have = cur == null ? 0 : Number(cur.amount())
		if (cur != null && Math.abs(have - want) < 1e-6) continue
		if (cur == null && want === 0) continue
		// AttributeInstance.removeModifier в Rhino неоднозначен (обе перегрузки, проверено 01.10) — снимаем методом
		// KubeJS removeAttribute(атрибут, id), ставим addOrReplacePermanentModifier
		if (want === 0) player.removeAttribute(h, rl)
		else inst.addOrReplacePermanentModifier(new NS_ART_MOD(rl, want, NS_ART_OP[NS_ART.attrs[i][2]]))
	}
}

function nsArtCall(o, names) {
	for (var i = 0; i < names.length; i++) {
		try {
			var f = o[names[i]]
			if (typeof f !== 'function') continue
			var r = f.call(o)
			if (r != null) return r
		} catch (x) {}
	}
	return null
}

function nsArtUuid(e) {
	try {
		if (e == null || !e.isPlayer()) return null
		var u = nsArtCall(e, ['getStringUuid', 'getStringUUID'])
		return u == null ? null : String(u)
	} catch (x) {
		return null
	}
}

function nsArtMem(u) {
	if (!NS_ART_M[u]) NS_ART_M[u] = { hurt: -1e9, shieldUntil: 0, shieldReady: 0, fill: false, windTold: true }
	return NS_ART_M[u]
}

// Игровое время мира (общее для измерений, переживает рестарт) — для перезарядок
function nsArtNow(e) {
	var lvl = e != null ? nsArtCall(e, ['getLevel']) : null
	if (lvl == null) lvl = NSG.nsServer.overworld()
	return Number(nsArtCall(lvl, ['getTime', 'getGameTime']))
}

function nsArtRun(cmd) {
	try {
		NSG.nsServer.runCommandSilent(cmd)
	} catch (e) {}
}

function nsArtFx(name, sound, particle) {
	if (sound) nsArtRun('execute at ' + name + ' run playsound ' + sound + ' player ' + name + ' ~ ~ ~ 0.7 1.4')
	if (particle) nsArtRun('execute at ' + name + ' run particle ' + particle)
}

// Огненная аура: монстры рядом горят и получают урон «шипами» игрока (убийство засчитывается ему, вампиризм — нет)
function nsArtAura(p, au) {
	if (!NS_ART_ENEMY) return
	var list = p.getLevel().getEntitiesOfClass(NS_ART_ENEMY, p.getBoundingBox().inflate(au.r))
	var n = Math.min(24, list.size())
	if (n <= 0) return
	var src = p.damageSources().thorns(p)
	for (var i = 0; i < n; i++) {
		var e = list.get(i)
		if (!e.isAlive() || e.isPlayer()) continue
		if (au.fire) nsArtIgnite(e, au.fire)
		e.attack(src, au.dmg)
	}
	var nm = String(p.getUsername())
	nsArtRun('execute at ' + nm + ' run particle minecraft:flame ~ ~1 ~ ' + au.r / 2 + ' 0.4 ' + au.r / 2 + ' 0.01 12')
}

// Второе дыхание с телепортом: до 16 попыток в квадрате ±6 блоков (как хорус), на следующем тике после спасения
function nsArtTeleport(p) {
	for (var i = 0; i < 16; i++) {
		var x = p.getX() + (Math.random() - 0.5) * 12
		var y = p.getY() + Math.floor(Math.random() * 5) - 2
		var z = p.getZ() + (Math.random() - 0.5) * 12
		if (p.randomTeleport(x, y, z, true)) {
			nsArtFx(String(p.getUsername()), 'minecraft:entity.enderman.teleport', null)
			return true
		}
	}
	return false
}

// Пересчёт игрока: надетое → модификаторы; раз в секунду (second) — постоянные эффекты, иммунитеты, лечение вне
// боя, аура, рассудок, «второе дыхание готово»
function nsArtRefresh(player, u, second) {
	var ids = nsArtWorn(player)
	var a = ids.length ? nsArtSum(ids) : null
	NS_ART_P[u] = a
	nsArtApplyAttrs(player, a)
	var m = nsArtMem(u)
	if (m.fill) {
		// после возрождения здоровье — полное по новому максимуму (иначе +50 HP артефактов пришлось бы отращивать)
		m.fill = false
		if (!player.isDeadOrDying()) player.setHealth(player.getMaxHealth())
	}
	if (!second || !a) return
	var now = nsArtNow(player)
	for (var b in a.buffs) nsArtGive(player, b, a.buffs[b], b === 'minecraft:night_vision' ? 320 : 80, true) // ночное зрение — дольше 10 с, иначе мигает
	for (var im in a.immune) {
		var h = nsArtEffect(im)
		if (h && player.hasEffect(h)) player.removeEffect(h)
	}
	if (a.regen > 0 && now - m.hurt >= NS_ART.combatTicks && !player.isDeadOrDying() && player.getHealth() < player.getMaxHealth()) player.heal(a.regen)
	if (a.aura) {
		try {
			nsArtAura(player, a.aura)
		} catch (e) {}
	}
	if (a.sanity && typeof NS_SANITY !== 'undefined') {
		// Sanity: Renewed хранит долю безумия (0 — вменяем). Во тьме (свет ≤ 7) не даём ей расти.
		try {
			var cap = NS_SANITY.get(player)
			if (cap) {
				var cur = cap.getSanity()
				if (player.getBlock().getLight() <= 7 && m.san !== undefined && cur > m.san) cap.setSanity(m.san)
				else m.san = cur
			}
		} catch (e2) {}
	}
	if (a.wind && !m.windTold) {
		var pd = player.persistentData
		if (!pd.contains('ns_art_wind') || now >= Number(pd.getLong('ns_art_wind'))) {
			m.windTold = true
			player.tell(Text.gold('[Ночная смена] Второе дыхание снова готово.'))
		}
	}
}

ServerEvents.tick(event => {
	var server = event.server
	var tick = server.getTickCount()
	var second = tick % 20 === 0
	var feather = NS_ART_FF > 0 && tick % 4 === 0
	var pending = false
	for (var k in NS_ART_DIRTY) {
		pending = true
		break
	}
	for (var k2 in NS_ART_TP) {
		pending = true
		break
	}
	if (!second && !pending && !feather) return
	try {
		var players = server.getPlayers()
		var any = 0
		var hit = 0
		var kill = 0
		var ff = 0
		var imm = 0
		for (var i = 0; i < players.length; i++) {
			var p = players[i]
			var u = nsArtUuid(p)
			if (!u) continue
			try {
				if (second || NS_ART_DIRTY[u]) nsArtRefresh(p, u, second)
				var a = NS_ART_P[u]
				if (NS_ART_TP[u]) nsArtTeleport(p)
				// медленное падение с Shift: проверка раз в 4 тика, эффект на полсекунды
				if (a && a.featherfall && (feather || second) && p.isShiftKeyDown() && !nsArtCall(p, ['onGround', 'isOnGround'])) nsArtGive(p, 'minecraft:slow_falling', 0, 10, true)
			} catch (e) {
				console.warn('[nightshift] артефакты смены: пересчёт ' + p.getUsername() + ': ' + e)
			}
			var s = NS_ART_P[u]
			if (s) {
				any++
				if (s.hasHit) hit++
				if (s.hasKill) kill++
				if (s.featherfall) ff++
				if (s.hasImmune) imm++
			}
		}
		NS_ART_ANY = any
		NS_ART_HIT = hit
		NS_ART_KILL = kill
		NS_ART_FF = ff
		NS_ART_IMM = imm
	} catch (e) {
		console.warn('[nightshift] артефакты смены: тик: ' + e)
	}
	NS_ART_DIRTY = {}
	NS_ART_TP = {}
})

PlayerEvents.loggedIn(event => {
	var u = nsArtUuid(event.getPlayer())
	if (u) NS_ART_DIRTY[u] = true
})

PlayerEvents.respawned(event => {
	var u = nsArtUuid(event.getPlayer())
	if (!u) return
	nsArtMem(u).fill = true
	NS_ART_DIRTY[u] = true
})

PlayerEvents.loggedOut(event => {
	var u = nsArtUuid(event.getPlayer())
	if (!u) return
	delete NS_ART_P[u]
	delete NS_ART_M[u]
})

// --------------------------------------------------------------------------
// Бой
// --------------------------------------------------------------------------

// Урон, который нельзя отменять: падение в пустоту, /kill
function nsArtBypass(src) {
	try {
		if (NS_ART_DTT && src.is(NS_ART_DTT.BYPASSES_INVULNERABILITY)) return true
	} catch (x) {}
	try {
		var id = nsArtMsgId(src)
		return id === 'outOfWorld' || id === 'genericKill'
	} catch (x) {
		return false
	}
}

// id типа урона («thorns», «fall», «outOfWorld», …)
function nsArtMsgId(src) {
	var id = nsArtCall(src, ['getType', 'getMsgId'])
	return id == null ? '' : String(id)
}

// атакующий (владелец снаряда) и прямой источник (сам моб или снаряд)
function nsArtAttacker(src) {
	return nsArtCall(src, ['getActual', 'getEntity'])
}
function nsArtDirect(src) {
	return nsArtCall(src, ['getImmediate', 'getDirectEntity'])
}

// Урон «тьмы» (sanity/20_darkness.js): /damage magic в тот же тик, что метка ns_dark_hit
function nsArtDarkHit(p, msg) {
	if (msg !== 'magic') return false
	try {
		var pd = p.persistentData
		return pd.contains('ns_dark_hit') && Number(pd.getLong('ns_dark_hit')) >= NSG.nsServer.getTickCount() - 1
	} catch (x) {
		return false
	}
}

// Щит после удара, иммунитет к типам урона, урон тьмы под «Фонарём», уклонение, срез урона.
// Удар во время щита или уклонение отменяются целиком (ни урона, ни отбрасывания).
if (NS_ART_EV_IN) {
	NativeEvents.onEvent(NS_ART_EV_IN, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var p = event.getEntity()
			var u = nsArtUuid(p)
			if (!u) return
			var a = NS_ART_P[u]
			if (!a) return
			var src = event.getSource()
			if (nsArtBypass(src)) return
			var m = NS_ART_M[u]
			if (m && m.shieldUntil > nsArtNow(p)) {
				event.setCanceled(true)
				return
			}
			var msg = nsArtMsgId(src)
			if (a.noDmg[msg] || (a.sanity && nsArtDarkHit(p, msg))) {
				event.setCanceled(true)
				return
			}
			if (a.dodge > 0 && Math.random() < a.dodge && (nsArtAttacker(src) != null || nsArtDirect(src) != null)) {
				event.setCanceled(true)
				var nm = String(p.getUsername())
				nsArtFx(nm, 'minecraft:entity.enderman.teleport', 'minecraft:portal ~ ~1 ~ 0.3 0.6 0.3 0.4 20 normal ' + nm)
				return
			}
			if (a.dr > 0) event.setAmount(event.getAmount() * (1 - a.dr))
		} catch (x) {}
	})
}

// Второе дыхание: смертельный удар (с учётом поглощения) оставляет 1 HP и даёт несколько секунд щита
if (NS_ART_EV_PRE) {
	NativeEvents.onEvent(NS_ART_EV_PRE, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var p = event.getEntity()
			var u = nsArtUuid(p)
			if (!u) return
			var a = NS_ART_P[u]
			if (!a || !a.wind) return
			var src = event.getSource()
			if (nsArtBypass(src)) return
			var pool = p.getHealth() + p.getAbsorptionAmount()
			if (event.getNewDamage() < pool) return
			var now = nsArtNow(p)
			var pd = p.persistentData
			if (pd.contains('ns_art_wind') && now < Number(pd.getLong('ns_art_wind'))) return
			event.setNewDamage(Math.max(0, pool - 1))
			pd.putLong('ns_art_wind', now + a.wind.cd)
			var m = nsArtMem(u)
			m.shieldUntil = Math.max(m.shieldUntil, now + a.wind.after)
			m.windTold = false
			if (a.wind.tp) NS_ART_TP[u] = true
			var name = String(p.getUsername())
			nsArtFx(name, 'minecraft:item.totem.use', 'minecraft:totem_of_undying ~ ~1 ~ 0.4 0.6 0.4 0.4 40 normal ' + name)
			p.tell(Text.gold('[Ночная смена] Второе дыхание! ').append(Text.white('Смертельный удар оставил 1 HP, ' + Math.round(a.wind.after / 20) + ' с неуязвимости' + (a.wind.tp ? ', рывок в сторону' : '') + '. Снова — через ' + Math.round(a.wind.cd / 1200) + ' мин.')))
		} catch (x) {}
	})
}

// После урона. Игрок ранен: «был в бою», щит, отражение, эффекты и поджог ударившего вплотную.
// Урон нанёс игрок: вампиризм, эффекты и поджог от его ударов (кроме отражённого и ауры — источник «шипы»).
if (NS_ART_EV_POST) {
	NativeEvents.onEvent(NS_ART_EV_POST, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var dmg = event.getNewDamage()
			if (!(dmg > 0)) return
			var v = event.getEntity()
			var src = event.getSource()
			var vu = nsArtUuid(v)
			if (vu) {
				var a = NS_ART_P[vu]
				if (!a) return
				var now = nsArtNow(v)
				var m = nsArtMem(vu)
				m.hurt = now
				var by = nsArtAttacker(src)
				var direct = nsArtDirect(src)
				// щит включает только удар моба или снаряда: огонь, яд и падение его не тратят
				if (a.shield && (by != null || direct != null) && now >= m.shieldReady && m.shieldUntil <= now) {
					m.shieldUntil = now + a.shield.dur
					m.shieldReady = now + a.shield.cd
					var nm = String(v.getUsername())
					nsArtFx(nm, 'minecraft:block.amethyst_block.chime', 'minecraft:end_rod ~ ~1 ~ 0.3 0.5 0.3 0.02 8 normal ' + nm)
				}
				// только ближний бой: прямой источник — сам атакующий, а не стрела
				if (by != null && direct != null && !by.isPlayer() && by.getId() === direct.getId() && by.getId() !== v.getId() && by.isAlive()) {
					for (var hf in a.hurtFx) nsArtGive(by, hf, a.hurtFx[hf][0], a.hurtFx[hf][1], false)
					if (a.hurtFire > 0) nsArtIgnite(by, a.hurtFire)
					if (a.thorns > 0) by.attack(v.damageSources().thorns(v), dmg * a.thorns) // hurt в KubeJS для JS скрыт — attack(источник, урон)
				}
				return
			}
			if (NS_ART_HIT <= 0) return
			var att = nsArtAttacker(src)
			var bu = nsArtUuid(att)
			if (!bu) return
			var b = NS_ART_P[bu]
			if (!b || !b.hasHit) return
			if (nsArtMsgId(src) === 'thorns') return // отражённый урон и аура не лечат и не накладывают эффекты
			if (b.life > 0 && !att.isDeadOrDying()) att.heal(Math.min(b.lifeCap, dmg * b.life))
			if (v.isAlive()) {
				for (var xf in b.hitFx) nsArtGive(v, xf, b.hitFx[xf][0], b.hitFx[xf][1], false)
				if (b.hitFire > 0) nsArtIgnite(v, b.hitFire)
			}
		} catch (x) {}
	})
}

// За убийство: лечение и эффекты (Рог диаболоса, Медальон гладиатора)
if (NS_ART_EV_DEATH) {
	NativeEvents.onEvent(NS_ART_EV_DEATH, function (event) {
		try {
			if (NS_ART_KILL <= 0) return
			var v = event.getEntity()
			if (v == null || v.isPlayer()) return
			var att = nsArtAttacker(event.getSource())
			var u = nsArtUuid(att)
			if (!u) return
			var b = NS_ART_P[u]
			if (!b || !b.hasKill || att.isDeadOrDying()) return
			if (b.killHeal > 0) att.heal(b.killHeal)
			for (var kf in b.killFx) nsArtGive(att, kf, b.killFx[kf][0], b.killFx[kf][1], true)
		} catch (x) {}
	})
}

// Иммунитеты: эффект из списка надетого не накладывается (а уже наложенный снимается раз в секунду — nsArtRefresh)
if (NS_ART_EV_APPL && NS_ART_APPL_RES) {
	NativeEvents.onEvent(NS_ART_EV_APPL, function (event) {
		try {
			if (NS_ART_IMM <= 0) return
			var u = nsArtUuid(event.getEntity())
			if (!u) return
			var a = NS_ART_P[u]
			if (!a || !a.hasImmune) return
			if (a.immune[nsArtEffectId(event.getEffectInstance())]) event.setResult(NS_ART_APPL_RES.DO_NOT_APPLY)
		} catch (x) {}
	})
}

// Одинаковые не складываются: второй такой же (или обычный и пробуждённый одного вида) в «Реликвию» не встанет
if (NS_ART_EV_EQUIP && NS_ART_TRI) {
	NativeEvents.onEvent(NS_ART_EV_EQUIP, function (event) {
		try {
			var ctx = event.getSlotContext()
			if (String(ctx.identifier()) !== NS_ART.slot) return
			var id = nsArtItemId(event.getStack())
			if (!NS_ART.items[id]) return
			var st = nsArtRelicStacks(ctx.entity())
			if (st == null) return
			var idx = Number(ctx.index())
			var base = nsArtBase(id)
			for (var i = 0; i < st.getSlots(); i++) {
				var other = nsArtItemId(st.getStackInSlot(i))
				if (i !== idx && other && nsArtBase(other) === base) {
					event.setEquipResult(NS_ART_TRI.FALSE)
					return
				}
			}
		} catch (x) {}
	})
}

// Сменили надетое — пересчёт на ближайшем тике, не ждём секунду
if (NS_ART_EV_CHANGE) {
	NativeEvents.onEvent(NS_ART_EV_CHANGE, function (event) {
		try {
			if (String(event.getIdentifier()) !== NS_ART.slot) return
			var u = nsArtUuid(event.getEntity())
			if (u) NS_ART_DIRTY[u] = true
		} catch (x) {}
	})
}

// --------------------------------------------------------------------------
// Осколки орды: падают с мобов набега в копилку набега (server.persistentData, ключ ns_horde_pool = {rid, n}) —
// на землю не кладём: турели бьют в 40 блоках от алтаря, а арену после набега откатывают вместе с предметами.
// Набег раздаёт копилку победителям (NSG.nsNsHordeShardTake в nsRaidRewards); провал — копилка сгорает
// (следующий набег начнёт свою: rid — из метки ns_r<номер> на мобах). /kill и пустота осколков не дают.
// --------------------------------------------------------------------------

// Шанс осколка с моба на волне d (выше 100 — Бесконечность); ванильные мобы — ×vanillaMult
function nsArtShardChance(d, typeId) {
	var S = NS_ART.shards
	d = Math.max(1, Number(d) || 1)
	var p
	if (d <= S.early[2]) p = S.early[1] + ((S.early[3] - S.early[1]) * (d - S.early[0])) / (S.early[2] - S.early[0])
	else if (d <= S.mid[2]) p = S.mid[1] + ((S.mid[3] - S.mid[1]) * Math.max(0, d - S.mid[0])) / (S.mid[2] - S.mid[0])
	else p = Math.min(S.max, S.mid[3] + S.latePerWave * (d - S.mid[2]))
	if (typeId && String(typeId).indexOf('minecraft:') === 0) p *= S.vanillaMult
	return p
}

function nsArtPoolGet() {
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains('ns_horde_pool')) return JSON.parse(String(pd.getString('ns_horde_pool')))
	} catch (e) {}
	return { rid: '', n: 0 }
}

function nsArtPoolSet(p) {
	NSG.nsServer.persistentData.putString('ns_horde_pool', JSON.stringify(p))
}

// Сколько осколков в копилке текущего (или только что законченного) набега
NSG.nsNsHordeShardCount = function () {
	return nsArtPoolGet().n || 0
}

// Забрать копилку (вызывает nsRaidRewards ОДИН раз за победу, до раздачи): число осколков, копилка обнуляется
NSG.nsNsHordeShardTake = function () {
	var p = nsArtPoolGet()
	var n = p.n || 0
	try {
		nsArtPoolSet({ rid: p.rid, n: 0 })
	} catch (e) {}
	return n
}

// Метка набега на мобе (ns_r<номер>) или null — не моб набега
function nsArtRaidRid(e) {
	var tags = e.getTags()
	if (!tags.contains('nightshift_raid')) return null
	var it = tags.iterator()
	while (it.hasNext()) {
		var t = String(it.next())
		if (t.indexOf('ns_r') === 0) return t
	}
	return 'ns_r?'
}

function nsArtTypeId(e) {
	try {
		var t = String(e.getType()) // KubeJS: id строкой
		if (t.indexOf(':') > 0) return t
	} catch (x) {}
	try {
		return String(NS_ART_REG.ENTITY_TYPE.getKey(e.getEntityType()))
	} catch (y) {
		return ''
	}
}

// id боссов волны d (босс приходит после всех подволн — raid.bossSpawned)
var NS_ART_BOSS_IDS = { d: -1, ids: [] }
function nsArtBossIds(d) {
	if (NS_ART_BOSS_IDS.d === d) return NS_ART_BOSS_IDS.ids
	var ids = []
	try {
		var cfg = nsChallengeHorde(d)
		if (cfg.boss) ids.push(String(cfg.boss.id))
		for (var i = 0; cfg.bossExtra && i < cfg.bossExtra.length; i++) ids.push(String(cfg.bossExtra[i].boss.id))
	} catch (e) {}
	NS_ART_BOSS_IDS = { d: d, ids: ids }
	return ids
}

// Моб набега умер: бросок осколка (босс — boss[0]..boss[1] наверняка) в копилку набега rid. Возвращает число осколков.
function nsArtHordeDrop(v, rid) {
	var S = NS_ART.shards
	var raid = nsGetStateRO().raid || {}
	var d = Math.max(1, Number(raid.difficulty) || 1)
	var typeId = nsArtTypeId(v)
	var n = 0
	var boss = !!raid.bossSpawned && nsArtBossIds(d).indexOf(typeId) >= 0
	if (boss) n = S.boss[0] + Math.floor(Math.random() * (S.boss[1] - S.boss[0] + 1))
	else if (Math.random() < nsArtShardChance(d, typeId)) n = 1
	if (n <= 0) return 0
	var p = nsArtPoolGet()
	if (p.rid !== rid) p = { rid: rid, n: 0 }
	p.n += n
	nsArtPoolSet(p)
	try {
		var dim = String(v.getLevel().getDimension())
		nsArtRun('execute in ' + dim + ' run particle minecraft:end_rod ' + v.getX() + ' ' + (v.getY() + 1) + ' ' + v.getZ() + ' 0.2 0.4 0.2 0.05 ' + 4 * n)
		if (boss && typeof nsTellAll === 'function') nsTellAll(Text.lightPurple('[Ночная смена] Босс оставил ' + n + ' осколков орды — в копилке набега ' + p.n + '.'))
	} catch (x) {}
	return n
}

if (NS_ART_EV_DEATH) {
	NativeEvents.onEvent(NS_ART_EV_DEATH, function (event) {
		try {
			var v = event.getEntity()
			if (v == null || v.isPlayer()) return
			var rid = nsArtRaidRid(v)
			if (!rid) return
			if (nsArtBypass(event.getSource())) return // /kill (уборка мобов набега) и пустота — не добыча
			nsArtHordeDrop(v, rid)
		} catch (x) {}
	})
}

// --------------------------------------------------------------------------
// Переплавка: n артефактов волн одного уровня из инвентаря → 1 случайный следующего (не выше мифического)
// --------------------------------------------------------------------------

// План: самый низкий уровень, где набралось n; сначала повторы. {tier, take: [{slot, id}]} или null
function nsArtReforgePlan(player) {
	var R = NS_ART.reforge
	var inv = player.getInventory()
	var byTier = []
	for (var t = 0; t < NS_ART.tiers.length; t++) byTier.push([])
	for (var i = 0; i < 36; i++) {
		var id = nsArtItemId(inv.getItem(i))
		var e = NS_ART.items[id]
		if (!e || e.pool !== 'wave' || e.tier >= R.maxTier) continue
		byTier[e.tier].push({ slot: i, id: id })
	}
	for (var k = 0; k < byTier.length; k++) {
		var list = byTier[k]
		if (list.length < R.n) continue
		var cnt = {}
		for (var j = 0; j < list.length; j++) cnt[list[j].id] = (cnt[list[j].id] || 0) + 1
		list.sort(function (x, y) {
			return cnt[y.id] - cnt[x.id] || x.slot - y.slot
		})
		return { tier: k, take: list.slice(0, R.n) }
	}
	return null
}

// Переплавить: {from, to, id} или null (нечего). Выдача — в инвентарь, не влезло — под ноги.
NSG.nsNsArtifactReforge = function (player) {
	var plan = nsArtReforgePlan(player)
	if (!plan) return null
	var inv = player.getInventory()
	for (var i = 0; i < plan.take.length; i++) if (nsArtItemId(inv.getItem(plan.take[i].slot)) !== plan.take[i].id) return null
	for (var j = 0; j < plan.take.length; j++) inv.removeItem(plan.take[j].slot, 1)
	var pool = NS_ART.byTier[plan.tier + 1]
	var id = pool[Math.floor(Math.random() * pool.length)]
	player.give(Item.of(id))
	return { from: plan.tier, to: plan.tier + 1, id: id }
}

// Кнопка для меню алтаря: «[Переплавить 3 → 1]» с подсказкой, или null — переплавлять нечего
NSG.nsNsArtifactReforgeText = function (player) {
	try {
		var plan = nsArtReforgePlan(player)
		if (!plan) return null
		var R = NS_ART.reforge
		return Text.lightPurple('[Переплавить ' + R.n + ' → 1]')
			.clickRunCommand('/nsart reforge')
			.hover(Text.gray(R.n + ' ' + NS_ART.tiers[plan.tier].gen + ' артефакта из инвентаря → 1 случайный ' + NS_ART.tiers[plan.tier + 1].name + '. Сначала повторы. Трофеи и артефакты арены не переплавляются.'))
	} catch (e) {
		return null
	}
}

function nsArtReforgeCmd(ctx) {
	var p = ctx.source.getPlayer()
	if (!p) return 0
	var r = null
	try {
		r = NSG.nsNsArtifactReforge(p)
	} catch (e) {
		console.warn('[nightshift] переплавка: ' + e)
	}
	if (!r) {
		p.tell(Text.gray('[Ночная смена] Переплавлять нечего: нужно ' + NS_ART.reforge.n + ' артефакта волн одного уровня в инвентаре (не в слотах), не выше легендарного.'))
		return 0
	}
	var line = Text.lightPurple('[Ночная смена] Переплавка: ' + NS_ART.reforge.n + ' ' + NS_ART.tiers[r.from].gen + ' → ').append(Text.translate('item.' + r.id.replace(':', '.')))
	if (r.to >= 4 && typeof nsTellAll === 'function') nsTellAll(Text.lightPurple('[Ночная смена] ' + p.getUsername() + ' переплавляет артефакты: ').append(Text.translate('item.' + r.id.replace(':', '.'))))
	else p.tell(line)
	nsArtFx(String(p.getUsername()), 'minecraft:block.anvil.use', null)
	return 1
}

// --------------------------------------------------------------------------
// Команды: /nsart — что даёт надетое; /nsart reforge; /nsart odds <волна>;
// оператор: /nsart roll <волна> [first], /nsart rolltheme <тема> — 1000 бросков
// --------------------------------------------------------------------------

function nsArtNum(x) {
	return String(Math.round(x * 100) / 100).replace('.', ',')
}

function nsArtStatus(ctx) {
	var p = ctx.source.getPlayer()
	if (!p) return 0
	var u = nsArtUuid(p)
	var ids = nsArtWorn(p)
	if (!ids.length) {
		ctx.source.sendSystemMessage(Text.gold('[Ночная смена] ').append(Text.white('Артефактов смены в слотах «Реликвия» нет (кнопка Curios в инвентаре).')))
		return 1
	}
	var a = nsArtSum(ids)
	var t = Text.gold('[Ночная смена] Надето: ')
	for (var i = 0; i < ids.length; i++) {
		if (i > 0) t = t.append(Text.gray(', '))
		t = t.append(Text.translate('item.' + ids[i].replace(':', '.')))
	}
	var parts = []
	if (a.hp) parts.push('здоровье +' + nsArtNum(a.hp))
	if (a.armor) parts.push('броня +' + nsArtNum(a.armor))
	if (a.tough) parts.push('прочность брони +' + nsArtNum(a.tough))
	if (a.kb) parts.push('отбрасывание −' + Math.round(a.kb * 100) + ' %')
	if (a.speed) parts.push('скорость ' + (a.speed > 0 ? '+' : '−') + Math.round(Math.abs(a.speed) * 100) + ' %')
	if (a.dmg) parts.push('урон +' + nsArtNum(a.dmg))
	if (a.aspd) parts.push('скорость атаки +' + Math.round(a.aspd * 100) + ' %')
	if (a.mine) parts.push('копание +' + Math.round(a.mine * 100) + ' %')
	if (a.iframes) parts.push('неуязвимость после удара +' + nsArtNum(a.iframes / 20) + ' с')
	if (a.dr) parts.push('входящий урон −' + Math.round(a.dr * 100) + ' %')
	if (a.dodge) parts.push('уклонение ' + Math.round(a.dodge * 100) + ' %')
	if (a.life) parts.push('вампиризм ' + Math.round(a.life * 100) + ' % (до ' + nsArtNum(a.lifeCap) + ' HP за удар)')
	if (a.regen) parts.push('вне боя +' + nsArtNum(a.regen) + ' HP/с')
	if (a.thorns) parts.push('отражение ' + Math.round(a.thorns * 100) + ' %')
	if (a.killHeal) parts.push('убийство лечит ' + nsArtNum(a.killHeal) + ' HP')
	if (a.aura) parts.push('огненная аура ' + a.aura.r + ' бл.')
	var imm = Object.keys(a.immune)
	if (imm.length) parts.push('иммунитетов: ' + imm.length)
	if (a.shield) parts.push('щит ' + nsArtNum(a.shield.dur / 20) + ' с после удара, раз в ' + nsArtNum(a.shield.cd / 20) + ' с')
	if (a.wind) {
		var pd = p.persistentData
		var left = pd.contains('ns_art_wind') ? Number(pd.getLong('ns_art_wind')) - nsArtNow(p) : 0
		parts.push('второе дыхание ' + (left > 0 ? 'через ' + Math.ceil(left / 20) + ' с' : 'готово'))
	}
	ctx.source.sendSystemMessage(t)
	ctx.source.sendSystemMessage(Text.white(parts.join('; ')))
	ctx.source.sendSystemMessage(Text.gray('Здоровье ' + nsArtNum(p.getHealth()) + ' / ' + nsArtNum(p.getMaxHealth()) + (NS_ART_P[u] ? '' : ' (эффекты включатся в течение секунды)')))
	var btn = NSG.nsNsArtifactReforgeText(p)
	if (btn) ctx.source.sendSystemMessage(Text.gray('Есть что переплавить: ').append(btn))
	var pool = NSG.nsNsHordeShardCount()
	if (pool > 0) ctx.source.sendSystemMessage(Text.lightPurple('Осколков орды в копилке набега: ' + pool + ' (раздадут победителям)'))
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	event.register(
		Commands.literal('nsart')
			.executes(ctx => nsArtStatus(ctx))
			.then(Commands.literal('reforge').executes(ctx => nsArtReforgeCmd(ctx)))
			.then(
				Commands.literal('odds').then(
					Commands.argument('wave', Arguments.INTEGER.create(event)).executes(ctx => {
						var d = Number(Arguments.INTEGER.getResult(ctx, 'wave'))
						ctx.source.sendSystemMessage(Text.gold('[Ночная смена] Волна ' + d + ': ').append(Text.white(NSG.nsNsArtifactHoverText(d, true))))
						return 1
					})
				)
			)
			.then(
				Commands.literal('roll')
					.requires(src => src.hasPermission(2))
					.then(
						Commands.argument('wave', Arguments.INTEGER.create(event))
							.executes(ctx => nsArtRollTest(ctx, Number(Arguments.INTEGER.getResult(ctx, 'wave')), false))
							.then(Commands.literal('first').executes(ctx => nsArtRollTest(ctx, Number(Arguments.INTEGER.getResult(ctx, 'wave')), true)))
					)
			)
			.then(
				Commands.literal('rolltheme')
					.requires(src => src.hasPermission(2))
					.then(Commands.argument('theme', Arguments.STRING.create(event)).executes(ctx => nsArtThemeTest(ctx, String(Arguments.STRING.getResult(ctx, 'theme')))))
			)
	)
})

// 1000 бросков на волне d — проверка шансов без набега
function nsArtRollTest(ctx, d, first) {
	var n = 1000
	var got = 0
	var byTier = [0, 0, 0, 0, 0, 0, 0]
	for (var i = 0; i < n; i++) {
		var r = NSG.nsNsArtifactRoll(d, first)
		if (!r.length) continue
		got++
		byTier[NS_ART.items[r[0][0]].tier]++
	}
	var parts = []
	for (var t = 0; t < byTier.length; t++) if (byTier[t]) parts.push(NS_ART.tiers[t].name + ' ' + byTier[t])
	ctx.source.sendSystemMessage(Text.gold('[Ночная смена] ' + n + ' бросков, волна ' + d + (first ? ' (первое прохождение)' : '') + ': ').append(Text.white('артефактов ' + got + ' — ' + parts.join(', '))))
	return 1
}

// 1000 побед на арене в теме key (без первого прохождения): сколько артефактов арены и каких
function nsArtThemeTest(ctx, key) {
	var T = NS_ART.themes[key]
	if (!T) {
		ctx.source.sendSystemMessage(Text.red('Нет темы ' + key + '. Есть: ' + Object.keys(NS_ART.themes).join(', ')))
		return 0
	}
	var cnt = {}
	var got = 0
	for (var i = 0; i < 1000; i++) {
		var id = nsArtThemeRoll({ arena: true, theme: key }, false)
		if (!id) continue
		got++
		cnt[id] = (cnt[id] || 0) + 1
	}
	var parts = []
	for (var k in cnt) parts.push(NS_ART.items[k].name + ' ' + cnt[k])
	ctx.source.sendSystemMessage(Text.gold('[Ночная смена] Арена «' + T.name + '», 1000 побед: ').append(Text.white('артефактов арены ' + got + ' — ' + parts.join(', '))))
	return 1
}
