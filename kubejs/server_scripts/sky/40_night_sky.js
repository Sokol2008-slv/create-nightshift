// ==========================================================================
// Ночное небо (3.4.0, 05.10.2026): два ночных события Верхнего мира, по одному за ночь.
//
//  - ЗВЕЗДОПАД. Каждые 25–45 с у каждого игрока в Верхнем мире падает звезда: огненный росчерк с неба и
//    светящийся блок «Упавшая звезда» в 40–140 блоках, на природной поверхности (не в зоне базы, не в воду).
//    Над звездой — столб искр (видно издалека), над хотбаром — расстояние и стрелка до ближайшей.
//    Бьётся рукой: 1–2 звёздных осколка и 2–3 звёздной пыли (12 % — ещё небесный кристалл), +5 % рассудка и
//    «желание» — случайный короткий эффект. На рассвете несобранные звёзды гаснут. До 5 звёзд на игрока за ночь.
//  - СЕВЕРНОЕ СИЯНИЕ. Над головой у каждого, кто под открытым небом, — волнистые зелёно-фиолетовые полотна.
//    Под сиянием рассудок понемногу растёт (+1 % в 20 с).
//  Шанс события — 30 % на ночь (звездопад чаще), не во время набега. Ночь набега событие не отменяет: на время
//  набега звёзды не падают и сияние гаснет, потом всё продолжается.
// Звёздный осколок (только звездопад): 4 → небесный кристалл (пресс), «Сердце ночи» без набега (миксер).
// Звёздная пыль — та же, что с форпоста «Обсерватория» (nightshift:stardust): звёздный фонарь (деплоер по стеклу).
// Блоки — startup_scripts/sky/20_night_sky_blocks.js, текстуры — tools/gen_starfall.py.
// Команды (оператор): /nsnight status | starfall | aurora | stop | drop <x> <z>
// Состояние — server.persistentData «ns_night_sky_json».
// Хелперы метеорита (nsSkyNatural, nsSkyArrow, nsSkyLevel, nsSkyOverworldPlayers…) — sky/10_meteor.js.
// ==========================================================================

var NS_NSKY = {
	chance: 0.3, // шанс события в ночь
	starShare: 0.6, // из событий — звездопад, остальное — сияние
	duskFrom: 12600, // объявление события: начало ночи (время суток)
	duskTo: 14000,
	dawn: 23200, // рассвет: событие кончается, звёзды гаснут
	starEvery: [25, 45], // секунд между звёздами у игрока
	starsPerPlayer: 5,
	starDist: [40, 140],
	starCap: 18, // звёзд в мире одновременно
	zoneClear: 24, // не ближе к зоне базы
	shards: [1, 2],
	dust: [2, 3],
	crystalChance: 0.12,
	sanityStar: 5,
	auroraSanity: 1, // % рассудка
	auroraSanityEvery: 20, // секунд
	navR: 160, // стрелка до звезды, если ближе
}
var NS_NSKY_KEY = 'ns_night_sky_json'
var NS_NSKY_BLOCKPOS = Java.loadClass('net.minecraft.core.BlockPos')
var NS_NSKY_HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
var NS_NSKY_DUST_OPT = Java.loadClass('net.minecraft.core.particles.DustParticleOptions')
var NS_NSKY_VEC3F = Java.loadClass('org.joml.Vector3f')
var NS_NSKY_PT = Java.loadClass('net.minecraft.core.particles.ParticleTypes')
var NS_NSKY_WISHES = [
	{ eff: 'minecraft:night_vision', sec: 300, lvl: 0, name: 'ночное зрение' },
	{ eff: 'minecraft:haste', sec: 180, lvl: 1, name: 'спорая работа' },
	{ eff: 'minecraft:speed', sec: 120, lvl: 0, name: 'лёгкий шаг' },
	{ eff: 'minecraft:regeneration', sec: 20, lvl: 1, name: 'второе дыхание' },
	{ eff: 'minecraft:jump_boost', sec: 90, lvl: 1, name: 'прыжок до звёзд' },
	{ eff: 'minecraft:slow_falling', sec: 60, lvl: 0, name: 'плавное падение' },
	{ eff: 'minecraft:luck', sec: 600, lvl: 0, name: 'удача' },
]

