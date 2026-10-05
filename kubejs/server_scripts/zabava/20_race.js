// ==========================================================================
// «Гонки по кольцам» (05.10.2026, поток T). Трассы в небе для самолётов, драконов и элитр — ставят сами игроки.
//
//  Трасса: /race new <название> → лети и ставь кольца: ПКМ «Маяком трассы» (или /race ring) — кольцо там, где ты,
//    плоскостью поперёк взгляда (смотри по ходу полёта); Shift+ПКМ (или /race undo) — убрать последнее;
//    /race radius <3–16> — радиус следующих колец; /race done — готово. Кольцо 1 — старт, последнее — финиш.
//  Заезд: /race start <название> (или кнопка в /race list) — старт с хода: таймер пошёл, когда пролетел стартовое
//    кольцо, стоп — на финишном. Кольца берутся по порядку; засчитывается пролёт сквозь плоскость кольца ближе
//    радиуса к центру (с любой стороны). Время — до сотых: момент пролёта между тиками считается по доле пути.
//    Над хотбаром: кольцо N/M, время, стрелка и расстояние до следующего, разница с рекордом на каждом кольце.
//    Следующее кольцо горит зелёным (видно до 512 блоков), за ним — белое; всем рядом трассы видны всегда.
//  Срыв: телепорт (>15 блоков за тик), смерть, смена измерения, 5 минут до старта, 2 минуты без нового кольца.
//  Рекорды: таблица 5 лучших на трассу (лучшее время каждого), табло над стартом (текст-дисплей), /race top.
//  Награда жетонами — только за рекорд трассы, и с защитой от фарма: трасса от 3 колец и 300 блоков, рекорд лучше
//    прежнего на 2 % (и хотя бы на 0,5 с), первый заезд — эталон (без награды), не больше 3 оплаченных рекордов на
//    трассу и 10 жетонов на игрока за игровой день; скорость больше 100 бл./с не засчитывается.
//    Награда = длина / 200 (1–6 жетонов).
//  Проверка без клиента: /race selftest <трасса> (оператор) — бот-FakePlayer пролетает кольца по прямой.
// Состояние — server.persistentData «ns_race_json»; заезды — в памяти (рестарт их обрывает).
// ==========================================================================

var NS_RACE = {
	maxTracks: 24,
	maxRings: 30,
	minRings: 3,
	minGap: 12, // между соседними кольцами
	radius: [3, 16, 6], // мин, макс, по умолчанию
	tpLimit: 15, // блоков за тик — дальше считаем телепортом
	startWait: 6000, // тиков до стартового кольца (5 мин)
	ringWait: 2400, // тиков между кольцами (2 мин)
	payMinLen: 300,
	payMinGain: 0.02,
	payMinGainTicks: 10,
	payPerDay: 3, // оплаченных рекордов на трассу за игровой день
	maxSpeed: 100, // бл./с
	showR: 160, // кольца трасс видны всем ближе
	boardR: 96,
}
var NS_RACE_KEY = 'ns_race_json'

function nsRaceDefault() {
	return { seq: 0, tracks: {}, edit: {}, rad: {} }
}
function nsRaceState() {
	if (NSG.nsRace) return NSG.nsRace
	var st = nsRaceDefault()
	try {
		var raw = String(NSG.nsServer.persistentData.getString(NS_RACE_KEY))
		if (raw.length) st = Object.assign(nsRaceDefault(), JSON.parse(raw))
	} catch (e) {
		console.warn('[гонки] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsRace = st
	return st
}
function nsRaceSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_RACE_KEY, JSON.stringify(nsRaceState()))
	} catch (e) {
		console.warn('[гонки] не сохранить: ' + e)
	}
}
NSG.nsRaceRuns = {}
NSG.nsRaceBoardVer = {}
NSG.nsRaceShow = {} // {имя: {id, until}} — /race show

// --------------------------------------------------------------------------
// Геометрия
// --------------------------------------------------------------------------
// центр тела игрока (в самолёте и на драконе — там, где сидит)
function nsRacePos(p) {
	return { x: Number(p.getX()), y: Number(p.getY()) + Number(p.getBbHeight()) * 0.5, z: Number(p.getZ()) }
}
// единичный вектор взгляда из yaw/pitch (Minecraft: yaw 0 — юг, +z)
function nsRaceLook(p) {
	var yaw = (Number(p.getYRot()) * Math.PI) / 180
	var pitch = Number(p.getXRot())
	if (Math.abs(pitch) < 12) pitch = 0 // почти горизонтально — кольцо ставим ровно вертикально
	pitch = (pitch * Math.PI) / 180
	return { x: -Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }
}
// два вектора в плоскости кольца
function nsRaceBasis(R) {
	var ux = R.nz,
		uy = 0,
		uz = -R.nx // n × вверх
	var l = Math.sqrt(ux * ux + uz * uz)
	if (l < 0.01) {
		ux = 1
		uz = 0
		l = 1
	}
	ux /= l
	uz /= l
	// v = u × n
	var vx = uy * R.nz - uz * R.ny,
		vy = uz * R.nx - ux * R.nz,
		vz = ux * R.ny - uy * R.nx
	return { ux: ux, uy: uy, uz: uz, vx: vx, vy: vy, vz: vz }
}
// пролёт отрезка a→b сквозь кольцо: доля пути 0…1 или −1
function nsRaceCross(a, b, R) {
	var da = (a.x - R.x) * R.nx + (a.y - R.y) * R.ny + (a.z - R.z) * R.nz
	var db = (b.x - R.x) * R.nx + (b.y - R.y) * R.ny + (b.z - R.z) * R.nz
	if ((da > 0 && db > 0) || (da < 0 && db < 0) || da === db) return -1
	var f = da / (da - db)
	var ix = a.x + (b.x - a.x) * f - R.x,
		iy = a.y + (b.y - a.y) * f - R.y,
		iz = a.z + (b.z - a.z) * f - R.z
	return ix * ix + iy * iy + iz * iz <= R.r * R.r ? f : -1
}
function nsRaceLen(t) {
	var len = 0
	for (var i = 1; i < t.rings.length; i++) {
		var a = t.rings[i - 1],
			b = t.rings[i]
		len += Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z))
	}
	return Math.round(len)
}

