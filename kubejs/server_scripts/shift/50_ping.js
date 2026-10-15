// «Пинг напарнику» (15.10.2026, игра вдвоём): /ping, /пинг (клавиша аддона — Alt + колёсико).
// Точка — куда смотрит игрок: моб на луче («Цель: Зомби», столб идёт за ним), блок или, если в небо, 64 блока по взгляду.
// Всем в том же измерении: столб частиц на 10 с (force — виден издалека), строка в чат с расстоянием и стороной света
// для каждого своя (клик — метка Xaero через /atlas wp_at … mark …, shift/20_atlas.js), над хотбаром — стрелка
// относительно взгляда (как навигатор метеорита, sky/10_meteor.js), остальным — звонок. Откат 2 с, у игрока не больше
// двух пингов сразу (третий гасит самый старый).
// Луч — до 256 блоков, но не дальше загруженных чанков вокруг игрока (иначе сервер грузил бы чанки посреди луча).

var NS_PING_LIFE = 200 // 10 с
var NS_PING_CD = 40 // 2 с
var NS_PING_RANGE = 256
var NS_PING_SKY = 64
var NS_PING_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_PING_POS = Java.loadClass('net.minecraft.core.BlockPos')
var NS_PING_LIVING = Java.loadClass('net.minecraft.world.entity.LivingEntity')

function nsPingName(p) {
	try {
		return String(p.getUsername())
	} catch (e) {}
	return String(p.getGameProfile().getName())
}
function nsPingDim(lv) {
	try {
		return String(typeof lv.dimension === 'function' ? lv.dimension().location() : lv.dimension)
	} catch (e) {}
	return String(lv.getDimension())
}
function nsPingNow() {
	return Number(NSG.nsServer.getTickCount())
}
function nsPingCompass(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI
	if (ang < 0) ang += 360
	return ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад'][Math.round(ang / 45) % 8]
}
// стрелка к точке относительно взгляда (yaw Minecraft: 0 — юг, растёт по часовой; getYaw — getYRot из Rhino не виден)
function nsPingArrow(p, dx, dz) {
	try {
		if (dx * dx + dz * dz < 4) return '•'
		var want = (Math.atan2(-dx, dz) * 180) / Math.PI
		var rel = ((((want - Number(p.getYaw())) % 360) + 540) % 360) - 180
		return ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘', '↓'][Math.round((rel + 180) / 45)]
	} catch (e) {
		return '•'
	}
}

// Дальность луча: не дальше загруженного квадрата чанков вокруг игрока (view distance сервера)
function nsPingReach(p, look) {
	var vd = 10
	try {
		vd = Number(NSG.nsServer.getPlayerList().getViewDistance())
	} catch (e) {}
	var lim = Math.max(32, (vd - 1) * 16)
	var hor = Math.max(Math.abs(Number(look.x)), Math.abs(Number(look.z)))
	var r = NS_PING_RANGE
	if (hor > 0.001) r = Math.min(r, lim / hor)
	var eye = p.getEyePosition()
	var lv = p.getLevel()
	// конец луча в незагруженном чанке — укорачиваем
	for (var i = 0; i < 4 && r > 16; i++) {
		try {
			if (lv.isLoaded(NS_PING_POS.containing(eye.x + look.x * r, eye.y + look.y * r, eye.z + look.z * r))) break
		} catch (e) {
			break
		}
		r = r / 2
	}
	return r
}

