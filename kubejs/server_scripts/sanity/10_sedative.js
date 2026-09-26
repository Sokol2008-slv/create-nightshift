// ==========================================================================
// Ночная смена — «Успокоительное»: рецепты и эффект.
// Рецепты: верстак — 1 таблетка (доступно с P0), миксер Create — 4 таблетки
// (автоматизация даёт ×4). Ингредиенты растут/добываются с первого дня.
// Эффект: +SEDATIVE_RESTORE % рассудка через команду мода /sanity add.
// ==========================================================================

var SEDATIVE_RESTORE = 25

ServerEvents.recipes(event => {
	event.shapeless('nightshift:sedative', ['minecraft:sugar', 'minecraft:sweet_berries', '#minecraft:small_flowers', 'minecraft:bone_meal']).id('nightshift:sedative_by_hand')
	event.recipes.create.mixing('4x nightshift:sedative', ['minecraft:sugar', 'minecraft:sweet_berries', '#minecraft:small_flowers', 'minecraft:bone_meal']).id('nightshift:sedative_mixing')
})

ItemEvents.foodEaten('nightshift:sedative', event => {
	var entity = event.getEntity()
	if (!entity || !entity.isPlayer()) return
	// команда от сервера: у игрока-не-оператора нет прав на /sanity
	event.server.runCommandSilent('sanity add ' + entity.getUsername() + ' ' + SEDATIVE_RESTORE)
})
