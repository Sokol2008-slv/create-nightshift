// ==========================================================================
// «Доска почёта» и «Работник недели» (07.10.2026, идея №3 финального аудита: «соревнование внутри смены»).
// Счёт смены по игрокам — за неделю (7 игровых дней, день 0–6 — неделя 1) и за всё время:
//  - победы в набегах (кто получил добычу волны), лучшая волна, ночные вызовы, подволны выживания на арене;
//  - убито мобов набега (последний удар игрока; турели и ловушки — в счёт смены, не игрока);
//  - контракты бригадира (всем в сети в момент выполнения), звёздные осколки (звездопад), метеоритное железо (доля);
//  - рекорды гонок и тира (побитые чужие или свои, не эталон новой трассы), налёт (аэроклуб), сданное в фактории
//    (труд строк заказа; засчитывается тем, кто был у фактории, когда заказ пополнился, — сдал руками или привёз).
// Очки недели — NS_BRD_DEF (подсказка в /pochet): победа 10 + волна/5 (впервые +10, ночной вызов +5), моб 0,2,
// подволна выживания 1, контракт 15, осколок 2, метеоритное железо 0,5, рекорд 10, налёт 1 за 2 000 блоков (до 30
// в неделю), фактория 1 за «жетон труда» (труд строки / 30 — как плата заказа).
// Раз в 7 игровых дней (с рассветом) — «Работник недели»: лидер недели (от 10 очков). Запись в журнал смены, пункт в
// утренней сводке (shift/40_summary.js), салют над алтарём; лидеру — корона (золотой шлем с узором «Тишина» в
// алмазах, неломаемый, именной; кто был не в сети — получит при входе) и на неделю «Удача +1» и «+10 % к скорости
// добычи» (модификатор nightshift:week_champion; снимается сам, когда неделя короны кончилась).
// Табло — текст над алтарём базы (обновляется, когда кто-то ближе 64 блоков); /pochet place — перенести табло туда,
// где стоишь, /pochet place clear — назад к алтарю.
// Команды: /pochet (или /board) — неделя: места, очки, за что (наведи); /pochet all — за всё время.
// Оператор: /pochet test add <ник> <что> <n> | test week (подвести неделю сейчас) | test log (табло и места в лог) |
//   test display (поставить табло без игроков рядом) | test reset.
// Хуки (одна строка в каждом): raids/40_nightshift_raid.js (победа), raids/48_night_call.js (выживание),
// raids/14_contracts.js (контракт), sky/10_meteor.js (доля руды), sky/40_night_sky.js (звезда),
// zabava/20_race.js и zabava/30_tir.js (рекорд). Убийства, налёт и фактории считает этот файл.
// Состояние — server.persistentData «ns_board_json».
// KubeJS 2101 / Rhino: только var; тела обработчиков — в try.
// ==========================================================================

var NS_BRD = {
	key: 'ns_board_json',
	weekDays: 7,
	minPts: 10, // меньше — неделя без работника
	boardR: 64, // табло обновляется, когда кто-то ближе
	factR: 48, // «у фактории» — ближе стольких блоков от её центра
	top: 5, // мест в /pochet
	crownDays: 7,
}
// ключ → подпись, очков за единицу, потолок очков в неделю (0 — без потолка), единица в подписи
var NS_BRD_DEF = {
	raids: { name: 'побед в набегах', pts: 0 }, // очки победы — в nsBoardOnVictory (по волне)
	calls: { name: 'ночных вызовов', pts: 0 },
	kills: { name: 'мобов набега', pts: 0.2 },
	arena: { name: 'подволн выживания', pts: 1 },
	contracts: { name: 'контрактов', pts: 15 },
	shards: { name: 'звёздных осколков', pts: 2 },
	meteor: { name: 'метеоритного железа', pts: 0.5 },
	race: { name: 'рекордов трасс', pts: 10 },
	tir: { name: 'рекордов тира', pts: 10 },
	fly: { name: 'блоков налёта', pts: 1 / 2000, cap: 30 },
	fact: { name: 'жетонов труда в фактории', pts: 1 },
}
var NS_BRD_ORDER = ['raids', 'calls', 'kills', 'arena', 'contracts', 'shards', 'meteor', 'race', 'tir', 'fly', 'fact']
var NS_BRD_HOW =
	'Очки недели: победа в набеге — 10 + волна/5 (волна впервые — ещё 10, ночной вызов — ещё 5); 5 мобов набега — 1; ' +
	'подволна выживания — 1; контракт — 15; звёздный осколок — 2; 2 метеоритного железа — 1; рекорд трассы или тира — 10; ' +
	'2 000 блоков налёта — 1 (до 30 в неделю); фактория — 1 за жетон труда (сдал руками или был у фактории, когда пришёл груз). ' +
	'Раз в 7 игровых дней лидер (от ' + NS_BRD.minPts + ' очков) — работник недели: корона и на неделю «Удача +1», «+10 % к скорости добычи».'

