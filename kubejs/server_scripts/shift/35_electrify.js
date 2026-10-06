// ==========================================================================
// Вехи электрификации (финальный аудит 06.10.2026, идея из docs/ideas-midgame-2026-10-04.md: «1 000 / 10 000 /
// 100 000 FE/т в сети — квесты с наградами»). У «Тока» появляется цель: выработка смены растёт — праздник.
//  - Выработку считает диспетчерская аддона (DispatchNetwork.totals().gen — сумма генераторов с датчиком диспетчерской).
//  - Веха взята, когда выработка держится не ниже порога 30 с подряд (3 замера раз в 10 с) — не от скачка.
//  - Награда — один раз на мир: титр всем, салют над алтарём базы, запись в журнал смены, жетоны смены каждому в сети.
// Состояние — server.persistentData «ns_electrify_json». Оператор: /nselectrify status | test <FE/т> | reset.
// KubeJS 2101 / Rhino: только var; тела обработчиков — в try.
// ==========================================================================

var NS_EL_KEY = 'ns_electrify_json'
var NS_EL_STEPS = [
	{ fe: 1000, name: 'Первый ток', tokens: 6, text: 'Смена выдаёт 1 000 FE/т — ток пошёл по базе.' },
	{ fe: 10000, name: 'Электростанция', tokens: 12, text: 'Смена выдаёт 10 000 FE/т — своя электростанция.' },
	{ fe: 100000, name: 'Энергосистема', tokens: 24, text: 'Смена выдаёт 100 000 FE/т — энергосистема на весь край.' },
]
var NS_EL_NET = null
try {
	NS_EL_NET = Java.loadClass('com.axiomativ.industries.content.dispatch.DispatchNetwork')
} catch (e) {
	console.info('[electrify] диспетчерской нет — вехи электрификации выключены')
}

function nsElState() {
	if (NSG.nsEl) return NSG.nsEl
	var st = { done: {}, streak: 0, best: 0, fake: 0 }
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_EL_KEY)) st = Object.assign(st, JSON.parse(String(pd.getString(NS_EL_KEY))))
	} catch (e) {
		console.warn('[electrify] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsEl = st
	return st
}
function nsElSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_EL_KEY, JSON.stringify(nsElState()))
	} catch (e) {}
}

// Текущая выработка, FE/т (по датчикам диспетчерской); fake — подмена для проверки оператором
function nsElGen(st) {
	if (st.fake > 0) return st.fake
	if (!NS_EL_NET) return 0
	try {
		return Number(NS_EL_NET.totals().gen) || 0
	} catch (e) {
		return 0
	}
}

function nsElNext(st) {
	for (var i = 0; i < NS_EL_STEPS.length; i++) if (!st.done[NS_EL_STEPS[i].fe]) return NS_EL_STEPS[i]
	return null
}

function nsElAward(srv, step) {
	srv.runCommandSilent('title @a times 10 80 20')
	srv.runCommandSilent('title @a subtitle ' + JSON.stringify({ text: step.text, color: 'gray' }))
	srv.runCommandSilent('title @a title ' + JSON.stringify({ text: '⚡ ' + step.name, color: 'aqua' }))
	srv.runCommandSilent('execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.8 1.1')
	var ps = srv.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		try {
			ps[i].give(Item.of('nightshift:shift_token', step.tokens))
			ps[i].tell(Text.aqua('[Ток] ').append(Text.white('Веха «' + step.name + '»: ' + step.text)).append(Text.gold(' +' + step.tokens + ' жетонов смены.')))
		} catch (e) {}
	}
	if (typeof nsJournal === 'function') nsJournal('electrify', '⚡ Веха «' + step.name + '»: ' + step.text, 'aqua')
	// салют над алтарём базы (shift/30_salute.js)
	try {
		var rs = nsGetStateRO()
		for (var a = 0; a < rs.altars.length; a++) {
			if (rs.altars[a].dim !== 'minecraft:overworld') continue
			NSG.nsSalute = { x: rs.altars[a].x + 0.5, y: rs.altars[a].y, z: rs.altars[a].z + 0.5, dim: rs.altars[a].dim, left: 25, big: false }
			break
		}
	} catch (e) {}
	console.info('[electrify] веха ' + step.fe + ' FE/т взята')
}

var nsElTick = 0
ServerEvents.tick(event => {
	if (++nsElTick % 200 !== 0 || !NSG.nsServer) return
	try {
		var st = nsElState()
		var step = nsElNext(st)
		if (!step) return
		var gen = nsElGen(st)
		if (gen > st.best) {
			st.best = Math.round(gen)
			nsElSave()
		}
		if (gen >= step.fe) st.streak++
		else st.streak = 0
		if (st.streak < 3) return
		st.streak = 0
		// за один раз — все взятые пороги (вдруг подключили сразу много генераторов)
		var got = []
		for (var i = 0; i < NS_EL_STEPS.length; i++) {
			if (!st.done[NS_EL_STEPS[i].fe] && gen >= NS_EL_STEPS[i].fe) {
				st.done[NS_EL_STEPS[i].fe] = Date.now()
				got.push(NS_EL_STEPS[i])
			}
		}
		nsElSave()
		for (var g = 0; g < got.length; g++) nsElAward(event.server, got[g])
	} catch (e) {
		console.warn('[electrify] ' + e)
	}
})

ServerEvents.loaded(event => {
	NSG.nsEl = null
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var I = event.arguments.INTEGER
	var say = function (ctx, t) {
		ctx.source.sendSystemMessage(Text.aqua('[Ток] ').append(Text.white(t)))
		return 1
	}
	event.register(
		C.literal('nselectrify')
			.requires(s => s.hasPermission(2))
			.then(
				C.literal('status').executes(ctx => {
					var st = nsElState()
					var next = nsElNext(st)
					return say(ctx, 'выработка ' + Math.round(nsElGen(st)) + ' FE/т (лучшая ' + st.best + '), взято: ' + JSON.stringify(Object.keys(st.done)) + (next ? ', дальше ' + next.fe + ' FE/т' : ', все вехи взяты') + (st.fake ? ' [подмена ' + st.fake + ']' : ''))
				})
			)
			// проверка без генераторов: подменить выработку (0 — снять подмену)
			.then(
				C.literal('test').then(
					C.argument('fe', I.create(event)).executes(ctx => {
						var st = nsElState()
						st.fake = Math.max(0, Number(I.getResult(ctx, 'fe')))
						st.streak = 0
						nsElSave()
						return say(ctx, st.fake ? 'подмена выработки: ' + st.fake + ' FE/т (веха — через 30 с)' : 'подмена снята')
					})
				)
			)
			.then(
				C.literal('reset').executes(ctx => {
					NSG.nsEl = { done: {}, streak: 0, best: 0, fake: 0 }
					nsElSave()
					return say(ctx, 'вехи сброшены')
				})
			)
	)
})
