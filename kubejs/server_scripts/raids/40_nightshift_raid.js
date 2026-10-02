// ==========================================================================
// Ночная смена — набеги: выбранной сложности (с провалом и добычей) и малые
// (каждые 5 ночей). Волны, навигация мобов к алтарю, "грызение" стен, победа/провал.
// ==========================================================================
//
// ВАЖНО ПРО RHINO (KubeJS 2101): только var. const/let внутри циклов молча
// оставляют значение первой итерации, а внутри try{} при повторном вызове
// падают с «redeclaration of var». Проверено на тестовом сервере 26.09.
//
// СПАВН: ванильная команда /summon через server.runCommandSilent() с NBT Tags
// и PersistenceRequired — работает для любых мобов, в т.ч. модовых.
//
// УЧЁТ МОБОВ: мобы набега ищутся раз в секунду по тегу nightshift_raid в
// коробке вокруг алтаря (level.getEntitiesWithin(AABB) — поиск по секциям
// сущностей, а не перебор мира). Список в памяти не нужен, поэтому учёт
// переживает /reload и рестарт сервера посреди набега.
//
// ПАУЗА: набег идёт, только пока рядом с алтарём есть игрок (raidPlayerRadius).
// Иначе чанки кольца спавна могут быть не загружены — призыв молча не
// сработает, и набег «выиграется» сам. Орда ждёт игроков у алтаря.
// ==========================================================================

var NS_AABB = Java.loadClass('net.minecraft.world.phys.AABB')

function nsFindAltar(state, altarId) {
	for (var i = 0; i < state.altars.length; i++) {
		if (state.altars[i].id === altarId) return state.altars[i]
	}
	return null
}

// Конец набега: снова можно спать
function nsRaidEnded() {
	NSG.nsServer.runCommandSilent('gamerule playersSleepingPercentage 100')
}

// Самолечение сна (29.09: «спать не можем», а набег idle и алтарей нет): 101 % ставит только набег.
// Если набега нет, а правило осталось выше 100 (набег оборвался мимо nsRaidEnded) — возвращаем 100.
var NS_GAMERULES = Java.loadClass('net.minecraft.world.level.GameRules')
function nsHealSleepRule(server) {
	try {
		if (server.getGameRules().getInt(NS_GAMERULES.RULE_PLAYERS_SLEEPING_PERCENTAGE) > 100) nsRaidEnded()
	} catch (e) {
		console.warn('[nightshift] проверка правила сна: ' + e)
	}
}

// Сброс набега (алтарь пропал, нет конфига орды, /nightshift stop): мобы набега уходят вместе с ним
function nsResetRaidIdle(state) {
	var arenaAltar = state.raid.altarId
	state.raid = nsDefaultState().raid
	nsReturnAll(state)
	nsSaveState(state)
	nsRaidEnded()
	NSG.nsServer.runCommandSilent('kill @e[tag=nightshift_raid]')
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	if (typeof nsArenaHook === 'function') nsArenaHook('end', arenaAltar) // арена — восстановить (70_nightshift_arena.js)
}

function nsHasRaidTag(entity) {
	try {
		return entity.getTags().contains('nightshift_raid')
	} catch (e) {
		return false
	}
}

function nsRemoveMob(mob) {
	try {
		mob.discard() // без дропа и анимации смерти
	} catch (e) {
		try {
			mob.kill()
		} catch (e2) {
			console.warn('[nightshift] Не удалось убрать моба набега: ' + e2)
		}
	}
}

// Русское склонение слова "ночь" для сообщений обратного отсчёта.
function nsNightsWord(n) {
	var mod10 = n % 10,
		mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return 'ночь'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ночи'
	return 'ночей'
}

function nsAltarLevel(altar) {
	try {
		var lvl = NSG.nsServer.getLevel(altar.dim)
		if (lvl) return lvl
	} catch (e) {}
	return NSG.nsServer.getOverworld()
}

// Есть ли игрок (не наблюдатель) рядом с алтарём.
function nsPlayersNearAltar(level, altar) {
	var r = NSG.NIGHTSHIFT_TUNABLES.raidPlayerRadius
	var players = level.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		try {
			if (p.isSpectator()) continue
		} catch (e) {}
		var dx = p.getX() - altar.x,
			dz = p.getZ() - altar.z
		if (dx * dx + dz * dz <= r * r) return true
	}
	return false
}

// Живые мобы набега вокруг алтаря. null — если поиск не удался.
function nsCollectRaidMobs(level, altar, radius) {
	var R = radius || NSG.NIGHTSHIFT_TUNABLES.raidTrackRadius
	var st = nsGetState()
	var rid = st && st.raid && st.raid.rid ? 'ns_r' + st.raid.rid : null // набег без номера (старый) — как раньше
	var list
	try {
		list = level.getEntitiesWithin(new NS_AABB(altar.x - R, altar.y - 64, altar.z - R, altar.x + R + 1, altar.y + 64, altar.z + R + 1))
	} catch (e) {
		if (!NSG.nsTrackWarned) {
			console.error('[nightshift] Поиск мобов набега не работает: ' + e)
			NSG.nsTrackWarned = true
		}
		return null
	}
	var out = []
	for (var i = 0; i < list.size(); i++) {
		var ent = list.get(i)
		var alive = false
		try {
			alive = ent.isAlive()
		} catch (e) {}
		if (!alive || !nsHasRaidTag(ent)) continue
		if (rid && !nsHasTag(ent, rid)) {
			// пассажир нашего моба (всадник Кошмара) — свой, хоть номер в его NBT и не вписан
			var veh = null
			try {
				veh = ent.getVehicle()
			} catch (e) {}
			if (!(veh && nsHasTag(veh, rid))) {
				nsRemoveMob(ent) // моб прошлого набега — не наш
				continue
			}
		}
		out.push(ent)
	}
	return out
}

// Живые мобы этого набега за пределами поиска (улетел, телепортировался, унесло) — назад к орде.
// Возвращает, сколько вернули. Ищем по всему измерению, но только когда рядом с алтарём никого не осталось.
function nsRecallStragglers(level, altar, state) {
	if (!state.raid.rid) return 0
	var rid = 'ns_r' + state.raid.rid
	var T = NSG.NIGHTSHIFT_TUNABLES
	var pts = altar.spawns || []
	var n = 0
	var it
	try {
		it = level.getAllEntities().iterator()
	} catch (e) {
		return 0
	}
	while (it.hasNext()) {
		var ent = it.next()
		try {
			if (!ent.isAlive() || !nsHasTag(ent, rid) || ent.getVehicle()) continue
			var x, y, z
			if (pts.length > 0) {
				var p = pts[n % pts.length]
				x = p.x
				y = p.y
				z = p.z
			} else {
				var a = Math.random() * Math.PI * 2
				x = Math.round(altar.x + Math.cos(a) * T.raidRingMinDist)
				z = Math.round(altar.z + Math.sin(a) * T.raidRingMinDist)
				y = nsFindSpawnY(level, x, z, altar.y)
				if (y === null) y = altar.y + 1
			}
			ent.teleportTo(x + 0.5, y, z + 0.5)
			n++
		} catch (e) {}
	}
	if (n > 0) console.info('[nightshift] вернул к орде отбившихся мобов набега: ' + n)
	return n
}

function nsHasTag(entity, tag) {
	try {
		return entity.getTags().contains(tag)
	} catch (e) {
		return false
	}
}

// --------------------------------------------------------------------------
// Точка спавна: сначала ищем место на высоте алтаря (±16) — так орда
// приходит и к базе в пещере; не нашли — поверхность.
// --------------------------------------------------------------------------
function nsIsSolid(level, x, y, z) {
	try {
		var st = level.getBlock(x, y, z).getBlockState()
		return !st.isAir() && st.getFluidState().isEmpty()
	} catch (e) {
		return false
	}
}

function nsIsAir(level, x, y, z) {
	try {
		return level.getBlock(x, y, z).getBlockState().isAir()
	} catch (e) {
		return false
	}
}

function nsFindSpawnY(level, x, z, altarY) {
	for (var d = 0; d <= 16; d++) {
		var ys = d === 0 ? [altarY] : [altarY + d, altarY - d]
		for (var k = 0; k < ys.length; k++) {
			var y = ys[k]
			if (nsIsAir(level, x, y, z) && nsIsAir(level, x, y + 1, z) && nsIsSolid(level, x, y - 1, z)) return y
		}
	}
	// запасной путь — верх колонки, но не вода и не лава (иначе орда тонет)
	for (var y2 = 319; y2 > -64; y2--) {
		if (!nsIsAir(level, x, y2, z)) return nsIsSolid(level, x, y2, z) ? y2 + 1 : null
	}
	return null
}

// Спавн count мобов mobId кольцом raidRingMinDist..raidRingMaxDist от алтаря, вне зон базы.
// Возвращает наибольшее расстояние спавна — по нему растёт радиус поиска мобов набега.
function nsSpawnMobRing(level, altar, mobId, count, state, extraNbt, extraTags) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var farthest = 0
	var pts = altar.spawns || []
	for (var i = 0; i < count; i++) {
		var x = 0,
			z = 0,
			y = null
		if (pts.length > 0) {
			// точки спавна, которые поставили игроки: случайная точка, разброс ±2 блока
			var p = pts[Math.floor(Math.random() * pts.length)]
			for (var t = 0; t < 8 && y === null; t++) {
				x = p.x + Math.floor(Math.random() * 5) - 2
				z = p.z + Math.floor(Math.random() * 5) - 2
				y = nsFindSpawnY(level, x, z, p.y)
			}
			if (y === null) {
				x = p.x
				z = p.z
				y = p.y
			}
		} else {
			// кольцо расширяется с каждой попыткой: у большой базы орда встаёт сразу за периметром
			for (var attempt = 0; attempt < 40; attempt++) {
				var angle = Math.random() * Math.PI * 2
				var dist = T.raidRingMinDist + Math.random() * (T.raidRingMaxDist - T.raidRingMinDist) + attempt * 8
				x = Math.round(altar.x + Math.cos(angle) * dist)
				z = Math.round(altar.z + Math.sin(angle) * dist)
				if (nsPointInAnyZone(state, altar.dim, x, altar.y, z)) continue
				y = nsFindSpawnY(level, x, z, altar.y)
				if (y !== null) break
			}
		}
		if (y === null) continue
		farthest = Math.max(farthest, Math.sqrt((x - altar.x) * (x - altar.x) + (z - altar.z) * (z - altar.z)))
		var rtag = state && state.raid && state.raid.rid ? ',"ns_r' + state.raid.rid + '"' : ''
		for (var et = 0; extraTags && et < extraTags.length; et++) rtag += ',"' + extraTags[et] + '"'
		var nbt = '{Tags:["nightshift_raid"' + rtag + '],PersistenceRequired:1b' + (extraNbt ? ',' + extraNbt : '') + nsFlyerAnchorNbt(mobId, altar) + '}'
		NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run summon ' + mobId + ' ' + x + ' ' + y + ' ' + z + ' ' + nbt)
	}
	return farthest
}

