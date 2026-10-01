// ==========================================================================
// «Вахта» — модули брони и энергощит (01.10). Предметы — startup_scripts/vahta/70_armor_modules.js
// и аддон Axiomativ Industries 0.3.0 (axiomativ:energy_shield_mk1/mk2).
//  1. Модули делают машины Create: два первых — сборка по шагам (деплоер + пресс), остальные — механические крафтеры.
//  2. Установка — тоже механические крафтеры: модуль + вещь своего слота в любой раскладке (энергощит — ещё
//     и электрическая медь). Рецепт axiomativ:armor_module (аддон): результат — та же вещь с чарами, прочностью,
//     именем, плюс атрибуты модуля поверх родных; второй такой же модуль крафтеры не примут (рецепт не совпадёт —
//     ничего не съедят). JEI такие рецепты не показывает — подсказки в client_scripts/armor_modules_tooltips.js.
//  3. Прибор ночного видения — эффект, пока шлем с модулем надет (раз в секунду, без частиц).
// Энергощит: 50 % урона до брони, пока есть заряд; заряжается ТОЛЬКО под куполом генератора щита (аддон).
// ВАЖНО: тело нативных обработчиков — в try/catch (исключение там роняет сервер). Правило Rhino: только var.
// ==========================================================================

// [модуль, слот, атрибуты]. Атрибуты — формат ItemAttributeModifiers.Entry (1.21.1, id атрибутов с generic.).
var NS_AM_INSTALL = [
	// урон от падения ×0 (множитель −100 % от итога) + безопасная высота 3 → 16 (нет и «тяжёлого» звука приземления)
	['nightshift:module_spring_boots', 'feet', [
		{ type: 'minecraft:generic.fall_damage_multiplier', id: 'nightshift:module/spring_boots_fall', amount: -1.0, operation: 'add_multiplied_total' },
		{ type: 'minecraft:generic.safe_fall_distance', id: 'nightshift:module/spring_boots_safe_fall', amount: 13.0, operation: 'add_value' }
	]],
	// высота шага 0,6 → 1,1: на целый блок без прыжка, как лошадь
	['nightshift:module_step_assist', 'feet', [
		{ type: 'minecraft:generic.step_height', id: 'nightshift:module/step_assist', amount: 0.5, operation: 'add_value' }
	]],
	// скорость +30 % от базовой (зелье скорости I — +20 %, II — +40 %)
	['nightshift:module_sprint', 'legs', [
		{ type: 'minecraft:generic.movement_speed', id: 'nightshift:module/sprint', amount: 0.3, operation: 'add_multiplied_base' }
	]],
	// сила прыжка 0,42 → 0,57: высота прыжка 1,25 → ~2,2 блока (стена в 2 блока — перепрыгнуть)
	['nightshift:module_jump_springs', 'legs', [
		{ type: 'minecraft:generic.jump_strength', id: 'nightshift:module/jump_springs', amount: 0.15, operation: 'add_value' }
	]],
	// +4 защиты, +2 вязкости, +0,1 к стойкости к отбрасыванию (потолок защиты в игре — 30)
	['nightshift:module_armor_plate', 'chest', [
		{ type: 'minecraft:generic.armor', id: 'nightshift:module/armor_plate', amount: 4.0, operation: 'add_value' },
		{ type: 'minecraft:generic.armor_toughness', id: 'nightshift:module/armor_plate_toughness', amount: 2.0, operation: 'add_value' },
		{ type: 'minecraft:generic.knockback_resistance', id: 'nightshift:module/armor_plate_knockback', amount: 0.1, operation: 'add_value' }
	]],
	// без атрибутов: ночное зрение даёт обработчик ниже
	['nightshift:module_night_vision', 'head', []]
]

