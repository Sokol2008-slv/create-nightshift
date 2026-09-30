// ==========================================================================
// «Вахта» — награды волн набега (Георгий, 30.09.2026: шкала волн 1–100, вехи 15/50/70/100).
//  - Заряд молнии (волна 15): кладётся в деплоер Create, бьёт по меди → электрическая медь.
//    Не изнашивается. Продаётся и покупается за EMC (economy: custom_emc.json).
//  - Электрическая медь: без неё не собрать генераторы тока (катушку New Age, генератор C&A,
//    генератор TFMG). Только автоматизацией — EMC 0.
//  - Ядро навигации (волна 50): без него не собрать контроллер ракеты.
//  - Тактический ядерный заряд: оружие поздних волн (server_scripts/vahta/55_tactical_nuke.js).
//  - Звёздный осколок (волна 70): сердцевина Звёздной кирки. Сама кирка — механическими крафтерами:
//    3 межпланетных сплава + незеритовая кирка + осколок (Георгий, 30.09: «без 70-й волны кирку не собрать»).
//  - Звёздная кирка: копает руды наших планет (аксиомит, стабилит), прочность 2 500, скорость 10.
//  - Стабилитовая кирка — из металлов наших планет (стабилит, аксиомит, сплав): прочность 6 000, скорость 14,
//    не горит в лаве; тоже копает руды планет (Георгий: «кирка, которой добываем то, что нужно для её крафта, —
//    неинтересно»). Звёздный навигатор — пропуск на наши планеты. Рецепты — vahta/55_star_gate.js.
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
	// Тактический ядерный заряд (волны 70+): выносит монстров вокруг, боссам −35 % здоровья, блоки не ломает
	event.create('nightshift:tactical_nuke')
		.texture('nightshift:item/tactical_nuke')
		.maxStackSize(4)
		.rarity('epic')
		.glow(true)
	event.create('nightshift:star_fragment')
		.texture('nightshift:item/star_fragment')
		.maxStackSize(16)
		.rarity('epic')
		.glow(true)
	// незерит: прочность 2 031, скорость 9 — звёздная чуть лучше, стабилитовая — заметно
	event.create('nightshift:star_pickaxe', 'pickaxe')
		.texture('nightshift:item/star_pickaxe')
		.tier('netherite')
		.modifyTier(function (t) {
			t.setUses(2500)
			t.setSpeed(10)
		})
		.rarity('epic')
		.tag('nightshift:star_tools') // руды планет копаются только инструментом из этого тега (data/nightshift/tags/item/star_tools.json)
	event.create('nightshift:stabilite_pickaxe', 'pickaxe')
		.texture('nightshift:item/stabilite_pickaxe')
		.tier('netherite')
		.modifyTier(function (t) {
			t.setUses(6000)
			t.setSpeed(14)
			t.setAttackDamageBonus(5)
			t.setEnchantmentValue(22)
		})
		.rarity('epic')
		.fireResistant()
		.tag('nightshift:star_tools')
	// Звёздный навигатор: без него в инвентаре не попасть на планеты Аксиоматив и Инь-Янь
	// (server_scripts/vahta/55_star_gate.js). Не расходуется, достаточно носить с собой.
	event.create('nightshift:star_navigator')
		.texture('nightshift:item/star_navigator')
		.maxStackSize(1)
		.rarity('epic')
		.glow(true)
})
