// ==========================================================================
// Небо — переработка метеоритного железа (04.10.2026). По правилам «Вахты»: печь и вентилятор его НЕ плавят
// (рецептов smelting/blasting нет), только машины Create:
//   метеоритное железо → дробильные колёса → дроблёное (1 + 50 % ещё 1, + опыт)
//                      → жернов — медленнее и без бонуса (для тех, у кого колёс ещё нет)
//   2 дроблёного + 100 мБ лавы → миксер с НАГРЕВОМ (горелка блейза) → слиток метеоритного железа
// Выход: ~0,75 слитка с куска сырья на колёсах. Лава на «Вахте» — из бассейна с булыжником (economy/75_lava.js).
// ==========================================================================
ServerEvents.recipes(event => {
	var crushed = 'nightshift:crushed_meteor_iron'
	event.recipes.create
		.crushing([Item.of(crushed, 1), CreateItem.of(crushed, 0.5), CreateItem.of(Item.of('create:experience_nugget', 1), 0.75)], 'nightshift:meteor_iron')
		.id('nightshift:sky/crushing/meteor_iron')
	event.recipes.create.milling([Item.of(crushed, 1)], 'nightshift:meteor_iron').id('nightshift:sky/milling/meteor_iron')
	event.recipes.create
		.mixing('nightshift:meteor_iron_ingot', [Item.of(crushed, 2), Fluid.of('minecraft:lava', 100)])
		.heated()
		.id('nightshift:sky/mixing/meteor_iron_ingot')
})
