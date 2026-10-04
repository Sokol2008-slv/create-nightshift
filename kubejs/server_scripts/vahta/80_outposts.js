// ==========================================================================
// «Сеть форпостов Axiomativ» — рецепты (Георгий, 04.10.2026: «форпосты должны быть жизненно необходимы, привязать
// намного больше штук», «главное, чтобы всё удобно добывалось», «не бур, а чтобы только в той локации крафтить»,
// «полная автоматизация»). Блоки и предметы — startup_scripts/vahta/80_outposts.js, генерация — tools/gen_outposts.py,
// глава книги — tools/quests/spec_outposts.json.
//
// Схема каждого форпоста: месторождение (неразрушаемый блок только в своём биоме) под механическим экструдером +
// два блока по бокам (вода, лава, жидкая сера, воздух…) → сырьё → 1–2 машины Create → продукт → поезд на базу.
// Экструдер: удар = 200 / floor(1 + 59·об/мин/512) тиков; NS_OP_BONKS ударов на штуку. Одна машина на 64 об/мин —
// 48 ударов/мин → 12 штук сырья в минуту, на 256 об/мин — ~43. Рычаг: больше экструдеров и выше обороты.
//
// Исходные рецепты, которые заменены, убираем по id — tools/vahta_recipes.py при перегенерации не переносит их в
// миксер (10_machine_recipes.js). Рецепты, добавленные другими скриптами (успокоительное, контроллер ракеты,
// катушка тесла-башни), правятся в своих файлах. Правило Rhino: только var; тело NativeEvents — в try.
// ==========================================================================

var NS_OP_BONKS = 4
// подсочка: перезарядка одного ствола (мс) и сколько стволов над почвой считаются «деревом»
var NS_OP_TAP_COOLDOWN = 3000
var NS_OP_TAP_HEIGHT = 6

// --------------------------------------------------------------------------
// Удаляемые исходные рецепты (их место заняли рецепты с продукцией форпостов)
// --------------------------------------------------------------------------
var NS_OP_REMOVE = [
	// 1. резина: синтетическая из нефти убрана — только латекс плантации
	'tfmg:vat_machine_recipe/rubber',
	'createaddition:crafting/copper_spool', 'createaddition:crafting/gold_spool', 'createaddition:crafting/electrum_spool',
	'createaddition:crafting/large_connector',
	'create_new_age:cutting/copper_wire', 'create_new_age:cutting/overcharged_iron_wire', 'create_new_age:cutting/overcharged_golden_wire',
	'create_new_age:sequenced_assembly/overcharged_diamond_wire',
	'offroad:tire', 'offroad:small_tire', 'offroad:large_tire', 'offroad:monstrous_tire',
	'immersive_aircraft:improved_landing_gear', 'northstar:mechanical_crafting/oxygen_sealer',
	// 2. электролит
	'createaddition:crafting/capacitor_1', 'createaddition:crafting/capacitor_2',
	// 3. магнетит (руда New Age больше не генерируется — kubejs/data/create_new_age/…)
	'create_new_age:shaped/redstone_magnet', 'create_new_age:shaped/layered_magnet', 'create_new_age:shaped/netherite_magnet',
	'create_new_age:shaped/advanced_motor', 'create_new_age:mechanical_crafting/reinforced_motor',
	'createaddition:mechanical_crafting/electric_motor', 'create_radar:crafting/radar_bearing',
	// 4. сера: другие источники серной пыли (незер, магма) закрыты — только Серный источник
	'create:crushing/sulfur', 'create:crushing/magma_block',
	// 5. кварцевое стекло и линзы
	'create_new_age:shaped/basic_solar_heating_plate', 'create_new_age:shaped/advanced_solar_heating_plate',
	'northstar:mechanical_crafting/solar_panel', 'minecraft:spyglass', 'northstar:crafting/telescope',
	'create_radar:crafting/binoculars', 'immersive_aircraft:gyroscope_hud',
	'immersive_aircraft:biplane', 'immersive_aircraft:gyrodyne', 'immersive_aircraft:quadrocopter',
	// 6. алюминий (боксит TFMG больше не генерируется)
	'create:crushing/bauxite',
	'immersive_aircraft:hull', 'immersive_aircraft:propeller', 'immersive_aircraft:enhanced_propeller', 'immersive_aircraft:sail',
	'aeronautics:smart_propeller', 'aeronautics:gyroscopic_propeller_bearing',
	// 7. гелий
	'immersive_aircraft:airship', 'aeronautics:mixing/levitite_blend',
	// 8. хладагент
	'create_new_age:shapeless/reactor_heat_vent', 'create_new_age:mechanical_crafting/reactor_rod',
	'createdieselgenerators:crafting/large_diesel_engine', 'createdieselgenerators:crafting/huge_diesel_engine',
	'tfmg:mechanical_crafting/large_engine',
	// 9. фильтры
	'northstar:crafting/oxygen_filler', 'northstar:crafting/iron_space_suit_helmet', 'northstar:crafting/martian_steel_space_suit_helmet',
	'northstar:crafting/iron_space_suit_chestpiece', 'northstar:crafting/martian_steel_space_suit_chestpiece',
	'create_submarine:oxygen_diffuser', 'createbigcannons:gas_mask',
	// 11. звёздные карты
	'northstar:mechanical_crafting/interplanetary_navigator', 'northstar:sequenced_assembly/targeting_computer'
]

