// ==========================================================================
// Ночная смена — скримеры, часть 2 (28.09.2026): тихие «бытовые» страхи, лицо на весь экран
// и режиссёр, который сам подбрасывает скримеры. Команды встраиваются в /scare из 10_scares.js
// (хук nsScmCommands), права те же: консоль и Sokol2008. В чат ничего не пишется.
//   /scare flash <ник> [1–6]      — лицо на весь экран ~1 с + крик. Картинка — шрифт nightshift:scare
//                                   (kubejs/assets/nightshift/font/scare.json), нужен клиент с ресурсами пака
//   /scare steps <ник> [сек]      — шаги за спиной: идут по его же следу с отставанием ~1,3 с;
//                                   остановился — ещё два шага ближе и тишина; обернулся — шаги замирают
//   /scare knock <ник>            — стук в ближайшую дверь (нет двери — в стену за спиной), потом дверь
//                                   сама открывается и захлопывается
//   /scare note <ник> [текст]     — «Записка» в свободный слот рюкзака (не хотбар) — найдёт сам
//   /scare tunnel <ник>           — в камне за блоком, на который он смотрит (копает), прячется глаз;
//                                   докопал и посмотрел — глаз снова становится камнем
//   /scare lights <ник> [радиус]  — факелы и фонари гаснут один за другим, от дальних к ближним;
//                                   через 20 с загораются снова
//   /scare twin <ник> [чья голова]— Монохром с головой игрока (по умолчанию — его самого) стоит вдали,
//                                   потом выглядывает ближе
//   /scare join|leave <ник> [чей ник] — поддельное «… присоединился/покинул игру» только у цели
//   /scare auto on|off|status     — режиссёр: сам подбрасывает скримеры раз в 15–30 мин (чаще, когда
//                                   рассудок низкий), не во время набегов. По умолчанию выключен.
//   /scare auto skip <ник>        — режиссёр не трогает игрока (повтор — снова трогает)
//   /scare auto now <ник>         — режиссёр выбирает и запускает скример прямо сейчас (проверка)
// Сценарии /scare preset: night (шаги → стук → свет гаснет → двойник → лицо),
//                         deep (глаз в тоннеле → шаги → клоун → погоня → лицо).
// Подмены блоков (глаз, погашенный свет) идут через задания nsFaceJobs из 10_scares.js — переживают
// /reload и падение сервера.
// ==========================================================================

var NS_SCM_DOOR = Java.loadClass('net.minecraft.world.level.block.DoorBlock')
var NS_SCM_DOORS = NS_SCARE_TAGKEY.create(NS_SCARE_REG.BLOCK, NS_SCARE_RL.parse('minecraft:doors'))
var NS_SCM_AIR = NS_SCARE_BLOCKS.get(NS_SCARE_RL.parse('minecraft:air'))
var NS_SCM_LIGHTS = ['minecraft:torch', 'minecraft:wall_torch', 'minecraft:soul_torch', 'minecraft:soul_wall_torch', 'minecraft:lantern', 'minecraft:soul_lantern']
var NS_SCM_FACES = 6 // глифы … в шрифте nightshift:scare,  — чёрный,  — отступ −1
var NS_SCM_DEBUG = false // true — писать в лог каждый шаг/стук (проверка на витрине)
var NS_SCM_FLASH_AUTO = true // режиссёр может показывать лицо (у клиентов должны быть ресурсы пака)
var NS_SCM_NOTES = [
	'Я видел, как ты копал.',
	'Не оборачивайся.',
	'Он ходит за тобой третью ночь.',
	'Почему ты не закрыл дверь?',
	'Я был в твоём доме, пока тебя не было.',
	'Ты не один на смене.',
	'Посчитай, сколько вас. Теперь посчитай ещё раз.',
	'Не спускайся ниже. Там уже кто-то есть.',
	'Мне нравится, как ты спишь.'
]
var NS_SCM_WHISPERS = ['…ты слышал?…', '…за тобой…', '…не туда…', '…он рядом…', '…не выключай свет…', '…посмотри вниз…', '…ты здесь не один…']

var nsScmJobs = [] // шаги, стук, гашение света, глаз в тоннеле: {type, name, …}
var nsScmAutoNext = {} // режиссёр: имя → тик следующего скримера
var nsScmAutoLog = [] // последние решения режиссёра (для status)

function nsScmName(player) {
	return String(player.getGameProfile().getName())
}

// звук только для цели, из точки (в её измерении)
function nsScmSound(server, name, sound, x, y, z, vol, pitch) {
	nsScareCmd(server, 'execute at ' + name + ' run playsound ' + sound + ' hostile ' + name + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1) + ' ' + vol + ' ' + pitch)
}

function nsScmRand(a, b) {
	return a + Math.floor(Math.random() * (b - a + 1))
}

function nsScmPick(list) {
	return list[Math.floor(Math.random() * list.length)]
}