// --------------------------------------------------------------------------
// Состояние
// --------------------------------------------------------------------------
function nsNskyDefault() {
	return { day: -1, ev: null, stars: [], fade: [], given: {}, next: {} }
}
function nsNskyState() {
	if (NSG.nsNsky) return NSG.nsNsky
	var st = nsNskyDefault()
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_NSKY_KEY)) st = Object.assign(nsNskyDefault(), JSON.parse(String(pd.getString(NS_NSKY_KEY))))
	} catch (e) {
		console.warn('[night-sky] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsNsky = st
	return st
}
function nsNskySave() {
	try {
		NSG.nsServer.persistentData.putString(NS_NSKY_KEY, JSON.stringify(nsNskyState()))
	} catch (e) {
		console.warn('[night-sky] не сохранить состояние: ' + e)
	}
}
function nsNskyRand(a, b) {
	return a + Math.random() * (b - a)
}
function nsNskyLoaded(level, x, z) {
	try {
		return level.isLoaded(new NS_NSKY_BLOCKPOS(x, 64, z))
	} catch (e) {}
	return false
}
function nsNskyInZone(rs, x, z, pad) {
	for (var i = 0; i < rs.zones.length; i++) {
		var zn = rs.zones[i]
		if (zn.dim !== 'minecraft:overworld') continue
		if (x >= zn.minX - pad && x <= zn.maxX + pad && z >= zn.minZ - pad && z <= zn.maxZ + pad) return true
	}
	return false
}
function nsNskyBusy(rs) {
	return rs.raid.state === 'countdown' || rs.raid.state === 'active'
}

// --------------------------------------------------------------------------
// Начало и конец события
// --------------------------------------------------------------------------
function nsNskyTitle(title, color, sub) {
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run title @a[distance=0..] times 10 70 20')
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run title @a[distance=0..] subtitle ' + JSON.stringify({ text: sub, color: 'gray' }))
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run title @a[distance=0..] title ' + JSON.stringify({ text: title, color: color }))
}
function nsNskyStart(st, ev, why) {
	st.ev = ev
	st.given = {}
	st.next = {}
	nsNskySave()
	if (ev === 'starfall') {
		nsNskyTitle('Звездопад', 'aqua', 'Звёзды падают рядом. Собери до рассвета')
		NSG.nsServer.runCommandSilent('execute in minecraft:overworld as @a[distance=0..] at @s run playsound minecraft:block.amethyst_block.resonate ambient @s ~ ~ ~ 1 0.6')
	} else {
		nsNskyTitle('Северное сияние', 'green', 'Под открытым небом спокойнее')
		NSG.nsServer.runCommandSilent('execute in minecraft:overworld as @a[distance=0..] at @s run playsound minecraft:block.beacon.ambient ambient @s ~ ~ ~ 1 1.4')
	}
	console.info('[night-sky] событие ' + ev + ' (' + why + ')')
}
function nsNskyEnd(st, why) {
	if (!st.ev) return
	var was = st.ev
	st.ev = null
	for (var i = 0; i < st.stars.length; i++) st.fade.push(st.stars[i])
	st.stars = []
	nsNskySave()
	if (was === 'starfall') NSG.nsServer.runCommandSilent('execute in minecraft:overworld run title @a[distance=0..] actionbar ' + JSON.stringify({ text: '★ Рассвет: несобранные звёзды гаснут', color: 'gray' }))
	console.info('[night-sky] событие ' + was + ' закончилось (' + why + ')')
}

// Раз в ночь: бросок на событие
function nsNskySchedule(st, rs, level) {
	var dt = Number(level.getDayTime())
	var day = Math.floor(dt / 24000),
		tod = dt % 24000
	if (st.ev) {
		if (tod >= NS_NSKY.dawn || tod < NS_NSKY.duskFrom - 600) nsNskyEnd(st, 'рассвет')
		return
	}
	if (st.day === day || tod < NS_NSKY.duskFrom || tod > NS_NSKY.duskTo) return
	st.day = day
	nsNskySave()
	if (!nsSkyOverworldPlayers().length) return
	if (Math.random() >= NS_NSKY.chance) return
	nsNskyStart(st, Math.random() < NS_NSKY.starShare ? 'starfall' : 'aurora', 'ночь ' + day)
}

// --------------------------------------------------------------------------
// Звездопад
// --------------------------------------------------------------------------
NSG.nsNskyFalls = []

// Точка падения рядом с игроком. Возвращает {x, y, z} или null; why (массив) — причины отказов для команды.
function nsNskyPickSpot(level, rs, cx, cz, why) {
	for (var t = 0; t < 10; t++) {
		var a = Math.random() * Math.PI * 2
		var d = nsNskyRand(NS_NSKY.starDist[0], NS_NSKY.starDist[1])
		var x = Math.floor(cx + Math.cos(a) * d),
			z = Math.floor(cz + Math.sin(a) * d)
		var r = nsNskySpotWhy(level, rs, x, z)
		if (r.ok) return r
		if (why) why.push(x + ' ' + z + ': ' + r.why)
	}
	return null
}
function nsNskySpotWhy(level, rs, x, z) {
	if (!nsNskyLoaded(level, x, z)) return { ok: false, why: 'чанк не загружен' }
	if (nsNskyInZone(rs, x, z, NS_NSKY.zoneClear)) return { ok: false, why: 'зона базы' }
	var y = Number(level.getHeight(NS_NSKY_HM.MOTION_BLOCKING_NO_LEAVES, x, z))
	var ground = level.getBlock(x, y - 1, z)
	var gid = String(ground.getId())
	if (/water|lava|bubble|ice$/.test(gid) || gid === 'minecraft:air') return { ok: false, why: 'под ногами ' + gid }
	if (!nsSkyNatural(ground)) return { ok: false, why: 'не природа: ' + gid }
	var at = level.getBlock(x, y, z)
	var aid = String(at.getId())
	if (/water|lava/.test(aid) || (aid !== 'minecraft:air' && !nsSkyNatural(at))) return { ok: false, why: 'место занято: ' + aid }
	return { ok: true, x: x, y: y, z: z }
}

function nsNskyLaunch(level, spot, owner) {
	var a = Math.random() * Math.PI * 2
	NSG.nsNskyFalls.push({
		fx: spot.x + 0.5 + Math.cos(a) * 70,
		fy: Math.min(310, spot.y + 110),
		fz: spot.z + 0.5 + Math.sin(a) * 70,
		tx: spot.x + 0.5,
		ty: spot.y + 0.5,
		tz: spot.z + 0.5,
		x: spot.x,
		y: spot.y,
		z: spot.z,
		t: 0,
		dur: 36,
		owner: owner,
	})
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run playsound minecraft:entity.firework_rocket.launch ambient @a ' + spot.x + ' ' + spot.y + ' ' + spot.z + ' 6 0.5')
}

function nsNskyParticles(level, opt, x, y, z, n, dx, dy, dz, sp) {
	try {
		level.sendParticles(opt, x, y, z, n, dx, dy, dz, sp)
		return
	} catch (e) {}
}
// частицы, видные издалека (long distance), только этому игроку
function nsNskyFar(level, p, opt, x, y, z, n, dx, dy, dz, sp) {
	try {
		level.sendParticles(p, opt, true, x, y, z, n, dx, dy, dz, sp)
	} catch (e) {}
}

function nsNskyFallTick(level) {
	var falls = NSG.nsNskyFalls
	if (!falls.length) return
	var keep = []
	var ps = nsSkyOverworldPlayers()
	for (var i = 0; i < falls.length; i++) {
		var f = falls[i]
		f.t++
		var k = Math.pow(Math.min(1, f.t / f.dur), 1.5)
		var px = f.fx + (f.tx - f.fx) * k,
			py = f.fy + (f.ty - f.fy) * k,
			pz = f.fz + (f.tz - f.fz) * k
		for (var j = 0; j < ps.length; j++) {
			nsNskyFar(level, ps[j], NS_NSKY_PT.END_ROD, px, py, pz, 6, 0.3, 0.3, 0.3, 0.02)
			nsNskyFar(level, ps[j], NS_NSKY_PT.FIREWORK, px, py, pz, 4, 0.5, 0.5, 0.5, 0.03)
		}
		if (f.t < f.dur) {
			keep.push(f)
			continue
		}
		try {
			nsNskyLand(level, f)
		} catch (e) {
			console.error('[night-sky] посадка звезды: ' + e)
		}
	}
	NSG.nsNskyFalls = keep
}

function nsNskyLand(level, f) {
	var st = nsNskyState()
	var at = String(level.getBlock(f.x, f.y, f.z).getId())
	if (!nsNskyLoaded(level, f.x, f.z) || (at !== 'minecraft:air' && !nsSkyNatural(level.getBlock(f.x, f.y, f.z)))) return
	level.getBlock(f.x, f.y, f.z).set('nightshift:fallen_star')
	st.stars.push({ x: f.x, y: f.y, z: f.z, o: f.owner })
	nsNskySave()
	var c = f.x + 0.5 + ' ' + (f.y + 0.5) + ' ' + (f.z + 0.5)
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run particle minecraft:flash ' + c + ' 0 0 0 0 1 force')
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run particle minecraft:end_rod ' + c + ' 0.4 0.4 0.4 0.15 50 force')
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run playsound minecraft:entity.firework_rocket.twinkle_far ambient @a ' + c + ' 6 1')
	NSG.nsServer.runCommandSilent('execute in minecraft:overworld run playsound minecraft:block.amethyst_block.chime block @a ' + c + ' 2 0.7')
}

function nsNskyStarTick(st, rs, level, sec) {
	if (nsNskyBusy(rs)) return
	var ps = nsSkyOverworldPlayers()
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		var name = nsSkyName(p)
		var given = st.given[name] || 0
		if (given >= NS_NSKY.starsPerPlayer) continue
		if (st.next[name] === undefined) st.next[name] = sec + Math.round(nsNskyRand(5, 15))
		if (sec < st.next[name]) continue
		if (st.stars.length + NSG.nsNskyFalls.length >= NS_NSKY.starCap) continue
		st.next[name] = sec + Math.round(nsNskyRand(NS_NSKY.starEvery[0], NS_NSKY.starEvery[1]))
		var spot = nsNskyPickSpot(level, rs, Number(p.getX()), Number(p.getZ()))
		if (!spot) continue
		st.given[name] = given + 1
		nsNskyLaunch(level, spot, name)
	}
}

