// ==========================================================================
// Ночная смена — АЭРОКЛУБ и удостоверения пилота (04.10.2026, поток D; Георгий: «лицензии пилота — да»).
//
// Учёт налёта: раз в 0,5 с у каждого игрока в самолёте Immersive Aircraft (и Man of Many Planes — это тоже IA):
//   налёт (блоки по горизонтали, только пилот и только в воздухе), рекорд высоты, посадки (5+ с в воздухе → касание
//   земли), посадки на ангар-док (axiomativ:hangar_dock под самолётом в квадрате 7×7), налёт ночью, время в воздухе в
//   грозу, участие в «Воздушном бою» (минута в воздухе во время боя или сбитый с самолёта улей; в любом кресле).
//   Аппараты Create Aeronautics не считаются: сиденье там — обычное сиденье Create, полёт от поездки не отличить.
// Удостоверения — по порядку III → II → I, выдаются сами, как только условия выполнены (предмет + объявление в чат).
// Каждое открывает следующую ступень авиации: рецепты (aviation/10_recipes.js) берут удостоверение деплоером
// и не тратят его. Данные — в persistentData игрока ('ns_aeroclub', JSON).
// /aeroclub — свой налёт и что осталось до следующего удостоверения; /aeroclub <ник> — чужой.
// Правило Rhino: только var; getClass() закрыт — instanceof.
// ==========================================================================

var NS_AC_VEHICLE = Java.loadClass('immersive_aircraft.entity.VehicleEntity')
var NS_AC_PERIOD = 10 // тиков между замерами
var NS_AC_LANDING_AIR = 100 // сколько тиков в воздухе перед касанием, чтобы посадка засчиталась
var NS_AC_MAX_STEP = 12 * NS_AC_PERIOD // больше за замер — телепорт, не налёт (потолок скорости 4 б/т)
var NS_AC_AIR_BATTLE_TICKS = 1200 // минута в воздухе во время «Воздушного боя»

// Ступени по порядку выдачи. need: dist — налёт (блоков), maxY — рекорд высоты, landings — посадок, dock — посадок
// на ангар-док, night — налёт ночью (блоков), storm — тиков в воздухе в грозу, air — участие в «Воздушном бою»,
// badge — «Значок беглеца» в инвентаре (не забирается).
var NS_AC_RANKS = [
	{ item: 'nightshift:pilot_license_3', name: 'Пилот III', color: 'gold', need: { dist: 3000, maxY: 120, landings: 3 } },
	{ item: 'nightshift:pilot_license_2', name: 'Пилот II', color: 'aqua', need: { dist: 20000, maxY: 200, landings: 10, dock: 3, night: 2000 } },
	{ item: 'nightshift:pilot_license_1', name: 'Пилот I', color: 'light_purple', need: { dist: 60000, maxY: 260, dock: 10, storm: 3600, air: 1, badge: 1 } },
]
var NS_AC_OPENS = [
	'грузовой дирижабль, экономичный самолёт, Форсаж I, бронекорпус, экономайзер, аэрофотоаппарат',
	'«Бамбуковый кукурузник», алый биплан, Форсаж II',
	'военный дирижабль, Форсаж III',
]
var NS_AC_BADGE = 'nightshift:runner_badge'

var nsAcMem = {} // имя → {vid, x, z, air}: состояние полёта между замерами (не сохраняется)
var nsAcTick = 0

function nsAcLoad(p) {
	var rec = {}
	try {
		var raw = p.persistentData.getString('ns_aeroclub')
		if (raw) rec = JSON.parse(String(raw))
	} catch (e) {}
	var f = ['dist', 'night', 'storm', 'airT', 'air', 'hives', 'landings', 'dock', 'maxY', 'rank']
	for (var i = 0; i < f.length; i++) if (typeof rec[f[i]] !== 'number') rec[f[i]] = 0
	return rec
}

function nsAcSave(p, rec) {
	p.persistentData.putString('ns_aeroclub', JSON.stringify(rec))
}

// самолёт IA, на котором сидит игрок (или null)
function nsAcVehicle(p) {
	try {
		var v = p.getVehicle()
		if (v != null && v instanceof NS_AC_VEHICLE) return v
	} catch (e) {}
	return null
}

function nsAcIsPilot(p, v) {
	try {
		var c = v.getControllingPassenger()
		return c != null && String(c.getUuid()) === String(p.getUuid())
	} catch (e) {
		return false
	}
}

