// ==========================================================================
// «Вахта» — ресурсы на базе: «свой камень — свой металл».
// Разбор и таблица выходов — docs/VAHTA-ORES.md. Все id сверены с дампом
// (python3 tools/vahta_check_ids.py).
//
// Схема:
//   экструдер (вода/лава/блок металла + катализатор снизу) → порода
//   → дробление/помол → crushed_* / мука → промывка вентилятором → самородки + побочный продукт.
// Тиры (ось ускорения — катализатор под экструдером, аналог сжатия ×9/×81):
//   L0 — булыжник под экструдером, 4 удара на блок (старт, медленно, но работает);
//   L1 — куча дроблёной руды create_compressed (9 crushed), 2 удара;
//   L2 — блок сырой руды (9 raw — шахта/жила/ProjectE), 1 удар, только латунный экструдер.
// Скорость экструдера: удар = 200 / floor(1 + 59·RPM/512) тиков (32 RPM — 50 т, 256 RPM — 7 т).
// Сито — только подхват: металлы/самоцветы в ситах урезаны до четверти.
// Шахта — бонус: сырая руда из мира/жил дробится в 1,5 crushed, блок руды — в 2,5.
// ==========================================================================

var VAHTA_BONKS_SEED = 4
var VAHTA_BONKS_PILE = 2
var VAHTA_BONKS_RAW = 1
// доля металлов и самоцветов в ситах от исходной (createsifter)
var VAHTA_SIFT_RARE = 0.25

// рудная порода Create ← блок металла сбоку + лава; катализаторы тиров снизу
var VAHTA_ORE_ROCKS = [
	{ key: 'crimsite', rock: 'create:crimsite', metal: 'minecraft:iron_block', pile: 'create_compressed:crushed_iron_pile', raw: 'minecraft:raw_iron_block' },
	{ key: 'veridium', rock: 'create:veridium', metal: 'minecraft:copper_block', pile: 'create_compressed:crushed_copper_pile', raw: 'minecraft:raw_copper_block' },
	{ key: 'asurine', rock: 'create:asurine', metal: 'create:zinc_block', pile: 'create_compressed:crushed_zinc_pile', raw: 'create:raw_zinc_block' },
	{ key: 'ochrum', rock: 'create:ochrum', metal: 'minecraft:gold_block', pile: 'create_compressed:crushed_gold_pile', raw: 'minecraft:raw_gold_block' }
]

// обычные породы: вода + лава, катализатор — та же порода (затравка)
var VAHTA_SEED_ROCKS = ['minecraft:cobblestone', 'minecraft:andesite', 'minecraft:diorite', 'minecraft:granite', 'minecraft:tuff']

// нативные рецепты, которые заменяем (иначе два рецепта на один вход — Create берёт любой)
var VAHTA_REPLACED = [
	// экструдер: рудные породы требовали лазурит/призмарин/землю душ, породы — высоту 0..60
	'create_mechanical_extruder:extruding/crimsite',
	'create_mechanical_extruder:extruding/veridium',
	'create_mechanical_extruder:extruding/asurine',
	'create_mechanical_extruder:extruding/ochrum',
	'create_mechanical_extruder:extruding/cobblestone',
	'create_mechanical_extruder:extruding/andesite',
	'create_mechanical_extruder:extruding/diorite',
	'create_mechanical_extruder:extruding/granite',
	// промывка/дробление пород — новые выходы ниже
	'create:splashing/gravel',
	'create:splashing/red_sand',
	'create:crushing/diorite',
	'create:crushing/asurine',
	'create_copper_and_zinc:crushing_asurine',
	// шахта: сырая руда и блоки сырой руды
	'create:crushing/raw_iron',
	'create:crushing/raw_copper',
	'create:crushing/raw_gold',
	'create:crushing/raw_zinc',
	'create:crushing/raw_iron_block',
	'create:crushing/raw_copper_block',
	'create:crushing/raw_gold_block',
	'create:crushing/raw_zinc_block',
	'create:crushing/iron_ore',
	'create:crushing/deepslate_iron_ore',
	'create:crushing/gold_ore',
	'create:crushing/deepslate_gold_ore',
	'create:crushing/zinc_ore',
	'create:crushing/deepslate_zinc_ore'
]