// Столбы искр над звёздами и стрелка до ближайшей
function nsNskyBeacons(st, level, sec) {
	var ps = nsSkyOverworldPlayers()
	var meteor = false
	try {
		meteor = !!nsSkyState().m
	} catch (e) {}
	for (var i = 0; i < st.stars.length; i++) {
		var s = st.stars[i]
		if (!nsNskyLoaded(level, s.x, s.z)) continue
		for (var j = 0; j < ps.length; j++) nsNskyFar(level, ps[j], NS_NSKY_PT.END_ROD, s.x + 0.5, s.y + 2.5, s.z + 0.5, 5, 0.08, 1.6, 0.08, 0.004)
	}
	if (meteor) return // у метеорита своя стрелка над хотбаром
	for (var k = 0; k < ps.length; k++) {
		var p = ps[k]
		var best = null,
			bd = NS_NSKY.navR * NS_NSKY.navR
		for (var m = 0; m < st.stars.length; m++) {
			var dx = st.stars[m].x + 0.5 - Number(p.getX()),
				dz = st.stars[m].z + 0.5 - Number(p.getZ())
			var d2 = dx * dx + dz * dz
			if (d2 < bd) {
				bd = d2
				best = { dx: dx, dz: dz }
			}
		}
		if (!best) continue
		var dist = Math.round(Math.sqrt(bd))
		p.setStatusMessage(Text.aqua('★ Звезда: ' + dist + ' бл. ' + nsSkyArrow(p, best.dx, best.dz)).append(Text.gray(dist < 6 ? '  — бей рукой' : '')))
	}
}

