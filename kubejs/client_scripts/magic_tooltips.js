// ==========================================================================
// Магия (Iron's Spells, 01.10): подсказки к нашим посохам и к тому, как на вахте получить ресурсы мода.
// Предметы посохов — startup_scripts/vahta/60_staffs.js, действие — server_scripts/vahta/60_staffs.js,
// машинные рецепты мода — server_scripts/vahta/60_magic.js. Числа здесь — те же, что в NS_STAFF.
// ==========================================================================
ItemEvents.modifyTooltips(function (event) {
	event.add('nightshift:lightning_staff', [
		Text.gold('ПКМ: молния в точку взгляда (до 48 блоков) — в первого врага на луче или в блок.'),
		Text.gray('Врагам рядом с ударом 14 урона магией и поджог на 3 с. Базу не поджигает, своих не бьёт.'),
		Text.gray('Мана 10, перезарядка 1,5 с, прочность 400.')
	])
	event.add('nightshift:alloy_staff', [
		Text.gold('ПКМ: ударная волна вокруг себя, радиус 10.'),
		Text.gray('Каждому мобу набега и монстру: 30 урона магией, отброс и замедление II на 3 с.'),
		Text.gray('Мана 40, перезарядка 8 с, прочность 300.')
	])
	event.add('nightshift:balance_staff', [
		Text.gold('ПКМ: волна равновесия, радиус 12.'),
		Text.gray('Своим (игроки, големы, приручённые): +4 сердца, регенерация II на 5 с, тушит огонь.'),
		Text.gray('Врагам: 16 урона магией и слабость II на 5 с.'),
		Text.gray('Мана 50, перезарядка 10 с, прочность 500.')
	])
	event.add(['nightshift:lightning_staff', 'nightshift:alloy_staff', 'nightshift:balance_staff'], [
		Text.darkGray('Собирается механическими крафтерами. «Прочность» и «Починка» — книгами на наковальне.')
	])
	// строка «Прочность: N / M» — обработчик ns_durability в client_scripts/wave_items_tooltips.js
	var staffs = ['nightshift:lightning_staff', 'nightshift:alloy_staff', 'nightshift:balance_staff']
	for (var i = 0; i < staffs.length; i++) {
		event.modify(staffs[i], function (t) {
			t.dynamic('ns_durability')
		})
	}

	// ресурсы Iron's: где взять на вахте (в мире они есть только в сундуках и с магов)
	event.add('irons_spellbooks:arcane_essence', [
		Text.gray('Вахта: миксер с нагревом — лазурит + осколок аметиста + светопыль + самородок опыта.'),
		Text.gray('Ещё — добыча набегов с 1-й волны.')
	])
	event.add('irons_spellbooks:blank_rune', [
		Text.gray('Вахта: деплоер с эссенцией волшебства по полированному глубинному сланцу.')
	])
	event.add('irons_spellbooks:cinder_essence', [
		Text.gray('Вахта: вентилятор через огонь душ (очистка) по эссенции волшебства.')
	])
	event.add('irons_spellbooks:common_ink', [
		Text.gray('Вахта: миксер — чернильный мешок + эссенция волшебства + пузырёк.')
	])
	event.add(['irons_spellbooks:uncommon_ink', 'irons_spellbooks:rare_ink', 'irons_spellbooks:epic_ink', 'irons_spellbooks:legendary_ink'], [
		Text.gray('Вахта: миксер — 4 пузырька чернил на ступень ниже + медь / железо / золото / аметист (или алхимический котёл).')
	])
	event.add('irons_spellbooks:raw_mithril', [
		Text.gray('Вахта: печь не плавит — дробилка даёт мифриловый лом (+25 % ещё один).')
	])
})