// оболочки Aeronautics — 16 цветов: шерсть + баллон гелия (деплоер)
var NS_OP_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan',
	'purple', 'blue', 'brown', 'green', 'red', 'black']

// экструдер на месторождении: [id, результат, сбоку 1, сбоку 2, месторождение снизу]. Пары по бокам не совпадают с
// рецептами экструдера без катализатора (вода+лава = обсидиан/глубинный сланец, вода+песок = песчаник, вода+вода выше
// 150 = снег) — иначе экструдер возьмёт их
var NS_OP_EXTRUDE = [
	['salt', 'nightshift:rock_salt', 'minecraft:water', 'minecraft:water', 'nightshift:salt_deposit'],
	['magnetite', 'nightshift:raw_magnetite', 'minecraft:lava', 'minecraft:iron_block', 'nightshift:magnetic_anomaly'],
	['sulfur', 'nightshift:sulfur_crust', 'nightshift:liquid_sulfur', 'minecraft:water', 'nightshift:sulfur_spring'],
	['quartz', 'nightshift:quartz_sand', 'minecraft:sandstone', 'minecraft:water', 'nightshift:quartz_vein'],
	['bauxite', 'tfmg:bauxite', 'minecraft:water', 'minecraft:clay', 'nightshift:bauxite_deposit'],
	['helium', 'nightshift:helium_frost', 'minecraft:air', 'minecraft:air', 'nightshift:helium_ice'],
	['cryo', 'nightshift:cryo_crystal', 'minecraft:packed_ice', 'minecraft:water', 'nightshift:permafrost'],
	['peat', 'nightshift:peat', 'minecraft:water', 'minecraft:mud', 'nightshift:peat_bog'],
	['glowcap', 'nightshift:glowcap', 'minecraft:water', 'minecraft:moss_block', 'nightshift:mycelium_vein'],
	['stardust', 'nightshift:stardust', 'minecraft:air', 'minecraft:air', 'nightshift:star_stone']
]

function nsOpFluid(id, amount) {
	return { type: 'neoforge:single', fluid: id, amount: amount }
}

function nsOpSeq(event, id, ingredient, part, loops, result, steps) {
	var seq = []
	steps.forEach(function (s) {
		if (s[0] === 'deploy') seq.push({ type: 'create:deploying', ingredients: [{ item: part }, s[1]], results: [{ id: part }] })
		else if (s[0] === 'fill') seq.push({ type: 'create:filling', ingredients: [{ item: part }, s[1]], results: [{ id: part }] })
		else if (s[0] === 'press') seq.push({ type: 'create:pressing', ingredients: [{ item: part }], results: [{ id: part }] })
		else if (s[0] === 'cut') seq.push({ type: 'create:cutting', ingredients: [{ item: part }], results: [{ id: part }] })
		else seq.push(s[1]) // готовый шаг (например, энергайзер New Age)
	})
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: ingredient,
		loops: loops,
		results: [result],
		sequence: seq,
		transitional_item: { id: part }
	}).id(id)
}

