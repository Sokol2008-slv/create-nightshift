// ==========================================================================
// Ночная смена — рецепты экономики и гейтинг ProjectE по фазам.
// «Вахта»: философского камня нет (рецепты, где он ключ, — vahta/30_projecte.js), стол
// трансмутации — сразу после андезитового сплава, в миксере. Коллекторы/реле/конденсатор —
// сталь и электромотор TFMG (P4–P5), арканный планшет — титан и марсианская сталь (P6).
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
		E: 'tfmg:electric_motor',
		S: '#c:storage_blocks/diamond',
		M: 'tfmg:steel_ingot',
	}).id('nightshift:projecte/collector_mk1')
	event.shaped('projecte:relay_mk1', ['OEO', 'OSO', 'OMO'], {
		O: '#c:obsidians/normal',
		E: 'tfmg:electric_motor',
		S: '#c:storage_blocks/diamond',
		M: 'tfmg:steel_ingot',
	}).id('nightshift:projecte/relay_mk1')
	event.shaped('projecte:condenser_mk1', ['OMO', 'DCD', 'OEO'], {
		O: '#c:obsidians/normal',
		M: 'tfmg:steel_ingot',
		D: '#c:gems/diamond',
		C: 'projecte:alchemical_chest',
		E: 'tfmg:electric_motor',
	}).id('nightshift:projecte/condenser_mk1')
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
