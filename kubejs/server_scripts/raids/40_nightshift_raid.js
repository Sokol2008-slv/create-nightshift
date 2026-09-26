// ==========================================================================
// Ночная смена — набеги: жертвенный (с провалом) и малые (каждые 5 ночей,
// без провала). Волны, навигация мобов к алтарю, "грызение" стен, победа/провал.
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

// Сброс набега (алтарь пропал, нет конфига орды, /nightshift stop): мобы набега уходят вместе с ним
function nsResetRaidIdle(state) {
	state.raid = nsDefaultState().raid
	nsReturnAll(state)
	nsSaveState(state)
	nsRaidEnded()
	NSG.nsServer.runCommandSilent('kill @e[tag=nightshift_raid]')
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
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
		if (alive && nsHasRaidTag(ent)) out.push(ent)
	}
	return out
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
	for (var y2 = 319; y2 > -64; y2--) {
		if (!nsIsAir(level, x, y2, z)) return y2 + 1
	}
	return null
}

// Спавн count мобов mobId кольцом raidRingMinDist..raidRingMaxDist от алтаря, вне зон базы.
// Возвращает наибольшее расстояние спавна — по нему растёт радиус поиска мобов набега.
function nsSpawnMobRing(level, altar, mobId, count, state, extraNbt) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var farthest = 0
	for (var i = 0; i < count; i++) {
		var x = 0,
			z = 0,
			y = null
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
		if (y === null) continue
		farthest = Math.max(farthest, Math.sqrt((x - altar.x) * (x - altar.x) + (z - altar.z) * (z - altar.z)))
		var nbt = '{Tags:["nightshift_raid"],PersistenceRequired:1b' + (extraNbt ? ',' + extraNbt : '') + '}'
		NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run summon ' + mobId + ' ' + x + ' ' + y + ' ' + z + ' ' + nbt)
	}
	return farthest
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

	// моб, занятый игроком/турелью, дерётся сам; остальных ведём к алтарю
	var hasTarget = false
	try {
		hasTarget = mob.getTarget() != null
	} catch (e) {}
	var pdn
	try {
		pdn = mob.persistentData
	} catch (e) {}
	var navTick = pdn ? (pdn.contains('ns_nav') ? pdn.getInt('ns_nav') : 0) + 1 : 0
	if (pdn) pdn.putInt('ns_nav', navTick)
	var nav = null
	try {
		nav = mob.getNavigation()
	} catch (e) {}
	// путь пересчитываем, когда прежний кончился, и раз в 5 с — поиск на 64 блока не бесплатный
	if (!hasTarget && nav && (nav.isDone() || navTick % 5 === 1)) {
		try {
			nav.moveTo(altar.x + 0.5, altar.y, altar.z + 0.5, 1.0)
		} catch (e) {
			if (!NSG.nsNavWarned) {
				console.warn('[nightshift] mob.getNavigation().moveTo(...) недоступен: ' + e)
				NSG.nsNavWarned = true
			}
		}
	}

	var pd
	try {
		pd = mob.persistentData
	} catch (e) {
		return
	}

	var lastX = pd.contains('ns_lx') ? pd.getDouble('ns_lx') : mob.getX()
	var lastY = pd.contains('ns_ly') ? pd.getDouble('ns_ly') : mob.getY()
	var lastZ = pd.contains('ns_lz') ? pd.getDouble('ns_lz') : mob.getZ()
	var dx = mob.getX() - lastX,
		dy = mob.getY() - lastY,
		dz = mob.getZ() - lastZ
	var moved2 = dx * dx + dy * dy + dz * dz
	pd.putDouble('ns_lx', mob.getX())
	pd.putDouble('ns_ly', mob.getY())
	pd.putDouble('ns_lz', mob.getZ())

	if (moved2 < T.stuckEpsilonSq) {
		var stuckTicks = (pd.contains('ns_stuck') ? pd.getInt('ns_stuck') : 0) + T.navTickInterval
		pd.putInt('ns_stuck', stuckTicks)
		if (stuckTicks >= T.stuckTicksToChew) nsChewTowardAltar(mob, altar, pd, level)
	} else {
		pd.putInt('ns_stuck', 0)
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
function nsStartRaid(kind, altarId) {
	var state = nsGetState()
	if (nsRaidActive(state)) return

	state.raid = {
		state: 'countdown',
		kind: kind,
		altarId: altarId,
		startedAtTick: 0,
		waveIndex: -1,
		waveStartedAtTick: 0,
		bossSpawned: false,
		countdownRemaining: NSG.NIGHTSHIFT_TUNABLES.raidCountdownSeconds,
		waveSize: 0,
		spawnRetries: 0,
		paused: false,
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

	if (kind === 'sacrifice') {
		nsTitleAll('Они почуяли колебания мира…', {
			color: 'dark_red',
			bold: true,
			subtitle: 'Набег придёт через ' + NSG.NIGHTSHIFT_TUNABLES.raidCountdownSeconds + ' секунд',
			subColor: 'gray',
		})
		NSG.nsServer.runCommandSilent('playsound minecraft:entity.wither.spawn ambient @a')
	} else {
		nsTitleAll('Мир неспокоен…', { color: 'yellow', subtitle: 'К базе идут гости', subColor: 'gray' })
	}

	nsInviteToAltar(nsFindAltar(state, altarId), kind)
	nsBossbarCreate('nightshift:raid_countdown', kind === 'sacrifice' ? 'Набег на алтарь' : 'Малый набег', kind === 'sacrifice' ? 'red' : 'yellow')
	nsBossbarMax('nightshift:raid_countdown', NSG.NIGHTSHIFT_TUNABLES.raidCountdownSeconds)
	nsBossbarValue('nightshift:raid_countdown', NSG.NIGHTSHIFT_TUNABLES.raidCountdownSeconds)
}

// {waves, boss} текущего набега: жертвенный — nsSacrificeHorde, малый — minor текущей фазы
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
			Text.gold(kind === 'sacrifice' ? '[Ночная смена] Набег на алтарь! ' : '[Ночная смена] К базе идут гости! ')
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
	if (state.raid.kind === 'sacrifice') return nsSacrificeHorde(state.phase)
	var h = NSG.NIGHTSHIFT_CONFIG.hordes[state.phase]
	return h && h.minor ? { waves: [h.minor], boss: null } : null
}

function nsWaveList(state, hordeCfg) {
	return hordeCfg.waves
}

function nsWaveBar(state, alive) {
	var list = nsWaveList(state, nsHordeCfg(state) || { waves: [] })
	var title = state.raid.bossSpawned ? 'Босс' : 'Волна ' + (state.raid.waveIndex + 1) + ' из ' + list.length
	nsBossbarCreate('nightshift:raid_wave', title + ' — осталось ' + alive, state.raid.kind === 'sacrifice' ? 'red' : 'yellow')
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
function nsBoostRaidMobs() {
	NSG.nsServer.runCommandSilent('execute as @e[tag=nightshift_raid,tag=!ns_boosted] run attribute @s minecraft:generic.follow_range base set 64')
	NSG.nsServer.runCommandSilent('tag @e[tag=nightshift_raid,tag=!ns_boosted] add ns_boosted')
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
			nsTitleAll('Оно пришло…', { color: 'dark_purple', bold: true })
			nsGrowTrackRadius(state, nsSpawnMobRing(level, altar, hordeCfg.boss.id, 1, state))
			nsBoostRaidMobs()
			state.raid.waveSize = 1
			nsSaveState(state)
			return true
		}
		return false
	}

	nsTitleAll('Волна ' + (state.raid.waveIndex + 1), { color: 'red', bold: true })
	var size = 0
	var scale = nsPartyScale()
	for (var i = 0; i < wave.length; i++) {
		var n = Math.ceil(wave[i].count * scale)
		nsGrowTrackRadius(state, nsSpawnMobRing(level, altar, wave[i].id, n, state, wave[i].nbt))
		size += n
	}
	nsBoostRaidMobs()
	state.raid.waveSize = size
	nsSaveState(state)
	return true
}

