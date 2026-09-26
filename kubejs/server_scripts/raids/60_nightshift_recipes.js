// ==========================================================================
// Ночная смена — рецепты разметчика и блока базы (доступны с P0: камень,
// дерево, кремень, древесный уголь — руды ещё спят).
// ==========================================================================

ServerEvents.recipes(event => {
	event.shapeless('nightshift:base_marker', ['minecraft:stick', 'minecraft:flint', '#minecraft:coals']).id('nightshift:base_marker')
	event.shaped('nightshift:base_core', [' F ', 'BCB', 'BBB'], {
		F: 'minecraft:campfire',
		C: 'minecraft:chiseled_stone_bricks',
		B: 'minecraft:stone_bricks',
	}).id('nightshift:base_core')
})
