// ==========================================================================
// Ночная смена — ОСОБЫЕ СТАДИИ (04.10.2026; Георгий: «стадия 20 условно — мы не в арене, нам надо самолёт, потому что
// битва в воздухе; 21-я — что-то новое, чуть ли не побег от монстра; некоторые волны вынуждают что-то новое делать;
// больше привязок предметов по волнам»).
//
// Два вида особых стадий на шкале волн (номера — NSG.NS_SPECIAL_STAGES, кратные 5 не трогаем — там боссы):
//  1) Волна с НЕУЯЗВИМОСТЬЮ — обычный набег, но орда берёт урон только от одного: «Механоиды» — только ток (тесла,
//     молния), «Бронеколонна» — только машины (турели, пушки, тесла, големы, деплоеры, взрывы), «Духи» — только магия
//     (посохи, заклинания Iron's Spells, зелья). Урон «не тем» гасится, бьющему — подсказка над хотбаром.
//  1б) НЕВИДИМКИ — обычный набег, но вся орда невидима: «Невидимки» (34), «Блэкаут» (56, у защитников ещё и «Тьма»).
//     Видно только в луче прожектора аддона — он снимает невидимость и подсвечивает.
//  2) СЦЕНАРИЙ вместо подволн (только у алтаря базы под открытым небом, не на арене):
//     «Воздушный бой» — над базой висят ульи-матки (гасты без ИИ), из них летят стрекозы и шершни; ульи ранит только тот, кто в
//       воздухе (самолёт, элитры, дракон). Сбить все ульи до конца таймера.
//     «Побег» — появляется неубиваемый Пожиратель; вся команда должна добраться до точки эвакуации в 350–600 блоках
//       (машина, самолёт, поезд — что угодно) до конца таймера.
//     «Штурм гнезда» — вдали появляется гнездо ArPhEx с маткой и стражей; долететь и убить матку до конца таймера.
// За первое прохождение каждой особой стадии — ключевой предмет (NS_WAVE_MILESTONES) и гарантированный артефакт.
// Хуки: nsChallengeHorde → NSG.nsSpecialFor (40_), старт/тик сценария — nsScenarioStart / nsScenarioTick (40_),
// запрет сценария на арене — nsStartChallenge (50_), прогноз — nsSpecialForecast (30_).
// ==========================================================================

// Описание стадий. Повторы с «II/III» — крепче (больше ульев, дальше эвакуация, толще матка)
function nsSs(kind, key, name, need) {
	return { kind: kind, key: key, name: name, need: need }
}
NSG.NS_SPECIAL_STAGES = {
	22: nsSs('immune', 'tesla', 'Механоиды', 'Орду берёт только ток: тесла-башня, молния. Пули, мечи и турели — мимо.'),
	24: nsSs('scenario', 'air', 'Воздушный бой', 'Над базой ульи-матки. Ранить их можно только из воздуха: самолёт с роторной пушкой, элитры, дракон.'),
	26: nsSs('immune', 'turrets', 'Бронеколонна', 'Ручное оружие не берёт броню: только турели, пушки, тесла, големы, деплоеры и взрывы.'),
	28: nsSs('scenario', 'escape', 'Побег', 'Пожиратель неубиваем. Вся команда — к точке эвакуации до конца таймера: машина, самолёт, поезд.'),
	32: nsSs('immune', 'magic', 'Духи', 'Духов ранит только магия: посохи, заклинания, зелья вреда.'),
	34: nsSs('invis', 'invis', 'Невидимки', 'Вся орда невидима. Видно только в луче прожектора — ставьте их на подходах.'),
	36: nsSs('scenario', 'nest', 'Штурм гнезда', 'Вдали выросло гнездо. Долететь, пробиться через стражу и убить матку до конца таймера.'),
	38: nsSs('siege', 'siege', 'Осада форпоста', 'Орда идёт не на базу, а на один из форпостов сети. Моб у экструдера — провал. Укрепляйте и форпосты.'),
	42: nsSs('scenario', 'air', 'Воздушный бой II', 'Ульев больше, и они злее. Нужна авиация.'),
	43: nsSs('scenario', 'convoy', 'Конвой', 'Обоз из трёх вьючных лам идёт к базе издалека, по пути — засады. Встретить, прикрыть и довести хоть одну.'),
	44: nsSs('immune', 'tesla', 'Механоиды II', 'Только ток. Нужна сеть, которая держит залпы тесла-башен.'),
	46: nsSs('scenario', 'escape', 'Побег II', 'Эвакуация дальше, Пожиратель быстрее.'),
	48: nsSs('immune', 'turrets', 'Бронеколонна II', 'Только машины. Ручное оружие не берёт.'),
	52: nsSs('immune', 'magic', 'Духи II', 'Только магия.'),
	54: nsSs('scenario', 'nest', 'Штурм гнезда II', 'Матка толще, стражи больше.'),
	56: nsSs('invis', 'invis', 'Блэкаут', 'Орда невидима, а у защитников «Тьма» весь набег. Свет и цель даёт только прожектор.'),
	57: nsSs('siege', 'siege', 'Осада форпоста II', 'Форпост выбирается случайно — укрепляйте все.'),
	58: nsSs('scenario', 'air', 'Воздушный бой III', 'Небо чёрное от крыльев.'),
	62: nsSs('scenario', 'escape', 'Побег III', 'Самая дальняя эвакуация.'),
	63: nsSs('scenario', 'convoy', 'Конвой II', 'Путь длиннее, засады злее.'),
	64: nsSs('immune', 'tesla', 'Механоиды III', 'Только ток.'),
	66: nsSs('scenario', 'nest', 'Штурм гнезда III', 'Гнездо-крепость.'),
	68: nsSs('immune', 'turrets', 'Бронеколонна III', 'Только машины.'),
}
NSG.NS_SPECIAL_KEYS = { tesla: 'nightshift:coil_core', air: 'nightshift:afterburner_blueprint', turrets: 'nightshift:otk_armor_plate', escape: 'nightshift:runner_badge', magic: 'nightshift:spirit_essence', nest: 'nightshift:queen_heart', invis: 'nightshift:prism_lens', siege: 'nightshift:bastion_core', convoy: 'nightshift:convoy_seal' }
NSG.NS_SPECIAL_KEY_TEXT = {
	tesla: 'Сердечник катушки — для тесла-техники следующего уровня',
	air: 'Чертёж форсажа — открывает сверхбыстрые улучшения самолётов',
	turrets: 'Бронеплита ОТК — для тяжёлой обороны',
	escape: 'Значок беглеца — для лицензий пилота и машин',
	magic: 'Эссенция духа — для сильной магии',
	nest: 'Сердце матки — для живой брони и трофеев',
	invis: 'Призменная линза — для оптики: прожекторы и прицелы следующего уровня',
	siege: 'Ядро бастиона — для обороны форпостов',
	convoy: 'Пломба конвоя — для грузовой логистики следующего уровня',
}
// вехи первого прохождения: ключевой предмет каждой особой стадии
for (var nsSw in NSG.NS_SPECIAL_STAGES) {
	var nsSd = NSG.NS_SPECIAL_STAGES[nsSw]
	if (!NSG.NS_WAVE_MILESTONES[nsSw]) NSG.NS_WAVE_MILESTONES[nsSw] = { items: [[NSG.NS_SPECIAL_KEYS[nsSd.key], 1]], text: NSG.NS_SPECIAL_KEY_TEXT[nsSd.key] + ' (особая стадия «' + nsSd.name + '»)' }
}

