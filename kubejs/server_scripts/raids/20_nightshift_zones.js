// ==========================================================================
// Ночная смена — Разметчик базы: разметка зон, частицы границы,
// запрет естественного спавна монстров внутри зоны.
// ==========================================================================
//
// ПРОВЕРЕНО ПО JAR:
//  - BlockEvents.rightClicked — глобальный TargetedEventHandler (без указания
//    конкретного блока срабатывает на ЛЮБОЙ блок), событие
//    dev.latvian.mods.kubejs.block.BlockRightClickedKubeEvent: есть getItem(),
//    getEntity() (игрок), getBlock() -> LevelBlock (x,y,z,dim), getHand().
//  - EntityEvents.checkSpawn — TargetedEventHandler на основе NeoForge
//    FinalizeSpawnEvent, класс CheckLivingEntitySpawnKubeEvent: есть x,y,z
//    (double, координаты спавна), getType() -> MobSpawnType (NATURAL,
//    CHUNK_GENERATION, SPAWNER, MOB_SUMMONED, COMMAND, BREEDING, ...),
//    setSpawnCancelled(boolean) — событие отменяемое. Строка "checkSpawn"
//    найдена буквально в байткоде как имя метода группы событий.
//
// НЕ ПРОВЕРЕНО (проверить в игре):
//  - Что именно вернёт entity.getType().getCategory().getName() в Rhino —
//    предполагается прямой вызов публичных методов Mojang через reflection
//    (стандартное поведение Rhino/LiveConnect для доступа к методам объектов,
//    возвращённых из враппера), но конкретно в этой сессии не потрогано руками.
//  - Останавливает ли setSpawnCancelled(true) спавн НАШИХ мобов, которых мы
//    сами создаём в 40_nightshift_raid.js. НЕ должно — наши мобы спавнятся
//    через level.spawnEntity(...)/createEntity, что даёт MobSpawnType.COMMAND
//    или MOB_SUMMONED, а не NATURAL/CHUNK_GENERATION, поэтому фильтр по типу
//    их не заденет. Но если после теста окажется, что тип другой — заменить
//    фильтр на explicit allow-list (NATURAL, CHUNK_GENERATION) вместо
//    deny-list, что и сделано ниже (osторожный вариант: разрешаем всё, КРОМЕ
//    явно естественных типов).
// ==========================================================================

// --------------------------------------------------------------------------
// Разметка зоны: два клика ПКМ разметчиком по противоположным углам.
// По умолчанию зона — колонна на всю высоту мира. Если первый клик сделан с
// Shift — зона только между высотами кликов (для подземных аванпостов).
// --------------------------------------------------------------------------
BlockEvents.rightClicked(event => {
	var item = event.getItem()
	if (!item || String(item.id) !== 'nightshift:base_marker') return

	var player = event.getEntity()
	var block = event.getBlock()
	var dim = String(block.getDimension())
	var x = block.getX()
	var y = block.getY()
	var z = block.getZ()

	var state = nsGetState()
	var uuid = String(player.getUsername()) // ключ разметки — имя игрока (getStringUUID в Rhino 2101 недоступен)

	var pending = state.markerCorners[uuid]
	// клиент после клика по блоку досылает «использование предмета» — отсекаем его по тику
	NSG.nsMarkerBlockTick = NSG.nsMarkerBlockTick || {}
	NSG.nsMarkerBlockTick[uuid] = event.server.getTickCount()
	nsMarkerClick(event, state, player, uuid, pending, dim, x, y, z)
	// разметчик не открывает сундуки и не жмёт кнопки; cancel() в 2101 выходит из обработчика — последним
	event.cancel()
})

function nsMarkerClick(event, state, player, uuid, pending, dim, x, y, z) {
	if (!pending) {
		var limited = !!player.isShiftKeyDown()
		state.markerCorners[uuid] = { dim: dim, x: x, y: y, z: z, limitY: limited }
		nsSaveState(state)
		player.tell(
			Text.yellow(
				'[Ночная смена] Первый угол зоны: ' + x + ' ' + y + ' ' + z + (limited ? ' (зона между высотами кликов)' : ' (зона на всю высоту)') + '. Кликните противоположный угол.'
			)
		)
		return
	}

	if (pending.dim !== dim) {
		player.tell(Text.red('[Ночная смена] Второй угол в другом измерении — разметка сброшена.'))
		delete state.markerCorners[uuid]
		nsSaveState(state)
		return
	}

	// по умолчанию зона — колонна на всю высоту мира; с Shift на первом клике —
	// только между высотами кликов (+2 блока над верхним, чтобы пол был внутри)
	var fullHeight = !pending.limitY
	var zone = {
		id: 'zone_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
		dim: dim,
		minX: Math.min(pending.x, x),
		maxX: Math.max(pending.x, x),
		minZ: Math.min(pending.z, z),
		maxZ: Math.max(pending.z, z),
		hasY: !fullHeight,
		minY: fullHeight ? -64 : Math.min(pending.y, y),
		maxY: fullHeight ? 320 : Math.max(pending.y, y) + 2,
		owner: uuid,
	}
	state.zones.push(zone)
	delete state.markerCorners[uuid]
	nsSaveState(state)

	var sizeX = zone.maxX - zone.minX + 1
	var sizeZ = zone.maxZ - zone.minZ + 1
	player.tell(
		Text.green(
			'[Ночная смена] Зона базы создана: ' + sizeX + 'x' + sizeZ + (fullHeight ? ' (на всю высоту)' : ' (Y ' + zone.minY + '..' + zone.maxY + ')') + '. Монстры внутри больше не спавнятся сами.'
		)
	)
}