// звук блока (шаг/удар) по его типу звука; не вышло — камень
function nsScmBlockSound(st, kind) {
	try {
		var t = st.getSoundType()
		var ev = kind === 'hit' ? t.getHitSound() : t.getStepSound()
		return String(ev.getLocation())
	} catch (e) {
		return kind === 'hit' ? 'minecraft:block.stone.hit' : 'minecraft:block.stone.step'
	}
}

function nsScmStoneLike(st) {
	if (st.hasBlockEntity()) return false
	for (var i = 0; i < NS_SCARE_FACE_KEYS.length; i++) if (st['is(net.minecraft.tags.TagKey)'](NS_SCARE_FACE_KEYS[i])) return true
	return false
}

function nsScmBusy(name) {
	for (var i = 0; i < nsScares.length; i++) if (nsScares[i].name === name) return true
	for (var j = 0; j < nsScmJobs.length; j++) if (nsScmJobs[j].name === name && nsScmJobs[j].type !== 'tunnel') return true
	return false
}

// ---------- лицо на весь экран ----------

// Заголовок (масштаб ×4) из глифов: чёрный | чёрный | лицо | чёрный | чёрный — закрывает экран по
// ширине; сверху и снизу в этот миг слепота, мир чёрный. Проверено на 3440×1369 (GUI 3).
function nsScmFlash(server, player, n) {
	var name = nsScmName(player)
	if (!(n >= 1 && n <= NS_SCM_FACES)) n = nsScmRand(1, NS_SCM_FACES)
	var b = String.fromCharCode(0xe000),
		s = String.fromCharCode(0xe0ff)
	var text = b + s + b + s + String.fromCharCode(0xe000 + n) + s + b + s + b
	nsScareCmd(server, 'effect give ' + name + ' minecraft:blindness 2 0 true')
	nsScareCmd(server, 'title ' + name + ' times 0 16 6')
	nsScareCmd(server, 'title ' + name + ' title ' + JSON.stringify({ text: text, font: 'nightshift:scare', color: 'white' }))
	var x = player.getX(),
		y = player.getEyeY(),
		z = player.getZ()
	nsScmSound(server, name, 'goofy_horror_mod:new' + nsScmRand(1, 5), x, y, z, 1, 1)
	nsScmSound(server, name, 'arphex:horrorcrash', x, y, z, 1, 1)
	nsScmSound(server, name, 'minecraft:entity.enderman.scream', x, y, z, 1, 0.5)
	return n
}

// ---------- шаги за спиной ----------

function nsScmSteps(server, player, secs) {
	var name = nsScmName(player)
	nsScmJobs = nsScmJobs.filter(j => !(j.type === 'steps' && j.name === name))
	nsScmJobs.push({ type: 'steps', name: name, until: nsScareTick + secs * 20, trail: [], lx: player.getX(), lz: player.getZ(), acc: 0, still: 0, extra: 0, hold: 0 })
}

function nsScmStepAt(server, job, player, x, y, z) {
	var st = player.getLevel().getBlockState(NS_SCARE_POS.containing(x, y - 0.2, z))
	if (st.isAir()) st = player.getLevel().getBlockState(NS_SCARE_POS.containing(x, y - 1.2, z))
	var snd = nsScmBlockSound(st, 'step')
	nsScmSound(server, job.name, snd, x, y, z, 0.35, (0.78 + Math.random() * 0.14).toFixed(2))
	if (NS_SCM_DEBUG) console.info('[scm] шаг ' + snd + ' ' + x.toFixed(1) + ' ' + z.toFixed(1))
}