// Особая стадия поверх состава волны d. Сценарий — без подволн (своя логика), неуязвимость — те же подволны с меткой.
NSG.nsSpecialFor = function (d, cfg) {
	var sp = NSG.NS_SPECIAL_STAGES[d]
	if (!sp) return cfg
	var out = {}
	for (var f in cfg) out[f] = cfg[f]
	out.special = sp
	out.name = sp.name
	if (sp.kind === 'immune') out.immunity = sp.key
	else if (sp.kind === 'siege') {
		out.siege = true // состав обычный, цель — форпост (46_outpost_siege.js, nsStartChallenge)
	} else if (sp.kind === 'invis') {
		out.invis = true // подволны те же, мобы невидимы (nsBoostRaidMobs)
		out.blackout = sp.name === 'Блэкаут' // у защитников «Тьма» весь набег (тик ниже)
	} else {
		out.scenario = sp.key
		out.waves = []
		out.boss = null
		out.bossExtra = []
		out.star = null
		out.premiere = false
	}
	return out
}

// Прогноз у алтаря для особой стадии
function nsSpecialForecast(horde, d) {
	var sp = horde.special
	var lines = ['ОСОБАЯ СТАДИЯ: ' + sp.name, sp.need]
	if (sp.kind === 'siege') {
		var no = 0
		try {
			no = (nsGetState().outposts || []).length
		} catch (e) {}
		lines.push(no > 0 ? 'Форпостов в сети: ' + no + ' — орда выберет один. Список — /outposts.' : 'В сети форпостов пусто — стадию не начать: поставьте механический экструдер на месторождение.')
	}
	if (sp.kind === 'invis') lines.push('Нужен прожектор (аддон Axiomativ): в луче мобы видны и светятся ещё 5 с.')
	if (sp.kind === 'scenario') {
		var p = nsScenarioParams(sp.key, d)
		lines.push('Таймер: ' + Math.round(p.time / 60) + ' мин. Только у алтаря базы под открытым небом.')
		if (sp.key === 'air') lines.push('Ульев: ' + p.hives + ', здоровье улья ~' + p.hiveHp)
		if (sp.key === 'escape') lines.push('До эвакуации ~' + p.dist + ' блоков')
		if (sp.key === 'nest') lines.push('До гнезда ~' + p.dist + ' блоков, матка ~' + p.queenHp + ' HP')
		if (sp.key === 'convoy') lines.push('Обоз — ' + p.llamas + ' ламы по ~' + p.llamaHp + ' HP, путь ~' + p.dist + ' блоков, засада каждые ' + p.ambushEvery + ' с')
	}
	lines.push('Первое прохождение: ' + NSG.NS_SPECIAL_KEY_TEXT[sp.key] + ' и артефакт смены наверняка')
	return lines
}

// Параметры сценария по номеру волны
function nsScenarioParams(key, d) {
	var lvl = d >= 58 ? 3 : d >= 42 ? 2 : 1
	if (key === 'air') return { lvl: lvl, hives: 2 + lvl, hiveHp: Math.round(250 * (1 + d / 20)), time: 600 + 120 * lvl, flyersPer: 1 + lvl }
	if (key === 'convoy') return { lvl: lvl, dist: 250 + 100 * lvl, time: 240 + 60 * lvl, llamas: 3, llamaHp: Math.round(200 * (1 + d / 20)), ambushEvery: 15, ambushN: 2 + lvl }
	if (key === 'escape') return { lvl: lvl, dist: 300 + 100 * lvl, time: 180 + 60 * lvl, speed: 0.26 + 0.04 * lvl } // 0.30 — чуть быстрее бегущего игрока: пешком не уйти, нужен транспорт
	return { lvl: lvl, dist: 220 + 60 * lvl, time: 420 + 60 * lvl, queenHp: Math.round(350 * (1 + d / 12)), guards: 3 + 2 * lvl }
}

// --------------------------------------------------------------------------
// Неуязвимости и ульи: урон «не тем» гасится (NativeEvents — тело в try/catch, иначе падает сервер)
// --------------------------------------------------------------------------
var NS_SS_DAMAGE = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')