// Разметчик в воздух: обычный клик — в какой зоне стоишь; с Shift — удалить её.
ItemEvents.rightClicked('nightshift:base_marker', event => {
	var player = event.getEntity()
	var last = NSG.nsMarkerBlockTick ? NSG.nsMarkerBlockTick[String(player.getUsername())] : null
	if (last != null && event.server.getTickCount() - last <= 1) return // это был клик по блоку
	var state = nsGetState()
	var dim = String(player.getLevel().getDimension())
	var px = Math.floor(player.getX()),
		py = Math.floor(player.getY()),
		pz = Math.floor(player.getZ())
	var idx = -1
	for (var i = 0; i < state.zones.length; i++) {
		if (nsPointInZone(state.zones[i], dim, px, py, pz)) {
			idx = i
			break
		}
	}
	var mine = 0
	for (var j = 0; j < state.zones.length; j++) if (state.zones[j].dim === dim) mine++
	if (idx === -1) {
		player.tell(Text.gray('[Ночная смена] Вы не в зоне базы. Зон в этом измерении: ' + mine + '. Отметьте два угла кликом разметчика по блокам.'))
		return
	}
	var zone = state.zones[idx]
	var size = zone.maxX - zone.minX + 1 + 'x' + (zone.maxZ - zone.minZ + 1)
	if (player.isShiftKeyDown()) {
		state.zones.splice(idx, 1)
		nsSaveState(state)
		player.tell(Text.red('[Ночная смена] Зона базы ' + size + ' удалена.'))
		return
	}
	player.tell(Text.green('[Ночная смена] Вы в зоне базы ' + size + '. Shift + клик в воздух — удалить эту зону.'))
})

// --------------------------------------------------------------------------
// Блок базы: ставится только внутри зоны, сверху появляется алтарь.
// Сломали блок базы — алтарь исчезает (сам алтарь неломаемый).
// --------------------------------------------------------------------------
BlockEvents.placed('nightshift:base_core', event => {
	var block = event.getBlock()
	var player = event.getEntity()
	var state = nsGetState()
	var dim = String(block.getDimension())
	var inZone = nsPointInAnyZone(state, dim, block.getX(), block.getY(), block.getZ())
	var above = block.offset(0, 1, 0)
	var free = above.getBlockState().isAir()
	if (inZone && free) {
		above.set('nightshift:altar')
		nsUpsertAltar(state, above) // из 30_nightshift_altar.js — алтарь сразу цель малых набегов
		nsSaveState(state)
		if (player && player.isPlayer()) player.tell(Text.gold('[Ночная смена] Над блоком базы вырос алтарь. ПКМ по нему — прогноз набега и первая жертва.'))
		return
	}
	if (player && player.isPlayer()) {
		if (!inZone) player.tell(Text.red('[Ночная смена] Блок базы ставится только в зоне базы — сначала отметьте её разметчиком.'))
		else player.tell(Text.red('[Ночная смена] Над блоком базы должно быть свободное место для алтаря.'))
	}
	event.cancel()
})

BlockEvents.broken('nightshift:base_core', event => {
	var above = event.getBlock().offset(0, 1, 0)
	if (String(above.getId()) !== 'nightshift:altar') return
	var state = nsGetState()
	var id = 'altar_' + String(above.getDimension()).replace(/[^a-z0-9]/gi, '_') + '_' + above.getX() + '_' + above.getY() + '_' + above.getZ()
	for (var i = state.altars.length - 1; i >= 0; i--) if (state.altars[i].id === id) state.altars.splice(i, 1)
	above.set('minecraft:air')
	// набег у этого алтаря заканчивается: полосы, запрет сна и мобы — вместе с ним
	if (state.raid.altarId === id && nsRaidActive(state)) nsResetRaidIdle(state)
	else nsSaveState(state)
})

// --------------------------------------------------------------------------
// Частицы границы — только пока держишь разметчик в руке. Раз в 10 тиков,
// только для игроков с маркером в руке, только зоны их измерения. Это
// намеренно редкая и адресная операция (не весь мир каждый тик).
// --------------------------------------------------------------------------
var nsZoneParticleCounter = 0

