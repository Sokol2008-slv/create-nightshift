// ==========================================================================
// «Вахта» — диспетчерская и ремонтная стойка аддона Axiomativ Industries 0.7.0.
//  - axiomativ:dispatch_monitor — экран диспетчерской (×2): ток, форпосты, поезда, набег, метеорит, заказы на одной
//    стене; экраны рядом складываются до 4×3; ПКМ — окно с подробностями; тревоги в углу экрана у всех;
//  - axiomativ:dispatch_sensor  — датчик (×2): на грань любой машины — и она в диспетчерской (лампа состояния);
//  - axiomativ:repair_rack      — ремонтная стойка: манекен со сварочной рукой, чинит броню/инструмент/оружие за ток,
//    заряжает энергощит нагрудника, Shift+ПКМ — переодеться комплектом.
// Всё — механическими крафтерами, в каждом рецепте электрическая медь: только после 15-й волны (заряд молнии).
// Ручных рецептов у аддона нет. EMC 0 всем — config/ProjectE/custom_emc.json (tools/emc_lock_create.py).
// Цифры — в аддоне: content/repair/RepairMath.java, content/dispatch/DispatchNetwork.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	// экран: два дисплейных табло Create, электронные лампы, латунный корпус, электромедь → 2 экрана
	event.recipes.create.mechanical_crafting('2x axiomativ:dispatch_monitor', [
		'DED',
		'TBT'
	], {
		D: 'create:display_board',
		E: 'nightshift:electric_copper',
		T: 'create:electron_tube',
		B: 'create:brass_casing'
	}).id('nightshift:vahta/axiomativ/dispatch_monitor')

	// датчик: беспроводное звено (антенна), дисплейный адаптер (читает машину), электромедь → 2 датчика
	event.recipes.create.mechanical_crafting('2x axiomativ:dispatch_sensor', [
		'R',
		'L',
		'E'
	], {
		R: 'create:redstone_link',
		L: 'create:display_link',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/dispatch_sensor')

	// ремонтная стойка: механическая рука (сварочный манипулятор), стойка для брони (манекен), наковальня,
	// медные катушки, точные механизмы, андезитовые корпуса (платформа), электромедь
	event.recipes.create.mechanical_crafting('axiomativ:repair_rack', [
		' A ',
		'CSC',
		'PNP',
		'KEK'
	], {
		A: 'create:mechanical_arm',
		S: 'minecraft:armor_stand',
		C: 'createaddition:copper_spool',
		P: 'create:precision_mechanism',
		N: 'minecraft:anvil',
		K: 'create:andesite_casing',
		E: 'nightshift:electric_copper'
	}).id('nightshift:vahta/axiomativ/repair_rack')
})