ServerEvents.recipes(function (event) {
	NS_OP_REMOVE.forEach(function (id) {
		event.remove({ id: id })
	})
	NS_OP_COLORS.forEach(function (c) {
		event.remove({ id: 'aeronautics:' + c + '_envelope' })
		event.remove({ id: 'aeronautics:deploying/deploying_envelope_' + c })
	})

	var mc = function (out, pattern, key, id) {
		event.recipes.create.mechanical_crafting(out, pattern, key).id('nightshift:outposts/' + id)
	}
	var rubber = 'tfmg:rubber_sheet'

	// ---------------- экструдер на месторождениях ----------------
	NS_OP_EXTRUDE.forEach(function (r) {
		event.custom({
			type: 'create_mechanical_extruder:extruding',
			blockIngredients: { first: { blocks: r[2] }, second: { blocks: r[3] } },
			catalyst: { blocks: r[4] },
			result: { id: r[1] },
			requiredBonks: NS_OP_BONKS
		}).id('nightshift:outposts/extruding/' + r[0])
	})

	// ---------------- 1. Каучуковая плантация ----------------
	// нож для подсочки: деплоер кладёт железный лист на палку
	event.custom({ type: 'create:deploying', ingredients: [{ item: 'minecraft:stick' }, { tag: 'c:plates/iron' }], results: [{ id: 'nightshift:tapping_knife' }] })
		.id('nightshift:outposts/tapping_knife')
	// вулканизация: латекс + сера, нагрев → резина (лист TFMG)
	event.recipes.create.mixing('3x ' + rubber, ['2x nightshift:latex', nsIng('#c:dusts/sulfur')]).heated().id('nightshift:outposts/rubber')
	// изоляция катушек C&A: 4 провода + 4 резины вокруг катушки
	;[['copper', 'createaddition:copper_spool'], ['gold', 'createaddition:gold_spool'], ['electrum', 'createaddition:electrum_spool']].forEach(function (w) {
		mc(w[1], ['RWR', 'WSW', 'RWR'], { R: rubber, W: nsIng('#c:wires/' + w[0]), S: 'createaddition:spool' }, w[0] + '_spool')
	})
	// толстый кабель: большой соединитель C&A — резина вместо слизи
	event.recipes.create.mixing('2x createaddition:large_connector',
		[nsIng('#createaddition:large_connector_usable_rods'), '2x create:andesite_alloy', rubber]).id('nightshift:outposts/large_connector')
	// провода New Age: лист → резина (деплоер) → пила, 4 провода
	;[['copper_wire', nsIng('#c:plates/copper')], ['overcharged_iron_wire', 'create_new_age:overcharged_iron_sheet'],
		['overcharged_golden_wire', 'create_new_age:overcharged_golden_sheet']].forEach(function (w) {
		var ing = typeof w[1] === 'string' ? { item: w[1] } : { tag: 'c:plates/copper' }
		nsOpSeq(event, 'nightshift:outposts/' + w[0], ing, 'create_new_age:incomplete_wire', 1,
			{ id: 'create_new_age:' + w[0], count: 4 }, [['deploy', { item: rubber }], ['cut']])
	})
	nsOpSeq(event, 'nightshift:outposts/overcharged_diamond_wire', { item: 'create_new_age:overcharged_diamond' }, 'create_new_age:incomplete_wire', 3,
		{ id: 'create_new_age:overcharged_diamond_wire', count: 2 },
		[['deploy', { item: rubber }], ['cut'], ['raw', { type: 'create_new_age:energising', energy_needed: 100,
			ingredients: [{ item: 'create_new_age:incomplete_wire' }], results: [{ id: 'create_new_age:incomplete_wire' }] }]])
	// шины Offroad и шасси самолёта
	event.custom({ type: 'create:deploying', ingredients: [{ item: 'create:shaft' }, { item: rubber }], results: [{ id: 'offroad:small_tire' }] })
		.id('nightshift:outposts/small_tire')
	mc('offroad:tire', [' R ', 'RSR', ' R '], { R: rubber, S: 'create:shaft' }, 'tire')
	mc('offroad:large_tire', [' R ', 'BSB', ' R '], { R: rubber, B: 'create:belt_connector', S: 'create:shaft' }, 'large_tire')
	mc('offroad:monstrous_tire', ['RRR', 'RSR', 'RRR'], { R: rubber, S: 'create:shaft' }, 'monstrous_tire')
	mc('immersive_aircraft:improved_landing_gear', [' II', 'RRI', 'RR '], { R: rubber, I: nsIng('#c:ingots/iron') }, 'improved_landing_gear')
	// уплотнитель кислорода Northstar
	mc('northstar:oxygen_sealer', ['TPT', 'R#R', 'CFC', 'TST'], {
		T: nsIng('#c:plates/titanium'), P: 'create:encased_fan', R: rubber, '#': 'northstar:oxygen_separator',
		C: 'northstar:circuit', F: 'create:fluid_tank', S: 'create:shaft'
	}, 'oxygen_sealer')

	// ---------------- 2. Солеварня ----------------
	event.recipes.create.crushing(['2x northstar:salt', CreateItem.of('northstar:salt', 0.25)], 'nightshift:rock_salt').id('nightshift:outposts/rock_salt_crushing')
	// электролит — из каменной соли форпоста (соль Northstar бывает и из базальта, поэтому не она)
	event.recipes.create.mixing(Fluid.of('nightshift:electrolyte', 500), ['nightshift:rock_salt', Fluid.of('minecraft:water', 500)]).id('nightshift:outposts/electrolyte')
	// конденсатор C&A: медь + цинк + факел + электролит (миксер). Аккумуляторы, генератор щита, энергощиты,
	// тесла-башня и электромотор C&A собираются из конденсаторов — электролит нужен им всем
	event.recipes.create.mixing('createaddition:capacitor', [nsIng('#c:plates/copper'), nsIng('#c:plates/zinc'), 'minecraft:redstone_torch',
		Fluid.of('nightshift:electrolyte', 100)]).id('nightshift:outposts/capacitor')

	// ---------------- 3. Магнитная аномалия ----------------
	event.recipes.create.crushing(['2x nightshift:magnetite_dust', CreateItem.of('minecraft:iron_nugget', 0.25)], 'nightshift:raw_magnetite')
		.id('nightshift:outposts/raw_magnetite_crushing')
	event.recipes.create.compacting('create_new_age:magnetite_block', ['4x nightshift:magnetite_dust']).id('nightshift:outposts/magnetite_block')
	// старые блоки магнетита из шахт (до форпостов) — в порошок
	event.recipes.create.crushing(['3x nightshift:magnetite_dust', CreateItem.of('nightshift:magnetite_dust', 0.5)], 'create_new_age:magnetite_block')
		.id('nightshift:outposts/magnetite_block_crushing')
	mc('2x create_new_age:redstone_magnet', ['NDN', 'DRD', 'NDN'],
		{ N: nsIng('#c:nuggets/iron'), D: 'nightshift:magnetite_dust', R: nsIng('#c:storage_blocks/redstone') }, 'redstone_magnet')
	mc('4x create_new_age:layered_magnet', ['IDI', 'GGG', 'IDI'],
		{ I: 'create_new_age:overcharged_iron', G: 'create_new_age:overcharged_gold', D: 'nightshift:magnetite_dust' }, 'layered_magnet')
	mc('2x create_new_age:netherite_magnet', ['SDS', 'DMD', 'SDS'],
		{ S: 'minecraft:netherite_scrap', D: 'create_new_age:overcharged_diamond', M: 'create_new_age:magnetite_block' }, 'netherite_magnet')
	mc('create_new_age:advanced_motor', ['NDN', 'ICS', 'NDN'],
		{ N: nsIng('#c:nuggets/gold'), D: 'nightshift:magnetite_dust', I: 'create_new_age:overcharged_iron', C: 'create:brass_casing', S: 'create:shaft' }, 'advanced_motor')
	mc('2x create_new_age:reinforced_motor', ['dDPPd', 'DCMSS', 'dDPPd'], {
		d: nsIng('#c:gems/diamond'), D: 'create_new_age:overcharged_diamond', P: nsIng('#c:plates/iron'),
		C: 'create:brass_casing', M: 'create_new_age:magnetite_block', S: 'create:shaft'
	}, 'reinforced_motor')
	mc('createaddition:electric_motor', ['  M  ', ' BSB ', 'BSRSB', ' BCB '], {
		M: 'create_new_age:magnetite_block', B: nsIng('#c:plates/brass'), S: 'createaddition:copper_spool',
		R: nsIng('#c:rods/iron'), C: 'createaddition:capacitor'
	}, 'electric_motor')
	mc('create_radar:radar_bearing', [' E ', 'BAB', ' M '],
		{ E: 'create:electron_tube', B: nsIng('#c:plates/iron'), A: 'create:mechanical_bearing', M: 'create_new_age:magnetite_block' }, 'radar_bearing')

	// ---------------- 4. Серный источник ----------------
	event.recipes.create.crushing(['2x tfmg:sulfur_dust', CreateItem.of('tfmg:sulfur_dust', 0.5)], 'nightshift:sulfur_crust').id('nightshift:outposts/sulfur_crust_crushing')
	// сера Незера (блоки TFMG, жила бура) — только переплавить в жидкую серу; порошок из неё — у Серного источника
	event.recipes.create.mixing(Fluid.of('nightshift:liquid_sulfur', 250), ['tfmg:sulfur']).heated().id('nightshift:outposts/liquid_sulfur_from_nether')
	// оружейный порох: сера + порох + древесный уголь → 3 (тег c:gunpowders — патроны Gunsmithing, заряды и гильзы CBC)
	event.recipes.create.mixing('3x nightshift:smokeless_powder', [nsIng('#c:dusts/sulfur'), 'minecraft:gunpowder', 'minecraft:charcoal'])
		.id('nightshift:outposts/smokeless_powder')

	// ---------------- 5. Кварцевый карьер ----------------
	event.custom({ type: 'minecraft:blasting', ingredient: { item: 'nightshift:quartz_sand' }, result: { id: 'nightshift:quartz_glass' }, experience: 0.1, cookingtime: 100 })
		.id('nightshift:outposts/quartz_glass')
	// линза: шлифовка наждачкой (деплоер с наждачной бумагой над конвейером)
	event.custom({ type: 'create:sandpaper_polishing', ingredients: [{ item: 'nightshift:quartz_glass' }], results: [{ id: 'nightshift:lens' }] })
		.id('nightshift:outposts/lens')
	mc('create_new_age:basic_solar_heating_plate', ['GGG', 'IPI', 'IPI'],
		{ G: 'nightshift:quartz_glass', I: nsIng('#c:ingots/iron'), P: 'create_new_age:heat_pipe' }, 'basic_solar_heating_plate')
	mc('create_new_age:advanced_solar_heating_plate', ['GGG', 'IPI', 'IPI'],
		{ G: 'nightshift:quartz_glass', I: 'create_new_age:overcharged_iron', P: 'create_new_age:heat_pipe' }, 'advanced_solar_heating_plate')
	mc('northstar:solar_panel', ['GGG', 'GGG', ' S ', 'TCT', 'TST'],
		{ G: 'nightshift:quartz_glass', S: 'create:shaft', T: nsIng('#c:plates/titanium'), C: 'northstar:circuit' }, 'solar_panel')
	mc('minecraft:spyglass', ['L', 'C', 'C'], { L: 'nightshift:lens', C: nsIng('#c:ingots/copper') }, 'spyglass')
	mc('northstar:telescope', ['LBB', ' S ', 'S S'], { L: 'nightshift:lens', B: nsIng('#c:ingots/brass'), S: 'minecraft:stick' }, 'telescope')
	mc('create_radar:binoculars', ['L L', 'C C', ' S '], { L: 'nightshift:lens', C: nsIng('#c:ingots/copper'), S: 'minecraft:string' }, 'binoculars')
	mc('immersive_aircraft:gyroscope_hud', ['NPN', 'ILI', 'SGV'], {
		N: 'minecraft:gold_nugget', P: 'nightshift:quartz_glass', I: 'minecraft:gold_ingot', L: 'minecraft:redstone_lamp',
		S: 'minecraft:note_block', G: 'immersive_aircraft:gyroscope', V: 'minecraft:lever'
	}, 'gyroscope_hud')
	// кабины самолётов Immersive Aircraft — кварцевое стекло
	mc('immersive_aircraft:biplane', ['HGH', 'HEP'],
		{ H: 'immersive_aircraft:hull', G: 'nightshift:quartz_glass', E: 'immersive_aircraft:engine', P: 'immersive_aircraft:propeller' }, 'biplane')
	mc('immersive_aircraft:gyrodyne', ['SGS', 'HPH'],
		{ S: 'immersive_aircraft:sail', G: 'nightshift:quartz_glass', H: 'immersive_aircraft:hull', P: 'immersive_aircraft:propeller' }, 'gyrodyne')
	mc('immersive_aircraft:quadrocopter', ['PBP', 'GEG', 'PBP'],
		{ P: 'immersive_aircraft:propeller', B: 'minecraft:bamboo', G: 'nightshift:quartz_glass', E: 'immersive_aircraft:engine' }, 'quadrocopter')

	// ---------------- 6. Бокситовый карьер ----------------
	event.recipes.create.crushing(['create:crushed_raw_aluminum', CreateItem.of('create:crushed_raw_aluminum', 0.5),
		CreateItem.of('tfmg:bauxite_powder', 0.25)], 'tfmg:bauxite').id('nightshift:outposts/bauxite_crushing')
	event.custom({ type: 'minecraft:smelting', ingredient: { item: 'create:crushed_raw_aluminum' }, result: { id: 'tfmg:aluminum_ingot' }, experience: 0.1, cookingtime: 200 })
		.id('nightshift:outposts/aluminum_smelting')
	event.custom({ type: 'minecraft:blasting', ingredient: { item: 'create:crushed_raw_aluminum' }, result: { id: 'tfmg:aluminum_ingot' }, experience: 0.1, cookingtime: 100 })
		.id('nightshift:outposts/aluminum_blasting')
	event.recipes.create.splashing(['10x tfmg:aluminum_nugget', CreateItem.of('tfmg:bauxite_powder', 0.1)], 'create:crushed_raw_aluminum')
		.id('nightshift:outposts/aluminum_splashing')
	var alu = nsIng('#c:plates/aluminum')
	mc('immersive_aircraft:hull', ['LLL', 'AAA', 'LLL'], { L: nsIng('#minecraft:logs'), A: alu }, 'hull')
	mc('immersive_aircraft:propeller', ['ASA'], { A: alu, S: 'create:shaft' }, 'propeller')
	mc('immersive_aircraft:enhanced_propeller', ['APA'], { A: nsIng('#c:ingots/aluminum'), P: 'immersive_aircraft:propeller' }, 'enhanced_propeller')
	mc('immersive_aircraft:sail', ['CCA', 'CCS', 'CCA'], { C: 'minecraft:white_carpet', A: alu, S: 'minecraft:string' }, 'sail')
	mc('2x aeronautics:smart_propeller', ['P', 'G', 'A', 'B'],
		{ P: 'create:propeller', G: 'simulated:gyroscopic_mechanism', A: alu, B: 'create:brass_casing' }, 'smart_propeller')
	mc('aeronautics:gyroscopic_propeller_bearing', ['W', 'G', 'A', 'B'],
		{ W: nsIng('#minecraft:wooden_slabs'), G: 'simulated:gyroscopic_mechanism', A: alu, B: 'create:brass_casing' }, 'gyroscopic_propeller_bearing')

	// ---------------- 7. Высотный конденсатор ----------------
	event.recipes.create.mixing(Fluid.of('nightshift:helium', 250), ['nightshift:helium_frost']).heated().id('nightshift:outposts/helium')
	event.custom({ type: 'create:filling', ingredients: [{ tag: 'c:plates/iron' }, nsOpFluid('nightshift:helium', 250)], results: [{ id: 'nightshift:helium_canister' }] })
		.id('nightshift:outposts/helium_canister')
	// оболочки аэростатов Aeronautics: шерсть + баллон гелия → 4 (деплоер); перекраска — как раньше (промывка → белая)
	NS_OP_COLORS.forEach(function (c) {
		event.custom({ type: 'create:deploying', ingredients: [{ item: 'minecraft:' + c + '_wool' }, { item: 'nightshift:helium_canister' }],
			results: [{ id: 'aeronautics:' + c + '_envelope', count: 4 }] }).id('nightshift:outposts/envelope_' + c)
	})
	// левитит: гелий вместо воды
	event.custom({ type: 'create:mixing', heat_requirement: 'heated', ingredients: [
		{ item: 'aeronautics:end_stone_powder' }, { item: 'aeronautics:end_stone_powder' }, { item: 'aeronautics:end_stone_powder' },
		{ item: 'aeronautics:end_stone_powder' }, { item: 'create:zinc_nugget' }, { item: 'create:zinc_nugget' }, nsOpFluid('nightshift:helium', 500)
	], results: [{ id: 'aeronautics:levitite_blend', amount: 500 }] }).id('nightshift:outposts/levitite_blend')
	// дирижабль Immersive Aircraft: 2 баллона гелия в оболочке (грузовой и боевой собираются из него)
	mc('immersive_aircraft:airship', ['SCS', 'SCS', 'HHE'],
		{ S: 'immersive_aircraft:sail', C: 'nightshift:helium_canister', H: 'immersive_aircraft:hull', E: 'immersive_aircraft:engine' }, 'airship')

	// ---------------- 8. Ледник ----------------
	event.recipes.create.mixing(Fluid.of('nightshift:coolant', 500), ['nightshift:cryo_crystal', Fluid.of('minecraft:water', 250)]).id('nightshift:outposts/coolant')
	event.custom({ type: 'create:filling', ingredients: [{ tag: 'c:plates/copper' }, nsOpFluid('nightshift:coolant', 250)], results: [{ id: 'nightshift:radiator' }] })
		.id('nightshift:outposts/radiator')
	event.custom({ type: 'create:mixing', ingredients: [
		{ item: 'create_new_age:reactor_casing' }, { item: 'create_new_age:reactor_casing' },
		{ item: 'create_new_age:heat_pipe' }, { item: 'create_new_age:heat_pipe' }, nsOpFluid('nightshift:coolant', 500)
	], results: [{ id: 'create_new_age:reactor_heat_vent' }] }).id('nightshift:outposts/reactor_heat_vent')
	mc('2x create_new_age:reactor_rod', ['CPRPC', ' GFG ', ' GFG ', 'CPRPC'], {
		C: 'create_new_age:reactor_casing', P: nsIng('#c:plates/gold'), R: 'nightshift:radiator',
		G: 'create_new_age:reactor_glass', F: 'create_new_age:nuclear_fuel'
	}, 'reactor_rod')
	mc('createdieselgenerators:large_diesel_engine', [' R ', 'SDS', ' B '], {
		R: 'nightshift:radiator', S: nsIng('#c:plates/brass'), D: 'createdieselgenerators:diesel_engine', B: 'minecraft:polished_blackstone_slab'
	}, 'large_diesel_engine')
	mc('createdieselgenerators:huge_diesel_engine', ['RFR', 'SES', 'PBP'], {
		R: 'nightshift:radiator', F: 'minecraft:flint_and_steel', S: nsIng('#c:plates/brass'), E: 'create:steam_engine',
		P: 'create:fluid_pipe', B: nsIng('#c:storage_blocks/brass')
	}, 'huge_diesel_engine')
	mc('tfmg:large_engine', [' R ', ' B ', 'AOA', 'SCS', 'STS', 'HHH'], {
		R: 'nightshift:radiator', B: nsIng('#c:ingots/aluminum'), A: alu, O: nsIng('#c:ingots/steel'),
		S: 'tfmg:steel_mechanism', C: 'tfmg:heavy_machinery_casing', T: 'tfmg:steel_fluid_tank', H: 'tfmg:heavy_plate'
	}, 'large_engine')

	// ---------------- 9. Торфяник ----------------
	// активированный уголь: вентилятор через огонь (копчение) или коптильня
	event.custom({ type: 'minecraft:smoking', ingredient: { item: 'nightshift:peat' }, result: { id: 'nightshift:activated_carbon' }, experience: 0.1, cookingtime: 100 })
		.id('nightshift:outposts/activated_carbon')
	event.recipes.create.compacting('nightshift:air_filter', ['2x nightshift:activated_carbon', 'minecraft:paper', nsIng('#c:nuggets/iron')])
		.id('nightshift:outposts/air_filter')
	mc('northstar:oxygen_filler', ['TCT', 'TST', 'IFI'], {
		T: nsIng('#c:plates/titanium'), C: 'northstar:circuit', S: 'northstar:oxygen_separator', I: nsIng('#c:plates/iron'), F: 'nightshift:air_filter'
	}, 'oxygen_filler')
	mc('northstar:iron_space_suit_helmet', ['GGG', 'GAG', 'IFI'],
		{ G: 'minecraft:tinted_glass', A: 'minecraft:iron_helmet', I: nsIng('#c:plates/iron'), F: 'nightshift:air_filter' }, 'iron_space_suit_helmet')
	mc('northstar:martian_steel_space_suit_helmet', ['GGG', 'GAG', 'IFI'],
		{ G: 'minecraft:tinted_glass', A: 'northstar:martian_steel_helmet', I: nsIng('#c:plates/martian_steel'), F: 'nightshift:air_filter' }, 'martian_steel_space_suit_helmet')
	mc('northstar:iron_space_suit_chestpiece', ['ICI', 'FAF', 'IXI'], {
		I: nsIng('#c:plates/iron'), C: 'create:copper_backtank', F: 'northstar:durable_fabric', A: 'minecraft:iron_chestplate', X: 'nightshift:air_filter'
	}, 'iron_space_suit_chestpiece')
	mc('northstar:martian_steel_space_suit_chestpiece', ['ICI', 'FAF', 'IXI'], {
		I: nsIng('#c:plates/martian_steel'), C: 'create:copper_backtank', F: 'northstar:durable_fabric', A: 'northstar:martian_steel_chestplate',
		X: 'nightshift:air_filter'
	}, 'martian_steel_space_suit_chestpiece')
	mc('create_submarine:oxygene_diffuser', ['FPF', 'LNL', 'EDE'], {
		F: 'nightshift:air_filter', P: 'create:propeller', L: 'create:redstone_link', N: 'create:nozzle', E: 'create:electron_tube', D: 'create:item_drain'
	}, 'oxygene_diffuser')
	mc('createbigcannons:gas_mask', [' L ', 'LGL', ' F '],
		{ L: 'minecraft:leather', G: nsIng('#createbigcannons:glass'), F: 'nightshift:air_filter' }, 'gas_mask')

	// ---------------- 10. Грибные пещеры ----------------
	event.recipes.create.milling(['3x nightshift:spores', CreateItem.of('minecraft:glowstone_dust', 0.25)], 'nightshift:glowcap').id('nightshift:outposts/spores')
	// успокоительное и настойка жизни — в sanity/10_sedative.js и sanity/40_death.js (там же их рецепты)

	// ---------------- 11. Обсерватория ----------------
	nsOpSeq(event, 'nightshift:outposts/star_chart', { item: 'minecraft:paper' }, 'nightshift:incomplete_star_chart', 1, { id: 'nightshift:star_chart' },
		[['deploy', { item: 'nightshift:stardust' }], ['deploy', { item: 'minecraft:glow_ink_sac' }], ['press']])
	mc('northstar:interplanetary_navigator', ['SLS', 'CLC', 'SLS', 'CLC', 'SLS', 'X#X'], {
		S: nsIng('#c:plates/titanium'), L: 'northstar:polished_lunar_sapphire', C: 'northstar:circuit', X: 'nightshift:star_chart', '#': 'northstar:targeting_computer'
	}, 'interplanetary_navigator')
	// компьютер наведения Northstar: в каждом круге сборки — звёздная карта
	var tc = 'northstar:unfinished_targeting_computer'
	nsOpSeq(event, 'nightshift:outposts/targeting_computer', { tag: 'c:plates/iron' }, tc, 2, { id: 'northstar:targeting_computer' }, [
		['deploy', { item: 'northstar:polished_diamond' }],
		['deploy', { item: 'northstar:hardened_precision_mechanism' }],
		['raw', { type: 'northstar:engraving', ingredients: [{ item: tc }], processing_time: 50, results: [{ id: tc }] }],
		['deploy', { item: 'northstar:circuit' }],
		['deploy', { item: 'nightshift:star_chart' }],
		['raw', { type: 'northstar:engraving', ingredients: [{ item: tc }], processing_time: 50, results: [{ id: tc }] }]
	])
})

