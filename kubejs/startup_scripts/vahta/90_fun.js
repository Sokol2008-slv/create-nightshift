// ==========================================================================
// «Развлечения смены» (05.10.2026, поток T): странствующий снабженец, гонки по кольцам, тир на арене.
// Логика — server_scripts/zabava/*.js, иконки — tools/gen_fun_items.py. Оба предмета — EMC 0.
//  - Маяк трассы: ПКМ в полёте — кольцо трассы там, где ты, по направлению взгляда; Shift+ПКМ — убрать последнее.
//    Деплоер: компас + ракета фейерверка (server_scripts/zabava/40_recipes.js).
//  - Ящик снабжения: только у снабженца; ПКМ — открыть (случайная добыча, таблица
//    data/nightshift/loot_table/trader/supply_crate.json).
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:race_beacon').texture('nightshift:item/race_beacon').maxStackSize(1).rarity('uncommon')
	event.create('nightshift:supply_crate').texture('nightshift:item/supply_crate').maxStackSize(16).rarity('rare')
})
