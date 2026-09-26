// ==========================================================================
// Ночная смена — Enhanced Hordes не ломает машины.
// Мод сносит блоки 3×2×3 вокруг толпы зомби, кроме тега forge:horde_unbreakable
// (в нём по умолчанию только ванильные «неломаемые» блоки). Добавляем туда все
// блоки с блок-сущностью (машины, валы, сундуки) и поднимаем порог сноса.
// Лазанье зомби друг по другу (hordeStacking) оставляем — это не про блоки.
// ==========================================================================

var NS_BLOCKS = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').BLOCK

ServerEvents.tags('block', event => {
	var tagged = 0
	NS_BLOCKS.forEach(block => {
		// hasBlockEntity() = «блок реализует EntityBlock» (ванильная проверка)
		if (block.defaultBlockState().hasBlockEntity()) {
			event.add('forge:horde_unbreakable', String(NS_BLOCKS.getKey(block)))
			tagged++
		}
	})
	console.info('[nightshift] forge:horde_unbreakable: +' + tagged + ' блоков с блок-сущностью')
})

ServerEvents.loaded(event => {
	event.server.runCommandSilent('gamerule hordeSmashingPower 999')
})