// --------------------------------------------------------------------------
// Состояние
// --------------------------------------------------------------------------
function nsBrdDefault() {
	return { week: -1, ver: 0, p: {}, champs: [], crown: null, pos: null, fly: {} }
}
function nsBrdState() {
	if (NSG.nsBrd) return NSG.nsBrd
	var st = nsBrdDefault()
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_BRD.key)) st = Object.assign(st, JSON.parse(String(pd.getString(NS_BRD.key))))
	} catch (e) {
		console.warn('[почёт] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsBrd = st
	return st
}
function nsBrdSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_BRD.key, JSON.stringify(nsBrdState()))
		NSG.nsBrdDirty = false
	} catch (e) {}
}
function nsBrdDay() {
	try {
		return Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
	} catch (e) {
		return 0
	}
}
function nsBrdWeekOf(day) {
	return Math.floor(day / NS_BRD.weekDays)
}
// запись игрока; недельный счёт обнуляется сам, когда неделя сменилась
function nsBrdP(st, name) {
	var P = st.p[name]
	if (!P) P = st.p[name] = { a: {}, w: {}, wk: st.week }
	if (P.wk !== st.week) {
		P.w = {}
		P.wk = st.week
	}
	if (!P.w.pp) P.w.pp = {}
	return P
}
function nsBrdOnline(name) {
	try {
		return !!NSG.nsServer.getPlayerList().getPlayerByName(name)
	} catch (e) {
		return false
	}
}
function nsBrdR(x) {
	return Math.round(x * 10) / 10
}
function nsBrdPlural(n, one, few, many) {
	n = Math.round(n)
	var m10 = n % 10,
		m100 = n % 100
	if (m10 === 1 && m100 !== 11) return n + ' ' + one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few
	return n + ' ' + many
}
function nsBrdNum(n) {
	// 3 210 — с пробелом тысяч
	return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// --------------------------------------------------------------------------
// Счёт: nsBoardAdd(ник, ключ, сколько, [очки вместо расчёта], [force — без проверки «в сети»])
// Без force засчитывается только игроку в сети: боты-FakePlayer (деплоеры Create, проверки) имён в списке игроков не имеют.
// --------------------------------------------------------------------------
function nsBoardAdd(name, key, n, pts, force) {
	try {
		name = String(name)
		if (!name || !(n > 0) || name === 'турели и ловушки') return
		if (!force && !nsBrdOnline(name)) return
		var st = nsBrdState()
		if (st.week < 0) st.week = nsBrdWeekOf(nsBrdDay())
		var P = nsBrdP(st, name)
		var def = NS_BRD_DEF[key] || { pts: 0 }
		var add = pts !== undefined && pts !== null ? pts : n * def.pts
		if (def.cap) add = Math.max(0, Math.min(add, def.cap - (P.w.pp[key] || 0)))
		P.a[key] = (P.a[key] || 0) + n
		P.w[key] = (P.w[key] || 0) + n
		P.w.pp[key] = (P.w.pp[key] || 0) + add
		P.w.pts = (P.w.pts || 0) + add
		P.a.pts = (P.a.pts || 0) + add
		st.ver++
		NSG.nsBrdDirty = true
	} catch (e) {
		console.warn('[почёт] счёт ' + key + ': ' + e)
	}
}
function nsBrdMax(name, key, v) {
	var st = nsBrdState()
	var P = nsBrdP(st, String(name))
	if (!(P.a[key] >= v)) P.a[key] = v
	if (!(P.w[key] >= v)) P.w[key] = v
	st.ver++
	NSG.nsBrdDirty = true
}

// Победа в набеге (40_nightshift_raid.js, nsRaidVictory): names — кто получил добычу волны
function nsBoardOnVictory(d, raid, names, first) {
	var pts = 10 + Math.floor(d / 5) + (first ? 10 : 0) + (raid && raid.call ? 5 : 0)
	for (var i = 0; i < (names || []).length; i++) {
		var n = String(names[i])
		if (!nsBrdOnline(n)) continue
		nsBoardAdd(n, 'raids', 1, pts)
		if (raid && raid.call) nsBoardAdd(n, 'calls', 1, 0)
		nsBrdMax(n, 'best', d)
	}
}
// Выживание на арене (48_night_call.js, nsEndlessFinish): подволны — каждому, кто был на арене
function nsBoardOnEndless(names, subs) {
	for (var i = 0; i < (names || []).length; i++) {
		nsBoardAdd(names[i], 'arena', subs)
		if (nsBrdOnline(String(names[i]))) nsBrdMax(names[i], 'arenaBest', subs)
	}
}
// Контракт выполнен (14_contracts.js, nsCtComplete): всем в сети
function nsBoardOnContract() {
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) nsBoardAdd(String(ps[i].getUsername()), 'contracts', 1)
}

// Убийство моба набега — последний удар игрока (nsCtKiller из 14_contracts.js)
EntityEvents.death(event => {
	try {
		var e = event.entity
		if (!e || e.isPlayer() || !e.getTags().contains('nightshift_raid')) return
		var who = typeof nsCtKiller === 'function' ? nsCtKiller(event.source) : null
		if (who) nsBoardAdd(who, 'kills', 1)
	} catch (x) {}
})

// --------------------------------------------------------------------------
// Налёт (аэроклуб, aviation/20_aeroclub.js пишет p.persistentData «ns_aeroclub».dist): прирост с прошлого замера
// --------------------------------------------------------------------------
function nsBrdFlySample(p) {
	var name = String(p.getUsername())
	var dist = 0
	try {
		var raw = p.persistentData.getString('ns_aeroclub')
		if (raw) dist = Number(JSON.parse(String(raw)).dist) || 0
	} catch (e) {
		return
	}
	var st = nsBrdState()
	var last = st.fly[name]
	if (last === undefined || dist < last) {
		st.fly[name] = dist // первый замер или налёт сбросили — точка отсчёта
		NSG.nsBrdDirty = true
		return
	}
	if (dist - last >= 1) {
		nsBoardAdd(name, 'fly', Math.round(dist - last))
		st.fly[name] = dist
	}
}