// Звёзды, которые надо погасить (рассвет) или потеряли (сломаны не игроком): проверяем, когда чанк загружен
function nsNskyFadeTick(st, level) {
	var changed = false
	var keep = []
	for (var i = 0; i < st.fade.length; i++) {
		var s = st.fade[i]
		if (!nsNskyLoaded(level, s.x, s.z)) {
			keep.push(s)
			continue
		}
		var b = level.getBlock(s.x, s.y, s.z)
		if (String(b.getId()) === 'nightshift:fallen_star') {
			b.set('minecraft:air')
			NSG.nsServer.runCommandSilent('execute in minecraft:overworld run particle minecraft:end_rod ' + (s.x + 0.5) + ' ' + (s.y + 0.5) + ' ' + (s.z + 0.5) + ' 0.3 0.6 0.3 0.02 20 force')
		}
		changed = true
	}
	st.fade = keep
	var alive = []
	for (var j = 0; j < st.stars.length; j++) {
		var t = st.stars[j]
		if (nsNskyLoaded(level, t.x, t.z) && String(level.getBlock(t.x, t.y, t.z).getId()) !== 'nightshift:fallen_star') {
			changed = true
			continue
		}
		alive.push(t)
	}
	st.stars = alive
	if (changed) nsNskySave()
}

