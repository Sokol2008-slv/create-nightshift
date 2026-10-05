// ==========================================================================
// Ночная смена — НОВЫЕ ОСОБЫЕ СТАДИИ (05.10.2026, поток W; Георгий: «громадный апдейт: новые волны, режимы продумать,
// улучшить колоссально»). Номера и тексты — NSG.NS_SPECIAL_STAGES (45_special_stages.js), здесь — логика.
// В отличие от сценариев 45_ у всех пяти обычные подволны орды (премьеры, гастроли, условия смены работают) и все
// идут и на арене. Каждая требует своего, а не «той же стены»:
//  - «Ритуал» (21, 51): алтарь заряжается, пока в круге у алтаря (4 блока) стоит защитник и рядом с алтарём (8 блоков)
//    нет мобов. Орда идёт по кругу, следующая подволна — не дожидаясь конца прошлой (раз в 45 с). 100 % — победа,
//    остатки орды уходят. Кто-то держит центр, остальные чистят подходы.
//  - «Охота на вожаков» (29, 53): у кольца выхода орды встают вожаки (светятся, ×толще, держатся своего места) и раз в
//    3 с злят мобов рядом («Сила I», «Скорость I»). Пока вожаки живы, орда идёт по кругу. Через 8 минут вожаки идут
//    на алтарь сами (у алтаря бьют по прочности, как боссы). Все вожаки убиты — победа. Нужна вылазка за стены.
//  - «Гидра» (33, 59): убитый моб набега делится на двоих в 0,75 роста и с 40 % (II — 50 %) его здоровья. Половинки
//    больше не делятся. Летуны, подрывники и плодящие детёнышей не делятся; больше 100 живых — тоже нет.
//  - «Поединок» (39, 61): каждому защитнику — свой чемпион (Древний рыцарь Iron's Spells, на 61-й — Аптргангр). Ранить
//    его может только «свой» игрок, урон остальных и машин гаснет; чемпион идёт за своим и догоняет. Орда — вполсилы.
//    Победа — когда подволны кончились и все чемпионы пали. Вышел из игры — поединок засчитан через 30 с.
//  - «Удержание рубежей» (47, 67): три рубежа в 9–13 блоках от алтаря (на арене — в коридоре). Орда идёт на рубежи,
//    а не на алтарь. Моб на рубеже без защитника рядом — рубеж падает (~10–25 с), защитник без мобов отбивает его
//    назад. Пали все три разом — провал; продержаться 6 (II — 7) минут — победа.
// Хуки (40_nightshift_raid.js): nsSpecialTick — исход каждую секунду; nsSpecialNavTarget — куда идёт моб;
// nsUnitNav — вожаки и чемпионы (тег ns_unit); nsSpecialBarText — строка полосы; nsSpecialCleanup — уборка.
// Прогноз — nsSp2Forecast (45_). Правила Rhino: только var; исключения в NativeEvents — в try/catch.
// ==========================================================================

function nsSp2Params(key, d) {
	var lvl = d >= 50 ? 2 : 1
	if (key === 'ritual') return { lvl: lvl, rate: lvl === 1 ? 0.5 : 0.4, radius: 4, clear: 8, every: 45 }
	if (key === 'leaders') return { lvl: lvl, n: lvl === 1 ? 2 : 3, hp: Math.round((150 + 10 * d) * (1 + nsWaveToughHp(d))), rush: 480, aura: 12, id: d < 45 ? 'arphex:ant_arsonist_soldier' : 'cataclysm:ignited_revenant' }
	if (key === 'split') return { lvl: lvl, share: lvl === 1 ? 0.4 : 0.5, maxAlive: 100 }
	if (key === 'duel') return { lvl: lvl, hp: Math.round(150 + 15 * d), id: d < 50 ? 'irons_spellbooks:citadel_keeper' : 'cataclysm:aptrgangr', name: d < 50 ? 'Древний рыцарь' : 'Аптргангр', grace: 30 }
	if (key === 'hold') return { lvl: lvl, time: 300 + 60 * lvl, every: 40, r: 4, pr: 5 }
	return { lvl: lvl }
}