ServerEvents.recipes(function (event) {
	// ---------- 1. сами модули ----------
	// Шаговый подъёмник: железный лист → шестерня, андезитовый сплав, пресс (×2)
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'create:iron_sheet' },
		loops: 2,
		results: [{ id: 'nightshift:module_step_assist' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: 'nightshift:incomplete_armor_module' }, { item: 'create:cogwheel' }], results: [{ id: 'nightshift:incomplete_armor_module' }] },
			{ type: 'create:deploying', ingredients: [{ item: 'nightshift:incomplete_armor_module' }, { item: 'create:andesite_alloy' }], results: [{ id: 'nightshift:incomplete_armor_module' }] },
			{ type: 'create:pressing', ingredients: [{ item: 'nightshift:incomplete_armor_module' }], results: [{ id: 'nightshift:incomplete_armor_module' }] }
		],
		transitional_item: { id: 'nightshift:incomplete_armor_module' }
	}).id('nightshift:vahta/armor_module/make_step_assist')

	// Пружинные ботинки: латунный лист → блок слизи, железный лист, пресс (×2)
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'create:brass_sheet' },
		loops: 2,
		results: [{ id: 'nightshift:module_spring_boots' }],
		sequence: [
			{ type: 'create:deploying', ingredients: [{ item: 'nightshift:incomplete_armor_module' }, { item: 'minecraft:slime_block' }], results: [{ id: 'nightshift:incomplete_armor_module' }] },
			{ type: 'create:deploying', ingredients: [{ item: 'nightshift:incomplete_armor_module' }, { item: 'create:iron_sheet' }], results: [{ id: 'nightshift:incomplete_armor_module' }] },
			{ type: 'create:pressing', ingredients: [{ item: 'nightshift:incomplete_armor_module' }], results: [{ id: 'nightshift:incomplete_armor_module' }] }
		],
		transitional_item: { id: 'nightshift:incomplete_armor_module' }
	}).id('nightshift:vahta/armor_module/make_spring_boots')

	// Ускоритель бега: сахар (как в зелье скорости), электронные лампы, точный механизм
	event.recipes.create.mechanical_crafting('nightshift:module_sprint', [
		'BSB',
		'TPT',
		'BSB'
	], {
		B: 'create:brass_sheet',
		S: 'minecraft:sugar',
		T: 'create:electron_tube',
		P: 'create:precision_mechanism'
	}).id('nightshift:vahta/armor_module/make_sprint')

	// Прыжковые пружины: блоки слизи, кроличьи лапки (как в зелье прыгучести), точный механизм
	event.recipes.create.mechanical_crafting('nightshift:module_jump_springs', [
		'LRL',
		'BPB',
		'LRL'
	], {
		L: 'minecraft:slime_block',
		R: 'minecraft:rabbit_foot',
		B: 'create:brass_sheet',
		P: 'create:precision_mechanism'
	}).id('nightshift:vahta/armor_module/make_jump_springs')

	// Бронепластина: прочные листы вокруг незеритового слитка
	event.recipes.create.mechanical_crafting('nightshift:module_armor_plate', [
		'SSS',
		'SNS',
		'SSS'
	], {
		S: 'create:sturdy_sheet',
		N: 'minecraft:netherite_ingot'
	}).id('nightshift:vahta/armor_module/make_armor_plate')

	// Прибор ночного видения: подзорная труба, светящиеся чернила, золотая морковь (как в зелье ночного зрения)
	event.recipes.create.mechanical_crafting('nightshift:module_night_vision', [
		'GSG',
		'TPT',
		'BCB'
	], {
		G: 'minecraft:glow_ink_sac',
		S: 'minecraft:spyglass',
		T: 'create:electron_tube',
		P: 'create:precision_mechanism',
		B: 'create:brass_sheet',
		C: 'minecraft:golden_carrot'
	}).id('nightshift:vahta/armor_module/make_night_vision')

	// Энергощит Mk1 (аддон 0.3.0): электрическая медь (веха 15-й волны), конденсаторы и аккумулятор C&A
	event.recipes.create.mechanical_crafting('axiomativ:energy_shield_mk1', [
		'ECE',
		'SAS',
		'ECE'
	], {
		E: 'nightshift:electric_copper',
		C: 'createaddition:capacitor',
		S: 'createaddition:electrum_sheet',
		A: 'createaddition:modular_accumulator'
	}).id('nightshift:vahta/armor_module/make_energy_shield_mk1')

	// Энергощит Mk2: межпланетный сплав (космос), перезаряженные алмазы New Age
	event.recipes.create.mechanical_crafting('axiomativ:energy_shield_mk2', [
		'LDL',
		'CAC',
		'LDL'
	], {
		L: 'axiomativ:interplanetary_alloy',
		D: 'create_new_age:overcharged_diamond',
		C: 'createaddition:capacitor',
		A: 'createaddition:modular_accumulator'
	}).id('nightshift:vahta/armor_module/make_energy_shield_mk2')

	// ---------- 2. установка на вещь (механические крафтеры) ----------
	for (var i = 0; i < NS_AM_INSTALL.length; i++) {
		var m = NS_AM_INSTALL[i]
		event.custom({
			type: 'axiomativ:armor_module',
			module: { item: m[0] },
			slot: m[1],
			attributes: m[2]
		}).id('nightshift:vahta/armor_module/install_' + m[0].split(':')[1].replace('module_', ''))
	}
	// энергощит: модуль + любой нагрудник + электрическая медь; Mk2 ставится и поверх Mk1 (заряд сохраняется)
	event.custom({
		type: 'axiomativ:armor_module',
		module: { item: 'axiomativ:energy_shield_mk1' },
		addition: { item: 'nightshift:electric_copper' },
		slot: 'chest',
		energy_shield: 1
	}).id('nightshift:vahta/armor_module/install_energy_shield_mk1')
	event.custom({
		type: 'axiomativ:armor_module',
		module: { item: 'axiomativ:energy_shield_mk2' },
		addition: { item: 'nightshift:electric_copper' },
		slot: 'chest',
		energy_shield: 2
	}).id('nightshift:vahta/armor_module/install_energy_shield_mk2')
})

