// ==========================================================================
// «Вахта» — CBC: Firepower Components 0.4.0 (01.10, из разбора модов: автоподача снарядов, магазины).
// Компактные лафеты пушки и автопушки, подача патронов (смешивает основные и трассеры), большой ящик патронов,
// магазин большой пушки на 3 выстрела, умный стеллаж готовых выстрелов, карусель, сборщик гильз, автоконтроллер.
// Версия 0.4.0 закреплена (packwiz pin): 0.4.2 не запускает сервер с Create Radar 0.4.9.4 — её миксины API
// радара 5.0 включаются всегда, а метода resolveKineticMount в радаре 0.4.9.4 нет (краш при загрузке модов).
//  0. Вертикальный компактный лафет ЗАКРЫТ: в 0.4.0 спешивание с пушки на нём роняет сервер (поворот направления
//     UP/DOWN по горизонтали; исправлено только в 0.4.2). Рецепт убран, в JEI скрыт (client_scripts/cbc_firepower_jei.js).
//  1. Рецепты мода — обычные верстачные: их и так делают механические крафтеры (дырявые раскладки — с крышкой
//     слота). Как и для остальных модов (tools/vahta_recipes.py), даём ещё миксер: набор ингредиентов у каждого
//     уникален, так что миксер над бассейном собирает их без крафтерной решётки.
//  2. Крупнокалиберная автопушка (казённик, стволы, дульный тормоз, спаренная) в моде рецептов НЕ имеет — только
//     творческий режим. Даём сборку на механических крафтерах из стальных частей автопушки Create Big Cannons
//     (они отливаются в формах, глава «Оборона базы»).
//  3. Крупнокалиберные выстрелы мод делает только из стали CBC — разрешаем любую сталь (#c:ingots/steel: TFMG, CBC).
// Правило Rhino: только var.
// ==========================================================================
var NS_CBCFC_MIX = [
	// [id рецепта мода, выход, ингредиенты миксера]
	['autocannon_ammo_feed', 'cbc_firepower_components:autocannon_ammo_feed', ['minecraft:hopper', '2x create:industrial_iron_block', 'createbigcannons:autocannon_ammo_container', 'create:brass_casing']],
	['autocannon_ammo_feed_andesite_funnel', 'cbc_firepower_components:autocannon_ammo_feed', ['create:andesite_funnel', '2x create:industrial_iron_block', 'createbigcannons:autocannon_ammo_container', 'create:brass_casing']],
	['automatic_cannon_controller', 'cbc_firepower_components:automatic_cannon_controller', ['2x create:brass_sheet', '2x minecraft:redstone', '4x create:industrial_iron_block', 'minecraft:comparator']],
	['cannon_limiter', 'cbc_firepower_components:cannon_limiter', ['create:shaft', '2x create:brass_sheet', 'minecraft:redstone', 'create:andesite_alloy']],
	['cannon_magazine_loader', 'cbc_firepower_components:cannon_magazine_loader', ['3x create:brass_sheet', '2x create:brass_casing', 'createbigcannons:cannon_loader', '2x create:industrial_iron_block', 'minecraft:redstone']],
	['carousel_ammunition_rack', 'cbc_firepower_components:carousel_ammunition_rack', ['4x create:sturdy_sheet', '3x create:brass_sheet', 'minecraft:chest', 'create:andesite_alloy']],
	['compact_autocannon_mount', 'cbc_firepower_components:compact_autocannon_mount', ['2x #c:plates/iron', 'create:shaft', '2x create:cogwheel', 'create:andesite_casing', '2x #createbigcannons:gunpowder', 'create:brass_sheet']],
	['compact_cannon_mount', 'cbc_firepower_components:compact_cannon_mount', ['2x #c:plates/iron', '2x create:shaft', '2x create:cogwheel', 'create:brass_casing', '2x #createbigcannons:gunpowder']],
	['large_autocannon_ammo_box', 'cbc_firepower_components:large_autocannon_ammo_box', ['4x create:industrial_iron_block', '3x createbigcannons:autocannon_ammo_container', 'create:brass_casing', 'create:brass_block']],
	['ready_ammunition_compartment', 'cbc_firepower_components:ready_ammunition_compartment', ['4x create:industrial_iron_block', '4x create:brass_sheet', 'minecraft:chest']],
	['spent_casing_collector', 'cbc_firepower_components:spent_casing_collector', ['2x create:brass_sheet', '5x create:industrial_iron_block', 'minecraft:hopper']]
]

