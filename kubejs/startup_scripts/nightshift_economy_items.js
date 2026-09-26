// ==========================================================================
// Ночная смена — предметы рудной экономики:
//   nightshift:vein_seed_<тип> — зонд жилы (22 типа), ставит бесконечную жилу в чанке
//   nightshift:vein_cleaner    — очиститель жилы
//   nightshift:vein_scanner    — сканер жил (с P4): жила → знание зонда в ProjectE
// Логика — server_scripts/economy/. Названия — lang-файлы, иконки — свои PNG.
// Список типов держать в синхроне с NS_VEINS в server_scripts/economy/10_probes.js.
// ==========================================================================

var NS_PROBE_TYPES = [
	'coal', 'copper', 'iron', 'gold', 'zinc', 'redstone', 'lapis', 'diamond', 'emerald', 'quartz', 'glowstone', 'netherite', 'hardened_diamond',
	'lead', 'nickel', 'lithium', 'sulfur', 'platinum', 'thorium',
	'titanium', 'tungsten', 'martian_iron',
]

StartupEvents.registry('item', event => {
	for (var i = 0; i < NS_PROBE_TYPES.length; i++) {
		event.create('nightshift:vein_seed_' + NS_PROBE_TYPES[i]).texture('nightshift:item/vein_seed_' + NS_PROBE_TYPES[i]).maxStackSize(16)
	}
	event.create('nightshift:vein_cleaner').texture('nightshift:item/vein_cleaner').maxStackSize(16)
	event.create('nightshift:vein_scanner').texture('nightshift:item/vein_scanner').maxStackSize(1)
})
