// ==========================================================================
// Общие материалы второй фазы (04.10.2026) — источники делают свои потоки:
//  метеоритное железо — событие «Метеорит» (только полётом к кратеру);
//  небесный кристалл — небесные острова (y 180–260);
//  жетон смены — валюта факторий (заказы на доставку). Всё — EMC 0.
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:meteor_iron').texture('nightshift:item/meteor_iron').rarity('rare') // сырьё из кратера
	event.create('nightshift:meteor_iron_ingot').texture('nightshift:item/meteor_iron_ingot').rarity('rare')
	event.create('nightshift:sky_crystal').texture('nightshift:item/sky_crystal').rarity('epic').glow(true)
	event.create('nightshift:shift_token').texture('nightshift:item/shift_token').rarity('uncommon')
})
