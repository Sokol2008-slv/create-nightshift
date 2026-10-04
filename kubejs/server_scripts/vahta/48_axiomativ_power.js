// ==========================================================================
// «Вахта» — энергоячейки и энергетические форпосты аддона Axiomativ Industries 0.6.0.
// Георгий, 04.10: «поездами связывать электросеть» → выбран вариант «поезда с батареями»: форпост (геотермальный
// источник, речной порог) даёт много тока только на месте, на базу ток везут поездом в ячейках.
//  - axiomativ:energy_cell          — энергоячейка 2 000 000 FE: сборка по шагам из конденсатора C&A;
//  - axiomativ:charging_station     — зарядная станция (медь): ток из сети → ячейки, полные выходят вперёд;
//  - axiomativ:discharging_station  — разрядная станция (латунь): ячейки → сеть, пустые выходят вперёд;
//  - axiomativ:geothermal_generator — 2 000 FE/т на геотермальном источнике (с водой; без воды 500);
//  - axiomativ:hydro_generator      — 500 FE/т на речном пороге, в воде.
// Всё — машинами Create, в каждом рецепте электрическая медь: только после 15-й волны (заряд молнии).
// Ручных рецептов у аддона нет. EMC 0 всем — config/ProjectE/custom_emc.json (tools/emc_lock_create.py).
// Месторождения — датапак kubejs/data/nightshift/…/power_* (новые чанки), в готовом мире — /axpower place.
// Цифры — в аддоне: content/power/PowerMath.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	// энергоячейка: на конденсатор — второй конденсатор, электромедь, латунный лист, пресс (1 круг)
	var cell = 'axiomativ:incomplete_energy_cell'
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'createaddition:capacitor' },
		loops: 1,
		results: [{ id: 'axiomativ:energy_cell' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: cell }, { item: 'createaddition:capacitor' }], results: [{ id: cell }] },
			{ type: 'create:deploying', ingredients: [{ item: cell }, { item: 'nightshift:electric_copper' }], results: [{ id: cell }] },
			{ type: 'create:deploying', ingredients: [{ item: cell }, { item: 'create:brass_sheet' }], results: [{ id: cell }] },
			{ type: 'create:pressing', ingredients: [{ item: cell }], results: [{ id: cell }] }
		],
		transitional_item: { id: cell }
	}).id('nightshift:vahta/axiomativ/energy_cell')

	// зарядная станция: депо сверху (лоток для ячеек), медный корпус, медные катушки, конденсаторы
	event.recipes.create.mechanical_crafting('axiomativ:charging_station', [
		' D ',
		'SBS',
		'CEC'
	], {
		D: 'create:depot',
		S: 'createaddition:copper_spool',
		B: 'create:copper_casing',
		C: 'createaddition:capacitor',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/charging_station')

	// разрядная станция: депо, латунный корпус, электронные лампы, конденсаторы
	event.recipes.create.mechanical_crafting('axiomativ:discharging_station', [
		' D ',
		'TBT',
		'CEC'
	], {
		D: 'create:depot',
		T: 'create:electron_tube',
		B: 'create:brass_casing',
		C: 'createaddition:capacitor',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/discharging_station')

	// геотермальный генератор: генератор C&A (турбина) в медном корпусе, бак и трубы для воды
	event.recipes.create.mechanical_crafting('axiomativ:geothermal_generator', [
		' T ',
		'PAP',
		'EKE'
	], {
		T: 'create:fluid_tank',
		P: 'create:fluid_pipe',
		A: 'createaddition:alternator',
		K: 'create:copper_casing',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/geothermal_generator')

	// гидрогенератор: генератор C&A в андезитовом корпусе, водяное колесо и винты
	event.recipes.create.mechanical_crafting('axiomativ:hydro_generator', [
		' W ',
		'PAP',
		'EKE'
	], {
		W: 'create:water_wheel',
		P: 'create:propeller',
		A: 'createaddition:alternator',
		K: 'create:andesite_casing',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/hydro_generator')
})
