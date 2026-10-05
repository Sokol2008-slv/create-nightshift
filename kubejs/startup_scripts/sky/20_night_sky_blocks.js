// ==========================================================================
// Ночное небо (3.4.0, 05.10.2026): звездопад. Логика — server_scripts/sky/40_night_sky.js,
// текстуры — tools/gen_starfall.py.
//
//  - fallen_star — упавшая звезда: светится, бьётся рукой. Своей добычи у блока нет (noDrops): осколки и пыль
//    выбивает скрипт (чтобы взрывы и буры не фармили), на рассвете несобранные звёзды гаснут.
//  - star_lamp — звёздный фонарь: стекло со звёздной пылью (nightshift:stardust, та же, что с «Обсерватории»), свет 15.
//  - star_shard — звёздный осколок, только со звездопада: 4 → небесный кристалл (пресс), «Сердце ночи» без набега.
// ==========================================================================
StartupEvents.registry('block', event => {
	event.create('nightshift:fallen_star')
		.texture('nightshift:block/fallen_star')
		.glassSoundType()
		.hardness(0.6)
		.resistance(1200)
		.lightLevel(1.0)
		.noDrops()
		.item(item => item.rarity('epic').glow(true))

	event.create('nightshift:star_lamp')
		.texture('nightshift:block/star_lamp')
		.glassSoundType()
		.hardness(0.3)
		.resistance(1)
		.lightLevel(1.0)
		.item(item => item.rarity('rare'))
})

StartupEvents.registry('item', event => {
	event.create('nightshift:star_shard').texture('nightshift:item/star_shard').rarity('rare').glow(true)
})