// Строки прогноза у алтаря и в досье (45_: nsSpecialForecast)
function nsSp2Forecast(sp, d) {
	var p = nsSp2Params(sp.key, d)
	if (sp.kind === 'ritual') return ['Заряд ' + p.rate.toString().replace('.', ',') + ' % в секунду — не меньше ' + Math.ceil(100 / p.rate / 60) + ' мин. Новая подволна — раз в ' + p.every + ' с, даже если прошлая жива.']
	if (sp.kind === 'leaders') return ['Вожаков: ' + p.n + ' + по одному на каждого игрока сверх первого, ~' + p.hp + ' HP. Через ' + Math.round(p.rush / 60) + ' мин они пойдут на алтарь сами.']
	if (sp.kind === 'split') return ['Половинка — ' + Math.round(p.share * 100) + ' % здоровья родителя, больше не делится. Летуны, подрывники и выводки не делятся. Орда на 30 % меньше обычной.']
	if (sp.kind === 'duel') return ['Чемпион — ' + p.name + ', ~' + p.hp + ' HP. Только ваш удар; турели, друзья и тесла — мимо. Орда вполсилы — оборона должна стоять сама.']
	if (sp.kind === 'hold') return ['Рубежей 3, держать ' + Math.round(p.time / 60) + ' мин. Новая подволна — раз в ' + p.every + ' с. Алтарь тоже цел должен быть.']
	return []
}

function nsSp2Kind(cfg) {
	return cfg && cfg.special ? cfg.special.kind : null
}

// --------------------------------------------------------------------------
// Исход каждую секунду: 'win' | 'fail' | null
// --------------------------------------------------------------------------
function nsSpecialTick(state, level, altar, mobs, cfg) {
	var kind = nsSp2Kind(cfg)
	if (!kind) return null
	var d = state.raid.difficulty || 1
	var out = null
	if (kind === 'ritual') out = nsSp2Ritual(state, level, altar, mobs, nsSp2Params('ritual', d))
	else if (kind === 'leaders') out = nsSp2Leaders(state, level, altar, mobs, nsSp2Params('leaders', d))
	else if (kind === 'duel') out = nsSp2Duel(state, level, altar, mobs, nsSp2Params('duel', d))
	else if (kind === 'hold') out = nsSp2Hold(state, level, altar, mobs, nsSp2Params('hold', d))
	else return null
	// состояние стадии (state.raid.sp) — сразу на диск: дальше по тику набег сохраняет не каждую секунду
	nsSaveState(state)
	return out
}

function nsSp2Fighters(mobs) {
	var out = []
	for (var i = 0; i < mobs.length; i++) if (!nsHasTag(mobs[i], 'ns_unit')) out.push(mobs[i])
	return out
}

function nsSp2Near(list, x, y, z, r, dyMax) {
	var n = 0
	for (var i = 0; i < list.length; i++) {
		var e = list[i]
		var dx = e.getX() - x,
			dz = e.getZ() - z
		if (dx * dx + dz * dz <= r * r && Math.abs(e.getY() - y) <= dyMax) n++
	}
	return n
}

function nsSp2At(altar, x, y, z) {
	return 'execute in ' + altar.dim + ' positioned ' + x + ' ' + y + ' ' + z + ' run '
}

