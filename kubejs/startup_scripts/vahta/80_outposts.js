// ==========================================================================
// «Сеть форпостов Axiomativ» — месторождения, полуфабрикаты, жидкости (Георгий, 04.10.2026:
// «форпосты должны быть жизненно необходимы», «только в той локации, в тех чанках крафтить», «полная автоматизация»).
//
// Месторождение — блок, который генерируется только в своём биоме (kubejs/data/nightshift/worldgen/…,
// tools/gen_outposts.py) и который нельзя унести: неразрушаемый, как бедрок (ни кирка, ни бур, ни поршень,
// ни контрапция Create его не сдвинут — у них проверка «прочность −1»). Месторождение — катализатор под
// механическим экструдером: нужный продукт делается только на месте, дальше — машины Create и поезд до базы.
// Каучуковая плантация — исключение: латекс даёт ствол гевеи, стоящий на латеритной почве (подсочка ножом
// деплоером, server_scripts/vahta/80_outposts.js).
//
// Частицы над месторождением — случайный тик блока (бывает только рядом с игроком, как рост пшеницы): видно
// издалека (до 512 блоков), месторождения ещё и светятся. Рецепты — server_scripts/vahta/80_outposts.js,
// текстуры — tools/gen_outposts.py. id пишем целиком в event.create('…') — по ним gen_quests и emc_lock_create
// находят предметы. Правило Rhino: только var.
// ==========================================================================

// частицы над открытым сверху блоком месторождения; smoke — ещё столб сигнального дыма (виден издалека)
function nsOutpostParticles(tick, particle, count, smoke) {
	try {
		var block = tick.block
		var level = tick.getLevel()
		var up = block.getUp()
		if (!up.getBlockState().isAir()) return
		var x = block.getX() + 0.5, y = block.getY() + 1.1, z = block.getZ() + 0.5
		level.spawnParticles(particle, true, x, y, z, 0.35, 0.25, 0.35, count, 0.02)
		if (smoke && Math.random() < 0.35) level.spawnParticles('minecraft:campfire_signal_smoke', true, x, y, z, 0.1, 0.1, 0.1, 1, 0.01)
	} catch (e) {
		// частицы — украшение; ошибка не должна мешать тику мира
	}
}

// общие свойства месторождения: неразрушаемое, светится, тег для подсказок и поиска
function nsDeposit(builder, light, particle, count, smoke) {
	builder
		.unbreakable()
		.lightLevel(light)
		.tagBlock('nightshift:outpost_deposits')
		.randomTick(function (tick) {
			nsOutpostParticles(tick, particle, count, smoke)
		})
	return builder
}

StartupEvents.registry('block', function (event) {
	// 1. Каучуковая плантация — джунгли. Почва + стволы гевеи (деревья стоят на почве с генерации)
	nsDeposit(event.create('nightshift:hevea_soil').texture('nightshift:block/hevea_soil').grassSoundType(), 0.2, 'minecraft:happy_villager', 2, false)
	// ствол гевеи ломается топором и ставится обратно — латекс даёт, только если стоит на латеритной почве
	event.create('nightshift:hevea_log')
		.texture('nightshift:block/hevea_log')
		.woodSoundType()
		.hardness(2)
		.resistance(3)
		.tagBlock('minecraft:mineable/axe')
	// 2. Солеварня — пляжи
	nsDeposit(event.create('nightshift:salt_deposit').texture('nightshift:block/salt_deposit').stoneSoundType(), 0.27, 'minecraft:white_ash', 6, false)
	// 3. Магнитная аномалия — горы выше 120
	nsDeposit(event.create('nightshift:magnetic_anomaly').texture('nightshift:block/magnetic_anomaly').stoneSoundType(), 0.47, 'minecraft:portal', 8, false)
	// 4. Серный источник — бесплодные земли (поверхность) и глубокие пещеры; вокруг озерца жидкой серы
	nsDeposit(event.create('nightshift:sulfur_spring').texture('nightshift:block/sulfur_spring').stoneSoundType(), 0.53, 'minecraft:lava', 1, true)
	// 5. Кварцевый карьер — пустыни
	nsDeposit(event.create('nightshift:quartz_vein').texture('nightshift:block/quartz_vein').glassSoundType(), 0.67, 'minecraft:end_rod', 2, false)
	// 6. Бокситовый карьер — саванны и плато
	nsDeposit(event.create('nightshift:bauxite_deposit').texture('nightshift:block/bauxite_deposit').stoneSoundType(), 0.27, 'minecraft:crimson_spore', 6, false)
	// 7. Высотный конденсатор — горы выше 180
	nsDeposit(event.create('nightshift:helium_ice').texture('nightshift:block/helium_ice').glassSoundType(), 0.6, 'minecraft:cloud', 2, false)
	// 8. Ледник — ледяные биомы
	nsDeposit(event.create('nightshift:permafrost').texture('nightshift:block/permafrost').gravelSoundType(), 0.4, 'minecraft:snowflake', 6, false)
	// 9. Торфяник — болота (тлеет — дымит)
	nsDeposit(event.create('nightshift:peat_bog').texture('nightshift:block/peat_bog').gravelSoundType(), 0.2, 'minecraft:smoke', 4, true)
	// 10. Грибные пещеры — грибные поля и пышные пещеры
	nsDeposit(event.create('nightshift:mycelium_vein').texture('nightshift:block/mycelium_vein').grassSoundType(), 0.67, 'minecraft:spore_blossom_air', 6, false)
	// 11. Обсерватория — самые высокие пики (выше 200)
	nsDeposit(event.create('nightshift:star_stone').texture('nightshift:block/star_stone').stoneSoundType(), 0.8, 'minecraft:end_rod', 3, false)
})

