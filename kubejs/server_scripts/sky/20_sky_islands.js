// ==========================================================================
// Небо — НЕБЕСНЫЕ ОСТРОВА (04.10.2026). Структура nightshift:sky_island (датапак kubejs/data/nightshift/worldgen):
// в небе Верхнего мира, низ острова на y 190–215, верх построек до ~245; примерно один на 600–1000 блоков.
// Три вида (шаблоны — tools/gen_sky.py): руины станции Axiomativ, разбитый дирижабль, гнездо стрекоз.
// Там: друзы небесного кристалла (кирка), сундуки и бочки с добычей (nightshift:chests/sky_*), турель станции.
//
// Охрана: в каждом шаблоне — маркер (minecraft:marker, тег ns_sky_island). Раз в 2 с ищем маркеры рядом с игроками
// выше y 150: подлетел ближе 56 блоков — остров «просыпается», выпускает летунов (стрекозы, шершни, саранча ArPhEx).
// Не копятся: новая стая — только когда прежней нет и прошло 5 минут; никого ближе 128 блоков — стая уходит.
// Команды (оператор): /nssky find — ближайший остров; /nssky scan [x z] — что в нём; /nssky wake <x> <y> <z> —
// разбудить остров, как будто там игрок (проверка без клиента).
// ==========================================================================

var NS_SKY_ISL = {
	minY: 150, // ниже — игрок на земле, острова не будим
	wakeR: 56,
	leaveR: 128,
	restTicks: 6000, // 5 минут между стаями одного острова
	names: { station: 'руины станции Axiomativ', airship: 'разбитый дирижабль', nest: 'гнездо стрекоз' },
}

function nsSkyIslKind(mk) {
	var tg = mk.getTags()
	if (tg.contains('ns_isl_station')) return 'station'
	if (tg.contains('ns_isl_airship')) return 'airship'
	return 'nest'
}
function nsSkyIslId(mk) {
	return String(mk.getStringUuid()).substring(0, 8)
}

// Стая по виду острова и силе команды (пройденные волны)
function nsSkyIslWave(kind, phase) {
	var late = phase >= 30
	if (kind === 'nest') return late ? ['arphex:dragonfly_dreadnought', 'arphex:dragonfly_dreadnought', 'arphex:dragonfly_dreadnought', 'arphex:locust_landscourge', 'arphex:locust_landscourge', 'arphex:locust_landscourge'] : phase >= 16 ? ['arphex:dragonfly_dreadnought', 'arphex:dragonfly_dreadnought', 'arphex:locust_landscourge', 'arphex:locust_landscourge', 'arphex:locust_landscourge'] : ['arphex:dragonfly_dreadnought', 'arphex:locust_landscourge', 'arphex:locust_landscourge', 'arphex:locust_landscourge']
	if (kind === 'station') return late ? ['arphex:hornet_harbinger_giant', 'arphex:hornet_harbinger_giant', 'arphex:hornet_harbinger_giant', 'arphex:dragonfly_dreadnought'] : ['arphex:hornet_harbinger_giant', 'arphex:hornet_harbinger_giant', 'arphex:dragonfly_dreadnought']
	return late ? ['arphex:hornet_harbinger_giant', 'arphex:hornet_harbinger_giant', 'arphex:locust_landscourge', 'arphex:locust_landscourge', 'arphex:dragonfly_dreadnought'] : ['arphex:hornet_harbinger_giant', 'arphex:locust_landscourge', 'arphex:locust_landscourge', 'arphex:locust_landscourge']
}

function nsSkyIslGuards(level, mk, r) {
	var out = []
	var tag = 'ns_isl_' + nsSkyIslId(mk)
	try {
		var list = level.getEntitiesWithin(new NS_SKY_AABB(mk.getX() - r, mk.getY() - r, mk.getZ() - r, mk.getX() + r, mk.getY() + r, mk.getZ() + r))
		for (var i = 0; i < list.size(); i++) {
			var e = list.get(i)
			try {
				if (e.isAlive() && e.getTags().contains(tag)) out.push(e)
			} catch (x) {}
		}
	} catch (e2) {}
	return out
}

