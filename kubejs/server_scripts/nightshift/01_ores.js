// ============================================================================
// Create: Ночная смена — скрытие руд по фазам (AStages Ore Restriction)
// Путь назначения в паке: kubejs/server_scripts/nightshift/01_ores.js
// ============================================================================
//
// API: AStages.addRestrictionForOre(id, stage, originalBlockState, replacementBlockState)
// Источник: wiki/AStages-Ore-Restriction.md + javap com.alessandro.astages.engine
//           .server.restriction.AOreRestriction (метод restrict(OreWrapper),
//           поля original/replacement — порядок параметров подтверждён примером
//           из вики: addRestrictionForOre("astages/ore", "stage_ore",
//           Blocks.EMERALD_ORE.defaultBlockState(), Blocks.STONE.defaultBlockState())).
//
// .matchAllBlockStates() — на случай, если у блока есть свойства (waterlogged
// и т.п.); для большинства руд Minecraft/Create это не нужно, но не мешает.
//
// ПРОВЕРЕНО: id всех блоков ниже подтверждены прямым чтением jar-файлов модов
// из пака (не только по leak_audit.json, но и распаковкой assets/*, data/*),
// см. README "Что проверено". Отдельно перепроверены блоки Northstar (P6) —
// leak_audit.json указывал ~120 блоков и упоминал изумруд на Mars/Moon/Venus и
// дубль-опечатку "mercurys_deep_titanium_ore" — ПРИ ПРЯМОЙ РАСПАКОВКЕ
// Northstar-0.6.6+1.21.1.jar ни изумруда, ни этой опечатки НЕ обнаружено.
// Возможно, аудит смотрел на другую версию мода. Реальный список (73 блока)
// ниже — из assets/northstar/blockstates/*_ore.json этой точной jar.
//
// НЕ ПРОВЕРЕНО: как выглядит "скрытая" руда в игре (просто ли меняется текстура/
// хитбокс, не ломает ли anisotropic ambient occlusion built-in подсветку жил
// Create: Ore Excavation "Vein Finder"/"Vein Atlas" -- эти предметы сканируют
// именно оригинальный блок руды в мире, а не то, что видит игрок через
// AOreRestriction (рестрикция AStages работает на стороне
// рендера/взаимодействия конкретного игрока, а не переписывает реальный блок
// в мире) — то есть теоретически зонд/сканер жил Ore Excavation, работающий
// напрямую с BlockState чанка, может "видеть" руду в обход маскировки AStages.
// Это НЕ проверялось и является риском №1 для этой системы — см. README.

function hideOre(id, stage, originalId, replacementId) {
    // для неизвестного id getBlock может вернуть воздух — тогда AStages подменял бы
    // ВОЗДУХ на камень. Подменяем только если блок реально зарегистрирован.
    var orig = Block.getBlock(originalId), repl = Block.getBlock(replacementId)
    if (!orig || String(orig.id) !== originalId || !repl || String(repl.id) !== replacementId) {
        console.warn('[nightshift] пропущена руда ' + originalId + ' -> ' + replacementId + ' (' + id + ')')
        return
    }
    AStages.addRestrictionForOre(id, stage, orig.defaultBlockState(), repl.defaultBlockState())
        .matchAllBlockStates()
}

// ---------------------------------------------------------------------------
// P1 «Разнорабочий» — железо, медь, уголь (+ андезит как P0-блок остаётся видимым,
// сам блок андезита НЕ прячем, прячем только руды; андезит как ПРЕДМЕТ закрыт
// через item-restriction в 02_items.js, потому что генерируется как обычный
// террейн-блок, а не руда — маскировать блок в мире не нужно, здесь только руды)
// ---------------------------------------------------------------------------
hideOre('nightshift:ore/iron', 'nightshift_p1', 'minecraft:iron_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_iron', 'nightshift_p1', 'minecraft:deepslate_iron_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/copper', 'nightshift_p1', 'minecraft:copper_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_copper', 'nightshift_p1', 'minecraft:deepslate_copper_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/coal', 'nightshift_p1', 'minecraft:coal_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_coal', 'nightshift_p1', 'minecraft:deepslate_coal_ore', 'minecraft:deepslate')

