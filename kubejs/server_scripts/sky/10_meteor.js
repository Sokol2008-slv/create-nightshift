// ==========================================================================
// Небо — событие «МЕТЕОРИТ» (04.10.2026; Георгий: «чтобы был кооперативный, а не кто первый», «чтобы не падал на наши
// строения»). Метеоритное железо добывается только полётом: самолёт — инструмент, а не игрушка.
//
//  - Когда: раз в 2–3 игровых дня, днём (не ночью набега, не во время набега, не в ночь малого набега), с пройденной
//    волны NS_SKY.minPhase. После победы в набеге (выбранной волны) — шанс на внеочередной: утром.
//  - Где: 400–900 блоков от алтаря базы (если алтарей несколько — от случайного), только Верхний мир.
//    Точка вне зон баз (+64) и дальше 200 от любого алтаря; в радиусе 16 поверхность — только природные блоки
//    (камень, земля, песок, листва, брёвна в коре, природные блоки модов), ни одной блок-сущности (сундуки, машины
//    Create, печи…) и ни одной «вещи» (самолёт, рамки, стойки, вагонетки, штуковины Create); объём чаши — только
//    природа и без воды/лавы (иначе затопит). Иначе — другая точка. Кратер ломает только природные блоки.
//    Чанки кандидата грузятся тикетом forceload в фоне, проверка — когда загрузились (сервер не замирает).
//  - Падение: огненный болид с неба (частицы), удар, кратер с метеоритной рудой в центре и обломками. Всем — титр,
//    в чате расстояние и направление от каждого, координаты и путевая точка Xaero (кликабельная строка).
//    Над кратером столб частиц (видно до 512 блоков), полоса «Метеорит остывает» и подсказка над хотбаром в пути.
//  - Остывание: 20 минут (на время набега — пауза). Потом руда тускнеет в камень, магма — в чернокамень.
//  - Стража: мобы из пула набегов команды (наземные и летуны), крепче с пройденной волной, одна «звезда» — Страж
//    метеорита. Встаёт, когда игрок подлетает (72 блока). Пока стража жива — руда под щитом (не ломается).
//  - Кооператив: ломает один — долю (2–3 метеоритного железа с блока) получает КАЖДЫЙ игрок в 32 блоках от кратера.
// Переработка — sky/30_sky_recipes.js. Блоки — startup_scripts/sky/10_sky_blocks.js.
// Команды (оператор): /nsmeteor now [сек остывания] | at <x> <z> | status | cool <сек> | end | check <x> <z> |
//   guards | testbreak  (testbreak — проверка дележа без клиента: двое ботов-FakePlayer у кратера, один ломает руду).
// Состояние — server.persistentData «ns_sky_json» (своё, не трогает состояние набегов).
// ==========================================================================

var NS_SKY = {
	minPhase: 10, // естественный график — с этой пройденной волны (админ-команда — всегда)
	everyDays: [2, 3], // раз в 2–3 игровых дня
	bonusChance: 0.4, // после победы в набеге выбранной волны — внеочередной метеорит утром
	dayFrom: 1000, // падает только днём: время суток 1000–9000
	dayTo: 9000,
	distMin: 400, // от алтаря базы
	distMax: 900,
	altarClear: 200, // не ближе к любому алтарю
	zoneClear: 64, // не ближе к зоне базы
	checkR: 16, // поверхность без построек в этом радиусе
	beR: 16, // ни одной блок-сущности и «вещи» в этом радиусе (и столько чанков грузим на проверку)
	craterR: 6,
	coolSec: 1200, // 20 минут
	shareR: 32, // доля добычи — всем в этом радиусе от центра кратера
	wakeR: 72, // стража встаёт, когда игрок ближе
	awayR: 160, // никого ближе — стража уходит (вернётся при подлёте, убитые не воскресают)
	leash: 36, // стража дальше от кратера — назад
	tries: 40, // попыток найти место (по точке в секунду; не нашлось — завтра)
	needPlayers: true, // по графику — только когда в Верхнем мире кто-то есть (false — для проверки без клиента)
}
var NS_SKY_KEY = 'ns_sky_json'
var NS_SKY_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_SKY_HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
var NS_SKY_FAKE = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayer')
var NS_SKY_LIVING = Java.loadClass('net.minecraft.world.entity.LivingEntity')

// --------------------------------------------------------------------------
// Состояние
// --------------------------------------------------------------------------
function nsSkyDefault() {
	return { nextDay: -1, bonus: false, seq: 0, m: null, search: null }
}
function nsSkyState() {
	if (NSG.nsSky) return NSG.nsSky
	var st = nsSkyDefault()
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_SKY_KEY)) st = Object.assign(nsSkyDefault(), JSON.parse(String(pd.getString(NS_SKY_KEY))))
	} catch (e) {
		console.warn('[sky] битое состояние метеорита, сбрасываю: ' + e)
	}
	NSG.nsSky = st
	return st
}
function nsSkySave() {
	try {
		NSG.nsServer.persistentData.putString(NS_SKY_KEY, JSON.stringify(nsSkyState()))
	} catch (e) {
		console.warn('[sky] не сохранить состояние: ' + e)
	}
}

function nsSkyLevel() {
	return NSG.nsServer.getOverworld()
}
function nsSkyNow(level) {
	try {
		return Number(level.getTime())
	} catch (e) {}
	return Number(level.getGameTime())
}
function nsSkyCmd(cmd) {
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run ' + cmd)
}
function nsSkyCompass(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI
	if (ang < 0) ang += 360
	return ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад'][Math.round(ang / 45) % 8]
}
// Стрелка к цели относительно взгляда игрока (yaw Minecraft: 0 — юг, растёт по часовой)
function nsSkyArrow(p, dx, dz) {
	try {
		var want = (Math.atan2(-dx, dz) * 180) / Math.PI
		var rel = (((want - Number(p.getYaw())) % 360) + 540) % 360 - 180 // −180…180, плюс — вправо (getYaw: getYRot из Rhino не виден, стрелка была «•»)
		return ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘', '↓'][Math.round((rel + 180) / 45)]
	} catch (e) {
		return '•'
	}
}
function nsSkyClock(sec) {
	sec = Math.max(0, Math.round(sec))
	var m = Math.floor(sec / 60),
		s = sec % 60
	return m + ':' + (s < 10 ? '0' : '') + s
}
function nsSkyName(p) {
	try {
		return String(p.getUsername())
	} catch (e) {}
	return String(p.getGameProfile().getName())
}
function nsSkySpectator(p) {
	try {
		return p.isSpectator()
	} catch (e) {}
	return false
}
// игрок в воздухе: в транспорте (самолёт, дракон) или на элитрах
function nsSkyAirborne(p) {
	try {
		if (p.isPassenger()) return true
	} catch (e) {}
	try {
		if (p.isFallFlying()) return true
	} catch (e) {}
	return false
}
function nsSkyOverworldPlayers() {
	var out = []
	var ps = nsSkyLevel().getPlayers()
	for (var i = 0; i < ps.length; i++) if (!nsSkySpectator(ps[i])) out.push(ps[i])
	return out
}
function nsSkyRaidBusy(rs) {
	return rs.raid.state === 'countdown' || rs.raid.state === 'active'
}

// Алтари Верхнего мира, кроме арены
function nsSkyAltars(rs) {
	var out = []
	var arenaId = rs.arena && rs.arena.altarId
	for (var i = 0; i < rs.altars.length; i++) {
		var a = rs.altars[i]
		if (a.dim === 'minecraft:overworld' && a.id !== arenaId) out.push(a)
	}
	return out
}

