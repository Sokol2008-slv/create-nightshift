// ==========================================================================
// Исправления по аудиту 05.10.2026 (docs/audit-2026-10-05.md), без смены баланса.
// ==========================================================================
ServerEvents.recipes(function (event) {
	// Нагреватель New Age: ранний рецепт без заряженного железа. Раньше «Тепло» требовало «Тока» (заряд —
	// энергайзер), а в книге стоит раньше. Железный лист вместо заряженного железа, остальное как у мода.
	event.shaped('create_new_age:heater', ['N N', 'NBN', 'PSP'], {
		N: '#c:nuggets/iron',
		B: 'create:empty_blaze_burner',
		P: 'create_new_age:heat_pipe',
		S: 'create:iron_sheet'
	}).id('nightshift:vahta/audit/heater_early')

	// Загрузчик чанков для форпоста без живого гаста (Create Power Loader ловит гаста пустым загрузчиком —
	// поход в Незер на каждый форпост). Миксер: пустой загрузчик + 2 жемчуга Края + светопыль.
	event.recipes.create.mixing('create_power_loader:andesite_chunk_loader', ['create_power_loader:empty_andesite_chunk_loader', '2x minecraft:ender_pearl', 'minecraft:glowstone_dust']).id('nightshift:vahta/audit/andesite_chunk_loader')
	event.recipes.create.mixing('create_power_loader:brass_chunk_loader', ['create_power_loader:empty_brass_chunk_loader', '2x minecraft:ender_pearl', 'minecraft:glowstone_dust']).id('nightshift:vahta/audit/brass_chunk_loader')

	// Большие решётки (аудит, предложение 9): генератор C&A — ромб 5×5 на 13 крафтеров, электромотор C&A — 5×4 на 12,
	// а в ящике вахтовика 9. Добавлены раскладки 3×3 (старые тоже работают — построенные ромбы не ломаются).
	event.recipes.create.mechanical_crafting('createaddition:alternator', ['EIE', 'IRI', 'EAE'], {
		E: 'nightshift:electric_copper',
		I: '#c:plates/iron',
		R: '#c:rods/iron',
		A: 'create:andesite_alloy'
	}).id('nightshift:vahta/audit/alternator_3x3')
	event.recipes.create.mechanical_crafting('createaddition:electric_motor', ['BMB', 'SRS', 'BCB'], {
		B: '#c:plates/brass',
		M: 'create_new_age:magnetite_block',
		S: 'createaddition:copper_spool',
		R: '#c:rods/iron',
		C: 'createaddition:capacitor'
	}).id('nightshift:vahta/audit/electric_motor_3x3')
})
