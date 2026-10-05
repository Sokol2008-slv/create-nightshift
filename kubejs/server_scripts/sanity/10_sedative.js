// ==========================================================================
// Ночная смена — «Успокоительное»: рецепты и эффект.
// Рецепт: миксер Create — 6 таблеток из сахара, сладких ягод, цветка и целебных спор (форпост «Грибные пещеры»:
// грибные поля или пышные пещеры, 04.10). Без спор рассудок не лечится.
// Эффект: +SEDATIVE_RESTORE % рассудка через команду мода /sanity add.
// Травяной чай (3.4.0) — ранняя замена без спор: +HERBAL_TEA_RESTORE % и короткая регенерация.
// ==========================================================================

var SEDATIVE_RESTORE = 25

ServerEvents.recipes(event => {
	// только миксер (вручную нельзя — так интереснее)
	// форпосты (04.10): основа — целебные споры Грибных пещер (одна спора — 6 таблеток)
	event.recipes.create.mixing('6x nightshift:sedative', nsIngs(['minecraft:sugar', 'minecraft:sweet_berries', '#minecraft:small_flowers', 'nightshift:spores'])).id('nightshift:sedative_mixing')
	// Травяной чай (3.4.0, аудит 05.10: «ранние таблетки без спор, слабее»): до форпоста «Грибные пещеры» —
	// миксер над любым нагревом, 2 цветка + листва + сахар + 250 мБ воды → 4 чашки, по +HERBAL_TEA_RESTORE % рассудка
	event.recipes.create.mixing('4x nightshift:herbal_tea', [nsIng('#minecraft:small_flowers'), nsIng('#minecraft:small_flowers'), nsIng('#minecraft:leaves'), nsIng('minecraft:sugar'), Fluid.of('minecraft:water', 250)]).heated().id('nightshift:herbal_tea_mixing')
})

var HERBAL_TEA_RESTORE = 8

ItemEvents.foodEaten('nightshift:herbal_tea', event => {
	var entity = event.getEntity()
	if (!entity || !entity.isPlayer()) return
	event.server.runCommandSilent('sanity add ' + entity.getUsername() + ' ' + HERBAL_TEA_RESTORE)
	event.server.runCommandSilent('effect give ' + entity.getUsername() + ' minecraft:regeneration 6 0 true')
})

ItemEvents.foodEaten('nightshift:sedative', event => {
	var entity = event.getEntity()
	if (!entity || !entity.isPlayer()) return
	// команда от сервера: у игрока-не-оператора нет прав на /sanity
	event.server.runCommandSilent('sanity add ' + entity.getUsername() + ' ' + SEDATIVE_RESTORE)
})
