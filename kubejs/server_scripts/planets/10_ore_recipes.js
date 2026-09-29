// ==========================================================================
// Ночная смена — переработка аксиомита и стабилита (руды с планет Аксиоматив и Инь-Янь)
// Блоки и предметы: kubejs/startup_scripts/planets/10_ores.js
//
// Путь как у остальных металлов «Вахты» (docs/VAHTA-ORES.md, «Шахта — бонус»):
//   руда / сырьё → дробилка Create → дроблёная руда → вентилятор (обдув лавой/огнём) → слиток.
// Печь сырьё НЕ плавит (правило «печь руду не плавит», vahta/20_recipes.js): рецептов
// smelting/blasting для raw_* и *_ore здесь нет, только для crushed_raw_*.
// Шансы — как vahtaMineCrush: сырьё 1 + 50%, блок руды (тихое касание) 2 + 50%.
// ==========================================================================

var NS_PLANET_METAL_RECIPES = [
	{ metal: 'axiomite', ores: ['kubejs:axiomite_ore', 'kubejs:deepslate_axiomite_ore'], xp: 0.7 }
]

ServerEvents.recipes(function (event) {
	NS_PLANET_METAL_RECIPES.forEach(function (r) {
		var crushed = 'kubejs:crushed_raw_' + r.metal
		var ingot = 'kubejs:' + r.metal + '_ingot'
		var nugget = Item.of('create:experience_nugget', 1)

		event.recipes.create.crushing(
			[Item.of(crushed, 1), CreateItem.of(crushed, 0.5), CreateItem.of(nugget, 0.75)],
			'kubejs:raw_' + r.metal
		).id('nightshift:planets/crushing/raw_' + r.metal)

		r.ores.forEach(function (ore) {
			event.recipes.create.crushing(
				[Item.of(crushed, 2), CreateItem.of(crushed, 0.5), CreateItem.of(nugget, 0.75)],
				ore
			).id('nightshift:planets/crushing/' + ore.split(':')[1])
		})

		// вентилятор Create плавит по обычным рецептам печи (огонь — smelting, лава — blasting)
		event.smelting(ingot, crushed).xp(r.xp).id('nightshift:planets/smelting/' + r.metal + '_ingot')
		event.blasting(ingot, crushed).xp(r.xp).id('nightshift:planets/blasting/' + r.metal + '_ingot')
	})
})

// --------------------------------------------------------------------------
// Стабилит: слиток только из ДВУХ половинок — светлой (руда биома Ян) и тёмной (руда биома Инь).
// Единственный путь — межпланетное точило аддона (axiomativ:planetary_grinding).
// Печи/доменки/миксера/дробилки для сырья стабилита НЕТ: одна половинка в слиток не превращается.
// --------------------------------------------------------------------------
ServerEvents.recipes(function (event) {
	event.custom({
		type: 'axiomativ:planetary_grinding',
		ingredients: [
			{ item: 'kubejs:raw_light_stabilite' },
			{ item: 'kubejs:raw_dark_stabilite' }
		],
		results: [{ id: 'kubejs:stabilite_ingot', count: 1 }],
		processing_time: 300
	}).id('nightshift:planets/planetary_grinding/stabilite_ingot')
})