ServerEvents.recipes(function (event) {
	// ---------- 0. вертикальный лафет закрыт (краш сервера при спешивании в 0.4.0) ----------
	event.remove({ id: 'cbc_firepower_components:vertical_compact_cannon_mount' })

	// ---------- 1. миксер ----------
	for (var i = 0; i < NS_CBCFC_MIX.length; i++) {
		var r = NS_CBCFC_MIX[i]
		var ings = []
		for (var k = 0; k < r[2].length; k++) {
			var m = /^(\d+)x (.+)$/.exec(r[2][k])
			var n = m ? parseInt(m[1], 10) : 1
			// nsIng (00_ingredients.js): '#тег' в рецепте Create иначе читается как тег жидкости
			for (var c = 0; c < n; c++) ings.push(nsIng(m ? m[2] : r[2][k]))
		}
		event.recipes.create.mixing(r[1], ings).id('nightshift:vahta/mix/cbc_firepower_components/' + r[0])
	}

	// ---------- 2. крупнокалиберная автопушка ----------
	// казённик: два стальных казённика автопушки + две возвратные пружины + точный механизм
	event.recipes.create.mechanical_crafting('cbc_firepower_components:large_autocannon_breech', [
		'SBS',
		'RPR',
		'SBS'
	], {
		S: '#c:ingots/steel',
		B: 'createbigcannons:steel_autocannon_breech',
		R: 'createbigcannons:steel_autocannon_recoil_spring',
		P: 'create:precision_mechanism'
	}).id('nightshift:vahta/cbc_firepower/large_autocannon_breech')
	// ствол: два стальных ствола автопушки в стальной обойме
	event.recipes.create.mechanical_crafting('cbc_firepower_components:steel_large_autocannon_barrel', [
		'SBS',
		'SBS'
	], {
		S: '#c:ingots/steel',
		B: 'createbigcannons:steel_autocannon_barrel'
	}).id('nightshift:vahta/cbc_firepower/steel_large_autocannon_barrel')
	// толстый ствол: ствол в стальных блоках
	event.recipes.create.mechanical_crafting('cbc_firepower_components:steel_thick_large_autocannon_barrel', [
		'KLK'
	], {
		K: '#c:storage_blocks/steel',
		L: 'cbc_firepower_components:steel_large_autocannon_barrel'
	}).id('nightshift:vahta/cbc_firepower/steel_thick_large_autocannon_barrel')
	// дульный тормоз: ствол между решётками
	event.recipes.create.mechanical_crafting('cbc_firepower_components:steel_large_autocannon_muzzle_brake', [
		'ILI'
	], {
		I: 'minecraft:iron_bars',
		L: 'cbc_firepower_components:steel_large_autocannon_barrel'
	}).id('nightshift:vahta/cbc_firepower/steel_large_autocannon_muzzle_brake')
	// спаренная: два одиночных узла на стальной перемычке
	event.recipes.create.mechanical_crafting('cbc_firepower_components:twin_large_autocannon_breech', [
		'LPL'
	], {
		L: 'cbc_firepower_components:large_autocannon_breech',
		P: 'create:precision_mechanism'
	}).id('nightshift:vahta/cbc_firepower/twin_large_autocannon_breech')
	event.recipes.create.mechanical_crafting('cbc_firepower_components:steel_twin_large_autocannon_barrel', [
		'LSL'
	], {
		L: 'cbc_firepower_components:steel_large_autocannon_barrel',
		S: '#c:ingots/steel'
	}).id('nightshift:vahta/cbc_firepower/steel_twin_large_autocannon_barrel')
	event.recipes.create.mechanical_crafting('cbc_firepower_components:steel_twin_large_autocannon_muzzle_brake', [
		'MSM'
	], {
		M: 'cbc_firepower_components:steel_large_autocannon_muzzle_brake',
		S: '#c:ingots/steel'
	}).id('nightshift:vahta/cbc_firepower/steel_twin_large_autocannon_muzzle_brake')

	// ---------- 3. крупнокалиберные выстрелы из любой стали ----------
	event.remove({ id: 'cbc_firepower_components:large_autocannon_round' })
	event.remove({ id: 'cbc_firepower_components:large_autocannon_he_round' })
	event.shapeless('2x cbc_firepower_components:large_autocannon_round', [
		'createbigcannons:ap_autocannon_round', 'createbigcannons:filled_autocannon_cartridge', '#c:ingots/steel'
	]).id('nightshift:vahta/cbc_firepower/large_autocannon_round')
	event.shapeless('2x cbc_firepower_components:large_autocannon_he_round', [
		'createbigcannons:flak_autocannon_round', 'createbigcannons:filled_autocannon_cartridge', '#c:ingots/steel', '#c:gunpowders'
	]).id('nightshift:vahta/cbc_firepower/large_autocannon_he_round')
})
