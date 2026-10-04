// ==========================================================================
// «Вахта» — котельная и прожектор аддона Axiomativ Industries 0.5.0.
// Георгий, 04.10: «одна станция, где горелки греют систему, и тепло трубами отправляем куда надо; слабый и сильный
// нагрев должны регулироваться» и «прожектор — чтобы были видны невидимые мобы».
//  - axiomativ:heat_exchanger  — теплообменник на горелку всполохов: её жар в тепловые трубы New Age;
//  - axiomativ:heat_valve      — тепловой вентиль: ветке «N нагревателей × обычный нагрев / суперогонь»;
//  - axiomativ:heating_element — ТЭН: ток в тепло той же сети;
//  - axiomativ:searchlight     — прожектор: луч 32 блока, невидимки в луче видны и светятся.
// Всё — механические крафтеры, в каждом электрическая медь: только после 15-й волны (заряд молнии).
// Ручных рецептов у аддона нет. EMC 0 всем — config/ProjectE/custom_emc.json (tools/emc_lock_create.py).
// Цифры — в аддоне: content/heat/HeatMath.java, content/searchlight/SearchlightMath.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	// теплообменник: медный корпус, тепловая труба вверх, медные листы по бокам
	event.recipes.create.mechanical_crafting('axiomativ:heat_exchanger', [
		' P ',
		'CBC',
		' E '
	], {
		P: 'create_new_age:heat_pipe',
		C: 'create:copper_sheet',
		B: 'create:copper_casing',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/heat_exchanger')

	// тепловой вентиль: жидкостный вентиль Create в разрыве тепловой трубы, электронная лампа — регулятор
	event.recipes.create.mechanical_crafting('axiomativ:heat_valve', [
		' T ',
		'PVP',
		' E '
	], {
		T: 'create:electron_tube',
		P: 'create_new_age:heat_pipe',
		V: 'create:fluid_valve',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/heat_valve')

	// ТЭН: медные листы, медная катушка C&A (спираль), конденсатор, тепловые трубы на выход
	event.recipes.create.mechanical_crafting('axiomativ:heating_element', [
		'CSC',
		'PKP',
		'CEC'
	], {
		C: 'create:copper_sheet',
		S: 'createaddition:copper_spool',
		P: 'create_new_age:heat_pipe',
		K: 'createaddition:capacitor',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/heating_element')

	// прожектор: стекло-линза, латунный корпус, лампа, электронные лампы
	event.recipes.create.mechanical_crafting('axiomativ:searchlight', [
		' G ',
		'BLB',
		'TET'
	], {
		G: 'minecraft:glass',
		B: 'create:brass_sheet',
		L: 'minecraft:redstone_lamp',
		T: 'create:electron_tube',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/searchlight')
})