// раз в 2 тика
function nsScmStepsTick(server, job, player, now) {
	var x = player.getX(),
		y = player.getY(),
		z = player.getZ()
	job.trail.push([x, y, z])
	if (job.trail.length > 13) job.trail.shift() // след ~1,3 с назад — там «кто-то» идёт
	var dx = x - job.lx,
		dz = z - job.lz
	var d = Math.sqrt(dx * dx + dz * dz)
	job.lx = x
	job.lz = z
	if (player.isPassenger() || player.getAbilities().flying || job.trail.length < 13) return
	var moving = d > 0.05
	if (moving) {
		job.still = 0
		job.caught = false
	} else job.still++
	if (now < job.hold) return
	if (moving) job.acc += d // шаги «копятся» только пока он идёт и не смотрит назад
	var f = job.trail[0]
	var fx = f[0] - x,
		fz = f[2] - z
	var fl = Math.sqrt(fx * fx + fz * fz)
	var lk = player.getLookAngle()
	var ll = Math.max(0.01, Math.sqrt(lk.x() * lk.x() + lk.z() * lk.z()))
	// обернулся туда, где шаги, — они замирают на 3 с
	if (fl > 1.2 && (lk.x() * fx + lk.z() * fz) / (ll * fl) > 0.75) {
		job.hold = now + 60
		job.acc = 0
		job.extra = 0
		return
	}
	if (job.acc >= 1.7) {
		job.acc = 0
		// не «под ногами» у него самого и не дважды в одну точку (след ещё стоит там, где он стоял)
		var lastD = job.last ? Math.abs(job.last[0] - f[0]) + Math.abs(job.last[2] - f[2]) : 9
		if (fl > 1.5 && lastD > 0.8) {
			nsScmStepAt(server, job, player, f[0], f[1], f[2])
			job.last = f
		}
	}
	if (!moving && job.still > 8) job.acc = 0
	// остановился: ещё два шага — в 2,2 и 1,3 блока за спиной (со стороны следа) — и тишина
	if (job.still === 8 && !job.caught) {
		job.extra = 2
		job.nextExtra = now + 6
		var ux = fx / Math.max(0.01, fl),
			uz = fz / Math.max(0.01, fl)
		if (fl < 1) {
			ux = -lk.x() / ll // след не виден (стоял) — просто за спиной
			uz = -lk.z() / ll
		}
		job.dir = [ux, uz]
	}
	if (job.extra > 0 && now >= job.nextExtra) {
		var back = job.extra === 2 ? 2.2 : 1.3
		nsScmStepAt(server, job, player, x + job.dir[0] * back, y, z + job.dir[1] * back)
		job.extra--
		job.nextExtra = now + 12
		if (job.extra === 0) job.caught = true
	}
}

// ---------- стук ----------

function nsScmFindDoor(player, r) {
	var level = player.getLevel()
	var px = Math.floor(player.getX()),
		py = Math.floor(player.getY()),
		pz = Math.floor(player.getZ())
	var best = null,
		bestD = 1e9
	for (var x = -r; x <= r; x++)
		for (var z = -r; z <= r; z++)
			for (var y = -3; y <= 3; y++) {
				var pos = new NS_SCARE_POS(px + x, py + y, pz + z)
				var st = level.getBlockState(pos)
				if (!st['is(net.minecraft.tags.TagKey)'](NS_SCM_DOORS)) continue
				if (String(st.getValue(NS_SCM_DOOR.HALF).getSerializedName()) !== 'lower') continue
				var d2 = x * x + y * y + z * z
				if (d2 < 6 || d2 >= bestD) continue // не та, в которой он стоит
				best = pos
				bestD = d2
			}
	return best
}

// стена за спиной на уровне груди (2–6 блоков)
function nsScmWallBehind(player) {
	var level = player.getLevel()
	var lk = player.getLookAngle()
	var ll = Math.max(0.01, Math.sqrt(lk.x() * lk.x() + lk.z() * lk.z()))
	for (var t = 2; t <= 6; t += 0.5) {
		var pos = NS_SCARE_POS.containing(player.getX() - (lk.x() / ll) * t, player.getY() + 1, player.getZ() - (lk.z() / ll) * t)
		var st = level.getBlockState(pos)
		if (!st.getCollisionShape(level, pos).isEmpty()) return pos
	}
	return null
}

function nsScmKnock(server, player) {
	var name = nsScmName(player)
	var door = nsScmFindDoor(player, 12)
	var pos = door || nsScmWallBehind(player)
	if (!pos) return null
	var level = player.getLevel()
	var st = level.getBlockState(pos)
	var wasOpen = door ? String(st.getValue(NS_SCM_DOOR.OPEN)) === 'true' : true
	nsScmJobs.push({ type: 'knock', name: name, level: level, pos: pos, door: !!door && !wasOpen, hit: door ? 'minecraft:block.wood.hit' : nsScmBlockSound(st, 'hit'), t0: nsScareTick, i: 0 })
	return door ? 'дверь' : 'стена'
}

// расписание: тук-тук-тук … тук-тук-тук громче … дверь открывается … захлопывается
var NS_SCM_KNOCKS = [[0, 0.7], [7, 0.7], [14, 0.7], [80, 1.0], [86, 1.0], [92, 1.0]]
function nsScmKnockTick(server, job, player, now) {
	var t = now - job.t0
	var cx = job.pos.getX() + 0.5,
		cy = job.pos.getY() + 1,
		cz = job.pos.getZ() + 0.5
	while (job.i < NS_SCM_KNOCKS.length && t >= NS_SCM_KNOCKS[job.i][0]) {
		var v = NS_SCM_KNOCKS[job.i][1]
		nsScmSound(server, job.name, job.hit, cx, cy, cz, v, 0.55)
		if (NS_SCM_DEBUG) console.info('[scm] стук ' + job.hit + ' ' + v)
		nsScmSound(server, job.name, 'minecraft:entity.zombie.attack_wooden_door', cx, cy, cz, (v * 0.22).toFixed(2), 1.9)
		job.i++
	}
	if (!job.door) return t < 100
	if (t >= 190 && !job.opened) {
		job.opened = true
		nsScmDoor(job.level, job.pos, true)
	}
	if (t >= 250) {
		nsScmDoor(job.level, job.pos, false)
		return false
	}
	return true
}