// Игрок (или точка проверки) рядом с маркером: первое посещение — объявление; стая, если пора
function nsSkyIslVisit(level, mk, who, wx, wy, wz) {
	var dx = mk.getX() - wx,
		dy = mk.getY() - wy,
		dz = mk.getZ() - wz
	if (dx * dx + dy * dy + dz * dz > NS_SKY_ISL.wakeR * NS_SKY_ISL.wakeR) return false
	var pd = mk.persistentData
	var kind = nsSkyIslKind(mk)
	if (!pd.getBoolean('ns_seen')) {
		pd.putBoolean('ns_seen', true)
		nsTellAllSky(Text.aqua('[Небо] ').append(Text.white((who || 'Кто-то') + ' нашёл небесный остров: ' + NS_SKY_ISL.names[kind] + ' ')).append(Text.yellow(Math.round(mk.getX()) + ' ' + Math.round(mk.getY()) + ' ' + Math.round(mk.getZ()))))
	}
	var now = nsSkyNow(level)
	if (now < Number(pd.getLong('ns_rest'))) return false
	if (nsSkyIslGuards(level, mk, 96).length > 0) return false
	var phase = nsGetStateRO().phase || 0
	var wave = nsSkyIslWave(kind, phase)
	var id = nsSkyIslId(mk)
	var tags = '["ns_sky_guard","ns_isl_guard","ns_isl_' + id + '"]'
	for (var i = 0; i < wave.length; i++) {
		var a = Math.random() * Math.PI * 2
		var r = 10 + Math.random() * 8
		var x = (mk.getX() + Math.cos(a) * r).toFixed(1),
			z = (mk.getZ() + Math.sin(a) * r).toFixed(1)
		var y = (mk.getY() + 4 + Math.random() * 8).toFixed(1)
		nsSkyCmd('summon ' + wave[i] + ' ' + x + ' ' + y + ' ' + z + ' {Tags:' + tags + ',PersistenceRequired:1b}')
	}
	var sel = '@e[tag=ns_isl_' + id + ',tag=!ns_sky_boosted]'
	var hp = 0.1 + 0.02 * phase
	nsSkyCmd('execute as ' + sel + ' run attribute @s minecraft:generic.max_health modifier add nightshift:sky_island ' + hp.toFixed(3) + ' add_multiplied_base')
	nsSkyCmd('execute as ' + sel + ' run attribute @s minecraft:generic.follow_range base set 48')
	nsSkyCmd('execute as ' + sel + ' run data modify entity @s Health set value 100000f')
	// дом стаи — чтобы вернуть далеко улетевших
	nsSkyCmd('execute as ' + sel + ' run data modify entity @s NeoForgeData.ns_home set value [' + Math.round(mk.getX()) + 'd,' + Math.round(mk.getY()) + 'd,' + Math.round(mk.getZ()) + 'd]')
	nsSkyCmd('tag ' + sel + ' add ns_sky_boosted')
	pd.putLong('ns_rest', now + NS_SKY_ISL.restTicks)
	nsSkyCmd('playsound minecraft:entity.phantom.swoop hostile @a ' + Math.round(mk.getX()) + ' ' + Math.round(mk.getY()) + ' ' + Math.round(mk.getZ()) + ' 4 0.6')
	if (who) NSG.nsServer.runCommandSilent('title ' + who + ' actionbar ' + JSON.stringify({ text: 'Небесный остров проснулся: ' + NS_SKY_ISL.names[kind] + ' — летуны!', color: 'aqua' }))
	console.info('[sky] остров ' + kind + ' ' + id + ' (' + Math.round(mk.getX()) + ' ' + Math.round(mk.getY()) + ' ' + Math.round(mk.getZ()) + '): стая ' + wave.length + (who ? ' (' + who + ')' : ''))
	return true
}

function nsSkyIslMarkersNear(level, x, y, z, r) {
	var out = []
	try {
		var list = level.getEntitiesWithin(new NS_SKY_AABB(x - r, y - r, z - r, x + r, y + r, z + r))
		for (var i = 0; i < list.size(); i++) {
			var e = list.get(i)
			try {
				if (String(e.getType()) === 'minecraft:marker' && e.getTags().contains('ns_sky_island')) out.push(e)
			} catch (x2) {}
		}
	} catch (e2) {}
	return out
}