// --------------------------------------------------------------------------
// «Ритуал»
// --------------------------------------------------------------------------
function nsSp2Ritual(state, level, altar, mobs, p) {
	var sp = state.raid.sp
	if (!sp || sp.key !== 'ritual') sp = state.raid.sp = { key: 'ritual', charge: 0, said: 0 }
	var cx = altar.x + 0.5,
		cz = altar.z + 0.5
	var inCircle = nsSp2Near(nsParticipants(altar), cx, altar.y, cz, p.radius + 0.5, 3)
	if (NSG.nsTestRitual) inCircle++ // только тест без клиента (zz_test_*)
	var near = nsSp2Near(nsSp2Fighters(mobs), cx, altar.y, cz, p.clear, 6)
	var ok = inCircle > 0 && near === 0
	if (ok) sp.charge = Math.min(100, sp.charge + p.rate)
	sp.st = inCircle === 0 ? 'empty' : near > 0 ? 'blocked' : 'ok'
	sp.near = near
	var at = nsSp2At(altar, cx, altar.y + 1, cz)
	NSG.nsServer.runCommandSilent(at + 'particle ' + (ok ? 'minecraft:enchant' : 'minecraft:smoke') + ' ~ ~1 ~ ' + p.radius / 2 + ' 0.5 ' + p.radius / 2 + ' 0.5 ' + (ok ? 40 : 10) + ' force')
	if (Math.floor(sp.charge / 25) > sp.said && sp.charge < 100) {
		sp.said = Math.floor(sp.charge / 25)
		nsTellAll(Text.lightPurple('[Ночная смена] Ритуал: ' + sp.said * 25 + ' %.'))
		NSG.nsServer.runCommandSilent(at + 'playsound minecraft:block.beacon.power_select ambient @a ~ ~ ~ 2 ' + (0.8 + sp.said * 0.15))
	}
	var hint = ok ? 'Ритуал ' + Math.floor(sp.charge) + ' % — держите круг' : sp.st === 'empty' ? 'Ритуал стоит: встаньте в круг у алтаря (4 блока)' : 'Ритуал стоит: у алтаря мобы (' + near + ') — отбейте'
	NSG.nsServer.runCommandSilent(nsSp2At(altar, cx, altar.y, cz) + 'title @a[distance=..48] actionbar {"text":"' + hint + '","color":"' + (ok ? 'light_purple' : 'red') + '"}')
	return sp.charge >= 100 ? 'win' : null
}

// --------------------------------------------------------------------------
// «Охота на вожаков»
// --------------------------------------------------------------------------
function nsSp2Leaders(state, level, altar, mobs, p) {
	var sp = state.raid.sp
	if (!sp || sp.key !== 'leaders') sp = state.raid.sp = { key: 'leaders', t: 0, n: 0, zero: 0 }
	sp.t++
	if (!sp.spawned && state.raid.waveSeen) {
		var n = p.n + Math.round((nsPartyScale() - 1) / 0.5)
		for (var i = 0; i < n; i++) {
			var pt = nsRingPoint(level, altar, state)
			if (!pt) continue
			NSG.nsServer.runCommandSilent(
				'execute in ' + altar.dim + ' run summon ' + p.id + ' ' + pt.x + ' ' + pt.y + ' ' + pt.z +
					' {Tags:["nightshift_raid","ns_r' + state.raid.rid + '","ns_unit","ns_leader","ns_boosted"],PersistenceRequired:1b,Glowing:1b,CustomName:\'"Вожак орды"\',CustomNameVisible:1b,' +
					'attributes:[{id:"minecraft:generic.max_health",base:' + p.hp + '.0d},{id:"minecraft:generic.scale",base:1.5d},{id:"minecraft:generic.follow_range",base:24.0d},{id:"minecraft:generic.knockback_resistance",base:0.8d}],Health:' + p.hp + '.0f,' +
					'active_effects:[{id:"minecraft:resistance",amplifier:0b,duration:-1,show_particles:0b}]}'
			)
			sp.n++
		}
		sp.spawned = true
		sp.at = sp.t
		nsTitleAll('Охота на вожаков', { color: 'gold', bold: true, subtitle: 'Вожаков: ' + sp.n + ' — у кольца выхода орды, светятся. Пока живы — орда не кончится', subColor: 'yellow' })
		console.info('[nightshift] вожаков: ' + sp.n + ' по ~' + p.hp + ' HP')
	}
	if (!sp.spawned) return null
	// живые вожаки — по всему измерению раз в 2 с (getAllEntities: призванный в незагруженном чанке виден не сразу —
	// пустой счёт засчитываем с 6-й секунды и только дважды подряд)
	if (sp.t % 2 === 0) {
		var ls = nsSsFind(level, state, 'ns_leader')
		sp.alive = ls.length
		if (ls.length === 0 && sp.t - sp.at >= 6) sp.zero++
		else sp.zero = 0
		// аура: мобы набега в aura блоках — «Сила I» и «Скорость I» на 4 с
		for (var k = 0; k < ls.length; k++) {
			NSG.nsServer.runCommandSilent(nsSp2At(altar, ls[k].getX().toFixed(1), ls[k].getY().toFixed(1), ls[k].getZ().toFixed(1)) + 'effect give @e[tag=nightshift_raid,tag=!ns_unit,distance=..' + p.aura + '] minecraft:strength 4 0 true')
			NSG.nsServer.runCommandSilent(nsSp2At(altar, ls[k].getX().toFixed(1), ls[k].getY().toFixed(1), ls[k].getZ().toFixed(1)) + 'effect give @e[tag=nightshift_raid,tag=!ns_unit,distance=..' + p.aura + '] minecraft:speed 4 0 true')
		}
		// не нашли вожаков за 8 минут — идут на алтарь сами
		if (!sp.rush && sp.t - sp.at >= p.rush && ls.length) {
			sp.rush = true
			for (var r = 0; r < ls.length; r++) ls[r].addTag('ns_rush')
			nsTitleAll('Вожаки идут на алтарь!', { color: 'red', bold: true, subtitle: 'Встречайте — у алтаря они бьют по прочности, как боссы', subColor: 'gray' })
		}
	}
	return sp.zero >= 2 ? 'win' : null
}