function nsSsDmgType(src) {
	try {
		return String(src.typeHolder().getRegisteredName())
	} catch (e) {}
	try {
		return String(src.typeHolder().unwrapKey().get().location())
	} catch (e) {}
	return ''
}
function nsSsDirect(src) {
	var names = ['getImmediate', 'getDirectEntity']
	for (var i = 0; i < names.length; i++) {
		try {
			var f = src[names[i]]
			if (typeof f !== 'function') continue
			var e = f.call(src)
			if (e != null) return e
		} catch (x) {}
	}
	return null
}
// живой игрок, а не FakePlayer деплоера/турели (getClass() в KubeJS закрыт — только instanceof)
var NS_SS_FAKE = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayer')
function nsSsRealPlayer(e) {
	try {
		return e != null && e.isPlayer() && !(e instanceof NS_SS_FAKE)
	} catch (x) {
		return false
	}
}
function nsSsNs(e) {
	try {
		return String(e.getType()).split(':')[0]
	} catch (x) {
		return ''
	}
}
// игрок в воздухе: в транспорте (самолёт, машина), на элитрах или верхом (дракон)
function nsSsAirborne(p) {
	try {
		if (p.isPassenger()) return true
	} catch (x) {}
	try {
		if (p.isFallFlying()) return true
	} catch (x) {}
	return false
}

var NS_SS_HINTS = {
	tesla: 'Механоиды: берёт только ток — тесла-башня, молния',
	turrets: 'Бронеколонна: ручное оружие не берёт — турели, пушки, тесла, големы',
	magic: 'Духи: берёт только магия — посохи, заклинания',
	hive: 'Улей высоко: бей с самолёта, на элитрах или с дракона',
}
NSG.nsSsHintAt = NSG.nsSsHintAt || {}
function nsSsHint(attacker, key) {
	if (!nsSsRealPlayer(attacker)) return
	try {
		var name = String(attacker.getUsername())
		var now = Date.now()
		if (now - (NSG.nsSsHintAt[name] || 0) < 2500) return
		NSG.nsSsHintAt[name] = now
		NSG.nsServer.runCommandSilent('title ' + name + ' actionbar {"text":"' + NS_SS_HINTS[key] + '","color":"gold"}')
	} catch (x) {}
}

// Пропускает ли неуязвимость этот урон
function nsSsAllowed(mode, src, attacker, direct) {
	var t = nsSsDmgType(src)
	if (mode === 'tesla') return t.indexOf('tesla') >= 0 || t.indexOf('lightning') >= 0 || t.indexOf('electric') >= 0
	if (mode === 'magic') return t.indexOf('irons_spellbooks') === 0 || t === 'minecraft:magic' || t === 'minecraft:indirect_magic'
	if (mode === 'turrets') {
		if (t.indexOf('explosion') >= 0 || t.indexOf('tesla') >= 0 || t.indexOf('lightning') >= 0) return true
		if (!nsSsRealPlayer(attacker)) return true // турели, големы, деплоеры (FakePlayer), падения, огонь
		var dn = nsSsNs(direct)
		return dn === 'createbigcannons' || dn === 'cbc_at' || dn === 'creategbd' || dn === 'create' // снаряды пушек игрока
	}
	return true
}

NativeEvents.onEvent(NS_SS_DAMAGE, function (event) {
	try {
		var v = event.getEntity()
		var tags = v.getTags()
		if (tags.contains('ns_convoy')) {
			var tc = nsSsDmgType(event.getSource())
			if (tc === 'minecraft:fall' || tc === 'minecraft:in_wall' || tc === 'minecraft:cramming' || nsSsRealPlayer(nsNfAttacker(event.getSource()))) event.setCanceled(true)
			return
		}
		var hive = tags.contains('ns_hive')
		var mode = tags.contains('ns_imm_tesla') ? 'tesla' : tags.contains('ns_imm_turrets') ? 'turrets' : tags.contains('ns_imm_magic') ? 'magic' : null
		if (!hive && !mode) return
		var src = event.getSource()
		var t0 = nsSsDmgType(src)
		// служебный урон (/kill, пустота) проходит всегда — иначе «nightshift stop» не уберёт орду
		if (t0 === 'minecraft:generic_kill' || t0 === 'minecraft:out_of_world' || t0 === 'minecraft:outside_border') return
		var attacker = nsNfAttacker(src)
		var direct = nsSsDirect(src)
		if (hive) {
			// улей: только тот, кто в воздухе, его дракон или снаряд такого игрока
			var ok = false
			if (nsSsRealPlayer(attacker)) ok = nsSsAirborne(attacker)
			else if (attacker != null) ok = nsSsNs(attacker) === 'dmr' || nsSsNs(attacker) === 'immersive_aircraft'
			var t = nsSsDmgType(src)
			if (t.indexOf('tesla') >= 0 || t.indexOf('lightning') >= 0) ok = true // тесла-башня достаёт летунов
			if (!ok) {
				event.setCanceled(true)
				nsSsHint(attacker, 'hive')
				return
			}
		}
		if (mode && !nsSsAllowed(mode, src, attacker, direct)) {
			event.setCanceled(true)
			nsSsHint(attacker, mode)
		}
	} catch (x) {}
})

// --------------------------------------------------------------------------
// Сценарии: общее
// --------------------------------------------------------------------------
var NS_SS_HEIGHTMAP = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES

// Точка на поверхности в dist блоках от алтаря в случайном направлении, вне зон баз. null — не нашлось.
function nsSsSurfacePoint(level, altar, state, dist) {
	for (var a = 0; a < 24; a++) {
		var ang = Math.random() * Math.PI * 2
		var x = Math.round(altar.x + Math.cos(ang) * dist)
		var z = Math.round(altar.z + Math.sin(ang) * dist)
		if (nsPointInAnyZone(state, altar.dim, x, altar.y, z)) continue
		var near = false
		for (var i = 0; i < (state.altars || []).length; i++) {
			var al = state.altars[i]
			if (al.dim === altar.dim && Math.abs(al.x - x) < 120 && Math.abs(al.z - z) < 120) near = true
		}
		if (near) continue
		try {
			level.getChunk(x >> 4, z >> 4) // загрузить (и сгенерировать) чанк точки
			var y = level.getHeight(NS_SS_HEIGHTMAP, x, z)
			var below = level.getBlock(x, y - 1, z).getBlockState()
			if (!below.getFluidState().isEmpty()) continue // не в воду и не в лаву
			return { x: x, y: y, z: z }
		} catch (e) {}
	}
	return null
}

function nsSsTags(state, extra) {
	return '["nightshift_raid","ns_r' + state.raid.rid + '"' + (extra ? ',"' + extra + '"' : '') + ']'
}

