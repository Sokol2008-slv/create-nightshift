// ==========================================================================
// «Вахта» — врата перехода и антигравитационный модуль аддона Axiomativ Industries 0.7.0.
// Георгий, 05.10: «врата — это тема», «чтобы мы зашли и были в шоке, как всё круто».
//  - axiomativ:gate_frame       — рама врат: сборка по шагам (латунный корпус → магнетитовая пыль → электрическая медь
//                                 → латунный лист → пресс). На арку — 15 штук.
//  - axiomativ:gate_controller  — пульт врат: механические крафтеры, метеоритное железо, линзы Кварцевого карьера,
//                                 звёздная карта Обсерватории, энергоячейка.
//  - axiomativ:antigrav_module  — модуль на ботинки: механические крафтеры, баллоны гелия Высотного конденсатора,
//                                 метеоритное железо, конденсаторы, пружинные ботинки. Ставится как модули брони
//                                 (рецепт axiomativ:armor_module: модуль + ботинки + электрическая медь).
// Во всех рецептах электрическая медь или энергоячейка — только после 15-й волны. Продукция форпостов и метеоритное
// железо (только с неба) — врата «стоят» на всей сети смены. Ручных рецептов нет. EMC 0 — config/ProjectE/custom_emc.json.
// Цифры (цена прыжка, перезарядка, заряд антиграва) — в аддоне: content/gate/GateMath.java, content/armor/AntigravModule.
// Синхронизация: раз в 2 с — пройденная волна (межпространственные прыжки с 30-й) и набег (врата у алтаря держат
// оборону: уйти нельзя, прийти можно и за полцены) — GateApi.sync. Правило Rhino: только var.
// ==========================================================================
var NS_GATE_API = null
try {
	NS_GATE_API = Java.loadClass('com.axiomativ.industries.content.gate.GateApi')
} catch (e) {
	console.warn('[nightshift] врата: аддон Axiomativ Industries 0.7.0 не найден — врата без набегов: ' + e)
}

ServerEvents.recipes(function (event) {
	// рама врат: латунный корпус, магнетит Магнитной аномалии, электрическая медь, латунный лист, пресс (1 круг)
	var fr = 'axiomativ:incomplete_gate_frame'
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'create:brass_casing' },
		loops: 1,
		results: [{ id: 'axiomativ:gate_frame' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: fr }, { item: 'nightshift:magnetite_dust' }], results: [{ id: fr }] },
			{ type: 'create:deploying', ingredients: [{ item: fr }, { item: 'nightshift:electric_copper' }], results: [{ id: fr }] },
			{ type: 'create:deploying', ingredients: [{ item: fr }, { item: 'create:brass_sheet' }], results: [{ id: fr }] },
			{ type: 'create:pressing', ingredients: [{ item: fr }], results: [{ id: fr }] }
		],
		transitional_item: { id: fr }
	}).id('nightshift:vahta/axiomativ/gate_frame')

	// пульт врат: 4 метеоритного железа по углам, звёздная карта (адрес), 2 линзы, энергоячейка, механизм точности
	event.recipes.create.mechanical_crafting('axiomativ:gate_controller', [
		'MSM',
		'LEL',
		'MPM'
	], {
		M: 'nightshift:meteor_iron_ingot',
		S: 'nightshift:star_chart',
		L: 'nightshift:lens',
		E: 'axiomativ:energy_cell',
		P: 'create:precision_mechanism'
	}).id('nightshift:vahta/axiomativ/gate_controller')

	// антиграв: 2 баллона гелия, метеоритное железо, 2 конденсатора, механизм точности, пружинные ботинки (модуль)
	event.recipes.create.mechanical_crafting('axiomativ:antigrav_module', [
		'HMH',
		'CPC',
		' B '
	], {
		H: 'nightshift:helium_canister',
		M: 'nightshift:meteor_iron_ingot',
		C: 'createaddition:capacitor',
		P: 'create:precision_mechanism',
		B: 'nightshift:module_spring_boots'
	}).id('nightshift:vahta/axiomativ/antigrav_module')

	// установка на ботинки — как энергощит: модуль + ботинки + электрическая медь (механические крафтеры)
	event.custom({
		type: 'axiomativ:armor_module',
		module: { item: 'axiomativ:antigrav_module' },
		addition: { item: 'nightshift:electric_copper' },
		slot: 'feet'
	}).id('nightshift:vahta/armor_module/install_antigrav')
})

// Волна и набег → аддону (раз в 2 с). Набег — raid.state 'countdown' (отсчёт) или 'active' (волны идут): выбранная
// волна, ночной вызов, осада форпоста, выживание на арене — у всех одно состояние набега (40_, 48_). «Алтарь» — алтарь
// базы, алтарь арены или форпост в осаде (nsFindAltar), коробка — радиус слежения набега (как у поиска мобов набега).
// Без синхронизации набег в аддоне гаснет сам через 10 с.
ServerEvents.tick(function (event) {
	if (!NS_GATE_API || event.server.getTickCount() % 40 !== 29) return
	try {
		if (typeof nsGetStateRO !== 'function') return
		var st = nsGetStateRO()
		var raid = ''
		var rs = st.raid ? String(st.raid.state) : 'idle'
		if ((rs === 'countdown' || rs === 'active') && typeof nsFindAltar === 'function') {
			var a = nsFindAltar(st, st.raid.altarId)
			if (a) {
				var r = st.raid.trackR || (NSG.NIGHTSHIFT_TUNABLES && NSG.NIGHTSHIFT_TUNABLES.raidTrackRadius) || 96
				raid = JSON.stringify({ dim: String(a.dim), x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z), r: Math.ceil(r) })
			}
		}
		NS_GATE_API.sync(st.phase || 0, raid)
	} catch (e) {
		console.error('[nightshift] врата: синхронизация — ' + e)
	}
})