// оружейный порох — единственный «порох» для патронов и зарядов (Gunsmithing ест тег c:gunpowders, CBC — свой тег,
// в который входит c:gunpowders). Ванильный порох остаётся для ТНТ, фейерверков и гранат
ServerEvents.tags('item', function (event) {
	event.removeAll('c:gunpowders')
	event.add('c:gunpowders', 'nightshift:smokeless_powder')
	event.add('c:dusts/magnetite', 'nightshift:magnetite_dust')
})

// --------------------------------------------------------------------------
// Подсочка гевеи: нож в руке (или в деплоере Create) → ПКМ по стволу, стоящему на латеритной почве
// месторождения (до NS_OP_TAP_HEIGHT стволов вверх). Деплоер отдаёт латекс в свой инвентарь — забирай воронкой.
// Нативное событие с приоритетом highest: ПКМ деплоера по стволу кто-то из модов отменяет раньше, чем его увидит
// BlockEvents.rightClicked (проверено на тестовом сервере 04.10). Исключение тут роняет сервер — всё в try.
// --------------------------------------------------------------------------
var NS_OP_TAPPED = {}
var NS_OP_RCB = Java.loadClass('net.neoforged.neoforge.event.entity.player.PlayerInteractEvent$RightClickBlock')

NativeEvents.onEvent('highest', NS_OP_RCB, function (event) {
	try {
		var level = event.getLevel()
		if (level.isClientSide()) return
		var block = level.getBlock(event.getPos())
		if (String(block.getId()) !== 'nightshift:hevea_log') return
		if (String(event.getItemStack().getId()) !== 'nightshift:tapping_knife') return
		event.setCanceled(true)
		if (String(event.getHand()) === 'MAIN_HAND') nsOpTap(level, block, event.getEntity())
	} catch (e) {
		console.warn('[форпосты] подсочка: ' + e)
	}
})