// сита createsifter: [id исходного рецепта, вход, сетка, [[предмет, кол-во, шанс, редкий?], ...]]
// редкие (металлы, самоцветы, редстоун, светопыль) умножаются на VAHTA_SIFT_RARE
var VAHTA_SIFTS = [
	['createsifter:sifting/gravel_andesite', 'minecraft:gravel', 'createsifter:andesite_mesh', [
		['create:copper_nugget', 1, 0.3, true], ['create:zinc_nugget', 1, 0.4, true], ['minecraft:iron_nugget', 1, 0.4, true],
		['minecraft:gold_nugget', 1, 0.2, true], ['minecraft:coal', 1, 0.1, true], ['minecraft:flint', 1, 0.5, false]]],
	['createsifter:sifting/gravel_brass', 'minecraft:gravel', 'createsifter:brass_mesh', [
		['create:crushed_raw_copper', 1, 0.1, true], ['create:crushed_raw_zinc', 1, 0.1, true], ['create:crushed_raw_gold', 1, 0.05, true],
		['create:crushed_raw_iron', 1, 0.1, true], ['minecraft:lapis_lazuli', 1, 0.1, true], ['minecraft:coal', 1, 0.35, false],
		['minecraft:flint', 1, 0.1, false], ['minecraft:amethyst_shard', 1, 0.1, true], ['create:experience_nugget', 1, 0.1, false]]],
	['createsifter:sifting/gravel_advanced_brass', 'minecraft:gravel', 'createsifter:advanced_brass_mesh', [
		['create:crushed_raw_copper', 1, 0.2, true], ['create:crushed_raw_zinc', 1, 0.2, true], ['create:crushed_raw_gold', 1, 0.15, true],
		['create:crushed_raw_iron', 1, 0.25, true], ['minecraft:lapis_lazuli', 1, 0.2, true], ['minecraft:diamond', 1, 0.05, true],
		['minecraft:emerald', 1, 0.02, true], ['minecraft:amethyst_shard', 1, 0.15, true], ['create:experience_nugget', 1, 0.1, false]]],
	['createsifter:sifting/sand_andesite', 'minecraft:sand', 'createsifter:andesite_mesh', [
		['minecraft:redstone', 2, 0.1, true], ['minecraft:gold_nugget', 1, 0.15, true], ['minecraft:cactus', 1, 0.15, false],
		['minecraft:gunpowder', 1, 0.1, false], ['minecraft:bone', 1, 0.15, false], ['create:experience_nugget', 1, 0.1, false]]],
	['createsifter:sifting/sand_brass', 'minecraft:sand', 'createsifter:brass_mesh', [
		['minecraft:redstone', 2, 0.15, true], ['minecraft:blaze_powder', 1, 0.05, false], ['create:crushed_raw_gold', 1, 0.25, true],
		['minecraft:cactus', 1, 0.25, false], ['minecraft:gunpowder', 1, 0.15, false], ['minecraft:bone', 1, 0.25, false],
		['create:experience_nugget', 1, 0.2, false]]],
	['createsifter:sifting/dust_andesite', 'createsifter:dust', 'createsifter:andesite_mesh', [
		['minecraft:redstone', 2, 0.2, true], ['minecraft:glowstone_dust', 1, 0.1, true], ['minecraft:bone_meal', 1, 0.4, false],
		['minecraft:blaze_powder', 1, 0.01, false], ['create:experience_nugget', 1, 0.2, false]]],
	['createsifter:sifting/dust_brass', 'createsifter:dust', 'createsifter:brass_mesh', [
		['minecraft:redstone', 2, 0.35, true], ['minecraft:glowstone_dust', 1, 0.2, true], ['minecraft:bone_meal', 1, 0.6, false],
		['minecraft:blaze_powder', 1, 0.05, false], ['create:experience_nugget', 1, 0.2, false]]],
	['createsifter:sifting/crushed_netherrack_brass', 'createsifter:crushed_netherrack', 'createsifter:brass_mesh', [
		['createsifter:basalt_pebble', 1, 0.5, false], ['createsifter:blackstone_pebble', 1, 0.4, false], ['minecraft:gold_nugget', 1, 0.1, true],
		['minecraft:quartz', 1, 0.05, true], ['minecraft:blaze_powder', 1, 0.1, false], ['minecraft:netherite_scrap', 1, 0.01, false],
		['create:experience_nugget', 1, 0.1, false]]],
	['createsifter:sifting/crushed_netherrack_advanced_brass', 'createsifter:crushed_netherrack', 'createsifter:advanced_brass_mesh', [
		['createsifter:basalt_pebble', 1, 0.8, false], ['createsifter:blackstone_pebble', 1, 0.6, false], ['minecraft:gold_nugget', 1, 0.3, true],
		['minecraft:quartz', 1, 0.1, true], ['minecraft:blaze_powder', 1, 0.2, false], ['minecraft:netherite_scrap', 1, 0.02, false],
		['create:experience_nugget', 1, 0.4, false]]]
]