// --------------------------------------------------------------------------
// «Природный» блок: только такие кратер ломает и только на такие падает метеорит.
// Признак постройки — любой блок вне этого списка (доски, кирпич, стекло, бетон, машины Create, тропинка, грядка…)
// или блок-сущность. Неизвестный модовый блок — тоже «постройка» (лучше другая точка, чем сломанная база).
// --------------------------------------------------------------------------
var NS_SKY_NAT_TAGS = ['minecraft:base_stone_overworld', 'minecraft:dirt', 'minecraft:sand', 'minecraft:terracotta', 'minecraft:leaves', 'minecraft:logs', 'minecraft:flowers', 'minecraft:replaceable', 'minecraft:replaceable_by_trees', 'minecraft:snow', 'minecraft:ice', 'minecraft:overworld_carver_replaceables', 'minecraft:saplings', 'minecraft:coral_blocks', 'minecraft:corals', 'minecraft:cave_vines', 'c:ores']
var NS_SKY_NAT_IDS = {}
;[
	'air', 'cave_air', 'water', 'lava', 'bubble_column', 'gravel', 'clay', 'sandstone', 'red_sandstone', 'basalt', 'blackstone', 'snow', 'snow_block', 'powder_snow', 'packed_ice', 'blue_ice', 'obsidian', 'magma_block',
	'kelp', 'kelp_plant', 'seagrass', 'tall_seagrass', 'sea_pickle', 'sugar_cane', 'cactus', 'bamboo', 'pumpkin', 'melon', 'sweet_berry_bush', 'brown_mushroom', 'red_mushroom', 'brown_mushroom_block',
	'red_mushroom_block', 'mushroom_stem', 'cocoa', 'bee_nest', 'lily_pad', 'big_dripleaf', 'big_dripleaf_stem', 'small_dripleaf', 'spore_blossom', 'moss_carpet', 'moss_block', 'pointed_dripstone',
	'dripstone_block', 'amethyst_block', 'budding_amethyst', 'amethyst_cluster', 'large_amethyst_bud', 'medium_amethyst_bud', 'small_amethyst_bud', 'smooth_basalt', 'mangrove_roots', 'muddy_mangrove_roots',
	'mud', 'pink_petals', 'pitcher_plant', 'glow_lichen', 'vine', 'hanging_roots', 'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush', 'calcite', 'tuff', 'deepslate', 'granite', 'diorite',
	'andesite', 'stone', 'dirt', 'coarse_dirt', 'rooted_dirt', 'podzol', 'mycelium', 'grass_block', 'sand', 'red_sand', 'suspicious_sand', 'suspicious_gravel',
].forEach(function (id) {
	NS_SKY_NAT_IDS['minecraft:' + id] = true
})
// природные блоки модов Верхнего мира — то, что моды ставят генерацией (configured_feature в jar сборки, 04.10):
// слои камня Create, жилы TFMG, магнетит New Age, кусты и дикие овощи, «ползучая» почва ArPhEx, спящие жерла
var NS_SKY_NAT_MOD = {}
;[
	'create:asurine', 'create:crimsite', 'create:limestone', 'create:ochrum', 'create:scoria', 'create:scorchia', 'create:veridium',
	'tfmg:bauxite', 'tfmg:fireclay', 'tfmg:galena', 'tfmg:lignite', 'tfmg:sulfur', 'create_new_age:magnetite_block',
	'create_winery:red_grape_bush', 'create_winery:white_grape_bush', 'farmersdelight:brown_mushroom_colony', 'farmersdelight:red_mushroom_colony',
	'farmersdelight:sandy_shrub', 'farmersdelight:wild_beetroots', 'farmersdelight:wild_cabbages', 'farmersdelight:wild_carrots', 'farmersdelight:wild_onions',
	'farmersdelight:wild_potatoes', 'farmersdelight:wild_rice', 'farmersdelight:wild_tomatoes', 'garnished:nut_log', 'garnished:aureate_shrub',
	'garnished:barren_roots', 'garnished:incandescent_lily', 'garnished:pansophical_daisy', 'arphex:bane_blossom', 'arphex:crawling_clay',
	'arphex:crawling_compost', 'arphex:decadent_dust', 'arphex:scorch', 'arphex:silken_soil', 'molten_vents:dormant_molten_asurine',
	'molten_vents:dormant_molten_crimsite', 'molten_vents:dormant_molten_ochrum', 'molten_vents:dormant_molten_scorchia', 'molten_vents:dormant_molten_scoria',
	'molten_vents:dormant_molten_veridium',
].forEach(function (id) {
	NS_SKY_NAT_MOD[id] = true
})
NSG.nsSkyNat = {}
function nsSkyNatural(blk) {
	var id = String(blk.getId())
	var hit = NSG.nsSkyNat[id]
	if (hit !== undefined) return hit
	var ok = !!NS_SKY_NAT_IDS[id] || /_ore$/.test(id) || NS_SKY_NAT_MOD[id] === true
	// брёвна без коры, древесина и всё «отёсанное» — работа игрока
	if (!ok && id.indexOf('stripped') < 0 && id.indexOf('_wood') < 0 && id.indexOf('planks') < 0) {
		for (var i = 0; i < NS_SKY_NAT_TAGS.length && !ok; i++) {
			try {
				if (blk.hasTag(NS_SKY_NAT_TAGS[i])) ok = true
			} catch (e) {}
		}
	}
	NSG.nsSkyNat[id] = ok
	return ok
}

// Сущность «не природа»: самолёт, штуковина Create, рамка, стойка, вагонетка, лодка, дисплей…
function nsSkyThing(e) {
	try {
		if (e.isPlayer()) return false
		if (e instanceof NS_SKY_LIVING) return false // мобы и животные — не постройки
		var t = String(e.getType())
		return t !== 'minecraft:item' && t !== 'minecraft:experience_orb' && t !== 'minecraft:arrow' && t !== 'minecraft:marker'
	} catch (x) {
		return true
	}
}

// Проверка места. Возвращает {ok, y, why}. y — первый воздух над землёй в центре.
// Быстрые проверки без чанков: зоны баз и алтари
function nsSkyQuickCheck(x, z, rs) {
	for (var zi = 0; zi < rs.zones.length; zi++) {
		var zn = rs.zones[zi]
		if (zn.dim !== 'minecraft:overworld') continue
		var c = NS_SKY.zoneClear
		if (x >= zn.minX - c && x <= zn.maxX + c && z >= zn.minZ - c && z <= zn.maxZ + c) return { ok: false, why: 'зона базы рядом' }
	}
	for (var ai = 0; ai < rs.altars.length; ai++) {
		var al = rs.altars[ai]
		if (al.dim !== 'minecraft:overworld') continue
		if ((al.x - x) * (al.x - x) + (al.z - z) * (al.z - z) < NS_SKY.altarClear * NS_SKY.altarClear) return { ok: false, why: 'алтарь ближе ' + NS_SKY.altarClear }
	}
	// биом по источнику биомов — чанк не грузится: океан, река, пляж сразу мимо (иначе все попытки уходят в воду у моря)
	try {
		// по имени (у Holder.is перегрузки — Rhino их путает); подходит и для биомов Terralith
		var bn = String(NSG.nsServer.getOverworld().getBiome(new NS_SKY_BLOCKPOS(x, 64, z)).getRegisteredName())
		if (/ocean|river|beach|shore/.test(bn)) return { ok: false, why: 'биом с водой: ' + bn }
	} catch (e) {}
	return { ok: true }
}
var NS_SKY_BLOCKPOS = Java.loadClass('net.minecraft.core.BlockPos')