// --------------------------------------------------------------------------
// Фактории: прирост сданного по заказам (FactoryApi.listJson) — тем, кто у фактории
// --------------------------------------------------------------------------
var NS_BRD_W = null
function nsBrdWeight(id) {
	if (!NS_BRD_W) {
		NS_BRD_W = {}
		try {
			for (var i = 0; i < NSF_ITEMS.length; i++) NS_BRD_W[NSF_ITEMS[i][0]] = NSF_ITEMS[i][1]
			for (var c = 0; c < NSF_CHAINS.length; c++)
				for (var s = 0; s < NSF_CHAINS[c].steps.length; s++) {
					var its = NSF_CHAINS[c].steps[s].items
					for (var k = 0; k < its.length; k++) if (NS_BRD_W[its[k].id] === undefined) NS_BRD_W[its[k].id] = its[k].w
				}
		} catch (e) {}
	}
	return NS_BRD_W[id] || 1
}
function nsBrdFactTick() {
	if (typeof NSF_API === 'undefined' || !NSF_API) return
	var list = JSON.parse(String(NSF_API.listJson()))
	var prev = NSG.nsBrdFact
	var cur = {}
	for (var i = 0; i < list.length; i++) {
		var f = list[i]
		var snap = { cash: f.cash, no: f.order ? f.order.no : -1, lines: {} }
		if (f.order) for (var l = 0; l < f.order.lines.length; l++) snap.lines[f.order.lines[l].id] = [Math.min(f.order.lines[l].have, f.order.lines[l].need), f.order.lines[l].need]
		cur[f.id] = snap
		var was = prev ? prev[f.id] : null
		if (!was || was.no < 0) continue
		var labour = 0
		if (was.no === snap.no) {
			for (var id in snap.lines) if (was.lines[id]) labour += Math.max(0, snap.lines[id][0] - was.lines[id][0]) * nsBrdWeight(id)
		} else if (snap.cash > was.cash) {
			// заказ закрылся между замерами: касса выросла — досдали остаток (сгоревший кассу не пополняет)
			for (var id2 in was.lines) labour += Math.max(0, was.lines[id2][1] - was.lines[id2][0]) * nsBrdWeight(id2)
		}
		if (labour > 0) nsBrdFactCredit(f, labour / 30)
	}
	NSG.nsBrdFact = cur
}
function nsBrdFactCredit(f, tokens) {
	var near = []
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		if (String(p.getLevel().getDimension()) !== 'minecraft:overworld') continue
		var dx = p.getX() - f.x,
			dz = p.getZ() - f.z
		if (dx * dx + dz * dz <= NS_BRD.factR * NS_BRD.factR) near.push(String(p.getUsername()))
	}
	var st = nsBrdState()
	st.factTeam = (st.factTeam || 0) + tokens // всё сданное (и автоматикой) — в счёт смены
	NSG.nsBrdDirty = true
	for (var j = 0; j < near.length; j++) nsBoardAdd(near[j], 'fact', tokens / near.length)
}

// --------------------------------------------------------------------------
// Места недели и рекорды
// --------------------------------------------------------------------------
function nsBrdRank(st, week) {
	var rows = []
	for (var n in st.p) {
		var P = st.p[n]
		if (P.wk !== week || !(P.w.pts > 0)) continue
		rows.push({ n: n, pts: P.w.pts, w: P.w })
	}
	rows.sort(function (a, b) {
		return b.pts - a.pts || (b.w.kills || 0) - (a.w.kills || 0) || (a.n < b.n ? -1 : 1)
	})
	return rows
}
// «3 победы (лучшая 34), 120 мобов, 6 осколков» — по убыванию очков, до max пунктов
function nsBrdWhy(w, max) {
	var parts = []
	var keys = NS_BRD_ORDER.slice()
	keys.sort(function (a, b) {
		return ((w.pp || {})[b] || 0) - ((w.pp || {})[a] || 0)
	})
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i]
		if (!(w[k] > 0)) continue
		var s = NS_BRD_DEF[k].name + ' ' + nsBrdNum(w[k])
		if (k === 'raids' && w.best) s += ' (лучшая волна ' + w.best + ')'
		if (k === 'arena' && w.arenaBest) s += ' (лучший забег ' + w.arenaBest + ')'
		parts.push(s)
		if (max && parts.length >= max) break
	}
	return parts.join(', ')
}
// Рекорды, которые держит каждый сейчас: трассы (первое место) и тир (режим и класс оружия)
function nsBrdHeld() {
	var out = {}
	var inc = function (n, k) {
		out[n] = out[n] || { race: 0, tir: 0 }
		out[n][k]++
	}
	try {
		var tr = nsRaceState().tracks
		for (var id in tr) if (tr[id].best && tr[id].best.length) inc(tr[id].best[0].n, 'race')
	} catch (e) {}
	try {
		var R = nsTirRecs()
		for (var k in R) if (R[k] && R[k].length) inc(R[k][0].n, 'tir')
	} catch (e) {}
	return out
}

