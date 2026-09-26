// ==========================================================================
// «Завод: вал» — меню и команды.
//   /factory              — счёт, вал, рудные точки, кнопки прокачки
//   /factory buy shaft    — следующий уровень вала
//   /factory buy ore <к>  — открыть / прокачать рудную точку
//   /factory prices       — цены биржи
// Оператор: /factory setup (пересобрать карту), /factory give <n>, /factory reset
// ==========================================================================

function fsOrePrice(o, tier) {
	// цена перехода на уровень tier: открытие — o.unlock, дальше — таблица × множитель руды
	if (tier === 1) return o.unlock
	return Math.round((FS.ORE_UPGRADE[tier] || 0) * o.mult)
}

function fsMenu(player) {
	var s = fsState()
	player.tell(Text.gold('[Завод] На счету: ').append(Text.white(fsFmt(s.credits) + ' кр')).append(Text.gray(' (заработано всего ' + fsFmt(s.earned) + ')')))
	var st = fsShaftStats(s.shaft)
	var line = Text.gold('Вал ур. ' + s.shaft + ': ').append(Text.white(st.motors + ' мот. × ' + st.rpm + ' об/мин = ' + fsFmt(st.su) + ' SU  '))
	if (s.shaft + 1 < FS.SHAFT_TIERS.length) {
		var nx = fsShaftStats(s.shaft + 1)
		var price = FS.SHAFT_TIERS[s.shaft + 1].price
		var bt = '[ур. ' + (s.shaft + 1) + ' за ' + fsFmt(price) + ' кр]'
		var btn = s.credits >= price ? Text.green(bt) : Text.darkGray(bt)
		line = line.append(btn.clickRunCommand('/factory buy shaft').hover(Text.white('Станет: ' + nx.motors + ' мот. × ' + nx.rpm + ' об/мин = ' + fsFmt(nx.su) + ' SU')))
	} else line = line.append(Text.gray('максимум'))
	player.tell(line)
	player.tell(Text.gold('Рудные точки (бочки у спавна, забирать воронкой):'))
	for (var i = 0; i < FS.ORES.length; i++) {
		var o = FS.ORES[i]
		var t = s.ores[o.key] || 0
		var l = Text.white('  ' + o.name + ': ').append(t > 0 ? Text.yellow('ур. ' + t + ' · ' + FS.ORE_RATES[t] + '/с  ') : Text.darkGray('закрыто  '))
		if (t + 1 < FS.ORE_RATES.length) {
			var p = fsOrePrice(o, t + 1)
			var bs = t === 0 ? '[открыть за ' + fsFmt(p) + ']' : '[ур. ' + (t + 1) + ' за ' + fsFmt(p) + ']'
			var b = s.credits >= p ? Text.green(bs) : Text.darkGray(bs)
			l = l.append(b.clickRunCommand('/factory buy ore ' + o.key).hover(Text.white('Станет: ' + FS.ORE_RATES[t + 1] + ' ' + o.name.toLowerCase() + ' в секунду')))
		} else l = l.append(Text.gray('максимум'))
		player.tell(l)
	}
	player.tell(Text.gray('Биржа — бочка у спавна. ').append(Text.aqua('[цены]').clickRunCommand('/factory prices')))
}

function fsItemName(id) {
	try {
		return Text.translate(String(Item.of(id).getDescriptionId()))
	} catch (e) {
		return Text.of(id)
	}
}

function fsPrices(player) {
	var ids = Object.keys(FS.PRICES).sort(function (a, b) {
		return FS.PRICES[a] - FS.PRICES[b]
	})
	player.tell(Text.gold('[Завод] Биржа покупает (кр за штуку, сырую руду не берёт):'))
	var line = Text.of('')
	for (var i = 0; i < ids.length; i++) {
		line = line.append(fsItemName(ids[i])).append(Text.yellow(' ' + FS.PRICES[ids[i]])).append(Text.gray(i < ids.length - 1 ? ' · ' : ''))
		if (i % 4 === 3 || i === ids.length - 1) {
			player.tell(line)
			line = Text.of('')
		}
	}
}