// --------------------------------------------------------------------------
// Частицы колец
// --------------------------------------------------------------------------
var NS_RACE_FX = null
function nsRaceFx() {
	if (NS_RACE_FX) return NS_RACE_FX
	NS_RACE_FX = {
		next: nsFunDust(0.2, 1, 0.35, 2.4),
		glow: nsFunSimple('glow'),
		then: nsFunSimple('end_rod'),
		ring: nsFunSimple('end_rod'),
		start: nsFunDust(1, 0.82, 0.1, 2),
		finish: nsFunDust(1, 0.15, 0.15, 2),
	}
	return NS_RACE_FX
}
function nsRaceDrawRing(level, p, R, spec, pts, spec2) {
	var B = nsRaceBasis(R)
	var off = Math.random() * Math.PI * 2
	for (var k = 0; k < pts; k++) {
		var a = off + (k * Math.PI * 2) / pts
		var c = Math.cos(a) * R.r,
			s = Math.sin(a) * R.r
		var x = R.x + c * B.ux + s * B.vx,
			y = R.y + c * B.uy + s * B.vy,
			z = R.z + c * B.uz + s * B.vz
		nsFunParticle(level, p, spec2 && k % 2 ? spec2 : spec, x, y, z)
	}
}
function nsRaceRingSpec(t, i) {
	var fx = nsRaceFx()
	if (i === 0) return fx.start
	if (i === t.rings.length - 1) return fx.finish
	return fx.ring
}

// --------------------------------------------------------------------------
// Трассы: поиск, табло
// --------------------------------------------------------------------------
function nsRaceFind(q) {
	var st = nsRaceState()
	q = String(q || '').trim()
	if (st.tracks[q]) return st.tracks[q]
	var low = q.toLowerCase()
	for (var id in st.tracks) if (String(st.tracks[id].name).toLowerCase() === low) return st.tracks[id]
	for (var id2 in st.tracks) if (String(st.tracks[id2].name).toLowerCase().indexOf(low) === 0) return st.tracks[id2]
	return null
}
function nsRaceCanEdit(src, t) {
	var p = src.getPlayer()
	return src.hasPermission(2) || (p && nsFunName(p) === t.owner)
}
function nsRaceBoardPos(t) {
	var r0 = t.rings[0]
	return { x: r0.x, y: r0.y + r0.r + 2.2, z: r0.z }
}
function nsRaceBoardText(t) {
	var ex = [{ text: 'Трасса «' + t.name + '»\n', color: 'gold', bold: true }, { text: t.rings.length + ' колец · ' + nsRaceLen(t) + ' бл. · автор ' + t.owner + '\n', color: 'gray' }]
	if (!t.best || !t.best.length) ex.push({ text: 'рекордов пока нет — будь первым\n', color: 'white' })
	for (var i = 0; i < (t.best || []).length && i < 5; i++) ex.push({ text: i + 1 + '. ' + t.best[i].n + ' — ' + nsFunClock(t.best[i].t) + '\n', color: i === 0 ? 'yellow' : 'white' })
	ex.push({ text: '/race start ' + t.name, color: 'aqua' })
	return { text: '', extra: ex }
}
function nsRaceBoardTick() {
	var st = nsRaceState()
	for (var id in st.tracks) {
		var t = st.tracks[id]
		if (!t.rings.length) continue
		var level = NSG.nsServer.getLevel(t.dim)
		var bp = nsRaceBoardPos(t)
		var near = false
		var ps = level.getPlayers()
		for (var i = 0; i < ps.length && !near; i++) {
			var dx = ps[i].getX() - bp.x,
				dz = ps[i].getZ() - bp.z
			if (dx * dx + dz * dz < NS_RACE.boardR * NS_RACE.boardR) near = true
		}
		if (!near) continue
		var have = nsFunFind(level, bp.x, bp.y, bp.z, 3, 'ns_rb_' + id)
		var ver = (t.ver || 0) + ':' + t.rings.length
		var text = JSON.stringify(JSON.stringify(nsRaceBoardText(t)))
		if (!have.length) {
			NSG.nsServer.runCommandSilent('execute in ' + t.dim + ' run summon minecraft:text_display ' + bp.x.toFixed(2) + ' ' + bp.y.toFixed(2) + ' ' + bp.z.toFixed(2) + ' {Tags:["ns_race_board","ns_rb_' + id + '"],billboard:"center",alignment:"center",line_width:260,view_range:4f,shadow:1b,background:1140850688,transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.6f,1.6f,1.6f]},text:' + text + '}')
			NSG.nsRaceBoardVer[id] = ver
		} else if (NSG.nsRaceBoardVer[id] !== ver) {
			NSG.nsServer.runCommandSilent('execute in ' + t.dim + ' run data merge entity ' + have[0].getStringUuid() + ' {text:' + text + '}')
			try {
				have[0].teleportTo(bp.x, bp.y, bp.z)
			} catch (e) {}
			for (var h = 1; h < have.length; h++) have[h].discard()
			NSG.nsRaceBoardVer[id] = ver
		}
	}
}
function nsRaceBoardRemove(t) {
	if (!t.rings.length) return
	var bp = nsRaceBoardPos(t)
	var have = nsFunFind(NSG.nsServer.getLevel(t.dim), bp.x, bp.y, bp.z, 4, 'ns_rb_' + t.id)
	for (var i = 0; i < have.length; i++) have[i].discard()
}
// табло удалённых трасс при загрузке чанка — не пускать
EntityEvents.spawned('minecraft:text_display', event => {
	try {
		var e = event.entity
		if (!nsFunHasTag(e, 'ns_race_board')) return
		var st = nsRaceState()
		for (var id in st.tracks) if (nsFunHasTag(e, 'ns_rb_' + id)) return
	} catch (x) {
		return
	}
	event.cancel()
})

