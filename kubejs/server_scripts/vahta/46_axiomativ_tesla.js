// ==========================================================================
// «Вахта» — тесла-башня аддона Axiomativ Industries 0.4.0 (axiomativ:tesla_tower + axiomativ:tesla_tower_coil).
// Оборона на токе из ветки «Энергия» (Георгий, 04.10: «катушка теслы прикольно звучит»); огнестрел остаётся.
//  - Основание — механические крафтеры: латунный корпус, конденсаторы и медная катушка C&A, громоотвод,
//    электрическая медь. Электрическая медь = заряд молнии (награда 15-й волны) → башня только после 15-й.
//  - Катушка-сегмент — сборка по шагам на конвейере (деплоеры + пресс) из медного корпуса: медные катушки C&A
//    и электрическая медь, 2 круга. Полуфабрикат — axiomativ:incomplete_tesla_tower_coil (аддон).
//  - Ручных рецептов у аддона нет: это единственный путь. EMC 0 обоим — config/ProjectE/custom_emc.json.
// Цифры башни (дальность 8 + 4/катушку, урон 6 + 2, перескоки 1 + 1, 2 000 FE за выстрел + 500 за перескок) —
// в аддоне, TeslaMath.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	event.recipes.create.mechanical_crafting('axiomativ:tesla_tower', [
		' R ',
		'CSC',
		'EBE'
	], {
		R: 'minecraft:lightning_rod',
		C: 'createaddition:capacitor',
		S: 'createaddition:copper_spool',
		E: 'nightshift:electric_copper',
		B: 'create:brass_casing'
	}).id('nightshift:vahta/axiomativ/tesla_tower')

	var part = 'axiomativ:incomplete_tesla_tower_coil'
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'create:copper_casing' },
		loops: 2,
		results: [{ id: 'axiomativ:tesla_tower_coil' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: part }, { item: 'createaddition:copper_spool' }], results: [{ id: part }] },
			{ type: 'create:deploying', ingredients: [{ item: part }, { item: 'nightshift:electric_copper' }], results: [{ id: part }] },
			{ type: 'create:pressing', ingredients: [{ item: part }], results: [{ id: part }] }
		],
		transitional_item: { id: part }
	}).id('nightshift:vahta/axiomativ/tesla_tower_coil')
})
