// ============================================================================
// Create: Ночная смена — блокировка предметов по фазам (AStages Item Restriction)
// Путь назначения в паке: kubejs/server_scripts/nightshift/02_items.js
// ============================================================================
//
// API: AStages.addRestrictionForItem(id, stage, ...items)
// По умолчанию рестрикция блокирует «почти всё» (подбор, крафт как ингредиент
// через блок правого клика, использование, помещение в инвентарь/контейнеры и
// т.д.) — см. wiki/AStages-Item-Restriction.md. Мы НЕ включаем showInRecipeViewer()
// специально: пока фаза не открыта, предмет и в JEI/REI/EMI не должен светиться
// (кроме случаев, когда явно хотим дать "превью" — сейчас не хотим).
//
// ПРОВЕРЕНО: item id взяты из leak_audit.json + перепроверены distribution jar
// (cgs steel-линия, createbigcannons steel-линия, northstar item id).
// НЕ ПРОВЕРЕНО: поведение AItemRestriction для предметов, которые ТОЛЬКО
// используются как ингредиент в рецептах машин Create (не как предмет в руке
// игрока) — по описанию wiki рестрикция должна блокировать это тоже
// ("preventing their use or crafting"), но это не гонялось на живом сервере
// именно для рецептов конвейера Create (воронки/трубы кладут предмет в машину
// без явного "использования" игроком) — риск №3, см. README.

// ВАЖНО: addRestrictionForItem принимает variadic Item... — передаём аргументы
// через .apply(), а НЕ единым массивом, т.к. вики-примеры показывают отдельные
// аргументы (Rhino должен корректно развернуть JS-массив в Java varargs через
// apply(), но НЕ ПРОВЕРЕНО на живом сервере с этой версией Rhino/KubeJS —
// если apply() не сработает, замените на явный список item-параметров).
var NS_ITEMS = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').ITEM
var NS_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')

function lockItems(id, stage) {
    // берём только реально зарегистрированные предметы: один битый id не должен
    // ронять весь файл (так было с tfmg:sulfuric_acid — это жидкость, не предмет)
    var items = []
    Array.prototype.slice.call(arguments, 2).forEach(function (s) {
        if (NS_ITEMS.containsKey(NS_RL.parse(s))) items.push(s)
        else console.warn('[nightshift] пропущен несуществующий предмет ' + s + ' (' + id + ')')
    })
    if (items.length === 0) return null
    return AStages.addRestrictionForItem.apply(AStages, [id, stage].concat(items))
}

// ---------------------------------------------------------------------------
// P1 «Разнорабочий»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/iron', 'nightshift_p1',
    'minecraft:raw_iron', 'minecraft:iron_nugget', 'minecraft:iron_ingot', 'minecraft:iron_block')
lockItems('nightshift:item/copper', 'nightshift_p1',
    'minecraft:raw_copper', 'create:copper_nugget', 'minecraft:copper_ingot', 'minecraft:copper_block')
lockItems('nightshift:item/coal', 'nightshift_p1', 'minecraft:coal')
// charcoal НЕ блокируем — топливо P0 (дерево -> уголь древесный) должно остаться
// доступным, иначе в P0 нечем топить печь/сито (см. заметку в leak_audit.json P1)
lockItems('nightshift:item/andesite_alloy', 'nightshift_p1',
    'minecraft:andesite', 'create:andesite_alloy', 'create:andesite_casing')

// ---------------------------------------------------------------------------
// P2 «Латунь»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/zinc', 'nightshift_p2',
    'create:raw_zinc', 'create:zinc_nugget', 'create:zinc_ingot', 'create:zinc_block')
lockItems('nightshift:item/gold', 'nightshift_p2',
    'minecraft:raw_gold', 'minecraft:gold_nugget', 'minecraft:gold_ingot', 'minecraft:gold_block')
lockItems('nightshift:item/brass', 'nightshift_p2',
    'create:brass_ingot', 'create:brass_nugget', 'create:brass_block', 'create:brass_sheet')

