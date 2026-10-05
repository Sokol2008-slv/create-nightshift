// ==========================================================================
// «Вахта» — ранец снабжения аддона Axiomativ Industries 0.7.0.
// Георгий, 05.10: «когда будем много деталей Create производить — рюкзак, привязанный к складам, как карты памяти
// в модах на хранение в энергии, но наш и интереснее».
//  - axiomativ:supply_node          — узел снабжения: ставится вплотную к складу базы (видит сросшиеся хранилища)
//                                     и/или подключает логистическую сеть Create (ПКМ настроенной складской связью);
//  - axiomativ:supply_pack          — ранец Mk1: окно склада издалека (128 бл. от узла), передача 200 + 2 FE/бл;
//  - axiomativ:supply_relay         — ретранслятор снабжения: +160 бл. связи вокруг себя (форпосты), на токе;
//  - axiomativ:supply_pack_mk2      — Mk2: 1,6 млн FE, 120 + 1 FE/бл, 192 бл., другое измерение через межпростр. ретранслятор;
//  - axiomativ:dimensional_relay    — межпространственный ретранслятор: 256 бл. и связь Mk2 с другим измерением;
//  - axiomativ:quantum_supply_pack  — Mk3 «квантовый»: 6 млн FE, 60 + 0,25 FE/бл, откуда угодно, в любом измерении.
// Mk1 — после 15-й волны (электромедь), Mk2 — метеоритное железо и продукция форпостов (линза, радиатор),
// Mk3 и межпространственный — небесный кристалл, звёздная карта, межпланетный сплав.
// Всё — машинами Create, ручных рецептов нет. EMC 0 — config/ProjectE/custom_emc.json (tools/emc_lock_create.py).
// Цифры — в аддоне: content/supply/SupplyTier.java и SupplyMath.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	var pack = 'axiomativ:incomplete_supply_pack'

	// узел снабжения: складская связь Create на латунном корпусе, лампы, механизм точности, электромедь
	event.recipes.create.mechanical_crafting('axiomativ:supply_node', [
		' L ',
		'TBT',
		'EPE'
	], {
		L: 'create:stock_link',
		T: 'create:electron_tube',
		B: 'create:brass_casing',
		P: 'create:precision_mechanism',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/supply_node')

	// ранец Mk1: рюкзак → передатчик → конденсатор → электромедь → пресс
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'sophisticatedbackpacks:backpack' },
		loops: 1,
		results: [{ id: 'axiomativ:supply_pack' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'create:transmitter' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'createaddition:capacitor' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:electric_copper' }], results: [{ id: pack }] },
			{ type: 'create:pressing', ingredients: [{ item: pack }], results: [{ id: pack }] }
		],
		transitional_item: { id: pack }
	}).id('nightshift:vahta/axiomativ/supply_pack')

	// ретранслятор снабжения: громоотвод-антенна, передатчики, медный корпус, медные катушки, электромедь
	event.recipes.create.mechanical_crafting('axiomativ:supply_relay', [
		' R ',
		'TCT',
		'SES'
	], {
		R: 'minecraft:lightning_rod',
		T: 'create:transmitter',
		C: 'create:copper_casing',
		S: 'createaddition:copper_spool',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/supply_relay')

	// ранец Mk2: на Mk1 — метеоритное железо, линза (кварцевый карьер), ещё железо, радиатор (ледник), энергоячейка
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'axiomativ:supply_pack' },
		loops: 1,
		results: [{ id: 'axiomativ:supply_pack_mk2' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:meteor_iron_ingot' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:lens' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:meteor_iron_ingot' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:radiator' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'axiomativ:energy_cell' }], results: [{ id: pack }] },
			{ type: 'create:pressing', ingredients: [{ item: pack }], results: [{ id: pack }] }
		],
		transitional_item: { id: pack }
	}).id('nightshift:vahta/axiomativ/supply_pack_mk2')

	// межпространственный ретранслятор: небесный кристалл над ретранслятором, метеоритное железо, линзы, энергоячейка
	event.recipes.create.mechanical_crafting('axiomativ:dimensional_relay', [
		' K ',
		'MRM',
		'LEL'
	], {
		K: 'nightshift:sky_crystal',
		M: 'nightshift:meteor_iron_ingot',
		R: 'axiomativ:supply_relay',
		L: 'nightshift:lens',
		E: 'axiomativ:energy_cell'
	}).id('nightshift:vahta/axiomativ/dimensional_relay')

	// квантовый ранец (Mk3): на Mk2 — небесный кристалл, межпланетный сплав, звёздная карта, кристалл, энергоячейка
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'axiomativ:supply_pack_mk2' },
		loops: 1,
		results: [{ id: 'axiomativ:quantum_supply_pack' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:sky_crystal' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'axiomativ:interplanetary_alloy' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:star_chart' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'nightshift:sky_crystal' }], results: [{ id: pack }] },
			{ type: 'create:deploying', ingredients: [{ item: pack }, { item: 'axiomativ:energy_cell' }], results: [{ id: pack }] },
			{ type: 'create:pressing', ingredients: [{ item: pack }], results: [{ id: pack }] }
		],
		transitional_item: { id: pack }
	}).id('nightshift:vahta/axiomativ/quantum_supply_pack')
})
