// ==========================================================================
// Ночная смена — «Успокоительное»: рецепты и эффект.
// Рецепт: миксер Create — 6 таблеток из сахара, сладких ягод, цветка и целебных спор (форпост «Грибные пещеры»:
// грибные поля или пышные пещеры, 04.10). Без спор рассудок не лечится.
// Эффект: +SEDATIVE_RESTORE % рассудка через команду мода /sanity add.
// ==========================================================================

var SEDATIVE_RESTORE = 25

ServerEvents.recipes(event => {
	// только миксер (вручную нельзя — так интереснее)
	// форпосты (04.10): основа — целебные споры Грибных пещер (одна спора — 6 таблеток)
	event.recipes.create.mixing('6x nightshift:sedative', nsIngs(['minecraft:sugar', 'minecraft:sweet_berries', '#minecraft:small_flowers', 'nightshift:spores'])).id('nightshift:sedative_mixing')
})

ItemEvents.foodEaten('nightshift:sedative', event => {
	var entity = event.getEntity()
	if (!entity || !entity.isPlayer()) return
	// команда от сервера: у игрока-не-оператора нет прав на /sanity
	event.server.runCommandSilent('sanity add ' + entity.getUsername() + ' ' + SEDATIVE_RESTORE)
})
