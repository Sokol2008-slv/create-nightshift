// ==========================================================================
// «Тир» на арене (05.10.2026, поток T). Когда нет набега, коридор арены (raids/70_nightshift_arena.js: x −10…10,
// пол y 64, z 0…127) — стрельбище: огневой рубеж — белая линия z 14, мишени — дальше по коридору.
//
//  Режимы (/tir start <режим>, или кнопки в /tir):
//   «На время» (time)     — 60 с, три мишени сразу; каждая живёт 5 с и уходит. Очки: 1 + 1 за каждые 25 блоков
//                           от рубежа (1–4). Золотая мишень (10 %) — ×3, живёт 2,5 с.
//   «Тарелки» (moving)    — 60 с, летающие тарелки пересекают коридор поперёк (до трёх сразу). Очки ×2.
//                           Ящик с динамитом (15 %) — не стрелять: −3.
//   «Спринт» (sprint)     — 10 мишеней по одной, на время (до 2 минут).
//  Оружие — любое дальнобойное: огнестрел NTGL, лук, арбалет, трезубец, посохи пака, заклинания Iron's Spells.
//  Засчитывается выстрел только с рубежа (z ≤ 14), и только стреляющего (тир — одна дорожка, остальные смотрят).
//  Рекорды — по режиму и классу оружия: «огнестрел», «лук и арбалет», «магия и посохи», «прочее» (вперемешку —
//  тоже «прочее»). Табло — над рубежом (текст-дисплей), /tir top.
//  Награда жетонами — за рекорд режима и класса, лучше прежнего на 5 % (очки — хотя бы +2, время — хотя бы
//  на 0,5 с); первый результат — эталон; до 8 жетонов на игрока за игровой день.
//  Мишень — невидимая неподвижная свинья (не монстр: турели, тесла и големы её не трогают) с блоком-дисплеем
//  «Мишень» верхом. Урон по ней всегда отменяется; /kill проходит (уборка). Набег начался — тир закрывается.
//  Проверка без клиента: /tir selftest [режим] (оператор) — бот-FakePlayer на рубеже «стреляет» по мишеням
//  настоящим уроном от своего имени (тот же обработчик попаданий).
// Рекорды — server.persistentData «ns_tir_json»; сессия — в памяти.
// ==========================================================================

var NS_TIR = {
	dim: 'nightshift:arena',
	line: 14, // огневой рубеж: стрелять с z ≤ line
	stand: [0.5, 65, 10.5],
	x: [-8, 8],
	y: [66, 80],
	z: [26, 112],
	board: [0.5, 70.2, 14.5],
	modes: {
		time: { name: 'На время', short: 'на время', secs: 60, max: 3, life: 100, gold: 0.1 },
		moving: { name: 'Тарелки', short: 'тарелки', secs: 60, max: 3, every: 25, tnt: 0.15 },
		sprint: { name: 'Спринт', short: 'спринт', secs: 120, total: 10 },
	},
	cls: { gun: 'огнестрел', bow: 'лук и арбалет', magic: 'магия и посохи', other: 'прочее' },
	reward: { time: 3, moving: 4, sprint: 3 },
	minGain: 0.05,
}
var NS_TIR_KEY = 'ns_tir_json'
var NS_TIR_DMG = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
var NS_TIR_DTT = Java.loadClass('net.minecraft.tags.DamageTypeTags')

function nsTirRecs() {
	if (NSG.nsTirRecs) return NSG.nsTirRecs
	var r = {}
	try {
		var raw = String(NSG.nsServer.persistentData.getString(NS_TIR_KEY))
		if (raw.length) r = JSON.parse(raw)
	} catch (e) {}
	NSG.nsTirRecs = r
	return r
}
function nsTirSaveRecs() {
	NSG.nsServer.persistentData.putString(NS_TIR_KEY, JSON.stringify(nsTirRecs()))
}
function nsTirLevel() {
	return NSG.nsServer.getLevel(NS_TIR.dim)
}
function nsTirRun(cmd) {
	NSG.nsServer.runCommandSilent('execute in ' + NS_TIR.dim + ' run ' + cmd)
}
NSG.nsTir = { s: null, seq: 0, seen: {}, boardVer: null }

// результат режима строкой: очки или время
function nsTirFmt(mode, v) {
	return mode === 'sprint' ? nsFunClock(v) + ' с' : nsFunPlural(v, 'очко', 'очка', 'очков')
}
function nsTirBetter(mode, a, b) {
	return mode === 'sprint' ? a < b : a > b
}

// --------------------------------------------------------------------------
// Можно ли сейчас стрелять
// --------------------------------------------------------------------------
function nsTirBlocked() {
	if (nsFunRaidBusy()) return 'идёт набег — тир закрыт, на арене не до мишеней'
	try {
		var st = nsGetStateRO()
		if (!st.arena || !st.arena.built) return 'арены ещё нет — зайдите на неё (/arena), она построится'
		if (st.raid && st.raid.state === 'cooldown' && st.raid.altarId === st.arena.altarId) return 'арена восстанавливается после набега — минутку'
	} catch (e) {}
	if (NSG.nsArenaJobs && NSG.nsArenaJobs.length) return 'арена перестраивается — минутку'
	return null
}