function nsSsSummon(altar, id, x, y, z, nbt) {
	NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run summon ' + id + ' ' + x + ' ' + y + ' ' + z + ' ' + nbt)
}

// Живые сущности этого набега с меткой tag (по всему измерению)
function nsSsFind(level, state, tag) {
	var out = []
	var rid = 'ns_r' + state.raid.rid
	try {
		var it = level.getAllEntities().iterator()
		while (it.hasNext()) {
			var e = it.next()
			try {
				if (!e.isAlive()) continue
				var tg = e.getTags()
				if (tg.contains(rid) && tg.contains(tag)) out.push(e)
			} catch (x) {}
		}
	} catch (e) {}
	return out
}

// Участники сценария — игроки в измерении алтаря (не наблюдатели)
function nsSsPlayers(altar) {
	return nsParticipants(altar)
}

function nsSsCompass(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI // 0 — север, по часовой
	if (ang < 0) ang += 360
	var dirs = ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад']
	return dirs[Math.round(ang / 45) % 8]
}

// игровое время в тиках (KubeJS переименовал Level.getGameTime → getTime)
function nsSsNow(level) {
	try {
		return Number(level.getTime())
	} catch (e) {}
	return Number(level.getGameTime())
}

function nsSsClock(sec) {
	sec = Math.max(0, Math.round(sec))
	var m = Math.floor(sec / 60),
		s = sec % 60
	return m + ':' + (s < 10 ? '0' : '') + s
}

// Подсказка каждому: сколько и куда до цели
function nsSsGuide(altar, target, label) {
	var ps = nsSsPlayers(altar)
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		var dx = target.x - p.getX(),
			dz = target.z - p.getZ()
		var dist = Math.round(Math.sqrt(dx * dx + dz * dz))
		NSG.nsServer.runCommandSilent('title ' + p.getUsername() + ' actionbar {"text":"' + label + ': ' + dist + ' бл., ' + nsSsCompass(dx, dz) + '","color":"aqua"}')
	}
	// столб частиц над целью — видно издалека в загруженных чанках
	NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run particle minecraft:end_rod ' + target.x + ' ' + (target.y + 20) + ' ' + target.z + ' 0.3 20 0.3 0.01 80 force')
}

// --------------------------------------------------------------------------
// Старт сценария (из nsSpawnCurrentWave, вместо первой подволны)
// --------------------------------------------------------------------------
function nsScenarioStart(state, level, altar, hordeCfg) {
	var d = state.raid.difficulty || 1
	var key = hordeCfg.scenario
	var p = nsScenarioParams(key, d)
	var sc = { key: key, t0: nsSsNow(level), time: p.time, d: d }
	// добыча — всем в мире алтаря, кто был в начале (подволн нет — «присутствие» ставим сразу)
	state.raid.present = state.raid.present || {}
	var ps = nsSsPlayers(altar)
	for (var i = 0; i < ps.length; i++) state.raid.present[String(ps[i].getUsername())] = 99
	if (key === 'air') {
		sc.hives = p.hives
		for (var h = 0; h < p.hives; h++) {
			var ang = (Math.PI * 2 * h) / p.hives + Math.random() * 0.6
			var r = 45 + Math.random() * 25
			var hx = Math.round(altar.x + Math.cos(ang) * r),
				hz = Math.round(altar.z + Math.sin(ang) * r)
			var hy = Math.min(300, altar.y + 50 + Math.floor(Math.random() * 15))
			// улей — ванильный гаст без ИИ: оса-немезида ArPhEx сама себя ранит «без источника» и за это получает
			// неуязвимость мода, а ещё режет удары больше ~30. ns_boosted — общее усиление орды улей не трогает.
			nsSsSummon(altar, 'minecraft:ghast', hx, hy, hz, '{Tags:' + nsSsTags(state, 'ns_hive","ns_boosted') + ',NoAI:1b,PersistenceRequired:1b,NoGravity:1b,Glowing:1b,CustomName:\'"Улей-матка"\',CustomNameVisible:1b,attributes:[{id:"minecraft:generic.max_health",base:' + p.hiveHp + '.0d},{id:"minecraft:generic.scale",base:1.5d}],Health:' + p.hiveHp + '.0f}')
		}
		nsTitleAll('Воздушный бой', { color: 'aqua', bold: true, subtitle: 'Ульи над базой — бить только с воздуха', subColor: 'gray' })
	} else if (key === 'escape') {
		var pt = nsSsSurfacePoint(level, altar, state, p.dist)
		if (!pt) pt = { x: altar.x + p.dist, y: altar.y + 1, z: altar.z }
		sc.target = pt
		sc.reached = {}
		sc.chaserAt = 10 // Пожиратель выходит через 10 с — фора
		sc.speed = p.speed
		nsSsSummon(altar, 'minecraft:shulker', pt.x, pt.y, pt.z, '{Tags:' + nsSsTags(state, 'ns_marker') + ',NoAI:1b,Invulnerable:1b,PersistenceRequired:1b,Glowing:1b,Color:5b,CustomName:\'"Точка эвакуации"\',CustomNameVisible:1b}')
		nsTitleAll('Побег!', { color: 'red', bold: true, subtitle: 'Все к точке эвакуации: ' + p.dist + ' блоков, ' + nsSsCompass(pt.x - altar.x, pt.z - altar.z), subColor: 'yellow' })
	} else if (key === 'convoy') {
		var cp = nsSsSurfacePoint(level, altar, state, p.dist)
		if (!cp) cp = { x: altar.x + p.dist, y: altar.y + 1, z: altar.z }
		sc.target = cp
		sc.lost = 0
		sc.llamas = p.llamas
		sc.forced = [cp.x, cp.z]
		NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run forceload add ' + cp.x + ' ' + cp.z)
		var carpets = ['red', 'yellow', 'blue']
		for (var li = 0; li < p.llamas; li++) {
			var lx = cp.x + (li - 1) * 3,
				lz = cp.z + (li - 1) * 2
			// без метки nightshift_raid: орда не считает обоз «своим» (07_raid_no_infighting.js) и бьёт его
			nsSsSummon(altar, 'minecraft:llama', lx, cp.y + 1, lz, '{Tags:["ns_r' + state.raid.rid + '","ns_convoy"],PersistenceRequired:1b,Glowing:1b,Tame:1b,ChestedHorse:1b,Strength:5,Variant:' + li + ',body_armor_item:{id:"minecraft:' + carpets[li % 3] + '_carpet",count:1},CustomName:\'"Обоз ' + (li + 1) + '"\',CustomNameVisible:1b,attributes:[{id:"minecraft:generic.max_health",base:' + p.llamaHp + '.0d},{id:"minecraft:generic.movement_speed",base:0.4d},{id:"minecraft:generic.follow_range",base:64.0d}],Health:' + p.llamaHp + '.0f}')
		}
		nsTitleAll('Конвой', { color: 'gold', bold: true, subtitle: 'Обоз ждёт охрану в ' + p.dist + ' блоках, ' + nsSsCompass(cp.x - altar.x, cp.z - altar.z), subColor: 'yellow' })
	} else {
		var np = nsSsSurfacePoint(level, altar, state, p.dist)
		if (!np) np = { x: altar.x - p.dist, y: altar.y + 1, z: altar.z }
		sc.target = np
		sc.guards = p.guards
		sc.forced = [np.x, np.z]
		NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run forceload add ' + np.x + ' ' + np.z)
		nsSsBuildNest(altar, np)
		nsSsSummon(altar, 'arphex:spider_matriarch', np.x, np.y + 1, np.z, '{Tags:' + nsSsTags(state, 'ns_queen') + ',PersistenceRequired:1b,Glowing:1b,CustomName:\'"Матка гнезда"\',CustomNameVisible:1b,attributes:[{id:"minecraft:generic.max_health",base:' + p.queenHp + '.0d},{id:"minecraft:generic.scale",base:1.6d},{id:"minecraft:generic.follow_range",base:48.0d}],Health:' + p.queenHp + '.0f}')
		nsSsNestGuards(state, altar, np, p.guards)
		nsTitleAll('Штурм гнезда', { color: 'dark_green', bold: true, subtitle: 'Гнездо в ' + p.dist + ' блоках, ' + nsSsCompass(np.x - altar.x, np.z - altar.z), subColor: 'gray' })
	}
	state.raid.sc = sc
	state.raid.waveSize = 1
	nsSaveState(state)
	NSG.nsServer.runCommandSilent('playsound minecraft:event.raid.horn ambient @a')
	console.info('[nightshift] особая стадия «' + key + '» на волне ' + d)
}