function nsScmDoor(level, pos, open) {
	var st = level.getBlockState(pos)
	if (!st['is(net.minecraft.tags.TagKey)'](NS_SCM_DOORS)) return
	try {
		st.getBlock().setOpen(null, level, st, pos, open) // обе половины + звук двери
	} catch (e) {
		console.warn('[scare] дверь: ' + e)
	}
}

// ---------- записка ----------

function nsScmNote(server, player, text) {
	var inv = player.getInventory()
	var free = []
	for (var i = 9; i < 36; i++) if (inv.getItem(i).isEmpty()) free.push(i - 9)
	if (!free.length) return null
	var slot = nsScmPick(free)
	text = String(text || nsScmPick(NS_SCM_NOTES)).replace(/'/g, '’').replace(/\\/g, '')
	var nm = JSON.stringify({ text: 'Записка', color: 'gray', italic: false })
	var lore = JSON.stringify({ text: text, color: 'dark_red', italic: true })
	nsScareCmd(server, 'item replace entity ' + nsScmName(player) + ' inventory.' + slot + " with minecraft:paper[minecraft:custom_name='" + nm + "',minecraft:lore=['" + lore + "']]")
	return text
}

// ---------- глаз в тоннеле ----------

// первый твёрдый блок по взгляду (до 6 блоков) и следующий за ним
function nsScmRay(player) {
	var level = player.getLevel()
	var lk = player.getLookAngle()
	var ex = player.getX(),
		ey = player.getEyeY(),
		ez = player.getZ()
	var hit = null,
		prevKey = ''
	for (var s = 1; s <= 90; s++) {
		var t = s * 0.1
		if (!hit && t > 6) return null
		var pos = NS_SCARE_POS.containing(ex + lk.x() * t, ey + lk.y() * t, ez + lk.z() * t)
		var key = pos.getX() + ',' + pos.getY() + ',' + pos.getZ()
		if (key === prevKey) continue
		prevKey = key
		if (!hit) {
			if (!level.getBlockState(pos).getCollisionShape(level, pos).isEmpty()) hit = pos
		} else return { hit: hit, behind: pos }
	}
	return null
}

function nsScmTunnel(server, player) {
	var ray = nsScmRay(player)
	if (!ray) return null
	var level = player.getLevel()
	var pos = ray.behind
	var st = level.getBlockState(pos)
	if (!nsScmStoneLike(st)) return null
	// спрятан: со всех сторон, кроме копаемого блока, глухо
	var dirs = NS_SCARE_DIR.values()
	for (var d = 0; d < dirs.length; d++) {
		var n = pos.relative(dirs[d])
		if (n.equals(ray.hit)) continue
		if (!level.getBlockState(n).canOcclude()) return null
	}
	var job = { level: level, dim: nsScareDim(level), until: nsScareTick + 3600, list: [[pos, st]] } // 3 мин не докопал — камень
	nsFaceJobs.push(job)
	nsFaceSave(server)
	level.setBlock(pos, nsScareEye().defaultBlockState(), 2)
	nsScmJobs.push({ type: 'tunnel', name: nsScmName(player), level: level, pos: pos, face: job, seen: 0 })
	return pos
}

function nsScmTunnelTick(server, job, player, now) {
	if (job.face.until <= nsScareTick) return false // уже вернули
	var level = job.level
	var open = false
	var dirs = NS_SCARE_DIR.values()
	for (var d = 0; d < dirs.length && !open; d++) if (!level.getBlockState(job.pos.relative(dirs[d])).canOcclude()) open = true
	if (!open) return true
	var cx = job.pos.getX() + 0.5,
		cy = job.pos.getY() + 0.5,
		cz = job.pos.getZ() + 0.5
	var vx = cx - player.getX(),
		vy = cy - player.getEyeY(),
		vz = cz - player.getZ()
	var dist = Math.sqrt(vx * vx + vy * vy + vz * vz)
	var lk = player.getLookAngle()
	if (dist < 7 && (lk.x() * vx + lk.y() * vy + lk.z() * vz) / Math.max(0.01, dist) > 0.9) {
		job.seen++
		if (job.seen === 1) {
			nsScmSound(server, job.name, 'minecraft:entity.warden.heartbeat', player.getX(), player.getY(), player.getZ(), 1, 0.9)
			nsScmSound(server, job.name, 'minecraft:entity.enderman.stare', cx, cy, cz, 0.8, 0.6)
		}
		// посмотрел ~1,2 с — глаз закрывается камнем прямо у него на глазах
		if (job.seen >= 12) {
			job.face.until = nsScareTick
			return false
		}
	}
	return true
}

// ---------- свет гаснет ----------

function nsScmLights(server, player, r, secs) {
	var level = player.getLevel()
	var px = Math.floor(player.getX()),
		py = Math.floor(player.getY()),
		pz = Math.floor(player.getZ())
	var list = []
	for (var x = -r; x <= r; x++)
		for (var z = -r; z <= r; z++)
			for (var y = -4; y <= 6; y++) {
				var pos = new NS_SCARE_POS(px + x, py + y, pz + z)
				var st = level.getBlockState(pos)
				var id = String(NS_SCARE_BLOCKS.getKey(st.getBlock()))
				if (NS_SCM_LIGHTS.indexOf(id) >= 0) list.push({ pos: pos, st: st, d: x * x + y * y + z * z })
			}
	if (!list.length) return 0
	list.sort((a, b) => b.d - a.d) // от дальних к ближним — темнота подступает
	if (list.length > 64) list = list.slice(list.length - 64)
	var gap = 5
	var total = list.length * gap + secs * 20
	var job = { level: level, dim: nsScareDim(level), until: nsScareTick + total, list: [] }
	for (var i = 0; i < list.length; i++) job.list.push([list[i].pos, list[i].st, NS_SCM_AIR])
	nsFaceJobs.push(job) // вернёт свет по таймеру (и после падения сервера)
	nsFaceSave(server)
	player.persistentData.putLong('ns_scare_grace', server.getTickCount() + total) // «Тьма сжимается» не бьёт
	nsScmJobs.push({ type: 'lights', name: nsScmName(player), level: level, list: list, i: 0, next: nsScareTick, gap: gap })
	return list.length
}

function nsScmLightsTick(server, job, player, now) {
	if (now < job.next) return true
	var it = job.list[job.i]
	if (job.level.getBlockState(it.pos)['is(net.minecraft.world.level.block.Block)'](it.st.getBlock())) {
		job.level.setBlock(it.pos, NS_SCM_AIR.defaultBlockState(), 2)
		nsScmSound(server, job.name, 'minecraft:block.fire.extinguish', it.pos.getX() + 0.5, it.pos.getY() + 0.5, it.pos.getZ() + 0.5, 0.5, (0.8 + Math.random() * 0.4).toFixed(2))
	}
	job.i++
	job.next = now + job.gap
	if (job.i >= job.list.length) {
		nsScmSound(server, job.name, 'minecraft:entity.warden.heartbeat', player.getX(), player.getY(), player.getZ(), 1, 0.8)
		return false
	}
	return true
}

// ---------- двойник ----------

function nsScmTwin(server, player, who) {
	var name = nsScmName(player)
	nsScareStart(server, player, 'mono', 'stalk')
	var rec = nsScares[nsScares.length - 1]
	rec.head = who || name
	rec.plan = [
		{ m: 'stalk', d: 18, time: 900 },
		{ m: 'pause', time: nsScmRand(100, 200) },
		{ m: 'peek', time: 900 }
	]
}

// ---------- поддельные «зашёл / вышел» ----------

function nsScmFakeJoin(server, name, who, left) {
	nsScareCmd(server, 'tellraw ' + name + ' ' + JSON.stringify({ translate: left ? 'multiplayer.player.left' : 'multiplayer.player.joined', with: [who], color: 'yellow' }))
}

// ---------- сценарии и действия (хуки из 10_scares.js) ----------

NS_SCARE_PRESETS.push('night', 'deep')
function nsScmPreset(name, R) {
	if (name === 'night')
		return [
			{ m: 'act', a: 'steps', secs: 25, time: 400 },
			{ m: 'act', a: 'knock', time: 260 },
			{ m: 'act', a: 'lights', r: 12, secs: 25, time: R(120, 60) },
			{ m: 'stalk', head: true, d: 16, time: 600 },
			{ m: 'pause', time: R(60, 60) },
			{ m: 'act', a: 'flash', time: 40 }
		]
	if (name === 'deep')
		return [
			{ m: 'act', a: 'tunnel', time: R(200, 200) },
			{ m: 'act', a: 'steps', secs: 20, time: 400 },
			{ m: 'peek', kind: 'clown', time: 600 },
			{ m: 'pause', time: R(60, 60) },
			{ m: 'dweller', time: 600 },
			{ m: 'pause', time: 30 },
			{ m: 'act', a: 'flash', time: 40 }
		]
	return null
}

function nsScmAct(server, rec, player, step) {
	if (step.a === 'steps') nsScmSteps(server, player, step.secs || 25)
	if (step.a === 'knock') nsScmKnock(server, player)
	if (step.a === 'lights') nsScmLights(server, player, step.r || 12, step.secs || 20)
	if (step.a === 'flash') nsScmFlash(server, player, step.n)
	if (step.a === 'note') nsScmNote(server, player, step.text)
	if (step.a === 'tunnel') nsScmTunnel(server, player)
}

function nsScmStopAll(server) {
	for (var i = 0; i < nsScmJobs.length; i++) {
		var j = nsScmJobs[i]
		if (j.type === 'knock' && j.opened) nsScmDoor(j.level, j.pos, false)
	}
	nsScmJobs = []
}

// ---------- режиссёр ----------

function nsScmAutoOn(server) {
	return server.persistentData.getBoolean('ns_scare_auto')
}

function nsScmInsanity(player) {
	try {
		var cap = NS_SANITY.get(player)
		return cap ? Number(cap.getSanity()) : 0 // 0 — в своём уме, 1 — безумие
	} catch (e) {
		return 0
	}
}

function nsScmInRaid(player) {
	try {
		return nsInRaidRange(player, nsRaidSanityAltar())
	} catch (e) {
		return false
	}
}

// кого и чем пугать сейчас — варианты с весами по обстановке
function nsScmAutoOptions(server, player) {
	var level = player.getLevel()
	var y = player.getY()
	var under = false,
		night = false
	try {
		under = y < 62 && !level.canSeeSky(NS_SCARE_POS.containing(player.getX(), player.getEyeY(), player.getZ()))
	} catch (e) {}
	try {
		var tod = Number(level.getDayTime()) % 24000
		night = tod > 13000 && tod < 23000
	} catch (e) {}
	var alone = true
	var players = server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var o = players[i]
		if (nsScmName(o) === nsScmName(player) || nsScareDim(o.getLevel()) !== nsScareDim(level)) continue
		var dx = o.getX() - player.getX(),
			dz = o.getZ() - player.getZ()
		if (dx * dx + dz * dz < 32 * 32) alone = false
	}
	var ins = nsScmInsanity(player)
	var opts = [['whisper', 3], ['steps', 4], ['voice', 2], ['note', 1]]
	if (under) {
		var ray = nsScmRay(player)
		if (ray && nsScmStoneLike(level.getBlockState(ray.behind))) opts.push(['tunnel', 4])
		opts.push(['faces', 1], ['peek', 2], ['watcher', 1])
		if (alone) opts.push(['dweller', 1])
	} else {
		if (night) opts.push(['twin', 2], ['watcher', 2], ['stalk', 2])
		if (nsScmFindDoor(player, 12)) opts.push(['knock', 3])
		if (night) opts.push(['lights', 2])
	}
	if (NS_SCM_FLASH_AUTO) opts.push(['flash', ins > 0.6 ? 2 : 0.4])
	return opts
}

