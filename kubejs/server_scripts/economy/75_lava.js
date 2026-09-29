// ==========================================================================
// Ферма лавы на машинах Create (Георгий, 29.09: «камень шлюзами гружу, лаву трубами откачиваю»).
// Бассейн + миксер + горелка на обычном топливе (уголь, дерево): камень воронкой/желобом в бассейн, лава —
// механическим насосом из бассейна по трубам. Отдельный мод-тигель не нужен — бассейн им и работает.
//   булыжник (c:cobblestones) → 100 мБ, незерак → 250 мБ, магмовый блок → 500 мБ
// Штатный рецепт Create (булыжник → 50 мБ на торте блейза) убран — иначе бассейн с сильным нагревом
// выбирал бы между двумя рецептами на один вход.
// ==========================================================================
ServerEvents.recipes(event => {
	event.remove({ id: 'create:mixing/lava_from_cobble' })
	event.recipes.create.mixing(Fluid.of('minecraft:lava', 100), nsIngs(['#c:cobblestones'])).heated().id('nightshift:economy/lava_from_cobblestone')
	event.recipes.create.mixing(Fluid.of('minecraft:lava', 250), ['minecraft:netherrack']).heated().id('nightshift:economy/lava_from_netherrack')
	event.recipes.create.mixing(Fluid.of('minecraft:lava', 500), ['minecraft:magma_block']).heated().id('nightshift:economy/lava_from_magma_block')
})