// Гнездо: кольцо паутины и мха вокруг матки (декор, без машин) — на поверхности
function nsSsBuildNest(altar, np) {
	var at = 'execute in ' + altar.dim + ' run '
	NSG.nsServer.runCommandSilent(at + 'fill ' + (np.x - 5) + ' ' + (np.y - 1) + ' ' + (np.z - 5) + ' ' + (np.x + 5) + ' ' + (np.y - 1) + ' ' + (np.z + 5) + ' minecraft:mossy_cobblestone replace #minecraft:dirt')
	NSG.nsServer.runCommandSilent(at + 'fill ' + (np.x - 5) + ' ' + np.y + ' ' + (np.z - 5) + ' ' + (np.x + 5) + ' ' + (np.y + 3) + ' ' + (np.z + 5) + ' minecraft:cobweb replace minecraft:air')
	NSG.nsServer.runCommandSilent(at + 'fill ' + (np.x - 3) + ' ' + np.y + ' ' + (np.z - 3) + ' ' + (np.x + 3) + ' ' + (np.y + 3) + ' ' + (np.z + 3) + ' minecraft:air replace minecraft:cobweb')
}

function nsSsNestGuards(state, altar, np, n) {
	// только те, кто не исчезает сам без игрока рядом (у голиафа, выселителя, богомола, краба в ArPhEx — исчезают)
	var kinds = ['arphex:spider_prowler', 'arphex:spider_reaper', 'arphex:solifuge_skulker']
	for (var i = 0; i < n; i++) {
		var ang = Math.random() * Math.PI * 2
		var gx = Math.round(np.x + Math.cos(ang) * 6),
			gz = Math.round(np.z + Math.sin(ang) * 6)
		nsSsSummon(altar, kinds[i % kinds.length], gx, np.y + 1, gz, '{Tags:' + nsSsTags(state, 'ns_guard') + ',PersistenceRequired:1b}')
	}
	nsBoostRaidMobs(nsRaidBuff({}), { hp: nsWaveToughHp(state.raid.difficulty || 1), damage: 0, speed: 0 })
}