// --------------------------------------------------------------------------
// Работник недели: подвести неделю, корона, бафф
// --------------------------------------------------------------------------
function nsBrdRollover(st, cur) {
	var prev = st.week
	var rows = nsBrdRank(st, prev)
	st.week = cur
	st.ver++
	var top = rows.length && rows[0].pts >= NS_BRD.minPts ? rows[0] : null
	if (!top) {
		console.info('[почёт] неделя ' + (prev + 1) + ' подведена без работника' + (rows.length ? ' (лучший ' + rows[0].n + ', ' + nsBrdR(rows[0].pts) + ' очк.)' : ''))
		nsBrdSave()
		return null
	}
	var day0 = cur * NS_BRD.weekDays
	var champ = {
		wk: prev,
		name: top.n,
		pts: Math.round(top.pts),
		why: nsBrdWhy(top.w, 4),
		day: day0,
		until: day0 + NS_BRD.crownDays,
		top: rows.slice(0, 3).map(function (r) {
			return [r.n, Math.round(r.pts)]
		}),
		given: false,
	}
	st.champs.push(champ)
	if (st.champs.length > 30) st.champs.splice(0, st.champs.length - 30)
	st.crown = champ
	nsBrdSave()
	console.info('[почёт] работник недели ' + (prev + 1) + ': ' + top.n + ' — ' + champ.pts + ' очк. (' + champ.why + '); места: ' + JSON.stringify(champ.top))
	if (typeof nsJournal === 'function') nsJournal('board', '♛ Работник недели ' + (prev + 1) + ' — ' + top.n + ': ' + nsBrdPlural(champ.pts, 'очко', 'очка', 'очков') + ' (' + champ.why + ')', 'gold')
	// салют над алтарём базы (shift/30_salute.js)
	try {
		var a = nsHomeAltar(nsGetStateRO())
		if (a) NSG.nsSalute = { x: a.x + 0.5, y: a.y, z: a.z + 0.5, dim: a.dim, left: 20, big: false }
	} catch (e) {}
	var p = NSG.nsServer.getPlayerList().getPlayerByName(top.n)
	if (p) nsBrdCrownGive(p)
	return champ
}

// Корона — золотой шлем с узором «Тишина» в алмазах, неломаемый, именной; при входе, если не выдана
function nsBrdCrownItem(c) {
	var name = JSON.stringify({ text: 'Корона работника недели', color: 'gold', bold: true, italic: false })
	var l1 = JSON.stringify({ text: 'Неделя ' + (c.wk + 1) + ' · ' + c.name + ' · ' + nsBrdPlural(c.pts, 'очко', 'очка', 'очков'), color: 'yellow', italic: false })
	var l2 = JSON.stringify({ text: 'Доска почёта смены', color: 'gray', italic: false })
	return "minecraft:golden_helmet[minecraft:custom_name='" + name + "',minecraft:lore=['" + l1 + "','" + l2 + "'],minecraft:unbreakable={show_in_tooltip:false},minecraft:trim={pattern:\"minecraft:silence\",material:\"minecraft:diamond\",show_in_tooltip:false},minecraft:enchantment_glint_override=true,minecraft:rarity=\"epic\"]"
}
function nsBrdCrownGive(p) {
	var st = nsBrdState()
	var c = st.crown
	var name = String(p.getUsername())
	if (!c || c.given || c.name !== name || nsBrdDay() >= c.until) return
	c.given = true
	nsBrdSave()
	var srv = NSG.nsServer
	srv.runCommandSilent('give ' + name + ' ' + nsBrdCrownItem(c))
	srv.runCommandSilent('title ' + name + ' times 10 80 20')
	srv.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: 'Корона в инвентаре · «Удача +1» и «+10 % к скорости добычи» на неделю', color: 'yellow' }))
	srv.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: '♛ Работник недели', color: 'gold', bold: true }))
	srv.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 1 1')
	nsBrdBuff(p, true)
}
// Бафф работника недели: Удача +1 и +10 % к скорости добычи, пока идёт неделя короны (снимается сам)
function nsBrdBuff(p, force) {
	var name = String(p.getUsername())
	var st = nsBrdState()
	var want = !!(st.crown && st.crown.name === name && nsBrdDay() < st.crown.until)
	NSG.nsBrdBuffed = NSG.nsBrdBuffed || {}
	if (!force && NSG.nsBrdBuffed[name] === want) return
	NSG.nsBrdBuffed[name] = want
	var srv = NSG.nsServer
	srv.runCommandSilent('attribute ' + name + ' minecraft:generic.luck modifier remove nightshift:week_champion')
	srv.runCommandSilent('attribute ' + name + ' minecraft:player.block_break_speed modifier remove nightshift:week_champion')
	if (!want) return
	srv.runCommandSilent('attribute ' + name + ' minecraft:generic.luck modifier add nightshift:week_champion 1 add_value')
	srv.runCommandSilent('attribute ' + name + ' minecraft:player.block_break_speed modifier add nightshift:week_champion 0.1 add_multiplied_base')
}