// ---------------------------------------------------------------------------
// P3 «Пар и глубина»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/redstone', 'nightshift_p3', 'minecraft:redstone')
lockItems('nightshift:item/lapis', 'nightshift_p3', 'minecraft:lapis_lazuli')
lockItems('nightshift:item/diamond', 'nightshift_p3', 'minecraft:diamond')
lockItems('nightshift:item/emerald', 'nightshift_p3', 'minecraft:emerald')
lockItems('nightshift:item/quartz', 'nightshift_p3', 'minecraft:quartz')
lockItems('nightshift:item/glowstone', 'nightshift_p3', 'minecraft:glowstone_dust', 'minecraft:glowstone')
lockItems('nightshift:item/netherite', 'nightshift_p3',
    'minecraft:netherite_scrap', 'minecraft:netherite_ingot', 'minecraft:netherite_upgrade_smithing_template',
    'minecraft:ancient_debris')

// ---------------------------------------------------------------------------
// P4 «Сталь и нефть»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/lead', 'nightshift_p4',
    'tfmg:raw_lead', 'tfmg:lead_ingot', 'tfmg:lead_nugget', 'tfmg:raw_lead_block',
    'cgs:raw_lead', 'cgs:lead_ingot', 'cgs:lead_nugget', 'cgs:raw_lead_block')
lockItems('nightshift:item/nickel', 'nightshift_p4',
    'tfmg:raw_nickel', 'tfmg:nickel_ingot', 'tfmg:nickel_bars')
lockItems('nightshift:item/lithium', 'nightshift_p4',
    'tfmg:raw_lithium', 'tfmg:lithium_ingot', 'tfmg:crushed_raw_lithium')
lockItems('nightshift:item/sulfur', 'nightshift_p4',
    'tfmg:sulfur', 'tfmg:sulfur_dust', 'tfmg:sulfuric_acid_bucket', 'cgs:sulfur')
lockItems('nightshift:item/oil', 'nightshift_p4', 'tfmg:crude_oil_bucket', 'tfmg:heavy_oil_bucket', 'createdieselgenerators:crude_oil_bucket')
lockItems('nightshift:item/nitrate', 'nightshift_p4', 'tfmg:nitrate_dust')
// СТАЛЬ: единая линия TFMG — единственный легальный источник с P4 (см. §12
// плана: "одна, TFMG, P4"). Дублирующие "дешёвые" стали Big Cannons и
// Gunsmithing (cgs) сводим к ней — см. 09_steel_unification.js, где убираются
// дешёвые рецепты. Здесь же блокируем САМИ альтернативные предметы до P4 —
// это подстраховка на случай, если где-то остался обходной путь их получить
// (лут, торговля, креатив-меню и т.п.), а также чтобы AlmostUnified не считал
// их "легальными" источниками тега c:ingots/steel раньше срока.
lockItems('nightshift:item/steel_tfmg', 'nightshift_p4',
    'tfmg:steel_ingot', 'tfmg:steel_block', 'tfmg:cast_iron_ingot')
lockItems('nightshift:item/steel_cgs', 'nightshift_p4',
    'cgs:steel_ingot', 'cgs:steel_nugget', 'cgs:steel_block', 'cgs:steel_sheet')
lockItems('nightshift:item/steel_bigcannons', 'nightshift_p4',
    'createbigcannons:steel_ingot', 'createbigcannons:steel_scrap', 'createbigcannons:steel_block')
// Платина (createpropulsion) -> P4, решение §12
lockItems('nightshift:item/platinum', 'nightshift_p4',
    'createpropulsion:raw_platinum', 'createpropulsion:raw_platinum_block',
    'createpropulsion:platinum_ingot', 'createpropulsion:platinum_nugget',
    'createpropulsion:platinum_block', 'createpropulsion:platinum_sheet')

// ---------------------------------------------------------------------------
// P5 «Энергия»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/thorium', 'nightshift_p5',
    'create_new_age:thorium', 'create_new_age:radioactive_thorium')