// --------------------------------------------------------------------------
// «Поединок»
// --------------------------------------------------------------------------
function nsSp2SafeName(name) {
	return String(name).replace(/[^A-Za-z0-9_]/g, '_')
}

function nsSp2Duel(state, level, altar, mobs, p) {
	var sp = state.raid.sp
	if (!sp || sp.key !== 'duel') sp = state.raid.sp = { key: 'duel', t: 0, n: 0, won: 0, zero: 0, away: {} }
	sp.t++
	if (!sp.spawned) {
		var ps = nsParticipants(altar)
		for (var i = 0; i < ps.length; i++) {
			var name = String(ps[i].getUsername())
			var a = Math.random() * Math.PI * 2
			var x = Math.round(ps[i].getX() + Math.cos(a) * 10),
				z = Math.round(ps[i].getZ() + Math.sin(a) * 10)
			var y = nsFindSpawnY(level, x, z, Math.floor(ps[i].getY()), true)
			if (y === null) {
				x = Math.round(ps[i].getX())
				z = Math.round(ps[i].getZ())
				y = Math.floor(ps[i].getY())
			}
			NSG.nsServer.runCommandSilent(
				'execute in ' + altar.dim + ' run summon ' + p.id + ' ' + x + ' ' + y + ' ' + z +
					' {Tags:["nightshift_raid","ns_r' + state.raid.rid + '","ns_unit","ns_duel","ns_duel_' + nsSp2SafeName(name) + '","ns_boosted"],PersistenceRequired:1b,Glowing:1b,CustomName:\'"Чемпион — ' + name + '"\',CustomNameVisible:1b,' +
					'attributes:[{id:"minecraft:generic.max_health",base:' + p.hp + '.0d},{id:"minecraft:generic.movement_speed",base:0.27d},{id:"minecraft:generic.follow_range",base:64.0d},{id:"minecraft:generic.scale",base:1.25d},{id:"minecraft:generic.knockback_resistance",base:0.6d}],Health:' + p.hp + '.0f}'
			)
			sp.n++
		}
		sp.spawned = true
		nsTitleAll('Поединок', { color: 'gold', bold: true, subtitle: 'Каждому — свой чемпион. Ранить его можешь только ты', subColor: 'yellow' })
		NSG.nsServer.runCommandSilent('playsound minecraft:event.raid.horn ambient @a')
		if (!sp.n) console.warn('[nightshift] поединок: защитников в измерении алтаря нет — чемпионов не будет')
	}
	if (sp.t % 2 === 0) {
		var cs = nsSsFind(level, state, 'ns_duel')
		sp.alive = cs.length
		if (cs.length === 0 && sp.t >= 6) sp.zero++
		else sp.zero = 0
		for (var k = 0; k < cs.length; k++) nsSp2DuelFollow(cs[k], altar, level, sp, p)
	}
	return state.raid.wavesDone && sp.zero >= 2 ? 'win' : null
}