// --------------------------------------------------------------------------
// Тик сценария (раз в секунду, из nsTickActiveRaid — вместо подволн и паузы)
// --------------------------------------------------------------------------
function nsScenarioTick(state, level, altar) {
	var sc = state.raid.sc
	var now = nsSsNow(level)
	var left = sc.time - (now - sc.t0) / 20
	if (sc.key === 'air') {
		// счёт — по гибели ульев (death-событие), а не по тому, кого видно: выгруженный чанк не «убивает» улей
		var aliveH = Math.max(0, sc.hives - (sc.hiveKills || 0))
		var hives = nsSsFind(level, state, 'ns_hive')
		nsBossbarCreate('nightshift:raid_wave', 'Воздушный бой: ульев ' + aliveH + ' из ' + sc.hives + ' · ' + nsSsClock(left), 'blue')
		nsBossbarMax('nightshift:raid_wave', sc.hives)
		nsBossbarValue('nightshift:raid_wave', aliveH)
		if (aliveH === 0) return nsScenarioWin(state, level, 'Все ульи сбиты!')
		// ульи выпускают летунов
		if (Math.floor((now - sc.t0) / 20) % 12 === 0) {
			var flyers = nsSsFind(level, state, 'ns_hivespawn').length
			var cap = 6 * hives.length
			var pool = ['arphex:dragonfly_dreadnought', 'arphex:hornet_harbinger_giant', 'arphex:locust_landscourge']
			var per = nsScenarioParams('air', sc.d).flyersPer
			for (var h = 0; h < hives.length && flyers < cap; h++) {
				for (var k = 0; k < per && flyers < cap; k++, flyers++) {
					nsSsSummon(altar, pool[(h + k) % pool.length], Math.round(hives[h].getX()), Math.round(hives[h].getY() - 3), Math.round(hives[h].getZ()), '{Tags:' + nsSsTags(state, 'ns_hivespawn') + ',PersistenceRequired:1b}')
				}
			}
			nsBoostRaidMobs(nsRaidBuff({}), { hp: nsWaveToughHp(sc.d), damage: 0, speed: 0 })
		}
	} else if (sc.key === 'escape') {
		var target = sc.target
		var ps = nsSsPlayers(altar)
		var need = 0,
			got = 0
		for (var i = 0; i < ps.length; i++) {
			var n = String(ps[i].getUsername())
			var dx = target.x - ps[i].getX(),
				dz = target.z - ps[i].getZ()
			if (dx * dx + dz * dz <= 64 && Math.abs(target.y - ps[i].getY()) < 12) {
				if (!sc.reached[n]) nsTellAll(Text.green('[Ночная смена] ' + n + ' на точке эвакуации!'))
				sc.reached[n] = true
			}
			need++
			if (sc.reached[n]) got++
		}
		nsSsGuide(altar, target, 'Эвакуация')
		nsBossbarCreate('nightshift:raid_wave', 'Побег: на точке ' + got + ' из ' + need + ' · ' + nsSsClock(left), 'red')
		nsBossbarMax('nightshift:raid_wave', Math.max(1, need))
		nsBossbarValue('nightshift:raid_wave', got)
		if (need > 0 && got >= need) return nsScenarioWin(state, level, 'Все на точке эвакуации — Пожиратель остался ни с чем!')
		nsSsChaser(state, level, altar, sc, ps)
	} else if (sc.key === 'convoy') {
		var cv = nsSsConvoyTick(state, level, altar, sc, now)
		if (cv === 'win') return nsScenarioWin(state, level, 'Обоз дошёл до базы — снабжение доставлено!')
		if (cv === 'fail') {
			nsTellAll(Text.red('[Ночная смена] Обоз потерян целиком.'))
			return nsScenarioFail(state, level, altar)
		}
	} else {
		nsSsGuide(altar, sc.target, 'Гнездо')
		nsBossbarCreate('nightshift:raid_wave', 'Штурм гнезда: матка ' + (sc.queenDead ? 'убита' : 'жива') + ' · ' + nsSsClock(left), 'green')
		nsBossbarMax('nightshift:raid_wave', 1)
		nsBossbarValue('nightshift:raid_wave', sc.queenDead ? 0 : 1)
		if (sc.queenDead) return nsScenarioWin(state, level, 'Матка убита, гнездо пало!')
		// стража подтягивается каждые 30 с, пока матка жива
		if (Math.floor((now - sc.t0) / 20) % 30 === 0 && nsSsFind(level, state, 'ns_guard').length < sc.guards * 2) nsSsNestGuards(state, altar, sc.target, Math.ceil(sc.guards / 2))
	}
	if (left <= 0) return nsScenarioFail(state, level, altar)
	nsSaveState(state)
}

// Пожиратель (побег): неубиваемый, гонится за ближайшим, отставших догоняет прыжком
function nsSsChaser(state, level, altar, sc, ps) {
	if (sc.chaserAt > 0) {
		sc.chaserAt--
		if (sc.chaserAt === 0) {
			// первый выход — у алтаря; если пропал — за спиной ближайшего ещё не спасшегося (на 28 блоков ближе к алтарю)
			var spx = altar.x + 8,
				spy = altar.y + 1,
				spz = altar.z + 8
			if (sc.chaserSpawned) {
				var nb = null,
					nd = 1e18
				for (var q = 0; q < ps.length; q++) {
					if (sc.reached[String(ps[q].getUsername())]) continue
					var qx = ps[q].getX() - altar.x,
						qz = ps[q].getZ() - altar.z
					if (qx * qx + qz * qz < nd) {
						nd = qx * qx + qz * qz
						nb = ps[q]
					}
				}
				if (nb) {
					var vx = altar.x - nb.getX(),
						vz = altar.z - nb.getZ()
					var vl = Math.sqrt(vx * vx + vz * vz) || 1
					spx = Math.round(nb.getX() + (vx / vl) * 28)
					spz = Math.round(nb.getZ() + (vz / vl) * 28)
					try {
						level.getChunk(spx >> 4, spz >> 4)
						spy = level.getHeight(NS_SS_HEIGHTMAP, spx, spz)
					} catch (e) {}
				}
			}
			sc.chaserSpawned = true
			nsSsSummon(altar, 'arphex:spider_goliath', spx, spy, spz, '{Tags:' + nsSsTags(state, 'ns_chaser') + ',PersistenceRequired:1b,Invulnerable:1b,Glowing:1b,CustomName:\'"Пожиратель"\',CustomNameVisible:1b,attributes:[{id:"minecraft:generic.scale",base:3.0d},{id:"minecraft:generic.movement_speed",base:' + sc.speed + 'd},{id:"minecraft:generic.follow_range",base:128.0d},{id:"minecraft:generic.attack_damage",base:14.0d}]}')
			if (!sc.chaserTold) {
				nsTitleAll('Пожиратель вышел', { color: 'dark_red', bold: true, subtitle: 'Бегите!', subColor: 'red' })
				NSG.nsServer.runCommandSilent('playsound minecraft:entity.warden.emerge hostile @a')
				sc.chaserTold = true
			}
		}
		return
	}
	var ch = nsSsFind(level, state, 'ns_chaser')
	if (!ch.length) {
		// голиаф ArPhEx сам исчезает без игроков рядом — Пожиратель возвращается
		sc.chaserAt = 1
		return
	}
	var c = ch[0]
	var best = null,
		bd = 1e18
	for (var i = 0; i < ps.length; i++) {
		if (sc.reached[String(ps[i].getUsername())]) continue
		var dx = ps[i].getX() - c.getX(),
			dz = ps[i].getZ() - c.getZ()
		var dd = dx * dx + dz * dz
		if (dd < bd) {
			bd = dd
			best = ps[i]
		}
	}
	if (!best) return
	try {
		c.setTarget(best)
	} catch (e) {}
	// отстал больше чем на 48 — прыжок за спину жертве (на 24 блока ближе к алтарю)
	if (bd > 48 * 48) {
		var bx = best.getX(),
			bz = best.getZ()
		var ax = altar.x - bx,
			az = altar.z - bz
		var len = Math.sqrt(ax * ax + az * az) || 1
		var tx = Math.round(bx + (ax / len) * 24),
			tz = Math.round(bz + (az / len) * 24)
		try {
			level.getChunk(tx >> 4, tz >> 4)
			c.teleportTo(tx + 0.5, level.getHeight(NS_SS_HEIGHTMAP, tx, tz), tz + 0.5)
		} catch (e) {}
	}
}