// Воздушные мобы летят не по пути к алтарю, а вокруг своей точки: у фантома — AX/AY/AZ, у вредины — BoundX/Y/Z.
// /summon с NBT не вызывает finalizeSpawn, и точка остаётся 0,0,0: фантомы кружили у начала мира, в арене —
// упирались в пол у спавна (30.09, Георгий: «фантомы застревают на спавне»). Ставим точку над алтарём:
// фантомы кружат выше (12–21 блок) и пикируют на защитников, вредины висят над алтарём (3–13 блоков).
var NS_FLYERS = { 'minecraft:phantom': 16, 'minecraft:vex': 8 }
function nsFlyerAnchorNbt(mobId, altar) {
	var up = NS_FLYERS[mobId]
	if (!up) return ''
	var y = altar.y + up
	if (mobId === 'minecraft:phantom') return ',AX:' + altar.x + ',AY:' + y + ',AZ:' + altar.z
	return ',BoundX:' + altar.x + ',BoundY:' + y + ',BoundZ:' + altar.z
}

function nsTrackRadius(state) {
	return state.raid.trackR || NSG.NIGHTSHIFT_TUNABLES.raidTrackRadius
}

function nsGrowTrackRadius(state, farthest) {
	state.raid.trackR = Math.max(nsTrackRadius(state), Math.ceil(farthest) + 48)
}

// --------------------------------------------------------------------------
// Навигация моба к алтарю + "грызение" препятствий раз в navTickInterval тиков.
// --------------------------------------------------------------------------
function nsTickMobNavigation(mob, altar, level) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var type = String(mob.getType())
	if (NS_FLYERS[type]) return // летают сами вокруг точки над алтарём (nsFlyerAnchorNbt)
	var kami = nsHasTag(mob, 'ns_kamikaze')
	// подрывник рядом с игроком — взрыв сразу
	if (kami && nsKamikazeNearPlayer(mob, level)) {
		nsKamikazeBlast(mob, level, altar)
		return
	}

	// моб, занятый игроком/турелью, дерётся сам; остальных ведём к алтарю
	var hasTarget = false
	try {
		hasTarget = mob.getTarget() != null
	} catch (e) {}
	var pdn
	try {
		pdn = mob.persistentData
	} catch (e) {}
	// сдвиг счётчика случайный: мобы одной порции пересчитывают путь в разные секунды, а не все разом
	var navTick = pdn ? (pdn.contains('ns_nav') ? pdn.getInt('ns_nav') : Math.floor(Math.random() * 5)) + 1 : 0
	if (pdn) pdn.putInt('ns_nav', navTick)
	var nav = null
	try {
		nav = mob.getNavigation()
	} catch (e) {}
	// путь пересчитываем, когда прежний кончился, и раз в 5 с — поиск на 64 блока не бесплатный
	if (!hasTarget && nav && (nav.isDone() || navTick % 5 === 1)) {
		try {
			nav.moveTo(altar.x + 0.5, altar.y, altar.z + 0.5, kami ? NSG.NS_KAMIKAZE.navSpeed : 1.0)
		} catch (e) {
			if (!NSG.nsNavWarned) {
				console.warn('[nightshift] mob.getNavigation().moveTo(...) недоступен: ' + e)
				NSG.nsNavWarned = true
			}
		}
	}

	if (NSG.NS_MOD_FLYERS && NSG.NS_MOD_FLYERS[type]) return // летуны модов: путь к алтарю есть, стены и крыши не грызут

	var pd
	try {
		pd = mob.persistentData
	} catch (e) {
		return
	}

	// Застрял = за stuckTicksToChew не подошёл к алтарю ближе, чем был, хотя бы на блок. Раньше мерили смещение:
	// толпа у стены толкается и лезет друг на друга — смещение есть, а стену никто не грыз (30.09, Георгий).
	var ax = altar.x + 0.5 - mob.getX(),
		ay = altar.y - mob.getY(),
		az = altar.z + 0.5 - mob.getZ()
	var dist = Math.sqrt(ax * ax + ay * ay + az * az)
	var best = pd.contains('ns_best') ? pd.getDouble('ns_best') : 1e9
	if (dist < best - 1) {
		pd.putDouble('ns_best', dist)
		pd.putInt('ns_stuck', 0)
		return
	}
	var stuckTicks = (pd.contains('ns_stuck') ? pd.getInt('ns_stuck') : 0) + T.navTickInterval
	pd.putInt('ns_stuck', stuckTicks)
	// подрывник упёрся в стену (секунду не продвигается, впереди блок) — взрыв
	if (kami && stuckTicks >= T.navTickInterval && nsKamikazeWallAhead(mob, altar, level)) {
		nsKamikazeBlast(mob, level, altar)
		return
	}
	if (stuckTicks >= T.stuckTicksToChew) nsChewTowardAltar(mob, altar, pd, level)
}

// --------------------------------------------------------------------------
// Подрывник (08_modded_waves.js, тег ns_kamikaze; Георгий, 01.10: «камикадзе — быстрые, легко убить, бегут и
// взрывают стены»). Взрыв — сами: урон и отброс игрокам — ванильным взрывом без разрушения блоков (мобы набега
// от него не страдают — 07_raid_no_infighting.js), а дыру выбиваем руками по правилам грызения: блоки с
// блок-сущностью (машины, сундуки), моды обороны и всё с взрывоустойчивостью ≥ maxResistance (обсидиан, плачущий
// обсидиан, незерит) не трогаем; на арене стены, пол и крыша не ломаются (nsIsBlockProtected).
// --------------------------------------------------------------------------
NSG.NS_KAMIKAZE = { power: 2.2, powerHeavy: 3.2, radius: 2.0, radiusHeavy: 3.2, maxResistance: 100, dropChance: 0.3, nearPlayer: 3, navSpeed: 1.2 }
var NS_EXPLOSION_NONE = null
try {
	NS_EXPLOSION_NONE = Java.loadClass('net.minecraft.world.level.Level$ExplosionInteraction').NONE
} catch (e) {
	console.warn('[nightshift] Level.ExplosionInteraction недоступен: ' + e)
}

function nsKamikazeNearPlayer(mob, level) {
	var r = NSG.NS_KAMIKAZE.nearPlayer
	try {
		var players = level.getPlayers()
		for (var i = 0; i < players.length; i++) {
			var p = players[i]
			if (p.isSpectator() || p.isCreative()) continue
			var dx = p.getX() - mob.getX(),
				dy = p.getY() - mob.getY(),
				dz = p.getZ() - mob.getZ()
			if (dx * dx + dy * dy + dz * dz <= r * r) return true
		}
	} catch (e) {}
	return false
}

function nsKamikazeWallAhead(mob, altar, level) {
	var c = nsChewCandidates(mob, altar)
	for (var i = 0; i < c.length; i++) {
		try {
			var st = level.getBlock(c[i][0], c[i][1], c[i][2]).getBlockState()
			if (!st.isAir() && st.getFluidState().isEmpty()) return true
		} catch (e) {}
	}
	return false
}

function nsKamikazeBlast(mob, level, altar) {
	var K = NSG.NS_KAMIKAZE
	var heavy = nsHasTag(mob, 'ns_kamikaze_heavy')
	var x = mob.getX(),
		y = mob.getY(),
		z = mob.getZ()
	try {
		level.explode(mob, x, y + 0.5, z, heavy ? K.powerHeavy : K.power, NS_EXPLOSION_NONE)
	} catch (e) {
		if (!NSG.nsKamiWarned) {
			console.warn('[nightshift] взрыв подрывника через level.explode не сработал, запасной путь: ' + e)
			NSG.nsKamiWarned = true
		}
		var at = 'execute in ' + altar.dim + ' positioned ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1) + ' run '
		NSG.nsServer.runCommandSilent(at + 'particle minecraft:explosion_emitter ~ ~1 ~')
		NSG.nsServer.runCommandSilent(at + 'playsound minecraft:entity.generic.explode hostile @a ~ ~ ~ 2')
		NSG.nsServer.runCommandSilent(at + 'damage @a[distance=..' + (heavy ? 5 : 3.5) + ',gamemode=!creative,gamemode=!spectator] ' + (heavy ? 14 : 8) + ' minecraft:explosion')
	}
	nsRemoveMob(mob)
	// дыра: центр — на блок ближе к алтарю, на уровне груди; край рваный
	var dx = altar.x + 0.5 - x,
		dz = altar.z + 0.5 - z
	var len = Math.sqrt(dx * dx + dz * dz) || 1
	var cx = x + dx / len,
		cy = y + 1,
		cz = z + dz / len
	var r = heavy ? K.radiusHeavy : K.radius
	var R = Math.ceil(r)
	var broken = 0
	for (var ix = -R; ix <= R; ix++) {
		for (var iy = -R; iy <= R; iy++) {
			for (var iz = -R; iz <= R; iz++) {
				var dist = Math.sqrt(ix * ix + iy * iy + iz * iz)
				if (dist > r) continue
				if (dist > r - 0.7 && Math.random() < 0.5) continue
				try {
					var b = level.getBlock(Math.floor(cx) + ix, Math.floor(cy) + iy, Math.floor(cz) + iz)
					var st = b.getBlockState()
					if (st.isAir() || !st.getFluidState().isEmpty()) continue
					if (nsIsBlockProtected(b)) continue
					if (st.getDestroySpeed(level, b.getPos()) < 0) continue
					if (st.getBlock().getExplosionResistance() >= K.maxResistance) continue
					level.destroyBlock(b.getPos(), Math.random() < K.dropChance)
					broken++
				} catch (e) {}
			}
		}
	}
	if (broken > 0 && NSG.nsKamiLog !== true) {
		console.info('[nightshift] подрывник выбил блоков: ' + broken + ' (дальше в лог не пишу)')
		NSG.nsKamiLog = true
	}
}