// Чемпион идёт за своим игроком; тот ушёл из игры или из измерения — через grace с поединок засчитан
function nsSp2DuelFollow(c, altar, level, sp, p) {
	var tags = c.getTags().toArray()
	var owner = null
	for (var i = 0; i < tags.length; i++) {
		var t = String(tags[i])
		if (t.indexOf('ns_duel_') === 0) owner = t.substring(8)
	}
	var pl = null
	var ps = nsParticipants(altar)
	for (var j = 0; j < ps.length; j++) if (nsSp2SafeName(ps[j].getUsername()) === owner) pl = ps[j]
	if (!pl) {
		sp.away[owner] = (sp.away[owner] || 0) + 2
		if (sp.away[owner] >= p.grace) {
			nsRemoveMob(c)
			nsTellAll(Text.gray('[Ночная смена] Поединок ' + owner + ' засчитан: соперник ушёл со смены.'))
		}
		return
	}
	sp.away[owner] = 0
	try {
		if (!pl.isAlive()) return
		c.setTarget(pl)
		var dx = pl.getX() - c.getX(),
			dz = pl.getZ() - c.getZ()
		if (dx * dx + dz * dz > 40 * 40) {
			var a = Math.atan2(-dz, -dx)
			var tx = Math.round(pl.getX() + Math.cos(a) * 10),
				tz = Math.round(pl.getZ() + Math.sin(a) * 10)
			var ty = nsFindSpawnY(level, tx, tz, Math.floor(pl.getY()), true)
			if (ty !== null) c.teleportTo(tx + 0.5, ty, tz + 0.5)
		}
	} catch (e) {}
}

// Урон по чемпиону — только от «своего» игрока (сам или его снаряд). Тело — в try: исключение роняет сервер.
var NS_SP2_DAMAGE = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
NativeEvents.onEvent(NS_SP2_DAMAGE, function (event) {
	try {
		var v = event.getEntity()
		var tags = v.getTags()
		if (!tags.contains('ns_duel')) return
		var src = event.getSource()
		var t0 = nsSsDmgType(src)
		if (t0 === 'minecraft:generic_kill' || t0 === 'minecraft:out_of_world' || t0 === 'minecraft:outside_border') return
		var by = nsNfAttacker(src)
		if (nsSsRealPlayer(by) && tags.contains('ns_duel_' + nsSp2SafeName(by.getUsername()))) return
		event.setCanceled(true)
		if (nsSsRealPlayer(by)) {
			var name = String(by.getUsername())
			var now = Date.now()
			NSG.nsSsHintAt = NSG.nsSsHintAt || {}
			if (now - (NSG.nsSsHintAt[name] || 0) < 2500) return
			NSG.nsSsHintAt[name] = now
			NSG.nsServer.runCommandSilent('title ' + name + ' actionbar {"text":"Это чужой поединок — у тебя свой чемпион","color":"gold"}')
		}
	} catch (x) {}
})

// --------------------------------------------------------------------------
// «Удержание рубежей»
// --------------------------------------------------------------------------
var NS_SP2_PT_NAMES = ['А', 'Б', 'В']