// ---------------------------------------------------------------------------
// P2 «Латунь» — цинк, золото
// ---------------------------------------------------------------------------
hideOre('nightshift:ore/zinc', 'nightshift_p2', 'create:zinc_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_zinc', 'nightshift_p2', 'create:deepslate_zinc_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/gold', 'nightshift_p2', 'minecraft:gold_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_gold', 'nightshift_p2', 'minecraft:deepslate_gold_ore', 'minecraft:deepslate')
// nether_gold формально не актуален раньше P3 (Nether закрыт), но прячем на
// случай телепорта/бага/чужого мода, дающего доступ раньше срока
hideOre('nightshift:ore/nether_gold', 'nightshift_p3', 'minecraft:nether_gold_ore', 'minecraft:netherrack')
// Платина (createpropulsion) — решение §12: платина -> P4, но физически руда
// генерируется в Overworld, поэтому прячем сразу с P1 и открываем в P4 (см. ниже)
hideOre('nightshift:ore/platinum', 'nightshift_p4', 'createpropulsion:platinum_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_platinum', 'nightshift_p4', 'createpropulsion:deepslate_platinum_ore', 'minecraft:deepslate')

// ---------------------------------------------------------------------------
// P3 «Пар и глубина» — редстоун, лазурит, алмазы, изумруды, кварц, обломки
// ---------------------------------------------------------------------------
hideOre('nightshift:ore/redstone', 'nightshift_p3', 'minecraft:redstone_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_redstone', 'nightshift_p3', 'minecraft:deepslate_redstone_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/lapis', 'nightshift_p3', 'minecraft:lapis_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_lapis', 'nightshift_p3', 'minecraft:deepslate_lapis_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/diamond', 'nightshift_p3', 'minecraft:diamond_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_diamond', 'nightshift_p3', 'minecraft:deepslate_diamond_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/emerald', 'nightshift_p3', 'minecraft:emerald_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_emerald', 'nightshift_p3', 'minecraft:deepslate_emerald_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/quartz', 'nightshift_p3', 'minecraft:nether_quartz_ore', 'minecraft:netherrack')
hideOre('nightshift:ore/ancient_debris', 'nightshift_p3', 'minecraft:ancient_debris', 'minecraft:netherrack')
// glowstone — НЕ ore-фича, а обычный кластерный блок потолка Nether. Ore
// Restriction в AStages рассчитан на "блок руды -> блок-заглушка", формально
// сработает на любом BlockState, но результат маскировки (glowstone похож на
// кластер шаров, замена на netherrack визуально куда грубее, чем для обычной
// руды в толще камня) — см. README, риск №2, тестировать отдельно.
hideOre('nightshift:ore/glowstone', 'nightshift_p3', 'minecraft:glowstone', 'minecraft:netherrack')

// ---------------------------------------------------------------------------
// P4 «Сталь и нефть» — свинец (TFMG И Gunsmithing/cgs — разные блоки!), никель,
// литий, сера. Нефть (oil_deposit/oil_well) — жидкостная жила, НЕ блок руды,
// AOreRestriction для неё неприменим напрямую (см. README про нефть).
// ---------------------------------------------------------------------------
hideOre('nightshift:ore/tfmg_lead', 'nightshift_p4', 'tfmg:lead_ore', 'minecraft:stone')
hideOre('nightshift:ore/tfmg_deepslate_lead', 'nightshift_p4', 'tfmg:deepslate_lead_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/cgs_lead', 'nightshift_p4', 'cgs:lead_ore', 'minecraft:stone')
hideOre('nightshift:ore/cgs_deepslate_lead', 'nightshift_p4', 'cgs:deepslate_lead_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/nickel', 'nightshift_p4', 'tfmg:nickel_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_nickel', 'nightshift_p4', 'tfmg:deepslate_nickel_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/lithium', 'nightshift_p4', 'tfmg:lithium_ore', 'minecraft:stone')
hideOre('nightshift:ore/deepslate_lithium', 'nightshift_p4', 'tfmg:deepslate_lithium_ore', 'minecraft:deepslate')
hideOre('nightshift:ore/cgs_sulfur', 'nightshift_p4', 'cgs:sulfur_ore', 'minecraft:netherrack')
// ВАЖНО: tfmg:sulfur генерируется НЕ отдельной рудой, а частью terrain-блендинга
// (layered_ore слой Nether наравне с blackstone/basalt/scorchia/magma_block).
// AOreRestriction маскирует конкретный BlockState -> BlockState, поэтому
// технически применим и к tfmg:sulfur как блоку, НО т.к. это часть смешанного
// слоя (не изолированные вкрапления "руда в породе"), результат маскировки
// не тестировался — блок может быть частым "поверхностным" материалом обычного
// пола Nether, и после замены на blackstone это будет незаметно, а вот другие
// части того же блендинга (blackstone/basalt) останутся нетронутыми, что
// нормально. Возможный риск — производительность (частый блок на весь Nether).
hideOre('nightshift:ore/tfmg_sulfur_layer', 'nightshift_p4', 'tfmg:sulfur', 'minecraft:blackstone')