// Блоки, которые моб грызёт, чтобы пройти к алтарю: стена на уровне ног и
// головы (моб ростом в 2 блока), либо пол/потолок, если алтарь ниже/выше.
function nsChewCandidates(mob, altar) {
	var mx = Math.floor(mob.getX()),
		my = Math.floor(mob.getY()),
		mz = Math.floor(mob.getZ())
	var dx = altar.x + 0.5 - mob.getX(),
		dy = altar.y - my,
		dz = altar.z + 0.5 - mob.getZ()
	var horiz = Math.max(Math.abs(dx), Math.abs(dz))
	if (horiz < 2.5 && Math.abs(dy) >= 2) {
		return dy < 0 ? [[mx, my - 1, mz]] : [[mx, my + 2, mz]]
	}
	var sx = 0,
		sz = 0
	if (Math.abs(dx) > Math.abs(dz)) sx = dx > 0 ? 1 : -1
	else sz = dz > 0 ? 1 : -1
	var out = [
		[mx + sx, my, mz + sz],
		[mx + sx, my + 1, mz + sz],
	]
	// великан Кошмара (выше 2 блоков) в двухблочный проход не влезает — грызёт и третий
	var tall = 0
	try {
		tall = mob.getBbHeight()
	} catch (e) {}
	if (tall > 2) out.push([mx + sx, my + 2, mz + sz])
	if (dy >= 2) out.push([mx, my + 2, mz])
	return out
}

// Не трогает блоки с блок-сущностью и блоки защищённых модов (nsIsBlockProtected).
// Время грызения пропорционально прочности блока.
function nsChewTowardAltar(mob, altar, pd, level) {
	var cands = nsChewCandidates(mob, altar)
	var target = null
	for (var i = 0; i < cands.length; i++) {
		var b
		try {
			b = level.getBlock(cands[i][0], cands[i][1], cands[i][2])
			if (b.getBlockState().isAir()) continue
		} catch (e) {
			continue
		}
		if (!b.getBlockState().getFluidState().isEmpty()) continue
		if (nsIsBlockProtected(b)) return // механизмы и сундуки не грызём — ищет обход
		target = b
		break
	}
	if (!target) {
		pd.putInt('ns_chew', 0)
		return
	}

	var needed = nsChewTicksForBlock(target)
	if (needed < 0) return // неразрушаемый блок

	var key = target.getX() + '_' + target.getY() + '_' + target.getZ()
	var curKey = pd.contains('ns_chew_pos') ? pd.getString('ns_chew_pos') : ''
	var progress = NSG.NIGHTSHIFT_TUNABLES.navTickInterval
	if (String(curKey) === key) progress += pd.contains('ns_chew') ? pd.getInt('ns_chew') : 0
	else pd.putString('ns_chew_pos', key)
	pd.putInt('ns_chew', progress)

	if (progress >= needed) {
		try {
			level.destroyBlock(target.getPos(), true) // с дропом и звуком
		} catch (e) {
			try {
				target.set('minecraft:air')
			} catch (e2) {
				console.warn('[nightshift] Не удалось снести блок на пути орды: ' + e2)
			}
		}
		pd.putInt('ns_chew', 0)
		pd.putString('ns_chew_pos', '')
	}
}

// --------------------------------------------------------------------------
// Запуск набега.
// --------------------------------------------------------------------------
// Обычные (не набеговые) монстры у алтаря мешают набегу — на старте убираем
var NS_RAID_MONSTER_CLASS = Java.loadClass('net.minecraft.world.entity.monster.Monster')
function nsClearNaturalMonsters(altar, r) {
	if (!altar) return
	try {
		var level = nsAltarLevel(altar)
		var list = level.getEntitiesOfClass(NS_RAID_MONSTER_CLASS, new NS_AABB(altar.x - r, altar.y - 32, altar.z - r, altar.x + r, altar.y + 32, altar.z + r))
		var n = 0
		for (var i = 0; i < list.size(); i++) {
			var m = list.get(i)
			if (nsHasRaidTag(m) || m.hasCustomName()) continue
			m.discard()
			n++
		}
		if (n > 0) console.info('[nightshift] у алтаря убрано обычных монстров: ' + n)
	} catch (e) {
		console.warn('[nightshift] чистка монстров у алтаря: ' + e)
	}
}

// Отсчёт до выхода орды: запущенный у алтаря набег — короткий, малый (приходит сам) — минута
function nsCountdownFor(kind) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	return kind === 'minor' ? T.raidCountdownSeconds : T.challengeCountdownSeconds || T.raidCountdownSeconds
}

function nsStartRaid(kind, altarId, difficulty) {
	var state = nsGetState()
	if (nsRaidActive(state)) return
	var d = kind === 'minor' ? 0 : difficulty || 1
	NSG.nsRaidKills = {} // счёт бойцов этого набега (14_contracts.js)
	// мобы прошлых набегов с тегом nightshift_raid (недобитые, из выгруженных чанков, с тестов) засчитывались
	// новому набегу: 30.09 на 15-й волне у алтаря сразу оказался старый зомби — провал за 12 с. Теперь у каждого
	// набега свой номер (тег ns_r<номер> на его мобах), а старых при старте убираем.
	NSG.nsServer.runCommandSilent('kill @e[tag=nightshift_raid]')

	state.raid = {
		rid: String(Math.floor(Math.random() * 1e9)),
		state: 'countdown',
		kind: kind, // challenge — выбранная сложность; minor — малый набег раз в 5 ночей
		difficulty: d,
		altarId: altarId,
		startedAtTick: 0,
		waveIndex: -1,
		waveStartedAtTick: 0,
		bossSpawned: false,
		countdownRemaining: nsCountdownFor(kind),
		waveSize: 0,
		spawnRetries: 0,
		paused: false,
	}
	// условия смены — на весь набег такими, какими были на старте (малый набег — без условий)
	if (kind !== 'minor' && state.mutators) {
		var mut = {}
		for (var mk in state.mutators) if (state.mutators[mk]) mut[mk] = true
		state.raid.mut = mut
	}
	nsSaveState(state)

	// Ночь и гроза. Время только вперёд до ближайшей ночи (не откатываем дни —
	// на счётчике дней держатся малые набеги и фазы луны).
	var level = NSG.nsServer.getOverworld()
	var tod = Number(level.getDayTime()) % 24000
	if (tod < 13000) NSG.nsServer.runCommandSilent('time add ' + (13000 - tod))
	NSG.nsServer.runCommandSilent('weather thunder 6000')
	// на время набега ночь не проспать: утро и солнце сожгли бы орду
	NSG.nsServer.runCommandSilent('gamerule playersSleepingPercentage 101')

	var name = kind === 'minor' ? 'Малый набег · ' + nsDifficultyName(nsMinorWave(state.phase)) : 'Набег: ' + nsDifficultyName(d)
	if (kind === 'minor') nsTitleAll('Мир неспокоен…', { color: 'yellow', subtitle: 'К базе идут гости: ' + nsDifficultyName(nsMinorWave(state.phase)), subColor: 'gray' })
	else {
		nsTitleAll(nsDifficultyName(d), {
			color: 'dark_red',
			bold: true,
			subtitle: 'Орда придёт через ' + nsCountdownFor(kind) + ' секунд',
			subColor: 'gray',
		})
		NSG.nsServer.runCommandSilent('playsound minecraft:entity.wither.spawn ambient @a')
	}

	// арена: тема по номеру волны (снег, пекло, Край…) — перестройка за отсчёт (70_nightshift_arena.js)
	if (kind !== 'minor' && typeof nsArenaOnRaidStart === 'function') {
		nsTry('тема арены', function () {
			nsArenaOnRaidStart(altarId, d)
		})
	}
	if (state.raid.mut && typeof nsMutNames === 'function') {
		var mn = nsMutNames(state.raid.mut)
		if (mn.length) nsTellAll(Text.red('[Ночная смена] Условия смены: ' + mn.join(', ')).append(Text.gold(' — добыча +' + Math.round(nsMutBonus(state.raid.mut) * 100) + ' %')))
	}
	nsInviteToAltar(nsFindAltar(state, altarId), kind)
	nsClearNaturalMonsters(nsFindAltar(state, altarId), 48)
	nsBossbarCreate('nightshift:raid_countdown', name, kind === 'minor' ? 'yellow' : 'red')
	nsBossbarMax('nightshift:raid_countdown', nsCountdownFor(kind))
	nsBossbarValue('nightshift:raid_countdown', nsCountdownFor(kind))
}

// {waves, boss, buff, mult} текущего набега: выбранная сложность или малый набег по силам команды
function nsTellAll(component) {
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) players[i].tell(component)
}

// Тем, кто далеко от алтаря (другое измерение или дальше raidPlayerRadius), — кнопка телепорта
function nsInviteToAltar(altar, kind) {
	if (!altar) return
	var r = NSG.NIGHTSHIFT_TUNABLES.raidPlayerRadius
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		var far = String(p.getLevel().getDimension()) !== altar.dim
		if (!far) {
			var dx = p.getX() - altar.x,
				dz = p.getZ() - altar.z
			far = dx * dx + dz * dz > r * r
		}
		if (!far) continue
		p.tell(
			Text.gold(kind !== 'minor' ? '[Ночная смена] Набег на алтарь! ' : '[Ночная смена] К базе идут гости! ')
				.append(Text.green('[Телепорт к алтарю]').clickRunCommand('/nightshift altar').hover(Text.gray('После набега вернёт туда, где вы сейчас')))
		)
	}
}