// Три рубежа: на арене — в коридоре перед алтарём, у базы — по кругу в 9–13 блоках (120° друг от друга)
function nsSp2HoldPoints(level, altar) {
	var pts = []
	if (altar.dim === 'nightshift:arena') {
		var ax = [-6, 6, 0],
			az = [16, 26, 38]
		for (var i = 0; i < 3; i++) pts.push({ x: altar.x + ax[i], y: altar.y - 1, z: altar.z + az[i] })
		return pts
	}
	var a0 = Math.random() * Math.PI * 2
	for (var k = 0; k < 3; k++) {
		var got = null
		for (var t = 0; t < 12 && !got; t++) {
			var a = a0 + (k * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.6
			var r = 9 + Math.random() * 4
			var x = Math.round(altar.x + Math.cos(a) * r),
				z = Math.round(altar.z + Math.sin(a) * r)
			var y = nsFindSpawnY(level, x, z, altar.y, true)
			if (y !== null) got = { x: x, y: y, z: z }
		}
		pts.push(got || { x: altar.x + (k - 1) * 4, y: altar.y, z: altar.z + 4 })
	}
	return pts
}

function nsSp2Bar(prog) {
	var n = Math.round(prog / 20)
	var s = ''
	for (var i = 0; i < 5; i++) s += i < n ? '▮' : '▯'
	return s
}

function nsSp2Hold(state, level, altar, mobs, p) {
	var sp = state.raid.sp
	if (!sp || sp.key !== 'hold') sp = state.raid.sp = { key: 'hold', t: 0, pts: null }
	if (!sp.pts) {
		sp.pts = nsSp2HoldPoints(level, altar)
		for (var i = 0; i < sp.pts.length; i++) {
			var q = sp.pts[i]
			q.prog = 0
			q.lost = false
			NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run summon minecraft:armor_stand ' + (q.x + 0.5) + ' ' + q.y + ' ' + (q.z + 0.5) + ' {Tags:["ns_r' + state.raid.rid + '","ns_hold_pt","ns_hold_' + i + '"],Invisible:1b,Marker:1b,Invulnerable:1b,NoGravity:1b,PersistenceRequired:1b,CustomNameVisible:1b,CustomName:\'{"text":"Рубеж ' + NS_SP2_PT_NAMES[i] + '","color":"green"}\'}')
		}
		nsTitleAll('Удержание рубежей', { color: 'aqua', bold: true, subtitle: 'Орда идёт на три рубежа у алтаря — стойте на них', subColor: 'gray' })
		console.info('[nightshift] рубежи: ' + JSON.stringify(sp.pts))
		var lines = []
		for (var j = 0; j < sp.pts.length; j++) lines.push(NS_SP2_PT_NAMES[j] + ' (' + sp.pts[j].x + ', ' + sp.pts[j].y + ', ' + sp.pts[j].z + ')')
		nsTellAll(Text.aqua('[Ночная смена] Рубежи: ' + lines.join(', ') + '. Моб на рубеже без вас — рубеж падает; встаньте на него — отобьёте. Держать ' + Math.round(p.time / 60) + ' мин.'))
	}
	sp.t++
	var fighters = nsSp2Fighters(mobs)
	var ps = nsParticipants(altar)
	var lostN = 0
	for (var k = 0; k < sp.pts.length; k++) {
		var pt = sp.pts[k]
		var m = nsSp2Near(fighters, pt.x + 0.5, pt.y, pt.z + 0.5, p.r, 4)
		var h = nsSp2Near(ps, pt.x + 0.5, pt.y, pt.z + 0.5, p.pr, 4)
		if (m > 0 && h === 0) pt.prog = Math.min(100, pt.prog + 4 * Math.min(3, m))
		else if (h > 0 && m === 0) pt.prog = Math.max(0, pt.prog - 10)
		if (!pt.lost && pt.prog >= 100) {
			pt.lost = true
			console.info('[nightshift] рубеж ' + NS_SP2_PT_NAMES[k] + ' пал (' + pt.x + ' ' + pt.y + ' ' + pt.z + ')')
			nsTellAll(Text.red('[Ночная смена] Рубеж ' + NS_SP2_PT_NAMES[k] + ' пал! Встаньте на него — и отбейте.'))
			NSG.nsServer.runCommandSilent(nsSp2At(altar, pt.x, pt.y, pt.z) + 'playsound minecraft:entity.wither.break_block hostile @a ~ ~ ~ 2 0.8')
		} else if (pt.lost && pt.prog <= 0) {
			pt.lost = false
			nsTellAll(Text.green('[Ночная смена] Рубеж ' + NS_SP2_PT_NAMES[k] + ' отбит!'))
		}
		if (pt.lost) lostN++
		var col = pt.lost ? '1 0.1 0.1' : pt.prog > 0 ? '1 0.8 0.1' : '0.2 1 0.3'
		NSG.nsServer.runCommandSilent(nsSp2At(altar, pt.x + 0.5, pt.y + 0.2, pt.z + 0.5) + 'particle minecraft:dust{color:[' + col.split(' ').join('f,') + 'f],scale:1.5} ~ ~ ~ ' + p.r / 2 + ' 0.1 ' + p.r / 2 + ' 0 30 force')
		if (sp.t % 2 === 0) {
			var nm = '{"text":"Рубеж ' + NS_SP2_PT_NAMES[k] + ' ' + (pt.lost ? 'пал' : nsSp2Bar(100 - pt.prog)) + '","color":"' + (pt.lost ? 'red' : pt.prog > 0 ? 'yellow' : 'green') + '"}'
			NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run data modify entity @e[tag=ns_hold_' + k + ',tag=ns_r' + state.raid.rid + ',limit=1] CustomName set value \'' + nm + '\'')
		}
	}
	sp.lostN = lostN
	if (lostN >= sp.pts.length) {
		console.info('[nightshift] все рубежи пали — провал')
		nsTellAll(Text.darkRed('[Ночная смена] Все рубежи пали.'))
		return 'fail'
	}
	return sp.t >= p.time ? 'win' : null
}