// Стая без игроков рядом — уходит; улетевшие далеко от острова — назад. Раз в 30 с по всем загруженным сущностям.
function nsSkyIslCleanup(level) {
	var ps = nsSkyOverworldPlayers()
	var it
	try {
		it = level.getAllEntities().iterator()
	} catch (e) {
		return
	}
	var gone = 0
	while (it.hasNext()) {
		var e = it.next()
		try {
			if (!e.isAlive() || !e.getTags().contains('ns_isl_guard')) continue
			var near = false
			for (var i = 0; i < ps.length && !near; i++) {
				var dx = ps[i].getX() - e.getX(),
					dz = ps[i].getZ() - e.getZ()
				near = dx * dx + dz * dz <= NS_SKY_ISL.leaveR * NS_SKY_ISL.leaveR
			}
			if (!near) {
				nsSkyDiscard(e)
				gone++
				continue
			}
			var home = e.persistentData.get('ns_home')
			if (home && home.size() === 3) {
				var hx = Number(home.getDouble(0)),
					hy = Number(home.getDouble(1)),
					hz = Number(home.getDouble(2))
				var fx = e.getX() - hx,
					fz = e.getZ() - hz
				if (fx * fx + fz * fz > 80 * 80) e.teleportTo(hx + 0.5, hy + 8, hz + 0.5)
			}
		} catch (x) {}
	}
	if (gone) console.info('[sky] стая острова ушла (игроков рядом нет): ' + gone)
}

NSG.nsSkyIslCounter = 0
ServerEvents.tick(event => {
	NSG.nsSkyIslCounter++
	if (NSG.nsSkyIslCounter % 40 !== 0 || !NSG.nsServer) return
	try {
		var level = nsSkyLevel()
		var ps = nsSkyOverworldPlayers()
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i]
			if (p.getY() < NS_SKY_ISL.minY) continue
			var mks = nsSkyIslMarkersNear(level, p.getX(), p.getY(), p.getZ(), 80)
			for (var k = 0; k < mks.length; k++) nsSkyIslVisit(level, mks[k], nsSkyName(p), p.getX(), p.getY(), p.getZ())
		}
		if (NSG.nsSkyIslCounter % 600 === 0) nsSkyIslCleanup(level)
	} catch (e) {
		console.error('[sky] тик островов: ' + e)
	}
})

// --------------------------------------------------------------------------
// Летуны неба (стража метеорита и островов, турель станции) друг друга не трогают — как мобы набега (07_)
// Нативные обработчики: тело в try/catch (исключение роняет сервер).
// --------------------------------------------------------------------------
var NS_SKY_TARGET_EV = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingChangeTargetEvent')
var NS_SKY_DAMAGE_EV = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
function nsSkyIsGuard(e) {
	try {
		return e != null && e.getTags().contains('ns_sky_guard')
	} catch (x) {
		return false
	}
}
NativeEvents.onEvent(NS_SKY_TARGET_EV, function (event) {
	try {
		var t = event.getNewAboutToBeSetTarget()
		if (t != null && nsSkyIsGuard(t) && nsSkyIsGuard(event.getEntity())) event.setCanceled(true)
	} catch (x) {}
})
NativeEvents.onEvent(NS_SKY_DAMAGE_EV, function (event) {
	try {
		var victim = event.getEntity()
		if (!nsSkyIsGuard(victim)) return
		var by = typeof nsNfAttacker === 'function' ? nsNfAttacker(event.getSource()) : null
		if (by != null && by !== victim && nsSkyIsGuard(by)) event.setCanceled(true)
	} catch (x) {}
})

// --------------------------------------------------------------------------
// Команды оператора
// --------------------------------------------------------------------------
function nsSkyIslFind(level, x, z) {
	try {
		var TagKey = Java.loadClass('net.minecraft.tags.TagKey')
		var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
		var RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
		var BlockPos = Java.loadClass('net.minecraft.core.BlockPos')
		var tag = TagKey.create(Registries.STRUCTURE, RL.parse('nightshift:sky_islands'))
		return level.findNearestMapStructure(tag, new BlockPos(x, 200, z), 100, false)
	} catch (e) {
		console.warn('[sky] поиск острова: ' + e)
		return null
	}
}

