// ==========================================================================
// «Вахта» — датчик набега и сирена аддона Axiomativ Industries 0.7.0 (финальный аудит 06.10, идея №1: «блок даёт
// редстоун на отсчёте / в бою / при победе и воет сиреной — двери, пушки, прожекторы и щит базы включаются сами»).
//  - axiomativ:raid_sensor — датчик набега: латунный корпус, электронная лампа («ухо»), компаратор (сила сигнала),
//    редстоун. Режим и вид сигнала — ПКМ / Shift+ПКМ, состояние набега присылает raids/42_raid_signal.js;
//  - axiomativ:raid_siren  — сирена: медный раструб из листов, пропеллер — ротор, нотный блок — голос, андезитовая
//    плита. Воет от любого редстоуна, слышно на 128 блоков.
// Оборону автоматизируют с фазы 2 («Пар и латунь»): датчику нужна латунь, сирена — медь и андезит. Оба — механическими
// крафтерами (до 9 клеток — хватает крафтеров из ящика). Ручных рецептов у аддона нет. EMC 0 — config/ProjectE/custom_emc.json
// (tools/emc_lock_create.py). Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	// датчик: электронная лампа сверху, редстоун по бокам латунного корпуса, компаратор снизу
	event.recipes.create.mechanical_crafting('axiomativ:raid_sensor', [
		' T ',
		'RCR',
		' K '
	], {
		T: 'create:electron_tube',
		R: 'minecraft:redstone',
		C: 'create:brass_casing',
		K: 'minecraft:comparator'
	}).id('nightshift:vahta/axiomativ/raid_sensor')

	// сирена: раструб из медных листов, пропеллер-ротор, нотный блок и андезитовая плита
	event.recipes.create.mechanical_crafting('axiomativ:raid_siren', [
		'C C',
		'CPC',
		'ANA'
	], {
		C: 'create:copper_sheet',
		P: 'create:propeller',
		A: 'create:andesite_alloy',
		N: 'minecraft:note_block'
	}).id('nightshift:vahta/axiomativ/raid_siren')
})