// Куда идёт моб на «Удержании рубежей»: свой рубеж (по номеру сущности), а если он уже пал — следующий непавший
function nsSpecialNavTarget(state, mob, altar) {
	var sp = state.raid.sp
	if (!sp || sp.key !== 'hold' || !sp.pts || nsHasTag(mob, 'ns_unit')) return null
	var i0 = Math.abs(Number(mob.getId())) % sp.pts.length
	for (var k = 0; k < sp.pts.length; k++) {
		var pt = sp.pts[(i0 + k) % sp.pts.length]
		if (!pt.lost) return { x: pt.x, y: pt.y, z: pt.z, dim: altar.dim, id: altar.id }
	}
	return null
}

// --------------------------------------------------------------------------
// Вожаки и чемпионы (тег ns_unit): своя навигация. true — обычную не делать.
// --------------------------------------------------------------------------
function nsUnitNav(mob, altar, level) {
	if (nsHasTag(mob, 'ns_duel')) return true // ведёт nsSp2DuelFollow
	if (!nsHasTag(mob, 'ns_leader') || nsHasTag(mob, 'ns_rush')) return false
	try {
		var pd = mob.persistentData
		if (!pd.contains('ns_ax')) {
			pd.putDouble('ns_ax', mob.getX())
			pd.putDouble('ns_ay', mob.getY())
			pd.putDouble('ns_az', mob.getZ())
		}
		var ax = pd.getDouble('ns_ax'),
			ay = pd.getDouble('ns_ay'),
			az = pd.getDouble('ns_az')
		var dx = mob.getX() - ax,
			dz = mob.getZ() - az
		var far = dx * dx + dz * dz
		// вожак не уходит от своего места дальше 16 блоков: дерётся с теми, кто пришёл, и возвращается
		if (far > 16 * 16) {
			try {
				mob.setTarget(null)
			} catch (e) {}
			mob.getNavigation().moveTo(ax, ay, az, 1.1)
		} else if (far > 9 && mob.getTarget() == null) mob.getNavigation().moveTo(ax, ay, az, 1.0)
	} catch (e) {}
	return true
}

// --------------------------------------------------------------------------
// «Гидра»: деление при гибели
// --------------------------------------------------------------------------
EntityEvents.death(event => {
	try {
		var e = event.entity
		var tg = e.getTags()
		if (!tg.contains('ns_split') || tg.contains('ns_split_child')) return
		var st = nsGetStateRO()
		if (!st || !st.raid || st.raid.state !== 'active' || st.raid.bossSpawned || !tg.contains('ns_r' + st.raid.rid)) return
		var id = String(e.getType())
		if (NS_MINION_TYPES[id] || NS_FLYERS[id] || (NSG.NS_MOD_FLYERS && NSG.NS_MOD_FLYERS[id]) || tg.contains('ns_kamikaze') || tg.contains('ns_unit')) return
		if ((NSG.nsRaidAlive || 0) >= nsSp2Params('split', st.raid.difficulty || 1).maxAlive) return // NSG.nsRaidAlive — 40_, раз в секунду
		var p = nsSp2Params('split', st.raid.difficulty || 1)
		var hp = Math.max(4, Math.round(e.getMaxHealth() * p.share))
		var dim = String(e.getLevel().getDimension())
		for (var i = 0; i < 2; i++) {
			var x = (e.getX() + (i ? 0.6 : -0.6)).toFixed(1),
				y = e.getY().toFixed(1),
				z = e.getZ().toFixed(1)
			NSG.nsServer.runCommandSilent(
				'execute in ' + dim + ' run summon ' + id + ' ' + x + ' ' + y + ' ' + z +
					' {Tags:["nightshift_raid","ns_r' + st.raid.rid + '","ns_boosted","ns_split_child"],PersistenceRequired:1b,' +
					'attributes:[{id:"minecraft:generic.max_health",base:' + hp + '.0d},{id:"minecraft:generic.scale",base:0.75d},{id:"minecraft:generic.follow_range",base:64.0d}],Health:' + hp + '.0f,' +
					'active_effects:[{id:"minecraft:resistance",amplifier:0b,duration:-1,show_particles:0b}]}'
			)
		}
		NSG.nsServer.runCommandSilent('execute in ' + dim + ' positioned ' + e.getX().toFixed(1) + ' ' + e.getY().toFixed(1) + ' ' + e.getZ().toFixed(1) + ' run particle minecraft:item_slime ~ ~1 ~ 0.4 0.4 0.4 0.1 20')
	} catch (x) {}
})