// ---------------------------------------------------------------------------
// P5 «Энергия» — торий (New Age). Урана в паке нет (подтверждено — Mekanism/
// Big Reactors отсутствуют, единственная ссылка на yellorium — мёртвый рецепт
// под условие mod_loaded:bigreactors, которого нет в паке).
// ---------------------------------------------------------------------------
hideOre('nightshift:ore/thorium', 'nightshift_p5', 'create_new_age:thorium_ore', 'minecraft:stone')
hideOre('nightshift:ore/thorium_e', 'nightshift_p5', 'create_new_age:thorium_ore_e', 'minecraft:stone')

// ---------------------------------------------------------------------------
// P6 «Космос» — Northstar, 4 планеты. Список подтверждён прямой распаковкой
// Northstar-0.6.6+1.21.1.jar (assets/northstar/blockstates/*_ore.json), не
// сгенерирован по шаблону — реальные наборы отличаются по планетам (см. ниже).
// Разница с leak_audit.json: НЕ найдено изумруда на Mars/Moon/Venus, НЕ найдено
// опечатки "mercurys_deep_titanium_ore" — обе детали не подтвердились в этой
// версии мода, см. README "Расхождения с аудитом".
// ---------------------------------------------------------------------------
var NORTHSTAR_PLANETS = {
    mars: {
        stone: 'mars_stone', deepStone: 'mars_deep_stone',
        // все 8 типов руды mars есть и в deep-варианте
        ores: ['copper', 'diamond', 'gold', 'iron', 'quartz', 'redstone', 'titanium', 'zinc']
    },
    mercury: {
        stone: 'mercury_stone', deepStone: 'mercury_deep_stone',
        // все 10 типов есть и в deep-варианте
        ores: ['copper', 'diamond', 'glowstone', 'gold', 'iron', 'lapis', 'redstone', 'titanium', 'tungsten', 'zinc']
    },
    moon: {
        stone: 'moon_stone', deepStone: 'moon_deep_stone',
        // все 9 типов есть и в deep-варианте
        ores: ['copper', 'diamond', 'glowstone', 'gold', 'iron', 'lapis', 'redstone', 'titanium', 'zinc']
    },
    venus: {
        stone: 'venus_stone', deepStone: 'venus_deep_stone',
        // coal есть ТОЛЬКО в базовом варианте, без deep_coal_ore (подтверждено файлами jar)
        ores: ['coal', 'copper', 'diamond', 'glowstone', 'gold', 'iron', 'quartz', 'redstone', 'titanium', 'zinc'],
        oresWithoutDeep: ['coal']
    }
}

Object.keys(NORTHSTAR_PLANETS).forEach(function (planetKey) {
    var planet = NORTHSTAR_PLANETS[planetKey]
    var withoutDeep = planet.oresWithoutDeep || []
    planet.ores.forEach(function (ore) {
        var baseId = 'northstar:' + planetKey + '_' + ore + '_ore'
        hideOre('nightshift:ore/northstar_' + planetKey + '_' + ore, 'nightshift_p6', baseId, 'northstar:' + planet.stone)
        if (withoutDeep.indexOf(ore) === -1) {
            var deepId = 'northstar:' + planetKey + '_deep_' + ore + '_ore'
            hideOre('nightshift:ore/northstar_' + planetKey + '_deep_' + ore, 'nightshift_p6', deepId, 'northstar:' + planet.deepStone)
        }
    })
})

// createpropulsion:platinum уже обработан выше (P4). Если решите вместо этого
// отнести платину к P6 — просто поменяйте стадию у 2 вызовов hideOre выше.