// --------------------------------------------------------------------------
// Постановка колец
// --------------------------------------------------------------------------
function nsRaceAddRing(p) {
	var st = nsRaceState()
	var name = nsFunName(p)
	var t = st.tracks[st.edit[name]]
	if (!t) return 'Нет трассы в работе: /race new <название> (или /race edit <название>).'
	var dim = nsFunDim(p)
	if (t.rings.length && t.dim !== dim) return 'Трасса «' + t.name + '» в другом измерении (' + t.dim + ').'
	if (t.rings.length >= NS_RACE.maxRings) return 'Больше ' + NS_RACE.maxRings + ' колец нельзя.'
	var c = nsRacePos(p)
	if (t.rings.length) {
		var L = t.rings[t.rings.length - 1]
		var d = Math.sqrt((L.x - c.x) * (L.x - c.x) + (L.y - c.y) * (L.y - c.y) + (L.z - c.z) * (L.z - c.z))
		if (d < NS_RACE.minGap) return 'Слишком близко к прошлому кольцу (' + Math.round(d) + ' бл., нужно от ' + NS_RACE.minGap + ').'
	}
	var n = nsRaceLook(p)
	var r = st.rad[name] || NS_RACE.radius[2]
	var R = { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, z: Math.round(c.z * 10) / 10, nx: Math.round(n.x * 1000) / 1000, ny: Math.round(n.y * 1000) / 1000, nz: Math.round(n.z * 1000) / 1000, r: r }
	t.dim = dim
	t.rings.push(R)
	t.ver = (t.ver || 0) + 1
	t.best = [] // трасса поменялась — старые рекорды не честны
	nsRaceSave()
	var level = p.getLevel()
	var ps = level.getPlayers()
	for (var i = 0; i < ps.length; i++) nsRaceDrawRing(level, ps[i], R, nsRaceRingSpec(t, t.rings.length - 1), 36)
	nsFunSound(name, 'minecraft:block.note_block.chime', 1, 0.6 + Math.min(1.4, t.rings.length * 0.1))
	return null
}

// ПКМ «Маяком трассы»: кольцо; Shift+ПКМ — убрать последнее
ItemEvents.rightClicked('nightshift:race_beacon', event => {
	var used = false
	try {
		var p = event.player
		if (!p || event.level.isClientSide()) return
		var cd = p.getCooldowns()
		if (cd.isOnCooldown(event.item.getItem())) return
		cd.addCooldown(event.item.getItem(), 8)
		var st = nsRaceState()
		var name = nsFunName(p)
		var t = st.tracks[st.edit[name]]
		if (p.isShiftKeyDown()) {
			if (t && t.rings.length) {
				t.rings.pop()
				t.ver = (t.ver || 0) + 1
				t.best = []
				nsRaceSave()
				nsFunBar(p, Text.yellow('Трасса «' + t.name + '»: последнее кольцо убрано, осталось ' + t.rings.length))
			} else nsFunBar(p, Text.gray('Убирать нечего. Новая трасса — /race new <название>'))
		} else {
			var err = nsRaceAddRing(p)
			t = st.tracks[st.edit[name]]
			if (err) nsFunBar(p, Text.red(err))
			else nsFunBar(p, Text.green('Кольцо ' + t.rings.length + (t.rings.length === 1 ? ' (старт)' : '') + ' — «' + t.name + '», радиус ' + t.rings[t.rings.length - 1].r).append(Text.gray(' · Shift+ПКМ — убрать, /race done — готово')))
		}
		used = true
	} catch (e) {
		console.error('[гонки] маяк: ' + e)
	}
	if (used) event.cancel()
})

