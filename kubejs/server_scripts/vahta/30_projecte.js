// ==========================================================================
// «Вахта» — ProjectE без философского камня (docs/VAHTA.md, решение 7).
// Камень убран: его рецепты (projecte:philosophers_stone, _alt) и nightshift-версия удаляются в
// economy/30_recipes.js, там же — новый стол трансмутации (миксер, сразу после андезитового сплава).
// Здесь — все рецепты, где камень был ключом (по дампу: 29 шт. кроме самого камня), и замены
// для тех, без которых встаёт прогресс ProjectE (топливо → тёмная материя, факел, книга).
// ==========================================================================

var NS_VAHTA_PHIL_IDS = [
	// превращения «камень + предметы» (железо ↔ золото, алмаз ↔ изумруд и т.п.) — без замены:
	// это и есть ручная алхимия, на вахте её делает стол трансмутации за EMC
	'projecte:conversions/aeternalis_fuel_to_mobius_fuel',
	'projecte:conversions/alchemical_coal_to_coal',
	'projecte:conversions/charcoal_to_coal',
	'projecte:conversions/coal_to_charcoal',
	'projecte:conversions/diamond_to_emerald',
	'projecte:conversions/diamond_to_gold_ingot',
	'projecte:conversions/emerald_to_diamond',
	'projecte:conversions/gold_ingot_to_diamond',
	'projecte:conversions/gold_ingot_to_iron_ingot',
	'projecte:conversions/iron_ingot_to_ender_pearl',
	'projecte:conversions/iron_ingot_to_gold_ingot',
	'projecte:conversions/mobius_fuel_to_alchemical_coal',
	// топливо ProjectE и ProjectExpansion (камень + 4 предыдущего) — замена ниже, в миксере
	'projecte:alchemical_coal',
	'projecte:mobius_fuel',
	'projecte:aeternalis_fuel',
	'projectexpansion:fuel/item/magenta',
	'projectexpansion:fuel/item/pink',
	'projectexpansion:fuel/item/purple',
	'projectexpansion:fuel/item/violet',
	'projectexpansion:fuel/item/blue',
	'projectexpansion:fuel/item/cyan',
	'projectexpansion:fuel/item/green',
	'projectexpansion:fuel/item/lime',
	'projectexpansion:fuel/item/yellow',
	'projectexpansion:fuel/item/orange',
	'projectexpansion:fuel/item/white',
	// камень в центре сетки — замена ниже
	'projecte:interdiction_torch',
	'projectexpansion:basic_alchemical_book',
	// оригинальный стол (камень + обсидиан + камень); новый — nightshift:projecte/transmutation_table
	'projecte:transmutation_table',
]

// цепочка топлива: 4 предыдущего + светопыль → 1 следующего, перегрев (у камня было 4 → 1), [выход, вход]
var NS_VAHTA_FUEL_CHAIN = [
	['projecte:mobius_fuel', 'projecte:alchemical_coal'],
	['projecte:aeternalis_fuel', 'projecte:mobius_fuel'],
	['projectexpansion:magenta_fuel', 'projecte:aeternalis_fuel'],
	['projectexpansion:pink_fuel', 'projectexpansion:magenta_fuel'],
	['projectexpansion:purple_fuel', 'projectexpansion:pink_fuel'],
	['projectexpansion:violet_fuel', 'projectexpansion:purple_fuel'],
	['projectexpansion:blue_fuel', 'projectexpansion:violet_fuel'],
	['projectexpansion:cyan_fuel', 'projectexpansion:blue_fuel'],
	['projectexpansion:green_fuel', 'projectexpansion:cyan_fuel'],
	['projectexpansion:lime_fuel', 'projectexpansion:green_fuel'],
	['projectexpansion:yellow_fuel', 'projectexpansion:lime_fuel'],
	['projectexpansion:orange_fuel', 'projectexpansion:yellow_fuel'],
	['projectexpansion:white_fuel', 'projectexpansion:orange_fuel'],
]

ServerEvents.recipes(event => {
	for (var i = 0; i < NS_VAHTA_PHIL_IDS.length; i++) event.remove({ id: NS_VAHTA_PHIL_IDS[i] })

	// алхимический уголь: 4 угля + редстоун, нагрев (вместо камня — редстоун как «катализатор»)
	event.recipes.create.mixing('projecte:alchemical_coal', ['4x minecraft:coal', 'minecraft:redstone'])
		.heated()
		.id('nightshift:vahta/projecte/alchemical_coal')
	for (var f = 0; f < NS_VAHTA_FUEL_CHAIN.length; f++) {
		var r = NS_VAHTA_FUEL_CHAIN[f]
		var id = 'nightshift:vahta/projecte/' + r[0].split(':')[1]
		event.recipes.create.mixing(r[0], ['4x ' + r[1], 'minecraft:glowstone_dust']).superheated().id(id)
	}

	// факел запрета: камень → механизм точности (центр сетки)
	event.shaped('projecte:interdiction_torch', ['RDR', 'DPD', 'GGG'], {
		R: 'minecraft:redstone_torch',
		D: '#c:gems/diamond',
		P: 'create:precision_mechanism',
		G: '#c:dusts/glowstone',
	}).id('nightshift:vahta/projecte/interdiction_torch')
	// базовая алхимическая книга: камень → тёмная материя
	event.shaped('projectexpansion:basic_alchemical_book', ['HRH', 'EBP', 'HRH'], {
		H: 'projecte:high_covalence_dust',
		R: 'projecte:red_matter',
		E: 'minecraft:ender_pearl',
		B: 'minecraft:book',
		P: 'projecte:dark_matter',
	}).id('nightshift:vahta/projecte/basic_alchemical_book')
})
