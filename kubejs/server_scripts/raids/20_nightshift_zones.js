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
// Если игрок кликает, приседая (isShiftKeyDown) — зона растягивается на всю
// высоту мира (-64..320 для 1.21), а не только между Y кликов.
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
	var uuid = player.getStringUUID() // публичный метод Entity, прямой вызов через Rhino

	var pending = state.markerCorners[uuid]

	if (!pending) {
		state.markerCorners[uuid] = { dim: dim, x: x, y: y, z: z, fullHeight: !!player.isShiftKeyDown() }
		nsSaveState(state)
		player.tell(Text.yellow('[Ночная смена] Первый угол зоны отмечен: ' + x + ' ' + y + ' ' + z + '. Кликните противоположный угол.'))
		return
	}

	if (pending.dim !== dim) {
		player.tell(Text.red('[Ночная смена] Второй угол в другом измерении — разметка сброшена.'))
		delete state.markerCorners[uuid]
		nsSaveState(state)
		return
	}

	var fullHeight = pending.fullHeight || !!player.isShiftKeyDown()
	var zone = {
		id: 'zone_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
		dim: dim,
		minX: Math.min(pending.x, x),
		maxX: Math.max(pending.x, x),
		minZ: Math.min(pending.z, z),
		maxZ: Math.max(pending.z, z),
		hasY: !fullHeight,
		minY: fullHeight ? -64 : Math.min(pending.y, y),
		maxY: fullHeight ? 320 : Math.max(pending.y, y),
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
	if (state.zones.length === 0) return

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
			nsSpawnZoneOutline(level, zone)
		}
	}
})

// Рисует контур AABB частицами. Ограничиваем число точек на ребро, чтобы не
// заваливать сервер частицами на огромных зонах (базы "без ограничения размера").
function nsSpawnZoneOutline(level, zone) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var particle = T.zoneParticleType
	var maxPointsPerEdge = 40 // ограничение частиц на ребро — крупные зоны получат более редкий пунктир

	var yTop = zone.hasY ? zone.maxY : zone.minY + 1 // если "вся высота" — не рисуем от -64 до 320, это уродливо и дорого; берём только нижний контур
	var showBothY = zone.hasY

	function step(a, b) {
		var len = Math.max(1, Math.abs(b - a))
		return Math.max(1, Math.ceil(len / maxPointsPerEdge))
	}

	function corner(x, y, zc) {
		try {
			level.spawnParticles(particle, false, x, y, zc, 0, 0, 0, 1, 0)
		} catch (e) {
			// первый вызов после старта сервера — залогируем один раз через флаг, не спамим
			if (!NSG.nsParticleWarned) {
				console.warn('[nightshift] level.spawnParticles не сработал ожидаемым образом: ' + e)
				NSG.nsParticleWarned = true
			}
		}
	}

	var sx = step(zone.minX, zone.maxX)
	var sz = step(zone.minZ, zone.maxZ)

	// нижний периметр (и верхний, если высота задана явно)
	var ys = showBothY ? [zone.minY, zone.maxY] : [zone.minY]
	for (var yi = 0; yi < ys.length; yi++) {
		var y = ys[yi]
		for (var x = zone.minX; x <= zone.maxX; x += sx) corner(x + 0.5, y, zone.minZ + 0.5)
		for (var x = zone.minX; x <= zone.maxX; x += sx) corner(x + 0.5, y, zone.maxZ + 0.5)
		for (var zc = zone.minZ; zc <= zone.maxZ; zc += sz) corner(zone.minX + 0.5, y, zc + 0.5)
		for (var zc = zone.minZ; zc <= zone.maxZ; zc += sz) corner(zone.maxX + 0.5, y, zc + 0.5)
	}
	// 4 вертикальных ребра — только если высота задана явно (иначе некрасиво тянуть от -64 до 320)
	if (showBothY) {
		var sy = step(zone.minY, zone.maxY)
		var corners = [
			[zone.minX, zone.minZ],
			[zone.minX, zone.maxZ],
			[zone.maxX, zone.minZ],
			[zone.maxX, zone.maxZ],
		]
		for (var c = 0; c < corners.length; c++) {
			for (var y = zone.minY; y <= zone.maxY; y += sy) {
				corner(corners[c][0] + 0.5, y, corners[c][1] + 0.5)
			}
		}
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
