// ==========================================================================
// Небо (04.10.2026): блоки метеорита и небесных островов, дроблёное метеоритное железо.
// Сырьё и слиток (meteor_iron, meteor_iron_ingot, sky_crystal) — vahta/27_phase2_materials.js.
// Текстуры — tools/gen_sky.py. Логика — server_scripts/sky/.
//
//  - meteor_ore — раскалённая метеоритная руда в кратере. Своей добычи у блока НЕТ (noDrops): долю метеоритного
//    железа каждому игроку в кратере выдаёт скрипт (кооператив, а не «кто первый»). Взрывом не берётся (1200),
//    пока стража жива — не ломается (щит). Через 20 минут остывает в камень.
//  - sky_crystal_cluster — друза небесного кристалла на островах: кирка (железная и лучше) → 1–3 кристалла.
//  - crushed_meteor_iron — промежуточный продукт: дробилка → миксер с нагревом → слиток.
// ==========================================================================
var NS_SKY_BLOCK_DROPS = Java.loadClass('dev.latvian.mods.kubejs.block.drop.BlockDrops')

StartupEvents.registry('block', event => {
	event.create('nightshift:meteor_ore')
		.texture('nightshift:block/meteor_ore')
		.stoneSoundType()
		.hardness(8)
		.resistance(1200)
		.lightLevel(0.8)
		.requiresTool(true)
		.tagBlock('minecraft:mineable/pickaxe')
		.tagBlock('minecraft:needs_iron_tool')
		.noDrops()
		.item(item => item.rarity('rare'))

	// одна запись на бросок: 1, 2, 2 или 3 кристалла (в среднем 2)
	event.create('nightshift:sky_crystal_cluster')
		.texture('nightshift:block/sky_crystal_cluster')
		.glassSoundType()
		.hardness(3)
		.resistance(6)
		.lightLevel(0.6)
		.requiresTool(true)
		.tagBlock('minecraft:mineable/pickaxe')
		.tagBlock('minecraft:needs_iron_tool')
		.drops(() => new NS_SKY_BLOCK_DROPS([Item.of('nightshift:sky_crystal', 1), Item.of('nightshift:sky_crystal', 2), Item.of('nightshift:sky_crystal', 2), Item.of('nightshift:sky_crystal', 3)], 1))
		.item(item => item.rarity('epic'))
})

StartupEvents.registry('item', event => {
	event.create('nightshift:crushed_meteor_iron').texture('nightshift:item/crushed_meteor_iron').rarity('rare')
})
