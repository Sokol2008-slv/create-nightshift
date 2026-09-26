// ============================================================================
// Create: Ночная смена — замена лута по фазам (AStages Loot Restriction)
// Путь назначения в паке: kubejs/server_scripts/nightshift/05_loot.js
// ============================================================================
//
// API: AStages.addRestrictionForLoot(id, stage) — ВАЖНО (wiki/AStages-Loot-
// Restriction.md, раздел "Basic Usage"): "This line instantiate a loot
// restriction but DOESN'T do anything itself" — рестрикция мертва, пока не
// навесить фильтры (restrictItems/restrictTags/restrictForLootTables/
// restrictForEntities/applyEverywhere и т.д.).
//
// По умолчанию удалённый предмет заменяется на ПУСТОЙ стак (Item.empty). Мы
// используем replacer() там, где явно хотим что-то дать взамен (ничего не дать
// тоже валидно и, возможно, даже правильнее для сундуков — пустой слот, а не
// "нейтральная замена", чтобы не плодить инфляцию камня/угля в сундуках).
//
// ПРОВЕРЕНО: список предметов/лут-таблиц взят из docs/phases/leak_audit.json
// (P0 и P3 loot_to_strip) — это НЕ перепроверялось построчно по каждому из
// ~85 loot_table совпадений из первоначального аудита (219 jar, 14461
// лут-таблиц) — это было бы отдельной большой задачей вне рамок черновика.
// НЕ ПРОВЕРЕНО: работает ли restrictForLootTables() с ID таблиц из аддонов типа
// YungsBetter (упомянуты в аудите как "дублирующие" структуры) — их точные ID
// НЕ извлекались из jar, только скопированы как текст из leak_audit.md.

// ---------------------------------------------------------------------------
// P0 «Выживший» — уголь как лут (не как крафт/руда — руды у P0 нет)
// ---------------------------------------------------------------------------
// Лут данжей и сундуков НЕ режем (решение 26.09): найденное можно забрать, но пользоваться им
// можно только с его фазы (02_items.js). Вернуть урезанный лут — поставить true.
var NS_RESTRICT_LOOT = false
if (NS_RESTRICT_LOOT) {
AStages.addRestrictionForLoot('nightshift:loot/p0_coal', 'nightshift_p1')
    .restrictItems('minecraft:coal')
    .restrictForLootTables(
        'minecraft:chests/abandoned_mineshaft',
        'minecraft:chests/simple_dungeon',
        'minecraft:chests/ancient_city',
        'minecraft:chests/igloo_chest',
        'minecraft:chests/shipwreck_supply',
        'minecraft:chests/stronghold_crossing',
        'minecraft:chests/underwater_ruin_big',
        'minecraft:chests/underwater_ruin_small',
        'minecraft:chests/woodland_mansion',
        'minecraft:chests/village/butcher',
        'minecraft:chests/village/fisher',
        'minecraft:chests/village/snowy_house',
        'minecraft:chests/village/toolsmith',
        'minecraft:archaeology/ocean_ruin_cold',
        'minecraft:archaeology/ocean_ruin_warm',
        'minecraft:archaeology/trail_ruins_common'
    )
    .restrictForEntities('minecraft:wither_skeleton')

// ---------------------------------------------------------------------------
// P3 «Пар и глубина» — самая дырявая фаза по лут-таблицам (см. leak_audit.json)
// ---------------------------------------------------------------------------
AStages.addRestrictionForLoot('nightshift:loot/p3_structures', 'nightshift_p3')
    .restrictItems(
        'minecraft:diamond', 'minecraft:emerald', 'minecraft:lapis_lazuli',
        'minecraft:redstone', 'minecraft:quartz', 'minecraft:glowstone_dust',
        'minecraft:glowstone', 'minecraft:ancient_debris', 'minecraft:netherite_scrap',
        'minecraft:netherite_ingot', 'minecraft:netherite_upgrade_smithing_template'
    )
    .restrictForLootTables(
        'minecraft:chests/desert_pyramid', 'minecraft:chests/jungle_temple',
        'minecraft:chests/buried_treasure', 'minecraft:chests/shipwreck_treasure',
        'minecraft:chests/end_city_treasure',
        // список stronghold-таблиц скопирован ДОСЛОВНО из leak_audit.md; ванильные
        // ID точно существующие в 1.21 — stronghold_corridor/crossing/library,
        // а "crypt"/"trap"/"treasure" в ауидте могут относиться к YungsBetterStrongholds
        // (не проверено чьё это — оставлены все варианты, несуществующий ID просто
        // не совпадёт ни с одной реальной таблицей и будет безвредным no-op)
        'minecraft:chests/stronghold_corridor', 'minecraft:chests/stronghold_crossing',
        'minecraft:chests/stronghold_library', 'minecraft:chests/stronghold_crypt',
        'minecraft:chests/stronghold_trap', 'minecraft:chests/stronghold_treasure',
        'minecraft:chests/nether_bridge',
        'minecraft:chests/bastion_bridge', 'minecraft:chests/bastion_hoglin_stable',
        'minecraft:chests/bastion_other', 'minecraft:chests/bastion_treasure',
        'minecraft:chests/abandoned_mineshaft', 'minecraft:chests/simple_dungeon',
        'minecraft:chests/woodland_mansion',
        // деревенские сундуки — почти везде emerald, у temple ещё lapis+redstone,
        // у toolsmith/weaponsmith — diamond
        'minecraft:chests/village/armorer', 'minecraft:chests/village/butcher',
        'minecraft:chests/village/desert_house', 'minecraft:chests/village/fisher',
        'minecraft:chests/village/fletcher', 'minecraft:chests/village/mason',
        'minecraft:chests/village/plains_house', 'minecraft:chests/village/savanna_house',
        'minecraft:chests/village/shepherd', 'minecraft:chests/village/snowy_house',
        'minecraft:chests/village/taiga_house', 'minecraft:chests/village/tannery',
        'minecraft:chests/village/temple', 'minecraft:chests/village/toolsmith',
        'minecraft:chests/village/weaponsmith',
        'minecraft:archaeology/desert_pyramid', 'minecraft:archaeology/desert_well',
        'minecraft:archaeology/ocean_ruin_cold', 'minecraft:archaeology/ocean_ruin_warm',
        'minecraft:archaeology/trail_ruins_common',
        'minecraft:gameplay/hero_of_the_village/cleric_gift', 'minecraft:gameplay/piglin_bartering'
    )
    .restrictForEntities('minecraft:evoker', 'minecraft:vindicator', 'minecraft:witch')

// YungsBetter* и аналогичные аддоны структур дублируют тот же список в
// увеличенном масштабе (собственные "chests" таблицы) — ID таблиц НЕ извлечены
// из jar (не было в scope этого черновика), нужно доснять отдельно командой:
//   /kubejs export_data loot_table   (или прямым сканированием jar, как делался
//   основной leak_audit.json) и добавить сюда через ещё один
//   .restrictForLootTables(...) вызов.

// Northstar lunar_base_chest/martian_base_chest c редстоуном — leak_audit.json
// прямо пишет "это уже P6-локация, редстоун там не проблема" — сознательно НЕ
// ограничиваем.
}
