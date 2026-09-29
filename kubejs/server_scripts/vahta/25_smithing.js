// ==========================================================================
// «Вахта» — кузнечный стол закрыт (Георгий, 28.09), его улучшения делают механические крафтеры:
// в ряд «шаблон | вещь | добавка» (без шаблона — «вещь | добавка»). Как и стол, результат получает
// компоненты исходной вещи: зачарования, прочность, имя (modifyResult копирует их с «вещи»).
// Список — все живые рецепты smithing_transform сборки (70 шт., из tools/data/recipes-dump.json.gz
// по слепку витрины 28.09). Украшения брони (smithing_trim) на вахте не делаются.
// Сами рецепты стола удаляются — иначе JEI показывает кузню как рабочую станцию.
// [id рецепта стола, шаблон | null, вещь, добавка, результат]
// ==========================================================================
var NS_VAHTA_SMITHING = [
	// Modular Golems (29.09, в буфере «големы»)
	['modulargolems:netherite_golem_sword', 'minecraft:netherite_upgrade_smithing_template', 'modulargolems:diamond_golem_sword', 'minecraft:netherite_ingot', 'modulargolems:netherite_golem_sword'],
	['modulargolems:netherite_golem_axe', 'minecraft:netherite_upgrade_smithing_template', 'modulargolems:diamond_golem_axe', 'minecraft:netherite_ingot', 'modulargolems:netherite_golem_axe'],
	['modulargolems:netherite_golem_spear', 'minecraft:netherite_upgrade_smithing_template', 'modulargolems:diamond_golem_spear', 'minecraft:netherite_ingot', 'modulargolems:netherite_golem_spear'],
	['modulargolems:netherite_mecha_bow', 'minecraft:netherite_upgrade_smithing_template', 'modulargolems:iron_mecha_bow', 'minecraft:netherite_ingot', 'modulargolems:netherite_mecha_bow'],
	['minecraft:golem_slicing_axe', 'minecraft:netherite_upgrade_smithing_template', 'modulargolems:diamond_golem_axe', 'minecraft:stonecutter', 'modulargolems:golem_slicing_axe'],
	['arphex:chitin_boots_2', null, 'arphex:chitin_armour_boots', 'arphex:chitin', 'arphex:chitin_armour_tier_2_boots'],
	['arphex:chitin_boots_3', null, 'arphex:chitin_armour_tier_2_boots', 'minecraft:netherite_ingot', 'arphex:chitin_armour_tier_3_boots'],
	['arphex:chitin_chestplate_2', null, 'arphex:chitin_armour_chestplate', 'arphex:chitin', 'arphex:chitin_armour_tier_2_chestplate'],
	['arphex:chitin_chestplate_3', null, 'arphex:chitin_armour_tier_2_chestplate', 'minecraft:netherite_ingot', 'arphex:chitin_armour_tier_3_chestplate'],
	['arphex:chitin_helmet_2', null, 'arphex:chitin_armour_helmet', 'arphex:chitin', 'arphex:chitin_armour_tier_2_helmet'],
	['arphex:chitin_helmet_3', null, 'arphex:chitin_armour_tier_2_helmet', 'minecraft:netherite_ingot', 'arphex:chitin_armour_tier_3_helmet'],
	['arphex:chitin_legs_2', null, 'arphex:chitin_armour_leggings', 'arphex:chitin', 'arphex:chitin_armour_tier_2_leggings'],
	['arphex:chitin_legs_3', null, 'arphex:chitin_armour_tier_2_leggings', 'minecraft:netherite_ingot', 'arphex:chitin_armour_tier_3_leggings'],
	['arphex:chitinboots_2combine', null, 'arphex:chitin_armour_boots', 'arphex:chitin_armour_boots', 'arphex:chitin_armour_tier_2_boots'],
	['arphex:chitinchest_2combine', null, 'arphex:chitin_armour_chestplate', 'arphex:chitin_armour_chestplate', 'arphex:chitin_armour_tier_2_chestplate'],
	['arphex:chitinhelm_2combine', null, 'arphex:chitin_armour_helmet', 'arphex:chitin_armour_helmet', 'arphex:chitin_armour_tier_2_helmet'],
	['arphex:chitinlegs_2combine', null, 'arphex:chitin_armour_leggings', 'arphex:chitin_armour_leggings', 'arphex:chitin_armour_tier_2_leggings'],
	['arphex:infernal_boots_upgrade', null, 'minecraft:netherite_boots', 'arphex:infernal_ingot', 'arphex:infernal_boots'],
	['arphex:infernal_chestplate_upgrade', null, 'minecraft:netherite_chestplate', 'arphex:infernal_ingot', 'arphex:infernal_chestplate'],
	['arphex:infernal_helmet_upgrade', null, 'minecraft:netherite_helmet', 'arphex:infernal_ingot', 'arphex:infernal_helmet'],
	['arphex:infernal_leggings_upgrade', null, 'minecraft:netherite_leggings', 'arphex:infernal_ingot', 'arphex:infernal_leggings'],
	['arphex:jugger_boot', null, 'arphex:chitin_armour_tier_3_boots', 'arphex:heavy_chitin', 'arphex:juggernaut_boots'],
	['arphex:jugger_chest', null, 'arphex:chitin_armour_tier_3_chestplate', 'arphex:heavy_chitin', 'arphex:juggernaut_chestplate'],
	['arphex:jugger_head', null, 'arphex:chitin_armour_tier_3_helmet', 'arphex:heavy_chitin', 'arphex:juggernaut_helmet'],
	['arphex:jugger_leg', null, 'arphex:chitin_armour_tier_3_leggings', 'arphex:heavy_chitin', 'arphex:juggernaut_leggings'],
	['arphex:spacetime_boots', null, 'arphex:vitality_armour_boots', 'arphex:spacetime_ingot', 'arphex:spacetime_boots'],
	['arphex:spacetime_chestplate', null, 'arphex:vitality_armour_chestplate', 'arphex:spacetime_ingot', 'arphex:spacetime_chestplate'],
	['arphex:spacetime_helmet', null, 'arphex:vitality_armour_helmet', 'arphex:spacetime_ingot', 'arphex:spacetime_helmet'],
	['arphex:spacetime_leggings', null, 'arphex:vitality_armour_leggings', 'arphex:spacetime_ingot', 'arphex:spacetime_leggings'],
	['arphex:spectral_boots', null, 'minecraft:netherite_boots', 'arphex:spectral_ingot', 'arphex:spectral_boots'],
	['arphex:spectral_chest', null, 'minecraft:netherite_chestplate', 'arphex:spectral_ingot', 'arphex:spectral_chestplate'],
	['arphex:spectral_helm', null, 'minecraft:netherite_helmet', 'arphex:spectral_ingot', 'arphex:spectral_helmet'],
	['arphex:spectral_legs', null, 'minecraft:netherite_leggings', 'arphex:spectral_ingot', 'arphex:spectral_leggings'],
	['arphex:umbral_boots', null, 'minecraft:netherite_boots', 'arphex:umbral_ingot', 'arphex:umbral_boots'],
	['arphex:umbral_chest', null, 'minecraft:netherite_chestplate', 'arphex:umbral_ingot', 'arphex:umbral_chestplate'],
	['arphex:umbral_helm', null, 'minecraft:netherite_helmet', 'arphex:umbral_ingot', 'arphex:umbral_helmet'],
	['arphex:umbral_legs', null, 'minecraft:netherite_leggings', 'arphex:umbral_ingot', 'arphex:umbral_leggings'],
	['arphex:vital_boots_upgrade', null, 'minecraft:golden_boots', 'arphex:mantle_of_vitality', 'arphex:vitality_armour_boots'],
	['arphex:vital_chest_upgrade', null, 'minecraft:golden_chestplate', 'arphex:mantle_of_vitality', 'arphex:vitality_armour_chestplate'],
	['arphex:vital_helmet_upgrade', null, 'minecraft:golden_helmet', 'arphex:mantle_of_vitality', 'arphex:vitality_armour_helmet'],
	['arphex:vital_leggings_upgrade', null, 'minecraft:golden_leggings', 'arphex:mantle_of_vitality', 'arphex:vitality_armour_leggings'],
	['cgs:axe_netherite', 'minecraft:netherite_upgrade_smithing_template', 'cgs:axe_diamond', 'minecraft:netherite_ingot', 'cgs:axe_netherite'],
	['cgs:hammer_netherite', 'minecraft:netherite_upgrade_smithing_template', 'cgs:hammer_diamond', 'minecraft:netherite_ingot', 'cgs:hammer_netherite'],
	['create:crafting/appliances/netherite_backtank', 'minecraft:netherite_upgrade_smithing_template', 'create:copper_backtank', '#c:ingots/netherite', 'create:netherite_backtank'],
	['create:crafting/appliances/netherite_backtank_from_netherite', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:netherite_chestplate', 'create:copper_backtank', 'create:netherite_backtank'],
	['create:crafting/appliances/netherite_diving_boots', 'minecraft:netherite_upgrade_smithing_template', 'create:copper_diving_boots', '#c:ingots/netherite', 'create:netherite_diving_boots'],
	['create:crafting/appliances/netherite_diving_boots_from_netherite', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:netherite_boots', 'create:copper_diving_boots', 'create:netherite_diving_boots'],
	['create:crafting/appliances/netherite_diving_helmet', 'minecraft:netherite_upgrade_smithing_template', 'create:copper_diving_helmet', '#c:ingots/netherite', 'create:netherite_diving_helmet'],
	['create:crafting/appliances/netherite_diving_helmet_from_netherite', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:netherite_helmet', 'create:copper_diving_helmet', 'create:netherite_diving_helmet'],
	['create_deep_dark:echo_boots_smithing', 'create_deep_dark:echo_upgrade_smithing_template', 'minecraft:netherite_boots', 'create_deep_dark:echo_ingot', 'create_deep_dark:echo_armor_boots'],
	['create_deep_dark:echo_chestplate_smithing', 'create_deep_dark:echo_upgrade_smithing_template', 'minecraft:netherite_chestplate', 'create_deep_dark:echo_ingot', 'create_deep_dark:echo_armor_chestplate'],
	['create_deep_dark:echo_helmet_smithing', 'create_deep_dark:echo_upgrade_smithing_template', 'minecraft:netherite_helmet', 'create_deep_dark:echo_ingot', 'create_deep_dark:echo_armor_helmet'],
	['create_deep_dark:echo_leggings_smithing', 'create_deep_dark:echo_upgrade_smithing_template', 'minecraft:netherite_leggings', 'create_deep_dark:echo_ingot', 'create_deep_dark:echo_armor_leggings'],
	['create_deep_dark:echo_sword_smithing', 'create_deep_dark:echo_upgrade_smithing_template', 'minecraft:netherite_sword', 'create_deep_dark:echo_ingot', 'create_deep_dark:echo_sword'],
	['create_enchantment_industry:smithing/blaze_enchanter', 'create_dragons_plus:blaze_upgrade_smithing_template', 'create:blaze_burner', 'minecraft:enchanting_table', 'create_enchantment_industry:blaze_enchanter'],
	['create_enchantment_industry:smithing/blaze_forger', 'create_dragons_plus:blaze_upgrade_smithing_template', 'create:blaze_burner', 'minecraft:anvil', 'create_enchantment_industry:blaze_forger'],
	['create_jetpack:netherite_jetpack_upgrade', 'minecraft:netherite_upgrade_smithing_template', 'create_jetpack:jetpack', '#c:ingots/netherite', 'create_jetpack:netherite_jetpack'],
	['create_jetpack:netherite_jetpack_upgrade_from_netherite', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:netherite_chestplate', 'create_jetpack:jetpack', 'create_jetpack:netherite_jetpack'],
	['create_sa:netherite_exoskeleton_recipe', 'create:fluid_tank', 'create_sa:brass_exoskeleton_chestplate', 'minecraft:netherite_ingot', 'create_sa:netherite_exoskeleton_chestplate'],
	['create_sa:netherite_jetpack_recipe', 'create:fluid_tank', 'create_sa:brass_jetpack_chestplate', 'minecraft:netherite_ingot', 'create_sa:netherite_jetpack_chestplate'],
	['create_things_and_misc:netheriteportablewithlecraft', null, 'create_things_and_misc:portable_whistle', 'minecraft:netherite_ingot', 'create_things_and_misc:netherite_portable_whistle'],
	['creategoggles:goggle_netherite_helmet_smithing', 'minecraft:netherite_upgrade_smithing_template', 'creategoggles:goggle_diamond_helmet', 'minecraft:netherite_ingot', 'creategoggles:goggle_netherite_helmet'],
	['farmersdelight:netherite_knife_smithing', 'minecraft:netherite_upgrade_smithing_template', 'farmersdelight:diamond_knife', 'minecraft:netherite_ingot', 'farmersdelight:netherite_knife'],
	['garnished:hatchet/netherite_hatchet', 'minecraft:netherite_upgrade_smithing_template', 'garnished:diamond_hatchet', 'minecraft:netherite_ingot', 'garnished:netherite_hatchet'],
	['minecraft:netherite_axe_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_axe', 'minecraft:netherite_ingot', 'minecraft:netherite_axe'],
	['minecraft:netherite_boots_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_boots', 'minecraft:netherite_ingot', 'minecraft:netherite_boots'],
	['minecraft:netherite_chestplate_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_chestplate', 'minecraft:netherite_ingot', 'minecraft:netherite_chestplate'],
	['minecraft:netherite_drill_smithing', 'minecraft:netherite_upgrade_smithing_template', 'createoreexcavation:diamond_drill', 'minecraft:netherite_ingot', 'createoreexcavation:netherite_drill'],
	['minecraft:netherite_helmet_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_helmet', 'minecraft:netherite_ingot', 'minecraft:netherite_helmet'],
	['minecraft:netherite_hoe_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_hoe', 'minecraft:netherite_ingot', 'minecraft:netherite_hoe'],
	['minecraft:netherite_leggings_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_leggings', 'minecraft:netherite_ingot', 'minecraft:netherite_leggings'],
	['minecraft:netherite_pickaxe_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_pickaxe', 'minecraft:netherite_ingot', 'minecraft:netherite_pickaxe'],
	['minecraft:netherite_shovel_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_shovel', 'minecraft:netherite_ingot', 'minecraft:netherite_shovel'],
	['minecraft:netherite_sword_smithing', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:diamond_sword', 'minecraft:netherite_ingot', 'minecraft:netherite_sword'],
	['wands:netherite_wand', 'minecraft:netherite_upgrade_smithing_template', 'wands:diamond_wand', 'minecraft:netherite_ingot', 'wands:netherite_wand'],
]

// Компоненты (зачарования, прочность, имя) переносятся с «вещи»: в KubeJS 2101 .modifyResult(ключ)
// помечает рецепт, а сам перенос делает ServerEvents.modifyRecipeResult(ключ) — проверено на витрине
// 28.09 (CraftingInput 3×1 → assemble: алмазный меч «Меч Жоры», острота III, износ 100 → незеритовый
// с тем же именем, остротой и износом).
var NS_VAHTA_SMITH_KEY = 'nightshift:vahta_smithing'

ServerEvents.recipes(event => {
	for (var i = 0; i < NS_VAHTA_SMITHING.length; i++) {
		var r = NS_VAHTA_SMITHING[i]
		var keys = { B: r[2], A: r[3] }
		var row = 'BA'
		if (r[1]) {
			keys.T = r[1]
			row = 'TBA'
		}
		event.remove({ id: r[0] })
		event.shaped(r[4], [row], keys).modifyResult(NS_VAHTA_SMITH_KEY).id('nightshift:vahta/smithing/' + r[0].replace(':', '/'))
	}
	event.remove({ type: 'minecraft:smithing_trim' })
})

// «вещь» — в середине ряда из трёх (шаблон | вещь | добавка) или первая в ряду из двух.
// Результат события отдаётся только через e.exit(стак): return и присваивание e.item не работают
// (assemble тогда возвращает null), applyComponents KubeJS прячет — берём transmuteCopy, как сам стол.
ServerEvents.modifyRecipeResult(NS_VAHTA_SMITH_KEY, e => {
	var order = e.width >= 3 ? [1, 0, 2] : [0, 1]
	for (var k = 0; k < order.length; k++) {
		if (order[k] >= e.grid.size()) continue
		var st = e.grid.getItem(order[k])
		if (st.isEmpty() || st.getComponentsPatch().isEmpty()) continue
		e.exit(st.transmuteCopy(e.item.getItem(), e.item.getCount()))
	}
	e.exit(e.item)
})