// Конец набега: телепортировавшихся к алтарю — обратно (кто не в сети — вернём при входе)
function nsReturnAll(state) {
	if (!state.returns) return
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var name = String(players[i].getUsername())
		if (!state.returns[name]) continue
		nsReturnPlayer(name, state.returns[name])
		players[i].tell(Text.gray('[Ночная смена] Набег закончился — возвращаю туда, где вы были.'))
		delete state.returns[name]
	}
}

function nsHordeCfg(state) {
	if (state.raid.kind === 'minor') return nsMinorHorde(state.phase)
	var d = state.raid.difficulty || 1
	var cfg = nsChallengeHorde(d)
	// «Условия смены» (12_mutators.js): двойная орда, стеклянная пушка, ночь боссов…
	return typeof nsApplyMutators === 'function' ? nsApplyMutators(cfg, state, d) : cfg
}

function nsWaveList(state, hordeCfg) {
	return hordeCfg.waves
}

function nsWaveBar(state, alive) {
	var list = nsWaveList(state, nsHordeCfg(state) || { waves: [] })
	var title = state.raid.bossSpawned ? 'Босс' : 'Волна ' + (state.raid.waveIndex + 1) + ' из ' + list.length
	nsBossbarCreate('nightshift:raid_wave', title + ' — осталось ' + alive, state.raid.kind !== 'minor' ? 'red' : 'yellow')
	nsBossbarMax('nightshift:raid_wave', Math.max(1, state.raid.waveSize || alive))
	nsBossbarValue('nightshift:raid_wave', alive)
}

// Размер команды: числа в конфиге — на одного игрока. 1 → ×1, 2 → ×1,5, 3 → ×2.
function nsPartyScale() {
	var n = 0
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		try {
			if (!players[i].isSpectator()) n++
		} catch (e) {
			n++
		}
	}
	return 1 + 0.5 * Math.max(0, n - 1)
}

// Мобы набега ищут путь до алтаря на 64 блока (у зомби по умолчанию ~35): так они
// находят длинный коридор-ловушку или туннель к подземной базе, а не грызут стену напрямик.
function nsBoostRaidMobs(buff, scale) {
	var sel = '@e[tag=nightshift_raid,tag=!ns_boosted]'
	NSG.nsServer.runCommandSilent('execute as ' + sel + ' run attribute @s minecraft:generic.follow_range base set 64')
	// усиление сложности: сопротивление/сила/скорость на весь набег
	if (buff) {
		for (var eff in buff) {
			var lvl = Math.round(buff[eff])
			if (lvl > 0) NSG.nsServer.runCommandSilent('effect give ' + sel + ' minecraft:' + eff + ' infinite ' + (lvl - 1).toFixed(0) + ' true')
		}
	}
	// Кошмар: плавный рост здоровья/урона/скорости (доли к базе), после — лечим до нового максимума
	if (scale) {
		var attrs = { 'minecraft:generic.max_health': scale.hp, 'minecraft:generic.attack_damage': scale.damage, 'minecraft:generic.movement_speed': scale.speed }
		for (var a in attrs) {
			// урон может быть и меньше базы (боссы ArPhEx на ранних волнах — nsModBossFor)
			if (attrs[a] && attrs[a] !== 0) NSG.nsServer.runCommandSilent('execute as ' + sel + ' run attribute @s ' + a + ' modifier add nightshift:nightmare ' + attrs[a].toFixed(3) + ' add_multiplied_base')
		}
		if (scale.hp > 0) NSG.nsServer.runCommandSilent('execute as ' + sel + ' run data modify entity @s Health set value 100000f')
		// Кошмар: мобы крупнее (не боссы — у них size: 1)
		if (scale.size > 1) NSG.nsServer.runCommandSilent('execute as ' + sel + ' run attribute @s minecraft:generic.scale modifier add nightshift:giant ' + (scale.size - 1).toFixed(3) + ' add_multiplied_base')
	}
	// тема арены (70_nightshift_arena.js): Пекло — горящая злая орда, Мерзлота — медленная и закалённая, Край — прыгучая…
	var afx = NSG.nsArenaMobFx
	if (afx) {
		for (var ae in afx.effects || {}) NSG.nsServer.runCommandSilent('effect give ' + sel + ' minecraft:' + ae + ' infinite ' + (afx.effects[ae] - 1) + ' true')
		if (afx.burning) NSG.nsServer.runCommandSilent('execute as ' + sel + ' run data modify entity @s Fire set value 32000s')
	}
	NSG.nsServer.runCommandSilent('tag ' + sel + ' add ns_boosted')
}

// Премьера волны (модовые волны, 08_modded_waves.js): титр и подсказка в чат — что за моб и как с ним бороться.
// На волнах без премьеры (64+, Кошмар) — «звезда вечера».
function nsAnnounceStar(hordeCfg) {
	var m = hordeCfg.star
	var head = hordeCfg.premiere ? 'Премьера!' : 'Звезда вечера'
	nsTitleAll(head, { color: 'gold', bold: true, subtitle: m.name, subColor: 'yellow' })
	NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete ambient @a')
	nsTellAll(Text.gold('[Ночная смена] ' + head + ' ').append(Text.yellow(m.name)).append(Text.gray(' — ' + m.tip)))
}

// Спавнит текущую волну. Возвращает false, если волн больше нет (победа).
function nsSpawnCurrentWave(state, level, altar) {
	var hordeCfg = nsHordeCfg(state)
	if (!hordeCfg) {
		console.warn('[nightshift] Нет конфига орды — набег отменён')
		nsResetRaidIdle(state)
		return true
	}
	var wave = nsWaveList(state, hordeCfg)[state.raid.waveIndex]

	if (!wave) {
		if (hordeCfg.boss && !state.raid.bossSpawned) {
			state.raid.bossSpawned = true
			var bossCount = hordeCfg.bossCount || 1 // с 70-й волны боссов несколько
			nsTitleAll('Оно пришло…', { color: 'dark_purple', bold: true, subtitle: hordeCfg.boss.label + (bossCount > 1 ? ' ×' + bossCount : ''), subColor: 'red' })
			nsGrowTrackRadius(state, nsSpawnMobRing(level, altar, hordeCfg.boss.id, bossCount, state, hordeCfg.boss.nbt))
			var extra = hordeCfg.bossExtra || []
			for (var bx = 0; bx < extra.length; bx++) {
				nsGrowTrackRadius(state, nsSpawnMobRing(level, altar, extra[bx].boss.id, extra[bx].count, state, extra[bx].boss.nbt))
				bossCount += extra[bx].count
			}
			nsBoostRaidMobs(hordeCfg.buff, hordeCfg.bossScale || hordeCfg.scale)
			state.raid.queue = []
			state.raid.waveSize = bossCount
			nsSaveState(state)
			return true
		}
		return false
	}

	if (state.raid.waveIndex === 0 && hordeCfg.star) nsAnnounceStar(hordeCfg)
	else nsTitleAll('Волна ' + (state.raid.waveIndex + 1), { color: 'red', bold: true })
	// кто стоит у алтаря на старте волны — в счёт присутствия (добыча — за половину волн и больше)
	state.raid.present = state.raid.present || {}
	var here = nsParticipants(altar)
	for (var h = 0; h < here.length; h++) {
		var hn = String(here[h].getUsername())
		state.raid.present[hn] = (state.raid.present[hn] || 0) + 1
	}
	var size = 0
	var scale = nsPartyScale() * (hordeCfg.mult || 1)
	var queue = []
	for (var i = 0; i < wave.length; i++) {
		var n = Math.ceil(wave[i].count * scale)
		queue.push({ w: i, n: n }) // w — строка состава подволны
		size += n
	}
	state.raid.queue = queue
	state.raid.waveSize = size
	nsSpawnQueued(state, level, altar, hordeCfg, 0)
	nsSaveState(state)
	return true
}

function nsQueuedCount(state) {
	var q = state.raid.queue || []
	var n = 0
	for (var i = 0; i < q.length; i++) n += q[i].n
	return n
}

// Выпускает мобов подволны из очереди: пока живых меньше NS_RAID_MAX_ALIVE и не больше NS_RAID_SPAWN_PORTION
// за раз — поровну из каждой строки состава (выходят вперемешку, а не «сначала все зомби»). Возвращает, сколько.
function nsSpawnQueued(state, level, altar, hordeCfg, alive) {
	var q = state.raid.queue || []
	if (!q.length) return 0
	var wave = nsWaveList(state, hordeCfg)[state.raid.waveIndex]
	if (!wave) {
		state.raid.queue = []
		return 0
	}
	var room = Math.min(NSG.NS_RAID_SPAWN_PORTION, NSG.NS_RAID_MAX_ALIVE - alive)
	var spawned = 0
	while (room > 0 && q.length) {
		var share = Math.max(1, Math.floor(room / q.length))
		for (var i = 0; i < q.length && room > 0; i++) {
			var k = Math.min(q[i].n, share, room)
			var e = wave[q[i].w]
			nsGrowTrackRadius(state, nsSpawnMobRing(level, altar, e.id, k, state, e.nbt, e.tags))
			q[i].n -= k
			room -= k
			spawned += k
		}
		var left = []
		for (var j = 0; j < q.length; j++) if (q[j].n > 0) left.push(q[j])
		q = left
	}
	state.raid.queue = q
	if (spawned > 0) nsBoostRaidMobs(hordeCfg.buff, hordeCfg.scale)
	return spawned
}

// Шаг, упавший с ошибкой, не должен ронять остальное (и оставлять набег «active»): пишем в лог и идём дальше
function nsTry(what, fn) {
	try {
		fn()
	} catch (e) {
		console.error('[nightshift] ошибка: ' + what + ': ' + e)
	}
}

