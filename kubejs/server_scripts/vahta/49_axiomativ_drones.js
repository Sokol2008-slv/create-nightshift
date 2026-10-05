// ==========================================================================
// «Вахта» — дроны-помощники аддона Axiomativ Industries 0.7.0 (поток R, 05.10.2026; Георгий: «делай что душе угодно,
// чтобы мы зашли и были в шоке»).
//  - axiomativ:helper_drone          — дрон-помощник: сборка по шагам из латунного корпуса (4 пропеллера);
//  - axiomativ:drone_remote          — пульт: механические крафтеры;
//  - axiomativ:drone_nest            — гнездо дронов (дом и зарядка): механические крафтеры;
//  - axiomativ:drone_upgrade_*       — улучшения скорости, трюма и батареи: сборка по шагам из латунного листа.
// Во всём — электрическая медь: только после 15-й волны (заряд молнии). Ручных рецептов у аддона нет.
// EMC 0 всем — config/ProjectE/custom_emc.json (tools/emc_lock_create.py). Цифры — в аддоне: content/drone/DroneMath.java.
// Правило Rhino: только var.
// ==========================================================================

// сборка по шагам: steps — ['предмет'] (деплоер) или ['press'] (пресс), один круг
function nsDroneSeq(event, id, input, output, part, steps) {
	var seq = []
	for (var i = 0; i < steps.length; i++) {
		if (steps[i] === 'press') seq.push({ type: 'create:pressing', ingredients: [{ item: part }], results: [{ id: part }] })
		else seq.push({ type: 'create:deploying', ingredients: [{ item: part }, { item: steps[i] }], results: [{ id: part }] })
	}
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: input },
		loops: 1,
		results: [{ id: output }],
		sequence: seq,
		transitional_item: { id: part }
	}).id(id)
}

ServerEvents.recipes(function (event) {
	var EC = 'nightshift:electric_copper'
	var PM = 'create:precision_mechanism'
	var CAP = 'createaddition:capacitor'
	var PROP = 'create:propeller'

	// дрон: латунный корпус → механизм точности → конденсатор → электромедь → 4 пропеллера → электронная лампа → пресс
	nsDroneSeq(event, 'nightshift:vahta/axiomativ/helper_drone', 'create:brass_casing', 'axiomativ:helper_drone',
		'axiomativ:incomplete_helper_drone', [PM, CAP, EC, PROP, PROP, PROP, PROP, 'create:electron_tube', 'press'])

	// пульт: лампа-антенна, латунные листы вокруг механизма точности, электромедь
	event.recipes.create.mechanical_crafting('axiomativ:drone_remote', [
		' T ',
		'BPB',
		' E '
	], {
		T: 'create:electron_tube',
		B: 'create:brass_sheet',
		P: PM,
		E: EC
	}).id('nightshift:vahta/axiomativ/drone_remote')

	// гнездо: депо-площадка, латунный корпус, конденсаторы, медная катушка C&A, электромедь
	event.recipes.create.mechanical_crafting('axiomativ:drone_nest', [
		'SDS',
		'CBC',
		'EKE'
	], {
		S: 'create:brass_sheet',
		D: 'create:depot',
		C: CAP,
		B: 'create:brass_casing',
		E: EC,
		K: 'createaddition:copper_spool'
	}).id('nightshift:vahta/axiomativ/drone_nest')

	// улучшения: латунный лист → … → пресс
	var UP = 'axiomativ:incomplete_drone_upgrade'
	nsDroneSeq(event, 'nightshift:vahta/axiomativ/drone_upgrade_speed', 'create:brass_sheet', 'axiomativ:drone_upgrade_speed', UP,
		[PROP, PM, EC, 'press'])
	nsDroneSeq(event, 'nightshift:vahta/axiomativ/drone_upgrade_cargo', 'create:brass_sheet', 'axiomativ:drone_upgrade_cargo', UP,
		['minecraft:chest', 'minecraft:chest', 'create:brass_sheet', 'press'])
	nsDroneSeq(event, 'nightshift:vahta/axiomativ/drone_upgrade_battery', 'create:brass_sheet', 'axiomativ:drone_upgrade_battery', UP,
		[CAP, CAP, EC, 'press'])
})
