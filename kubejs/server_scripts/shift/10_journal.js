// ==========================================================================
// «Журнал смены» (3.4.0, 05.10.2026): что случилось на сервере, пока тебя не было.
// Записи: впервые отбитая волна, отбитый и проваленный набег, новый форпост и вывод из сети, метеорит,
// звездопад и сияние (sky/40_night_sky.js зовёт nsJournal), смерти (сообщение — переводимое, у игрока по-русски).
// При входе — до 8 свежих записей с момента выхода; /journal [N] — последние N (до 30).
// Состояние — server.persistentData «ns_journal_json»; другие скрипты пишут через nsJournal(вид, текст, цвет).
// Набеги, форпосты и метеорит не правим — смотрим на их состояние раз в 5 с.
// ==========================================================================

var NS_JRN_KEY = 'ns_journal_json'
var NS_JRN_MAX = 80
var NS_JRN_SER = Java.loadClass('net.minecraft.network.chat.Component$Serializer')

function nsJrnState() {
	if (NSG.nsJrn) return NSG.nsJrn
	var st = { log: [], seen: {}, w: null }
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_JRN_KEY)) st = Object.assign(st, JSON.parse(String(pd.getString(NS_JRN_KEY))))
	} catch (e) {
		console.warn('[journal] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsJrn = st
	return st
}
function nsJrnSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_JRN_KEY, JSON.stringify(nsJrnState()))
	} catch (e) {}
}
function nsJrnDay() {
	try {
		return Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
	} catch (e) {}
	return 0
}

// Запись в журнал: text — строка (color — её цвет) или готовая JSON-строка компонента (rawJson = true).
// JSON компонентов не гоняем через JSON.parse/stringify: Rhino пишет большие целые как 1.85E9 и ломает UUID в тексте.
function nsJournal(kind, text, color, rawJson) {
	try {
		var st = nsJrnState()
		var j = rawJson ? String(text) : JSON.stringify({ text: String(text), color: color || 'white' })
		st.log.push({ ts: Date.now(), d: nsJrnDay(), k: kind, j: j })
		if (st.log.length > NS_JRN_MAX) st.log.splice(0, st.log.length - NS_JRN_MAX)
		nsJrnSave()
	} catch (e) {
		console.warn('[journal] запись: ' + e)
	}
}

function nsJrnLine(e) {
	return '["",' + JSON.stringify({ text: ' · день ' + e.d + ' — ', color: 'dark_gray' }) + ',' + e.j + ']'
}
function nsJrnShow(name, list, header) {
	var srv = NSG.nsServer
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: header, color: 'gold' }))
	for (var i = 0; i < list.length; i++) srv.runCommandSilent('tellraw ' + name + ' ' + nsJrnLine(list[i]))
}

// --------------------------------------------------------------------------
// Наблюдение за набегами, форпостами и метеоритом
// --------------------------------------------------------------------------
function nsJrnWatch() {
	var st = nsJrnState()
	var rs = nsGetStateRO()
	var sky = null
	try {
		sky = nsSkyState().m
	} catch (e) {}
	var outs = rs.outposts || []
	var cur = {
		phase: rs.phase || 0,
		raid: rs.raid.state,
		kind: rs.raid.kind,
		diff: rs.raid.difficulty || 0,
		curse: rs.curse || 0,
		outs: outs.map(function (o) {
			return o.id + '|' + nsOutpostName(o) + '|' + o.x + '|' + o.z
		}),
		met: sky && sky.stage !== 'falling' ? sky.x + ' ' + sky.y + ' ' + sky.z : null,
	}
	var prev = st.w
	st.w = cur
	if (!prev) {
		nsJrnSave()
		return
	}
	var changed = JSON.stringify(prev) !== JSON.stringify(cur)
	// набег кончился
	var wasFight = prev.raid === 'active' || prev.raid === 'countdown'
	var isFight = cur.raid === 'active' || cur.raid === 'countdown'
	if (wasFight && !isFight && prev.raid === 'active') {
		if (cur.curse > prev.curse) nsJournal('raid', 'Набег ' + (prev.diff ? 'волны ' + prev.diff + ' ' : '') + 'провален: проклятие алтаря +' + (cur.curse - prev.curse) + ' ♥', 'red')
		else if (cur.phase > prev.phase) nsJournal('wave', 'Впервые отбита волна ' + cur.phase + '! Открыта ' + (cur.phase + 1) + '-я', 'gold')
		else nsJournal('raid', 'Набег ' + (prev.diff ? 'волны ' + prev.diff + ' ' : '') + 'отбит', 'green')
	} else if (cur.phase > prev.phase) nsJournal('wave', 'Пройдена волна ' + cur.phase, 'gold')
	// форпосты
	var had = {}
	prev.outs.forEach(function (s) {
		had[s.split('|')[0]] = s
	})
	var now = {}
	cur.outs.forEach(function (s) {
		var p = s.split('|')
		now[p[0]] = s
		if (!had[p[0]]) nsJournal('outpost', 'Форпост «' + p[1] + '» вошёл в сеть (' + p[2] + ', ' + p[3] + ')', 'aqua')
	})
	prev.outs.forEach(function (s) {
		var p = s.split('|')
		if (!now[p[0]]) nsJournal('outpost', 'Форпост «' + p[1] + '» выведен из сети (' + p[2] + ', ' + p[3] + ')', 'gray')
	})
	// метеорит
	if (cur.met && cur.met !== prev.met) nsJournal('meteor', 'Упал метеорит: ' + cur.met, 'gold')
	if (changed) nsJrnSave()
}

