// ==========================================================================
// Ночная смена — руды планет «Аксиоматив» и «Инь-Янь» (startup_scripts)
// KubeJS 2101.7.2 (MC 1.21.1 NeoForge). Правило Rhino: только var, без const/let.
//
// Блоки:
//   kubejs:axiomite_ore / kubejs:deepslate_axiomite_ore — аксиомит (Аксиоматив: туф и глубинный сланец)
//   kubejs:light_stabilite_ore / kubejs:dark_stabilite_ore — стабилит: светлая руда только в биоме Ян (на кальците),
//                                                          тёмная — только в биоме Инь (на чернокамне); см. docs/PLANETS.md
// Предметы: raw_axiomite/crushed_raw_axiomite/axiomite_ingot; у стабилита ДВА сырья
// (raw_light_stabilite, raw_dark_stabilite) и один stabilite_ingot — слиток только из обеих половин
// на межпланетном точиле (server_scripts/planets/10_ore_recipes.js), дроблёной руды у стабилита нет.
//
// Текстуры — kubejs/assets/kubejs/textures/{block,item}/<id>.png (tools/gen_planet_textures.py),
// KubeJS сам подставляет kubejs:block/<id> и kubejs:item/<id> и генерирует модели.
// Дроп руды: KubeJS генерирует таблицу «блок роняет сам себя», а наши файлы
// kubejs/data/kubejs/loot_table/blocks/*.json её перекрывают (пак kubejs/data идёт в списке
// датапаков ПОСЛЕ виртуального пака KubeJS — проверено по ServerScriptManager.createPackResources
// в kubejs-neoforge-2101.7.2). .noDrops() тут НЕЛЬЗЯ: он ставит блоку noLootTable() — не выпадет ничего.
// Рецепты переработки — kubejs/server_scripts/planets/10_ore_recipes.js.
// ==========================================================================

// [id, твёрдость, уровень инструмента]: камень-руда 3.0 как ванильная, глубинная 4.5
var NS_PLANET_ORES = [
	['kubejs:axiomite_ore', 3.0, 'minecraft:needs_iron_tool', 'axiomite'],
	['kubejs:deepslate_axiomite_ore', 4.5, 'minecraft:needs_iron_tool', 'axiomite'],
	['kubejs:light_stabilite_ore', 3.5, 'minecraft:needs_diamond_tool', 'light_stabilite'],
	['kubejs:dark_stabilite_ore', 5.0, 'minecraft:needs_diamond_tool', 'dark_stabilite']
]

var NS_PLANET_METALS = ['axiomite']
// стабилит: две половинки сырья (свет и тьма), общий слиток
var NS_STABILITE_RAWS = ['light_stabilite', 'dark_stabilite']

StartupEvents.registry('block', function (event) {
	NS_PLANET_ORES.forEach(function (o) {
		event.create(o[0])
			.stoneSoundType()
			.hardness(o[1])
			.resistance(3)
			.requiresTool(true)
			.tagBlock('minecraft:mineable/pickaxe')
			.tagBlock(o[2])
			.tagBoth('c:ores')
			.tagBoth('c:ores/' + o[3])
			.tagBoth('c:ores_in_ground/' + (o[0].indexOf('deepslate') >= 0 ? 'deepslate' : 'stone'))
	})
})

StartupEvents.registry('item', function (event) {
	NS_PLANET_METALS.forEach(function (m) {
		event.create('kubejs:raw_' + m)
			.tag('c:raw_materials')
			.tag('c:raw_materials/' + m)
		// дроблёная руда — как create:crushed_raw_*, плавится вентилятором (обдув лавой/огнём)
		event.create('kubejs:crushed_raw_' + m)
			.tag('create:crushed_raw_materials')
		event.create('kubejs:' + m + '_ingot')
			.tag('c:ingots')
			.tag('c:ingots/' + m)
	})
	NS_STABILITE_RAWS.forEach(function (m) {
		event.create('kubejs:raw_' + m)
			.tag('c:raw_materials')
			.tag('c:raw_materials/' + m)
	})
	event.create('kubejs:stabilite_ingot')
		.tag('c:ingots')
		.tag('c:ingots/stabilite')
	// титан Northstar: у мода нет дроблёного титана, а «Вахта» убрала переплавку сырого — без этого предмета
	// титан с планет было не переработать (найдено 30.09). Путь — server_scripts/planets/15_space_metals.js
	event.create('kubejs:crushed_raw_titanium')
		.tag('create:crushed_raw_materials')
		.tag('create:crushed_raw_materials/titanium')
})
