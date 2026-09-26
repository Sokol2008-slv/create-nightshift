// ==========================================================================
// Ночная смена — общее состояние в server.persistentData + утилиты
// ==========================================================================
//
// ПРОВЕРЕНО ПО JAR: dev.latvian.mods.kubejs.core.MinecraftServerKJS реализует
// WithPersistentData (kjs$getPersistentData() -> CompoundTag), значит
// `server.persistentData` в скриптах существует и это обычный NBT CompoundTag.
// EntityKJS и ServerLevelKJS тоже реализуют WithPersistentData — значит у
// сущностей (entity.persistentData) и у уровня (level.persistentData) есть то
// же самое хранилище.
//
// РЕШЕНИЕ ПО ФОРМАТУ: вместо ручной сборки вложенных CompoundTag/ListTag из JS
// (многословно и хрупко в Rhino), храним всё состояние набегов/зон/жертвы как
// ОДНУ строку JSON в server.persistentData под ключом "nightshift_json".
// JSON.stringify/JSON.parse — стандартные глобальные объекты Rhino, всегда
// доступны в KubeJS-скриптах (это НЕ специфика 2101, работает во всех версиях).
// Требование задачи "хранить зоны и алтарь в server.persistentData" этим
// выполняется буквально — просто сериализация через JSON, а не через
// CompoundTag.put/getCompound на каждое поле.
//
// ССЫЛКА НА СЕРВЕР: глобального биндинга вроде "Utils.server" в KubeJS 2101 НЕТ
// (проверено javap — такого поля/класса в jar нет). Стандартный и надёжный
// путь — поймать MinecraftServer один раз в ServerEvents.loaded (у события
// ServerKubeEvent есть public-поле/геттер server, см. ниже) и держать в
// NSG.nsServer. Событие loaded гарантированно отрабатывает раньше любых
// игровых событий (клики, тик, спавн), так что к моменту первого обращения
// NSG.nsServer уже будет заполнен.
// ==========================================================================

ServerEvents.loaded(event => {
	NSG.nsServer = event.server
	nsSyncPhaseFile(event.server)
})

// Фаза мира живёт в persistentData (state.phase), а файл nightshift_phase.json —
// в корне сервера и переживает смену мира. На старте выравниваем файл и стадии
// AStages по миру: новый мир → фаза 0, перенесённый мир → его фаза.
function nsSyncPhaseFile(server) {
	var worldPhase = nsGetState().phase
	var filePhase = nightshiftReadPhase()
	if (worldPhase === filePhase) return
	console.warn('[nightshift] файл фазы ' + filePhase + ' ≠ фаза мира ' + worldPhase + ' — выравниваю')
	nightshiftWritePhase(worldPhase) // заранее: тогда whenGranted не зовёт /reload на каждую стадию
	for (var p = 1; p <= 6; p++) server.runCommandSilent('astages server ' + (p <= worldPhase ? 'add' : 'remove') + ' nightshift_p' + p)
	server.runCommandSilent('reload')
}

function nsDefaultState() {
	return {
		phase: 0, // текущая открытая фаза (общая на сервер)
		zones: [], // [{id, dim, minX,minY,minZ,maxX,maxY,maxZ, hasY, owner}]
		altars: [], // [{id, dim, x,y,z, zoneId}]
		sacrificeProgress: {}, // {itemId: count} — прогресс к СЛЕДУЮЩЕЙ фазе
		manualSacrificeDone: false, // для P0->P1 (ручная жертва разовая по флагу)
		raid: {
			state: 'idle', // idle | countdown | active | cooldown
			kind: null, // 'sacrifice' | 'minor'
			altarId: null,
			startedAtTick: 0,
			waveIndex: -1,
			waveStartedAtTick: 0,
			bossSpawned: false,
			countdownRemaining: 0,
		},
		dayCounter: 0, // ночей с последнего малого набега
		lastSeenDay: -1, // для детекта смены дня
		markerCorners: {}, // {playerUuid: {dim,x,y,z}}
	}
}

