// ==========================================================================
// Ночная смена — «Успокоительное»: таблетка рассудка (Sanity: Renewed).
// Эффект (+рассудок) — в server_scripts/sanity/10_sedative.js.
// ==========================================================================

StartupEvents.registry('item', event => {
	event.create('nightshift:sedative')
		.texture('nightshift:item/sedative')
		.maxStackSize(16)
		.food(food => food.nutrition(1).saturation(0.1).alwaysEdible().fastToEat())
	// Настойка жизни: лечит одну рану (−1 сердце за смерть), см. server_scripts/sanity/40_death.js
	event.create('nightshift:life_tonic')
		.texture('nightshift:item/life_tonic')
		.maxStackSize(16)
		.food(food => food.nutrition(2).saturation(0.2).alwaysEdible())
})