function nsSkySiteCheck(level, x, z, rs) {
	var q = nsSkyQuickCheck(x, z, rs)
	if (!q.ok) return q
	var R = NS_SKY.beR
	for (var cx = (x - R) >> 4; cx <= (x + R) >> 4; cx++) for (var cz = (z - R) >> 4; cz <= (z + R) >> 4; cz++) level.getChunk(cx, cz) // загрузить (и сгенерировать)
	var y = level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, x, z)
	if (y < 50 || y > 230) return { ok: false, why: 'высота ' + y }
	var ground = level.getBlock(x, y - 1, z)
	if (!ground.getBlockState().getFluidState().isEmpty()) return { ok: false, why: 'вода или лава' }
	if (!nsSkyNatural(ground)) return { ok: false, why: 'не природная земля: ' + ground.getId() }
	// поверхность: верхний блок каждой колонны — природный; не обрыв
	var steep = 0,
		cols = 0
	var C = NS_SKY.checkR
	for (var dx = -C; dx <= C; dx++) {
		for (var dz = -C; dz <= C; dz++) {
			if (dx * dx + dz * dz > C * C) continue
			cols++
			var top = level.getHeight(NS_SKY_HM.WORLD_SURFACE, x + dx, z + dz)
			var tb = level.getBlock(x + dx, top - 1, z + dz)
			if (!nsSkyNatural(tb)) return { ok: false, why: 'постройка: ' + tb.getId() + ' в ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл.' }
			var gy = level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, x + dx, z + dz)
			if (Math.abs(gy - y) > 6) steep++
		}
	}
	if (steep > cols * 0.25) return { ok: false, why: 'крутой склон' }
	// блок-сущности (сундуки, машины, печи, кровати…) в радиусе beR — выше y−12 (подземные данжи не в счёт)
	for (var bx = (x - R) >> 4; bx <= (x + R) >> 4; bx++) {
		for (var bz = (z - R) >> 4; bz <= (z + R) >> 4; bz++) {
			var it = level.getChunk(bx, bz).getBlockEntities().values().iterator()
			while (it.hasNext()) {
				var be = it.next()
				var bp = be.getBlockPos()
				var ex = bp.getX() - x,
					ez = bp.getZ() - z
				if (ex * ex + ez * ez > R * R || bp.getY() < y - 12) continue
				var bid = String(be.getBlockState().getBlock().id)
				if (bid === 'minecraft:bee_nest' || NS_SKY_NAT_MOD[bid]) continue // природные: улей, кусты винограда
				return { ok: false, why: 'блок-сущность ' + bid + ' в ' + Math.round(Math.sqrt(ex * ex + ez * ez)) + ' бл.' }
			}
		}
	}
	// «вещи» игрока рядом
	var ents = level.getEntitiesWithin(new NS_SKY_AABB(x - R, y - 16, z - R, x + R + 1, y + 48, z + R + 1))
	for (var ei = 0; ei < ents.size(); ei++) if (nsSkyThing(ents.get(ei))) return { ok: false, why: 'рядом ' + ents.get(ei).getType() }
	// объём кратера — только природа (то, что сломаем)
	var K = NS_SKY.craterR + 3
	for (var vx = -K; vx <= K; vx++) {
		for (var vz = -K; vz <= K; vz++) {
			if (vx * vx + vz * vz > K * K) continue
			for (var vy = y - 7; vy <= y + 14; vy++) {
				var vb = level.getBlock(x + vx, vy, z + vz)
				if (!nsSkyNatural(vb)) return { ok: false, why: 'в кратере ' + vb.getId() }
				// вода или лава рядом — затопит чашу (проверено 04.10: кратер у озера залило)
				if (!vb.getBlockState().getFluidState().isEmpty()) return { ok: false, why: 'вода/лава у кратера: ' + vb.getId() }
			}
		}
	}
	return { ok: true, y: y }
}

// --------------------------------------------------------------------------
// Поиск места — по точке: быстрые проверки без чанков, потом чанки грузятся тикетом forceload в фоне (сервер
// не замирает на генерации), и только загруженные — проверяем. Тикет снимаем сразу после проверки.
// --------------------------------------------------------------------------
function nsSkyStartSearch(altar, opts) {
	var st = nsSkyState()
	opts = opts || {}
	st.search = { altar: { x: altar.x, y: altar.y, z: altar.z, id: altar.id || null }, tries: 0, prefer: opts.prefer || null, cool: opts.cool || 0, who: opts.who || null, log: [] }
	nsSkySave()
}

// Чанки кандидата: квадрат ±beR — грузим тикетом forceload (генерация идёт в фоне, сервер не замирает)
function nsSkyCandArea(c) {
	var R = NS_SKY.beR
	return (c.x - R) + ' ' + (c.z - R) + ' ' + (c.x + R) + ' ' + (c.z + R)
}
function nsSkyCandReady(level, c) {
	var R = NS_SKY.beR
	for (var cx = (c.x - R) >> 4; cx <= (c.x + R) >> 4; cx++) {
		for (var cz = (c.z - R) >> 4; cz <= (c.z + R) >> 4; cz++) {
			try {
				if (!level.hasChunk(cx, cz)) return false
			} catch (e) {
				return true // не узнать — проверка сама догрузит
			}
		}
	}
	return true
}

function nsSkySearchStep(rs) {
	var st = nsSkyState()
	var s = st.search
	var level = nsSkyLevel()
	if (s.cand) {
		var c = s.cand
		c.wait = (c.wait || 0) + 1
		var ready = nsSkyCandReady(level, c)
		if (!ready && c.wait < 30) return nsSkySave()
		var res
		try {
			res = ready ? nsSkySiteCheck(level, c.x, c.z, rs) : { ok: false, why: 'чанки не загрузились за 30 с' }
		} catch (e) {
			res = { ok: false, why: 'ошибка проверки: ' + e }
		}
		nsSkyCmd('forceload remove ' + nsSkyCandArea(c)) // у метеорита — свой тикет (nsSkyBegin)
		s.cand = null
		if (res.ok) {
			st.search = null
			nsSkySave()
			nsSkyBegin(level, s, c.x, res.y, c.z)
			return
		}
		nsSkyReject(st, s, c.x, c.z, res.why)
		return nsSkySave()
	}
	// новый кандидат: быстрые проверки без чанков, потом тикет на чанки
	// до 16 точек за тик отсеиваем быстрыми проверками (без чанков) — в попытку идёт только прошедшая
	var x, z, q
	for (var pick = 0; pick < 16; pick++) {
		if (s.prefer && s.tries === 0 && pick === 0) {
			x = s.prefer[0]
			z = s.prefer[1]
		} else {
			var ang = Math.random() * Math.PI * 2
			var dist = NS_SKY.distMin + Math.random() * (NS_SKY.distMax - NS_SKY.distMin)
			x = Math.round(s.altar.x + Math.cos(ang) * dist)
			z = Math.round(s.altar.z + Math.sin(ang) * dist)
		}
		q = nsSkyQuickCheck(x, z, rs)
		if (q.ok || (s.prefer && s.tries === 0)) break // точку админа не подменяем
	}
	s.tries++
	if (!q.ok) {
		nsSkyReject(st, s, x, z, q.why)
		return nsSkySave()
	}
	s.cand = { x: x, z: z, wait: 0 }
	nsSkyCmd('forceload add ' + nsSkyCandArea(s.cand))
	nsSkySave()
}

function nsSkyReject(st, s, x, z, why) {
	if (s.log.length < 12) s.log.push(x + ' ' + z + ': ' + why)
	console.info('[sky] метеорит: точка ' + x + ' ' + z + ' отклонена — ' + why)
	if (s.who && s.tries === 1 && s.prefer) nsSkyTellOps('точка ' + x + ' ' + z + ' отклонена: ' + why + ' — ищу другую')
	if (s.tries >= NS_SKY.tries) {
		console.warn('[sky] метеорит: места не нашлось за ' + s.tries + ' попыток')
		nsSkyTellOps('метеорит: места без построек не нашлось за ' + s.tries + ' попыток — попробую завтра')
		st.search = null
		st.nextDay = nsSkyDay() + 1
	}
}

function nsSkyTellOps(text) {
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		try {
			if (ps[i].hasPermissions(2)) ps[i].tell(Text.gray('[Метеорит] ' + text))
		} catch (e) {}
	}
	console.info('[sky] ' + text)
}

function nsSkyDay() {
	return Math.floor(Number(nsSkyLevel().getDayTime()) / 24000)
}

// --------------------------------------------------------------------------
// Падение
// --------------------------------------------------------------------------
function nsSkyGuardPlan(phase) {
	var nPlayers = Math.max(1, nsSkyOverworldPlayers().length)
	var total = Math.max(3, Math.min(7, 3 + Math.floor(phase / 12))) + Math.min(2, nPlayers - 1)
	var fly = phase >= 30 ? 2 : 1
	// здоровье — как у мобов набега той же волны (NS_WAVE_TOUGH: +50 % до 49-й, дальше больше) и ещё +3 % за пройденную волну
	return { total: total, fly: fly, hp: 0.03 * phase + (typeof nsWaveToughHp === 'function' ? nsWaveToughHp(Math.max(1, phase)) : 0.5) }
}