// --------------------------------------------------------------------------
// Заезд
// --------------------------------------------------------------------------
function nsRaceStart(p, t, fake) {
	var name = nsFunName(p)
	if (t.rings.length < NS_RACE.minRings) return 'В трассе меньше ' + NS_RACE.minRings + ' колец.'
	if (nsFunDim(p) !== t.dim) return 'Трасса в другом измерении (' + t.dim + ').'
	NSG.nsRaceRuns[name] = { id: t.id, next: 0, t0: null, last: null, began: nsFunTick(), lastPass: nsFunTick(), splits: [], fake: fake || null, diff: null, diffUntil: 0 }
	if (!fake) {
		var r0 = t.rings[0]
		var dx = r0.x - p.getX(),
			dz = r0.z - p.getZ()
		nsFunBar(p, Text.gold('Трасса «' + t.name + '»: ').append(Text.white('лети в стартовое кольцо (золотое) ' + nsFunArrow(p, dx, dz) + ' ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл.')))
		nsFunSound(name, 'minecraft:block.note_block.pling', 1, 1.2)
	}
	return null
}
function nsRaceAbort(name, why) {
	var run = NSG.nsRaceRuns[name]
	delete NSG.nsRaceRuns[name]
	if (!run || run.fake) {
		if (run && run.fake && run.fake.report) run.fake.report('сорван: ' + why)
		return
	}
	var p = nsFunPlayer(name)
	if (p) {
		p.setStatusMessage(Text.red('Заезд прерван: ' + why))
		nsFunSound(name, 'minecraft:block.note_block.bass', 1, 0.6)
	}
}
function nsRaceFinish(p, name, run, t, time) {
	delete NSG.nsRaceRuns[name]
	var len = nsRaceLen(t)
	var speed = len / Math.max(0.05, time / 20)
	if (run.fake) {
		run.fake.report('финиш за ' + nsFunClock(time) + ' (' + Math.round(time * 100) / 100 + ' тиков), колец ' + t.rings.length + ', ' + Math.round(speed) + ' бл./с, отсечки: ' + run.splits.map(nsFunClock).join(' | '))
		return
	}
	if (speed > NS_RACE.maxSpeed) {
		p.setStatusMessage(Text.red('Финиш ' + nsFunClock(time) + ' — быстрее ' + NS_RACE.maxSpeed + ' бл./с не бывает, заезд не засчитан'))
		return
	}
	nsFunStage(name, 'ns_fun_race')
	var best = t.best || []
	var prev = best.length ? best[0] : null
	var mine = null
	for (var i = 0; i < best.length; i++) if (best[i].n === name) mine = best[i]
	var record = !prev || time < prev.t
	var pb = !mine || time < mine.t
	if (pb) {
		if (mine) best.splice(best.indexOf(mine), 1)
		best.push({ n: name, t: Math.round(time * 100) / 100, d: nsFunDay(), s: run.splits.map(function (s) { return Math.round(s * 100) / 100 }) })
		best.sort(function (a, b) { return a.t - b.t })
		while (best.length > 5) best.pop()
		t.best = best
		t.ver = (t.ver || 0) + 1
	}
	var paid = 0
	if (record && prev) {
		nsFunStage(name, 'ns_fun_race_rec')
		var gain = prev.t - time
		var day = nsFunDay()
		if (t.paidDay !== day) {
			t.paidDay = day
			t.paidN = 0
		}
		if (t.rings.length >= NS_RACE.minRings && len >= NS_RACE.payMinLen && gain >= Math.max(prev.t * NS_RACE.payMinGain, NS_RACE.payMinGainTicks) && t.paidN < NS_RACE.payPerDay) {
			paid = nsFunReward(p, 'race', Math.max(1, Math.min(6, Math.round(len / 200))))
			if (paid > 0) t.paidN++
		}
	}
	nsRaceSave()
	NSG.nsServer.runCommandSilent('title ' + name + ' times 5 50 15')
	if (record) {
		NSG.nsServer.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: nsFunClock(time) + (prev ? ' (было ' + nsFunClock(prev.t) + ', ' + prev.n + ')' : ' — первый рекорд трассы'), color: 'yellow' }))
		NSG.nsServer.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: 'Рекорд трассы!', color: 'gold', bold: true }))
		NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 1 1')
		NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run particle minecraft:firework ~ ~1 ~ 1 1 1 0.2 60 force')
		if (prev) {
			var line = Text.gold('[Гонки] ').append(Text.white(name + ' — рекорд трассы «' + t.name + '»: ')).append(Text.yellow(nsFunClock(time))).append(Text.gray(' (было ' + nsFunClock(prev.t) + ', ' + prev.n + ')'))
			if (paid > 0) line = line.append(Text.green(' +' + nsFunPlural(paid, 'жетон', 'жетона', 'жетонов') + ' смены'))
			nsTellAll(line)
		} else p.tell(Text.gold('[Гонки] ').append(Text.white('Первый заезд трассы «' + t.name + '» — ' + nsFunClock(time) + '. Это эталон: награда — тому, кто его побьёт.')))
	} else {
		NSG.nsServer.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: nsFunClock(time) + ' · рекорд ' + nsFunClock(prev.t) + ' (' + prev.n + ')' + (pb ? ' · личный лучший!' : ''), color: pb ? 'green' : 'gray' }))
		NSG.nsServer.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: 'Финиш', color: 'white', bold: true }))
		nsFunSound(name, 'minecraft:entity.player.levelup', 0.8, 1.2)
	}
}