// ночь в Верхнем мире: 13 000…23 000 тиков суток
function nsAcNight(level) {
	try {
		if (String(level.getDimension()) !== 'minecraft:overworld') return false
		var t = Number(level.getDayTime()) % 24000
		return t >= 13000 && t <= 23000
	} catch (e) {
		return false
	}
}

// идёт «Воздушный бой» (особая стадия набега, raids/45_special_stages.js)
function nsAcAirBattle() {
	try {
		var st = nsGetStateRO()
		return !!(st && st.raid && st.raid.state === 'active' && st.raid.sc && st.raid.sc.key === 'air')
	} catch (e) {
		return false
	}
}

// ангар-док под самолётом: квадрат 7×7, от уровня колёс на 2 блока вниз
function nsAcDockUnder(level, v) {
	var bx = Math.floor(v.getX()),
		by = Math.floor(v.getY()),
		bz = Math.floor(v.getZ())
	for (var dy = 0; dy >= -2; dy--)
		for (var dx = -3; dx <= 3; dx++)
			for (var dz = -3; dz <= 3; dz++) {
				try {
					if (String(level.getBlock(bx + dx, by + dy, bz + dz).getId()) === 'axiomativ:hangar_dock') return true
				} catch (e) {}
			}
	return false
}

// Один замер игрока. Возвращает true, если запись изменилась.
function nsAcSample(p) {
	var name = String(p.getUsername())
	var mem = nsAcMem[name]
	var v = nsAcVehicle(p)
	if (!v) {
		if (mem) delete nsAcMem[name]
		return false
	}
	var vid = String(v.getUuid())
	if (!mem || mem.vid !== vid) mem = nsAcMem[name] = { vid: vid, x: null, z: null, air: 0 }
	var level = p.getLevel()
	var pilot = nsAcIsPilot(p, v)
	var x = Number(v.getX()),
		y = Number(v.getY()),
		z = Number(v.getZ())
	var grounded = false
	try {
		grounded = v.onGround() || v.isInWater()
	} catch (e) {}
	var rec = null
	var changed = false
	var battle = nsAcAirBattle()
	if (!grounded) {
		if (pilot || battle) rec = nsAcLoad(p)
		if (pilot) {
			if (mem.x !== null) {
				var d = Math.sqrt((x - mem.x) * (x - mem.x) + (z - mem.z) * (z - mem.z))
				if (d < NS_AC_MAX_STEP) {
					rec.dist += d
					if (nsAcNight(level)) rec.night += d
				}
			}
			if (Math.floor(y) > rec.maxY) rec.maxY = Math.floor(y)
			try {
				if (level.isThundering()) rec.storm += NS_AC_PERIOD
			} catch (e) {}
			changed = true
		}
		if (battle && !rec.air) {
			rec.airT += NS_AC_PERIOD
			if (rec.airT >= NS_AC_AIR_BATTLE_TICKS) {
				rec.air = 1
				p.tell(Text.aqua('[Аэроклуб] Участие в «Воздушном бою» засчитано.'))
			}
			changed = true
		}
		mem.air += NS_AC_PERIOD
	} else {
		if (pilot && mem.air >= NS_AC_LANDING_AIR) {
			rec = nsAcLoad(p)
			rec.landings++
			var onDock = nsAcDockUnder(level, v)
			if (onDock) rec.dock++
			changed = true
			p.setStatusMessage(Text.aqua(onDock ? 'Посадка на ангар-док засчитана (' + rec.dock + ')' : 'Посадка засчитана (' + rec.landings + ')'))
		}
		mem.air = 0
	}
	mem.x = x
	mem.z = z
	if (changed) {
		nsAcCheck(p, rec)
		nsAcSave(p, rec)
	}
	return changed
}

function nsAcHasItem(p, id) {
	try {
		var inv = p.getInventory()
		for (var i = 0; i < inv.getContainerSize(); i++) if (String(inv.getItem(i).getId()) === id) return true
	} catch (e) {}
	return false
}

// выполнено ли условие key ступени
function nsAcMet(rec, key, need) {
	if (key === 'badge') return true // проверяется отдельно — по инвентарю
	return rec[key] >= need
}

function nsAcAllMet(p, rec, rank) {
	for (var k in rank.need) {
		if (k === 'badge') {
			if (!nsAcHasItem(p, NS_AC_BADGE)) return false
		} else if (!nsAcMet(rec, k, rank.need[k])) return false
	}
	return true
}