// Пункт утренней сводки (shift/40_summary.js): в первый день недели — работник, в последний — лидер недели
function nsBoardSummaryChip(day) {
	var st = nsBrdState()
	var c = st.crown
	if (c && c.day === day) {
		var hover = [{ text: '♛ Работник недели ' + (c.wk + 1) + ': ' + c.name + '\n', color: 'gold' }, { text: nsBrdPlural(c.pts, 'очко', 'очка', 'очков') + ' — ' + c.why + '\n', color: 'white' }]
		for (var i = 1; i < (c.top || []).length; i++) hover.push({ text: i + 1 + '-е место: ' + c.top[i][0] + ' — ' + c.top[i][1] + '\n', color: 'gray' })
		hover.push({ text: 'Корона и на неделю «Удача +1», «+10 % к скорости добычи». Новая неделя — счёт с нуля.\nКлик — /pochet', color: 'dark_gray' })
		return { text: '♛ Работник недели — ' + c.name, color: 'light_purple', hover: hover, click: { action: 'run_command', value: '/pochet' }, plain: 'Работник недели — ' + c.name + ' (' + c.pts + ')' }
	}
	if (day % NS_BRD.weekDays === NS_BRD.weekDays - 1) {
		var rows = nsBrdRank(st, nsBrdWeekOf(day))
		if (!rows.length) return null
		var lead = rows[0]
		var h2 = [{ text: 'Последний день недели — завтра с рассветом работник недели получит корону.\n', color: 'gold' }]
		for (var j = 0; j < rows.length && j < 3; j++) h2.push({ text: j + 1 + '. ' + rows[j].n + ' — ' + Math.round(rows[j].pts) + '\n', color: j ? 'white' : 'yellow' })
		h2.push({ text: 'Клик — /pochet', color: 'dark_gray' })
		return { text: 'Лидер недели — ' + lead.n + ' (' + Math.round(lead.pts) + ')', color: 'light_purple', hover: h2, click: { action: 'run_command', value: '/pochet' }, plain: 'Лидер недели — ' + lead.n + ' (' + Math.round(lead.pts) + ')' }
	}
	return null
}

// --------------------------------------------------------------------------
// Табло над алтарём базы (text_display, как табло тира и гонок)
// --------------------------------------------------------------------------
function nsBrdPos(st) {
	if (st.pos) return st.pos
	var a = nsHomeAltar(nsGetStateRO())
	return a ? { dim: a.dim, x: a.x + 0.5, y: a.y + 3.4, z: a.z + 0.5 } : null
}
function nsBrdBoardText(st) {
	var day = nsBrdDay()
	var wk = nsBrdWeekOf(day)
	var ex = [{ text: 'ДОСКА ПОЧЁТА СМЕНЫ\n', color: 'gold', bold: true }, { text: 'Неделя ' + (wk + 1) + ' · день ' + ((day % NS_BRD.weekDays) + 1) + ' из ' + NS_BRD.weekDays + '\n', color: 'gray' }]
	var c = st.crown
	if (c && day < c.until) ex.push({ text: '♛ Работник недели: ' + c.name + '\n', color: 'light_purple' })
	var rows = nsBrdRank(st, wk)
	if (!rows.length) ex.push({ text: 'Очков пока нет: набеги, звёзды,\nметеорит, фактории, рекорды\n', color: 'white' })
	for (var i = 0; i < rows.length && i < 3; i++) ex.push({ text: i + 1 + '. ' + rows[i].n + ' — ' + Math.round(rows[i].pts) + '\n', color: i ? 'white' : 'yellow' }, { text: '   ' + nsBrdWhy(rows[i].w, 2) + '\n', color: 'gray' })
	var tot = { raids: 0, kills: 0, shards: 0 }
	for (var n in st.p) for (var k in tot) tot[k] += st.p[n].a[k] || 0
	ex.push({ text: 'За всё время: побед ' + nsBrdNum(tot.raids) + ' · мобов ' + nsBrdNum(tot.kills) + ' · осколков ' + nsBrdNum(tot.shards) + '\n', color: 'dark_gray' })
	ex.push({ text: '/pochet — кто и за что', color: 'aqua' })
	return { text: '', extra: ex }
}
function nsBrdBoardTick(force) {
	var st = nsBrdState()
	var pos = nsBrdPos(st)
	if (!pos) return 'нет алтаря базы'
	var level = NSG.nsServer.getLevel(pos.dim)
	if (!level) return 'нет измерения ' + pos.dim
	if (!force) {
		var near = false
		var ps = level.getPlayers()
		for (var i = 0; i < ps.length && !near; i++) {
			var dx = ps[i].getX() - pos.x,
				dz = ps[i].getZ() - pos.z
			if (dx * dx + dz * dz < NS_BRD.boardR * NS_BRD.boardR) near = true
		}
		if (!near) return 'никого рядом'
	}
	var have = nsFunFind(level, pos.x, pos.y, pos.z, 3, 'ns_board')
	var ver = st.ver + ':' + nsBrdDay() + ':' + pos.x + ',' + pos.y + ',' + pos.z
	var text = JSON.stringify(JSON.stringify(nsBrdBoardText(st)))
	if (!have.length) {
		NSG.nsServer.runCommandSilent('execute in ' + pos.dim + ' run summon minecraft:text_display ' + pos.x.toFixed(2) + ' ' + pos.y.toFixed(2) + ' ' + pos.z.toFixed(2) + ' {Tags:["ns_fun_npc","ns_board"],billboard:"center",alignment:"center",line_width:240,view_range:2f,shadow:1b,background:1140850688,brightness:{sky:15,block:15},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.2f,1.2f,1.2f]},text:' + text + '}')
		NSG.nsBrdBoardVer = ver
		return 'поставлено'
	}
	if (NSG.nsBrdBoardVer !== ver) {
		NSG.nsServer.runCommandSilent('execute in ' + pos.dim + ' run data merge entity ' + have[0].getStringUuid() + ' {text:' + text + '}')
		for (var h = 1; h < have.length; h++) have[h].discard()
		NSG.nsBrdBoardVer = ver
		return 'обновлено'
	}
	return 'без изменений'
}
// убрать табло у старой точки (перенос /pochet place)
function nsBrdBoardRemove(pos) {
	if (!pos) return
	try {
		var have = nsFunFind(NSG.nsServer.getLevel(pos.dim), pos.x, pos.y, pos.z, 4, 'ns_board')
		for (var i = 0; i < have.length; i++) have[i].discard()
	} catch (e) {}
	NSG.nsBrdBoardVer = null
}
// табло со старой точки (чанк был не загружен при переносе) — не пускать в мир
EntityEvents.spawned('minecraft:text_display', event => {
	try {
		var e = event.entity
		if (!e.getTags().contains('ns_board')) return
		var pos = nsBrdPos(nsBrdState())
		if (pos && String(e.getLevel().getDimension()) === pos.dim && Math.abs(e.getX() - pos.x) < 4 && Math.abs(e.getY() - pos.y) < 4 && Math.abs(e.getZ() - pos.z) < 4) return
	} catch (x) {
		return
	}
	event.cancel()
})