function vahtaExtrude(event, id, result, first, second, catalyst, bonks, advanced) {
	var json = {
		type: 'create_mechanical_extruder:extruding',
		blockIngredients: { first: { blocks: first }, second: { blocks: second } },
		result: { id: result },
		requiredBonks: bonks
	}
	if (catalyst) json.catalyst = { blocks: catalyst }
	if (advanced) json.advanced = true
	event.custom(json).id(id)
}

function vahtaSift(event, row) {
	var name = row[0].split('/').pop()
	var results = []
	row[3].forEach(function (r) {
		var chance = r[3] ? Math.max(0.01, Math.round(r[2] * VAHTA_SIFT_RARE * 1000) / 1000) : r[2]
		var out = { id: r[0], chance: chance }
		if (r[1] > 1) out.count = r[1]
		results.push(out)
	})
	event.custom({
		type: 'createsifter:sifting',
		input: { item: row[1] },
		mesh: { count: 1, id: row[2] },
		processingTime: 500,
		results: results
	}).id('vahta:sifting/' + name)
}

// crushed ×1,5 из сырой руды и ×2,5 из блока руды (тихое касание) — шахта выгоднее базы с блока
function vahtaMineCrush(event, id, input, crushed, xp, extra) {
	var outs = [Item.of(crushed, extra ? 2 : 1), CreateItem.of(crushed, 0.5), CreateItem.of(Item.of('create:experience_nugget', xp), 0.75)]
	if (extra) outs.push(CreateItem.of(extra, 0.125))
	event.recipes.create.crushing(outs, nsIng(input)).id(id)
}