function nsRaidVictory(state) {
	var raid = state.raid
	var kind = raid.kind
	var altar = nsFindAltar(state, raid.altarId)
	var d = raid.difficulty || 1
	var first = kind !== 'minor' && d > (state.phase || 0)
	var reached = raid.reached || 0
	var T = NSG.NIGHTSHIFT_TUNABLES
	// кто у алтаря — ДО возврата телепортированных (/nightshift altar): 01.10 добыча доставалась только тому,
	// кто пришёл сам, — остальных уносило домой раньше раздачи
	var atAltar = nsParticipants(altar)
	// Набег закрываем и сохраняем ДО наград: упади выдача с ошибкой — набег не останется «active»
	// (иначе каждую секунду снова откат арены и снова награды тем, кто их уже получил).
	state.raid = nsDefaultState().raid
	if (kind !== 'minor') {
		if (first) state.phase = d // «фаза» теперь = наибольшая пройденная сложность
		state.dayCounter = 0
	} else if (reached > 0) {
		state.curse = Math.min(T.curseMaxHearts, (state.curse || 0) + T.curseHeartsMinor) // прорыв к алтарю
	} else if ((state.curse || 0) > 0) state.curse--
	nsSaveState(state)

	nsTry('откат арены', function () {
		if (typeof nsArenaHook === 'function') nsArenaHook('end', raid.altarId)
	})
	nsRaidEnded()
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	NSG.nsServer.runCommandSilent('weather clear')

	if (kind !== 'minor') {
		console.info('[nightshift] сложность ' + d + ' пройдена' + (first ? ' впервые' : ''))
		nsTitleAll(nsDifficultyName(d) + ' — победа!', {
			color: 'green',
			bold: true,
			subtitle: first ? 'Открыта: ' + nsDifficultyName(d + 1) : 'Добыча — в инвентаре',
			subColor: 'white',
		})
		NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master @a')
		nsTry('награды за волну ' + d, function () {
			nsRaidRewards(altar, d, nsRaidRolls(d), first, raid.present, nsChallengeHorde(d).waves.length, atAltar, raid.mut)
		})
		if (first)
			nsTry('квесты волны ' + d, function () {
				nsCompletePhaseQuests(null, d)
			})
		// контракты бригадира (14_contracts.js): волна, условие смены, арена, без смертей
		nsTry('контракты', function () {
			if (typeof nsContractsOnVictory === 'function') nsContractsOnVictory(d, raid, altar)
		})
	} else {
		console.info('[nightshift] малый набег закончился, до алтаря дошли: ' + reached)
		if (reached > 0) {
			nsTitleAll('Алтарь осквернён', { color: 'dark_red', bold: true, subtitle: 'До алтаря добрались: ' + reached + ' — −' + T.curseHeartsMinor + ' сердца у всех', subColor: 'gray' })
			nsTellAll(nsCurseLine(state))
		} else {
			nsTitleAll('Набег отбит', { color: 'green', subtitle: state.curse > 0 ? 'Проклятие ослабло на сердце' : 'Добыча — в инвентаре', subColor: 'gray' })
			// добыча — как за повтор этой волны (без бонусов первого прохождения)
			var mw = nsMinorWave(state.phase)
			nsTry('награды малого набега', function () {
				nsRaidRewards(altar, mw, nsRaidRolls(mw), false, raid.present, nsChallengeHorde(mw).waves.length, atAltar)
			})
		}
		nsTry('штраф', function () {
			nsApplyPenalty(null)
		})
	}
	// телепортированных к алтарю — домой, уже после добычи
	nsTry('возврат игроков', function () {
		var st = nsGetState()
		nsReturnAll(st)
		nsSaveState(st)
	})
}

function nsRaidFail(state, mobs) {
	var d = state.raid.difficulty || 1
	var arenaAltar = state.raid.altarId
	nsTry('откат арены', function () {
		if (typeof nsArenaHook === 'function') nsArenaHook('end', arenaAltar)
	})
	console.info('[nightshift] моб добрался до алтаря — набег сложности ' + d + ' провален')
	for (var i = 0; i < mobs.length; i++) nsRemoveMob(mobs[i])
	nsRaidEnded()
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	NSG.nsServer.runCommandSilent('weather clear')

	var T = NSG.NIGHTSHIFT_TUNABLES
	var hearts = nsFailHearts(d)
	state.curse = Math.min(T.curseMaxHearts, (state.curse || 0) + hearts) // новый набег — только после искупления
	state.raid = nsDefaultState().raid
	state.raid.state = 'cooldown'
	state.raid.countdownRemaining = 20
	nsReturnAll(state)
	nsSaveState(state)
	nsApplyPenalty(null)

	nsTitleAll('Набег провален', { color: 'dark_red', bold: true, subtitle: '−' + nsPlural(hearts, 'сердце', 'сердца', 'сердец') + ' у всех, алтарь осквернён', subColor: 'gray' })
	nsTellAll(nsCurseLine(state))
	nsTellAll(Text.gray('[Ночная смена] Пока проклятие не искуплено, алтарь не начнёт новый набег.'))
}

// Проклятие за провал: чем выше сложность, тем больнее
function nsFailHearts(d) {
	var t = nsWaveTier(d)
	return t <= 2 ? 2 : t <= 5 ? 3 : 5
}

// Якорь волны d: [номер прежней сложности 1–10, прогресс внутри якоря 0..1] (шкала — NS_WAVE_ANCHORS)
function nsWaveAnchor(d) {
	var A = NSG.NS_WAVE_ANCHORS
	for (var i = A.length - 1; i >= 0; i--) {
		if (d >= A[i][0]) {
			var end = i + 1 < A.length ? A[i + 1][0] : NSG.NS_WAVE_BOSS_FROM
			return [A[i][1], Math.min(1, (d - A[i][0]) / Math.max(1, end - A[i][0]))]
		}
	}
	return [1, 0]
}

// Уровень таблиц добычи 1–10 для волны d
function nsWaveTier(d) {
	return d >= NSG.NS_WAVE_BOSS_FROM ? NSG.NIGHTSHIFT_DIFFICULTY_MAX : nsWaveAnchor(Math.max(1, d))[0]
}

// Номер «поздней» волны: 1 на 70-й, 31 на 100-й, дальше растёт (0 — до 70-й)
function nsWaveLate(d) {
	return Math.max(0, d - NSG.NS_WAVE_BOSS_FROM + 1)
}

// Плотность орды волны d (NS_WAVE_DENSITY): 1 до 49-й, 1,5 → 2,5 на 50–69, с 70-й 3 + 0,1 за волну
function nsWaveDensity(d) {
	var W = NSG.NS_WAVE_DENSITY
	var late = nsWaveLate(d)
	if (late > 0) return W.lateStart + W.latePerWave * (late - 1)
	if (d < W.from) return 1
	return W.start + (W.end - W.start) * Math.min(1, (d - W.from) / Math.max(1, NSG.NS_WAVE_BOSS_FROM - 1 - W.from))
}

// Прибавка к здоровью мобов волны d (NS_WAVE_TOUGH): 0 до 49-й, +0,5 → +3 на 50–69, с 70-й +4 и +0,25 за волну
function nsWaveToughHp(d) {
	var W = NSG.NS_WAVE_TOUGH
	var late = nsWaveLate(d)
	if (late > 0) return W.lateStart + W.latePerWave * (late - 1)
	if (d < W.from) return W.early || 0
	return W.start + (W.end - W.start) * Math.min(1, (d - W.from) / Math.max(1, NSG.NS_WAVE_BOSS_FROM - 1 - W.from))
}

// Бафф набега: базовый для всех (NS_RAID_BASE_BUFF) + бафф состава — по каждому эффекту больший уровень
function nsRaidBuff(buff) {
	var out = {}
	var base = NSG.NS_RAID_BASE_BUFF || {}
	for (var b in base) out[b] = base[b]
	for (var e in buff || {}) out[e] = Math.max(out[e] || 0, buff[e])
	return out
}

// Размер мобов Кошмара (NS_WAVE_GIANT): 1 до 69-й, дальше растёт
function nsWaveGiant(d) {
	var G = NSG.NS_WAVE_GIANT
	var late = nsWaveLate(d)
	return late > 0 ? Math.min(G.max, G.start + G.perWave * (late - 1)) : 1
}

// Модовые волны (raids/08_modded_waves.js): с этой волны в ордах только мобы модов, у каждой — премьера
NSG.NS_MOD_WAVES_FROM = 16