BlockEvents.broken('nightshift:fallen_star', event => {
	try {
		var b = event.getBlock()
		var x = Number(b.getX()),
			y = Number(b.getY()),
			z = Number(b.getZ())
		var c = x + 0.5 + ' ' + (y + 0.4) + ' ' + (z + 0.5)
		// KubeJS отдаёт измерение уровня свойством (ResourceLocation), а не методом Mojang
		var lv = b.getLevel()
		var dim = String(typeof lv.dimension === 'function' ? lv.dimension().location() : lv.dimension)
		var n = NS_NSKY.shards[0] + Math.floor(Math.random() * (NS_NSKY.shards[1] - NS_NSKY.shards[0] + 1))
		var nd = NS_NSKY.dust[0] + Math.floor(Math.random() * (NS_NSKY.dust[1] - NS_NSKY.dust[0] + 1))
		NSG.nsServer.runCommandSilent('execute in ' + dim + ' run summon minecraft:item ' + c + ' {Item:{id:"nightshift:star_shard",count:' + n + '},PickupDelay:5s}')
		NSG.nsServer.runCommandSilent('execute in ' + dim + ' run summon minecraft:item ' + c + ' {Item:{id:"nightshift:stardust",count:' + nd + '},PickupDelay:5s}')
		var crystal = Math.random() < NS_NSKY.crystalChance
		if (crystal) NSG.nsServer.runCommandSilent('execute in ' + dim + ' run summon minecraft:item ' + c + ' {Item:{id:"nightshift:sky_crystal",count:1},PickupDelay:5s}')
		NSG.nsServer.runCommandSilent('execute in ' + dim + ' run particle minecraft:end_rod ' + c + ' 0.3 0.3 0.3 0.2 40 force')
		NSG.nsServer.runCommandSilent('execute in ' + dim + ' run playsound minecraft:block.amethyst_block.break block @a ' + c + ' 1.5 1.4')
		var st = nsNskyState()
		var keep = []
		for (var i = 0; i < st.stars.length; i++) if (!(st.stars[i].x === x && st.stars[i].y === y && st.stars[i].z === z)) keep.push(st.stars[i])
		st.stars = keep
		nsNskySave()
		var p = event.getEntity()
		if (!p || !p.isPlayer()) return
		var name = nsSkyName(p)
		var w = NS_NSKY_WISHES[Math.floor(Math.random() * NS_NSKY_WISHES.length)]
		NSG.nsServer.runCommandSilent('sanity add ' + name + ' ' + NS_NSKY.sanityStar)
		NSG.nsServer.runCommandSilent('effect give ' + name + ' ' + w.eff + ' ' + w.sec + ' ' + w.lvl)
		NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:entity.player.levelup player @s ~ ~ ~ 0.6 1.8')
		p.setStatusMessage(Text.aqua('★ Желание: ' + w.name).append(Text.gray('  · осколки ×' + n + ', пыль ×' + nd + (crystal ? ', небесный кристалл' : ''))))
	} catch (e) {
		console.error('[night-sky] сбор звезды: ' + e)
	}
})

