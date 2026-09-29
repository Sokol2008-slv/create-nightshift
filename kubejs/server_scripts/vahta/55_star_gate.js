// ==========================================================================
// «Вахта» — «звёздные» применения межпланетного сплава (axiomativ:interplanetary_alloy):
//   1) руды аксиомита и стабилита открывает только Звёздная кирка (тег nightshift:star_tools);
//   2) «Звёздный навигатор» — пропуск на планеты Аксиоматив и Инь-Янь;
//   3) рецепты: навигатор и ещё одна Звёздная кирка (механические крафтеры).
// Предметы — startup_scripts/vahta/20_wave_items.js, лут руд — data/kubejs/loot_table/blocks/*.json.
// Правило Rhino: только var.
// ==========================================================================

// --------------------------------------------------------------------------
// 1. Рецепты. Ингредиенты навигатора НЕ с наших планет (иначе замкнутый круг: чтобы
// долететь до планеты, нужно то, что добывается на ней). Сплав — из титана, вольфрама и
// лунного сапфира (межпланетное точило).
// --------------------------------------------------------------------------
ServerEvents.recipes(function (event) {
	// навигатор: два сплава, ядро навигации (награда 50-й волны), схемы Northstar, механизмы
	event.recipes.create.mechanical_crafting('nightshift:star_navigator', [
		'ACA',
		'PNP',
		' D '
	], {
		A: 'axiomativ:interplanetary_alloy',
		C: 'northstar:advanced_circuit',
		P: 'create:precision_mechanism',
		N: 'nightshift:navigation_core',
		D: 'northstar:circuit'
	}).id('nightshift:vahta/star_navigator')

	// вторая и следующие Звёздные кирки: 3 сплава + незеритовая кирка + слиток стабилита с планет
	// (стабилит добывается только Звёздной киркой с 70-й волны — то есть копию можно собрать лишь
	// имея первую)
	event.recipes.create.mechanical_crafting('nightshift:star_pickaxe', [
		'AAA',
		' P ',
		' S '
	], {
		A: 'axiomativ:interplanetary_alloy',
		P: 'minecraft:netherite_pickaxe',
		S: 'kubejs:stabilite_ingot'
	}).id('nightshift:vahta/star_pickaxe_copy')
})

// --------------------------------------------------------------------------
// 2. Руды планет: только Звёздная кирка.
// Основа — лут-таблицы (data/kubejs/loot_table/blocks/*.json, условие match_tool по тегу
// nightshift:star_tools): что бы ни ломало блок (кирка, механический бур Create, взрыв,
// деплоер) — без звёздного инструмента в руках не выпадет ничего. Здесь сверху — подсказка
// игроку и запрет ломать блок «впустую» (иначе руда бы пропадала зря).
// Механический бур без инструмента не проходит через BreakEvent игрока — там срабатывает
// только лут-таблица: блок ломается, дропа нет.
// --------------------------------------------------------------------------
var NS_STAR_ORES = {
	'kubejs:axiomite_ore': true,
	'kubejs:deepslate_axiomite_ore': true,
	'kubejs:light_stabilite_ore': true,
	'kubejs:dark_stabilite_ore': true
}
var NS_STAR_HINT_COOLDOWN = 60 // тиков между подсказками одному игроку (клиент повторяет попытки ломать)
var NS_BREAK_EVENT = Java.loadClass('net.neoforged.neoforge.event.level.BlockEvent$BreakEvent')

NativeEvents.onEvent(NS_BREAK_EVENT, function (event) {
	try {
		var p = event.getPlayer()
		if (!p || p.isCreative()) return
		var block = event.getState().getBlock()
		if (!NS_STAR_ORES[String(block.kjs$getKey().location())]) return
		if (p.getMainHandItem().hasTag('nightshift:star_tools')) return
		event.setCanceled(true)
		// подсказку не шлём фейковым игрокам (деплоер Create) и не чаще раза в NS_STAR_HINT_COOLDOWN тиков
		if (String(p.getClass().getName()).indexOf('FakePlayer') >= 0) return
		var now = p.level.getGameTime()
		var last = p.persistentData.getLong('ns_star_hint_t')
		if (now - last < NS_STAR_HINT_COOLDOWN && now >= last) return
		p.persistentData.putLong('ns_star_hint_t', now)
		p.setStatusMessage(Text.translate('nightshift.msg.star_pickaxe_needed').red())
	} catch (e) {
		console.error('[star_gate] сломан блок руды: ' + e)
	}
})