function nsScmAutoRun(server, player, kind) {
	var name = nsScmName(player)
	if (kind === 'whisper') player.setStatusMessage(Text.darkRed(nsScmPick(NS_SCM_WHISPERS)).italic())
	else if (kind === 'steps') nsScmSteps(server, player, 40)
	else if (kind === 'voice') nsScareAct(server, { name: name }, player, { a: 'voice', which: nsScmPick(['hey', 'see', 'behind']) })
	else if (kind === 'note') return !!nsScmNote(server, player, null)
	else if (kind === 'tunnel') return !!nsScmTunnel(server, player)
	else if (kind === 'faces') nsFaceStart(server, player, 6, 4)
	else if (kind === 'peek') nsScareStart(server, player, 'clown', 'peek')
	else if (kind === 'dweller') nsScareStart(server, player, 'dweller', 'dweller')
	else if (kind === 'watcher') nsScareStart(server, player, 'watcher', 'watcher')
	else if (kind === 'stalk') nsScareStart(server, player, 'mono', 'stalk')
	else if (kind === 'twin') nsScmTwin(server, player, null)
	else if (kind === 'knock') return !!nsScmKnock(server, player)
	else if (kind === 'lights') return nsScmLights(server, player, 12, 20) > 0
	else if (kind === 'flash') nsScmFlash(server, player, 0)
	return true
}