// выдать следующее удостоверение, если условия выполнены (может выдать сразу несколько по порядку)
function nsAcCheck(p, rec) {
	for (var guard = 0; guard < 3 && rec.rank < NS_AC_RANKS.length; guard++) {
		var r = NS_AC_RANKS[rec.rank]
		if (!nsAcAllMet(p, rec, r)) {
			// всё, кроме значка, есть — подсказать (не чаще раза в 10 минут)
			if (r.need.badge && !nsAcHasItem(p, NS_AC_BADGE)) {
				var only = true
				for (var k in r.need) if (k !== 'badge' && !nsAcMet(rec, k, r.need[k])) only = false
				var now = Date.now()
				if (only && now - (rec.badgeHint || 0) > 600000) {
					rec.badgeHint = now
					p.tell(Text.gold('[Аэроклуб] Налёт на «' + r.name + '» есть. Покажите «Значок беглеца» (особая стадия «Побег»): держите его в инвентаре — значок не забирают.'))
				}
			}
			return
		}
		rec.rank++
		nsAcIssue(p, r, rec.rank)
	}
}

function nsAcIssue(p, r, rankNo) {
	var name = String(p.getUsername())
	var server = p.getServer()
	// удостоверение с именем владельца (lore); если команда не прошла — просто предмет
	var given = server.runCommandSilent('give ' + name + ' ' + r.item + '[minecraft:lore=[\'{"text":"Выдано: ' + name + '","color":"gray","italic":false}\']] 1')
	if (!given) {
		try {
			p.give(Item.of(r.item))
		} catch (e) {
			console.warn('[аэроклуб] не выдал ' + r.item + ' игроку ' + name + ': ' + e)
		}
	}
	// значок в чате — всем
	var msg = Text.of('[Аэроклуб] ').gold()
		.append(Text.of(name).white())
		.append(Text.of(' получает удостоверение ').gray())
		.append(nsAcColored('[' + r.name + ']', r.color).bold())
	server.tell(msg)
	p.tell(Text.gray('Открыто: ' + NS_AC_OPENS[rankNo - 1] + '. Удостоверение ставится в деплоер — рецепт его не тратит.'))
	if (rankNo < NS_AC_RANKS.length) p.tell(Text.gray('Дальше — «' + NS_AC_RANKS[rankNo].name + '»: /aeroclub'))
	server.runCommandSilent('title ' + name + ' title {"text":"' + r.name + '","color":"' + r.color + '","bold":true}')
	server.runCommandSilent('title ' + name + ' subtitle {"text":"Удостоверение пилота","color":"gray"}')
	server.runCommandSilent('execute at ' + name + ' run playsound minecraft:ui.toast.challenge_complete player ' + name + ' ~ ~ ~ 1 1')
	console.info('[аэроклуб] ' + name + ' — ' + r.name)
}

ServerEvents.tick(function (event) {
	if (++nsAcTick % NS_AC_PERIOD !== 0) return
	try {
		var ps = event.server.getPlayerList().getPlayers()
		for (var i = 0; i < ps.size(); i++) {
			var p = ps.get(i)
			try {
				if (p.isSpectator()) continue
				nsAcSample(p)
			} catch (e) {
				console.error('[аэроклуб] замер ' + p.getUsername() + ': ' + e)
			}
		}
	} catch (e) {
		console.error('[аэроклуб] ' + e)
	}
})

// улей «Воздушного боя», сбитый игроком из самолёта (или пулей самолёта), — участие сразу
EntityEvents.death(function (event) {
	try {
		var e = event.entity
		if (!e.getTags().contains('ns_hive')) return
		var src = event.source
		var att = null
		try {
			att = src.getEntity()
		} catch (x) {}
		var p = null
		if (att != null && att.isPlayer()) p = att
		else if (att != null && att instanceof NS_AC_VEHICLE) p = att.getControllingPassenger()
		if (p == null || !p.isPlayer() || !nsAcVehicle(p)) return
		var rec = nsAcLoad(p)
		rec.hives++
		if (!rec.air) {
			rec.air = 1
			p.tell(Text.aqua('[Аэроклуб] Улей сбит с самолёта — участие в «Воздушном бою» засчитано.'))
		}
		nsAcCheck(p, rec)
		nsAcSave(p, rec)
	} catch (x) {}
})

// ---------- /aeroclub ----------

function nsAcKm(blocks) {
	return (blocks / 1000).toFixed(1).replace('.', ',') + ' км'
}

function nsAcClock(ticks) {
	var s = Math.floor(ticks / 20)
	return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60)
}