function nsSkyBegin(level, s, x, y, z) {
	var st = nsSkyState()
	var rs = nsGetStateRO()
	var phase = rs.phase || 0
	st.seq = (st.seq || 0) + 1
	var plan = nsSkyGuardPlan(phase)
	var ore = Math.min(10, 6 + Math.floor(phase / 15))
	var m = {
		id: st.seq,
		x: x,
		y: y,
		z: z,
		ax: s.altar.x,
		az: s.altar.z,
		stage: 'falling',
		left: s.cool > 0 ? s.cool : NS_SKY.coolSec,
		total: s.cool > 0 ? s.cool : NS_SKY.coolSec,
		phase: phase,
		guards: plan.total,
		fly: plan.fly,
		hp: plan.hp,
		killed: 0,
		starDead: false,
		oreN: ore,
		ore: [],
		hot: [],
		shares: {},
		mined: 0,
		away: 0,
		since: 0,
		lastSpawn: 0,
	}
	st.m = m
	var a = Math.random() * Math.PI * 2
	NSG.nsSkyFall = { t: 0, dur: 120, fx: x + Math.cos(a) * 90, fy: y + 170, fz: z + Math.sin(a) * 90, tx: x + 0.5, ty: y + 1, tz: z + 0.5 }
	// чанки кратера держим загруженными до остывания (руда тускнеет и без игроков рядом)
	nsSkyCmd('forceload add ' + (x - 12) + ' ' + (z - 12) + ' ' + (x + 12) + ' ' + (z + 12))
	nsSkySave()
	var dist = Math.round(Math.sqrt((x - s.altar.x) * (x - s.altar.x) + (z - s.altar.z) * (z - s.altar.z)))
	var dir = nsSkyCompass(x - s.altar.x, z - s.altar.z)
	console.info('[sky] метеорит #' + m.id + ' падает в ' + x + ' ' + y + ' ' + z + ' (' + dist + ' бл. от алтаря, ' + dir + '), стража ' + m.guards + ', руды ' + m.oreN + ', остывание ' + m.left + ' с')
	// игроки в других измерениях — только строка в чат (расстояние от базы)
	var all = NSG.nsServer.getPlayers()
	for (var o = 0; o < all.length; o++) {
		if (String(all[o].getLevel().getDimension()) === 'minecraft:overworld') continue
		all[o].tell(Text.gold('[Метеорит] ').append(Text.white('В Верхнем мире упал метеорит: ' + dist + ' блоков от базы на ' + dir + ', координаты ')).append(Text.yellow(x + ' ' + y + ' ' + z)).append(Text.gray('. Остынет за ' + Math.round(m.left / 60) + ' мин.')))
	}
	var ps = nsSkyOverworldPlayers()
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		var name = nsSkyName(p)
		var dx = x - p.getX(),
			dz = z - p.getZ()
		var pd = Math.round(Math.sqrt(dx * dx + dz * dz))
		NSG.nsServer.runCommandSilent('title ' + name + ' times 10 80 20')
		NSG.nsServer.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: pd + ' блоков на ' + nsSkyCompass(dx, dz) + ' · остынет за ' + Math.round(m.left / 60) + ' мин', color: 'yellow' }))
		NSG.nsServer.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: 'Метеорит!', color: 'gold', bold: true }))
		p.tell(
			Text.gold('[Метеорит] ')
				.append(Text.white('Падает в ' + pd + ' блоках на ' + nsSkyCompass(dx, dz) + ' от вас (' + dist + ' от базы, ' + dir + '). Координаты: '))
				.append(Text.yellow(x + ' ' + y + ' ' + z))
				.append(Text.gray('. Остынет за ' + Math.round(m.left / 60) + ' мин — пешком не успеть, летите. Стража держит щит над рудой; добычу с руды получает каждый в кратере.'))
		)
		// путевая точка Xaero: клиент сам превратит строку в кнопку «добавить»
		p.tell(Text.of('xaero-waypoint:Метеорит:М:' + x + ':' + y + ':' + z + ':6:false:0:Internal-overworld-waypoints'))
	}
	NSG.nsServer.runCommandSilent('execute as @a at @s run playsound minecraft:item.trident.thunder weather @s ~ ~ ~ 0.7 0.5')
}

// Анимация падения — каждый тик, пока летит болид (6 с)
function nsSkyFallTick() {
	var f = NSG.nsSkyFall
	if (!f) return
	f.t++
	var k = Math.pow(Math.min(1, f.t / f.dur), 1.7)
	var px = f.fx + (f.tx - f.fx) * k,
		py = f.fy + (f.ty - f.fy) * k,
		pz = f.fz + (f.tz - f.fz) * k
	if (f.t % 2 === 0) {
		var at = px.toFixed(1) + ' ' + py.toFixed(1) + ' ' + pz.toFixed(1)
		nsSkyCmd('particle minecraft:flame ' + at + ' 0.8 0.8 0.8 0.04 30 force')
		nsSkyCmd('particle minecraft:large_smoke ' + at + ' 1 1 1 0.02 16 force')
		nsSkyCmd('particle minecraft:lava ' + at + ' 0.6 0.6 0.6 0 4 force')
		if (f.t % 10 === 0) nsSkyCmd('particle minecraft:explosion ' + at + ' 0.5 0.5 0.5 0 1 force')
	}
	if (f.t >= f.dur) {
		NSG.nsSkyFall = null
		try {
			nsSkyImpact()
		} catch (e) {
			console.error('[sky] удар метеорита: ' + e)
		}
	}
}

function nsSkyImpact() {
	var st = nsSkyState()
	var m = st.m
	if (!m || m.stage !== 'falling') return
	var level = nsSkyLevel()
	for (var cx = (m.x - 12) >> 4; cx <= (m.x + 12) >> 4; cx++) for (var cz = (m.z - 12) >> 4; cz <= (m.z + 12) >> 4; cz++) level.getChunk(cx, cz)
	nsSkyCrater(level, m)
	m.stage = 'hot'
	nsSkySave()
	var at = m.x + ' ' + (m.y + 1) + ' ' + m.z
	nsSkyCmd('particle minecraft:explosion_emitter ' + at + ' 2 1 2 0 6 force')
	nsSkyCmd('particle minecraft:lava ' + at + ' 3 1 3 0 80 force')
	nsSkyCmd('particle minecraft:campfire_signal_smoke ' + at + ' 3 1 3 0.02 40 force')
	nsSkyCmd('playsound minecraft:entity.generic.explode block @a ' + at + ' 8 0.5')
	NSG.nsServer.runCommandSilent('execute as @a at @s run playsound minecraft:entity.lightning_bolt.thunder weather @s ~ ~ ~ 0.6 0.4')
	// кто стоял рядом — отбросить и обжечь (метеорит всё-таки)
	try {
		var ents = level.getEntitiesWithin(new NS_SKY_AABB(m.x - 6, m.y - 4, m.z - 6, m.x + 7, m.y + 8, m.z + 7))
		for (var i = 0; i < ents.size(); i++) {
			var e = ents.get(i)
			if (!(e instanceof NS_SKY_LIVING)) continue
			NSG.nsServer.runCommandSilent('execute as ' + e.getStringUuid() + ' run damage @s 8 minecraft:explosion')
		}
	} catch (e2) {}
	nsTellAllSky(Text.gold('[Метеорит] ').append(Text.white('Упал! ')).append(Text.yellow(m.x + ' ' + m.y + ' ' + m.z)).append(Text.gray(' — столб дыма над кратером видно издалека.')))
}

function nsTellAllSky(t) {
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) ps[i].tell(t)
}