// --------------------------------------------------------------------------
// Тик: неделя (раз в секунду), налёт и фактории (раз в 5 с), табло и бафф (раз в 2 с / 10 с), сохранение
// --------------------------------------------------------------------------
var nsBrdTickN = 0
var nsBrdSec = 0
ServerEvents.tick(event => {
	if (++nsBrdTickN % 20 !== 11) return
	var sec = ++nsBrdSec
	try {
		if (!NSG.nsServer) return
		var st = nsBrdState()
		var wk = nsBrdWeekOf(nsBrdDay())
		if (st.week < 0) {
			st.week = wk
			nsBrdSave()
		} else if (wk > st.week) nsBrdRollover(st, wk)
		else if (wk < st.week) {
			st.week = wk // время откатили командой — новая неделя без итогов
			st.ver++
			nsBrdSave()
		}
		var ps = NSG.nsServer.getPlayers()
		if (sec % 5 === 0) {
			for (var i = 0; i < ps.length; i++) nsBrdFlySample(ps[i])
			try {
				nsBrdFactTick()
			} catch (e1) {
				console.warn('[почёт] фактории: ' + e1)
			}
		}
		if (sec % 10 === 0) for (var j = 0; j < ps.length; j++) nsBrdBuff(ps[j], false)
		if (sec % 2 === 0 && ps.length) nsBrdBoardTick(false)
		if (NSG.nsBrdDirty && sec % 5 === 0) nsBrdSave()
	} catch (e) {
		console.error('[почёт] тик: ' + e)
	}
})

PlayerEvents.loggedIn(event => {
	try {
		var p = event.getPlayer()
		nsBrdBuff(p, true)
		event.server.scheduleInTicks(200, function () {
			try {
				var q = NSG.nsServer.getPlayerList().getPlayerByName(String(p.getUsername()))
				if (q) nsBrdCrownGive(q)
			} catch (e) {}
		})
	} catch (e) {}
})
PlayerEvents.respawned(event => {
	try {
		nsBrdBuff(event.getEntity(), true)
	} catch (e) {}
})
PlayerEvents.loggedOut(event => {
	try {
		nsBrdFlySample(event.getPlayer())
		if (NSG.nsBrdBuffed) delete NSG.nsBrdBuffed[String(event.getPlayer().getUsername())]
		if (NSG.nsBrdDirty) nsBrdSave()
	} catch (e) {}
})