ServerEvents.recipes(function (event) {
	VAHTA_REPLACED.forEach(function (id) { event.remove({ id: id }) })
	VAHTA_SIFTS.forEach(function (row) { event.remove({ id: row[0] }) })

	// --- экструдер: породы ------------------------------------------------------
	VAHTA_SEED_ROCKS.forEach(function (rock) {
		vahtaExtrude(event, 'vahta:extruding/' + rock.split(':')[1], rock, 'minecraft:water', 'minecraft:lava', rock, 1, false)
	})
	// незерак без Незера: лава с двух сторон над землёй душ (земля душ — haunting земли)
	vahtaExtrude(event, 'vahta:extruding/netherrack', 'minecraft:netherrack', 'minecraft:lava', 'minecraft:lava', 'minecraft:soul_soil', 2, false)

	// --- экструдер: рудные породы, три тира катализатора ----------------------------
	VAHTA_ORE_ROCKS.forEach(function (o) {
		vahtaExtrude(event, 'vahta:extruding/' + o.key + '_seed', o.rock, o.metal, 'minecraft:lava', 'minecraft:cobblestone', VAHTA_BONKS_SEED, false)
		vahtaExtrude(event, 'vahta:extruding/' + o.key + '_pile', o.rock, o.metal, 'minecraft:lava', o.pile, VAHTA_BONKS_PILE, false)
		vahtaExtrude(event, 'vahta:extruding/' + o.key + '_raw', o.rock, o.metal, 'minecraft:lava', o.raw, VAHTA_BONKS_RAW, true)
	})
	// дробление рудных пород — нативное Create (crimsite 40% crushed железа, veridium 80% меди,
	// ochrum 20% золота); asurine — плюс лазурит (синяя порода)
	event.recipes.create.crushing([CreateItem.of('create:crushed_raw_zinc', 0.3), CreateItem.of('create:zinc_nugget', 0.3), CreateItem.of('minecraft:lapis_lazuli', 0.15)], 'create:asurine').id('vahta:crushing/asurine')

	// --- T1: порода → мука → промывка (25% самородка + побочный) ------------------------
	// булыжник → жернов → гравий → промывка: железо + кремень
	event.recipes.create.splashing([CreateItem.of('minecraft:iron_nugget', 0.25), CreateItem.of('minecraft:flint', 0.25)], 'minecraft:gravel').id('vahta:splashing/gravel')
	// гранит → жернов → красный песок → промывка: медь + редстоун
	event.recipes.create.splashing([CreateItem.of('create:copper_nugget', 0.25), CreateItem.of('minecraft:redstone', 0.1)], 'minecraft:red_sand').id('vahta:splashing/red_sand')
	// диорит → дробилка: цинк + кварц
	event.recipes.create.crushing([CreateItem.of('create:zinc_nugget', 0.25), CreateItem.of('minecraft:quartz', 0.25)], 'minecraft:diorite').id('vahta:crushing/diorite')
	// незерак → дробилка → пепельная мука → промывка: золото + светопыль
	event.recipes.create.splashing([CreateItem.of('minecraft:gold_nugget', 0.25), CreateItem.of('minecraft:glowstone_dust', 0.05)], 'create:cinder_flour').id('vahta:splashing/cinder_flour')

	// --- алхимия вентилятора (haunting) ---------------------------------------------
	event.recipes.create.haunting([CreateItem.of('minecraft:glowstone_dust', 0.5)], 'minecraft:redstone').id('vahta:haunting/glowstone_dust')
	event.recipes.create.haunting([CreateItem.of('minecraft:ender_pearl', 0.25)], 'minecraft:slime_ball').id('vahta:haunting/ender_pearl')

	// --- самоцветы и прочее --------------------------------------------------------
	// аметист: кальцит + кварц + вода, нагрев
	event.recipes.create.mixing('2x minecraft:amethyst_shard', ['minecraft:calcite', 'minecraft:quartz', Fluid.of('minecraft:water', 100)]).heated().id('vahta:mixing/amethyst_shard')
	// алмаз: 3 угольных блока + обсидиановая пыль под перегревом (27 угля; у UF — 81 угля за 30%)
	event.recipes.create.compacting('minecraft:diamond', ['3x minecraft:coal_block', 'create:powdered_obsidian', Fluid.of('minecraft:lava', 250)]).superheated().id('vahta:compacting/diamond')
	// изумруд: алмаз под деплоером с изумрудом-затравкой (не тратится)
	event.recipes.create.deploying('minecraft:emerald', ['minecraft:diamond', 'minecraft:emerald']).keepHeldItem().id('vahta:deploying/emerald')
	// огненный порошок: угольный блок в лаве, нагрев (стержень — UF: 6 порошка в прессе)
	event.recipes.create.mixing('2x minecraft:blaze_powder', ['minecraft:coal_block', Fluid.of('minecraft:lava', 500)]).heated().id('vahta:mixing/blaze_powder')
	// слизь: костная мука + зелёный краситель + вода, или молоко + вода
	event.recipes.create.mixing('minecraft:slime_ball', ['minecraft:bone_meal', 'minecraft:green_dye', Fluid.of('minecraft:water', 250)]).id('vahta:mixing/slime_ball')
	event.recipes.create.mixing('minecraft:slime_ball', ['minecraft:bone_meal', Fluid.of('minecraft:milk', 250), Fluid.of('minecraft:water', 250)]).id('vahta:mixing/slime_ball_milk')
	// кость: 3 костной муки в прессе (мука — помол кальцита)
	event.recipes.create.compacting('minecraft:bone', ['3x minecraft:bone_meal']).id('vahta:compacting/bone')

	// --- шахта — бонус -------------------------------------------------------------
	vahtaMineCrush(event, 'vahta:crushing/raw_iron', '#c:raw_materials/iron', 'create:crushed_raw_iron', 1, null)
	vahtaMineCrush(event, 'vahta:crushing/raw_copper', '#c:raw_materials/copper', 'create:crushed_raw_copper', 1, null)
	vahtaMineCrush(event, 'vahta:crushing/raw_gold', '#c:raw_materials/gold', 'create:crushed_raw_gold', 2, null)
	vahtaMineCrush(event, 'vahta:crushing/raw_zinc', '#c:raw_materials/zinc', 'create:crushed_raw_zinc', 1, null)
	vahtaMineCrush(event, 'vahta:crushing/iron_ore', 'minecraft:iron_ore', 'create:crushed_raw_iron', 1, 'minecraft:cobblestone')
	vahtaMineCrush(event, 'vahta:crushing/deepslate_iron_ore', 'minecraft:deepslate_iron_ore', 'create:crushed_raw_iron', 1, 'minecraft:cobbled_deepslate')
	vahtaMineCrush(event, 'vahta:crushing/gold_ore', 'minecraft:gold_ore', 'create:crushed_raw_gold', 2, 'minecraft:cobblestone')
	vahtaMineCrush(event, 'vahta:crushing/deepslate_gold_ore', 'minecraft:deepslate_gold_ore', 'create:crushed_raw_gold', 2, 'minecraft:cobbled_deepslate')
	vahtaMineCrush(event, 'vahta:crushing/zinc_ore', 'create:zinc_ore', 'create:crushed_raw_zinc', 1, 'minecraft:cobblestone')
	vahtaMineCrush(event, 'vahta:crushing/deepslate_zinc_ore', 'create:deepslate_zinc_ore', 'create:crushed_raw_zinc', 1, 'minecraft:cobbled_deepslate')
	// блоки сырой руды: 13 + 50% ещё одна (≈ ×1,5 от 9)
	var vahtaRawBlocks = [
		['iron', '#c:storage_blocks/raw_iron', 'create:crushed_raw_iron'],
		['copper', '#c:storage_blocks/raw_copper', 'create:crushed_raw_copper'],
		['gold', '#c:storage_blocks/raw_gold', 'create:crushed_raw_gold'],
		['zinc', '#c:storage_blocks/raw_zinc', 'create:crushed_raw_zinc']
	]
	vahtaRawBlocks.forEach(function (b) {
		event.recipes.create.crushing([Item.of(b[2], 13), CreateItem.of(b[2], 0.5), CreateItem.of(Item.of('create:experience_nugget', 9), 0.75)], nsIng(b[1])).id('vahta:crushing/raw_' + b[0] + '_block')
	})

	// --- сито — только подхват ------------------------------------------------------
	VAHTA_SIFTS.forEach(function (row) { vahtaSift(event, row) })
})
