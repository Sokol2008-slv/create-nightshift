// ==========================================================================
// Ночная смена — «Контракты бригадира» (01.10.2026; Георгий: «механики замутить, новый эндгейм»). Три задания на
// команду: убить столько-то мобов вида X в набегах, пройти волну с условием смены, победить на арене в теме,
// пройти волну без смертей, завалить босса. Награда — всей команде в сети: гарантированный артефакт смены (как
// с волны повыше), ресурсы, иногда «Сердце ночи». Выполненный контракт меняется на новый с рассветом; висящий
// дольше 3 игровых дней — тоже. Цели — по лучшей пройденной волне (state.phase).
// Хуки: победа — nsContractsOnVictory (40_nightshift_raid.js), меню алтаря — nsContractsRows (30_), убийства и
// смерти — здесь. Команда: /nscontracts.
// ==========================================================================
var NS_CT_SLOTS = 3
var NS_CT_EXPIRE_DAYS = 3

function nsCtDay() {
	try {
		return Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
	} catch (e) {
		return 0
	}
}

function nsCtRand(list) {
	return list[Math.floor(Math.random() * list.length)]
}

// Мобы для «убей N»: модовые из пула волн (08_modded_waves.js) или ванильные до 16-й
function nsCtKillTarget(best) {
	if (best >= 15 && typeof nsMwPool === 'function') {
		var pool = nsMwPool(Math.min(69, best + 3))
		var cand = []
		for (var i = 0; i < pool.length; i++) {
			var m = pool[i].m
			if (m.key === 'kamikaze' || m.key === 'kamikaze_heavy' || m.nbt.indexOf('CustomName') >= 0) continue
			cand.push(m)
		}
		if (cand.length) {
			var mm = nsCtRand(cand)
			return { id: mm.id, name: mm.name, need: Math.max(6, Math.min(80, Math.round(1500 / Math.max(10, mm.hp)))) }
		}
	}
	return nsCtRand([
		{ id: 'minecraft:zombie', name: 'зомби', need: 60 },
		{ id: 'minecraft:skeleton', name: 'скелетов', need: 40 },
		{ id: 'minecraft:spider', name: 'пауков', need: 30 },
		{ id: 'minecraft:phantom', name: 'фантомов', need: 15 },
	])
}

// Босс для «завали босса»: ArPhEx (15–65) или Cataclysm (70+) из уже открытых волн
function nsCtBossTarget(best) {
	var opts = []
	for (var w in NSG.NS_MOD_BOSSES || {}) if (Number(w) <= best + 1) opts.push(NSG.NS_MOD_BOSSES[w].boss)
	if (best + 1 >= 70) {
		var C = NSG.NS_CATACLYSM_BOSSES || []
		for (var c = 0; c < C.length; c++) if (C[c].from <= best + 1) opts.push({ id: C[c].id, label: C[c].label })
	}
	if (!opts.length) return null
	var b = nsCtRand(opts)
	return { id: b.id, name: b.label }
}