// Шаг заезда (каждый тик)
function nsRaceStep(name, run, now) {
	var st = nsRaceState()
	var t = st.tracks[run.id]
	if (!t) return nsRaceAbort(name, 'трассу удалили')
	var p = run.fake ? run.fake.player : nsFunPlayer(name)
	if (!p) return nsRaceAbort(name, 'вышел из игры')
	if (!run.fake && (!p.isAlive() || nsFunDim(p) !== t.dim)) return nsRaceAbort(name, p.isAlive() ? 'другое измерение' : 'погиб')
	var pos = nsRacePos(p)
	if (run.last) {
		var mx = pos.x - run.last.x,
			my = pos.y - run.last.y,
			mz = pos.z - run.last.z
		if (mx * mx + my * my + mz * mz > NS_RACE.tpLimit * NS_RACE.tpLimit) return nsRaceAbort(name, 'телепорт')
		var R = t.rings[run.next]
		var f = nsRaceCross(run.last, pos, R)
		if (f >= 0) {
			var at = now - 1 + f // момент пролёта между тиками
			if (run.next === 0) {
				run.t0 = at
				if (!run.fake) {
					NSG.nsServer.runCommandSilent('title ' + name + ' times 0 12 6')
					NSG.nsServer.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: 'Старт!', color: 'green', bold: true }))
					nsFunSound(name, 'minecraft:block.note_block.bell', 1, 0.8)
				}
			} else {
				var split = at - run.t0
				run.splits.push(split)
				var rec = t.best && t.best.length ? t.best[0] : null
				if (rec && rec.s && rec.s[run.next - 1] !== undefined) {
					run.diff = split - rec.s[run.next - 1]
					run.diffUntil = now + 40
				}
				if (!run.fake) nsFunSound(name, 'minecraft:block.note_block.bell', 1, 0.8 + Math.min(1.2, (run.next / t.rings.length) * 1.2))
			}
			run.next++
			run.lastPass = now
			if (run.next >= t.rings.length) {
				run.last = pos
				return nsRaceFinish(p, name, run, t, at - run.t0)
			}
		}
	}
	run.last = pos
	if (run.t0 === null && now - run.began > NS_RACE.startWait) return nsRaceAbort(name, '5 минут не долетел до старта')
	if (run.t0 !== null && now - run.lastPass > NS_RACE.ringWait) return nsRaceAbort(name, '2 минуты без нового кольца')
	if (run.fake) return
	// над хотбаром — каждые 2 тика
	var N = t.rings[run.next]
	if (now % 2 === 0) {
		var dx = N.x - pos.x,
			dy = N.y - pos.y,
			dz = N.z - pos.z
		var dist = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))
		var arrow = nsFunArrow(p, dx, dz) + (dy > 8 ? '⬆' : dy < -8 ? '⬇' : '')
		var bar
		if (run.t0 === null) bar = Text.gold('«' + t.name + '» ').append(Text.white('к старту ' + arrow + ' ' + dist + ' бл.'))
		else {
			bar = Text.gold('«' + t.name + '» ').append(Text.white('кольцо ' + (run.next + 1) + '/' + t.rings.length + ' · ')).append(Text.yellow(nsFunClock(now - run.t0))).append(Text.white(' · ' + arrow + ' ' + dist + ' бл.'))
			if (run.diff !== null && now < run.diffUntil) bar = bar.append(run.diff <= 0 ? Text.green('  −' + nsFunClock(-run.diff)) : Text.red('  +' + nsFunClock(run.diff)))
		}
		nsFunBar(p, bar)
	}
	// кольца: следующее — ярко-зелёное, за ним — белое (только гонщику, видно до 512 блоков)
	if (now % 3 === 0) {
		var fx = nsRaceFx()
		var level = p.getLevel()
		nsRaceDrawRing(level, p, N, fx.next, 40, fx.glow)
		if (run.next + 1 < t.rings.length) nsRaceDrawRing(level, p, t.rings[run.next + 1], nsRaceRingSpec(t, run.next + 1), 24)
	}
}

// Кольца трасс всем рядом (не гонщикам) — раз в 10 тиков; /race show — подсветка своей трассы на 30 с
function nsRaceAmbient(now) {
	var st = nsRaceState()
	for (var id in st.tracks) {
		var t = st.tracks[id]
		if (!t.rings.length) continue
		var level = NSG.nsServer.getLevel(t.dim)
		var ps = level.getPlayers()
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i]
			var pn = nsFunName(p)
			if (NSG.nsRaceRuns[pn]) continue
			var sh = NSG.nsRaceShow[pn]
			var shown = sh && sh.id === id && sh.until > now
			for (var k = 0; k < t.rings.length; k++) {
				var R = t.rings[k]
				var dx = R.x - p.getX(),
					dz = R.z - p.getZ()
				if (!shown && dx * dx + dz * dz > NS_RACE.showR * NS_RACE.showR) continue
				nsRaceDrawRing(level, p, R, nsRaceRingSpec(t, k), shown ? 28 : 18)
			}
		}
	}
}