// Загрузить чанки острова и пересчитать, что в нём: маркер, сундуки, друзы
function nsSkyIslScan(ctx, x, z) {
	var level = nsSkyLevel()
	var r = 24
	for (var cx = (x - r) >> 4; cx <= (x + r) >> 4; cx++) for (var cz = (z - r) >> 4; cz <= (z + r) >> 4; cz++) level.getChunk(cx, cz)
	var chests = [],
		crystals = 0,
		minY = 999,
		maxY = -999
	for (var bx = (x - r) >> 4; bx <= (x + r) >> 4; bx++) {
		for (var bz = (z - r) >> 4; bz <= (z + r) >> 4; bz++) {
			var it = level.getChunk(bx, bz).getBlockEntities().values().iterator()
			while (it.hasNext()) {
				var be = it.next()
				var p = be.getBlockPos()
				var bid = String(be.getBlockState().getBlock().id)
				if (p.getY() < 150 || (bid.indexOf('chest') < 0 && bid.indexOf('barrel') < 0)) continue
				var nbt = be.saveWithFullMetadata(level.registryAccess())
				chests.push(String(be.getBlockState().getBlock().id).replace('minecraft:', '') + '@' + p.getX() + ',' + p.getY() + ',' + p.getZ() + (nbt.contains('LootTable') ? '→' + nbt.getString('LootTable') : ' (уже открыт)'))
			}
		}
	}
	for (var dx = -r; dx <= r; dx++) {
		for (var dz = -r; dz <= r; dz++) {
			for (var y = 175; y < 270; y++) {
				var id = String(level.getBlock(x + dx, y, z + dz).getId())
				if (id === 'minecraft:air') continue
				if (y < minY) minY = y
				if (y > maxY) maxY = y
				if (id === 'nightshift:sky_crystal_cluster') crystals++
			}
		}
	}
	var mks = nsSkyIslMarkersNear(level, x, 215, z, 60)
	var kinds = []
	for (var i = 0; i < mks.length; i++) kinds.push(nsSkyIslKind(mks[i]) + '@' + Math.round(mks[i].getX()) + ',' + Math.round(mks[i].getY()) + ',' + Math.round(mks[i].getZ()))
	nsSkyReply(ctx, 'остров у ' + x + ' ' + z + ': блоки y ' + minY + '–' + maxY + ', маркеры ' + (kinds.join('; ') || 'нет') + ', друз ' + crystals)
	nsSkyReply(ctx, 'хранилища: ' + (chests.join('; ') || 'нет'))
	var turrets = 0
	var ents = level.getEntitiesWithin(new NS_SKY_AABB(x - r, 150, z - r, x + r, 300, z + r))
	for (var e = 0; e < ents.size(); e++) if (ents.get(e).getTags().contains('ns_sky_turret')) turrets++
	nsSkyReply(ctx, 'турелей-шалкеров: ' + turrets)
	return 1
}

function nsSkyIslFindCmd(ctx, scan) {
	var pos = ctx.source.getPosition()
	var res = nsSkyIslFind(nsSkyLevel(), Math.floor(pos.x()), Math.floor(pos.z()))
	if (!res) {
		nsSkyReply(ctx, 'небесных островов рядом нет')
		return 0
	}
	var bp = res.getFirst ? res.getFirst() : res // 1.21.1: ServerLevel.findNearestMapStructure отдаёт BlockPos
	if (scan) return nsSkyIslScan(ctx, bp.getX(), bp.getZ())
	var dx = bp.getX() - pos.x(),
		dz = bp.getZ() - pos.z()
	nsSkyReply(ctx, 'ближайший небесный остров: ' + bp.getX() + ' ' + bp.getZ() + ' (' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл.)')
	return 1
}

function nsSkyIslWakeCmd(ctx, x, y, z) {
	var level = nsSkyLevel()
	var mks = nsSkyIslMarkersNear(level, x, y, z, 80)
	if (!mks.length) {
		nsSkyReply(ctx, 'маркеров острова рядом нет (чанк загружен?)')
		return 0
	}
	var woke = 0
	for (var i = 0; i < mks.length; i++) if (nsSkyIslVisit(level, mks[i], null, x, y, z)) woke++
	var n = 0
	for (var j = 0; j < mks.length; j++) n += nsSkyIslGuards(level, mks[j], 96).length
	nsSkyReply(ctx, 'маркеров ' + mks.length + ', проснулось ' + woke + ', летунов у острова ' + n)
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	var I = Arguments.INTEGER
	event.register(
		Commands.literal('nssky')
			.requires(src => src.hasPermission(2))
			.then(Commands.literal('find').executes(ctx => nsSkyTry(ctx, () => nsSkyIslFindCmd(ctx, false))))
			.then(
				Commands.literal('scan')
					.executes(ctx => nsSkyTry(ctx, () => nsSkyIslFindCmd(ctx, true)))
					.then(Commands.argument('x', I.create(event)).then(Commands.argument('z', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyIslScan(ctx, Number(I.getResult(ctx, 'x')), Number(I.getResult(ctx, 'z')))))))
			)
			.then(
				Commands.literal('wake').then(
					Commands.argument('x', I.create(event)).then(
						Commands.argument('y', I.create(event)).then(Commands.argument('z', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyIslWakeCmd(ctx, Number(I.getResult(ctx, 'x')), Number(I.getResult(ctx, 'y')), Number(I.getResult(ctx, 'z'))))))
					)
				)
			)
	)
})