StartupEvents.registry('item', function (event) {
	// 1. резина
	event.create('nightshift:latex').texture('nightshift:item/latex')
	event.create('nightshift:tapping_knife').texture('nightshift:item/tapping_knife').maxStackSize(1)
	// 2. соль → электролит (жидкость ниже)
	event.create('nightshift:rock_salt').texture('nightshift:item/rock_salt')
	// 3. магнетит
	event.create('nightshift:raw_magnetite').texture('nightshift:item/raw_magnetite')
	event.create('nightshift:magnetite_dust').texture('nightshift:item/magnetite_dust')
	// 4. сера и оружейный порох (патроны Gunsmithing и заряды CBC — тег c:gunpowders)
	event.create('nightshift:sulfur_crust').texture('nightshift:item/sulfur_crust')
	event.create('nightshift:smokeless_powder').texture('nightshift:item/smokeless_powder')
	// 5. кварц: песок → стекло → линза
	event.create('nightshift:quartz_sand').texture('nightshift:item/quartz_sand')
	event.create('nightshift:quartz_glass').texture('nightshift:item/quartz_glass')
	event.create('nightshift:lens').texture('nightshift:item/lens')
	// 7. гелий
	event.create('nightshift:helium_frost').texture('nightshift:item/helium_frost')
	event.create('nightshift:helium_canister').texture('nightshift:item/helium_canister').maxStackSize(16)
	// 8. хладагент
	event.create('nightshift:cryo_crystal').texture('nightshift:item/cryo_crystal')
	event.create('nightshift:radiator').texture('nightshift:item/radiator')
	// 9. торф → фильтр
	event.create('nightshift:peat').texture('nightshift:item/peat').burnTime(1200)
	event.create('nightshift:activated_carbon').texture('nightshift:item/activated_carbon')
	event.create('nightshift:air_filter').texture('nightshift:item/air_filter').maxStackSize(16)
	// 10. споры
	event.create('nightshift:glowcap').texture('nightshift:item/glowcap')
	event.create('nightshift:spores').texture('nightshift:item/spores')
	// 11. звёздные карты
	event.create('nightshift:stardust').texture('nightshift:item/stardust').glow(true)
	event.create('nightshift:incomplete_star_chart').texture('nightshift:item/incomplete_star_chart').maxStackSize(1)
	event.create('nightshift:star_chart').texture('nightshift:item/star_chart').maxStackSize(16).rarity('uncommon')
})

// жидкости: блок жидкости = тот же id (его и ждёт экструдер сбоку), ведро — <id>_bucket
StartupEvents.registry('fluid', function (event) {
	event.create('nightshift:liquid_sulfur', 'thick').tint(0xE6B81E)
	event.create('nightshift:electrolyte', 'thin').tint(0x8FD9B6)
	event.create('nightshift:helium', 'thin').tint(0xEBDDFF)
	event.create('nightshift:coolant', 'thin').tint(0x36D4F0)
})
