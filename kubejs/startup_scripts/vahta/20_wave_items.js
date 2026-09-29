// ==========================================================================
// «Вахта» — награды волн набега (Георгий, 30.09.2026: шкала волн 1–100, вехи 15/50/70/100).
//  - Заряд молнии (волна 15): кладётся в деплоер Create, бьёт по меди → электрическая медь.
//    Не изнашивается. Продаётся и покупается за EMC (economy: custom_emc.json).
//  - Электрическая медь: без неё не собрать генераторы тока (катушку New Age, генератор C&A,
//    генератор TFMG). Только автоматизацией — EMC 0.
//  - Ядро навигации (волна 50): без него не собрать контроллер ракеты.
//  - Звёздная кирка (волна 70): копает руды наших планет (аксиомит, стабилит).
// Рецепты — server_scripts/vahta/50_wave_rewards.js, выдача — raids/40_nightshift_raid.js.
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:lightning_charge')
		.texture('nightshift:item/lightning_charge')
		.maxStackSize(1)
		.rarity('epic')
		.glow(true)
	event.create('nightshift:electric_copper')
		.texture('nightshift:item/electric_copper')
	event.create('nightshift:navigation_core')
		.texture('nightshift:item/navigation_core')
		.maxStackSize(16)
		.rarity('rare')
		.glow(true)
	event.create('nightshift:star_pickaxe', 'pickaxe')
		.texture('nightshift:item/star_pickaxe')
		.tier('netherite')
		.rarity('epic')
})