function nsGetState() {
	var server = NSG.nsServer
	if (!server) return nsDefaultState()
	var tag = server.persistentData
	if (!tag.contains('nightshift_json')) {
		return nsDefaultState()
	}
	try {
		var parsed = JSON.parse(tag.getString('nightshift_json'))
		// подстраховка на случай, если структура полей неполная (после правок конфига)
		return Object.assign(nsDefaultState(), parsed)
	} catch (e) {
		console.warn('[nightshift] Битый JSON в persistentData, сбрасываю состояние: ' + e)
		return nsDefaultState()
	}
}

// Чтение без изменений для частых проверок (спавн мобов, частицы зон): JSON
// разбираем заново только когда строка в persistentData поменялась.
// Возвращённый объект НЕЛЬЗЯ менять и сохранять — для этого есть nsGetState().
function nsGetStateRO() {
	var server = NSG.nsServer
	if (!server) return nsDefaultState()
	var tag = server.persistentData
	var raw = tag.contains('nightshift_json') ? String(tag.getString('nightshift_json')) : ''
	if (NSG.nsRoState && NSG.nsRoRaw === raw) return NSG.nsRoState
	NSG.nsRoRaw = raw
	NSG.nsRoState = raw ? nsGetState() : nsDefaultState()
	return NSG.nsRoState
}

// Орда жертвенного набега при выходе из фазы p (таблица PLAN.md §8): hordes[p],
// из P0 — «крошечный набег». Финальная жертва (P5→P6) — Великая орда:
// волны P5, затем волны планет и босс.
function nsSacrificeHorde(p) {
	var H = NSG.NIGHTSHIFT_CONFIG.hordes
	var target = NSG.NIGHTSHIFT_CONFIG.sacrifices[p + 1]
	if (target && target.isFinal) {
		var a = H[p] || { waves: [] }
		var b = H[p + 1] || { waves: [] }
		return { waves: a.waves.concat(b.waves), boss: b.boss || null }
	}
	return H[p] ? { waves: H[p].waves, boss: null } : null
}

function nsSaveState(state) {
	var server = NSG.nsServer
	if (!server) return
	server.persistentData.putString('nightshift_json', JSON.stringify(state))
}

// --------------------------------------------------------------------------
// Геометрия зон
// --------------------------------------------------------------------------

// Возвращает true, если точка (x,y,z) в измерении dim попадает в зону базы.
// Зона без Y (hasY=false) считается бесконечной колонной по X/Z (как просил план:
// "на всю высоту или с Y").
function nsPointInZone(zone, dim, x, y, z) {
	if (zone.dim !== dim) return false
	if (x < zone.minX || x > zone.maxX) return false
	if (z < zone.minZ || z > zone.maxZ) return false
	if (zone.hasY) {
		if (y < zone.minY || y > zone.maxY) return false
	}
	return true
}

function nsPointInAnyZone(state, dim, x, y, z) {
	for (var i = 0; i < state.zones.length; i++) {
		if (nsPointInZone(state.zones[i], dim, x, y, z)) return true
	}
	return false
}

// --------------------------------------------------------------------------
// Проверка "защищённости" блока от грызения ордой (используется в 40_raid.js)
// --------------------------------------------------------------------------
function nsIsBlockProtected(levelBlock) {
	try {
		// Блок с блок-сущностью — НИКОГДА не трогаем (сундуки, машины, валы и т.п.)
		if (levelBlock.getEntity() != null) return true
		var blockId = levelBlock.getBlockState().getBlock().id // "modid:path", подтверждено BlockProviderKJS.kjs$getId()
		var ns = String(blockId).split(':')[0]
		if (NSG.NIGHTSHIFT_PROTECTED_NAMESPACES.indexOf(ns) !== -1) return true
		return false
	} catch (e) {
		// Если что-то пошло не так при проверке — лучше перестраховаться и НЕ ломать блок.
		console.warn('[nightshift] Ошибка проверки защиты блока, пропускаю: ' + e)
		return true
	}
}