// ---------- 3. прибор ночного видения ----------
// Раз в секунду: шлем с модулем → ночное зрение на 13 с (дольше 10 с — без мерцания конца эффекта), без частиц.
// Сняли шлем — убираем «наш» эффект сразу (наш = фоновый, уровень I, ≤ 13 с; зелье ночного зрения не фоновое — его не трогаем).
var NS_AM_NV_ID = 'nightshift:module_night_vision'
var NS_AM_NV_TICKS = 260
var NS_AM_BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
var NS_AM_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
var NS_AM_MEI = Java.loadClass('net.minecraft.world.effect.MobEffectInstance')
var NS_AM_EFFECTS = Java.loadClass('net.minecraft.world.effect.MobEffects')
var NS_AM_SLOT = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
var nsAmModulesType = null
var nsAmBroken = false

// стоит ли модуль на вещи (компонент аддона axiomativ:armor_modules — список id модулей)
function nsAmHasModule(stack, id) {
	if (!stack || stack.isEmpty()) return false
	if (nsAmModulesType === null) nsAmModulesType = NS_AM_BR.DATA_COMPONENT_TYPE.get(NS_AM_RL.parse('axiomativ:armor_modules'))
	if (!nsAmModulesType) return false
	var list = stack.get(nsAmModulesType)
	if (!list) return false
	for (var i = 0; i < list.size(); i++) {
		if (String(list.get(i)) === id) return true
	}
	return false
}

PlayerEvents.tick(function (event) {
	if (nsAmBroken) return
	try {
		var p = event.player
		if (p.tickCount % 20 !== 0) return
		var cur = p.getEffect(NS_AM_EFFECTS.NIGHT_VISION)
		if (nsAmHasModule(p.getItemBySlot(NS_AM_SLOT.HEAD), NS_AM_NV_ID)) {
			if (!cur || cur.getDuration() < NS_AM_NV_TICKS - 20) p.addEffect(new NS_AM_MEI(NS_AM_EFFECTS.NIGHT_VISION, NS_AM_NV_TICKS, 0, true, false, true))
		} else if (cur && cur.isAmbient() && cur.getAmplifier() === 0 && cur.getDuration() <= NS_AM_NV_TICKS) {
			p.removeEffect(NS_AM_EFFECTS.NIGHT_VISION)
		}
	} catch (e) {
		nsAmBroken = true
		console.error('[armor_modules] ночное зрение выключено до перезагрузки скриптов: ' + e)
	}
})