ServerEvents.tick(event => {
	nsZoneParticleCounter++
	if (nsZoneParticleCounter % 10 !== 0) return

	var state = nsGetStateRO()

	// getPlayers() у MinecraftServerKJS (kjs$getPlayers) возвращает EntityArrayList — итерируемо как обычный массив.
	var list = event.server.getPlayers()
	for (var i = 0; i < list.length; i++) {
		var player = list[i]
		var held
		try {
			held = player.getMainHandItem()
		} catch (e) {
			continue
		}
		if (!held || String(held.id) !== 'nightshift:base_marker') continue

		var level = player.getLevel()
		var dim = String(level.getDimension())
		for (var z = 0; z < state.zones.length; z++) {
			var zone = state.zones[z]
			if (zone.dim !== dim) continue
			nsSpawnZoneOutline(level, zone, player)
		}
		// первый угол уже отмечен — светящийся столб на нём, пока не кликнут второй
		var pending = state.markerCorners[String(player.getUsername())]
		if (pending && pending.dim === dim) {
			for (var yy = pending.y + 1; yy <= pending.y + 8; yy++) {
				try {
					level.spawnParticles('minecraft:happy_villager', true, pending.x + 0.5, yy + 0.5, pending.z + 0.5, 0, 0, 0, 1, 0)
				} catch (e) {}
			}
		}
	}
})

// Рисует контур зоны частицами. Зона «на всю высоту» (-64..320) рисуется на уровне
// игрока: две линии периметра (у ног и над головой) и столбы по углам — иначе контур
// уходил на дно мира. Точек на ребро не больше 40; дальние рёбра (>96 блоков) не рисуем.
function nsSpawnZoneOutline(level, zone, player) {
	var particle = NSG.NIGHTSHIFT_TUNABLES.zoneParticleType
	var maxPointsPerEdge = 40
	var py = Math.floor(player.getY())
	var px = player.getX(),
		pz = player.getZ()

	function step(a, b) {
		return Math.max(1, Math.ceil(Math.max(1, Math.abs(b - a)) / maxPointsPerEdge))
	}
	function dot(x, y, zc) {
		var dx = x - px,
			dz = zc - pz
		if (dx * dx + dz * dz > 96 * 96) return
		try {
			level.spawnParticles(particle, true, x, y, zc, 0, 0, 0, 1, 0)
		} catch (e) {
			if (!NSG.nsParticleWarned) {
				console.warn('[nightshift] частицы зоны не рисуются: ' + e)
				NSG.nsParticleWarned = true
			}
		}
	}

	// высоты линий периметра и диапазон столбов
	var lo = zone.hasY ? zone.minY + 1 : py
	var hi = zone.hasY ? zone.maxY + 1 : py + 3
	var ys = [lo, hi]
	var sx = step(zone.minX, zone.maxX)
	var sz = step(zone.minZ, zone.maxZ)
	for (var yi = 0; yi < ys.length; yi++) {
		var y = ys[yi] + 0.1
		for (var x = zone.minX; x <= zone.maxX + 1; x += sx) {
			dot(x, y, zone.minZ)
			dot(x, y, zone.maxZ + 1)
		}
		for (var zc = zone.minZ; zc <= zone.maxZ + 1; zc += sz) {
			dot(zone.minX, y, zc)
			dot(zone.maxX + 1, y, zc)
		}
	}
	var corners = [
		[zone.minX, zone.minZ],
		[zone.minX, zone.maxZ + 1],
		[zone.maxX + 1, zone.minZ],
		[zone.maxX + 1, zone.maxZ + 1],
	]
	var postLo = zone.hasY ? zone.minY : py - 3
	var postHi = zone.hasY ? zone.maxY + 1 : py + 12
	for (var c = 0; c < corners.length; c++) {
		for (var yy = postLo; yy <= postHi; yy += 1) dot(corners[c][0], yy + 0.5, corners[c][1])
	}
}

// --------------------------------------------------------------------------
// Запрет естественного спавна монстров внутри зон базы.
// --------------------------------------------------------------------------
EntityEvents.checkSpawn(event => {
	var spawnType = String(event.getType()) // MobSpawnType enum -> строка вида "NATURAL"

	// Разрешаем спавн-типы, за которые отвечает набег/админ/структуры:
	// COMMAND, MOB_SUMMONED, SPAWNER, EVENT, TRIGGERED, BREEDING, CONVERSION,
	// STRUCTURE. Блокируем только явно "естественные" источники.
	if (spawnType !== 'NATURAL' && spawnType !== 'CHUNK_GENERATION') return

	var category
	try {
		category = String(event.getEntity().getType().getCategory().getName())
	} catch (e) {
		return // не смогли определить категорию — не рискуем блокировать не то
	}
	if (category !== 'monster') return // животных/существ не трогаем, только враждебных

	var state = nsGetStateRO()
	if (state.zones.length === 0) return
	var dim = String(event.getLevel().getDimension())
	// в KubeJS 2101 отмена = запрет спавна (event.cancel() завершает обработчик)
	if (nsPointInAnyZone(state, dim, event.x, event.y, event.z)) event.cancel()
})