// Кратер: чаша радиуса craterR, на дне обломки и магма, в центре — тело метеорита из руды; вал и россыпь обломков.
// Ломаем ТОЛЬКО природные блоки (место проверено nsSkySiteCheck, но проверяем ещё раз поблочно).
function nsSkyCrater(level, m) {
	var R = NS_SKY.craterR
	var g = m.y - 1 // верх земли в центре
	var debris = ['minecraft:basalt', 'minecraft:basalt', 'minecraft:blackstone', 'minecraft:coarse_dirt', 'minecraft:tuff']
	var floorAt = {}
	for (var dx = -R - 3; dx <= R + 3; dx++) {
		for (var dz = -R - 3; dz <= R + 3; dz++) {
			var d = Math.sqrt(dx * dx + dz * dz)
			var x = m.x + dx,
				z = m.z + dz
			if (d <= R) {
				var depth = Math.round(3.5 * (1 - (d / R) * (d / R))) + 1
				var fy = g - depth
				floorAt[dx + ',' + dz] = fy
				for (var y = g + 14; y > fy; y--) {
					var b = level.getBlock(x, y, z)
					var id = String(b.getId())
					if (id === 'minecraft:air' || id === 'minecraft:cave_air' || !nsSkyNatural(b)) continue
					b.set('minecraft:air')
				}
				var fb = level.getBlock(x, fy, z)
				if (nsSkyNatural(fb)) {
					var pick = debris[Math.floor(Math.random() * debris.length)]
					// магма — горячее дно у самого тела метеорита и редкие пятна по чаше (на неё садятся самолёты — не сплошняком)
					if ((d < 2.5 && Math.random() < 0.45) || Math.random() < 0.06) pick = 'minecraft:magma_block'
					fb.set(pick)
					if (pick === 'minecraft:magma_block') m.hot.push([x, fy, z])
				}
			} else if (d <= R + 2.5 && Math.random() < 0.65) {
				// вал выброса
				var top = level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, x, z)
				var under = level.getBlock(x, top - 1, z)
				var above = level.getBlock(x, top, z)
				if (nsSkyNatural(under) && under.getBlockState().getFluidState().isEmpty() && String(above.getId()).indexOf('air') >= 0) above.set(Math.random() < 0.6 ? 'minecraft:coarse_dirt' : 'minecraft:blackstone')
			}
		}
	}
	// тело метеорита: руда в центре чаши
	var fy0 = floorAt['0,0']
	var offs = [[0, 1, 0], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1], [0, 2, 0], [1, 1, 1], [-1, 1, -1], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 2, 0], [-1, 1, 1]]
	for (var i = 0; i < offs.length && m.ore.length < m.oreN; i++) {
		var o = offs[i]
		var ox = m.x + o[0],
			oy = fy0 + o[1],
			oz = m.z + o[2]
		var ob = level.getBlock(ox, oy, oz)
		var oid = String(ob.getId())
		if (oid.indexOf('air') < 0 && !nsSkyNatural(ob) && oid.indexOf('basalt') < 0 && oid.indexOf('blackstone') < 0 && oid.indexOf('magma') < 0 && oid.indexOf('coarse_dirt') < 0 && oid.indexOf('tuff') < 0) continue
		ob.set('nightshift:meteor_ore')
		m.ore.push([ox, oy, oz])
	}
	// россыпь обломков вокруг
	for (var n = 0; n < 14; n++) {
		var a = Math.random() * Math.PI * 2
		var r = R + 2 + Math.random() * 8
		var sx = Math.round(m.x + Math.cos(a) * r),
			sz = Math.round(m.z + Math.sin(a) * r)
		var sy = level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, sx, sz)
		var sb = level.getBlock(sx, sy - 1, sz)
		var sa = level.getBlock(sx, sy, sz)
		if (!nsSkyNatural(sb) || !sb.getBlockState().getFluidState().isEmpty() || String(sa.getId()).indexOf('air') < 0) continue
		sa.set(Math.random() < 0.25 ? 'minecraft:magma_block' : Math.random() < 0.5 ? 'minecraft:blackstone' : 'minecraft:basalt')
	}
	console.info('[sky] кратер #' + m.id + ': руды ' + m.ore.length + ', магмы ' + m.hot.length)
}

// --------------------------------------------------------------------------
// Стража
// --------------------------------------------------------------------------
var NS_SKY_GUARD_SKIP = { kamikaze: 1, kamikaze_heavy: 1, cave_dweller: 1, brood: 1, sinker: 1, snatcher: 1, crab_larva: 1, endermaptera: 1, lurker_queen: 1, wasp: 1, moth: 1, reaper_ghost: 1 }
function nsSkyGuardPool(phase) {
	var ground = [],
		fly = []
	var D = NSG.NS_MOD_DEBUTS || {}
	if (phase >= 16 && NSG.NS_MOD_MOBS) {
		for (var w in D) {
			if (Number(w) > phase) continue
			var keys = [D[w].star].concat(D[w].join || [])
			for (var i = 0; i < keys.length; i++) {
				var mm = NSG.NS_MOD_MOBS[keys[i]]
				if (!mm || NS_SKY_GUARD_SKIP[keys[i]]) continue
				;(mm.flyer ? fly : ground).push(mm)
			}
		}
	}
	if (!ground.length) ground = [{ id: 'minecraft:zombie', nbt: '' }, { id: 'minecraft:husk', nbt: '' }, { id: 'minecraft:skeleton', nbt: '' }, { id: 'minecraft:spider', nbt: '' }]
	if (!fly.length) fly = [{ id: 'minecraft:phantom', nbt: '' }]
	return { ground: ground, fly: fly }
}

var NS_SKY_FIRE_RES = 'active_effects:[{id:"minecraft:fire_resistance",amplifier:0b,duration:-1,show_particles:0b}]'
function nsSkySummonGuard(m, mm, x, y, z, star, flyer) {
	var tags = '["ns_sky_guard","ns_meteor_guard","ns_mg_' + m.id + '"' + (star ? ',"ns_mg_star"' : '') + (flyer ? ',"ns_mg_fly"' : '') + ']'
	var nbt = '{Tags:' + tags + ',PersistenceRequired:1b'
	if (mm.nbt && mm.nbt.indexOf('active_effects') < 0) nbt += ',' + mm.nbt
	if (!mm.nbt || mm.nbt.indexOf('active_effects') < 0) nbt += ',' + NS_SKY_FIRE_RES
	// 05.10, Георгий: «не можем найти последнего монстра» — подсвечены все стражи, не только звезда
	nbt += ',Glowing:1b'
	if (star) nbt += ',CustomName:\'"Страж метеорита"\',CustomNameVisible:1b'
	nbt += '}'
	nsSkyCmd('summon ' + mm.id + ' ' + x + ' ' + y + ' ' + z + ' ' + nbt)
}

// Поставить недостающих стражей (убитые не воскресают). Летуны — над кратером, наземные — на валу.
function nsSkySpawnGuards(level, m, alive) {
	var left = m.guards - m.killed
	var need = left - alive.length
	if (need <= 0) return 0
	var pool = nsSkyGuardPool(m.phase)
	var aliveFly = 0,
		aliveStar = false
	for (var i = 0; i < alive.length; i++) {
		if (alive[i].getTags().contains('ns_mg_fly')) aliveFly++
		if (alive[i].getTags().contains('ns_mg_star')) aliveStar = true
	}
	var spawned = 0
	for (var n = 0; n < need; n++) {
		var star = !m.starDead && !aliveStar && n === 0
		var flyer = !star && aliveFly < m.fly
		var mm = flyer ? pool.fly[Math.floor(Math.random() * pool.fly.length)] : pool.ground[Math.floor(Math.random() * pool.ground.length)]
		var a = Math.random() * Math.PI * 2
		var r = NS_SKY.craterR + 2 + Math.random() * 3
		var x = Math.round(m.x + Math.cos(a) * r),
			z = Math.round(m.z + Math.sin(a) * r)
		var y = flyer ? m.y + 10 + Math.floor(Math.random() * 6) : level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, x, z)
		nsSkySummonGuard(m, mm, x, y, z, star, flyer)
		if (flyer) aliveFly++
		if (star) aliveStar = true
		spawned++
	}
	// крепче с пройденной волной команды; звезда — вдвое крепче и крупнее
	var sel = '@e[tag=ns_mg_' + m.id + ',tag=!ns_sky_boosted]'
	var star = '@e[tag=ns_mg_' + m.id + ',tag=!ns_sky_boosted,tag=ns_mg_star]'
	nsSkyCmd('execute as ' + sel + ' run attribute @s minecraft:generic.max_health modifier add nightshift:sky_guard ' + m.hp.toFixed(3) + ' add_multiplied_base')
	nsSkyCmd('execute as ' + star + ' run attribute @s minecraft:generic.max_health modifier add nightshift:sky_star 1.0 add_multiplied_base')
	nsSkyCmd('execute as ' + star + ' run attribute @s minecraft:generic.scale modifier add nightshift:sky_star 0.35 add_multiplied_base')
	nsSkyCmd('execute as ' + sel + ' run attribute @s minecraft:generic.follow_range base set 40')
	nsSkyCmd('execute as ' + sel + ' run data modify entity @s Health set value 100000f')
	nsSkyCmd('tag ' + sel + ' add ns_sky_boosted')
	return spawned
}

function nsSkyFindGuards(level, m, r) {
	var out = []
	var tag = 'ns_mg_' + m.id
	try {
		var list = level.getEntitiesWithin(new NS_SKY_AABB(m.x - r, m.y - 64, m.z - r, m.x + r + 1, m.y + 96, m.z + r + 1))
		for (var i = 0; i < list.size(); i++) {
			var e = list.get(i)
			try {
				if (e.isAlive() && e.getTags().contains(tag)) out.push(e)
			} catch (x) {}
		}
	} catch (e2) {}
	return out
}

function nsSkyDiscard(e) {
	try {
		e.discard()
	} catch (x) {
		try {
			e.kill()
		} catch (x2) {}
	}
}