// --------------------------------------------------------------------------
// Конвой: ламы идут к алтарю, пока рядом охрана; засады бьют обоз
// --------------------------------------------------------------------------
var NS_SS_AMBUSH = ['arphex:spider_prowler', 'arphex:spider_reaper', 'arphex:solifuge_skulker', 'arphex:dragonfly_dreadnought']

function nsSsConvoyTick(state, level, altar, sc, now) {
	var p = nsScenarioParams('convoy', sc.d)
	var left = sc.time - (now - sc.t0) / 20
	// провал — только по гибели лам (death-событие): в первые секунды чанк обоза может ещё не отдать сущности
	if ((sc.lost || 0) >= sc.llamas) return 'fail'
	var ll = nsSsFind(level, state, 'ns_convoy')
	if (!ll.length) {
		nsSsGuide(altar, sc.target, 'Обоз ждёт охрану')
		return null
	}
	var ps = nsSsPlayers(altar)
	var arrived = 0,
		lead = null,
		leadD = 1e18
	for (var i = 0; i < ll.length; i++) {
		var l = ll[i]
		var dx = altar.x - l.getX(),
			dz = altar.z - l.getZ()
		var dd = Math.sqrt(dx * dx + dz * dz)
		if (dd <= 12) {
			arrived++
			continue
		}
		if (dd < leadD) {
			leadD = dd
			lead = l
		}
	}
	if (arrived === ll.length) return 'win'
	// охрана рядом — обоз идёт; нет никого ближе 48 блоков — ждёт
	var guarded = false
	for (var g = 0; g < ps.length && lead; g++) {
		var gx = ps[g].getX() - lead.getX(),
			gz = ps[g].getZ() - lead.getZ()
		if (gx * gx + gz * gz <= 48 * 48) guarded = true
	}
	var pos = lead ? { x: Math.round(lead.getX()), y: Math.round(lead.getY()), z: Math.round(lead.getZ()) } : sc.target
	nsSsGuide(altar, pos, guarded ? 'Обоз идёт, до базы ' + Math.round(leadD) + ' бл. · к обозу' : 'Обоз ждёт охрану')
	nsBossbarCreate('nightshift:raid_wave', 'Конвой: дошло ' + arrived + ', в пути ' + (ll.length - arrived) + ', потеряно ' + (sc.lost || 0) + ' · ' + nsSsClock(left), 'yellow')
	nsBossbarMax('nightshift:raid_wave', sc.llamas)
	nsBossbarValue('nightshift:raid_wave', ll.length)
	// загрузка чанка идёт за головой обоза
	if (lead) {
		var cx = pos.x,
			cz = pos.z
		if (!sc.forced || cx >> 4 !== sc.forced[0] >> 4 || cz >> 4 !== sc.forced[1] >> 4) {
			if (sc.forced) NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run forceload remove ' + sc.forced[0] + ' ' + sc.forced[1])
			NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run forceload add ' + cx + ' ' + cz)
			sc.forced = [cx, cz]
		}
	}
	if (!guarded) return null
	sc.moved = (sc.moved || 0) + 1
	for (var k = 0; k < ll.length; k++) nsSsConvoyStep(level, altar, ll[k])
	// засада — через раз по ambushEvery, впереди и сбоку от головы обоза
	if (lead && sc.moved % p.ambushEvery === 0) {
		var base = Math.atan2(altar.z - lead.getZ(), altar.x - lead.getX())
		for (var a = 0; a < p.ambushN; a++) {
			var ang = base + (Math.random() - 0.5) * 2.2
			var r = 18 + Math.random() * 8
			var ax = Math.round(lead.getX() + Math.cos(ang) * r),
				az = Math.round(lead.getZ() + Math.sin(ang) * r)
			var ay = altar.y + 1
			try {
				ay = level.getHeight(NS_SS_HEIGHTMAP, ax, az)
			} catch (e) {}
			nsSsSummon(altar, NS_SS_AMBUSH[(a + sc.moved) % NS_SS_AMBUSH.length], ax, ay, az, '{Tags:' + nsSsTags(state, 'ns_ambush') + ',PersistenceRequired:1b}')
		}
		nsBoostRaidMobs(nsRaidBuff({}), { hp: nsWaveToughHp(sc.d), damage: 0, speed: 0 })
		NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' positioned ' + pos.x + ' ' + pos.y + ' ' + pos.z + ' run playsound minecraft:event.raid.horn hostile @a[distance=..96] ~ ~ ~ 2')
	}
	// засада целится в обоз
	var amb = nsSsFind(level, state, 'ns_ambush')
	for (var m = 0; m < amb.length; m++) {
		try {
			var t = amb[m].getTarget()
			if (t != null && t.isAlive()) continue
			var best = null,
				bd = 1e18
			for (var q = 0; q < ll.length; q++) {
				var ex = ll[q].getX() - amb[m].getX(),
					ez = ll[q].getZ() - amb[m].getZ()
				if (ex * ex + ez * ez < bd) {
					bd = ex * ex + ez * ez
					best = ll[q]
				}
			}
			if (best) amb[m].setTarget(best)
		} catch (e) {}
	}
	return null
}

