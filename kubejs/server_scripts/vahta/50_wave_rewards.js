// ==========================================================================
// «Вахта» — награды волн набега в рецептах (Георгий, 30.09.2026). Предметы — startup_scripts/vahta/20_wave_items.js.
//  - Электрическая медь: деплоер с зарядом молнии бьёт по медному слитку. Заряд остаётся в руке.
//  - Генераторы тока — только с электрической медью: катушка New Age (миксер), генератор C&A
//    (механические крафтеры: медная катушка → электрическая медь), генератор TFMG (сборочная линия: магнит →
//    электрическая медь). Без заряда молнии с 15-й волны тока нет.
//  - Контроллер ракеты — с ядром навигации (награда 50-й волны) и 3 звёздными картами (форпост «Обсерватория», 04.10).
// ==========================================================================
var NS_TFMG_GENERATOR = {"type": "create:sequenced_assembly", "ingredient": {"item": "create:shaft"}, "loops": 3, "results": [{"chance": 120.0, "id": "tfmg:generator"}, {"chance": 8.0, "id": "tfmg:steel_casing"}, {"chance": 8.0, "id": "tfmg:steel_cogwheel"}, {"chance": 8.0, "id": "tfmg:capacitor_item"}], "sequence": [{"type": "create:deploying", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"item": "tfmg:capacitor_item"}], "results": [{"id": "tfmg:unfinished_generator"}]}, {"type": "create:deploying", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"tag": "c:plates/steel"}], "results": [{"id": "tfmg:unfinished_generator"}]}, {"type": "tfmg:winding", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"item": "tfmg:copper_spool"}], "processing_time": 75, "results": [{"id": "tfmg:unfinished_generator"}]}, {"type": "create:deploying", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"item": "nightshift:electric_copper"}], "results": [{"id": "tfmg:unfinished_generator"}]}, {"type": "create:deploying", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"item": "tfmg:steel_mechanism"}], "results": [{"id": "tfmg:unfinished_generator"}]}, {"type": "create:deploying", "ingredients": [{"item": "tfmg:unfinished_generator"}, {"item": "tfmg:screwdriver"}], "results": [{"id": "tfmg:unfinished_generator"}]}], "transitional_item": {"id": "tfmg:unfinished_generator"}}

ServerEvents.recipes(event => {
	event.recipes.create.deploying('nightshift:electric_copper', ['minecraft:copper_ingot', 'nightshift:lightning_charge'])
		.keepHeldItem()
		.id('nightshift:vahta/deploying/electric_copper')

	// катушка New Age: вместо 8 меди — 8 электрической меди. Исходный рецепт убираем по его id — тогда
	// tools/vahta_recipes.py не перенесёт его в миксер (10_machine_recipes.js) при перегенерации.
	// Рецепты, добавленные другим скриптом в том же событии, event.remove не видит — поэтому не по id «вахты».
	event.remove({ id: 'create_new_age:shaped/generator_coil' })
	event.recipes.create.mixing('create_new_age:generator_coil', ['8x nightshift:electric_copper', 'create:andesite_alloy_block'])
		.id('nightshift:vahta/mix/generator_coil_electric')

	// генератор C&A
	event.replaceInput({ id: 'createaddition:mechanical_crafting/alternator' }, 'createaddition:copper_spool', 'nightshift:electric_copper')

	// генератор TFMG — та же сборочная линия, но вместо магнита электрическая медь
	event.remove({ id: 'tfmg:sequenced_assembly/generator' })
	event.custom(NS_TFMG_GENERATOR).id('nightshift:vahta/tfmg_generator_electric')

	// контроллер ракеты: рычаги, ядро навигации, звёздные карты Обсерватории (форпост, 04.10), титан, схемы, промышленное железо
	event.remove({ id: 'northstar:mechanical_crafting/rocket_controls' })
	event.recipes.create.mechanical_crafting('northstar:rocket_controls', ['LNL', 'SSS', 'TTT', 'CCC', 'III'], {
		L: 'minecraft:lever',
		N: 'nightshift:navigation_core',
		S: 'nightshift:star_chart',
		T: nsIng('#c:plates/titanium'),
		C: 'northstar:circuit',
		I: 'create:industrial_iron_block'
	}).id('nightshift:vahta/rocket_controls_navigation')
})