// --------------------------------------------------------------------------
// 3. Звёздный навигатор — пропуск на наши планеты.
// Хук: EntityTravelToDimensionEvent (NeoForge) — срабатывает в Entity.changeDimension ДО
// перемещения и отменяемый. Ракета Northstar — RocketContraptionEntity, у неё свой changeDimension,
// который зовёт родительский (событие для самой ракеты), а потом переносит пассажиров по одному
// (событие для каждого игрока). Поэтому:
//   - ракета/сущность с пассажирами: отменяем, если у ЛЮБОГО пассажира-игрока нет навигатора
//     (никого не бросаем на Земле); без игроков (пустая ракета, мобы, предметы) — пропускаем;
//   - игрок сам (телепорт, портал): навигатор должен лежать в его инвентаре.
// Отмена = ракета остаётся на месте (родительский changeDimension возвращает null, и Northstar
// прерывает перенос), игроки получают сообщение. Креатив пропускаем — для тестов и админов.
// Запасной слой — PlayerChangedDimensionEvent: если игрок всё же оказался на планете без
// навигатора (обходной путь другого мода), возвращаем его на Землю.
// --------------------------------------------------------------------------
var NS_STAR_NAV = 'nightshift:star_navigator'
var NS_STAR_DIMS = {
	'nightshift:axiomativ': true,
	'nightshift:yin_yang': true
}
var NS_TRAVEL_EVENT = Java.loadClass('net.neoforged.neoforge.event.entity.EntityTravelToDimensionEvent')
var NS_CHANGED_EVENT = Java.loadClass('net.neoforged.neoforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent')

// игрок ли (вынесено в функцию для проверки на витрине)
function nsIsTraveler(e) {
	return e.isPlayer()
}

// есть ли навигатор в любом слоте инвентаря (основной, броня, вторая рука)
function nsHasNavigator(p) {
	var inv = p.getInventory()
	for (var i = 0; i < inv.getContainerSize(); i++) {
		var st = inv.getItem(i)
		if (!st.isEmpty() && String(st.getId()) === NS_STAR_NAV) return true
	}
	return false
}

// игроки «группы»: сам игрок либо все игроки-пассажиры сущности (ракеты, лодки)
function nsTravelers(e) {
	var res = []
	if (nsIsTraveler(e)) {
		res.push(e)
		return res
	}
	var pass = e.getPassengers()
	for (var i = 0; i < pass.size(); i++) if (nsIsTraveler(pass.get(i))) res.push(pass.get(i))
	return res
}

NativeEvents.onEvent(NS_TRAVEL_EVENT, function (event) {
	try {
		if (!NS_STAR_DIMS[String(event.getDimension().location())]) return
		var players = nsTravelers(event.getEntity())
		if (players.length === 0) return // без игроков (пустая ракета, мобы) — пропускаем
		var lacking = 0
		for (var i = 0; i < players.length; i++) {
			if (!players[i].isCreative() && !nsHasNavigator(players[i])) lacking++
		}
		if (lacking === 0) return
		event.setCanceled(true)
		// сообщение всем в группе: лететь нельзя, пока навигатора нет у любого из пассажиров
		for (var k = 0; k < players.length; k++) {
			var pl = players[k]
			pl.setStatusMessage(Text.red('Без звёздного навигатора сюда не долететь'))
			pl.tell(Text.gold('[Навигация] ').append(Text.gray('Курс на эту планету не проложен: «Звёздный навигатор» должен лежать в инвентаре у каждого пассажира. Полёт отменён, ракета остаётся на месте.')))
		}
	} catch (e) {
		console.error('[star_gate] проверка перелёта: ' + e)
	}
})

// запасной слой: уже прибыл без навигатора — назад на Землю
NativeEvents.onEvent(NS_CHANGED_EVENT, function (event) {
	try {
		var p = event.getEntity()
		if (!p || p.isCreative()) return
		if (!NS_STAR_DIMS[String(event.getTo().location())]) return
		if (nsHasNavigator(p)) return
		var server = p.server
		var spawn = server.getLevel('minecraft:overworld').getSharedSpawnPos()
		var uuid = String(p.getUuid())
		server.scheduleInTicks(2, function () {
			server.runCommandSilent('execute in minecraft:overworld run tp ' + uuid + ' ' + spawn.getX() + ' ' + spawn.getY() + ' ' + spawn.getZ())
			p.tell(Text.gold('[Навигация] ').append(Text.gray('Без «Звёздного навигатора» на этой планете делать нечего — вы возвращены на Землю.')))
		})
	} catch (e) {
		console.error('[star_gate] возврат с планеты: ' + e)
	}
})
