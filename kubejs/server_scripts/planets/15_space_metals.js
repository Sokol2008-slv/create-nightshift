// ==========================================================================
// Ночная смена — переработка титана и вольфрама Northstar по правилу «Вахты» (печь руду не плавит):
//   руда / сырьё → дробилка → дроблёная → вентилятор с водой (самородки) или обдув огнём/лавой (слиток).
// Зачем (30.09, найдено при переделке главы «Космос»): «Вахта» убрала переплавку сырого титана и вольфрама
// (vahta/20_recipes.js), а дробилка Northstar превращала титановую руду снова в СЫРОЙ титан — титан с планет
// и сырой вольфрам (буровая на Меркурии, добыча без шёлкового касания) было нечем переработать.
// Шансы — как vahtaMineCrush: сырьё 1 + 50 %, блок руды 2 + 50 %.
// ==========================================================================
var NS_TITANIUM_ORES = [
	'northstar:moon_titanium_ore', 'northstar:moon_deep_titanium_ore',
	'northstar:mars_titanium_ore', 'northstar:mars_deep_titanium_ore',
	'northstar:venus_titanium_ore', 'northstar:venus_deep_titanium_ore',
	'northstar:mercury_titanium_ore', 'northstar:mercury_deep_titanium_ore'
]

ServerEvents.recipes(function (event) {
	var xp = Item.of('create:experience_nugget', 1)
	var ti = 'kubejs:crushed_raw_titanium'
	// руда титана: сразу в дроблёную (у мода — снова в сырую)
	NS_TITANIUM_ORES.forEach(function (ore) {
		event.remove({ id: 'northstar:crushing/' + ore.split(':')[1] })
		event.recipes.create.crushing([Item.of(ti, 2), CreateItem.of(ti, 0.5), CreateItem.of(xp, 0.75)], ore)
			.id('nightshift:planets/crushing/' + ore.split(':')[1])
	})
	event.recipes.create.crushing([Item.of(ti, 1), CreateItem.of(ti, 0.5), CreateItem.of(xp, 0.75)], 'northstar:raw_titanium_ore')
		.id('nightshift:planets/crushing/raw_titanium_ore')
	event.recipes.create.splashing([Item.of('northstar:titanium_nugget', 9), CreateItem.of('minecraft:iron_nugget', 0.5)], ti)
		.id('nightshift:planets/splashing/crushed_raw_titanium')
	event.smelting('northstar:titanium_ingot', ti).xp(0.8).id('nightshift:planets/smelting/titanium_ingot')
	event.blasting('northstar:titanium_ingot', ti).xp(0.8).id('nightshift:planets/blasting/titanium_ingot')

	// сырой вольфрам: в дроблёный мода (дальше рецепты Northstar: промывка → 9 самородков, печь → слиток)
	event.recipes.create.crushing([Item.of('northstar:crushed_raw_tungsten', 1), CreateItem.of('northstar:crushed_raw_tungsten', 0.5), CreateItem.of(xp, 0.75)], 'northstar:raw_tungsten_ore')
		.id('nightshift:planets/crushing/raw_tungsten_ore')
})