NSG.nsJrnTick = 0
ServerEvents.tick(event => {
	NSG.nsJrnTick++
	if (NSG.nsJrnTick % 100 !== 0 || !NSG.nsServer) return
	try {
		nsJrnWatch()
	} catch (e) {
		console.error('[journal] наблюдение: ' + e)
	}
})

// --------------------------------------------------------------------------
// Смерти: сообщение о смерти — переводимый компонент (у игрока покажется по-русски)
// --------------------------------------------------------------------------
EntityEvents.death('minecraft:player', event => {
	try {
		var p = event.getEntity()
		var msg = event.getSource().getLocalizedDeathMessage(p)
		var json = String(NS_JRN_SER.toJson(msg, NSG.nsServer.registryAccess()))
		nsJournal('death', '["",{"text":"☠ ","color":"dark_red"},' + json + ']', null, true)
	} catch (e) {
		try {
			nsJournal('death', '☠ Погиб ' + String(event.getEntity().getUsername()), 'red')
		} catch (x) {}
	}
})

// --------------------------------------------------------------------------
// Вход и выход
// --------------------------------------------------------------------------
PlayerEvents.loggedOut(event => {
	try {
		var st = nsJrnState()
		st.seen[String(event.getPlayer().getUsername())] = Date.now()
		nsJrnSave()
	} catch (e) {}
})

PlayerEvents.loggedIn(event => {
	try {
		var name = String(event.getPlayer().getUsername())
		var st = nsJrnState()
		var since = st.seen[name]
		if (!since) {
			st.seen[name] = Date.now()
			nsJrnSave()
			return
		}
		var fresh = st.log.filter(function (e) {
			return e.ts > since
		})
		if (!fresh.length) return
		var show = fresh.slice(-8)
		event.server.scheduleInTicks(100, function () {
			try {
				nsJrnShow(name, show, 'Журнал смены — пока тебя не было (' + fresh.length + '):')
				if (fresh.length > show.length) NSG.nsServer.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: ' …ещё ' + (fresh.length - show.length) + ' — /journal 30', color: 'dark_gray' }))
			} catch (e) {}
		})
	} catch (e) {
		console.warn('[journal] вход: ' + e)
	}
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var I = event.arguments.INTEGER
	var show = function (ctx, n) {
		try {
			var p = ctx.source.getPlayer()
			var st = nsJrnState()
			var list = st.log.slice(-Math.max(1, Math.min(30, n)))
			if (!list.length) {
				ctx.source.sendSystemMessage(Text.gray('Журнал смены пуст.'))
				return 1
			}
			if (p) nsJrnShow(String(p.getUsername()), list, 'Журнал смены — последние ' + list.length + ':')
			else for (var i = 0; i < list.length; i++) ctx.source.sendSystemMessage(Text.of('день ' + list[i].d + ' — ' + list[i].j))
		} catch (e) {
			ctx.source.sendSystemMessage(Text.red('Журнал: ' + e))
		}
		return 1
	}
	event.register(
		C.literal('journal')
			.executes(ctx => show(ctx, 12))
			.then(C.argument('n', I.create(event)).executes(ctx => show(ctx, Number(I.getResult(ctx, 'n')))))
	)
})

ServerEvents.loaded(event => {
	NSG.nsJrn = null
})