function fsBuy(ctx, what, key) {
	var player = ctx.source.getPlayer()
	var s = fsState()
	var who = player ? String(player.getUsername()) : 'консоль'
	if (what === 'shaft') {
		if (s.shaft + 1 >= FS.SHAFT_TIERS.length) return fsReply(ctx, 'вал уже на максимуме')
		var price = FS.SHAFT_TIERS[s.shaft + 1].price
		if (s.credits < price) return fsReply(ctx, 'не хватает кредитов: нужно ' + fsFmt(price) + ', есть ' + fsFmt(s.credits))
		s.credits -= price
		s.shaft++
		fsSave(s)
		fsSetMotors(s.shaft)
		var st = fsShaftStats(s.shaft)
		fsCmd('tellraw @a ' + JSON.stringify({ text: '[Завод] ' + who + ' улучшил вал: ' + fsFmt(st.su) + ' SU при ' + st.rpm + ' об/мин', color: 'green' }))
		fsCmd('playsound minecraft:block.anvil.use master @a ' + FS.OUTPUT.join(' ') + ' 1 0.8')
	} else {
		var o = fsOre(key)
		if (!o) return fsReply(ctx, 'нет такой руды: ' + key)
		var t = s.ores[o.key] || 0
		if (t + 1 >= FS.ORE_RATES.length) return fsReply(ctx, o.name + ': уже максимум')
		var p = fsOrePrice(o, t + 1)
		if (s.credits < p) return fsReply(ctx, 'не хватает кредитов: нужно ' + fsFmt(p) + ', есть ' + fsFmt(s.credits))
		s.credits -= p
		s.ores[o.key] = t + 1
		fsSave(s)
		fsPlaceOre(o, t + 1)
		fsCmd('tellraw @a ' + JSON.stringify({ text: '[Завод] ' + who + ': ' + o.name + ' — ' + (t === 0 ? 'точка открыта' : 'ур. ' + (t + 1)) + ', ' + FS.ORE_RATES[t + 1] + '/с', color: 'green' }))
	}
	if (player) fsMenu(player)
	return 1
}

function fsReply(ctx, text) {
	ctx.source.sendSystemMessage(Text.gold('[Завод] ').append(Text.white(text)))
	return 0
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('factory')
			.executes(ctx => {
				var p = ctx.source.getPlayer()
				if (p) fsMenu(p)
				return 1
			})
			.then(C.literal('prices').executes(ctx => {
				var p = ctx.source.getPlayer()
				if (p) fsPrices(p)
				return 1
			}))
			.then(
				C.literal('buy')
					.then(C.literal('shaft').executes(ctx => fsBuy(ctx, 'shaft')))
					.then(C.literal('ore').then(C.argument('key', A.STRING.create(event)).executes(ctx => fsBuy(ctx, 'ore', String(A.STRING.getResult(ctx, 'key'))))))
			)
			.then(C.literal('setup').requires(src => src.hasPermission(2)).executes(ctx => {
				fsBuildAll()
				return fsReply(ctx, 'карта пересобрана')
			}))
			.then(C.literal('give').requires(src => src.hasPermission(2)).then(C.argument('n', A.INTEGER.create(event)).executes(ctx => {
				var s = fsState()
				s.credits += Number(A.INTEGER.getResult(ctx, 'n'))
				fsSave(s)
				return fsReply(ctx, 'на счету ' + fsFmt(s.credits))
			})))
			.then(C.literal('reset').requires(src => src.hasPermission(2)).executes(ctx => {
				var d = fsDefault()
				fsSave(d)
				fsBuildAll()
				return fsReply(ctx, 'прогресс сброшен')
			}))
	)
})