// --------------------------------------------------------------------------
// Тик горячего метеорита (раз в секунду)
// --------------------------------------------------------------------------
function nsSkyHotTick(level, m, rs) {
	var busy = nsSkyRaidBusy(rs)
	if (!busy) m.left--
	m.since++
	var ps = nsSkyOverworldPlayers()
	var nearest = 1e9
	for (var i = 0; i < ps.length; i++) {
		var dx = ps[i].getX() - m.x,
			dz = ps[i].getZ() - m.z
		nearest = Math.min(nearest, Math.sqrt(dx * dx + dz * dz))
	}
	var shield = m.killed < m.guards
	// стража
	var alive = nsSkyFindGuards(level, m, NS_SKY.awayR)
	if (shield) {
		if (nearest <= NS_SKY.wakeR && m.since - m.lastSpawn >= 5) {
			var n = nsSkySpawnGuards(level, m, alive)
			if (n > 0) {
				m.lastSpawn = m.since
				if (!m.woke) {
					m.woke = true
					for (var w = 0; w < ps.length; w++) {
						var wx = ps[w].getX() - m.x,
							wz = ps[w].getZ() - m.z
						if (wx * wx + wz * wz <= 120 * 120) NSG.nsServer.runCommandSilent('title ' + nsSkyName(ps[w]) + ' actionbar ' + JSON.stringify({ text: 'Стража метеорита проснулась! Пока она жива — руда под щитом', color: 'red' }))
					}
					nsSkyCmd('playsound minecraft:entity.wither.ambient hostile @a ' + m.x + ' ' + m.y + ' ' + m.z + ' 4 0.6')
				}
			}
		}
		// застрявших в блоке (обломки кратера, склон) — наверх, на поверхность над ними
		for (var gi = 0; gi < alive.length; gi++) {
			try {
				if (!alive[gi].isInWall()) continue
				var gx = Math.floor(alive[gi].getX()),
					gz = Math.floor(alive[gi].getZ())
				alive[gi].teleportTo(gx + 0.5, level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, gx, gz), gz + 0.5)
			} catch (e) {}
		}
		// поводок: далеко ушедших — назад к кратеру
		for (var g = 0; g < alive.length; g++) {
			var gx = alive[g].getX() - m.x,
				gz = alive[g].getZ() - m.z
			if (gx * gx + gz * gz > NS_SKY.leash * NS_SKY.leash) {
				var fl = alive[g].getTags().contains('ns_mg_fly')
				var ty = fl ? m.y + 12 : level.getHeight(NS_SKY_HM.MOTION_BLOCKING_NO_LEAVES, m.x + 5, m.z) + 0
				try {
					alive[g].teleportTo(m.x + 5.5, ty, m.z + 0.5)
				} catch (x) {}
			}
		}
		// никого рядом минуту — стража уходит (вернётся при подлёте)
		if (nearest > NS_SKY.awayR) {
			m.away++
			if (m.away >= 60 && alive.length) {
				for (var a = 0; a < alive.length; a++) nsSkyDiscard(alive[a])
				m.away = 0
			}
		} else m.away = 0
	}
	// видимость: столб частиц и дым над кратером, щит над рудой
	if (m.since % 2 === 0) {
		nsSkyCmd('particle minecraft:end_rod ' + m.x + ' ' + (m.y + 40) + ' ' + m.z + ' 0.25 38 0.25 0.004 70 force')
		nsSkyCmd('particle minecraft:campfire_signal_smoke ' + m.x + ' ' + (m.y + 1) + ' ' + m.z + ' 1.2 0.5 1.2 0.02 6 force')
		nsSkyCmd('particle minecraft:flame ' + m.x + ' ' + m.y + ' ' + m.z + ' 1.5 0.6 1.5 0.01 12 force')
		if (shield) nsSkyCmd('particle minecraft:electric_spark ' + m.x + ' ' + (m.y - 1) + ' ' + m.z + ' 1.6 1.2 1.6 0.2 40 force')
	}
	// полоса и подсказка в пути
	nsBossbarCreate('nightshift:meteor', 'Метеорит' + (busy ? ' (пауза: набег)' : '') + ': остынет через ' + nsSkyClock(m.left) + (shield ? ' · стража ' + (m.guards - m.killed) + ' из ' + m.guards : ' · щит снят'), 'yellow')
	nsBossbarMax('nightshift:meteor', Math.max(1, m.total || NS_SKY.coolSec))
	nsBossbarValue('nightshift:meteor', Math.max(0, m.left))
	// навигатор: каждую секунду всем, пешком и в воздухе (05.10, Георгий: «навигатор сломался» — раньше пешим дальше
	// 300 блоков подсказка пропадала через минуту); стрелка — куда повернуть относительно взгляда
	for (var q = 0; q < ps.length; q++) {
		var p = ps[q]
		var px = m.x - p.getX(),
			pz = m.z - p.getZ()
		var pd = Math.round(Math.sqrt(px * px + pz * pz))
		if (pd < 24) continue
		if (typeof nsFunHudBusy === 'function' && nsFunHudBusy(p)) continue // гонка или тир держат строку (zabava/00_common.js)
		NSG.nsServer.runCommandSilent('title ' + nsSkyName(p) + ' actionbar ' + JSON.stringify({ text: nsSkyArrow(p, px, pz) + ' Метеорит: ' + pd + ' бл., ' + nsSkyCompass(px, pz) + ' · остынет через ' + nsSkyClock(m.left), color: 'gold' }))
	}
	if (m.left <= 0) return nsSkyCool(level, m, 'остыл')
	if (m.ore.length && m.mined >= m.ore.length) return nsSkyCool(level, m, 'выработан')
}

// Конец: руда тускнеет в камень, магма — в чернокамень, стража уходит, чанки отпускаем
function nsSkyCool(level, m, why) {
	var st = nsSkyState()
	var dimmed = 0
	for (var i = 0; i < m.ore.length; i++) {
		var o = m.ore[i]
		var b = level.getBlock(o[0], o[1], o[2])
		if (String(b.getId()) === 'nightshift:meteor_ore') {
			b.set('minecraft:stone')
			dimmed++
		}
	}
	for (var h = 0; h < m.hot.length; h++) {
		var hb = level.getBlock(m.hot[h][0], m.hot[h][1], m.hot[h][2])
		if (String(hb.getId()) === 'minecraft:magma_block') hb.set('minecraft:blackstone')
	}
	var guards = nsSkyFindGuards(level, m, NS_SKY.awayR)
	for (var g = 0; g < guards.length; g++) nsSkyDiscard(guards[g])
	nsSkyCmd('forceload remove ' + (m.x - 12) + ' ' + (m.z - 12) + ' ' + (m.x + 12) + ' ' + (m.z + 12))
	nsBossbarRemove('nightshift:meteor')
	var parts = []
	for (var n in m.shares) parts.push(n + ' — ' + Math.round(m.shares[n]))
	var line = Text.gold('[Метеорит] ').append(Text.white(why === 'выработан' ? 'Вся руда добыта. ' : 'Метеорит остыл — руда потускнела в камень. '))
	if (parts.length) line = line.append(Text.gray('Доли метеоритного железа: ' + parts.join(', ') + '.'))
	else line = line.append(Text.gray('В этот раз до кратера никто не добрался.'))
	nsTellAllSky(line)
	console.info('[sky] метеорит #' + m.id + ' ' + why + ': потускнело ' + dimmed + ', доли ' + JSON.stringify(m.shares))
	st.last = { x: m.x, z: m.z, day: nsSkyDay(), shares: m.shares }
	st.m = null
	nsSkySave()
}

// --------------------------------------------------------------------------
// Добыча руды: щит и доли
// --------------------------------------------------------------------------
function nsSkyShare(level, breakerName, m) {
	var recips = []
	var ps = level.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		if (nsSkySpectator(p)) continue
		var dx = p.getX() - m.x,
			dz = p.getZ() - m.z,
			dy = p.getY() - m.y
		if (dx * dx + dz * dz <= NS_SKY.shareR * NS_SKY.shareR && Math.abs(dy) <= 40) recips.push(p)
	}
	if (NSG.nsSkyTestRecips) recips = recips.concat(NSG.nsSkyTestRecips) // /nsmeteor testbreak — боты-FakePlayer
	for (var r = 0; r < recips.length; r++) {
		var q = recips[r]
		var name = nsSkyName(q)
		var n = 2 + (Math.random() < 0.35 ? 1 : 0)
		try {
			q.give(Item.of('nightshift:meteor_iron', n))
		} catch (e) {
			NSG.nsServer.runCommandSilent('give ' + name + ' nightshift:meteor_iron ' + n)
		}
		m.shares[name] = (m.shares[name] || 0) + n
		try {
			q.setStatusMessage(Text.gold('+' + n + ' метеоритного железа').append(Text.gray(name === breakerName ? ' — ваша доля с руды' : ' — доля с руды (ломал ' + breakerName + ')')))
		} catch (e2) {}
	}
	m.mined++
	return recips.length
}