// Орда волны d (шкала 1–100, выше — Бесконечность). До 70-й: состав якоря × плавный рост,
// босс каждую 5-ю волну. С 16-й состав — модовый (тот же «бюджет здоровья» подволны, что у якоря), боссы с 15-й —
// ArPhEx. С 70-й: модовые подволны + подволны Cataclysm + Свита Кошмара, все крепнут, боссы Cataclysm.
function nsChallengeHorde(d) {
	var D = NSG.NIGHTSHIFT_DIFFICULTY
	d = Math.max(1, d)
	var late = nsWaveLate(d)
	var mod = NSG.nsModWave && d >= NSG.NS_MOD_WAVES_FROM
	if (late === 0) {
		var an = nsWaveAnchor(d)
		var base = D[an[0]]
		var R = NSG.NS_WAVE_RAMP
		var cfg0 = {
			name: base.name,
			waves: base.waves,
			boss: d % 5 === 0 ? base.boss || NSG.NS_EARLY_BOSS(d) : null,
			bossCount: 1,
			buff: nsRaidBuff(base.buff),
			mult: (R.multFrom + (R.multTo - R.multFrom) * an[1]) * nsWaveDensity(d),
			scale: { hp: R.hpTo * an[1] + nsWaveToughHp(d), damage: R.damageTo * an[1], speed: 0 },
		}
		if (mod) {
			var mw = NSG.nsModWave(d, nsMwBudget(base.waves), base.waves.length, false)
			cfg0.name = mw.name
			cfg0.waves = mw.waves
			cfg0.star = mw.star
			cfg0.premiere = mw.premiere
		}
		var mb = d % 5 === 0 && NSG.nsModBossFor ? NSG.nsModBossFor(d, cfg0.scale.hp) : null
		if (mb) {
			cfg0.boss = mb.boss
			cfg0.bossExtra = mb.extra
			cfg0.bossScale = mb.scale
		}
		return cfg0
	}
	var top = D[NSG.NIGHTSHIFT_DIFFICULTY_MAX]
	var L = NSG.NS_WAVE_LATE
	var scale = { hp: nsWaveToughHp(d), damage: L.damage * late, speed: Math.min(L.speedMax, L.speed * late), size: nsWaveGiant(d) }
	// с модом — подволны из обычных мобов Cataclysm между модовыми подволнами и Свитой Кошмара
	var cmWaves = NSG.NS_CATACLYSM_WAVES && Platform.isLoaded('cataclysm') ? NSG.NS_CATACLYSM_WAVES : []
	var lateWaves = top.waves
	var finale = NSG.NIGHTSHIFT_NIGHTMARE.finale
	var star = null
	var name = d > NSG.NS_WAVES_MAX ? 'Бесконечность' : 'Кошмар'
	if (mod) {
		var lw = NSG.nsModWave(d, nsMwBudget(top.waves), top.waves.length, true)
		lateWaves = lw.waves
		star = lw.star
		finale = NSG.NS_MOD_FINALE()
		name = name + ' · ' + lw.name
	}
	var cfg = {
		name: name,
		waves: lateWaves.concat(cmWaves, [finale]),
		boss: top.boss,
		bossCount: 1 + Math.floor(late / L.bossEvery),
		buff: nsRaidBuff(top.buff),
		mult: nsWaveDensity(d),
		scale: scale,
		star: star,
	}
	// Боссы L_Ender's Cataclysm (ротация — raids/05_cataclysm_bosses.js): с 70-й вместо одного и того же
	// скорпиона; на вехах 80/90/100 — пара разных. Их здоровье Кошмар раздувает не больше hpScaleMax —
	// у боссов мода потолок урона в секунду, иначе их не добить.
	var cm = NSG.nsCataclysmBossForWave && Platform.isLoaded('cataclysm') ? NSG.nsCataclysmBossForWave(d) : null
	if (cm && cm.boss) {
		cfg.boss = cm.boss
		cfg.bossCount = cm.bossCount || 1
		cfg.bossExtra = cm.extra || []
		cfg.bossScale = { hp: Math.min(scale.hp, cm.hpScaleMax === undefined ? scale.hp : cm.hpScaleMax), damage: scale.damage, speed: scale.speed, size: 1 }
	}
	return cfg
}

// Бросков добычи за победу: по одному за подволну, два за каждого босса, после 69-й — ещё по одному за волну
function nsRaidRolls(d) {
	var cfg = nsChallengeHorde(d)
	return cfg.waves.length + (cfg.boss ? 2 * (cfg.bossCount || 1) : 0) + nsWaveLate(d)
}

// 1 волна, 3 волны, 5 волн
function nsPlural(n, one, few, many) {
	var m10 = n % 10,
		m100 = n % 100
	if (m10 === 1 && m100 !== 11) return n + ' ' + one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few
	return n + ' ' + many
}

// «Сложность 3 · Нашествие», «Кошмар 2»
function nsDifficultyName(d) {
	if (d > NSG.NS_WAVES_MAX) return 'Бесконечность ' + (d - NSG.NS_WAVES_MAX)
	return 'Волна ' + d + ' · ' + nsChallengeHorde(d).name
}

// Волна малого набега (Георгий, 30.09: «на 40-й волне малый набег — это 30-я, на 1-й — просто авто-набег»):
// на 10 волн ниже лучшей пройденной, но не ниже 1-й
function nsMinorWave(best) {
	return Math.max(1, (best || 0) - 10)
}

// малый набег — полноценная волна (состав, подволны, босс каждой 5-й) на 10 ниже лучшей
function nsMinorHorde(best) {
	return nsChallengeHorde(nsMinorWave(best))
}

// Защитники — все игроки в измерении алтаря, без ограничения по расстоянию (Георгий, 01.10: «когда драки, не
// засчитывает, что мы у алтаря, потому что мы далеко — сними ограничение»). Пауза набега — отдельно,
// nsPlayersNearAltar (raidPlayerRadius).
function nsParticipants(altar) {
	var out = []
	if (!altar) return out
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		if (String(p.getLevel().getDimension()) !== altar.dim) continue
		try {
			if (p.isSpectator()) continue
		} catch (e) {}
		out.push(p)
	}
	return out
}

function nsPick(list) {
	return list[Math.floor(Math.random() * list.length)]
}

// Добыча в конце набега: каждому защитнику rolls бросков обычной таблицы уровня level,
// у каждого броска шанс на редкое; раз за набег — шанс на легендарное. probeLevel > 0 —
// первое прохождение: зонд жилы этого уровня одному из защитников.
function nsRaidRewards(altar, d, rolls, first, present, waves, atAltar, mut) {
	var L = NSG.NIGHTSHIFT_LOOT
	// «Условия смены»: бросков ×(1 + бонус/2), артефакт смены — лишние броски (12_mutators.js)
	var mutBonus = typeof nsMutBonus === 'function' ? nsMutBonus(mut) : 0
	if (mutBonus > 0) rolls = Math.round(rolls * (1 + mutBonus / 2))
	var tier = nsWaveTier(d)
	var k = nsWaveLate(d) // «поздняя» волна: с 70-й
	var artChance = Math.min(1, (L.artifactChance[tier] || 0) + 0.01 * k)
	var legChance = L.legendaryChance + 0.006 * tier + 0.003 * k
	var need = Math.ceil((waves || 1) / 2)
	var ps = []
	var all = atAltar || nsParticipants(altar)
	var logLine = []
	for (var a = 0; a < all.length; a++) {
		var an = String(all[a].getUsername())
		var was = (present || {})[an] || 0
		if (was >= need) ps.push(all[a])
		else all[a].tell(Text.gray('[Ночная смена] Добыча — тем, кто держал алтарь хотя бы ' + nsPlural(need, 'волну', 'волны', 'волн') + ' (у тебя ' + was + '). В следующий раз приходите к началу.'))
		logLine.push(an + ' ' + was + '/' + waves + (was >= need ? ' — добыча' : ' — нет'))
	}
	console.info('[nightshift] добыча волны ' + d + ' (нужно ' + need + ' подволн): ' + (logLine.length ? logLine.join('; ') : 'у алтаря никого') + '; присутствие: ' + JSON.stringify(present || {}))
	var pool = []
	for (var q = 0; k > 0 && q < L.nightmare.length; q++) if (L.nightmare[q].minK <= k) pool.push(L.nightmare[q].e)
	// трофеи боссов (09_ns_artifacts.js): индексы защитников — Java-объекты через === в Rhino сравнивать ненадёжно
	var nsCtx = nsArtifactCtx(altar, d, ps.length)
	var nsIdx = []
	for (var ti = 0; ti < ps.length; ti++) nsIdx.push(ti)
	var nsTrophies = []
	if (typeof NSG.nsNsBossTrophyRoll === 'function') {
		try {
			nsTrophies = NSG.nsNsBossTrophyRoll(d, first, nsCtx.bosses, nsIdx) || []
		} catch (e) {
			console.error('[nightshift] трофеи боссов: ' + e)
		}
	}
	// копилка осколков орды этого набега (09_ns_artifacts.js) — каждому защитнику целиком
	var nsShards = typeof NSG.nsNsHordeShardTake === 'function' ? NSG.nsNsHordeShardTake() : 0
	for (var i = 0; i < ps.length; i++) {
		var got = []
		for (var r = 0; r < rolls; r++) {
			got.push(nsPick(L.common[tier]))
			if (Math.random() < L.rareChance) got.push(nsPick(L.rare[tier]))
		}
		for (var n = 0; n < pool.length && n < 1 + Math.floor(k / 6); n++) got.push(nsPick(pool))
		if (Math.random() < artChance) got.push(['artifacts:' + nsPick(L.artifacts), 1])
		// артефакты Ночной смены (7 уровней редкости) — свой бросок каждому защитнику
		if (typeof NSG.nsNsArtifactRoll === 'function') {
			try {
				got = got.concat(NSG.nsNsArtifactRoll(d, first, nsCtx) || [])
				var extra = typeof nsMutExtraArtifactRolls === 'function' ? nsMutExtraArtifactRolls(mutBonus) : 0
				for (var xr = 0; xr < extra; xr++) got = got.concat(NSG.nsNsArtifactRoll(d, false, nsCtx) || [])
			} catch (e) {
				console.error('[nightshift] бросок артефакта смены: ' + e)
			}
		}
		if (Math.random() < legChance) got.push(nsPick(L.legendary))
		if (first) {
			if (d >= 20 && d % 5 === 0) got.push(['artifacts:' + nsPick(L.artifactsTop), 1])
			if (nsWaveGivesHeart(d)) got.push(['nightshift:night_heart', 1])
			var ms = NSG.NS_WAVE_MILESTONES[d]
			if (ms) for (var mi = 0; mi < ms.items.length; mi++) got.push(ms.items[mi])
		}
		for (var tq = 0; tq < nsTrophies.length; tq++) if (nsTrophies[tq].player === i) got.push(nsTrophies[tq].line)
		if (nsShards > 0) got.push(['nightshift:horde_shard', nsShards, 'nightshift:horde_shard', 'копилка набега'])
		nsGiveLoot(ps[i], got)
	}
	// веха: объявление всем
	var milestone = first ? NSG.NS_WAVE_MILESTONES[d] : null
	if (milestone && ps.length > 0) nsTellAll(Text.gold('[Ночная смена] Веха — ' + nsDifficultyName(d) + ': ').append(Text.white(milestone.text)))
	// первое прохождение первой волны нового состава (до 70-й): один зонд жилы на команду
	var probes = first && k === 0 && nsWaveAnchor(d)[1] === 0 ? NSG.NIGHTSHIFT_FIRST_CLEAR_PROBES[tier] : null
	if (probes && ps.length > 0) {
		var lucky = nsPick(ps)
		var probe = 'nightshift:vein_seed_' + nsPick(probes)
		NSG.nsServer.runCommandSilent('give ' + lucky.getUsername() + ' ' + probe + ' 1')
		nsTellAll(Text.gold('[Ночная смена] За первое прохождение ' + lucky.getUsername() + ' получает на команду ').append(nsItemText(probe)))
	}
}