// --------------------------------------------------------------------------
// Северное сияние: полотна частиц у каждого под открытым небом
// --------------------------------------------------------------------------
NSG.nsNskyAuroraOpts = null
function nsNskyAuroraOpts() {
	if (NSG.nsNskyAuroraOpts) return NSG.nsNskyAuroraOpts
	NSG.nsNskyAuroraOpts = [
		new NS_NSKY_DUST_OPT(new NS_NSKY_VEC3F(0.25, 1.0, 0.55), 4.0),
		new NS_NSKY_DUST_OPT(new NS_NSKY_VEC3F(0.15, 0.85, 0.75), 4.0),
		new NS_NSKY_DUST_OPT(new NS_NSKY_VEC3F(0.65, 0.35, 1.0), 4.0),
	]
	return NSG.nsNskyAuroraOpts
}
function nsNskyUnderSky(level, p) {
	try {
		return level.canSeeSky(NS_NSKY_BLOCKPOS.containing(p.getX(), p.getEyeY() + 1, p.getZ()))
	} catch (e) {}
	return false
}
function nsNskyAuroraTick(level, tick) {
	var ps = nsSkyOverworldPlayers()
	var opts = nsNskyAuroraOpts()
	var t = tick / 20
	for (var i = 0; i < ps.length; i++) {
		var p = ps[i]
		if (!nsNskyUnderSky(level, p)) continue
		var px = Number(p.getX()),
			py = Number(p.getY()),
			pz = Number(p.getZ())
		var base = Math.min(300, Math.max(py + 30, 120))
		// два полотна: ближнее на севере и дальнее на северо-востоке, волна бежит вдоль полотна
		for (var band = 0; band < 2; band++) {
			var dist = band === 0 ? 38 : 52
			var ang = band === 0 ? 0 : 0.6
			for (var s = -9; s <= 9; s++) {
				var along = s * 6
				var wz = Math.sin(along / 17 + t * 0.35 + band) * 7
				var wy = Math.sin(along / 11 - t * 0.5 + band * 2) * 4
				var lx = along,
					lz = -dist + wz
				var x = px + lx * Math.cos(ang) - lz * Math.sin(ang),
					z = pz + lx * Math.sin(ang) + lz * Math.cos(ang)
				var y = base + band * 6 + wy
				nsNskyFar(level, p, opts[band], x, y, z, 14, 1.2, 3.5, 0.4, 0)
				nsNskyFar(level, p, opts[2], x, y + 6, z, 6, 1.2, 1.5, 0.4, 0)
				if ((s + band + Math.floor(t)) % 5 === 0) nsNskyFar(level, p, NS_NSKY_PT.GLOW, x, y - 2, z, 3, 1, 2, 0.4, 0)
			}
		}
	}
}
function nsNskyAuroraSanity(level) {
	var ps = nsSkyOverworldPlayers()
	for (var i = 0; i < ps.length; i++) if (nsNskyUnderSky(level, ps[i])) NSG.nsServer.runCommandSilent('sanity add ' + nsSkyName(ps[i]) + ' ' + NS_NSKY.auroraSanity)
}