// Куда смотрит игрок: { x, y, z, mob, label }; y — низ столба
function nsPingAim(p) {
	var eye = p.getEyePosition()
	var look = p.getLookAngle()
	var reach = nsPingReach(p, look)
	var hit = p.pick(reach, 0, false)
	var blockHit = hit != null && String(hit.getType()) === 'BLOCK'
	var dist = blockHit ? eye.distanceTo(hit.getLocation()) : reach
	// моб на луче ближе блока (ищем в пределах 96 блоков — коробка вдоль всего луча слишком велика)
	var md = Math.min(dist, 96)
	var ex = eye.x + look.x * md,
		ey = eye.y + look.y * md,
		ez = eye.z + look.z * md
	var box = new NS_PING_AABB(Math.min(eye.x, ex) - 2, Math.min(eye.y, ey) - 2, Math.min(eye.z, ez) - 2, Math.max(eye.x, ex) + 2, Math.max(eye.y, ey) + 2, Math.max(eye.z, ez) + 2)
	var best = null,
		bestT = md
	try {
		var list = p.getLevel().getEntitiesWithin(box)
		for (var i = 0; i < list.size(); i++) {
			var e = list.get(i)
			if (e === p || Number(e.getId()) === Number(p.getId())) continue
			if (!(e instanceof NS_PING_LIVING) || !e.isAlive()) continue
			var cx = e.getX() - eye.x,
				cy = e.getY() + e.getBbHeight() / 2 - eye.y,
				cz = e.getZ() - eye.z
			var t = cx * look.x + cy * look.y + cz * look.z
			if (t <= 0 || t > bestT) continue
			var px = cx - look.x * t,
				py = cy - look.y * t,
				pz = cz - look.z * t
			var rad = Math.max(e.getBbWidth(), e.getBbHeight()) / 2 + 0.3
			if (px * px + py * py + pz * pz > rad * rad) continue
			best = e
			bestT = t
		}
	} catch (e) {
		console.error('[ping] поиск моба: ' + e)
	}
	if (best) return { x: Number(best.getX()), y: Number(best.getY()), z: Number(best.getZ()), mob: best, label: 'Цель: ' + String(best.getDisplayName().getString()) }
	if (blockHit) {
		var bp = hit.getBlockPos()
		return { x: Number(bp.getX()) + 0.5, y: Number(bp.getY()) + 1, z: Number(bp.getZ()) + 0.5, mob: null, label: 'сюда' }
	}
	// в небо — точка в 64 блоках по взгляду
	var sd = Math.min(NS_PING_SKY, reach)
	return { x: eye.x + look.x * sd, y: eye.y + look.y * sd, z: eye.z + look.z * sd, mob: null, label: 'сюда' }
}

// Строка в чат получателю: своё расстояние и сторона света, клик — метка Xaero
function nsPingTell(r, ping) {
	var bx = Math.floor(ping.x),
		by = Math.floor(ping.y),
		bz = Math.floor(ping.z)
	var dx = ping.x - Number(r.getX()),
		dy = ping.y - Number(r.getY()),
		dz = ping.z - Number(r.getZ())
	var d = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))
	var mine = nsPingName(r) === ping.owner
	var where = mine ? '' : d < 3 ? ' (рядом с тобой)' : ' (' + d + ' бл., ' + nsPingCompass(dx, dz) + ' от тебя)'
	var wp = '/atlas wp_at ' + bx + ' ' + by + ' ' + bz + ' mark 14 П ' + ping.dim + ' Пинг ' + ping.owner
	var line = [
		{ text: '[Пинг] ', color: 'gold' },
		{ text: ping.owner + ': ', color: 'yellow' },
		{ text: ping.label + ' — ', color: 'white' },
		{
			text: bx + ' ' + by + ' ' + bz,
			color: 'aqua',
			underlined: true,
			clickEvent: { action: 'run_command', value: wp },
			hoverEvent: { action: 'show_text', contents: 'Клик — метка на карте Xaero' },
		},
		{ text: where, color: 'gray' },
	]
	NSG.nsServer.runCommandSilent('tellraw ' + nsPingName(r) + ' ' + JSON.stringify(line))
}