// --------------------------------------------------------------------------
// Команды
// --------------------------------------------------------------------------
function nsBrdTell(src, parts) {
	var p = src.getPlayer()
	if (p) NSG.nsServer.runCommandSilent('tellraw ' + String(p.getUsername()) + ' ' + JSON.stringify(parts))
	else {
		var s = ''
		for (var i = 0; i < parts.length; i++) s += typeof parts[i] === 'string' ? parts[i] : parts[i].text || ''
		console.info('[почёт] ' + s)
	}
}
function nsBrdHover(text) {
	return { action: 'show_text', contents: text }
}
// Строка игрока: очки и «за что» (наведи)
function nsBrdRowHover(w) {
	var out = ['']
	for (var i = 0; i < NS_BRD_ORDER.length; i++) {
		var k = NS_BRD_ORDER[i]
		if (!(w[k] > 0)) continue
		var pp = (w.pp || {})[k] || 0
		out.push({ text: NS_BRD_DEF[k].name + ': ' + nsBrdNum(w[k]) + (k === 'raids' && w.best ? ' (лучшая волна ' + w.best + ')' : '') + (k === 'arena' && w.arenaBest ? ' (лучший забег ' + w.arenaBest + ')' : ''), color: 'white' }, { text: pp > 0 ? ' → ' + nsBrdR(pp) + ' очк.\n' : '\n', color: 'gray' })
	}
	if (out.length === 1) out.push({ text: 'пока пусто', color: 'gray' })
	return out
}
function nsBrdShowWeek(src) {
	var st = nsBrdState()
	var day = nsBrdDay()
	var wk = nsBrdWeekOf(day)
	var me = src.getPlayer() ? String(src.getPlayer().getUsername()) : null
	nsBrdTell(src, [
		{ text: '— Доска почёта: неделя ' + (wk + 1) + ', день ' + ((day % NS_BRD.weekDays) + 1) + ' из ' + NS_BRD.weekDays + ' (наведи на имя — за что очки) —', color: 'gold' },
	])
	var rows = nsBrdRank(st, wk)
	if (!rows.length) nsBrdTell(src, [{ text: ' Очков на этой неделе пока нет — набеги, звёзды, метеорит, фактории, рекорды.', color: 'gray' }])
	var mine = -1
	for (var i = 0; i < rows.length; i++) {
		if (rows[i].n === me) mine = i
		if (i >= NS_BRD.top) continue
		nsBrdTell(src, [
			{ text: ' ' + (i + 1) + '. ', color: 'dark_gray' },
			{ text: rows[i].n, color: i ? 'white' : 'yellow', hoverEvent: nsBrdHover(nsBrdRowHover(rows[i].w)) },
			{ text: ' — ' + nsBrdPlural(Math.round(rows[i].pts), 'очко', 'очка', 'очков'), color: 'gray' },
			{ text: ' · ' + nsBrdWhy(rows[i].w, 2), color: 'dark_gray' },
		])
	}
	if (mine >= NS_BRD.top) nsBrdTell(src, [{ text: ' Ты — ' + (mine + 1) + '-й: ' + nsBrdPlural(Math.round(rows[mine].pts), 'очко', 'очка', 'очков'), color: 'gray', hoverEvent: nsBrdHover(nsBrdRowHover(rows[mine].w)) }])
	var c = st.crown
	if (c) {
		var past = []
		for (var j = st.champs.length - 2; j >= 0 && past.length < 3; j--) past.push(st.champs[j].name + ' (' + (st.champs[j].wk + 1) + ')')
		nsBrdTell(src, [
			{ text: ' ♛ Работник недели ' + (c.wk + 1) + ': ', color: 'light_purple' },
			{ text: c.name, color: 'gold', hoverEvent: nsBrdHover([{ text: nsBrdPlural(c.pts, 'очко', 'очка', 'очков') + ' — ' + c.why, color: 'white' }]) },
			{ text: day < c.until ? ' — корона и удача до дня ' + c.until : '', color: 'gray' },
			{ text: past.length ? '. Прежние: ' + past.join(', ') : '', color: 'dark_gray' },
		])
	}
	var held = nsBrdHeld()
	var rec = []
	for (var n in held) {
		var s = []
		if (held[n].race) s.push('трасс ' + held[n].race)
		if (held[n].tir) s.push('тира ' + held[n].tir)
		rec.push(n + ' — ' + s.join(', '))
	}
	var rs = nsGetStateRO()
	var ar = rs.arenaRecord
	nsBrdTell(src, [
		{ text: ' Рекорды сейчас: ', color: 'gray' },
		{ text: rec.length ? rec.join('; ') : 'нет', color: 'white', hoverEvent: nsBrdHover('Первые места трасс (/race list) и тира по режимам и классам оружия (/tir top). Клик — трассы'), clickEvent: { action: 'run_command', value: '/race list' } },
		{ text: ar ? ' · арена — ' + nsBrdPlural(ar.subs, 'подволна', 'подволны', 'подволн') + ' (' + ar.names.join(', ') + ')' : '', color: 'gray' },
	])
	nsBrdTell(src, [
		{ text: ' [Как считаются очки]', color: 'yellow', hoverEvent: nsBrdHover(NS_BRD_HOW) },
		{ text: ' · ', color: 'dark_gray' },
		{ text: '[За всё время]', color: 'yellow', clickEvent: { action: 'run_command', value: '/pochet all' }, hoverEvent: nsBrdHover('/pochet all') },
		{ text: ' · табло — над алтарём базы', color: 'dark_gray' },
	])
	return 1
}
function nsBrdShowAll(src) {
	var st = nsBrdState()
	var rows = []
	for (var n in st.p) if (st.p[n].a.pts > 0) rows.push({ n: n, a: st.p[n].a })
	rows.sort(function (a, b) {
		return b.a.pts - a.a.pts
	})
	nsBrdTell(src, [{ text: '— Доска почёта за всё время (наведи на имя — всё по пунктам) —', color: 'gold' }])
	if (!rows.length) nsBrdTell(src, [{ text: ' пока пусто', color: 'gray' }])
	var crowns = {}
	for (var c = 0; c < st.champs.length; c++) crowns[st.champs[c].name] = (crowns[st.champs[c].name] || 0) + 1
	for (var i = 0; i < rows.length && i < 15; i++) {
		var a = rows[i].a
		nsBrdTell(src, [
			{ text: ' ' + (i + 1) + '. ', color: 'dark_gray' },
			{ text: rows[i].n, color: i ? 'white' : 'yellow', hoverEvent: nsBrdHover(nsBrdRowHover(a)) },
			{ text: crowns[rows[i].n] ? ' ♛×' + crowns[rows[i].n] : '', color: 'light_purple' },
			{ text: ' — ' + nsBrdWhy(a, 3), color: 'gray' },
		])
	}
	nsBrdTell(src, [{ text: ' Смена сдала в фактории на ' + nsBrdPlural(Math.round(st.factTeam || 0), 'жетон', 'жетона', 'жетонов') + ' труда (с автоматикой).', color: 'dark_gray' }])
	return 1
}
function nsBrdLog() {
	var st = nsBrdState()
	var day = nsBrdDay()
	var rows = nsBrdRank(st, nsBrdWeekOf(day))
	console.info('[почёт] день ' + day + ', неделя ' + (nsBrdWeekOf(day) + 1) + ' (в состоянии ' + (st.week + 1) + '), мест ' + rows.length + ': ' + rows.map(function (r) { return r.n + ' ' + nsBrdR(r.pts) + ' (' + nsBrdWhy(r.w) + ')' }).join('; '))
	console.info('[почёт] корона: ' + JSON.stringify(st.crown) + '; работников было: ' + st.champs.length + '; фактории смене: ' + nsBrdR(st.factTeam || 0))
	var t = nsBrdBoardText(st)
	console.info('[почёт] табло: ' + t.extra.map(function (e) { return e.text }).join('').replace(/\n/g, ' | '))
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	var op = function (s) {
		return s.hasPermission(2)
	}
	var safe = function (what, fn) {
		try {
			return fn() || 1
		} catch (e) {
			console.error('[почёт] /pochet ' + what + ': ' + e)
			return 0
		}
	}
	var reg = function (lit) {
		event.register(
			C.literal(lit)
				.executes(ctx => safe('', () => nsBrdShowWeek(ctx.source)))
				.then(C.literal('all').executes(ctx => safe('all', () => nsBrdShowAll(ctx.source))))
				.then(
					C.literal('place')
						.executes(ctx =>
							safe('place', () => {
								var p = ctx.source.getPlayer()
								if (!p) return 0
								var st = nsBrdState()
								nsBrdBoardRemove(nsBrdPos(st))
								st.pos = { dim: String(p.getLevel().getDimension()), x: Math.floor(p.getX()) + 0.5, y: Math.floor(p.getY()) + 2.6, z: Math.floor(p.getZ()) + 0.5 }
								st.ver++
								nsBrdSave()
								ctx.source.sendSystemMessage(Text.gold('[Почёт] ').append(Text.white('Табло доски почёта — здесь. Вернуть к алтарю — /pochet place clear.')))
								return 1
							})
						)
						.then(
							C.literal('clear').executes(ctx =>
								safe('place clear', () => {
									var st = nsBrdState()
									nsBrdBoardRemove(nsBrdPos(st))
									st.pos = null
									st.ver++
									nsBrdSave()
									ctx.source.sendSystemMessage(Text.gold('[Почёт] ').append(Text.white('Табло снова над алтарём базы.')))
									return 1
								})
							)
						)
				)
				.then(
					C.literal('test')
						.requires(op)
						.then(
							C.literal('add').then(
								C.argument('name', A.STRING.create(event)).then(
									C.argument('what', A.STRING.create(event)).then(
										C.argument('n', A.INTEGER.create(event)).executes(ctx =>
											safe('test add', () => {
												var nm = String(A.STRING.getResult(ctx, 'name'))
												var what = String(A.STRING.getResult(ctx, 'what'))
												var n = Number(A.INTEGER.getResult(ctx, 'n'))
												if (what === 'win') nsBrdTestWin(nm, n)
												else if (!NS_BRD_DEF[what]) {
													ctx.source.sendSystemMessage(Text.gray('что: win <волна> | ' + NS_BRD_ORDER.join(' | ')))
													return 0
												} else nsBoardAdd(nm, what, n, undefined, true)
												nsBrdLog()
												return 1
											})
										)
									)
								)
							)
						)
						.then(
							C.literal('week').executes(ctx =>
								safe('test week', () => {
									var st = nsBrdState()
									var c = nsBrdRollover(st, st.week + 1)
									ctx.source.sendSystemMessage(Text.gray('[почёт] неделя подведена: ' + (c ? c.name + ', ' + c.pts : 'без работника')))
									nsBrdLog()
									return 1
								})
							)
						)
						.then(C.literal('log').executes(ctx => safe('test log', () => nsBrdLog())))
						.then(
							C.literal('display').executes(ctx =>
								safe('test display', () => {
									var r = nsBrdBoardTick(true)
									console.info('[почёт] табло: ' + r + ' в ' + JSON.stringify(nsBrdPos(nsBrdState())))
									return 1
								})
							)
						)
						.then(
							C.literal('reset').executes(ctx =>
								safe('test reset', () => {
									var pos = nsBrdPos(nsBrdState())
									NSG.nsBrd = nsBrdDefault()
									nsBrdSave()
									nsBrdBoardRemove(pos)
									ctx.source.sendSystemMessage(Text.gray('[почёт] доска очищена'))
									return 1
								})
							)
						)
				)
		)
	}
	reg('pochet')
	reg('board')
})

// проверка без клиента: победа на волне d для ника (как nsBoardOnVictory, без проверки «в сети»)
function nsBrdTestWin(name, d) {
	nsBoardAdd(name, 'raids', 1, 10 + Math.floor(d / 5), true)
	var st = nsBrdState()
	var P = nsBrdP(st, name)
	if (!(P.a.best >= d)) P.a.best = d
	if (!(P.w.best >= d)) P.w.best = d
}

ServerEvents.loaded(event => {
	NSG.nsBrd = null
	NSG.nsBrdFact = null
})