function nsOpTap(level, block, player) {
	var b = block
	var onSoil = false
	for (var i = 0; i < NS_OP_TAP_HEIGHT; i++) {
		var below = b.getDown()
		var id = String(below.getId())
		if (id === 'nightshift:hevea_soil') {
			onSoil = true
			break
		}
		if (id !== 'nightshift:hevea_log') break
		b = below
	}
	if (!onSoil) {
		if (player.setStatusMessage) player.setStatusMessage(Text.red('Гевея даёт латекс, только если растёт на латеритной почве месторождения (джунгли)'))
		return
	}
	var key = String(block.getDimension()) + ' ' + block.getX() + ' ' + block.getY() + ' ' + block.getZ()
	var now = Date.now()
	if (NS_OP_TAPPED[key] && now - NS_OP_TAPPED[key] < NS_OP_TAP_COOLDOWN) return
	NS_OP_TAPPED[key] = now
	player.give(Item.of('nightshift:latex', Math.random() < 0.25 ? 2 : 1))
	level.spawnParticles('minecraft:falling_honey', true, block.getX() + 0.5, block.getY() + 0.5, block.getZ() + 0.5, 0.3, 0.2, 0.3, 3, 0)
}

// --------------------------------------------------------------------------
// /outposts_scan <тип> <x> <z> <радиус> — админ: сколько месторождений в квадрате и где ближайшее
// (проверка частоты генерации; чанки должны быть сгенерированы — например, Chunky). Сервер ждёт скан целиком:
// не запускать пачкой — десяток подряд в одном тике роняет сервер сторожем (проверено 04.10)
// --------------------------------------------------------------------------
var NS_OP_SCAN = {
	hevea: ['nightshift:hevea_soil'], hevea_tree: ['nightshift:hevea_log'], salt: ['nightshift:salt_deposit'], magnet: ['nightshift:magnetic_anomaly'],
	sulfur: ['nightshift:sulfur_spring', -64, 200], quartz: ['nightshift:quartz_vein'], bauxite: ['nightshift:bauxite_deposit'],
	helium: ['nightshift:helium_ice'], glacier: ['nightshift:permafrost'], peat: ['nightshift:peat_bog'],
	spores: ['nightshift:mycelium_vein', -56, 140], star: ['nightshift:star_stone']
}