// Гибель вожака и чемпиона — объявление
EntityEvents.death(event => {
	try {
		var e = event.entity
		var tg = e.getTags()
		var leader = tg.contains('ns_leader'),
			duel = tg.contains('ns_duel')
		if (!leader && !duel) return
		var st = nsGetStateRO()
		if (!st || !st.raid || st.raid.state !== 'active' || !tg.contains('ns_r' + st.raid.rid)) return
		if (leader) nsTellAll(Text.gold('[Ночная смена] Вожак повержен! ').append(Text.gray('Осталось: ' + Math.max(0, ((st.raid.sp && st.raid.sp.alive) || 1) - 1) + '.')))
		if (duel) {
			var who = String(e.getName().getString()).replace('Чемпион — ', '')
			nsTellAll(Text.gold('[Ночная смена] ' + who + ' выиграл поединок!'))
			NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete player @a')
		}
	} catch (x) {}
})

// Строка для полосы волны
function nsSpecialBarText(state) {
	var sp = state.raid && state.raid.sp
	var d = (state.raid && state.raid.difficulty) || 1
	var S = NSG.NS_SPECIAL_STAGES ? NSG.NS_SPECIAL_STAGES[d] : null
	if (!S) return ''
	if (S.kind === 'split') return 'Гидра'
	if (!sp) return S.name
	if (sp.key === 'ritual') return 'Ритуал ' + Math.floor(sp.charge) + ' %' + (sp.st === 'empty' ? ' (круг пуст)' : sp.st === 'blocked' ? ' (мобы у алтаря)' : '')
	if (sp.key === 'leaders') return 'Вожаков: ' + (sp.alive === undefined ? sp.n : sp.alive) + ' из ' + sp.n
	if (sp.key === 'duel') return 'Поединков: ' + (sp.n - (sp.alive === undefined ? sp.n : sp.alive)) + ' из ' + sp.n + ' выиграно' + (state.raid.wavesDone ? ', орда отбита' : '')
	if (sp.key === 'hold') return 'Рубежи: ' + ((sp.pts ? sp.pts.length : 3) - (sp.lostN || 0)) + ' из 3 · ' + nsSsClock(nsSp2Params('hold', d).time - sp.t)
	return S.name
}

// Уборка: маркеры рубежей, вожаки, чемпионы этого набега (discard — не в счёт контрактов)
function nsSpecialCleanup(state, level) {
	if (!state || !state.raid || !state.raid.rid) return
	var tags = ['ns_hold_pt', 'ns_leader', 'ns_duel']
	for (var i = 0; i < tags.length; i++) {
		var list = nsSsFind(level, state, tags[i])
		for (var k = 0; k < list.length; k++) nsRemoveMob(list[k])
	}
}

// Трофеи новых боссов-вариантов (08_modded_waves.js, alt) — из уже существующих трофеев (09_ns_artifacts.js)
try {
	if (typeof NS_ART !== 'undefined' && NS_ART.trophies) {
		var NS_SP2_TROPHIES = {
			'irons_spellbooks:dead_king': ['nightshift:art_tr_maledictus', 'Мёртвый король'],
			'irons_spellbooks:fire_boss': ['nightshift:art_tr_ignis', 'Эхо Тироса'],
			'irons_spellbooks:citadel_keeper': ['nightshift:art_tr_gladiator', 'Магистр цитадели'],
		}
		for (var nsTk in NS_SP2_TROPHIES) {
			if (NS_ART.trophies[nsTk]) continue
			NS_ART.trophies[nsTk] = NS_SP2_TROPHIES[nsTk][0]
			NS_ART.bossNames[nsTk] = NS_SP2_TROPHIES[nsTk][1]
		}
	}
} catch (e) {
	console.warn('[nightshift] трофеи новых боссов: ' + e)
}