ServerEvents.tick(event => {
	try {
		var now = Number(event.server.getTickCount())
		var runs = NSG.nsRaceRuns
		for (var name in runs) {
			try {
				var run = runs[name]
				if (run.fake && run.fake.move) run.fake.move()
				nsRaceStep(name, run, now)
			} catch (e) {
				console.error('[гонки] заезд ' + name + ': ' + e)
				delete runs[name]
			}
		}
		if (now % 10 === 3) nsRaceAmbient(now)
		if (now % 40 === 21) nsRaceBoardTick()
	} catch (e) {
		console.error('[гонки] тик: ' + e)
	}
})

PlayerEvents.loggedOut(event => {
	try {
		delete NSG.nsRaceRuns[nsFunName(event.player)]
	} catch (e) {}
})

// --------------------------------------------------------------------------
// Самопроверка без клиента: бот пролетает кольца (2,5 блока за тик), тот же код подсчёта
// --------------------------------------------------------------------------
function nsRaceSelftest(src, t) {
	if (t.rings.length < NS_RACE.minRings) return 'в трассе меньше ' + NS_RACE.minRings + ' колец'
	var level = NSG.nsServer.getLevel(t.dim)
	var Factory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')
	var Profile = Java.loadClass('com.mojang.authlib.GameProfile')
	var UUID = Java.loadClass('java.util.UUID')
	var bot = Factory.get(level, new Profile(UUID.fromString('6e737261-6365-4000-8000-000000000001'), 'Испытатель'))
	// путь: перед каждым кольцом и за ним по нормали (с той стороны, откуда смотрели при постановке)
	var path = []
	for (var i = 0; i < t.rings.length; i++) {
		var R = t.rings[i]
		var back = i === 0 ? 20 : 4
		path.push({ x: R.x - R.nx * back, y: R.y - R.ny * back, z: R.z - R.nz * back })
		path.push({ x: R.x + R.nx * 4, y: R.y + R.ny * 4, z: R.z + R.nz * 4 })
	}
	var h = Number(bot.getBbHeight()) * 0.5
	var seg = 0,
		cur = { x: path[0].x, y: path[0].y, z: path[0].z }
	bot.setPos(cur.x, cur.y - h, cur.z)
	var mover = {
		player: bot,
		report: function (msg) {
			src.sendSystemMessage(Text.gold('[Гонки · самопроверка] ').append(Text.white('«' + t.name + '»: ' + msg)))
			console.info('[гонки] самопроверка «' + t.name + '»: ' + msg)
		},
		move: function () {
			var step = 2.5
			while (step > 0 && seg + 1 < path.length) {
				var nx = path[seg + 1]
				var dx = nx.x - cur.x,
					dy = nx.y - cur.y,
					dz = nx.z - cur.z
				var d = Math.sqrt(dx * dx + dy * dy + dz * dz)
				if (d <= step) {
					cur = { x: nx.x, y: nx.y, z: nx.z }
					seg++
					step -= d
				} else {
					cur = { x: cur.x + (dx / d) * step, y: cur.y + (dy / d) * step, z: cur.z + (dz / d) * step }
					step = 0
				}
			}
			bot.setPos(cur.x, cur.y - h, cur.z)
		},
	}
	var err = nsRaceStart(bot, t, mover)
	return err || 'бот стартовал: ' + t.rings.length + ' колец, ' + nsRaceLen(t) + ' бл. по прямым'
}