function nsOpScan(ctx, type, cx, cz, radius) {
	var spec = NS_OP_SCAN[type]
	if (!spec) {
		ctx.source.sendSystemMessage(Text.red('Типы: ' + Object.keys(NS_OP_SCAN).join(', ')))
		return 0
	}
	var level = ctx.source.getLevel()
	var BlockPos = Java.loadClass('net.minecraft.core.BlockPos')
	var HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
	var target = Block.getBlock(spec[0])
	var pos = new BlockPos.MutableBlockPos()
	var cells = {}
	var best = null
	var deep = spec.length > 1
	// команда тяжёлая (весь сервер ждёт): глубокий скан — до ±96, поверхностный — до ±256; по одной за раз
	radius = Math.min(radius, deep ? 96 : 256)
	// чанк грузим явно: level.getHeight у выгруженного чанка отдаёт дно мира
	for (var chx = (cx - radius) >> 4; chx <= (cx + radius) >> 4; chx++) {
		for (var chz = (cz - radius) >> 4; chz <= (cz + radius) >> 4; chz++) {
			var chunk = level.getChunk(chx, chz)
			for (var lx = 0; lx < 16; lx++) {
				for (var lz = 0; lz < 16; lz++) {
					var x = chx * 16 + lx, z = chz * 16 + lz
					if (Math.abs(x - cx) > radius || Math.abs(z - cz) > radius) continue
					var top = chunk.getHeight(HM.MOTION_BLOCKING_NO_LEAVES, lx, lz)
					var y1 = deep ? Math.min(spec[2], top) : top
					var y0 = deep ? spec[1] : top - 4
					for (var y = y1; y >= y0; y--) {
						pos.set(x, y, z)
						if (chunk.getBlockState(pos).getBlock() == target) {
							cells[chx + ',' + chz] = true
							var d = Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz))
							if (!best || d < best.d) best = { x: x, y: y, z: z, d: d }
							break
						}
					}
				}
			}
		}
	}
	var n = Object.keys(cells).length
	var msg = '[форпосты] ' + type + ': чанков с месторождением ' + n + ' в квадрате ±' + radius
	if (best) msg += ', ближайшее ' + best.x + ' ' + best.y + ' ' + best.z + ' (' + Math.round(best.d) + ' бл.)'
	ctx.source.sendSystemMessage(Text.gold(msg))
	console.info(msg)
	return 1
}

ServerEvents.commandRegistry(function (event) {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('outposts_scan')
			.requires(function (s) { return s.hasPermission(2) })
			.then(C.argument('type', A.STRING.create(event))
				.then(C.argument('x', A.INTEGER.create(event))
					.then(C.argument('z', A.INTEGER.create(event))
						.then(C.argument('radius', A.INTEGER.create(event))
							.executes(function (ctx) {
								try {
									return nsOpScan(ctx, String(A.STRING.getResult(ctx, 'type')), Number(A.INTEGER.getResult(ctx, 'x')),
										Number(A.INTEGER.getResult(ctx, 'z')), Number(A.INTEGER.getResult(ctx, 'radius')))
								} catch (e) {
									ctx.source.sendSystemMessage(Text.red('[форпосты] ошибка: ' + e))
									return 0
								}
							})))))
	)
})