function nsPingSend(p) {
	var name = nsPingName(p)
	var now = nsPingNow()
	NSG.nsPingCd = NSG.nsPingCd || {}
	if (NSG.nsPingCd[name] && now - NSG.nsPingCd[name] < NS_PING_CD) return
	NSG.nsPingCd[name] = now
	var a = nsPingAim(p)
	var ping = { owner: name, dim: nsPingDim(p.getLevel()), x: a.x, y: a.y, z: a.z, mob: a.mob, label: a.label, start: now, until: now + NS_PING_LIFE }
	// не больше двух пингов на игрока: третий гасит самый старый
	var list = NSG.nsPings || []
	var own = 0
	for (var i = list.length - 1; i >= 0; i--) {
		if (list[i].owner !== name) continue
		own++
		if (own >= 2) list.splice(i, 1)
	}
	list.push(ping)
	NSG.nsPings = list
	var ps = NSG.nsServer.getPlayers()
	for (var j = 0; j < ps.length; j++) {
		var r = ps[j]
		if (nsPingDim(r.getLevel()) !== ping.dim) continue
		nsPingTell(r, ping)
		if (nsPingName(r) !== name) NSG.nsServer.runCommandSilent('execute as ' + nsPingName(r) + ' at @s run playsound minecraft:block.note_block.bell player @s ~ ~ ~ 0.9 1.5')
		else NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:block.note_block.hat player @s ~ ~ ~ 0.5 1.6')
	}
	nsPingDraw(ping)
}

// Столб: светящиеся искры от точки вверх на 24 блока и вспышка у основания
function nsPingDraw(ping) {
	var at = function (x, y, z) {
		return ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2)
	}
	var pre = 'execute in ' + ping.dim + ' run particle '
	var srv = NSG.nsServer
	for (var h = 0; h <= 24; h += 2) srv.runCommandSilent(pre + 'minecraft:end_rod' + at(ping.x, ping.y + 0.5 + h, ping.z) + ' 0.05 0.6 0.05 0 2 force @a')
	srv.runCommandSilent(pre + 'minecraft:wax_on' + at(ping.x, ping.y + 0.3, ping.z) + ' 0.5 0.2 0.5 0 6 force @a')
}

// Каждые 10 тиков: обновить столбы, стрелку над хотбаром, убрать старые пинги
NSG.nsPingTick = 0
ServerEvents.tick(event => {
	NSG.nsPingTick++
	if (NSG.nsPingTick % 10 !== 0 || !NSG.nsServer) return
	var list = NSG.nsPings
	if (!list || !list.length) return
	try {
		var now = nsPingNow()
		var live = []
		for (var i = 0; i < list.length; i++) {
			var pg = list[i]
			if (now >= pg.until) continue
			// цель-моб: столб идёт за ним, пока жив
			if (pg.mob) {
				try {
					if (pg.mob.isAlive() && nsPingDim(pg.mob.getLevel()) === pg.dim) {
						pg.x = Number(pg.mob.getX())
						pg.y = Number(pg.mob.getY())
						pg.z = Number(pg.mob.getZ())
					} else pg.mob = null
				} catch (e) {
					pg.mob = null
				}
			}
			live.push(pg)
			if (now > pg.start) nsPingDraw(pg)
		}
		NSG.nsPings = live
		if (!live.length) return
		// над хотбаром — самый свежий чужой пинг в своём измерении (своего — если чужих нет)
		var ps = event.server.getPlayers()
		for (var j = 0; j < ps.length; j++) {
			var r = ps[j]
			var rn = nsPingName(r)
			var dim = nsPingDim(r.getLevel())
			var show = null,
				mineOnly = null
			for (var k = live.length - 1; k >= 0; k--) {
				if (live[k].dim !== dim) continue
				if (live[k].owner !== rn) {
					show = live[k]
					break
				}
				if (!mineOnly) mineOnly = live[k]
			}
			show = show || mineOnly
			if (!show) continue
			var dx = show.x - Number(r.getX()),
				dy = show.y - Number(r.getY()),
				dz = show.z - Number(r.getZ())
			var d = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))
			var txt = '▲ Пинг ' + show.owner + (show.mob ? ' · ' + show.label : '') + ' · ' + d + ' бл. ' + nsPingArrow(r, dx, dz)
			event.server.runCommandSilent('title ' + rn + ' actionbar ' + JSON.stringify({ text: txt, color: 'gold' }))
		}
	} catch (e) {
		console.error('[ping] тик: ' + e)
	}
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var run = ctx => {
		try {
			var p = ctx.source.getPlayer()
			if (p) nsPingSend(p)
		} catch (e) {
			console.error('[ping] /ping: ' + e)
		}
		return 1
	}
	event.register(C.literal('ping').executes(run))
	event.register(C.literal('пинг').executes(run))
})
