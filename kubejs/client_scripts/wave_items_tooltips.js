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
	event.add('nightshift:tactical_nuke', [
		Text.gold('Оружие поздних волн (70+).'),
		Text.gray('ПКМ: все монстры в радиусе 48 блоков — насмерть, боссам −35 % здоровья.'),
		Text.gray('Блоки не ломает, своих не трогает. Перезарядка 60 с.')
	])
	event.add('nightshift:star_fragment', [
		Text.gold('Награда волны 70 (и редкая добыча Кошмара).'),
		Text.gray('Сердцевина Звёздной кирки: 3 межпланетных сплава + незеритовая кирка + осколок — механические крафтеры.'),
		Text.gray('Продаётся и покупается на столе трансмутации.')
	])
	event.add('nightshift:star_pickaxe', [
		Text.gold('Собирается с Звёздным осколком (веха 70-й волны).'),
		Text.gray('Копает руды наших планет: аксиомит и стабилит — другие инструменты и буры не добудут ничего.'),
		Text.gray('Прочность 2 500, скорость копания 10 (незеритовая — 2 031 и 9).')
	])
	event.add('nightshift:stabilite_pickaxe', [
		Text.gold('Кирка из металлов наших планет: 2 стабилита + аксиомит + 2 межпланетных сплава.'),
		Text.gray('Копает руды планет, как Звёздная, но прочность 6 000, скорость 14, урон выше, не горит в лаве.')
	])
	// сколько прочности осталось — видно без F3+H
	event.modify('nightshift:star_pickaxe', function (t) {
		t.dynamic('ns_durability')
	})
	event.modify('nightshift:stabilite_pickaxe', function (t) {
		t.dynamic('ns_durability')
	})
	event.add('nightshift:star_navigator', [
		Text.gray('Пропуск на планеты Аксиоматив и Инь-Янь: носи с собой в инвентаре при перелёте — у каждого пассажира.'),
		Text.gray('Ракета не полетит, пока навигатора нет у любого из пассажиров.')
	])
})

ItemEvents.dynamicTooltips('ns_durability', function (event) {
	var max = event.item.getMaxDamage()
	if (max <= 0) return
	var left = max - event.item.getDamageValue()
	var val = left + ' / ' + max
	event.add([Text.gray('Прочность: ').append(left * 4 < max ? Text.red(val) : Text.green(val))])
})