// "Закалённый алмаз" (createoreexcavation:ore_vein_type/hardened_diamond) -> P3,
// решение §12. ВАЖНО: при распаковке jar выяснилось, что это НЕ отдельный
// предмет, а название ТИПА ЖИЛЫ — выход рецепта drilling/hardened_diamond.json
// это createoreexcavation:raw_diamond + шанс minecraft:diamond, то есть ровно
// те же предметы, что уже заблокированы выше как nightshift:item/diamond
// (raw_diamond туда не попал — добавляем отдельно для полноты).
lockItems('nightshift:item/raw_diamond_oreexcavation', 'nightshift_p3', 'createoreexcavation:raw_diamond')
lockItems('nightshift:item/raw_emerald_oreexcavation', 'nightshift_p3', 'createoreexcavation:raw_emerald')
lockItems('nightshift:item/raw_redstone_oreexcavation', 'nightshift_p3', 'createoreexcavation:raw_redstone')
// Гейтинг САМОЙ жилы hardened_diamond (кто может её бурить и когда) — через
// рецепт бурения, см. 04_drilling_gate.js.

// ---------------------------------------------------------------------------
// P6 «Космос»
// ---------------------------------------------------------------------------
lockItems('nightshift:item/titanium', 'nightshift_p6',
    'northstar:titanium_ingot', 'northstar:titanium_nugget', 'northstar:titanium_block',
    'northstar:raw_titanium_ore', 'northstar:rutile_concentrate', 'northstar:titanium_tetrachloride_bucket')
lockItems('nightshift:item/tungsten', 'nightshift_p6',
    'northstar:tungsten_ingot', 'northstar:tungsten_nugget', 'northstar:tungsten_block',
    'northstar:raw_tungsten_ore')
lockItems('nightshift:item/martian_misc', 'nightshift_p6',
    'northstar:martian_steel_ingot', 'northstar:raw_martian_iron_ore',
    'northstar:lunar_sapphire_shard', 'northstar:lunar_sapphire_crystal',
    'northstar:enriched_glowstone_ore', 'northstar:raw_glowstone_ore')

// ВАЖНО про P6 «sequence break» (см. leak_audit.json general_notes): титан
// синтезируется полностью на Земле химией TFMG (rutile_concentrate + zinc ->
// titanium_tetrachloride -> titanium_ingot), минуя руду вообще, и это уже
// заблокировано выше (titanium_tetrachloride/titanium_ingot закрыты до P6).
// Но блоки самой РАКЕТЫ — отдельная страховка на случай, если материалы всё же
// раздобыты (например, креативом на тестовом сервере) — см. 08_rocket_lock.js.

// Сканер и зонды жил — фаза 4 (рудная экономика, PLAN.md §6); зонды поздних фаз дополнительно
// проверяет economy/10_probes.js
lockItems('nightshift:item/probes', 'nightshift_p4',
    'nightshift:vein_scanner',
    'nightshift:vein_seed_coal',
    'nightshift:vein_seed_copper',
    'nightshift:vein_seed_iron',
    'nightshift:vein_seed_gold',
    'nightshift:vein_seed_zinc',
    'nightshift:vein_seed_redstone',
    'nightshift:vein_seed_lapis',
    'nightshift:vein_seed_diamond',
    'nightshift:vein_seed_emerald',
    'nightshift:vein_seed_quartz',
    'nightshift:vein_seed_glowstone',
    'nightshift:vein_seed_netherite',
    'nightshift:vein_seed_hardened_diamond',
    'nightshift:vein_seed_lead',
    'nightshift:vein_seed_nickel',
    'nightshift:vein_seed_lithium',
    'nightshift:vein_seed_sulfur',
    'nightshift:vein_seed_platinum',
    'nightshift:vein_seed_thorium',
    'nightshift:vein_seed_titanium',
    'nightshift:vein_seed_tungsten',
    'nightshift:vein_seed_martian_iron')