BlockEvents.broken('nightshift:meteor_ore', event => {
	var cancel = false
	try {
		var p = event.getEntity()
		var blk = event.getBlock()
		var st = nsSkyState()
		var m = st.m
		var level = blk.getLevel()
		var inCrater = m && m.stage === 'hot' && Math.abs(blk.getX() - m.x) <= 12 && Math.abs(blk.getZ() - m.z) <= 12
		var creative = false
		try {
			creative = p.isCreative()
		} catch (e) {}
		if (inCrater && m.killed < m.guards && !creative) {
			cancel = true
			try {
				p.setStatusMessage(Text.red('Руда под щитом: стража метеорита жива (' + (m.guards - m.killed) + ')'))
			} catch (e) {}
			nsSkyCmd('particle minecraft:electric_spark ' + blk.getX() + ' ' + (blk.getY() + 0.5) + ' ' + blk.getZ() + ' 0.5 0.5 0.5 0.3 20 force')
			nsSkyCmd('playsound minecraft:block.amethyst_block.hit block @a ' + blk.getX() + ' ' + blk.getY() + ' ' + blk.getZ() + ' 1 0.5')
		} else if (inCrater) {
			var got = nsSkyShare(level, p ? nsSkyName(p) : '?', m)
			console.info('[sky] руда метеорита #' + m.id + ' сломана (' + (p ? nsSkyName(p) : '?') + '), долей: ' + got)
			nsSkySave()
		} else if (!creative && p && !(p instanceof NS_SKY_FAKE)) {
			// руда вне события (остаток, творческий режим) — просто кусок ломающему
			p.give(Item.of('nightshift:meteor_iron', 2))
		}
	} catch (e) {
		console.warn('[sky] руда метеорита: ' + e)
	}
	if (cancel) event.cancel() // вне try: cancel() выходит из обработчика исключением
})

// Гибель стражи — в счёт щита (смерть, а не «пропал из виду»)
EntityEvents.death(event => {
	try {
		var e = event.entity
		var tg = e.getTags()
		if (!tg.contains('ns_meteor_guard')) return
		var st = nsSkyState()
		var m = st.m
		if (!m || !tg.contains('ns_mg_' + m.id)) return
		m.killed = Math.min(m.guards, m.killed + 1)
		if (tg.contains('ns_mg_star')) m.starDead = true
		nsSkySave()
		if (m.killed >= m.guards) {
			nsTellAllSky(Text.gold('[Метеорит] ').append(Text.green('Стража пала — щит снят, руда открыта! ')).append(Text.gray('Добычу с каждого блока получает каждый в кратере.')))
			nsSkyCmd('playsound minecraft:block.beacon.deactivate block @a ' + m.x + ' ' + m.y + ' ' + m.z + ' 4 1')
			nsSkyCmd('particle minecraft:totem_of_undying ' + m.x + ' ' + (m.y + 1) + ' ' + m.z + ' 2 1 2 0.3 80 force')
		} else {
			var ps = nsSkyOverworldPlayers()
			for (var i = 0; i < ps.length; i++) {
				var dx = ps[i].getX() - m.x,
					dz = ps[i].getZ() - m.z
				if (dx * dx + dz * dz <= 120 * 120) NSG.nsServer.runCommandSilent('title ' + nsSkyName(ps[i]) + ' actionbar ' + JSON.stringify({ text: 'Стража метеорита: осталось ' + (m.guards - m.killed), color: 'gold' }))
			}
		}
	} catch (x) {}
})

// --------------------------------------------------------------------------
// График
// --------------------------------------------------------------------------
function nsSkySchedule(st, rs) {
	var level = nsSkyLevel()
	var dayTime = Number(level.getDayTime())
	var day = Math.floor(dayTime / 24000),
		tod = dayTime % 24000
	if (st.nextDay < 0) {
		st.nextDay = day + NS_SKY.everyDays[0]
		nsSkySave()
		return
	}
	if (day < st.nextDay - 10) st.nextDay = day + NS_SKY.everyDays[0] // время откатили командой
	var due = st.bonus || (day >= st.nextDay && (rs.phase || 0) >= NS_SKY.minPhase)
	if (!due) return
	if (tod < NS_SKY.dayFrom || tod > NS_SKY.dayTo) return
	if (nsSkyRaidBusy(rs) || rs.raid.state !== 'idle' || rs.minorPending) return
	if (NS_SKY.needPlayers && !nsSkyOverworldPlayers().length) return
	var altars = nsSkyAltars(rs)
	if (!altars.length) return
	var altar = altars[Math.floor(Math.random() * altars.length)]
	st.bonus = false
	st.nextDay = day + NS_SKY.everyDays[0] + Math.floor(Math.random() * (NS_SKY.everyDays[1] - NS_SKY.everyDays[0] + 1))
	nsSkyStartSearch(altar, {})
	console.info('[sky] метеорит по графику (день ' + day + '), следующий — день ' + st.nextDay)
}

NSG.nsSkyCounter = 0
ServerEvents.tick(event => {
	if (NSG.nsSkyFall) {
		try {
			nsSkyFallTick()
		} catch (e) {
			NSG.nsSkyFall = null
			console.error('[sky] анимация метеорита: ' + e)
		}
	}
	NSG.nsSkyCounter++
	if (NSG.nsSkyCounter % 20 !== 0) return
	if (!NSG.nsServer) return
	try {
		var st = nsSkyState()
		var rs = nsGetStateRO()
		// победа в набеге выбранной волны → шанс на внеочередной метеорит утром
		var cur = { state: rs.raid.state, kind: rs.raid.kind }
		var prev = NSG.nsSkyPrevRaid
		NSG.nsSkyPrevRaid = cur
		if (prev && prev.state === 'active' && prev.kind === 'challenge' && cur.state === 'idle' && !st.m && !st.bonus && Math.random() < NS_SKY.bonusChance) {
			st.bonus = true
			nsSkySave()
			nsTellAllSky(Text.gold('[Метеорит] ').append(Text.gray('Над полем боя мелькнул огненный след… Утром ждите метеорит.')))
		}
		if (st.search) nsSkySearchStep(rs)
		if (st.m) {
			var level = nsSkyLevel()
			if (st.m.stage === 'falling' && !NSG.nsSkyFall) nsSkyImpact() // рестарт посреди падения — сразу удар
			else if (st.m.stage === 'hot') {
				nsSkyHotTick(level, st.m, rs)
				if (st.m) nsSkySave()
			}
		} else if (!st.search && NSG.nsSkyCounter % 200 === 0) nsSkySchedule(st, rs)
	} catch (e) {
		console.error('[sky] тик метеорита: ' + e)
	}
})

// После /reload состояние читаем заново (NSG создаётся заново, но persistentData — та же)
ServerEvents.loaded(event => {
	NSG.nsSky = null
})

// --------------------------------------------------------------------------
// Команды оператора
// --------------------------------------------------------------------------
function nsSkyReply(ctx, text) {
	ctx.source.sendSystemMessage(Text.gold('[Метеорит] ').append(Text.white(text)))
}

function nsSkyCmdNow(ctx, prefer, cool) {
	var st = nsSkyState()
	if (st.m || st.search) {
		nsSkyReply(ctx, 'метеорит уже ' + (st.search ? 'ищет место' : 'лежит в ' + st.m.x + ' ' + st.m.z) + ' — /nsmeteor end')
		return 0
	}
	var rs = nsGetStateRO()
	var pos = ctx.source.getPosition()
	var best = null,
		bd = 1e18
	var altars = nsSkyAltars(rs)
	for (var i = 0; i < altars.length; i++) {
		var d = (altars[i].x - pos.x()) * (altars[i].x - pos.x()) + (altars[i].z - pos.z()) * (altars[i].z - pos.z())
		if (d < bd) {
			bd = d
			best = altars[i]
		}
	}
	if (!best) {
		best = { x: Math.floor(pos.x()), y: Math.floor(pos.y()), z: Math.floor(pos.z()), id: null }
		nsSkyReply(ctx, 'алтаря в Верхнем мире нет — считаю от вашей позиции')
	}
	nsSkyStartSearch(best, { prefer: prefer, cool: cool, who: 'op' })
	nsSkyReply(ctx, 'ищу место в ' + NS_SKY.distMin + '–' + NS_SKY.distMax + ' блоках от ' + (best.id ? 'алтаря ' + best.x + ' ' + best.z : 'вас') + (prefer ? ', сначала ' + prefer[0] + ' ' + prefer[1] : '') + (cool ? ', остывание ' + cool + ' с' : ''))
	return 1
}

