// ==========================================================================
// Ключевые предметы особых стадий (04.10.2026, raids/45_special_stages.js): даются за первое прохождение
// особой стадии и нужны для техники следующего уровня. Только из набегов — EMC 0.
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:coil_core').texture('nightshift:item/coil_core').maxStackSize(16).rarity('epic').glow(true) // Механоиды
	event.create('nightshift:afterburner_blueprint').texture('nightshift:item/afterburner_blueprint').maxStackSize(16).rarity('epic').glow(true) // Воздушный бой
	event.create('nightshift:otk_armor_plate').texture('nightshift:item/otk_armor_plate').maxStackSize(16).rarity('epic').glow(true) // Бронеколонна
	event.create('nightshift:runner_badge').texture('nightshift:item/runner_badge').maxStackSize(16).rarity('epic').glow(true) // Побег
	event.create('nightshift:spirit_essence').texture('nightshift:item/spirit_essence').maxStackSize(16).rarity('epic').glow(true) // Духи
	event.create('nightshift:queen_heart').texture('nightshift:item/queen_heart').maxStackSize(16).rarity('epic').glow(true) // Штурм гнезда
})