// --------------------------------------------------------------------------
// Тик
// --------------------------------------------------------------------------
NSG.nsNskyCounter = 0
ServerEvents.tick(event => {
	if (!NSG.nsServer) return
	NSG.nsNskyCounter++
	var tick = NSG.nsNskyCounter
	try {
		var level = nsSkyLevel()
		if (NSG.nsNskyFalls.length) nsNskyFallTick(level)
		var st = nsNskyState()
		if (st.ev === 'aurora' && tick % 10 === 0) {
			var rs0 = nsGetStateRO()
			if (!nsNskyBusy(rs0)) nsNskyAuroraTick(level, tick)
		}
		if (tick % 20 !== 0) return
		var rs = nsGetStateRO()
		var sec = Math.floor(tick / 20)
		nsNskySchedule(st, rs, level)
		if (st.ev === 'starfall') nsNskyStarTick(st, rs, level, sec)
		if (st.stars.length) nsNskyBeacons(st, level, sec)
		if (st.ev === 'aurora' && sec % NS_NSKY.auroraSanityEvery === 0 && !nsNskyBusy(rs)) nsNskyAuroraSanity(level)
		if (sec % 10 === 0 && (st.fade.length || st.stars.length)) nsNskyFadeTick(st, level)
	} catch (e) {
		console.error('[night-sky] тик: ' + e)
	}
})

ServerEvents.loaded(event => {
	NSG.nsNsky = null
	NSG.nsNskyFalls = []
})

// --------------------------------------------------------------------------
// Рецепты звёздной пыли (по правилам «Вахты» — только машины)
// --------------------------------------------------------------------------
ServerEvents.recipes(event => {
	// 4 осколка → небесный кристалл: пресс над бассейном
	event.recipes.create.compacting('nightshift:sky_crystal', ['4x nightshift:star_shard']).id('nightshift:sky/compacting/sky_crystal_from_shards')
	// звёздный фонарь: деплоер кладёт звёздную пыль на стекло
	event.recipes.create.deploying('nightshift:star_lamp', ['minecraft:glass', 'nightshift:stardust']).id('nightshift:sky/deploying/star_lamp')
	// «Сердце ночи» без набега: дорого — около двух звездопадов на троих (бонус сердец по-прежнему до 5)
	event.recipes.create
		.mixing('nightshift:night_heart', ['16x nightshift:star_shard', '2x nightshift:sky_crystal', 'nightshift:life_tonic'])
		.superheated()
		.id('nightshift:sky/mixing/night_heart_from_stars')
})

// --------------------------------------------------------------------------
// Команды оператора
// --------------------------------------------------------------------------
function nsNskyReply(ctx, text) {
	ctx.source.sendSystemMessage(Text.of(text))
}
ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('nsnight')
			.requires(s => s.hasPermission(2))
			.then(
				C.literal('status').executes(ctx => {
					var st = nsNskyState()
					nsNskyReply(ctx, '[ночь] событие: ' + (st.ev || 'нет') + ', звёзд: ' + st.stars.length + ', гаснут: ' + st.fade.length + ', выдано: ' + JSON.stringify(st.given) + ', ночь броска: ' + st.day)
					return 1
				})
			)
			.then(
				C.literal('starfall').executes(ctx => {
					nsNskyStart(nsNskyState(), 'starfall', 'команда')
					return 1
				})
			)
			.then(
				C.literal('aurora').executes(ctx => {
					nsNskyStart(nsNskyState(), 'aurora', 'команда')
					return 1
				})
			)
			.then(
				C.literal('stop').executes(ctx => {
					nsNskyEnd(nsNskyState(), 'команда')
					return 1
				})
			)
			.then(
				C.literal('drop').then(
					C.argument('x', A.INTEGER.create(event)).then(
						C.argument('z', A.INTEGER.create(event)).executes(ctx => {
							try {
								var level = nsSkyLevel()
								var x = Number(A.INTEGER.getResult(ctx, 'x')),
									z = Number(A.INTEGER.getResult(ctx, 'z'))
								var why = []
								var spot = nsNskyPickSpot(level, nsGetStateRO(), x, z, why)
								if (!spot) {
									nsNskyReply(ctx, '[ночь] места рядом нет: ' + why.slice(0, 4).join('; '))
									return 0
								}
								nsNskyLaunch(level, spot, 'команда')
								nsNskyReply(ctx, '[ночь] звезда летит в ' + spot.x + ' ' + spot.y + ' ' + spot.z)
							} catch (e) {
								nsNskyReply(ctx, '[ночь] ошибка: ' + e)
							}
							return 1
						})
					)
				)
			)
	)
})