function nsRaidVictory(state) {
	var kind = state.raid.kind
	nsRaidEnded()
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	NSG.nsServer.runCommandSilent('weather clear')

	if (kind === 'sacrifice') {
		var nextPhase = state.phase + 1
		console.info('[nightshift] жертвенный набег отбит — открываю фазу ' + nextPhase)
		nsTitleAll('Испытание пройдено!', { color: 'green', bold: true, subtitle: 'Фаза ' + nextPhase + ' открыта', subColor: 'white' })
		NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master @a')
		// сначала сохраняем конец набега, потом выдаём фазу: выдача запускает /reload
		state.raid = nsDefaultState().raid
		state.dayCounter = 0
		nsReturnAll(state)
		nsSaveState(state)
		grantPhase(nextPhase) // сама обновит фазу и сбросит прогресс жертвы
	} else {
		var reached = state.raid.reached || 0
		var T = NSG.NIGHTSHIFT_TUNABLES
		var tribute = NSG.NIGHTSHIFT_TRIBUTE[state.phase]
		console.info('[nightshift] малый набег закончился, до алтаря дошли: ' + reached)
		if (reached > 0) {
			// прорыв к алтарю — проклятие у всей команды
			state.curse = Math.min(T.curseMaxHearts, (state.curse || 0) + T.curseHeartsMinor)
			nsTitleAll('Алтарь осквернён', { color: 'dark_red', bold: true, subtitle: 'До алтаря добрались: ' + reached + ' — −' + T.curseHeartsMinor + ' сердца у всех', subColor: 'gray' })
			nsTellAll(nsCurseLine(state))
		} else if ((state.curse || 0) > 0) {
			state.curse--
			nsTitleAll('Набег отбит', { color: 'green', subtitle: 'Проклятие ослабло на сердце', subColor: 'gray' })
		} else nsTitleAll('Набег отбит', { color: 'green' })
		state.raid = nsDefaultState().raid
		nsReturnAll(state)
		nsSaveState(state)
		nsApplyPenalty(null)
	}
}

