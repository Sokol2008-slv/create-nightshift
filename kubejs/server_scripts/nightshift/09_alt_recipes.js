// ==========================================================================
// Ночная смена — альтернативные рецепты базовых ресурсов, у которых в сборке
// нет второго пути (кожа — только разборка брони, соты — никак, мёд — только из ульев).
// Всё через машины Create, чтобы автоматизировалось.
// ==========================================================================

ServerEvents.recipes(event => {
	// Кожа: дубление гнилой плоти — нагретый миксер, 3 плоти + 100 мБ воды → 1 кожа
	event.recipes.create.mixing('minecraft:leather', ['3x minecraft:rotten_flesh', Fluid.of('minecraft:water', 100)]).heated().id('nightshift:alt/leather_tanning')

	// Мёд без ульев: 2 сахара + любой цветок + 250 мБ воды, нагрев → 250 мБ мёда
	// (мёд Create; в бутылки — спаутом, как обычно)
	event.recipes.create.mixing(Fluid.of('create:honey', 250), ['2x minecraft:sugar', '#minecraft:flowers', Fluid.of('minecraft:water', 250)]).heated().id('nightshift:alt/honey_from_sugar')

	// Соты: пресс по бассейну — 250 мБ мёда застывают в соты
	event.recipes.create.compacting('minecraft:honeycomb', [Fluid.of('create:honey', 250)]).id('nightshift:alt/honeycomb_compacting')
})

// Мёд — только механизмами: миксер (сахар + цветок + вода) или насос Create из улья.
// Бутылкой вручную из улья/гнезда набрать нельзя.
function nsHiveBottle(event) {
	if (String(event.getItem().getId()) !== 'minecraft:glass_bottle') return
	event.getPlayer().setStatusMessage(Text.gold('Мёд — только механизмами: миксер (сахар + цветок + вода, нагрев) или насос Create из улья'))
	event.cancel()
}
BlockEvents.rightClicked('minecraft:beehive', event => nsHiveBottle(event))
BlockEvents.rightClicked('minecraft:bee_nest', event => nsHiveBottle(event))