// выбрать по весам и запустить; не получилось (нет места, пустой инвентарь) — следующий вариант
function nsScmAutoFire(server, player) {
	var opts = nsScmAutoOptions(server, player)
	for (var tries = 0; tries < 4 && opts.length; tries++) {
		var sum = 0
		for (var i = 0; i < opts.length; i++) sum += opts[i][1]
		var r = Math.random() * sum,
			k = 0
		while (k < opts.length - 1 && r >= opts[k][1]) r -= opts[k++][1]
		var kind = opts[k][0]
		if (nsScmAutoRun(server, player, kind)) return kind
		opts.splice(k, 1)
	}
	return null
}

function nsScmAutoTick(server, now) {
	var players = server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		var name = nsScmName(p)
		if (nsScmAutoNext[name] === undefined) {
			nsScmAutoNext[name] = now + nsScmRand(12000, 24000) // первый — через 10–20 мин после входа
			continue
		}
		if (now < nsScmAutoNext[name]) continue
		if (p.persistentData.getBoolean('ns_scare_auto_skip') || p.isCreative() || p.isSpectator() || !p.isAlive() || nsScmInRaid(p) || nsScmBusy(name)) {
			nsScmAutoNext[name] = now + 1200 // через минуту посмотрим снова
			continue
		}
		var kind = nsScmAutoFire(server, p)
		// 15–30 мин; при сильном безумии до двух раз чаще
		var ins = nsScmInsanity(p)
		nsScmAutoNext[name] = now + Math.floor(nsScmRand(18000, 36000) * (1 - 0.5 * Math.min(1, ins)))
		nsScmAutoLog.push(name + ': ' + (kind || 'ничего не вышло'))
		if (nsScmAutoLog.length > 8) nsScmAutoLog.shift()
		console.info('[scare-auto] ' + name + ': ' + (kind || '—') + ' (безумие ' + Math.round(ins * 100) + '%)')
	}
}