// строка условия: [+] / [ ] название: есть / нужно
function nsAcLine(p, rec, key, need) {
	var badge = nsAcHasItem(p, NS_AC_BADGE)
	var rows = {
		dist: ['налёт', nsAcKm(rec.dist), nsAcKm(need)],
		maxY: ['рекорд высоты', String(rec.maxY), String(need)],
		landings: ['посадок', String(rec.landings), String(need)],
		dock: ['посадок на ангар-док', String(rec.dock), String(need)],
		night: ['налёт ночью', nsAcKm(rec.night), nsAcKm(need)],
		storm: ['в воздухе в грозу', nsAcClock(rec.storm), nsAcClock(need)],
		air: ['«Воздушный бой» (минута в воздухе или сбитый улей)', rec.air ? 'да' : 'нет', 'да'],
		badge: ['«Значок беглеца» в инвентаре', badge ? 'есть' : 'нет', 'есть'],
	}
	var row = rows[key]
	var ok = key === 'badge' ? badge : nsAcMet(rec, key, need)
	var mark = ok ? Text.of('  [+] ').green() : Text.of('  [ ] ').red()
	return mark.append(Text.of(row[0] + ': ').gray()).append(Text.of(row[1] + ' / ' + row[2]).white())
}

// цвет ступени: имя метода текста KubeJS
function nsAcColored(text, color) {
	var t = Text.of(text)
	if (color === 'aqua') return t.aqua()
	if (color === 'light_purple') return t.lightPurple()
	return t.gold()
}

function nsAcReport(src, p) {
	var rec = nsAcLoad(p)
	var title = rec.rank > 0 ? NS_AC_RANKS[rec.rank - 1].name : 'без удостоверения'
	src.sendSystemMessage(Text.of('[Аэроклуб] ').gold().append(Text.of(String(p.getUsername()) + ' — ' + title).white()))
	src.sendSystemMessage(Text.gray('Налёт ' + nsAcKm(rec.dist) + ' · высота ' + rec.maxY + ' · посадок ' + rec.landings + ' (на ангар-док ' + rec.dock + ') · ночью ' + nsAcKm(rec.night) + ' · в грозу ' + nsAcClock(rec.storm) + ' · «Воздушный бой»: ' + (rec.air ? 'да' : 'нет') + (rec.hives ? ' (ульев: ' + rec.hives + ')' : '')))
	if (rec.rank >= NS_AC_RANKS.length) {
		src.sendSystemMessage(Text.lightPurple('Все удостоверения получены. Небо ваше.'))
		return 1
	}
	var r = NS_AC_RANKS[rec.rank]
	src.sendSystemMessage(nsAcColored('До «' + r.name + '» (откроет: ' + NS_AC_OPENS[rec.rank] + '):', r.color))
	for (var k in r.need) src.sendSystemMessage(nsAcLine(p, rec, k, r.need[k]))
	return 1
}

ServerEvents.commandRegistry(function (event) {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('aeroclub')
			.executes(function (ctx) {
				var p = ctx.source.getPlayer()
				if (!p) return 0
				return nsAcReport(ctx.source, p)
			})
			.then(
				C.argument('name', A.STRING.create(event)).executes(function (ctx) {
					var p = ctx.source.getServer().getPlayerList().getPlayerByName(String(A.STRING.getResult(ctx, 'name')))
					if (!p) {
						ctx.source.sendSystemMessage(Text.red('[Аэроклуб] Игрок не в сети.'))
						return 0
					}
					return nsAcReport(ctx.source, p)
				})
			)
	)
	// админ: поправить запись (после сбоя, для проверки): /aeroclub_admin <ник> <поле> <число>, поле reset — с нуля
	event.register(
		C.literal('aeroclub_admin')
			.requires(function (s) {
				return s.hasPermission(2)
			})
			.then(
				C.argument('name', A.STRING.create(event)).then(
					C.argument('field', A.STRING.create(event)).then(
						C.argument('value', A.INTEGER.create(event)).executes(function (ctx) {
							var p = ctx.source.getServer().getPlayerList().getPlayerByName(String(A.STRING.getResult(ctx, 'name')))
							if (!p) return 0
							var field = String(A.STRING.getResult(ctx, 'field'))
							var value = Number(A.INTEGER.getResult(ctx, 'value'))
							var rec = field === 'reset' ? {} : nsAcLoad(p)
							if (field !== 'reset') rec[field] = value
							nsAcSave(p, rec)
							rec = nsAcLoad(p)
							nsAcCheck(p, rec)
							nsAcSave(p, rec)
							ctx.source.sendSystemMessage(Text.gray('[Аэроклуб] ' + p.getUsername() + ': ' + JSON.stringify(rec)))
							return 1
						})
					)
				)
			)
	)
})