// Проверка дележа без клиента: двое ботов-FakePlayer у кратера; первый ломает блок руды через ServerPlayerGameMode
// (то же событие BlockEvents.broken, что у игрока). Показывает, сколько досталось каждому.
function nsSkyTestBreak(ctx) {
	var st = nsSkyState()
	var m = st.m
	if (!m || m.stage !== 'hot') return nsSkyReply(ctx, 'нет горячего метеорита') || 0
	var level = nsSkyLevel()
	var target = null
	for (var i = 0; i < m.ore.length && !target; i++) if (String(level.getBlock(m.ore[i][0], m.ore[i][1], m.ore[i][2]).getId()) === 'nightshift:meteor_ore') target = m.ore[i]
	if (!target) return nsSkyReply(ctx, 'руды не осталось') || 0
	var Factory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')
	var Profile = Java.loadClass('com.mojang.authlib.GameProfile')
	var UUID = Java.loadClass('java.util.UUID')
	var bots = []
	var names = ['ТестПилот1', 'ТестПилот2']
	for (var b = 0; b < 2; b++) {
		var fp = Factory.get(level, new Profile(UUID.fromString('6e736b79-0000-4000-8000-00000000000' + (b + 1)), names[b]))
		fp.getInventory().clearContent()
		fp.setPos(m.x + 2 + b, m.y, m.z + 2)
		bots.push(fp)
	}
	NSG.nsSkyTestRecips = bots
	var before = String(level.getBlock(target[0], target[1], target[2]).getId())
	var broke = false
	try {
		broke = bots[0].gameMode.destroyBlock(new (Java.loadClass('net.minecraft.core.BlockPos'))(target[0], target[1], target[2]))
	} catch (e) {
		nsSkyReply(ctx, 'ошибка: ' + e)
	}
	NSG.nsSkyTestRecips = null
	var after = String(level.getBlock(target[0], target[1], target[2]).getId())
	var line = 'блок ' + target.join(' ') + ': ' + before + ' → ' + after + ' (сломан: ' + broke + '); '
	for (var k = 0; k < bots.length; k++) line += names[k] + ': ' + bots[k].getInventory().countItem(Item.of('nightshift:meteor_iron').getItem()) + ' метеоритного железа; '
	nsSkyReply(ctx, line + 'щит ' + (m.killed < m.guards ? 'ВКЛ' : 'снят'))
	return 1
}

// Команда без падения: ошибка — ответом оператору и в лог (Brigadier иначе пишет только «unexpected error»)
function nsSkyTry(ctx, fn) {
	try {
		var r = fn()
		return typeof r === 'number' ? r : 1
	} catch (e) {
		console.error('[sky] команда: ' + e)
		nsSkyReply(ctx, 'ошибка: ' + e)
		return 0
	}
}

function nsSkyCheckCmd(ctx, x, z) {
	var res = nsSkySiteCheck(nsSkyLevel(), x, z, nsGetStateRO())
	nsSkyReply(ctx, x + ' ' + z + ': ' + (res.ok ? 'годится, земля на y ' + (res.y - 1) : 'нельзя — ' + res.why))
	return 1
}

function nsSkyStatusCmd(ctx) {
	var st = nsSkyState()
	var rs = nsGetStateRO()
	nsSkyReply(ctx, 'день ' + nsSkyDay() + ', следующий по графику — день ' + st.nextDay + (st.bonus ? ' (+ внеочередной утром)' : '') + ', пройдено волн ' + (rs.phase || 0) + ' (график с ' + NS_SKY.minPhase + ')')
	if (st.search) nsSkyReply(ctx, 'ищу место: попыток ' + st.search.tries + '; ' + st.search.log.slice(-4).join('; '))
	var m = st.m
	if (!m) {
		nsSkyReply(ctx, 'метеорита нет' + (st.last ? ', прошлый — ' + st.last.x + ' ' + st.last.z + ' (день ' + st.last.day + ')' : ''))
		return 1
	}
	nsSkyReply(ctx, '#' + m.id + ' ' + m.stage + ' в ' + m.x + ' ' + m.y + ' ' + m.z + ', от алтаря ' + Math.round(Math.sqrt((m.x - m.ax) * (m.x - m.ax) + (m.z - m.az) * (m.z - m.az))) + ' бл.; остынет через ' + nsSkyClock(m.left))
	var alive = nsSkyFindGuards(nsSkyLevel(), m, NS_SKY.awayR).length
	nsSkyReply(ctx, 'стража: убито ' + m.killed + ' из ' + m.guards + ' (сейчас на месте ' + alive + ', летунов ' + m.fly + ', +' + Math.round(m.hp * 100) + ' % HP), щит ' + (m.killed < m.guards ? 'ВКЛ' : 'снят') + '; руды ' + (m.ore.length - m.mined) + ' из ' + m.ore.length + '; доли ' + JSON.stringify(m.shares))
	return 1
}

function nsSkyCoolCmd(ctx, sec) {
	var m = nsSkyState().m
	if (!m) {
		nsSkyReply(ctx, 'метеорита нет')
		return 0
	}
	m.left = Math.max(0, sec)
	nsSkySave()
	nsSkyReply(ctx, 'остынет через ' + nsSkyClock(m.left))
	return 1
}

function nsSkyEndCmd(ctx) {
	var st = nsSkyState()
	if (st.search && st.search.cand) nsSkyCmd('forceload remove ' + nsSkyCandArea(st.search.cand))
	st.search = null
	if (st.m) nsSkyCool(nsSkyLevel(), st.m, 'остыл')
	NSG.nsSkyFall = null
	nsSkySave()
	nsSkyReply(ctx, 'метеорит убран')
	return 1
}

function nsSkyGuardsCmd(ctx) {
	var m = nsSkyState().m
	if (!m || m.stage !== 'hot') {
		nsSkyReply(ctx, 'нет горячего метеорита')
		return 0
	}
	var level = nsSkyLevel()
	var n = nsSkySpawnGuards(level, m, nsSkyFindGuards(level, m, NS_SKY.awayR))
	m.lastSpawn = m.since
	nsSkySave()
	nsSkyReply(ctx, 'поставлено стражей: ' + n)
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var I = event.arguments.INTEGER
	event.register(
		Commands.literal('nsmeteor')
			.requires(src => src.hasPermission(2))
			.then(
				Commands.literal('now')
					.executes(ctx => nsSkyTry(ctx, () => nsSkyCmdNow(ctx, null, 0)))
					.then(Commands.argument('cool', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyCmdNow(ctx, null, Math.max(10, Number(I.getResult(ctx, 'cool')))))))
			)
			.then(Commands.literal('at').then(Commands.argument('x', I.create(event)).then(Commands.argument('z', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyCmdNow(ctx, [Number(I.getResult(ctx, 'x')), Number(I.getResult(ctx, 'z'))], 0))))))
			.then(Commands.literal('check').then(Commands.argument('x', I.create(event)).then(Commands.argument('z', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyCheckCmd(ctx, Number(I.getResult(ctx, 'x')), Number(I.getResult(ctx, 'z'))))))))
			.then(Commands.literal('status').executes(ctx => nsSkyTry(ctx, () => nsSkyStatusCmd(ctx))))
			.then(Commands.literal('cool').then(Commands.argument('sec', I.create(event)).executes(ctx => nsSkyTry(ctx, () => nsSkyCoolCmd(ctx, Number(I.getResult(ctx, 'sec')))))))
			.then(Commands.literal('end').executes(ctx => nsSkyTry(ctx, () => nsSkyEndCmd(ctx))))
			.then(Commands.literal('guards').executes(ctx => nsSkyTry(ctx, () => nsSkyGuardsCmd(ctx))))
			.then(Commands.literal('testbreak').executes(ctx => nsSkyTry(ctx, () => nsSkyTestBreak(ctx))))
	)
})
