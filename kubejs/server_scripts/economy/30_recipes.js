// ==========================================================================
// Ночная смена — рецепты экономики и гейтинг ProjectE по фазам.
// «Вахта»: философского камня нет (рецепты, где он ключ, — vahta/30_projecte.js), стол
// трансмутации — сразу после андезитового сплава, в миксере. Коллекторы/реле —
// сталь и электромотор TFMG (P4–P5), арканный планшет — титан и марсианская сталь (P6).
// Конденсаторов нет (Георгий, 04.10): mk1/mk2 ProjectE и mk3 Project Expansion убраны вместе с
// интерфейсом трансмутации (его рецепт — из конденсаторов mk2). Поставленные стоят, но не работают
// (аддон axiomativ 0.5.0), EMC 0. Покупка за EMC — с лимитом аддона (64 шт. предмета за 5 мин на сервер).
// Звено EMC вместо конденсатора mk1 собирается из реле mk1 (выдача звена идёт через тот же лимит).
// ==========================================================================

ServerEvents.recipes(event => {
	var removed = [
		'projecte:philosophers_stone',
		'projecte:philosophers_stone_alt',
		'projecte:transmutation_table',
		'projecte:collector_mk1',
		'projecte:relay_mk1',
		'projecte:condenser_mk1',
		'projectexpansion:arcane_transmutation_tablet',
		// 04.10: конденсаторы и всё, что из них, — убраны
		'projecte:condenser_mk2',
		'projectexpansion:condenser_mk3',
		'projectexpansion:transmutation_interface',
		'projectexpansion:emc_link/basic', // замена ниже: реле mk1 вместо конденсатора mk1
	]
	for (var i = 0; i < removed.length; i++) event.remove({ id: removed[i] })

	// стол трансмутации: первые машины (сплав + корпус) + немного редстоуна, без нагрева
	event.recipes.create.mixing('projecte:transmutation_table', [
		'4x create:andesite_alloy',
		'create:andesite_casing',
		'2x minecraft:redstone',
		'2x minecraft:stone',
	]).id('nightshift:projecte/transmutation_table')
	event.shaped('projecte:collector_mk1', ['GEG', 'GSG', 'GMG'], {
		G: 'minecraft:glowstone',
		E: 'createaddition:electric_motor',
		S: '#c:storage_blocks/diamond',
		M: '#c:ingots/steel',
	}).id('nightshift:projecte/collector_mk1')
	event.shaped('projecte:relay_mk1', ['OEO', 'OSO', 'OMO'], {
		O: '#c:obsidians/normal',
		E: 'createaddition:electric_motor',
		S: '#c:storage_blocks/diamond',
		M: '#c:ingots/steel',
	}).id('nightshift:projecte/relay_mk1')
	// базовое звено EMC: как у Project Expansion (пыль ковалентности ×6, 2 планшета), но реле mk1 вместо
	// конденсатора mk1. Миксер, как остальные фигурные рецепты на вахте (vahta/10_machine_recipes.js)
	event.recipes.create.mixing('projectexpansion:basic_emc_link', [
		'projecte:relay_mk1',
		'2x projecte:low_covalence_dust',
		'2x projecte:medium_covalence_dust',
		'2x projecte:high_covalence_dust',
		'2x projecte:transmutation_tablet',
	]).id('nightshift:projecte/basic_emc_link')
	event.shaped('projectexpansion:arcane_transmutation_tablet', ['TWT', 'MSM', 'TCT'], {
		T: 'projecte:transmutation_tablet',
		M: 'projectexpansion:magenta_matter',
		W: 'northstar:titanium_ingot',
		S: 'projectexpansion:magnum_star_ein',
		C: 'northstar:martian_steel_ingot',
	}).id('nightshift:projecte/arcane_transmutation_tablet')

	// сканер жил: латунь + электронная лампа + детектор жил Ore Excavation
	event.shaped('nightshift:vein_scanner', [' T ', 'BVB', ' B '], {
		T: 'create:electron_tube',
		V: 'createoreexcavation:vein_finder',
		B: 'create:brass_ingot',
	}).id('nightshift:vein_scanner')
	// очиститель жилы: взрывчатка для перезапуска чанка под зонд
	event.shapeless('nightshift:vein_cleaner', ['minecraft:tnt', 'minecraft:gunpowder', 'minecraft:gunpowder', 'create:andesite_alloy']).id('nightshift:vein_cleaner')
})