// --------------------------------------------------------------------------
// Мишени
// --------------------------------------------------------------------------
// линия видимости от рубежа до точки: блоки по пути — только воздух (постройки игроков не перекрывают мишень)
function nsTirClear(level, x, y, z) {
	var sx = NS_TIR.stand[0],
		sy = 66.6,
		sz = NS_TIR.line - 1
	var dx = x - sx,
		dy = y - sy,
		dz = z - sz
	var d = Math.sqrt(dx * dx + dy * dy + dz * dz)
	for (var k = 2; k < d - 1; k += 1) {
		var f = k / d
		if (!nsIsAir(level, Math.floor(sx + dx * f), Math.floor(sy + dy * f), Math.floor(sz + dz * f))) return false
	}
	return true
}
function nsTirSpot(level, wantClear) {
	for (var i = 0; i < 14; i++) {
		var x = NS_TIR.x[0] + Math.floor(Math.random() * (NS_TIR.x[1] - NS_TIR.x[0] + 1))
		var y = NS_TIR.y[0] + Math.floor(Math.random() * (NS_TIR.y[1] - NS_TIR.y[0] + 1))
		var z = NS_TIR.z[0] + Math.floor(Math.random() * (NS_TIR.z[1] - NS_TIR.z[0] + 1))
		if (!nsIsAir(level, x, y, z) || !nsIsAir(level, x, y + 1, z)) continue
		if (wantClear && i < 10 && !nsTirClear(level, x + 0.5, y + 0.5, z + 0.5)) continue
		return { x: x + 0.5, y: y, z: z + 0.5 }
	}
	return null
}
// вид мишени: блок-дисплей верхом на свинье (её точка посадки — 0,86875 над ногами)
var NS_TIR_LOOKS = {
	std: { block: 'minecraft:target', s: [1, 1, 1], glow: 0 },
	gold: { block: 'minecraft:gold_block', s: [0.9, 0.9, 0.9], glow: 16766720 },
	saucer: { block: 'minecraft:target', s: [1.3, 0.3, 1.3], glow: 0 },
	tnt: { block: 'minecraft:tnt', s: [0.9, 0.9, 0.9], glow: 16711680 },
}
function nsTirSummon(s, kind, x, y, z) {
	var L = NS_TIR_LOOKS[kind]
	var tx = -L.s[0] / 2,
		tz = -L.s[2] / 2
	var ty = 0.45 - L.s[1] / 2 - 0.86875 // центр блока — на середине свиньи
	var disp = '{id:"minecraft:block_display",Tags:["ns_fun_npc","ns_tir_v"],block_state:{Name:"' + L.block + '"},brightness:{sky:15,block:15},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[' + tx.toFixed(3) + 'f,' + ty.toFixed(3) + 'f,' + tz.toFixed(3) + 'f],scale:[' + L.s[0] + 'f,' + L.s[1] + 'f,' + L.s[2] + 'f]}' + (L.glow ? ',Glowing:1b,glow_color_override:' + L.glow : '') + '}'
	var uuid = nsTrNewUuid()
	nsTirRun('summon minecraft:pig ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2) + ' {UUID:' + uuid.nbt + ',NoAI:1b,Silent:1b,NoGravity:1b,PersistenceRequired:1b,Tags:["ns_fun_npc","ns_tir_t","ns_tir_s' + s.id + '"],active_effects:[{id:"minecraft:invisibility",amplifier:0b,duration:-1,show_particles:0b}],Passengers:[' + disp + ']}')
	// ссылку на сущность держим в записи мишени (level.getEntity(UUID) из Rhino недоступен)
	return { id: uuid.str, e: nsFunFindUuid(nsTirLevel(), x, y, z, 2, 'ns_tir_t', uuid.str) }
}
function nsTirPoints(kind, z) {
	var base = 1 + Math.floor(Math.max(0, z - NS_TIR.line) / 25)
	if (kind === 'gold') return base * 3
	if (kind === 'saucer') return base * 2
	if (kind === 'tnt') return -3
	return base
}
function nsTirEntity(s, uuid) {
	var tg = s && s.targets[uuid]
	return tg && !nsFunGone(tg.e) ? tg.e : null
}
function nsTirDrop(e) {
	try {
		var ps = e.getPassengers()
		for (var i = ps.size() - 1; i >= 0; i--) ps.get(i).discard()
	} catch (x) {}
	try {
		e.discard()
	} catch (x) {}
}
function nsTirRemoveTarget(s, uuid) {
	var tg = s.targets[uuid]
	if (tg && tg.e) nsTirDrop(tg.e)
	delete s.targets[uuid]
}
// всё наше на арене (мишени, дисплеи, всплывающие очки) — вон, кроме мишеней живой сессии
function nsTirSweep(keepSid) {
	var level = nsTirLevel()
	if (!level) return 0
	var n = 0
	var list = level.getEntitiesWithin(new NS_FUN_AABB(-14, 60, -4, 14, 96, 132))
	for (var i = 0; i < list.size(); i++) {
		var e = list.get(i)
		if (!nsFunHasTag(e, 'ns_tir_t') && !nsFunHasTag(e, 'ns_tir_v') && !nsFunHasTag(e, 'ns_tir_fx')) continue
		if (keepSid && (nsFunHasTag(e, 'ns_tir_s' + keepSid) || (!!e.getVehicle() && nsFunHasTag(e.getVehicle(), 'ns_tir_s' + keepSid)))) continue
		if (keepSid && nsFunHasTag(e, 'ns_tir_fx')) continue
		e.discard()
		n++
	}
	return n
}

// «+3» всплывает над мишенью и тает. alignment обязателен: text_display без него пишет в лог «Display entityNot a string»
// (1.21.1, проверено 06.10)
function nsTirFloat(x, y, z, text, color) {
	var uuid = nsTrNewUuid()
	nsTirRun('summon minecraft:text_display ' + x.toFixed(2) + ' ' + (y + 1).toFixed(2) + ' ' + z.toFixed(2) + ' {UUID:' + uuid.nbt + ',Tags:["ns_fun_npc","ns_tir_fx"],billboard:"center",alignment:"center",shadow:1b,background:0,brightness:{sky:15,block:15},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[2f,2f,2f]},text:' + JSON.stringify(JSON.stringify({ text: text, color: color, bold: true })) + '}')
	NSG.nsServer.scheduleInTicks(2, function () {
		nsTirRun('data merge entity ' + uuid.str + ' {start_interpolation:0,interpolation_duration:16,transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,1.4f,0f],scale:[0.6f,0.6f,0.6f]}}')
	})
	NSG.nsServer.scheduleInTicks(20, function () {
		nsTirRun('kill ' + uuid.str)
	})
}

// --------------------------------------------------------------------------
// Сессия
// --------------------------------------------------------------------------
function nsTirStart(p, mode, bot) {
	var M = NS_TIR.modes[mode]
	if (!M) return 'режимы: time (на время), moving (тарелки), sprint (спринт)'
	var why = nsTirBlocked()
	if (why) return why
	var T = NSG.nsTir
	if (T.s) {
		var other = T.s.bot ? null : nsFunPlayer(T.s.name)
		if (T.s.bot || (other && nsFunDim(other) === NS_TIR.dim)) return 'на рубеже ' + T.s.name + ' (' + NS_TIR.modes[T.s.mode].short + '), подожди конца серии'
		nsTirEnd('стрелок ушёл')
	}
	if (nsFunDim(p) !== NS_TIR.dim) return 'тир — на арене: /arena, потом /tir'
	var name = nsFunName(p)
	nsTirSweep(null)
	T.seq++
	var now = nsFunTick()
	T.s = { id: T.seq, name: name, mode: mode, bot: bot || null, t0: now + 60, end: now + 60 + M.secs * 20, score: 0, hits: 0, shots: 0, spawned: 0, targets: {}, cls: {}, next: now + 60, finish: null }
	if (!bot) {
		NSG.nsServer.runCommandSilent('execute in ' + NS_TIR.dim + ' run tp ' + name + ' ' + NS_TIR.stand.join(' ') + ' 0 0')
		NSG.nsServer.runCommandSilent('title ' + name + ' times 0 20 4')
		NSG.nsServer.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: M.name + (mode === 'moving' ? ' · динамит не трогать!' : mode === 'sprint' ? ' · 10 мишеней на время' : ' · 60 секунд'), color: 'gray' }))
		NSG.nsServer.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: '3', color: 'yellow', bold: true }))
		nsFunSound(name, 'minecraft:block.note_block.hat', 1, 1)
	}
	return null
}