// Новый контракт под лучшую волну best (types — какие виды уже есть на доске, чтобы не дублировать)
function nsCtNew(best, have) {
	var kinds = ['kill', 'wave', 'clean']
	if (best >= 15) kinds.push('mutator', 'boss')
	if (best >= 1) kinds.push('arena')
	var free = []
	for (var k = 0; k < kinds.length; k++) if (have.indexOf(kinds[k]) < 0) free.push(kinds[k])
	var kind = nsCtRand(free.length ? free : kinds)
	var day = nsCtDay()
	var minWave = Math.max(1, best - 5)
	var c = { kind: kind, have: 0, need: 1, day: day, done: false }
	if (kind === 'kill') {
		var t = nsCtKillTarget(best)
		c.target = t.id
		c.need = t.need
		c.text = 'Убить в набегах: ' + t.name + ' — ' + t.need
	} else if (kind === 'wave') {
		c.wave = minWave
		c.text = 'Пройти волну ' + minWave + ' или выше'
	} else if (kind === 'clean') {
		c.wave = Math.max(1, best - 10)
		c.text = 'Пройти волну ' + c.wave + '+ без единой смерти'
	} else if (kind === 'mutator') {
		var m = nsCtRand(NSG.NS_MUTATORS || [{ key: 'double', name: 'Двойная смена' }])
		c.wave = Math.max(1, best - 8)
		c.mut = m.key
		c.text = 'Пройти волну ' + c.wave + '+ с условием «' + m.name + '»'
	} else if (kind === 'boss') {
		var b = nsCtBossTarget(best)
		if (!b) return nsCtNew(best, have.concat(['boss']))
		c.target = b.id
		c.text = 'Завалить босса: ' + b.name + ' (его волна или «Ночь боссов»)'
	} else {
		var themes = NSG.NS_ARENA_THEMES || []
		var open = []
		for (var i = 0; i < themes.length; i++) if (themes[i].from <= best + 1) open.push(themes[i])
		var th = open.length ? nsCtRand(open) : { key: 'shaft', name: 'Шахта', from: 1 }
		var to = null
		for (var j = 0; j < themes.length; j++) if (themes[j].from > th.from && (to === null || themes[j].from - 1 < to)) to = themes[j].from - 1
		c.theme = th.key
		c.wave = Math.max(th.from, 1)
		c.text = 'Победить на арене в теме «' + th.name + '» (волны ' + th.from + (to ? '–' + to : '+') + ')'
	}
	c.reward = nsCtReward(best, kind)
	return c
}

// Награда: волна, с которой гарантированно бросается артефакт смены, ресурсы и редкое
function nsCtReward(best, kind) {
	var bonus = kind === 'clean' || kind === 'mutator' || kind === 'boss' ? 10 : 5
	var r = { artWave: Math.max(1, best + bonus), items: [] }
	var tier = typeof nsWaveTier === 'function' ? nsWaveTier(Math.max(1, best)) : 1
	if (tier >= 9) r.items.push(['minecraft:netherite_ingot', 1])
	else if (tier >= 6) r.items.push(['minecraft:diamond', 4])
	else r.items.push(['minecraft:iron_ingot', 32])
	if ((kind === 'clean' || kind === 'boss') && best >= 30) r.items.push(['nightshift:night_heart', 1])
	if (kind === 'mutator' && best >= 70) r.items.push(['nightshift:star_fragment', 1])
	return r
}

// Доска контрактов: свежие на месте, выполненные — заменить с рассветом, протухшие — заменить
function nsCtBoard(st) {
	var best = st.phase || 0
	var day = nsCtDay()
	st.contracts = st.contracts || { list: [] }
	var list = st.contracts.list || []
	var out = []
	var kinds = []
	for (var i = 0; i < list.length; i++) {
		var c = list[i]
		var stale = day - (c.day || 0) >= NS_CT_EXPIRE_DAYS
		var spent = c.done && day > (c.doneDay || c.day || 0)
		if (stale || spent) continue
		out.push(c)
		kinds.push(c.kind)
	}
	var changed = out.length !== list.length
	while (out.length < NS_CT_SLOTS) {
		var n = nsCtNew(best, kinds)
		out.push(n)
		kinds.push(n.kind)
		changed = true
	}
	st.contracts.list = out
	if (changed) nsSaveState(st)
	return out
}

// Гарантированный артефакт смены «как с волны d»: бросаем до первого успеха (не дольше 40 раз)
function nsCtArtifact(d) {
	if (typeof NSG.nsNsArtifactRoll !== 'function') return []
	for (var k = 0; k < 40; k++) {
		var r = NSG.nsNsArtifactRoll(d, false, { arena: false, theme: null, bosses: [], players: 1 }) || []
		if (r.length) return r
	}
	return []
}

function nsCtComplete(st, c) {
	c.done = true
	c.doneDay = nsCtDay()
	nsSaveState(st)
	nsTellAll(Text.gold('[Ночная смена] Контракт бригадира выполнен: ').append(Text.white(c.text)))
	NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master @a')
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var got = c.reward.items.slice()
		got = got.concat(nsCtArtifact(c.reward.artWave))
		try {
			if (typeof nsGiveLoot === 'function') nsGiveLoot(players[i], got)
		} catch (e) {
			console.error('[nightshift] награда контракта: ' + e)
		}
	}
}