// --------------------------------------------------------------------------
// Команды
// --------------------------------------------------------------------------
function nsRaceHelp(src) {
	var g = Text.gray,
		y = Text.yellow
	src.sendSystemMessage(Text.gold('[Гонки по кольцам] ').append(Text.white('трассы в небе для самолётов, драконов и элитр.')))
	src.sendSystemMessage(y('/race list').clickRunCommand('/race list').append(g(' — трассы, рекорды, кнопки «Старт»')))
	src.sendSystemMessage(y('/race new <название>').clickSuggestCommand('/race new ').append(g(' — новая трасса; кольца — ПКМ «Маяком трассы» в полёте (или /race ring), Shift+ПКМ — убрать; /race radius <3–16>; /race done')))
	src.sendSystemMessage(y('/race start <название>').clickSuggestCommand('/race start ').append(g(' — старт с хода: таймер — от золотого кольца до красного; /race stop — сойти')))
	src.sendSystemMessage(y('/race top <название>').clickSuggestCommand('/race top ').append(g(' · /race show <название> — подсветить кольца · /race edit, /race remove — автор')))
	src.sendSystemMessage(g('Награда — жетоны смены за рекорд трассы (от 3 колец и 300 блоков, лучше прежнего на 2 %, до 10 жетонов в день).'))
	return 1
}
function nsRaceList(src) {
	var st = nsRaceState()
	var ids = Object.keys(st.tracks)
	if (!ids.length) {
		src.sendSystemMessage(Text.gold('[Гонки] ').append(Text.white('Трасс пока нет. ')).append(Text.yellow('/race new <название>').clickSuggestCommand('/race new ')).append(Text.white(' — и ставьте кольца «Маяком трассы».')))
		return 1
	}
	src.sendSystemMessage(Text.gold('[Гонки] Трассы: ' + ids.length))
	var p = src.getPlayer()
	for (var i = 0; i < ids.length; i++) {
		var t = st.tracks[ids[i]]
		var rec = t.best && t.best.length ? t.best[0] : null
		var line = Text.white(' ' + t.id + '. «' + t.name + '» ').append(Text.gray(t.rings.length + ' колец, ' + nsRaceLen(t) + ' бл., ' + t.owner))
		if (rec) line = line.append(Text.yellow(' · ' + nsFunClock(rec.t) + ' ' + rec.n))
		if (p && t.rings.length && nsFunDim(p) === t.dim) {
			var dx = t.rings[0].x - p.getX(),
				dz = t.rings[0].z - p.getZ()
			line = line.append(Text.gray(' · ' + nsFunArrow(p, dx, dz) + ' ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл.'))
		}
		line = line.append(Text.of(' ')).append(Text.green('[Старт]').clickRunCommand('/race start ' + t.id).hover(Text.gray('Таймер пойдёт, когда пролетишь золотое кольцо')))
		line = line.append(Text.of(' ')).append(Text.aqua('[Показать]').clickRunCommand('/race show ' + t.id).hover(Text.gray('Подсветить кольца на 30 секунд и метка старта для карты')))
		src.sendSystemMessage(line)
	}
	return 1
}
function nsRaceTop(src, t) {
	src.sendSystemMessage(Text.gold('[Гонки] «' + t.name + '»: ').append(Text.gray(t.rings.length + ' колец, ' + nsRaceLen(t) + ' бл., автор ' + t.owner)))
	if (!t.best || !t.best.length) src.sendSystemMessage(Text.white(' рекордов пока нет'))
	for (var i = 0; i < (t.best || []).length; i++) {
		var row = ' ' + (i + 1) + '. ' + t.best[i].n + ' — ' + nsFunClock(t.best[i].t)
		src.sendSystemMessage(i === 0 ? Text.yellow(row) : Text.white(row))
	}
	return 1
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	function say(ctx, msg, bad) {
		ctx.source.sendSystemMessage(Text.gold('[Гонки] ').append(bad ? Text.red(String(msg)) : Text.white(String(msg))))
		return bad ? 0 : 1
	}
	function track(ctx) {
		return nsRaceFind(String(A.GREEDY_STRING.getResult(ctx, 'name')))
	}
	function wrap(fn) {
		return function (ctx) {
			try {
				return fn(ctx)
			} catch (e) {
				console.error('[гонки] команда: ' + e)
				return say(ctx, 'ошибка: ' + e, true)
			}
		}
	}
	function named(lit, fn) {
		return C.literal(lit).then(C.argument('name', A.GREEDY_STRING.create(event)).executes(wrap(fn)))
	}
	event.register(
		C.literal('race')
			.executes(ctx => nsRaceHelp(ctx.source))
			.then(C.literal('list').executes(wrap(ctx => nsRaceList(ctx.source))))
			.then(
				named('new', ctx => {
					var p = ctx.source.getPlayer()
					if (!p) return 0
					var st = nsRaceState()
					var nm = String(A.GREEDY_STRING.getResult(ctx, 'name')).trim().replace(/[«»"']/g, '')
					if (nm.length < 1 || nm.length > 24) return say(ctx, 'Название — от 1 до 24 знаков.', true)
					if (/^\d+$/.test(nm)) return say(ctx, 'Название не может быть числом (числа — номера трасс).', true)
					var dup = nsRaceFind(nm)
					if (dup && String(dup.name).toLowerCase() === nm.toLowerCase()) return say(ctx, 'Трасса «' + nm + '» уже есть.', true)
					if (Object.keys(st.tracks).length >= NS_RACE.maxTracks) return say(ctx, 'Трасс уже ' + NS_RACE.maxTracks + ' — удалите старую (/race remove).', true)
					st.seq++
					var id = String(st.seq)
					st.tracks[id] = { id: id, name: nm, owner: nsFunName(p), dim: nsFunDim(p), rings: [], best: [], made: nsFunDay(), ver: 0 }
					st.edit[nsFunName(p)] = id
					nsRaceSave()
					return say(ctx, 'Трасса «' + nm + '» (№' + id + ') создана. Лети и ставь кольца: ПКМ «Маяком трассы» или /race ring — кольцо там, где ты, поперёк взгляда. Первое — старт.')
				})
			)
			.then(
				named('edit', ctx => {
					var t = track(ctx)
					if (!t) return say(ctx, 'Нет такой трассы.', true)
					if (!nsRaceCanEdit(ctx.source, t)) return say(ctx, 'Править может только автор (' + t.owner + ') или оператор.', true)
					var p = ctx.source.getPlayer()
					if (!p) return 0
					nsRaceState().edit[nsFunName(p)] = t.id
					nsRaceSave()
					return say(ctx, 'Правка «' + t.name + '»: новые кольца — в конец (сейчас ' + t.rings.length + '). Любая правка сбрасывает рекорды.')
				})
			)
			.then(
				C.literal('ring').executes(
					wrap(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var err = nsRaceAddRing(p)
						if (err) return say(ctx, err, true)
						var st = nsRaceState()
						var t = st.tracks[st.edit[nsFunName(p)]]
						return say(ctx, 'Кольцо ' + t.rings.length + ' — «' + t.name + '», радиус ' + t.rings[t.rings.length - 1].r + '.')
					})
				)
			)
			.then(
				C.literal('undo').executes(
					wrap(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var st = nsRaceState()
						var t = st.tracks[st.edit[nsFunName(p)]]
						if (!t || !t.rings.length) return say(ctx, 'Убирать нечего.', true)
						t.rings.pop()
						t.ver = (t.ver || 0) + 1
						t.best = []
						nsRaceSave()
						return say(ctx, '«' + t.name + '»: колец осталось ' + t.rings.length + '.')
					})
				)
			)
			.then(
				C.literal('radius').then(
					C.argument('r', A.INTEGER.create(event)).executes(
						wrap(ctx => {
							var p = ctx.source.getPlayer()
							if (!p) return 0
							var r = Math.max(NS_RACE.radius[0], Math.min(NS_RACE.radius[1], A.INTEGER.getResult(ctx, 'r')))
							nsRaceState().rad[nsFunName(p)] = r
							nsRaceSave()
							return say(ctx, 'Радиус новых колец — ' + r + ' бл.')
						})
					)
				)
			)
			.then(
				C.literal('done').executes(
					wrap(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var st = nsRaceState()
						var t = st.tracks[st.edit[nsFunName(p)]]
						delete st.edit[nsFunName(p)]
						nsRaceSave()
						if (!t) return say(ctx, 'Трассы в работе не было.')
						if (t.rings.length < NS_RACE.minRings) return say(ctx, '«' + t.name + '» отложена: колец ' + t.rings.length + ', для заездов нужно от ' + NS_RACE.minRings + ' (/race edit ' + t.name + ').')
						return say(ctx, '«' + t.name + '» готова: ' + t.rings.length + ' колец, ' + nsRaceLen(t) + ' бл. Заезд — /race start ' + t.name + '.')
					})
				)
			)
			.then(
				named('start', ctx => {
					var p = ctx.source.getPlayer()
					if (!p) return 0
					var t = track(ctx)
					if (!t) return say(ctx, 'Нет такой трассы — /race list.', true)
					var err = nsRaceStart(p, t, null)
					return err ? say(ctx, err, true) : 1
				})
			)
			.then(
				C.literal('stop').executes(
					wrap(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						if (!NSG.nsRaceRuns[nsFunName(p)]) return say(ctx, 'Ты не в заезде.')
						nsRaceAbort(nsFunName(p), 'сошёл с трассы')
						return 1
					})
				)
			)
			.then(
				named('top', ctx => {
					var t = track(ctx)
					return t ? nsRaceTop(ctx.source, t) : say(ctx, 'Нет такой трассы.', true)
				})
			)
			.then(
				named('show', ctx => {
					var p = ctx.source.getPlayer()
					var t = track(ctx)
					if (!p || !t || !t.rings.length) return say(ctx, 'Нет такой трассы (или в ней нет колец).', true)
					NSG.nsRaceShow[nsFunName(p)] = { id: t.id, until: nsFunTick() + 600 }
					var r0 = t.rings[0]
					p.tell(Text.of('xaero-waypoint:Старт ' + t.name.replace(/:/g, ' ').substring(0, 20) + ':Г:' + Math.floor(r0.x) + ':' + Math.floor(r0.y) + ':' + Math.floor(r0.z) + ':10:false:0:Internal-' + (t.dim === 'minecraft:the_nether' ? 'the_nether' : 'overworld') + '-waypoints'))
					return say(ctx, '«' + t.name + '»: кольца подсвечены на 30 с, старт — ' + Math.floor(r0.x) + ' ' + Math.floor(r0.y) + ' ' + Math.floor(r0.z) + ' (метка — строкой выше).')
				})
			)
			.then(
				named('remove', ctx => {
					var t = track(ctx)
					if (!t) return say(ctx, 'Нет такой трассы.', true)
					if (!nsRaceCanEdit(ctx.source, t)) return say(ctx, 'Удалить может только автор (' + t.owner + ') или оператор.', true)
					nsRaceBoardRemove(t)
					var st = nsRaceState()
					delete st.tracks[t.id]
					for (var k in st.edit) if (st.edit[k] === t.id) delete st.edit[k]
					nsRaceSave()
					return say(ctx, 'Трасса «' + t.name + '» удалена.')
				})
			)
			.then(
				C.literal('selftest')
					.requires(s => s.hasPermission(2))
					.then(
						C.argument('name', A.GREEDY_STRING.create(event)).executes(
							wrap(ctx => {
								var t = track(ctx)
								if (!t) return say(ctx, 'Нет такой трассы.', true)
								return say(ctx, nsRaceSelftest(ctx.source, t))
							})
						)
					)
			)
	)
})