// Обстановка победы для артефактов смены (09_ns_artifacts.js): на арене ли, тема арены, боссы волны, защитников
function nsArtifactCtx(altar, d, players) {
	var st = nsGetState()
	var arena = !!(st.arena && altar && st.arena.altarId === altar.id)
	var cfg = nsChallengeHorde(d)
	var bosses = []
	if (cfg.boss) bosses.push(cfg.boss.id)
	for (var b = 0; cfg.bossExtra && b < cfg.bossExtra.length; b++) if (bosses.indexOf(cfg.bossExtra[b].boss.id) < 0) bosses.push(cfg.bossExtra[b].boss.id)
	return { arena: arena, theme: arena && NSG.nsArenaThemeFor ? NSG.nsArenaThemeFor(d).key : null, bosses: bosses, players: players }
}

// Сердце ночи за первое прохождение: волны 50 и 60, каждая 10-я с 70-й, в Бесконечности — каждая 5-я
function nsWaveGivesHeart(d) {
	if (d > NSG.NS_WAVES_MAX) return (d - NSG.NS_WAVES_MAX) % 5 === 0
	return d === 50 || d === 60 || (d >= NSG.NS_WAVE_BOSS_FROM && d % 10 === 0)
}

// Выдаёт строки добычи (одинаковые складываются) и пишет сводку игроку
function nsGiveLoot(player, got) {
	var name = String(player.getUsername())
	var merged = []
	var byId = {}
	for (var g = 0; g < got.length; g++) {
		var id = got[g][0]
		if (byId[id] !== undefined) merged[byId[id]][1] += got[g][1]
		else {
			byId[id] = merged.length
			merged.push([id, got[g][1], got[g][2], got[g][3]])
		}
	}
	var line = Text.gold('[Ночная смена] Добыча: ')
	for (var m = 0; m < merged.length; m++) {
		var e = merged[m]
		if (e[0].indexOf('loot:') === 0) {
			// ['loot:<таблица>', N, …] — N бросков таблицы добычи (свитки магии и т.п.), подпись — пояснение строки
			for (var lr = 0; lr < e[1]; lr++) NSG.nsServer.runCommandSilent('loot give ' + name + ' loot ' + e[0].substring(5))
			if (m > 0) line = line.append(Text.gray(', '))
			line = line.append(Text.white(e[1] + '× ')).append(Text.lightPurple(e[3] || 'добыча ' + e[0].substring(5)))
			continue
		}
		NSG.nsServer.runCommandSilent('give ' + name + ' ' + e[0] + ' ' + e[1])
		if (m > 0) line = line.append(Text.gray(', '))
		var rare = e[0].indexOf('artifacts:') === 0 || e[0] === 'nightshift:night_heart' || (NSG.nsNsArtifactIs && NSG.nsNsArtifactIs(e[0]))
		var itemText = nsItemText(e[2] || e[0])
		if (e[3]) itemText = itemText.append(Text.of(' (' + e[3] + ')'))
		line = line.append(Text.white(e[1] + '× ')).append(rare ? Text.lightPurple('').append(itemText) : itemText)
	}
	player.tell(line)
	for (var a = 0; a < merged.length; a++) {
		if (merged[a][0].indexOf('artifacts:') === 0) nsTellAll(Text.lightPurple('[Ночная смена] ' + name + ' получает артефакт: ').append(nsItemText(merged[a][0])))
		// артефакт смены легендарный и выше (уровень 4+) — объявление всем
		else if (NSG.nsNsArtifactTier && NSG.nsNsArtifactTier(merged[a][0]) >= 4) {
			nsTellAll(Text.gold('[Ночная смена] ' + name + ' получает ' + (merged[a][3] || 'артефакт смены') + ': ').append(nsItemText(merged[a][0])))
			NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete player @a')
		}
	}
}

// --------------------------------------------------------------------------
// Тик-обработчики состояний (раз в navTickInterval тиков).
// --------------------------------------------------------------------------

// Пауза, если у алтаря никого нет. Возвращает true, если набег стоит.
function nsRaidPaused(state, level, altar) {
	var near = nsPlayersNearAltar(level, altar)
	if (near) {
		if (state.raid.paused) {
			state.raid.paused = false
			nsSaveState(state)
		}
		return false
	}
	if (!state.raid.paused) {
		state.raid.paused = true
		nsSaveState(state)
	}
	if (nsRaidTickCounter % 200 === 0) nsActionBarAll('Орда ждёт у алтаря — набег продолжится, когда вы вернётесь', 'gray')
	return true
}

function nsTickCountdown(state) {
	var altar = nsFindAltar(state, state.raid.altarId)
	if (!altar) {
		nsResetRaidIdle(state)
		return
	}
	var level = nsAltarLevel(altar)
	if (nsRaidPaused(state, level, altar)) return

	state.raid.countdownRemaining -= 1
	if (state.raid.countdownRemaining <= 0) {
		nsBossbarRemove('nightshift:raid_countdown')
		state.raid.state = 'active'
		state.raid.waveIndex = 0
		nsSaveState(state)
		console.info('[nightshift] набег начался (' + state.raid.kind + ')')
		// арена — снимок в момент выхода орды: всё построенное за отсчёт тоже в нём (70_nightshift_arena.js)
		nsTry('снимок арены', function () {
			if (typeof nsArenaHook === 'function') nsArenaHook('start', state.raid.altarId)
			// хук мог достроить тему и сохранить её в свежем состоянии — не затереть своим (ревью 01.10)
			var fresh = nsGetState()
			if (fresh.arena) state.arena = fresh.arena
		})
		if (!nsSpawnCurrentWave(state, level, altar)) nsRaidVictory(state)
		else if (state.raid.state === 'active') nsMarkWaveSeen(state, level, altar)
		return
	}
	nsBossbarValue('nightshift:raid_countdown', state.raid.countdownRemaining)
	nsSaveState(state)
}

function nsTickActiveRaid(state) {
	var altar = nsFindAltar(state, state.raid.altarId)
	if (!altar) {
		nsResetRaidIdle(state)
		return
	}
	var level = nsAltarLevel(altar)
	if (nsRaidPaused(state, level, altar)) return
	var T = NSG.NIGHTSHIFT_TUNABLES

	var mobs = nsCollectRaidMobs(level, altar, nsTrackRadius(state))
	if (mobs === null) return // поиск сломан — не засчитываем волну вслепую

	// провал / добор до алтаря
	for (var i = mobs.length - 1; i >= 0; i--) {
		var mob = mobs[i]
		var dx = mob.getX() - (altar.x + 0.5),
			dy = mob.getY() - altar.y,
			dz = mob.getZ() - (altar.z + 0.5)
		if (dx * dx + dy * dy + dz * dz <= T.raidFailRadius * T.raidFailRadius) {
			if (NS_FLYERS[String(mob.getType())] || (NSG.NS_MOD_FLYERS && NSG.NS_MOD_FLYERS[String(mob.getType())])) continue // летун пикирует на защитника у алтаря — не «дошёл»
			// подрывник, добежавший до алтаря, взрывается (бьёт защитников), а не проваливает набег
			if (nsHasTag(mob, 'ns_kamikaze')) {
				nsKamikazeBlast(mob, level, altar)
				mobs.splice(i, 1)
				continue
			}
			if (state.raid.kind !== 'minor') {
				console.info('[nightshift] у алтаря ' + String(mob.getType()) + ' на ' + mob.getX().toFixed(1) + ' ' + mob.getY().toFixed(1) + ' ' + mob.getZ().toFixed(1))
				nsRaidFail(state, mobs)
				return
			}
			nsRemoveMob(mob) // малый набег — без провала, дошедший моб просто исчезает
			mobs.splice(i, 1)
			state.raid.reached = (state.raid.reached || 0) + 1
			nsSaveState(state)
		}
	}

	for (var j = 0; j < mobs.length; j++) nsTickMobNavigation(mobs[j], altar, level)

	var queued = nsQueuedCount(state)
	nsTry('хвост подволны', function () {
		nsTailCheck(state, level, altar, mobs, queued)
	})
	if (mobs.length > 0) {
		if (!state.raid.waveSeen) {
			state.raid.waveSeen = true // волна действительно появилась — теперь её зачистка засчитается
			state.raid.spawnRetries = 0
			nsSaveState(state)
		}
		// большая подволна: добираем из очереди по мере гибели
		if (queued > 0 && mobs.length < NSG.NS_RAID_MAX_ALIVE && nsSpawnQueued(state, level, altar, nsHordeCfg(state), mobs.length) > 0) {
			nsSaveState(state)
			queued = nsQueuedCount(state)
		}
		nsWaveBar(state, mobs.length + queued)
		return
	}
	if (queued > 0) {
		// живые кончились, очередь — нет: следующая порция
		nsSpawnQueued(state, level, altar, nsHordeCfg(state), 0)
		nsSaveState(state)
		return
	}

	// рядом никого — но отбившиеся (улетевший или телепортировавшийся босс, унесённые далеко) ещё живы:
	// возвращаем их к орде, а не засчитываем победу
	if (nsRecallStragglers(level, altar, state) > 0) return

	// волна так и не появилась (нет места, чанк не загружен): пустую не засчитываем — повторяем спавн.
	// Первая пустая проверка — просто ждём секунду; дальше до 3 повторов спавна, потом идём дальше.
	if (state.raid.waveSize > 0 && !state.raid.waveSeen && (state.raid.spawnRetries || 0) < 4) {
		state.raid.spawnRetries = (state.raid.spawnRetries || 0) + 1
		if (state.raid.spawnRetries > 1) {
			console.warn('[nightshift] ' + (state.raid.bossSpawned ? 'босс' : 'волна ' + (state.raid.waveIndex + 1)) + ' не появилась — повтор спавна ' + (state.raid.spawnRetries - 1))
			state.raid.bossSpawned = false
			nsSpawnCurrentWave(state, level, altar)
			nsMarkWaveSeen(state, level, altar)
		}
		nsSaveState(state)
		return
	}

	// волна зачищена — следующая
	if (state.raid.bossSpawned) {
		nsRaidVictory(state)
		return
	}
	state.raid.waveIndex++
	state.raid.spawnRetries = 0
	state.raid.waveSize = 0
	state.raid.waveSeen = false
	if (!nsSpawnCurrentWave(state, level, altar)) {
		nsRaidVictory(state)
		return
	}
	nsMarkWaveSeen(state, level, altar)
}