// Приблизительное "время грызения" в тиках для блока, исходя из hardness.
function nsChewTicksForBlock(levelBlock) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	var hardness = 1.5
	try {
		// BlockState#getDestroySpeed(level, pos) — публичный метод Mojang, должен
		// быть доступен через прямой вызов на "сыром" Java-объекте BlockState.
		// НЕ ПРОВЕРЕНО в этой сессии на реальном сервере — обернуто в try/catch.
		hardness = levelBlock.getBlockState().getDestroySpeed(levelBlock.getLevel(), levelBlock.getPos())
		if (hardness < 0) return -1 // "неразрушаемый" (bedrock и т.п.) — не грызём вовсе
	} catch (e) {
		console.warn('[nightshift] Не удалось получить hardness блока, использую значение по умолчанию: ' + e)
	}
	var ticks = Math.round(hardness * T.chewTicksPerHardness)
	return Math.max(T.chewTicksMin, Math.min(T.chewTicksMax, ticks))
}

// --------------------------------------------------------------------------
// Заголовки/бордбар/команды — через server.runCommandSilent, т.к. у
// PlayerKJS/ServerPlayerKJS НЕТ отдельных методов title()/bossbar() (проверено
// javap: их просто нет в интерфейсе). Команды /title и /bossbar — штатные,
// это самый надёжный путь в любой версии KubeJS.
// --------------------------------------------------------------------------
function nsTitleAll(text, opts) {
	opts = opts || {}
	var json = JSON.stringify({ text: text, color: opts.color || 'red', bold: !!opts.bold })
	NSG.nsServer.runCommandSilent('title @a title ' + json)
	if (opts.subtitle) {
		var sub = JSON.stringify({ text: opts.subtitle, color: opts.subColor || 'gray' })
		NSG.nsServer.runCommandSilent('title @a subtitle ' + sub)
	}
}

function nsActionBarAll(text, color) {
	var json = JSON.stringify({ text: text, color: color || 'yellow' })
	NSG.nsServer.runCommandSilent('title @a actionbar ' + json)
}

function nsBossbarCreate(id, name, color) {
	NSG.nsServer.runCommandSilent('bossbar add ' + id + ' ' + JSON.stringify({ text: name }))
	NSG.nsServer.runCommandSilent('bossbar set ' + id + ' players @a')
	NSG.nsServer.runCommandSilent('bossbar set ' + id + ' color ' + (color || 'red'))
	NSG.nsServer.runCommandSilent('bossbar set ' + id + ' visible true')
}

function nsBossbarMax(id, max) {
	NSG.nsServer.runCommandSilent('bossbar set ' + id + ' max ' + max)
}

function nsBossbarValue(id, value) {
	NSG.nsServer.runCommandSilent('bossbar set ' + id + ' value ' + value)
}

function nsBossbarRemove(id) {
	NSG.nsServer.runCommandSilent('bossbar remove ' + id)
}

// --------------------------------------------------------------------------
// grantPhase — обёртка выдачи стадии AStages. Точный синтаксис команды
// уточняет параллельный агент, отвечающий за интеграцию AStages (см. задачу
// про фазы в PLAN.md §1). Пока — заглушка с логированием и TODO.
// --------------------------------------------------------------------------
function grantPhase(n) {
	// Фаза = server-scope стадия AStages nightshift_pN. Остальное (файл фазы,
	// /reload рецептов, перерисовка мира у клиентов) делает whenGranted в
	// kubejs/server_scripts/nightshift/00_stages.js.
	try {
		NSG.nsServer.runCommandSilent('astages server add nightshift_p' + n)
	} catch (e) {
		console.error('[nightshift] grantPhase(' + n + '): ' + e)
	}
	var state = nsGetState()
	state.phase = n
	state.sacrificeProgress = {}
	state.manualSacrificeDone = false
	nsSaveState(state)
	nsCompletePhaseQuests(null, n)
}

// Квесты «Фаза N открыта» (глава «Алтарь и фазы») закрываются скриптом.
// player = null — всем онлайн; при входе — только вошедшему.
function nsCompletePhaseQuests(player, phase) {
	if (typeof NS_PHASE_QUESTS === 'undefined') return
	var who = player ? String(player.getUsername()) : '@a'
	for (var p = 1; p <= phase; p++) {
		if (NS_PHASE_QUESTS[p]) NSG.nsServer.runCommandSilent('ftbquests change_progress ' + who + ' complete ' + NS_PHASE_QUESTS[p])
	}
}

PlayerEvents.loggedIn(event => {
	var phase = nsGetState().phase
	if (phase > 0) nsCompletePhaseQuests(event.getPlayer(), phase)
})