function nsRaidFail(state, mobs) {
	console.info('[nightshift] моб добрался до алтаря — жертвенный набег провален')
	for (var i = 0; i < mobs.length; i++) nsRemoveMob(mobs[i])
	nsRaidEnded()
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	NSG.nsServer.runCommandSilent('weather clear')

	var T = NSG.NIGHTSHIFT_TUNABLES
	state.sacrificeProgress = {} // жертва сгорает — требование плана
	state.curse = Math.min(T.curseMaxHearts, (state.curse || 0) + T.curseHeartsSacrifice) // и проклятие: фаза заблокирована до искупления
	state.raid = nsDefaultState().raid
	state.raid.state = 'cooldown'
	state.raid.countdownRemaining = 20 // секунд паузы перед тем, как алтарь снова примет жертву
	nsReturnAll(state)
	nsSaveState(state)
	nsApplyPenalty(null)

	nsTitleAll('Испытание провалено', { color: 'dark_red', bold: true, subtitle: 'Жертва сгорела, −' + T.curseHeartsSacrifice + ' сердец у всех, алтарь осквернён', subColor: 'gray' })
	nsTellAll(nsCurseLine(state))
	nsTellAll(Text.gray('[Ночная смена] Пока проклятие не искуплено, алтарь не запустит следующую жертву.'))
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
		if (!nsSpawnCurrentWave(state, level, altar)) nsRaidVictory(state)
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
			if (state.raid.kind === 'sacrifice') {
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

	if (mobs.length > 0) {
		state.raid.spawnRetries = 0
		nsWaveBar(state, mobs.length)
		return
	}

	// волна зачищена (или не появилась) — следующая
	if (state.raid.bossSpawned) {
		nsRaidVictory(state)
		return
	}
	if (state.raid.waveSize > 0 && state.raid.spawnRetries === 0) {
		// только что заспавненная волна не нашлась — даём ещё попытку, а не засчитываем
		state.raid.spawnRetries = 1
		nsSaveState(state)
		return
	}
	state.raid.waveIndex++
	state.raid.spawnRetries = 0
	state.raid.waveSize = 0
	if (!nsSpawnCurrentWave(state, level, altar)) {
		nsRaidVictory(state)
		return
	}
	var fresh = nsCollectRaidMobs(level, altar, nsTrackRadius(state))
	if (fresh !== null && fresh.length === 0 && !state.raid.bossSpawned) {
		console.warn('[nightshift] волна ' + (state.raid.waveIndex + 1) + ' не появилась (нет места для спавна?)')
	}
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
function nsCheckMinorRaidSchedule(state) {
	if (state.altars.length === 0) return // алтаря ещё нет — нечего охранять

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
		var cfg = NSG.NIGHTSHIFT_CONFIG.hordes[state.phase]
		state.minorPending = false
		nsSaveState(state)
		if (cfg && cfg.minor && cfg.minor.length) nsStartRaid('minor', state.altars[0].id)
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
			break
		case 'countdown':
			nsTickCountdown(state)
			break
		case 'active':
			nsTickActiveRaid(state)
			break
		case 'cooldown':
			nsTickCooldown(state)
			break
	}
})