// ---------- тик ----------

ServerEvents.tick(event => {
	if (nsScareTick % 2 !== 0) return
	var server = event.server
	var now = nsScareTick
	if (nsScmJobs.length) {
		nsScmJobs = nsScmJobs.filter(job => {
			var player = server.getPlayerList().getPlayerByName(job.name)
			if (!player || !player.isAlive()) {
				if (job.type === 'knock' && job.opened) nsScmDoor(job.level, job.pos, false)
				return job.type === 'tunnel' // глаз ждёт своего часа и без игрока (вернётся по таймеру)
			}
			if (job.type === 'steps') {
				if (now >= job.until) return false
				nsScmStepsTick(server, job, player, now)
				return true
			}
			if (job.type === 'knock') return nsScmKnockTick(server, job, player, now)
			if (job.type === 'lights') return nsScmLightsTick(server, job, player, now)
			if (job.type === 'tunnel') return nsScmTunnelTick(server, job, player, now)
			return false
		})
	}
	if (now % 100 === 0 && nsScmAutoOn(server)) nsScmAutoTick(server, now)
})

// ---------- команды ----------

function nsScmTarget(ctx, name) {
	return nsScareTarget(ctx, name)
}

function nsScmCommands(root, Commands, Arguments, event) {
	var nameArg = () => Commands.argument('name', Arguments.STRING.create(event))
	var N = ctx => nsScareArgName(ctx)
	var simple = (lit, fn) =>
		Commands.literal(lit).then(
			nameArg().executes(ctx => {
				var p = nsScmTarget(ctx, N(ctx))
				if (!p) return 0
				var res = fn(ctx.source.getServer(), p, ctx)
				nsScareReply(ctx, res)
				return 1
			})
		)
	root = root
		.then(
			Commands.literal('flash').then(
				nameArg()
					.executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						nsScareReply(ctx, 'лицо №' + nsScmFlash(ctx.source.getServer(), p, 0) + ' на весь экран: ' + N(ctx))
						return 1
					})
					.then(
						Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
							var p = nsScmTarget(ctx, N(ctx))
							if (!p) return 0
							nsScareReply(ctx, 'лицо №' + nsScmFlash(ctx.source.getServer(), p, nsScareArgInt(ctx, 'n')) + ' на весь экран: ' + N(ctx))
							return 1
						})
					)
			)
		)
		.then(
			Commands.literal('steps').then(
				nameArg()
					.executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						nsScmSteps(ctx.source.getServer(), p, 40)
						nsScareReply(ctx, 'шаги за спиной у ' + N(ctx) + ' на 40 с')
						return 1
					})
					.then(
						Commands.argument('secs', Arguments.INTEGER.create(event)).executes(ctx => {
							var p = nsScmTarget(ctx, N(ctx))
							if (!p) return 0
							var secs = Math.max(5, Math.min(180, nsScareArgInt(ctx, 'secs')))
							nsScmSteps(ctx.source.getServer(), p, secs)
							nsScareReply(ctx, 'шаги за спиной у ' + N(ctx) + ' на ' + secs + ' с')
							return 1
						})
					)
			)
		)
		.then(simple('knock', (server, p) => {
			var where = nsScmKnock(server, p)
			return where ? 'стук: ' + where : 'некуда стучать (ни двери, ни стены рядом)'
		}))
		.then(
			Commands.literal('note').then(
				nameArg()
					.executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						var t = nsScmNote(ctx.source.getServer(), p, null)
						nsScareReply(ctx, t ? 'записка: «' + t + '»' : 'рюкзак полон — записку некуда положить')
						return 1
					})
					.then(
						Commands.argument('text', Arguments.GREEDY_STRING.create(event)).executes(ctx => {
							var p = nsScmTarget(ctx, N(ctx))
							if (!p) return 0
							var t = nsScmNote(ctx.source.getServer(), p, String(Arguments.GREEDY_STRING.getResult(ctx, 'text')))
							nsScareReply(ctx, t ? 'записка: «' + t + '»' : 'рюкзак полон — записку некуда положить')
							return 1
						})
					)
			)
		)
		.then(simple('tunnel', (server, p) => {
			var pos = nsScmTunnel(server, p)
			return pos ? 'глаз спрятан в ' + pos.getX() + ' ' + pos.getY() + ' ' + pos.getZ() + ' (3 мин)' : 'не смотрит в камень (нужен камень/земля за блоком, куда смотрит)'
		}))
		.then(
			Commands.literal('lights').then(
				nameArg()
					.executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						nsScareReply(ctx, 'гаснет огней: ' + nsScmLights(ctx.source.getServer(), p, 12, 20))
						return 1
					})
					.then(
						Commands.argument('r', Arguments.INTEGER.create(event)).executes(ctx => {
							var p = nsScmTarget(ctx, N(ctx))
							if (!p) return 0
							nsScareReply(ctx, 'гаснет огней: ' + nsScmLights(ctx.source.getServer(), p, Math.max(4, Math.min(24, nsScareArgInt(ctx, 'r'))), 20))
							return 1
						})
					)
			)
		)
		.then(
			Commands.literal('twin').then(
				nameArg()
					.executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						nsScmTwin(ctx.source.getServer(), p, null)
						nsScareReply(ctx, 'двойник ' + N(ctx) + ' идёт к нему')
						return 1
					})
					.then(
						Commands.argument('who', Arguments.STRING.create(event)).executes(ctx => {
							var p = nsScmTarget(ctx, N(ctx))
							if (!p) return 0
							var who = String(Arguments.STRING.getResult(ctx, 'who'))
							nsScmTwin(ctx.source.getServer(), p, who)
							nsScareReply(ctx, 'Монохром с головой ' + who + ' идёт к ' + N(ctx))
							return 1
						})
					)
			)
		)
	var fake = left =>
		Commands.literal(left ? 'leave' : 'join').then(
			nameArg()
				.executes(ctx => {
					if (!nsScmTarget(ctx, N(ctx))) return 0
					nsScmFakeJoin(ctx.source.getServer(), N(ctx), N(ctx), left)
					nsScareReply(ctx, (left ? 'поддельный выход: ' : 'поддельный вход: ') + N(ctx) + ' (видит только он)')
					return 1
				})
				.then(
					Commands.argument('who', Arguments.STRING.create(event)).executes(ctx => {
						if (!nsScmTarget(ctx, N(ctx))) return 0
						var who = String(Arguments.STRING.getResult(ctx, 'who'))
						nsScmFakeJoin(ctx.source.getServer(), N(ctx), who, left)
						nsScareReply(ctx, (left ? 'поддельный выход ' : 'поддельный вход ') + who + ' — видит только ' + N(ctx))
						return 1
					})
				)
		)
	root = root.then(fake(false)).then(fake(true))
	root = root.then(
		Commands.literal('auto')
			.then(
				Commands.literal('on').executes(ctx => {
					ctx.source.getServer().persistentData.putBoolean('ns_scare_auto', true)
					nsScmAutoNext = {}
					nsScareReply(ctx, 'режиссёр включён: первый скример каждому — через 10–20 мин')
					return 1
				})
			)
			.then(
				Commands.literal('off').executes(ctx => {
					ctx.source.getServer().persistentData.putBoolean('ns_scare_auto', false)
					nsScareReply(ctx, 'режиссёр выключен')
					return 1
				})
			)
			.then(
				Commands.literal('status').executes(ctx => {
					var server = ctx.source.getServer()
					var lines = ['режиссёр ' + (nsScmAutoOn(server) ? 'ВКЛ' : 'выкл')]
					var ps = server.getPlayers()
					for (var i = 0; i < ps.length; i++) {
						var nm = nsScmName(ps[i])
						var nx = nsScmAutoNext[nm]
						lines.push(nm + ': ' + (ps[i].persistentData.getBoolean('ns_scare_auto_skip') ? 'не трогать' : nx === undefined ? 'ещё не считали' : 'через ' + Math.max(0, Math.round((nx - nsScareTick) / 1200)) + ' мин') + ', безумие ' + Math.round(nsScmInsanity(ps[i]) * 100) + '%')
					}
					if (nsScmAutoLog.length) lines.push('последние: ' + nsScmAutoLog.join('; '))
					nsScareReply(ctx, lines.join('\n'))
					return 1
				})
			)
			.then(
				Commands.literal('skip').then(
					nameArg().executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						var off = !p.persistentData.getBoolean('ns_scare_auto_skip')
						p.persistentData.putBoolean('ns_scare_auto_skip', off)
						nsScareReply(ctx, N(ctx) + (off ? ': режиссёр не трогает' : ': режиссёр снова трогает'))
						return 1
					})
				)
			)
			.then(
				Commands.literal('now').then(
					nameArg().executes(ctx => {
						var p = nsScmTarget(ctx, N(ctx))
						if (!p) return 0
						var kind = nsScmAutoFire(ctx.source.getServer(), p)
						nsScareReply(ctx, 'режиссёр выбрал: ' + (kind || 'ничего не вышло'))
						return 1
					})
				)
			)
	)
	return root
}