// Убийство моба набега — засчитать «убей N» и «завали босса»
EntityEvents.death(event => {
	try {
		var e = event.entity
		if (!e || e.isPlayer()) return
		if (!e.getTags().contains('nightshift_raid')) return
		var st = nsGetState()
		if (!st || !st.contracts || !st.contracts.list) return
		var id = String(e.getType())
		var list = st.contracts.list
		for (var i = 0; i < list.length; i++) {
			var c = list[i]
			if (c.done || (c.kind !== 'kill' && c.kind !== 'boss') || c.target !== id) continue
			c.have = (c.have || 0) + 1
			if (c.have >= c.need) nsCtComplete(st, c)
			else nsSaveState(st)
		}
	} catch (x) {}
})

// Смерть защитника во время набега — для «без единой смерти»
EntityEvents.death('minecraft:player', event => {
	try {
		var st = nsGetState()
		if (!st || !st.raid || st.raid.state !== 'active') return
		st.raid.deaths = (st.raid.deaths || 0) + 1
		nsSaveState(st)
	} catch (x) {}
})

// Победа в набеге (40_: nsRaidVictory, после наград): волна, условие, арена, без смертей
function nsContractsOnVictory(d, raid, altar) {
	var st = nsGetState()
	var list = nsCtBoard(st)
	var arena = !!(st.arena && altar && st.arena.altarId === altar.id)
	var theme = arena && NSG.nsArenaThemeFor ? NSG.nsArenaThemeFor(d).key : null
	for (var i = 0; i < list.length; i++) {
		var c = list[i]
		if (c.done) continue
		var ok = false
		if (c.kind === 'wave') ok = d >= c.wave
		else if (c.kind === 'clean') ok = d >= c.wave && !(raid.deaths > 0)
		else if (c.kind === 'mutator') ok = d >= c.wave && raid.mut && raid.mut[c.mut]
		else if (c.kind === 'arena') ok = arena && theme === c.theme
		if (ok) nsCtComplete(st, c)
	}
}

// Строки для меню алтаря
function nsContractsRows(state) {
	var list = nsCtBoard(state)
	var row = Text.gray('Контракты бригадира: ')
	for (var i = 0; i < list.length; i++) {
		var c = list[i]
		var prog = c.need > 1 ? ' ' + Math.min(c.have || 0, c.need) + '/' + c.need : ''
		var lbl = '[' + (c.done ? '✔ ' : '') + c.text + prog + ']'
		var items = []
		for (var k = 0; k < c.reward.items.length; k++) items.push(c.reward.items[k][1] + '× ' + c.reward.items[k][0].split(':')[1])
		var hover = Text.white(c.text).append(Text.gold('\nНаграда каждому: артефакт смены как с волны ' + c.reward.artWave + (items.length ? ', ' + items.join(', ') : ''))).append(Text.gray(c.done ? '\nВыполнен — с рассветом будет новый' : '\nВисит до 3 игровых дней'))
		row = row.append((c.done ? Text.green(lbl) : Text.yellow(lbl)).hover(hover)).append(Text.of(' '))
	}
	return row
}

ServerEvents.commandRegistry(event => {
	event.register(
		event.commands.literal('nscontracts').executes(ctx => {
			var p = ctx.source.getPlayer()
			if (!p) {
				// из консоли — списком в лог
				var L = nsCtBoard(nsGetState())
				for (var i = 0; i < L.length; i++) console.info('[nightshift] контракт ' + (i + 1) + ': ' + L[i].text + ' — ' + (L[i].have || 0) + '/' + L[i].need + (L[i].done ? ' (выполнен)' : '') + (L[i].target ? ' [' + L[i].target + ']' : ''))
				return 1
			}
			p.tell(nsContractsRows(nsGetState()))
			return 1
		})
	)
})