// серия окончена: итог, рекорд, награда, табло
function nsTirEnd(why) {
	var T = NSG.nsTir
	var s = T.s
	if (!s) return
	T.s = null
	for (var u in s.targets) nsTirRemoveTarget(s, u)
	nsTirSweep(null)
	var p = s.bot ? s.bot.player : nsFunPlayer(s.name)
	var M = NS_TIR.modes[s.mode]
	var done = why === 'время' || why === 'все мишени'
	var value = s.mode === 'sprint' ? s.finish : s.score
	var clsKeys = Object.keys(s.cls)
	var cls = clsKeys.length === 1 ? clsKeys[0] : 'other'
	var result = s.mode === 'sprint' ? (value !== null ? nsFunClock(value) + ' с' : 'не все мишени') : nsTirFmt(s.mode, value)
	var report = M.name + ': ' + result + ' · попаданий ' + s.hits + (clsKeys.length ? ' · ' + NS_TIR.cls[cls] : '')
	if (s.bot) {
		s.bot.report((done ? 'серия окончена (' + why + ')' : 'серия прервана (' + why + ')') + ' — ' + report)
		if (!s.bot.rec) return // /tir selftest <режим> rec — дальше как у игрока: рекорды, награда, табло
	}
	if (!p) return
	if (!done || (s.mode === 'sprint' && value === null) || (s.mode !== 'sprint' && value <= 0)) {
		p.setStatusMessage(Text.gray('Тир: ' + (done ? report : 'серия прервана — ' + why)))
		return
	}
	nsFunStage(s.name, 'ns_fun_tir')
	// рекорд режима и класса
	var R = nsTirRecs()
	var key = s.mode + ':' + cls
	var list = R[key] || []
	var prev = list.length ? list[0] : null
	var mine = null
	for (var i = 0; i < list.length; i++) if (list[i].n === s.name) mine = list[i]
	var record = !prev || nsTirBetter(s.mode, value, prev.v)
	if (!mine || nsTirBetter(s.mode, value, mine.v)) {
		if (mine) list.splice(list.indexOf(mine), 1)
		list.push({ n: s.name, v: Math.round(value * 100) / 100, d: nsFunDay() })
		list.sort(function (a, b) { return s.mode === 'sprint' ? a.v - b.v : b.v - a.v })
		while (list.length > 5) list.pop()
		R[key] = list
		nsTirSaveRecs()
		T.boardVer = null
	}
	var paid = 0
	if (record && prev) {
		nsFunStage(s.name, 'ns_fun_tir_rec')
		if (typeof nsBoardAdd === 'function') nsBoardAdd(s.name, 'tir', 1) // доска почёта (shift/45_board.js)
		var gainOk = s.mode === 'sprint' ? prev.v - value >= Math.max(prev.v * NS_TIR.minGain, 10) : value - prev.v >= Math.max(prev.v * NS_TIR.minGain, 2)
		if (gainOk) paid = nsFunReward(p, 'tir', NS_TIR.reward[s.mode])
	}
	if (s.bot) s.bot.report('рекорд «' + key + '»: ' + record + (prev ? ' (прежний ' + nsTirFmt(s.mode, prev.v) + ', ' + prev.n + ')' : ' (эталон)') + ', жетонов: ' + paid + ', таблица: ' + list.map(function (r) { return r.n + ' ' + r.v }).join('; '))
	NSG.nsServer.runCommandSilent('title ' + s.name + ' times 5 60 15')
	if (record) {
		NSG.nsServer.runCommandSilent('title ' + s.name + ' subtitle ' + JSON.stringify({ text: report + (prev ? ' (было ' + nsTirFmt(s.mode, prev.v) + ', ' + prev.n + ')' : ''), color: 'yellow' }))
		NSG.nsServer.runCommandSilent('title ' + s.name + ' title ' + JSON.stringify({ text: 'Рекорд тира!', color: 'gold', bold: true }))
		nsFunSound(s.name, 'minecraft:ui.toast.challenge_complete', 1, 1)
		if (prev) {
			var line = Text.gold('[Тир] ').append(Text.white(s.name + ' — рекорд «' + M.name + '» (' + NS_TIR.cls[cls] + '): ')).append(Text.yellow(s.mode === 'sprint' ? nsFunClock(value) + ' с' : nsTirFmt(s.mode, value))).append(Text.gray(' (было ' + nsTirFmt(s.mode, prev.v) + ', ' + prev.n + ')'))
			if (paid > 0) line = line.append(Text.green(' +' + nsFunPlural(paid, 'жетон', 'жетона', 'жетонов') + ' смены'))
			nsTellAll(line)
			if (typeof nsJournal === 'function') nsJournal('tir', s.name + ' — рекорд тира «' + M.name + '» (' + NS_TIR.cls[cls] + '): ' + nsTirFmt(s.mode, value) + ' (было ' + nsTirFmt(s.mode, prev.v) + ', ' + prev.n + ')', 'gold')
		} else p.tell(Text.gold('[Тир] ').append(Text.white('Первый результат «' + M.name + '» (' + NS_TIR.cls[cls] + ') — эталон. Награда — тому, кто его побьёт.')))
	} else {
		NSG.nsServer.runCommandSilent('title ' + s.name + ' subtitle ' + JSON.stringify({ text: report + ' · рекорд ' + nsTirFmt(s.mode, prev.v) + ' (' + prev.n + ')', color: 'gray' }))
		NSG.nsServer.runCommandSilent('title ' + s.name + ' title ' + JSON.stringify({ text: 'Серия окончена', color: 'white' }))
		nsFunSound(s.name, 'minecraft:entity.player.levelup', 0.8, 1)
	}
}

