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

// После /reload событие loaded не приходит, а NSG создаётся заново — берём сервер сразу,
// иначе до первого тика команды видели бы пустое состояние.
try {
	NSG.nsServer = Java.loadClass('net.neoforged.neoforge.server.ServerLifecycleHooks').getCurrentServer() || undefined
} catch (e) {
	console.warn('[nightshift] сервер при загрузке скриптов не получен: ' + e)
}

ServerEvents.loaded(event => {
	NSG.nsServer = event.server
	// отложенные действия считаются в тиках сервера, а счётчик после рестарта с нуля — старые ключи убираем
	event.server.persistentData.remove('nightshift_reload_at')
	event.server.persistentData.remove('nightshift_rerender_at')
	nsSyncPhaseFile(event.server)
})

// Фаза мира живёт в persistentData (state.phase), а файл nightshift_phase.json —
// в корне сервера и переживает смену мира. На старте выравниваем файл и стадии
// AStages по миру: новый мир → фаза 0, перенесённый мир → его фаза.
function nsSyncPhaseFile(server) {
	if (NS_OPEN_WORLD) return // открытый мир: стадии ничего не запирают, «фаза» = лучшая пройденная сложность
	var worldPhase = nsGetState().phase
	var filePhase = nightshiftReadPhase()
	if (worldPhase === filePhase) return
	console.warn('[nightshift] файл фазы ' + filePhase + ' ≠ фаза мира ' + worldPhase + ' — выравниваю')
	nightshiftWritePhase(worldPhase) // заранее: тогда whenGranted не зовёт /reload на каждую стадию
	for (var p = 1; p <= 6; p++) server.runCommandSilent('astages server ' + (p <= worldPhase ? 'add' : 'remove') + ' nightshift_p' + p)
	// /reload не внутри загрузки сервера, а через 2 с — из обработчика тиков
	server.persistentData.putLong('nightshift_reload_at', server.getTickCount() + 40)
}

ServerEvents.tick(event => {
	var pd = event.server.persistentData
	if (!pd.contains('nightshift_reload_at') || event.server.getTickCount() < pd.getLong('nightshift_reload_at')) return
	pd.remove('nightshift_reload_at')
	pd.putLong('nightshift_rerender_at', event.server.getTickCount() + 60)
	event.server.runCommandSilent('reload')
})

function nsDefaultState() {
	return {
		phase: 0, // наибольшая пройденная сложность набега (общая на сервер), открыта phase+1
		zones: [], // [{id, dim, minX,minY,minZ,maxX,maxY,maxZ, hasY, owner}]
		altars: [], // [{id, dim, x,y,z, zoneId}]
		raid: {
			state: 'idle', // idle | countdown | active | cooldown
			kind: null, // 'challenge' — выбранная сложность | 'minor' — малый набег
			difficulty: 0,
			altarId: null,
			startedAtTick: 0,
			waveIndex: -1,
			waveStartedAtTick: 0,
			bossSpawned: false,
			countdownRemaining: 0,
			waveSize: 0,
			spawnRetries: 0,
			paused: false,
			trackR: 0, // 0 — радиус поиска по умолчанию (raidTrackRadius)
			reached: 0,
			present: {}, // {имя: волн у алтаря} — добыча тем, кто простоял половину волн
		},
		curse: 0, // проклятие алтаря в сердцах (у всей команды), см. nsApplyPenalty
		tributeProgress: 0, // сколько ресурса искупления уже пришло конвейером в счёт следующей стопки
		wounds: {}, // {имя: раны} — −1 сердце за смерть, лечит Настойка жизни
		bonusHearts: {}, // {имя: n} — +1 сердце максимума за каждое съеденное «Сердце ночи»
		deathSanity: {}, // {имя: {v, dark}} — рассудок в момент смерти (восстанавливается при возрождении)
		returns: {}, // {имя: {dim,x,y,z}} — куда вернуть телепортировавшихся к алтарю после набега
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
		var merged = Object.assign(nsDefaultState(), parsed)
		merged.raid = Object.assign(nsDefaultState().raid, parsed.raid || {}) // новые поля набега — со значениями по умолчанию
		return merged
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

// Квесты «Сложность N пройдена» (глава «Алтарь и набеги») — задачи-стадии FTB Quests,
// а стадия FTB = тег игрока. Выдаём теги nightshift_p1..phase, лишние снимаем.
// player = null — всем онлайн; при входе — только вошедшему.
function nsCompletePhaseQuests(player, phase) {
	var who = player ? String(player.getUsername()) : '@a'
	for (var p = 1; p <= NSG.NIGHTSHIFT_DIFFICULTY_MAX; p++) NSG.nsServer.runCommandSilent('tag ' + who + ' ' + (p <= phase ? 'add' : 'remove') + ' nightshift_p' + p)
}

// Максимальное здоровье: −(проклятие алтаря (общее) + раны игрока, вместе не больше
// penaltyMaxHearts) + «Сердца ночи». Один модификатор nightshift:penalty; при входе,
// возрождении и каждом изменении выставляем заново. player = null — всем онлайн.
function nsApplyPenalty(player) {
	var st = nsGetState()
	var T = NSG.NIGHTSHIFT_TUNABLES
	var list = player ? [player] : NSG.nsServer.getPlayers()
	for (var i = 0; i < list.length; i++) {
		var name = String(list[i].getUsername())
		var hearts = Math.min(T.penaltyMaxHearts, (st.curse || 0) + ((st.wounds || {})[name] || 0))
		hearts -= Math.min(T.bonusHeartsMax, (st.bonusHearts || {})[name] || 0)
		NSG.nsServer.runCommandSilent('execute as ' + name + ' run attribute @s minecraft:generic.max_health modifier remove nightshift:altar_curse')
		NSG.nsServer.runCommandSilent('execute as ' + name + ' run attribute @s minecraft:generic.max_health modifier remove nightshift:penalty')
		if (hearts !== 0) NSG.nsServer.runCommandSilent('execute as ' + name + ' run attribute @s minecraft:generic.max_health modifier add nightshift:penalty ' + -2 * hearts + ' add_value')
	}
}

PlayerEvents.loggedIn(event => {
	var st = nsGetState()
	nsCompletePhaseQuests(event.getPlayer(), st.phase)
	nsApplyPenalty(event.getPlayer())
	nsReturnIfPending(event.getPlayer(), st)
})

// Телепорт к алтарю на время набега: куда вернуть игрока после (state.returns[имя])
function nsReturnPlayer(name, spot) {
	NSG.nsServer.runCommandSilent('execute in ' + spot.dim + ' run tp ' + name + ' ' + spot.x + ' ' + spot.y + ' ' + spot.z)
}

function nsReturnIfPending(player, st) {
	var name = String(player.getUsername())
	if (!st.returns || !st.returns[name] || nsRaidActive(st)) return
	nsReturnPlayer(name, st.returns[name])
	delete st.returns[name]
	nsSaveState(st)
	player.tell(Text.gray('[Ночная смена] Набег закончился — вы вернулись туда, где были.'))
}
