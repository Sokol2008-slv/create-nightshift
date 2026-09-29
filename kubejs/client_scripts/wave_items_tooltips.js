// Подсказки к наградам волн набега (см. startup_scripts/vahta/20_wave_items.js)
ItemEvents.modifyTooltips(event => {
	event.add('nightshift:lightning_charge', [
		Text.gold('Награда волны 15.'),
		Text.gray('Положи в деплоер Create — он бьёт молнией по меди: медный слиток → электрическая медь.'),
		Text.gray('Не изнашивается. Продаётся и покупается на столе трансмутации.')
	])
	event.add('nightshift:electric_copper', [
		Text.gray('Нужна для генераторов тока: катушки New Age, генератора C&A и генератора TFMG.'),
		Text.gray('Делается только деплоером с зарядом молнии — автоматизируй линию.')
	])
	event.add('nightshift:navigation_core', [
		Text.gold('Награда волны 50.'),
		Text.gray('Без него не собрать контроллер ракеты.')
	])
	event.add('nightshift:star_pickaxe', [
		Text.gold('Награда волны 70.'),
		Text.gray('Копает руды наших планет: аксиомит и стабилит.')
	])
})