// попадание (из обработчика урона)
function nsTirHit(target, src) {
	var s = NSG.nsTir.s
	if (!s || !nsFunHasTag(target, 'ns_tir_s' + s.id)) return
	var by = typeof nsNfAttacker === 'function' ? nsNfAttacker(src) : null
	if (!by) return
	var shooter = s.bot ? s.bot.player : nsFunPlayer(s.name)
	// Java-объекты в Rhino сравниваем по UUID (=== у обёрток ненадёжно)
	if (!shooter || String(by.getStringUuid()) !== String(shooter.getStringUuid())) {
		try {
			if (by.isPlayer && by.isPlayer()) by.setStatusMessage(Text.gray('Тир занят: стреляет ' + s.name))
		} catch (e) {}
		return
	}
	if (nsFunDim(shooter) !== NS_TIR.dim || Number(shooter.getZ()) > NS_TIR.line + 0.5) {
		if (!s.bot) nsFunBar(shooter, Text.red('Не засчитано: стреляй с огневого рубежа — за белой линией'))
		return
	}
	var uuid = String(target.getStringUuid())
	var info = s.targets[uuid]
	if (!info || info.dead) return
	info.dead = true
	// класс оружия: что в руке у стрелка и чем прилетело
	var hand = nsFunId(shooter.getMainHandItem())
	var direct = ''
	try {
		var de = src.getDirectEntity()
		if (de) direct = String(de.getType())
	} catch (e) {}
	var cls = 'other'
	if (hand.indexOf('ntgl:') === 0 || direct.indexOf('ntgl') >= 0) cls = 'gun'
	else if (/bow|crossbow|trident/.test(hand) || /arrow|trident/.test(direct)) cls = 'bow'
	else if (/_staff$/.test(hand) || hand.indexOf('irons_spellbooks:') === 0 || direct.indexOf('irons_spellbooks') >= 0) cls = 'magic'
	s.cls[cls] = true
	var x = Number(target.getX()),
		y = Number(target.getY()),
		z = Number(target.getZ())
	var pts = info.pts
	if (info.kind === 'tnt') {
		s.score += pts
		nsTirRun('particle minecraft:explosion ' + x.toFixed(2) + ' ' + (y + 0.5).toFixed(2) + ' ' + z.toFixed(2) + ' 0.3 0.3 0.3 0 2 force')
		nsTirRun('playsound minecraft:entity.generic.explode block @a ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1) + ' 1.2 1.3')
		nsTirFloat(x, y, z, String(pts), 'red')
		if (!s.bot) nsFunBar(shooter, Text.red('Это был динамит! ' + pts))
	} else {
		s.score += pts
		s.hits++
		nsTirRun('particle minecraft:crit ' + x.toFixed(2) + ' ' + (y + 0.5).toFixed(2) + ' ' + z.toFixed(2) + ' 0.3 0.3 0.3 0.4 18 force')
		nsTirRun('particle minecraft:wax_off ' + x.toFixed(2) + ' ' + (y + 0.5).toFixed(2) + ' ' + z.toFixed(2) + ' 0.4 0.4 0.4 0.2 10 force')
		nsTirRun('playsound minecraft:block.note_block.bell block @a ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1) + ' 1.4 ' + (info.kind === 'gold' ? 2 : 1.4))
		if (!s.bot) nsFunSound(s.name, 'minecraft:entity.arrow.hit_player', 0.7, 1.2)
		nsTirFloat(x, y, z, s.mode === 'sprint' ? s.hits + '/10' : '+' + pts, info.kind === 'gold' ? 'gold' : 'yellow')
	}
	NSG.nsServer.scheduleInTicks(1, function () {
		var cur = NSG.nsTir.s
		nsTirRemoveTarget(cur && cur.id === s.id ? cur : s, uuid)
	})
	if (s.mode === 'sprint' && s.hits >= NS_TIR.modes.sprint.total) {
		s.finish = nsFunTick() - s.t0
		NSG.nsServer.scheduleInTicks(2, function () {
			if (NSG.nsTir.s && NSG.nsTir.s.id === s.id) nsTirEnd('все мишени')
		})
	}
}

// каждый тик, пока идёт серия
function nsTirTick(now) {
	var T = NSG.nsTir
	var s = T.s
	if (!s) return
	var M = NS_TIR.modes[s.mode]
	var shooter = s.bot ? s.bot.player : nsFunPlayer(s.name)
	if (!shooter) return nsTirEnd('стрелок вышел')
	if (!s.bot && (nsFunDim(shooter) !== NS_TIR.dim || !shooter.isAlive())) return nsTirEnd('стрелок ушёл с арены')
	if (nsFunRaidBusy()) {
		if (!s.bot) shooter.setStatusMessage(Text.red('Набег! Тир закрыт.'))
		return nsTirEnd('набег')
	}
	// отсчёт 3-2-1
	if (now < s.t0) {
		if (!s.bot && (s.t0 - now === 40 || s.t0 - now === 20)) {
			NSG.nsServer.runCommandSilent('title ' + s.name + ' title ' + JSON.stringify({ text: String((s.t0 - now) / 20), color: 'yellow', bold: true }))
			nsFunSound(s.name, 'minecraft:block.note_block.hat', 1, 1)
		}
		return
	}
	if (now === s.t0 && !s.bot) {
		NSG.nsServer.runCommandSilent('title ' + s.name + ' times 0 12 6')
		NSG.nsServer.runCommandSilent('title ' + s.name + ' title ' + JSON.stringify({ text: 'Огонь!', color: 'red', bold: true }))
		nsFunSound(s.name, 'minecraft:block.note_block.pling', 1, 1.6)
	}
	if (now >= s.end) return nsTirEnd(s.mode === 'sprint' ? 'время вышло' : 'время')
	var level = nsTirLevel()
	// мишени: срок жизни, движение тарелок
	var alive = 0
	for (var u in s.targets) {
		var tg = s.targets[u]
		if (tg.dead) continue
		var e = nsTirEntity(s, u)
		if (!e) {
			delete s.targets[u]
			continue
		}
		if (tg.until && now >= tg.until) {
			nsTirRemoveTarget(s, u)
			nsTirRun('particle minecraft:poof ' + tg.x.toFixed(2) + ' ' + (tg.y + 0.5).toFixed(2) + ' ' + tg.z.toFixed(2) + ' 0.2 0.2 0.2 0.02 6 force')
			continue
		}
		if (tg.path) {
			var k = Math.min(1, (now - tg.born) / tg.path.dur)
			var nx = tg.path.x0 + (tg.path.x1 - tg.path.x0) * k
			var ny = tg.path.y + Math.sin(k * Math.PI * 2 * tg.path.wav) * tg.path.amp
			e.teleportTo(nx, ny, tg.z)
			tg.x = nx
			tg.y = ny
			if (k >= 1) {
				nsTirRemoveTarget(s, u)
				continue
			}
		}
		alive++
	}
	// новые мишени
	if (now >= s.next) {
		if (s.mode === 'time' && alive < M.max) {
			var sp = nsTirSpot(level, true)
			if (sp) {
				var gold = Math.random() < M.gold
				var kind = gold ? 'gold' : 'std'
				var made = nsTirSummon(s, kind, sp.x, sp.y, sp.z)
				s.targets[made.id] = { e: made.e, kind: kind, pts: nsTirPoints(kind, sp.z), born: now, until: now + (gold ? M.life / 2 : M.life), x: sp.x, y: sp.y, z: sp.z }
				s.spawned++
			}
			s.next = now + 8
		} else if (s.mode === 'moving' && alive < M.max) {
			var z = NS_TIR.z[0] + 4 + Math.floor(Math.random() * (NS_TIR.z[1] - NS_TIR.z[0] - 8))
			var yy = NS_TIR.y[0] + 1 + Math.random() * (NS_TIR.y[1] - NS_TIR.y[0] - 3)
			var dir = Math.random() < 0.5 ? 1 : -1
			var tnt = Math.random() < M.tnt
			var knd = tnt ? 'tnt' : 'saucer'
			var x0 = -9.2 * dir
			var made2 = nsTirSummon(s, knd, x0, yy, z + 0.5)
			s.targets[made2.id] = { e: made2.e, kind: knd, pts: nsTirPoints(knd, z), born: now, x: x0, y: yy, z: z + 0.5, path: { x0: x0, x1: 9.2 * dir, y: yy, dur: 50 + Math.floor(Math.random() * 30), amp: 0.6 + Math.random() * 1.2, wav: 1 + Math.floor(Math.random() * 2) } }
			s.spawned++
			s.next = now + M.every
		} else if (s.mode === 'sprint' && alive === 0 && s.hits < M.total) {
			var sp2 = nsTirSpot(level, true)
			if (sp2) {
				var made3 = nsTirSummon(s, 'std', sp2.x, sp2.y, sp2.z)
				s.targets[made3.id] = { e: made3.e, kind: 'std', pts: 1, born: now, x: sp2.x, y: sp2.y, z: sp2.z }
				s.spawned++
			}
			s.next = now + 6
		}
	}
	if (s.bot) {
		if (s.bot.shoot) s.bot.shoot(now)
		return
	}
	// над хотбаром
	if (now % 4 === 0) {
		var left = s.mode === 'sprint' ? now - s.t0 : s.end - now
		var bar = Text.gold('Тир · ' + M.name + ' · ').append(Text.yellow(s.mode === 'sprint' ? nsFunClock(left) : Math.ceil(left / 20) + ' с'))
		bar = bar.append(Text.white(s.mode === 'sprint' ? ' · мишень ' + Math.min(M.total, s.hits + 1) + '/' + M.total : ' · очки ' + s.score + ' · попаданий ' + s.hits))
		nsFunBar(shooter, bar)
	}
	// огневой рубеж — белая линия на полу
	if (now % 10 === 0) {
		var fx = nsFunDust(1, 1, 1, 1.2)
		for (var lx = -10; lx <= 10; lx += 1) nsFunParticle(level, shooter, fx, lx + 0.5, 65.15, NS_TIR.line + 0.5)
	}
}

// --------------------------------------------------------------------------
// Табло над рубежом
// --------------------------------------------------------------------------
function nsTirBoardText() {
	var R = nsTirRecs()
	var ex = [{ text: 'ТИР · огневой рубеж\n', color: 'gold', bold: true }]
	var order = ['time', 'moving', 'sprint']
	for (var i = 0; i < order.length; i++) {
		var m = order[i]
		var best = null,
			bc = null
		for (var c in NS_TIR.cls) {
			var l = R[m + ':' + c]
			if (l && l.length && (!best || nsTirBetter(m, l[0].v, best.v))) {
				best = l[0]
				bc = c
			}
		}
		ex.push({ text: NS_TIR.modes[m].name + ': ', color: 'white' })
		ex.push(best ? { text: nsTirFmt(m, best.v) + ' — ' + best.n + ' (' + NS_TIR.cls[bc] + ')\n', color: 'yellow' } : { text: 'рекорда нет\n', color: 'gray' })
	}
	ex.push({ text: '/tir — начать · стрелять из-за белой линии', color: 'aqua' })
	return { text: '', extra: ex }
}
function nsTirBoardTick() {
	var T = NSG.nsTir
	var level = nsTirLevel()
	if (!level || !level.getPlayers().length) return
	var B = NS_TIR.board
	var have = nsFunFind(level, B[0], B[1], B[2], 3, 'ns_tir_board')
	var ver = JSON.stringify(nsTirRecs()).length + ':' + Object.keys(nsTirRecs()).length
	var text = JSON.stringify(JSON.stringify(nsTirBoardText()))
	if (!have.length) {
		nsTirRun('summon minecraft:text_display ' + B.join(' ') + ' {Tags:["ns_fun_npc","ns_tir_board"],billboard:"center",alignment:"center",line_width:300,view_range:2f,shadow:1b,background:1140850688,brightness:{sky:15,block:15},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1.3f,1.3f,1.3f]},text:' + text + '}')
		T.boardVer = ver
	} else if (T.boardVer !== ver) {
		nsTirRun('data merge entity ' + have[0].getStringUuid() + ' {text:' + text + '}')
		for (var h = 1; h < have.length; h++) have[h].discard()
		T.boardVer = ver
	}
}

// --------------------------------------------------------------------------
// События
// --------------------------------------------------------------------------
ServerEvents.tick(event => {
	try {
		if (!NSG.nsServer) return
		var now = Number(event.server.getTickCount())
		if (NSG.nsTir.s) nsTirTick(now)
		if (now % 20 === 11) {
			// подсказка входящим на арену, когда тир открыт
			var level = nsTirLevel()
			if (!level) return
			var ps = level.getPlayers()
			var inArena = {}
			var blocked = null
			for (var i = 0; i < ps.length; i++) {
				var pn = nsFunName(ps[i])
				inArena[pn] = true
				if (NSG.nsTir.seen[pn]) continue
				NSG.nsTir.seen[pn] = true
				if (blocked === null) blocked = nsTirBlocked() || ''
				if (!blocked && !nsFunHudBusy(ps[i])) ps[i].setStatusMessage(Text.gold('Тир открыт: ').append(Text.white('/tir — мишени, тарелки, спринт; стрелять из-за белой линии у алтаря')))
			}
			for (var k in NSG.nsTir.seen) if (!inArena[k]) delete NSG.nsTir.seen[k]
		}
		if (now % 40 === 31 && !nsFunRaidBusy()) nsTirBoardTick()
		if (now % 100 === 51 && !NSG.nsTir.s) nsTirSweep(null)
	} catch (e) {
		console.error('[тир] тик: ' + e)
	}
})

// урон по мишени: всегда отменяем, попадание — в счёт (/kill и пустота проходят — для уборки)
NativeEvents.onEvent(NS_TIR_DMG, function (event) {
	try {
		if (!nsFunGenOk()) return
		var v = event.getEntity()
		if (!nsFunHasTag(v, 'ns_tir_t')) return
		var src = event.getSource()
		if (src.is(NS_TIR_DTT.BYPASSES_INVULNERABILITY)) return
		event.setCanceled(true)
		nsTirHit(v, src)
	} catch (e) {
		console.error('[тир] попадание: ' + e)
	}
})

// мишени прошлых сессий при загрузке чанка — не пускать
EntityEvents.spawned(event => {
	try {
		var e = event.entity
		if (!nsFunHasTag(e, 'ns_fun_npc')) return
		var t = nsFunHasTag(e, 'ns_tir_t'),
			v = nsFunHasTag(e, 'ns_tir_v'),
			fx = nsFunHasTag(e, 'ns_tir_fx')
		if (!t && !v && !fx) return
		var s = NSG.nsTir && NSG.nsTir.s
		if ((fx || v) && s) return // всплывающие очки и дисплеи мишеней — пока идёт серия
		if (t && s && nsFunHasTag(e, 'ns_tir_s' + s.id)) return
	} catch (x) {
		return
	}
	event.cancel()
})

// --------------------------------------------------------------------------
// Самопроверка без клиента: бот на рубеже бьёт мишени уроном «от игрока» (тот же обработчик попаданий)
// --------------------------------------------------------------------------
function nsTirSelftest(src, mode, rec) {
	// арены нет (её строит /arena, а он — только для игрока) — построить так же: чанки, потом пол и алтарь
	var ast = nsGetState()
	if ((!ast.arena || !ast.arena.built) && typeof nsArenaBuild === 'function') {
		nsArenaForceload()
		NSG.nsServer.scheduleInTicks(60, function () {
			try {
				nsArenaBuild(nsGetState())
			} catch (e) {
				console.error('[тир] постройка арены: ' + e)
			}
		})
		return 'арены не было — строю её, как /arena; повторите через минуту'
	}
	var level = nsTirLevel()
	var Factory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')
	var Profile = Java.loadClass('com.mojang.authlib.GameProfile')
	var bot = Factory.get(level, new Profile(NS_TR_UUID.fromString('6e737469-7200-4000-8000-000000000001'), 'Стрелок'))
	bot.setPos(NS_TIR.stand[0], NS_TIR.stand[1], NS_TIR.stand[2])
	try {
		bot.setItemInHand(Java.loadClass('net.minecraft.world.InteractionHand').MAIN_HAND, Item.of('minecraft:bow'))
	} catch (e) {}
	var shots = 0
	var helper = {
		player: bot,
		rec: !!rec,
		report: function (msg) {
			src.sendSystemMessage(Text.gold('[Тир · самопроверка] ').append(Text.white(msg + '; выстрелов бота ' + shots)))
			console.info('[тир] самопроверка: ' + msg + '; выстрелов бота ' + shots)
		},
		// раз в 10 тиков — «выстрел» в случайную живую мишень: урон от имени бота (стрелой из лука по смыслу)
		shoot: function (now) {
			if (now % 10 !== 0) return
			var s = NSG.nsTir.s
			if (!s) return
			for (var u in s.targets) {
				var tg = s.targets[u]
				if (tg.dead) continue
				if (s.mode === 'moving' && tg.kind === 'tnt' && shots % 4 !== 3) continue // динамит — изредка, для проверки штрафа
				var e = nsTirEntity(s, u)
				if (!e) continue
				shots++
				e.attack(bot.damageSources().playerAttack(bot), 4)
				return
			}
		},
	}
	var err = nsTirStart(bot, mode, helper)
	if (err) return err
	// бот на рубеже стоит в арене; сессия бота считает «в измерении» по уровню бота
	return 'бот «Стрелок» на рубеже, режим ' + NS_TIR.modes[mode].name + ' — итог придёт сообщением'
}

// --------------------------------------------------------------------------
// Команды
// --------------------------------------------------------------------------
function nsTirSelftestCmd(ctx, mode, rec) {
	try {
		ctx.source.sendSystemMessage(Text.gold('[Тир] ').append(Text.white(nsTirSelftest(ctx.source, mode, rec))))
		return 1
	} catch (e) {
		console.error('[тир] самопроверка: ' + e)
		ctx.source.sendSystemMessage(Text.red('[Тир] ошибка: ' + e))
		return 0
	}
}
function nsTirMenu(src) {
	src.sendSystemMessage(Text.gold('[Тир] ').append(Text.white('Стрельбище в коридоре арены, когда нет набега. Огневой рубеж — белая линия за алтарём.')))
	var row = Text.white(' ')
	var keys = ['time', 'moving', 'sprint']
	var hints = ['60 с, мишени по 5 с; золотая ×3', '60 с, тарелки через коридор ×2; динамит −3', '10 мишеней на время']
	for (var i = 0; i < keys.length; i++) row = row.append(Text.green('[' + NS_TIR.modes[keys[i]].name + ']').clickRunCommand('/tir start ' + keys[i]).hover(Text.gray(hints[i]))).append(Text.of('  '))
	src.sendSystemMessage(row)
	src.sendSystemMessage(Text.gray('Оружие любое дальнобойное: огнестрел, лук, арбалет, посохи, заклинания. Рекорды — по режиму и классу оружия: ').append(Text.yellow('/tir top').clickRunCommand('/tir top')).append(Text.gray('. Награда — жетоны за рекорд (лучше прежнего на 5 %, до 8 в день).')))
	var why = nsTirBlocked()
	if (why) src.sendSystemMessage(Text.red('Сейчас: ' + why + '.'))
	else {
		var p = src.getPlayer()
		if (p && nsFunDim(p) !== NS_TIR.dim) src.sendSystemMessage(Text.yellow('Тир — на арене: ').append(Text.aqua('[⇨ Арена]').clickRunCommand('/arena')))
	}
	return 1
}
function nsTirTop(src) {
	var R = nsTirRecs()
	src.sendSystemMessage(Text.gold('[Тир] Рекорды'))
	var any = false
	for (var m in NS_TIR.modes) {
		for (var c in NS_TIR.cls) {
			var l = R[m + ':' + c]
			if (!l || !l.length) continue
			any = true
			var parts = []
			for (var i = 0; i < l.length && i < 3; i++) parts.push(i + 1 + '. ' + l[i].n + ' — ' + nsTirFmt(m, l[i].v))
			src.sendSystemMessage(Text.yellow(' ' + NS_TIR.modes[m].name + ' · ' + NS_TIR.cls[c] + ': ').append(Text.white(parts.join(', '))))
		}
	}
	if (!any) src.sendSystemMessage(Text.white(' рекордов пока нет — /tir'))
	return 1
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	function say(ctx, msg, bad) {
		ctx.source.sendSystemMessage(Text.gold('[Тир] ').append(bad ? Text.red(String(msg)) : Text.white(String(msg))))
		return bad ? 0 : 1
	}
	function startMode(ctx, mode) {
		try {
			var p = ctx.source.getPlayer()
			if (!p) return 0
			var err = nsTirStart(p, mode, null)
			return err ? say(ctx, err, true) : 1
		} catch (e) {
			console.error('[тир] старт: ' + e)
			return say(ctx, 'ошибка: ' + e, true)
		}
	}
	event.register(
		C.literal('tir')
			.executes(ctx => nsTirMenu(ctx.source))
			.then(
				C.literal('start')
					.then(C.literal('time').executes(ctx => startMode(ctx, 'time')))
					.then(C.literal('moving').executes(ctx => startMode(ctx, 'moving')))
					.then(C.literal('sprint').executes(ctx => startMode(ctx, 'sprint')))
			)
			.then(
				C.literal('stop').executes(ctx => {
					var p = ctx.source.getPlayer()
					var s = NSG.nsTir.s
					if (!s || !p || (s.name !== nsFunName(p) && !ctx.source.hasPermission(2))) return say(ctx, 'Твоей серии нет.', true)
					nsTirEnd('остановлена')
					return say(ctx, 'Серия остановлена.')
				})
			)
			.then(C.literal('top').executes(ctx => nsTirTop(ctx.source)))
			.then(
				C.literal('selftest')
					.requires(s => s.hasPermission(2))
					.then(
						C.argument('mode', A.STRING.create(event))
							.executes(ctx => nsTirSelftestCmd(ctx, String(A.STRING.getResult(ctx, 'mode')), false))
							// rec — результат бота идёт в рекорды и награду, как у игрока
							.then(C.literal('rec').executes(ctx => nsTirSelftestCmd(ctx, String(A.STRING.getResult(ctx, 'mode')), true)))
					)
			)
			.then(
				C.literal('reset')
					.requires(s => s.hasPermission(2))
					.executes(ctx => {
						NSG.nsTirRecs = {}
						nsTirSaveRecs()
						NSG.nsTir.boardVer = null
						return say(ctx, 'Рекорды тира сброшены.')
					})
			)
	)
})