// --------------------------------------------------------------------------
// Застрявший хвост подволны (02.10, Георгий: «волна баганулась — монстров нет, а волна идёт»: 4 моба сидели на крыше
// базы над алтарём, в пещере на глубине 44 и на горе на 124 — подволна не кончалась). Осталось мало мобов и они не
// гибнут: через glowAfter с — свечение сквозь стены, через recallAfter с — назад к месту выхода орды (и снова идут на
// алтарь), повтор раз в 30 с. Счёт сбрасывается, как только кто-то из хвоста погиб.
// --------------------------------------------------------------------------
NSG.NS_RAID_TAIL = { maxLeft: 5, share: 0.15, glowAfter: 20, recallAfter: 45 }
function nsTailCheck(state, level, altar, mobs, queued) {
	var T = NSG.NS_RAID_TAIL
	var limit = Math.max(T.maxLeft, Math.ceil((state.raid.waveSize || 0) * T.share))
	if (queued > 0 || mobs.length === 0 || mobs.length > limit) {
		NSG.nsTail = null
		return
	}
	var tl = NSG.nsTail
	if (!tl || tl.rid !== state.raid.rid || tl.wave !== state.raid.waveIndex || tl.boss !== !!state.raid.bossSpawned || tl.left !== mobs.length) {
		NSG.nsTail = { rid: state.raid.rid, wave: state.raid.waveIndex, boss: !!state.raid.bossSpawned, left: mobs.length, secs: 0 }
		return
	}
	tl.secs++
	if (tl.secs === T.glowAfter) {
		for (var i = 0; i < mobs.length; i++) {
			try {
				mobs[i].addEffect(new NS_MOB_EFFECT_INSTANCE(NS_GLOWING, 20 * 600, 0, false, false))
			} catch (e) {
				NSG.nsServer.runCommandSilent('effect give ' + mobs[i].getStringUuid() + ' minecraft:glowing 600 0 true')
			}
		}
		nsTellAll(Text.gray('[Ночная смена] Остались ' + nsPlural(mobs.length, 'моб', 'моба', 'мобов') + ' — подсвечены, их видно сквозь стены.'))
	}
	if (tl.secs >= T.recallAfter && (tl.secs - T.recallAfter) % 30 === 0) {
		var moved = 0
		for (var k = 0; k < mobs.length; k++) {
			var pt = nsRingPoint(level, altar, state)
			if (!pt) continue
			try {
				mobs[k].teleportTo(pt.x + 0.5, pt.y, pt.z + 0.5)
				var pd = mobs[k].persistentData
				pd.putDouble('ns_best', 1e9)
				pd.putInt('ns_stuck', 0)
				moved++
			} catch (e) {}
		}
		if (moved > 0) {
			console.info('[nightshift] хвост подволны: вернул к месту выхода орды ' + moved)
			nsTellAll(Text.gray('[Ночная смена] Застрявшие мобы возвращены к месту выхода орды — идут на алтарь.'))
		}
	}
}
var NS_MOB_EFFECT_INSTANCE = Java.loadClass('net.minecraft.world.effect.MobEffectInstance')
var NS_GLOWING = Java.loadClass('net.minecraft.world.effect.MobEffects').GLOWING

// Точка на кольце выхода орды (как у nsSpawnMobRing): свои точки спавна или кольцо вокруг алтаря вне зон базы
function nsRingPoint(level, altar, state) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var pts = altar.spawns || []
	if (pts.length > 0) {
		var p = pts[Math.floor(Math.random() * pts.length)]
		var y0 = nsFindSpawnY(level, p.x, p.z, p.y)
		return { x: p.x, y: y0 === null ? p.y : y0, z: p.z }
	}
	for (var attempt = 0; attempt < 40; attempt++) {
		var angle = Math.random() * Math.PI * 2
		var dist = T.raidRingMinDist + Math.random() * (T.raidRingMaxDist - T.raidRingMinDist) + attempt * 8
		var x = Math.round(altar.x + Math.cos(angle) * dist)
		var z = Math.round(altar.z + Math.sin(angle) * dist)
		if (nsPointInAnyZone(state, altar.dim, x, altar.y, z)) continue
		var y = nsFindSpawnY(level, x, z, altar.y)
		if (y !== null) return { x: x, y: y, z: z }
	}
	return null
}

// Сразу после спавна: волна на месте — отмечаем (иначе турели, убившие её за секунду, выглядели бы как
// «волна не появилась», и она спавнилась бы заново)
function nsMarkWaveSeen(state, level, altar) {
	var fresh = nsCollectRaidMobs(level, altar, nsTrackRadius(state))
	if (fresh === null) return
	if (fresh.length > 0) {
		state.raid.waveSeen = true
		nsSaveState(state)
	} else console.warn('[nightshift] ' + (state.raid.bossSpawned ? 'босс' : 'волна ' + (state.raid.waveIndex + 1)) + ' не появилась (нет места для спавна?)')
}

function nsTickCooldown(state) {
	state.raid.countdownRemaining--
	if (state.raid.countdownRemaining <= 0) state.raid.state = 'idle'
	nsSaveState(state)
}

// --------------------------------------------------------------------------
// Малые набеги — счётчик ночей. При смене игрового дня считаем dayCounter,
// показываем "До набега осталось N ночей", каждые 5 ночей — малый набег у
// первого алтаря.
// --------------------------------------------------------------------------
// Алтарь базы для малого набега: алтарь арены не в счёт (арена — полигон, малый набег там повис бы без игроков)
function nsHomeAltar(state) {
	var arenaId = state.arena && state.arena.altarId
	for (var i = 0; i < state.altars.length; i++) if (state.altars[i].id !== arenaId) return state.altars[i]
	return null
}

function nsCheckMinorRaidSchedule(state) {
	if (!nsHomeAltar(state)) return // алтаря на базе ещё нет — нечего охранять

	var dayTime
	try {
		dayTime = Number(NSG.nsServer.getOverworld().getDayTime())
	} catch (e) {
		return
	}
	var day = Math.floor(dayTime / 24000)
	var tod = dayTime % 24000

	// Набег взведён (5-й день) — приходит, когда ночь наступит сама, без перемотки времени
	// с 12000 (до того, как можно лечь спать) — иначе ночь проспали бы и набег не пришёл
	if (state.minorPending && tod >= 12000 && tod < 23000) {
		// кто-то в арене — малый набег на базу ждёт (01.10: пришёл на пустую базу и закрыл набеги в арене —
		// одновременно идёт только один набег)
		var ps = NSG.nsServer.getPlayers()
		for (var pi = 0; pi < ps.length; pi++) if (String(ps[pi].getLevel().getDimension()) === 'nightshift:arena') return
		state.minorPending = false
		nsSaveState(state)
		if (nsMinorHorde(state.phase)) nsStartRaid('minor', nsHomeAltar(state).id)
		return
	}

	if (state.lastSeenDay === -1 || day < state.lastSeenDay) {
		state.lastSeenDay = day // первый запуск или время откатили командой
		nsSaveState(state)
		return
	}
	if (day === state.lastSeenDay) return

	// новый день (рассвет)
	state.lastSeenDay = day
	state.dayCounter++
	var T = NSG.NIGHTSHIFT_TUNABLES
	if (state.dayCounter >= T.minorRaidEveryNights) {
		state.dayCounter = 0
		state.minorPending = true
		nsSaveState(state)
		nsTitleAll('Этой ночью придут гости', { color: 'yellow', subtitle: 'Малый набег — к закату будьте у алтаря', subColor: 'gray' })
		return
	}
	nsSaveState(state)
	var left = T.minorRaidEveryNights - state.dayCounter
	nsTitleAll('До набега осталось ' + left + ' ' + nsNightsWord(left), { color: 'gray' })
}

// --------------------------------------------------------------------------
// Главный диспетчер — раз в navTickInterval (20) тиков.
// --------------------------------------------------------------------------
var nsRaidTickCounter = 0

ServerEvents.tick(event => {
	NSG.nsServer = event.server // подстраховка на случай гонки с ServerEvents.loaded
	nsRaidTickCounter++
	if (nsRaidTickCounter % NSG.NIGHTSHIFT_TUNABLES.navTickInterval !== 0) return

	var state = nsGetState()
	switch (state.raid.state) {
		case 'idle':
			nsCheckMinorRaidSchedule(state)
			if (nsRaidTickCounter % 1200 === 0) nsHealSleepRule(event.server) // раз в минуту
			break
		case 'countdown':
			nsTickCountdown(state)
			break
		case 'active':
			// гроза на весь набег (старт даёт 5 минут, а набег дольше): под дождём нежить не горит,
			// рассвет посреди набега не «выигрывает» волны солнцем
			if (nsRaidTickCounter % 1200 === 0) event.server.runCommandSilent('weather thunder 6000')
			nsTickActiveRaid(state)
			break
		case 'cooldown':
			nsTickCooldown(state)
			break
	}
})