// Шаг ламы: путь к точке в 20 блоках по направлению к алтарю; застряла на 6 с — подталкиваем на 6 блоков
function nsSsConvoyStep(level, altar, l) {
	try {
		var dx = altar.x - l.getX(),
			dz = altar.z - l.getZ()
		var dd = Math.sqrt(dx * dx + dz * dz)
		if (dd <= 12) return
		var step = Math.min(20, dd)
		var wx = Math.round(l.getX() + (dx / dd) * step),
			wz = Math.round(l.getZ() + (dz / dd) * step)
		var wy = level.getHeight(NS_SS_HEIGHTMAP, wx, wz)
		l.getNavigation().moveTo(wx + 0.5, wy, wz + 0.5, 1.6) // ~3 бл/с: 450 блоков — около 2,5 минут чистого хода
		var pd = l.persistentData
		var best = pd.contains('ns_cv_d') ? pd.getDouble('ns_cv_d') : 1e9
		if (dd < best - 1) {
			pd.putDouble('ns_cv_d', dd)
			pd.putInt('ns_cv_s', 0)
			return
		}
		var st = pd.getInt('ns_cv_s') + 1
		pd.putInt('ns_cv_s', st)
		if (st >= 6) {
			var tx = Math.round(l.getX() + (dx / dd) * 6),
				tz = Math.round(l.getZ() + (dz / dd) * 6)
			l.teleportTo(tx + 0.5, level.getHeight(NS_SS_HEIGHTMAP, tx, tz), tz + 0.5)
			pd.putInt('ns_cv_s', 0)
		}
	} catch (e) {}
}

function nsScenarioCleanup(state) {
	var sc = state.raid.sc
	if (sc && sc.forced) {
		var al = nsFindAltar(state, state.raid.altarId)
		if (al) NSG.nsServer.runCommandSilent('execute in ' + al.dim + ' run forceload remove ' + sc.forced[0] + ' ' + sc.forced[1])
	}
	// убираем без смерти (discard): /kill засчитал бы мобов в контракты «убей N» и сбил счёт ульев
	var al2 = nsFindAltar(state, state.raid.altarId)
	if (al2) {
		var lv = nsAltarLevel(al2)
		var all = nsSsFind(lv, state, 'nightshift_raid').concat(nsSsFind(lv, state, 'ns_convoy'))
		for (var i = 0; i < all.length; i++) nsRemoveMob(all[i])
	}
}

// Гибель ульев и матки — в счёт сценария (смерть, а не «пропал из виду»)
EntityEvents.death(event => {
	try {
		var e = event.entity
		var tg = e.getTags()
		var hive = tg.contains('ns_hive'),
			queen = tg.contains('ns_queen'),
			convoy = tg.contains('ns_convoy')
		if (!hive && !queen && !convoy) return
		var st = nsGetState()
		if (!st || !st.raid || !st.raid.sc || !tg.contains('ns_r' + st.raid.rid)) return
		if (hive) {
			st.raid.sc.hiveKills = (st.raid.sc.hiveKills || 0) + 1
			nsTellAll(Text.aqua('[Ночная смена] Улей сбит! Осталось ' + Math.max(0, st.raid.sc.hives - st.raid.sc.hiveKills) + '.'))
		}
		if (queen) st.raid.sc.queenDead = true
		if (convoy) {
			st.raid.sc.lost = (st.raid.sc.lost || 0) + 1
			nsTellAll(Text.red('[Ночная смена] ' + String(e.getName().getString()) + ' потерян! В обозе осталось ' + Math.max(0, st.raid.sc.llamas - st.raid.sc.lost) + '.'))
		}
		nsSaveState(st)
	} catch (x) {}
})

function nsScenarioWin(state, level, text) {
	nsTellAll(Text.green('[Ночная смена] ' + text))
	nsScenarioCleanup(state)
	state.raid.sc = null
	state.raid.bossSpawned = true // победа: набег закрывается наградами как обычно
	nsSaveState(state)
	nsRaidVictory(state)
}

function nsScenarioFail(state, level, altar) {
	nsTellAll(Text.red('[Ночная смена] Время вышло — особая стадия «' + (NSG.NS_SPECIAL_STAGES[state.raid.difficulty] || { name: '' }).name + '» провалена.'))
	nsScenarioCleanup(state)
	state.raid.sc = null
	nsRaidFail(state, [])
}

// «Блэкаут»: «Тьма» защитникам в измерении алтаря весь набег (раз в 5 с на 7 с), как условие «Без света»
var nsSsDarkTick = 0
ServerEvents.tick(event => {
	try {
		if (++nsSsDarkTick % 100 !== 0) return
		var st = nsGetState()
		if (!st || !st.raid || st.raid.state !== 'active' || st.raid.kind === 'minor') return
		var sp = NSG.NS_SPECIAL_STAGES[st.raid.difficulty]
		if (!sp || sp.kind !== 'invis' || sp.name !== 'Блэкаут') return
		var altar = nsFindAltar(st, st.raid.altarId)
		if (altar) NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run effect give @a[gamemode=!creative,gamemode=!spectator] minecraft:darkness 7 0 true')
	} catch (e) {}
})

// Сироты сценариев: обоз, ульи, стража, Пожиратель от прошлого набега всплывают при загрузке чанка — убираем
var NS_SS_ORPHAN_TAGS = ['ns_convoy', 'ns_hive', 'ns_queen', 'ns_guard', 'ns_chaser', 'ns_marker', 'ns_ambush', 'ns_hivespawn']
EntityEvents.spawned(event => {
	try {
		var e = event.entity
		var tg = e.getTags()
		if (tg.isEmpty()) return
		var hit = false
		for (var i = 0; i < NS_SS_ORPHAN_TAGS.length; i++) if (tg.contains(NS_SS_ORPHAN_TAGS[i])) hit = true
		if (!hit) return
		var st = nsGetState()
		if (st && st.raid && st.raid.state === 'active' && tg.contains('ns_r' + st.raid.rid)) return
		event.cancel()
	} catch (x) {}
})
