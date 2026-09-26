// ============================================================================
// Create: Ночная смена — фикс рецептов-утечек (обычный ServerEvents.recipes,
// БЕЗ AStages — эти рецепты принадлежат модовым RecipeType (create:crushing,
// create:splashing, createsifter:sifting), которые AStages.addRestrictionForRecipe
// НЕ поддерживает: wiki/AStages-Recipe-Restriction.md прямо предупреждает
// "methods below only work for vanilla recipe types (crafting, smelting,
// blasting, smoking, smithing, stonecutter, campfire cooking)".
// Путь назначения в паке: kubejs/server_scripts/nightshift/03_leak_recipe_fixes.js
// ============================================================================
//
// РЕШЕНИЕ ПО ДИЗАЙНУ: рецепты ниже — это не "контент следующей фазы", а чистые
// ДЫРЫ БАЛАНСА (дробилка тряпит золото/цинк/кварц из туфа/диорита/гравия/песка
// в обход всей системы фаз). Поэтому они удаляются БЕЗУСЛОВНО, всегда, вне
// зависимости от текущей фазы — в отличие от бурения жил Ore Excavation
// (04_drilling_gate.js), где ресурс легитимен и просто должен открываться по
// фазам. Обоснование см. docs/phases/leak_audit.json -> design_recommendations #1.
//
// Все удаления сделаны через event.remove({id: ...}) — это гарантированно
// работающий базовый API KubeJS, не зависящий от версии аддона kubejs-create.
// Возврат "облегчённой легальной версии" рецепта (например, тряпить туф только
// на flint, без нагетсов) НЕ включён в этот черновик — как более рискованный
// шаг, зависящий от точного синтаксиса DSL kubejs-create для create:crushing/
// create:splashing в версии kubejs-create-neoforge-2101.3.1 (НЕ ПРОВЕРЕНО).
// Пример того, как это могло бы выглядеть (закомментировано, для теста):
//
// event.recipes.create.crushing([Item.of('minecraft:flint').withChance(0.25)], 'minecraft:tuff')
//     .id('nightshift:crushing/tuff_safe')
//
// ПРОВЕРЕНО: все id рецептов ниже подтверждены распаковкой .json из
// соответствующих jar (create-1.21.1-6.0.10, createsifter-1.21.1-2.3.0,
// create_ultimate_factory-2.2.4, tfmg-1.21.1-1.3.1, create-gunsmithing-1.21.1-1.4.9,
// createbigcannons-5.11.7+mc.1.21.1). Формат id = <namespace файла>:<путь без
// "recipe/" и без .json> — например data/create/recipe/crushing/tuff.json
// -> "create:crushing/tuff".
//
// СОБСТВЕННАЯ НАХОДКА (не было в leak_audit.json от плана): при прямой сверке
// файлов обнаружено, что БАЗОВЫЙ андезитовый тир сита (createsifter:andesite_mesh,
// доступен уже в P1!) на sand/dust ТОЖЕ даёт редстоун и glowstone_dust (P3-
// ресурсы) — createsifter:sifting/sand_andesite и sifting/dust_andesite. Это
// даже хуже, чем уже отмеченная утечка gravel_andesite (которая давала только
// P1/P2-нагетсы) — рекомендуем перепроверить остальные ~219 jar таким же прямым
// способом (не только по индексу рецептов, но и почтенно по соседним файлам той
// же папки), т.к. аудит явно не поймал эту пару.

var NIGHTSHIFT_LEAK_RECIPE_IDS = [
    // --- native Create: дробление/тряска ванильного P0-камня даёт P1/P2/P3 ресурсы ---
    'create:crushing/tuff',              // -> flint, gold/copper/zinc/iron nugget
    'create:crushing/diorite',           // -> quartz (P3!) из P0-блока
    'create:splashing/red_sand',         // -> gold_nugget
    'create:splashing/soul_sand',        // -> quartz, gold_nugget
    'create:splashing/gravel',           // -> iron_nugget

    // --- createsifter: сита всех тиров, gravel/sand/dust/crushed_netherrack ---
    'createsifter:sifting/gravel_andesite',              // P1-тир -> P1/P2 нагетсы
    'createsifter:sifting/sand_andesite',                // НАХОДКА: P1-тир -> redstone (P3), gold_nugget (P2)
    'createsifter:sifting/dust_andesite',                // НАХОДКА: P1-тир -> redstone, glowstone_dust (оба P3)
    'createsifter:sifting/gravel_brass',                 // -> lapis_lazuli (P3)
    'createsifter:sifting/gravel_advanced_brass',        // -> diamond, emerald, lapis (все P3)
    'createsifter:sifting/sand_brass',                   // -> redstone (P3)
    'createsifter:sifting/dust_brass',                   // -> redstone, glowstone_dust (P3)
    'createsifter:sifting/crushed_netherrack_brass',         // -> gold_nugget, quartz, netherite_scrap (P2/P3)
    'createsifter:sifting/crushed_netherrack_advanced_brass', // -> то же, выше шансы
    'createsifter:sifting/soul_sand_brass',              // -> quartz (P3)
    'createsifter:sifting/soul_sand_advanced_brass',     // -> quartz x2 (P3)

    // --- дубли той же дыры из другого мода ---
    'create_ultimate_factory:crushing_soulsand',         // soul_sand -> glowstone_dust (P3)

    // --- tfmg: земля (P0!) даёт селитру без всякой химии ---
    'create:crushing/dirt',              // физически лежит внутри tfmg jar, регистрируется под namespace create

    // --- сталь: дешёвые P1-рецепты у Big Cannons и Gunsmithing (см. 09_steel_unification.js) ---
    'createbigcannons:mixing/alloy_steel', // 2x iron_ingot + coal -> 2x createbigcannons:steel_ingot
    'cgs:mixing/steel_ingot'               // c:ingots/iron + charcoal_dust (superheated) -> cgs:steel_ingot
]

ServerEvents.recipes(function (event) {
    NIGHTSHIFT_LEAK_RECIPE_IDS.forEach(function (id) {
        event.remove({ id: id })
    })
})
