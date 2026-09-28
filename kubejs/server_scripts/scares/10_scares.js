// ==========================================================================
// Ночная смена — управляемые скримеры. Команда есть только у консоли и Sokol2008:
// другие операторы её не видят даже в подсказках. В чат ничего не пишется — ответ
// получает только тот, кто вызвал команду; шёпот идёт строкой над хотбаром, как
// собственные сообщения сборки («Тьма сжимается…»).
//   /scare mono <ник> [режим]  — Монохром (как в Roblox MONOCHROME): высокий чёрный силуэт
//        с белыми светящимися глазами. Режим по умолчанию hunt.
//   /scare clown <ник> [режим] — Клоун: выглядывает из-за угла, наполовину скрыт стеной.
//        Режим по умолчанию peek.
//     режимы: stalk — стоит за спиной в ~20 блоках и смотрит, исчезает, как только увидели
//             peek  — выглядывает из-за угла в 4–12 блоках (наполовину за стеной)
//             dash  — пробегает поперёк взгляда в ~10 блоках впереди
//             chase — встаёт впереди и смотрит, заметили — крик и ~20 с погони (скорость «на резинке»,
//                     застрял — оказывается за спиной); в конце лицом к лицу, крик, темнота
//             turn  — над хотбаром «…обернись…»; обернулся — он прямо перед лицом
//             hunt  — сценарий: Монохром стоит → пробегает → стоит ближе → погоня;
//                     Клоун выглядывает → ещё раз ближе → погоня
//        Никто из них не бьёт (урон 0, бессмертны) — пугают и исчезают.
//   /scare faces <ник> [радиус 3–10] [сек 1–10] — открытые блоки камня, земли, досок и
//        брёвен вокруг становятся моргающими глазами, потом возвращаются как были
//   /scare box <ник> [сек 2–15] — коробка из глаз вокруг игрока (внутри 3×3×3), потом исчезает
//   /scare dweller <ник> — погоня Cave Dweller (безвредный, своя анимация и музыка погони)
//   /scare preset <ник> [hunt|mine|house|quiet] — готовые сценарии (см. nsScarePreset)
//   /scare watcher <ник> — Наблюдатель (End Watchers) вдали, исчезает, когда на него смотрят
//   /scare face <ник>    — фото-лицо (Horror Faces) вплотную на 1,5 с + хруст костей
//   /scare voice <ник> [hey|see|behind] — искажённый голос из-за спины
//   /scare whisper <ник> <текст> — строка над хотбаром тёмно-красным курсивом
//   /scare stop — убрать всех и вернуть блоки
// Внешность — ресурсы ETF (мод уже в сборке): хаск в команде ns_mono / ns_clown рисуется
// текстурой assets/minecraft/optifine/random/entity/zombie/husk2.png / husk3.png,
// глаза светятся (*_e.png). Хаск — потому что не горит на солнце.
// Блок-глаз — startup_scripts/nightshift_scare_blocks.js. Подмена блоков пишется в
// persistentData сервера: если сервер упадёт посреди скримера, блоки вернутся при запуске.
// ==========================================================================

var NS_SCARE_OWNER = 'Sokol2008'
var NS_SCARE_POS = Java.loadClass('net.minecraft.core.BlockPos')
var NS_SCARE_DIR = Java.loadClass('net.minecraft.core.Direction')
var NS_SCARE_REG = Java.loadClass('net.minecraft.core.registries.Registries')
var NS_SCARE_BLOCKS = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').BLOCK
var NS_SCARE_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
var NS_SCARE_TAGKEY = Java.loadClass('net.minecraft.tags.TagKey')
var NS_SCARE_UUID = Java.loadClass('java.util.UUID')
var NS_SCARE_NBT = Java.loadClass('net.minecraft.nbt.NbtUtils')
var NS_SCARE_LIST = Java.loadClass('net.minecraft.nbt.ListTag')
var NS_SCARE_TAG = Java.loadClass('net.minecraft.nbt.CompoundTag')
var NS_SCARE_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_SCARE_HUSK = Java.loadClass('net.minecraft.world.entity.monster.Husk')
// Имена в Rhino (KubeJS 2101), проверено на витрине: getYaw (не getYRot), setBodyYaw
// (не setYBodyRot), setPositionAndRotation (ванильный moveTo из 5 чисел не находится),
// getStringUuid; level.getEntity(UUID) скрыт — сущность ищем через getEntitiesOfClass.

// что может стать глазами (без блок-сущностей — машины, сундуки и т.п. не трогаем)
var NS_SCARE_FACE_TAGS = ['minecraft:base_stone_overworld', 'minecraft:dirt', 'minecraft:sand', 'minecraft:logs', 'minecraft:planks', 'c:cobblestones', 'c:stones', 'c:gravels']
var NS_SCARE_FACE_KEYS = NS_SCARE_FACE_TAGS.map(t => NS_SCARE_TAGKEY.create(NS_SCARE_REG.BLOCK, NS_SCARE_RL.parse(t)))
var NS_SCARE_FACE_MAX = 3000

// персонажи: команда (по ней ETF выбирает текстуру), рост, глаза над ногами, высота в блоках,
// скорость, звук «лицом к лицу» и звук исчезновения
var NS_SCARE_KINDS = {
	mono: { team: 'ns_mono', scale: 1.45, eye: 2.45, h: 3, speed: 0.4, def: 'hunt', title: 'Монохром', sting: 'minecraft:entity.enderman.stare', stingPitch: 0.6, gone: 'minecraft:ambient.cave', gonePitch: 0.6 },
	clown: { team: 'ns_clown', scale: 1.0, eye: 1.7, h: 2, speed: 0.36, def: 'peek', title: 'Клоун', sting: 'minecraft:entity.witch.celebrate', stingPitch: 0.7, gone: 'minecraft:entity.witch.celebrate', gonePitch: 1.5 }
}
var NS_SCARE_MODES = ['hunt', 'stalk', 'peek', 'dash', 'chase', 'turn']

// Существа из хоррор-модов: своя модель, звуки и поведение — мы только ставим (без ИИ) и убираем.
// Сами по себе в мире не появляются (biome_modifier перекрыт в kubejs/data/*/neoforge/biome_modifier).
//   watcher — End Watchers: высокий чёрный силуэт с белыми глазами, сам исчезает, когда на него смотрят
//             или подходят ближе ~15 блоков (его логика работает и без ИИ)
//   face    — Horror Faces: огромное фото-лицо (face_1…face_10), ставим прямо перед лицом на 1,5 с
var NS_SCARE_EXTRA = {
	watcher: { title: 'Наблюдатель', type: 'end_watchers:end_watcher_standing', scale: 0.4, h: 3, eye: 3.0, time: 900 },
	face: { title: 'Лицо', type: 'goofy_horror_mod:face_', scale: 0.45, h: 2, eye: 1.3, time: 30 }
}
var NS_SCARE_ENTITY = Java.loadClass('net.minecraft.world.entity.Entity')
var NS_SCARE_SMALL_EYE = 1.7 // рост 1.0 для низких ходов

var nsScares = [] // активные: {kind, K, name, level, dim, plan, step, uuid, t, seen, beat, jump, dst, yaw0, shown}
var nsFaceJobs = [] // подмены блоков: {level, dim, until, list: [[pos, state]]}
var nsScareTick = 0
var nsScareArgName = null // чтение аргументов команды — задаются в commandRegistry
var nsScareArgInt = null

function nsScareEye() {
	return NS_SCARE_BLOCKS.get(NS_SCARE_RL.parse('nightshift:watching_eye'))
}

function nsScareDim(level) {
	return String(level.getDimension()) // KubeJS: getDimension() — ResourceLocation
}

function nsScareCmd(server, cmd) {
	server.runCommandSilent(cmd)
}

function nsScareTeams(server) {
	for (var k in NS_SCARE_KINDS) {
		var team = NS_SCARE_KINDS[k].team
		nsScareCmd(server, 'team add ' + team)
		nsScareCmd(server, 'team modify ' + team + ' nametagVisibility never')
		nsScareCmd(server, 'team modify ' + team + ' collisionRule never')
	}
}

// случайный UUID: строка (для команд и команды-«скина») и int-массив для NBT
function nsScareUuid() {
	var ints = []
	var hex = ''
	for (var i = 0; i < 4; i++) {
		var u = Math.floor(Math.random() * 4294967296)
		ints.push(u > 2147483647 ? u - 4294967296 : u)
		var h = u.toString(16)
		while (h.length < 8) h = '0' + h
		hex += h
	}
	return {
		str: hex.substr(0, 8) + '-' + hex.substr(8, 4) + '-' + hex.substr(12, 4) + '-' + hex.substr(16, 4) + '-' + hex.substr(20, 12),
		nbt: '[I;' + ints.join(',') + ']'
	}
}

// ---------- поиск места ----------

// h блоков свободно (без жидкости) и твёрдый пол
function nsScareFree(level, x, y, z, h) {
	for (var k = 0; k < h; k++) {
		var pos = NS_SCARE_POS.containing(x, y + k, z)
		var st = level.getBlockState(pos)
		if (!st.getCollisionShape(level, pos).isEmpty() || !st.getFluidState().isEmpty()) return false
	}
	var below = NS_SCARE_POS.containing(x, y - 1, z)
	return level.getBlockState(below).isFaceSturdy(level, below, NS_SCARE_DIR.UP)
}

// ничего непрозрачного между двумя точками (шаг полблока, концы не проверяются)
function nsScareClear(level, x0, y0, z0, x1, y1, z1) {
	var dx = x1 - x0,
		dy = y1 - y0,
		dz = z1 - z0
	var n = Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz) * 2)
	for (var i = 1; i < n; i++) {
		var f = i / n
		if (level.getBlockState(NS_SCARE_POS.containing(x0 + dx * f, y0 + dy * f, z0 + dz * f)).canOcclude()) return false
	}
	return true
}

// точка на земле: от игрока на угол off (0 — впереди, 180 — за спиной) и дистанцию dist
function nsScareSpot(player, K, dist, off, spread, needSight) {
	var level = player.getLevel()
	var yaw = player.getYaw()
	var px = player.getX(),
		py = Math.floor(player.getY()),
		pz = player.getZ()
	for (var t = 0; t < 16; t++) {
		var a = ((yaw + off + (Math.random() - 0.5) * spread) * Math.PI) / 180
		var d = dist + (Math.random() - 0.5) * 4
		var x = Math.floor(px - Math.sin(a) * d) + 0.5
		var z = Math.floor(pz + Math.cos(a) * d) + 0.5
		for (var dy = 6; dy >= -8; dy--) {
			var y = py + dy
			var small = false
			if (!nsScareFree(level, x, y, z, K.h)) {
				if (K.h <= 2 || !nsScareFree(level, x, y, z, 2)) continue
				small = true // низкий ход (шахта): встанет обычного роста
			}
			if (needSight && !nsScareClear(level, px, player.getEyeY(), pz, x, y + (small ? NS_SCARE_SMALL_EYE : K.eye), z)) break
			return { x: x, y: y, z: z, small: small }
		}
	}
	return null
}

// «из-за угла»: из 6 точек фигуры (центр и края, голова и грудь) видно часть, и голова
// видна хотя бы одним краем — значит, стоит наполовину за стеной и выглядывает.
// Перебираем все клетки кольца 4–12 блоков в случайном порядке (узкий боковой ход
// случайными попытками легко пропустить).
function nsScarePeekSpot(player, K) {
	var level = player.getLevel()
	var ex = player.getX(),
		ey = player.getEyeY(),
		ez = player.getZ()
	var bx = Math.floor(ex),
		py = Math.floor(player.getY()),
		bz = Math.floor(ez)
	var cells = []
	for (var cx = -12; cx <= 12; cx++)
		for (var cz = -12; cz <= 12; cz++) {
			var r2 = cx * cx + cz * cz
			if (r2 >= 16 && r2 <= 144) cells.push([bx + cx + 0.5, bz + cz + 0.5])
		}
	for (var i = cells.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1))
		var tmp = cells[i]
		cells[i] = cells[j]
		cells[j] = tmp
	}
	var checks = 0
	for (var c = 0; c < cells.length && checks < 250; c++) {
		var x = cells[c][0],
			z = cells[c][1]
		for (var dy = 3; dy >= -3; dy--) {
			var y = py + dy
			if (!nsScareFree(level, x, y, z, K.h)) continue
			checks++
			var vx = x - ex,
				vz = z - ez
			var vl = Math.max(0.01, Math.sqrt(vx * vx + vz * vz))
			var qx = (-vz / vl) * 0.3,
				qz = (vx / vl) * 0.3
			var seen = 0,
				head = false
			for (var sd = -1; sd <= 1; sd++)
				for (var hh = 0; hh < 2; hh++)
					if (nsScareClear(level, ex, ey, ez, x + qx * sd, y + (hh ? K.eye : K.eye * 0.55), z + qz * sd)) {
						seen++
						if (hh) head = true
					}
			if (head && seen <= 3) return { x: x, y: y, z: z }
			break
		}
	}
	return null
}

// видна ли голова хоть краем (центр и ±0,3 блока поперёк взгляда): выглядывающего из-за
// угла ванильный hasLineOfSight не видит — луч в центр глаз упирается в стену
function nsScareHeadVisible(player, ent, eye) {
	var level = player.getLevel()
	var ex = player.getX(),
		ey = player.getEyeY(),
		ez = player.getZ()
	var x = ent.getX(),
		y = ent.getY() + eye,
		z = ent.getZ()
	var vx = x - ex,
		vz = z - ez
	var vl = Math.max(0.01, Math.sqrt(vx * vx + vz * vz))
	for (var sd = -1; sd <= 1; sd++) if (nsScareClear(level, ex, ey, ez, x + (-vz / vl) * 0.3 * sd, y, z + (vx / vl) * 0.3 * sd)) return true
	return false
}

// ---------- персонаж ----------

// ссылка на сущность; после призыва ищем её рядом с точкой появления по UUID
function nsScareEntity(rec) {
	if (rec.ent && !rec.ent.isRemoved()) return rec.ent
	rec.ent = null
	if (!rec.uuid || !rec.spot) return null
	var s = rec.spot
	var list = rec.level.getEntitiesOfClass(NS_SCARE_ENTITY, new NS_SCARE_AABB(s.x - 4, s.y - 4, s.z - 4, s.x + 4, s.y + 6, s.z + 4))
	for (var i = 0; i < list.size(); i++) if (String(list.get(i).getStringUuid()) === rec.uuid) rec.ent = list.get(i)
	return rec.ent
}

function nsScarePlayer(server, rec) {
	return rec.fake || server.getPlayerList().getPlayerByName(rec.name)
}

function nsScareSpawn(rec, player, spot, ai) {
	var server = player.getServer()
	var K = rec.K
	var id = nsScareUuid()
	// в команду до появления — клиент сразу рисует его нужной текстурой (ETF: teams.N=…)
	nsScareCmd(server, 'team join ' + K.team + ' ' + id.str)
	var yaw = (Math.atan2(-(player.getX() - spot.x), player.getZ() - spot.z) * 180) / Math.PI
	var nbt =
		'{UUID:' + id.nbt +
		',Tags:["ns_scare","' + K.team + '"],Silent:1b,Invulnerable:1b,PersistenceRequired:1b,CanPickUpLoot:0b,CanBreakDoors:0b' +
		',NoAI:' + (ai ? '0b' : '1b') +
		',Rotation:[' + yaw.toFixed(1) + 'f,0f],DeathLootTable:"minecraft:empty"' +
		',attributes:[{id:"minecraft:generic.scale",base:' + (spot.small ? 1.0 : K.scale) + 'd}' +
		',{id:"minecraft:generic.attack_damage",base:0d}' +
		',{id:"minecraft:generic.movement_speed",base:' + K.speed + 'd}' +
		',{id:"minecraft:generic.follow_range",base:64d}' +
		',{id:"minecraft:generic.knockback_resistance",base:1d}' +
		',{id:"minecraft:generic.step_height",base:1.1d}' +
		',{id:"minecraft:zombie.spawn_reinforcements",base:0d}]}'
	nsScareCmd(server, 'execute in ' + rec.dim + ' run summon minecraft:husk ' + spot.x.toFixed(2) + ' ' + spot.y.toFixed(2) + ' ' + spot.z.toFixed(2) + ' ' + nbt)
	rec.uuid = id.str
	rec.ent = null
	rec.spot = spot
	rec.born = nsScareTick
	rec.eye = spot.small ? NS_SCARE_SMALL_EYE : K.eye
	rec.h = spot.small ? 2 : K.h
	rec.seen = 0
	return nsScareEntity(rec)
}

function nsScareVanish(rec) {
	var ent = nsScareEntity(rec)
	if (ent) ent.discard()
	else if (rec.uuid) nsScareCmd(rec.level.getServer(), 'kill ' + rec.uuid) // не нашли рядом — убрать командой
	if (rec.uuid) nsScareCmd(rec.level.getServer(), 'team leave ' + rec.uuid)
	rec.uuid = null
	rec.ent = null
}

function nsScareNext(rec) {
	nsScareVanish(rec)
	rec.step++
	rec.t = -1
	rec.spawnTries = 0
	rec.shown = 0
	rec.jump = 0
}

// звук только для цели, из точки (x, y, z)
function nsScareSound(server, rec, sound, x, y, z, vol, pitch) {
	nsScareCmd(server, 'execute in ' + rec.dim + ' run playsound ' + sound + ' hostile ' + rec.name + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1) + ' ' + vol + ' ' + pitch)
}

function nsScarePlan(kind, mode) {
	var R = (a, b) => a + Math.floor(Math.random() * b)
	if (kind === 'preset') return nsScarePreset(mode, R)
	if (kind === 'dweller') return [{ m: 'dweller', time: 600 }]
	if (NS_SCARE_EXTRA[kind]) return [{ m: kind, time: NS_SCARE_EXTRA[kind].time }]
	if (mode === 'stalk') return [{ m: 'stalk', d: 20, time: 900 }]
	if (mode === 'peek') return [{ m: 'peek', time: 900 }]
	if (mode === 'dash') return [{ m: 'dash', d: 10, time: 140 }]
	if (mode === 'chase') return [{ m: 'dweller', time: 600 }] // бегает Cave Dweller — у хаска анимация кривая
	if (mode === 'turn') return [{ m: 'turn', time: 160 }]
	if (kind === 'clown')
		return [
			{ m: 'peek', time: 900 },
			{ m: 'pause', time: R(100, 100) },
			{ m: 'peek', time: 900 },
			{ m: 'pause', time: R(60, 60) },
			{ m: 'dweller', time: 600 }
		]
	return [
		{ m: 'watcher', time: 900 },
		{ m: 'pause', time: R(80, 80) },
		{ m: 'stalk', d: 12, time: 600 },
		{ m: 'pause', time: R(60, 60) },
		{ m: 'dweller', time: 600 }
	]
}

// Заготовки — готовые сценарии одной командой: /scare preset <ник> <имя>
//   hunt  — «hey» за спиной → Наблюдатель вдали → шёпот → погоня Cave Dweller → лицо вплотную
//   mine  — глаза вокруг → «behind you» → клоун из-за угла → погоня Cave Dweller
//   house — коробка из глаз → лицо внутри коробки
//   quiet — шёпот → голос → Наблюдатель (без погони, на нервы)
var NS_SCARE_PRESETS = ['hunt', 'mine', 'house', 'quiet']
function nsScarePreset(name, R) {
	if (name === 'mine')
		return [
			{ m: 'act', a: 'faces', r: 6, secs: 4, time: 100 },
			{ m: 'act', a: 'voice', which: 'behind', time: R(60, 60) },
			{ m: 'peek', kind: 'clown', time: 600 },
			{ m: 'pause', time: R(60, 60) },
			{ m: 'dweller', time: 600 }
		]
	if (name === 'house')
		return [
			{ m: 'act', a: 'box', secs: 7, time: 70 },
			{ m: 'face', time: 30 }
		]
	if (name === 'quiet')
		return [
			{ m: 'act', a: 'whisper', text: '…ты здесь не один…', time: R(100, 60) },
			{ m: 'act', a: 'voice', which: 'see', time: R(60, 60) },
			{ m: 'watcher', time: 900 }
		]
	return [
		{ m: 'act', a: 'voice', which: 'hey', time: R(40, 40) },
		{ m: 'watcher', time: 900 },
		{ m: 'pause', time: R(80, 80) },
		{ m: 'act', a: 'whisper', text: '…беги…', time: 30 },
		{ m: 'dweller', time: 600 },
		{ m: 'pause', time: 40 },
		{ m: 'face', time: 30 }
	]
}

// мгновенное действие шага сценария (без существа)
function nsScareAct(server, rec, player, step) {
	var name = rec.name
	if (step.a === 'whisper') player.setStatusMessage(Text.darkRed(step.text).italic())
	if (step.a === 'voice') {
		var map = { hey: 'end_watcher_hey', see: 'end_watcher_i_see_you', behind: 'end_watcher_behind_you' }
		nsScareCmd(server, 'execute as ' + name + ' at @s rotated ~ 0 positioned ^ ^1.5 ^-2 run playsound end_watchers:' + (map[step.which] || map.behind) + ' hostile ' + name + ' ~ ~ ~ 1 1')
	}
	if (step.a === 'faces') nsFaceStart(server, player, step.r || 6, step.secs || 4)
	if (step.a === 'box') nsScareBox(server, player, step.secs || 7)
}

// fake — тестовый игрок (FakePlayer) вместо настоящего, только для проверки на витрине
function nsScareStart(server, player, kind, mode, fake) {
	var name = String(player.getGameProfile().getName())
	for (var i = 0; i < nsScares.length; i++)
		if (nsScares[i].name === name) {
			nsScareVanish(nsScares[i])
			nsScares[i].step = 999 // на следующем тике запись удалится
		}
	nsScareTeams(server)
	var level = player.getLevel()
	nsScares.push({ kind: kind, K: NS_SCARE_KINDS[kind] || NS_SCARE_EXTRA[kind], name: name, fake: fake ? player : null, level: level, dim: nsScareDim(level), plan: nsScarePlan(kind, mode), step: 0, uuid: null, t: -1, seen: 0, beat: 0, spawnTries: 0, jump: 0, shown: 0 })
}

// существо хоррор-мода: без ИИ, бессмертное, рост через generic.scale
function nsScareSpawnExtra(rec, player, spot, type, scale, ai, attrs) {
	var server = player.getServer()
	var id = nsScareUuid()
	var yaw = (Math.atan2(-(player.getX() - spot.x), player.getZ() - spot.z) * 180) / Math.PI
	nsScareCmd(server, 'execute in ' + rec.dim + ' run summon ' + type + ' ' + spot.x.toFixed(2) + ' ' + spot.y.toFixed(2) + ' ' + spot.z.toFixed(2) +
		' {UUID:' + id.nbt + ',Tags:["ns_scare"],NoAI:' + (ai ? '0b' : '1b') + ',Invulnerable:1b,PersistenceRequired:1b,Rotation:[' + yaw.toFixed(1) + 'f,0f]' +
		',attributes:[{id:"minecraft:generic.scale",base:' + scale + 'd}' + (attrs || '') + ']}')
	rec.uuid = id.str
	rec.ent = null
	rec.spot = spot
	rec.born = nsScareTick
	rec.eye = rec.K.eye
	rec.h = rec.K.h
	rec.seen = 0
}

// Cave Dweller для погони: своя анимация (ползёт, встаёт, несётся на четвереньках), звуки «заметил» и музыка
// погони. Урон считается от атрибута атаки — с атакой 0 безвреден (иначе бьёт сквозь броню: «was killed»).
var NS_SCARE_DWELLER = { title: 'Cave Dweller', h: 2, eye: 1.6 }
function nsScareBeginDweller(server, rec, player, step, now) {
	rec.K = NS_SCARE_DWELLER
	var spot = null
	var tries = [[14, 180, 70], [10, 180, 140], [7, 180, 220], [6, 0, 360]]
	for (var q = 0; q < tries.length && !spot; q++) spot = nsScareSpot(player, rec.K, tries[q][0], tries[q][1], tries[q][2], false)
	if (!spot) {
		rec.t = -1
		if (++rec.spawnTries > 10) nsScareNext(rec)
		return
	}
	nsScareSpawnExtra(rec, player, spot, 'cave_dweller:cave_dweller', 1.0, true, ',{id:"minecraft:generic.attack_damage",base:0d}')
	rec.phaseAt = now
	rec.spotted = false
}

function nsScareBeginExtra(server, rec, player, step) {
	var K = rec.K
	if (step.m === 'watcher') {
		// вдали за спиной на виду (исчезнет сам, когда увидят); нет места — где угодно
		var spot = nsScareSpot(player, K, 22, 180, 80, true) || nsScareSpot(player, K, 20, 0, 360, true) || nsScareSpot(player, K, 16, 0, 360, false)
		if (!spot) {
			rec.t = -1
			if (++rec.spawnTries > 10) nsScareNext(rec)
			return
		}
		nsScareSpawnExtra(rec, player, spot, K.type, K.scale)
		var voices = ['end_watchers:end_watcher_i_see_you', 'end_watchers:end_watcher_hey', 'end_watchers:end_watcher_behind_you']
		nsScareSound(server, rec, voices[Math.floor(Math.random() * voices.length)], spot.x, spot.y + 2, spot.z, 1, 1)
		return
	}
	// face: прямо перед лицом; впереди камень — за спиной, и камера разворачивается к нему
	var lk = player.getLookAngle()
	var ln = Math.max(0.01, Math.sqrt(lk.x() * lk.x() + lk.z() * lk.z()))
	var fy = Math.floor(player.getY())
	var fx = player.getX() + (lk.x() / ln) * 2.0,
		fz = player.getZ() + (lk.z() / ln) * 2.0
	var behind = !nsScareFree(rec.level, fx, fy, fz, K.h)
	if (behind) {
		fx = player.getX() - (lk.x() / ln) * 1.2 // 1,2 — чтобы влезало и внутрь коробки из глаз (внутри 3×3)
		fz = player.getZ() - (lk.z() / ln) * 1.2
	}
	nsScareSpawnExtra(rec, player, { x: fx, y: fy, z: fz }, K.type + (1 + Math.floor(Math.random() * 10)), K.scale)
	if (behind) nsScareCmd(server, 'execute as ' + rec.name + ' at @s run tp @s ~ ~ ~ facing entity ' + rec.uuid + ' eyes')
	nsScareSound(server, rec, 'goofy_horror_mod:new' + (1 + Math.floor(Math.random() * 5)), fx, player.getEyeY(), fz, 1, 1)
	nsScareSound(server, rec, 'goofy_horror_mod:bone_crack_' + (1 + Math.floor(Math.random() * 4)), fx, player.getEyeY(), fz, 1, 1)
}

// начало шага: пауза, шёпот или появление
function nsScareBegin(server, rec, player, step, now) {
	rec.t = now + step.time
	if (step.m === 'pause') return
	if (step.m === 'turn') {
		rec.yaw0 = player.getYaw()
		player.setStatusMessage(Text.darkRed('…обернись…').italic())
		return
	}
	if (step.m === 'act') {
		nsScareAct(server, rec, player, step)
		return
	}
	// шаги сценария берут своего персонажа: Наблюдатель, лицо, Cave Dweller, клоун
	rec.K = NS_SCARE_KINDS[step.kind] || NS_SCARE_EXTRA[step.m] || NS_SCARE_KINDS[rec.kind] || NS_SCARE_EXTRA[rec.kind] || NS_SCARE_KINDS.mono
	if (step.m === 'dweller') {
		nsScareBeginDweller(server, rec, player, step, now)
		return
	}
	if (NS_SCARE_EXTRA[step.m]) {
		nsScareBeginExtra(server, rec, player, step)
		return
	}
	var K = rec.K
	var spot = null
	if (step.m === 'stalk') spot = nsScareSpot(player, K, step.d, 180, 70, true)
	if (step.m === 'peek') spot = nsScarePeekSpot(player, K) || nsScareSpot(player, K, 12, 180, 90, true)
	if (step.m === 'chase') {
		// сначала впереди на виду: стоит и смотрит, пока не заметят (фаза wake), потом бежит;
		// нет места впереди — сзади на step.d, ближе и шире (в шахте и в постройках часто камень)
		rec.phase = 'wake'
		spot = nsScareSpot(player, K, 18, 0, 70, true) || nsScareSpot(player, K, 12, 0, 100, true)
		if (!spot) {
			rec.phase = 'run'
			var tries = [[step.d, 180, 60], [11, 180, 120], [7, 180, 200], [6, 0, 360]]
			for (var q = 0; q < tries.length && !spot; q++) spot = nsScareSpot(player, K, tries[q][0], tries[q][1], tries[q][2], false)
		}
		if (spot) spot.small = true // в полный рост не проходит в двери и ходы 1×2 — застревает
		rec.phaseAt = now
		rec.best = 999
		rec.moved = now
		rec.blinks = 0
	}
	if (step.m === 'dash') {
		var side = Math.random() < 0.5 ? 1 : -1
		spot = nsScareSpot(player, K, step.d, 45 * side, 20, true)
		rec.dst = nsScareSpot(player, K, step.d + 4, -50 * side, 20, false)
		if (!rec.dst) spot = null
	}
	if (!spot) {
		// места нет (стены, вода) — пробуем ещё несколько раз, потом пропускаем шаг
		rec.t = -1
		if (++rec.spawnTries > 10) nsScareNext(rec)
		return
	}
	nsScareSpawn(rec, player, spot, step.m === 'chase' && rec.phase === 'run')
	if (step.m === 'chase') nsScareSound(server, rec, 'minecraft:entity.warden.heartbeat', player.getX(), player.getY(), player.getZ(), 1, 0.8)
	if (step.m === 'chase' && rec.phase === 'run') nsScareSound(server, rec, 'minecraft:entity.enderman.scream', spot.x, spot.y + 1, spot.z, 1, 0.5)
}

// «обернись»: обернулся (или прошло 5 с) — он прямо перед лицом (или за спиной) на 3 с
function nsScareTurnTick(server, rec, player, now) {
	if (rec.shown) {
		if (now >= rec.shown) nsScareNext(rec)
		return
	}
	var diff = Math.abs(player.getYaw() - rec.yaw0) % 360
	diff = Math.min(diff, 360 - diff)
	var turned = diff > 110
	if (!turned && now < rec.t - 60) return
	var lk = player.getLookAngle()
	var ln = Math.max(0.01, Math.sqrt(lk.x() * lk.x() + lk.z() * lk.z()))
	var sign = turned ? 1 : -1
	var spot = null
	var dists = [2.3, 1.8, 1.4]
	for (var i = 0; i < dists.length && !spot; i++) {
		var sx = player.getX() + ((sign * lk.x()) / ln) * dists[i],
			sz = player.getZ() + ((sign * lk.z()) / ln) * dists[i]
		if (nsScareFree(rec.level, sx, Math.floor(player.getY()), sz, rec.K.h)) spot = { x: sx, y: Math.floor(player.getY()), z: sz }
		else if (nsScareFree(rec.level, sx, Math.floor(player.getY()), sz, 2)) spot = { x: sx, y: Math.floor(player.getY()), z: sz, small: true }
	}
	if (!spot) spot = { x: player.getX() + ((sign * lk.x()) / ln) * 1.4, y: player.getY(), z: player.getZ() + ((sign * lk.z()) / ln) * 1.4, small: true }
	nsScareSpawn(rec, player, spot, false)
	if (turned) nsScareSound(server, rec, rec.K.sting, spot.x, spot.y + 1, spot.z, 1, rec.K.stingPitch)
	rec.shown = now + 60
}

function nsScareStep(server, rec, now) {
	var player = nsScarePlayer(server, rec)
	var step = rec.plan[rec.step]
	if (!step || !player || !player.isAlive() || nsScareDim(player.getLevel()) !== rec.dim) {
		nsScareVanish(rec)
		return false
	}
	if (rec.t < 0) {
		nsScareBegin(server, rec, player, step, now)
		return true
	}
	if (step.m === 'pause' || step.m === 'act') {
		if (now >= rec.t) nsScareNext(rec)
		return true
	}
	if (step.m === 'turn') {
		nsScareTurnTick(server, rec, player, now)
		return true
	}
	var K = rec.K
	var ent = nsScareEntity(rec)
	if (!ent && rec.uuid && now - rec.born < 10) return true // призыв ещё не обработан
	if (!ent || now >= rec.t) {
		nsScareNext(rec)
		return true
	}
	var ex = ent.getX() - player.getX(),
		ey = ent.getY() + rec.eye - player.getEyeY(),
		ez = ent.getZ() - player.getZ()
	var dist = Math.sqrt(ex * ex + ey * ey + ez * ez)
	var flat = Math.sqrt(ex * ex + ez * ez)

	if (step.m === 'dweller') {
		var ran = now - rec.phaseAt
		// цель — только наш игрок; «заметил» — один раз, дальше его ИИ сам гонится со своей музыкой
		ent.setTarget(player)
		if (!rec.spotted) {
			rec.spotted = true
			try {
				ent.setSpotted(true)
				ent.playSpottedSound()
			} catch (e) {}
		}
		if (now % 10 === 0) ent.getNavigation().moveTo(player, 1.0)
		// догнал (не раньше 6 с погони) или 25 с прошло — исчезает со своим звуком, секунда темноты
		if ((flat < 2.2 && ran > 120) || ran > 500) {
			try {
				ent.disappear()
			} catch (e) {
				ent.discard()
			}
			if (flat < 2.2) {
				nsScareCmd(server, 'effect give ' + rec.name + ' minecraft:blindness 1 0 true')
				nsScareCmd(server, 'effect give ' + rec.name + ' minecraft:darkness 3 0 true')
			}
			nsScareNext(rec)
		}
		return true
	}
	if (step.m === 'stalk' || step.m === 'peek') {
		// смотрит на игрока; исчезает, когда тот его увидел (или подошёл)
		if (now % 10 === 0) nsScareCmd(server, 'execute as ' + rec.uuid + ' at @s run tp @s ~ ~ ~ facing entity ' + rec.name + ' eyes')
		var look = player.getLookAngle()
		var dot = (look.x() * ex + look.y() * ey + look.z() * ez) / Math.max(0.01, dist)
		if (dot > 0.93 && nsScareHeadVisible(player, ent, rec.eye)) rec.seen++
		if (rec.seen >= (step.m === 'peek' ? 6 : 4) || flat < (step.m === 'peek' ? 3 : 6)) {
			nsScareSound(server, rec, K.gone, ent.getX(), ent.getY() + rec.eye, ent.getZ(), 0.6, K.gonePitch)
			nsScareNext(rec)
		}
		return true
	}
	if (step.m === 'dash') {
		// без ИИ, ведём по прямой сами: 1,1 блока за 2 тика ≈ 11 блоков/с, по земле ±2 блока
		var dx = rec.dst.x - ent.getX(),
			dz = rec.dst.z - ent.getZ()
		var left = Math.sqrt(dx * dx + dz * dz)
		if (left < 1.2) {
			nsScareNext(rec)
			return true
		}
		var nx = ent.getX() + (dx / left) * 1.1,
			nz = ent.getZ() + (dz / left) * 1.1
		var ny = null
		var tries = [0, 1, -1, 2, -2]
		for (var k = 0; k < tries.length && ny === null; k++) if (nsScareFree(rec.level, nx, Math.floor(ent.getY()) + tries[k], nz, rec.h)) ny = Math.floor(ent.getY()) + tries[k]
		if (ny === null) {
			nsScareNext(rec)
			return true
		}
		var dyaw = (Math.atan2(-dx, dz) * 180) / Math.PI
		ent.setPositionAndRotation(nx, ny, nz, dyaw, 0) // ванильный moveTo(5 чисел) Rhino не находит
		ent.setYHeadRot(dyaw)
		ent.setBodyYaw(dyaw)
		return true
	}
	if (step.m === 'chase') {
		if (rec.jump) {
			// лицом к лицу 1 с, затем темнота
			if (now >= rec.jump) {
				nsScareCmd(server, 'effect give ' + rec.name + ' minecraft:blindness 1 0 true')
				nsScareCmd(server, 'effect give ' + rec.name + ' minecraft:darkness 3 0 true')
				nsScareNext(rec)
			}
			return true
		}
		if (rec.phase === 'wake') {
			// стоит впереди и смотрит; заметили (или прошло 3 с) — крик и бежит
			if (now % 10 === 0) nsScareCmd(server, 'execute as ' + rec.uuid + ' at @s run tp @s ~ ~ ~ facing entity ' + rec.name + ' eyes')
			var wl = player.getLookAngle()
			var wdot = (wl.x() * ex + wl.y() * ey + wl.z() * ez) / Math.max(0.01, dist)
			if (wdot > 0.93 && nsScareHeadVisible(player, ent, rec.eye)) rec.seen++
			if (rec.seen >= 3 || now - rec.phaseAt > 60) {
				rec.phase = 'run'
				rec.phaseAt = now
				rec.moved = now
				ent.setNoAi(false)
				nsScareSound(server, rec, 'minecraft:entity.enderman.scream', ent.getX(), ent.getY() + rec.eye, ent.getZ(), 1, 0.5)
			}
			return true
		}
		ent.setTarget(player)
		if (now % 10 === 0) ent.getNavigation().moveTo(player, 1.0)
		// скорость «на резинке»: далеко — догоняет, близко — чуть медленнее бега игрока (≈5,6 бл/с)
		if (now % 20 === 0) nsScareCmd(server, 'attribute ' + rec.uuid + ' minecraft:generic.movement_speed base set ' + (flat > 14 ? 0.42 : flat > 7 ? 0.33 : 0.27))
		// тяжёлые шаги и сердцебиение чаще, чем ближе
		if (now % 6 === 0) nsScareSound(server, rec, 'minecraft:entity.warden.step', ent.getX(), ent.getY(), ent.getZ(), 0.9, 1.3)
		var every = flat > 10 ? 16 : 8
		if (now - rec.beat >= every) {
			rec.beat = now
			nsScareSound(server, rec, 'minecraft:entity.warden.heartbeat', player.getX(), player.getY(), player.getZ(), 1, flat > 10 ? 0.8 : 1.2)
		}
		// застрял (дверь, забор, яма) дольше 1,5 с — оказывается в ~8 блоках за спиной и бежит дальше
		if (flat < rec.best - 0.4) {
			rec.best = flat
			rec.moved = now
		}
		var ran = now - rec.phaseAt
		if (now - rec.moved > 30 && flat > 4 && ran < 400 && rec.blinks < 6) {
			var bs = nsScareSpot(player, K, 8, 180, 120, false)
			if (bs) {
				nsScareCmd(server, 'execute in ' + rec.dim + ' run tp ' + rec.uuid + ' ' + bs.x.toFixed(2) + ' ' + bs.y + ' ' + bs.z.toFixed(2))
				rec.blinks++
			}
			rec.best = 999
			rec.moved = now
			return true
		}
		// финал: догнал после 10 с погони, или погоня длится 22 с, или застрял насовсем
		if ((flat < 2.6 && ran > 200) || ran > 440 || (now - rec.moved > 30 && rec.blinks >= 6)) {
			ent.setNoAi(true)
			// за спиной (там, откуда игрок пришёл, свободно), глаза на уровне глаз игрока;
			// камера игрока сама разворачивается к нему
			var lk = player.getLookAngle()
			var ln = Math.max(0.01, Math.sqrt(lk.x() * lk.x() + lk.z() * lk.z()))
			var fx = player.getX() - (lk.x() / ln) * 1.6,
				fz = player.getZ() - (lk.z() / ln) * 1.6,
				fy = player.getEyeY() - rec.eye
			nsScareCmd(server, 'execute in ' + rec.dim + ' run tp ' + rec.uuid + ' ' + fx.toFixed(2) + ' ' + fy.toFixed(2) + ' ' + fz.toFixed(2) + ' facing entity ' + rec.name + ' eyes')
			nsScareCmd(server, 'execute as ' + rec.name + ' at @s run tp @s ~ ~ ~ facing entity ' + rec.uuid + ' eyes')
			nsScareSound(server, rec, K.sting, fx, player.getEyeY(), fz, 1, K.stingPitch)
			nsScareSound(server, rec, 'minecraft:entity.enderman.scream', fx, player.getEyeY(), fz, 1, 0.5)
			rec.jump = now + 20 // лицом к лицу 1 с
		}
		return true
	}
	return true
}

// ---------- глаза вместо блоков ----------

function nsFaceable(level, pos, st) {
	if (st.hasBlockEntity()) return false
	var ok = false
	for (var i = 0; i < NS_SCARE_FACE_KEYS.length && !ok; i++) ok = st['is(net.minecraft.tags.TagKey)'](NS_SCARE_FACE_KEYS[i])
	if (!ok) return false
	// только видимые: хотя бы одна соседняя клетка не глухая
	var dirs = NS_SCARE_DIR.values()
	for (var d = 0; d < dirs.length; d++) if (!level.getBlockState(pos.relative(dirs[d])).canOcclude()) return true
	return false
}

// подмены пишем в persistentData сервера — переживут падение сервера и /reload
function nsFaceSave(server) {
	var list = new NS_SCARE_LIST()
	for (var j = 0; j < nsFaceJobs.length; j++) {
		var job = nsFaceJobs[j]
		for (var i = 0; i < job.list.length; i++) {
			var t = new NS_SCARE_TAG()
			t.putString('dim', job.dim)
			t.putInt('x', job.list[i][0].getX())
			t.putInt('y', job.list[i][0].getY())
			t.putInt('z', job.list[i][0].getZ())
			t.put('state', NS_SCARE_NBT.writeBlockState(job.list[i][1]))
			list.add(t)
		}
	}
	if (list.isEmpty()) server.persistentData.remove('ns_scare_restore')
	else server.persistentData.put('ns_scare_restore', list)
}

// измерение по имени (server.getLevel для Rhino неоднозначен: ResourceKey / ResourceLocation)
function nsScareLevel(server, dim) {
	var found = null
	server.getAllLevels().forEach(l => {
		if (nsScareDim(l) === dim) found = l
	})
	return found
}

// вернуть блоки из persistentData (после падения/перезагрузки скриптов)
function nsFaceRecover(server) {
	if (!server.persistentData.contains('ns_scare_restore')) return 0
	var list = server.persistentData.getList('ns_scare_restore', 10)
	var eye = nsScareEye()
	var lookup = server.registryAccess().lookupOrThrow(NS_SCARE_REG.BLOCK)
	var n = 0
	for (var i = 0; i < list.size(); i++) {
		var t = list.getCompound(i)
		var level = nsScareLevel(server, String(t.getString('dim')))
		if (!level) continue
		var pos = new NS_SCARE_POS(t.getInt('x'), t.getInt('y'), t.getInt('z'))
		if (!level.getBlockState(pos)['is(net.minecraft.world.level.block.Block)'](eye)) continue
		level.setBlock(pos, NS_SCARE_NBT.readBlockState(lookup, t.getCompound('state')), 2)
		n++
	}
	server.persistentData.remove('ns_scare_restore')
	return n
}

function nsFaceRestore(job) {
	var eye = nsScareEye()
	for (var i = 0; i < job.list.length; i++) {
		var pos = job.list[i][0]
		var placed = job.list[i][2] || eye
		if (job.level.getBlockState(pos)['is(net.minecraft.world.level.block.Block)'](placed)) job.level.setBlock(pos, job.list[i][1], 2)
	}
}

// Коробка из глаз вокруг игрока: оболочка 5×5×5 (внутри 3×3×3), без блоков с блок-сущностью.
// Внутри невидимый свет, иначе в полной темноте сработает «Тьма сжимается» (sanity/20_darkness.js).
function nsScareBox(server, player, secs) {
	var level = player.getLevel()
	var name = String(player.getGameProfile().getName())
	var eye = nsScareEye().defaultBlockState()
	var lightBlock = NS_SCARE_BLOCKS.get(NS_SCARE_RL.parse('minecraft:light'))
	var cx = Math.floor(player.getX()),
		fy = Math.floor(player.getY()),
		cz = Math.floor(player.getZ())
	var job = { level: level, dim: nsScareDim(level), until: nsScareTick + secs * 20, list: [] }
	for (var x = -2; x <= 2; x++)
		for (var y = -1; y <= 3; y++)
			for (var z = -2; z <= 2; z++) {
				if (Math.abs(x) < 2 && Math.abs(z) < 2 && y > -1 && y < 3) continue // внутренность
				var pos = new NS_SCARE_POS(cx + x, fy + y, cz + z)
				var st = level.getBlockState(pos)
				if (st.hasBlockEntity()) continue
				job.list.push([pos, st])
			}
	// сначала задание на возврат (и запись в persistentData), потом подмена — неразрушаемые
	// глаза не должны остаться навсегда, даже если дальше что-то упадёт
	nsFaceJobs.push(job)
	nsFaceSave(server)
	for (var i = 0; i < job.list.length; i++) level.setBlock(job.list[i][0], eye, 2)
	try {
		var lp = new NS_SCARE_POS(cx, fy + 2, cz)
		var lst = level.getBlockState(lp)
		if (lst.getCollisionShape(level, lp).isEmpty() && lst.getFluidState().isEmpty() && !lst.hasBlockEntity()) {
			job.list.push([lp, lst, lightBlock])
			nsScareCmd(server, 'execute in ' + job.dim + ' run setblock ' + cx + ' ' + (fy + 2) + ' ' + cz + ' minecraft:light[level=6]')
		}
	} catch (e) {
		console.warn('[nightshift] /scare box: свет не поставлен: ' + e)
	}
	nsScareCmd(server, 'execute at ' + name + ' run playsound minecraft:entity.warden.heartbeat hostile ' + name + ' ~ ~ ~ 1 0.9')
	nsScareCmd(server, 'execute at ' + name + ' run playsound minecraft:block.sculk_shrieker.shriek hostile ' + name + ' ~ ~ ~ 0.6 0.6')
	return job.list.length
}

function nsFaceStart(server, player, r, secs) {
	var level = player.getLevel()
	var name = String(player.getGameProfile().getName())
	var eye = nsScareEye().defaultBlockState()
	var cx = Math.floor(player.getX()),
		cy = Math.floor(player.getY()) + 1,
		cz = Math.floor(player.getZ())
	var job = { level: level, dim: nsScareDim(level), until: nsScareTick + secs * 20, list: [] }
	for (var x = -r; x <= r; x++)
		for (var y = -r; y <= r; y++)
			for (var z = -r; z <= r; z++) {
				if (x * x + y * y + z * z > r * r || job.list.length >= NS_SCARE_FACE_MAX) continue
				var pos = new NS_SCARE_POS(cx + x, cy + y, cz + z)
				var st = level.getBlockState(pos)
				if (nsFaceable(level, pos, st)) job.list.push([pos, st])
			}
	// сначала запоминаем, потом меняем — иначе соседние глаза «закроют» друг друга
	for (var i = 0; i < job.list.length; i++) level.setBlock(job.list[i][0], eye, 2)
	nsFaceJobs.push(job)
	nsFaceSave(server)
	nsScareCmd(server, 'execute at ' + name + ' run playsound minecraft:entity.warden.heartbeat hostile ' + name + ' ~ ~ ~ 1 0.9')
	nsScareCmd(server, 'execute at ' + name + ' run playsound minecraft:ambient.soul_sand_valley.mood ambient ' + name + ' ~ ~ ~ 1 0.6')
	return job.list.length
}

// ---------- тик и команды ----------

ServerEvents.tick(event => {
	nsScareTick++
	if (nsScareTick % 2 !== 0) return
	var server = event.server
	if (nsScares.length) nsScares = nsScares.filter(rec => nsScareStep(server, rec, nsScareTick))
	if (nsFaceJobs.length) {
		var left = []
		for (var j = 0; j < nsFaceJobs.length; j++) {
			if (nsScareTick >= nsFaceJobs[j].until) nsFaceRestore(nsFaceJobs[j])
			else left.push(nsFaceJobs[j])
		}
		if (left.length !== nsFaceJobs.length) {
			nsFaceJobs = left
			nsFaceSave(server)
		}
	} else if (nsScareTick % 200 === 0 && server.persistentData.contains('ns_scare_restore')) {
		// скрипты перезагрузили посреди скримера — вернуть блоки по записи
		nsFaceRecover(server)
	}
})

ServerEvents.loaded(event => {
	var server = event.server
	var n = nsFaceRecover(server)
	if (n > 0) console.info('[nightshift] /scare: возвращено ' + n + ' блоков после перезапуска')
	nsScareCmd(server, 'kill @e[tag=ns_scare]')
	for (var k in NS_SCARE_KINDS) nsScareCmd(server, 'team empty ' + NS_SCARE_KINDS[k].team)
	nsScareTeams(server)
})

function nsScareAllowed(src) {
	var p = src.getPlayer()
	return p ? String(p.getGameProfile().getName()) === NS_SCARE_OWNER : src.hasPermission(4)
}

function nsScareReply(ctx, text) {
	ctx.source.sendSystemMessage(Text.darkPurple('[scare] ').append(Text.white(text)))
}

function nsScareTarget(ctx, name) {
	var p = ctx.source.getServer().getPlayerList().getPlayerByName(name)
	if (!p) nsScareReply(ctx, 'игрок ' + name + ' не в сети')
	return p
}

function nsScareRun(ctx, kind, name, mode) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	mode = mode || NS_SCARE_KINDS[kind].def
	if (NS_SCARE_MODES.indexOf(mode) < 0) {
		nsScareReply(ctx, 'режимы: ' + NS_SCARE_MODES.join(', '))
		return 0
	}
	nsScareStart(ctx.source.getServer(), p, kind, mode)
	nsScareReply(ctx, NS_SCARE_KINDS[kind].title + ' (' + mode + ') идёт к ' + name)
	return 1
}

function nsScareRunKind(ctx, kind, name, mode) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	if (kind === 'preset' && NS_SCARE_PRESETS.indexOf(mode) < 0) {
		nsScareReply(ctx, 'заготовки: ' + NS_SCARE_PRESETS.join(', '))
		return 0
	}
	nsScareStart(ctx.source.getServer(), p, kind, mode)
	nsScareReply(ctx, (kind === 'preset' ? 'заготовка ' + mode : 'Cave Dweller') + ' идёт к ' + name)
	return 1
}

function nsScareRunExtra(ctx, kind, name) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	nsScareStart(ctx.source.getServer(), p, kind, kind)
	nsScareReply(ctx, NS_SCARE_EXTRA[kind].title + ' идёт к ' + name)
	return 1
}

// голос End Watchers из-за спины: hey | see | behind
function nsScareVoice(ctx, name, which) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	var map = { hey: 'end_watcher_hey', see: 'end_watcher_i_see_you', behind: 'end_watcher_behind_you' }
	var snd = map[which] || map.behind
	nsScareCmd(ctx.source.getServer(), 'execute as ' + name + ' at @s rotated ~ 0 positioned ^ ^1.5 ^-2 run playsound end_watchers:' + snd + ' hostile ' + name + ' ~ ~ ~ 1 1')
	nsScareReply(ctx, 'голос за спиной: ' + snd)
	return 1
}

function nsScareFaces(ctx, name, r, secs) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	secs = Math.max(1, Math.min(10, secs))
	var n = nsFaceStart(ctx.source.getServer(), p, Math.max(3, Math.min(10, r)), secs)
	nsScareReply(ctx, 'глаза: ' + n + ' блоков на ' + secs + ' с')
	return 1
}

function nsScareBoxCmd(ctx, name, secs) {
	var p = nsScareTarget(ctx, name)
	if (!p) return 0
	secs = Math.max(2, Math.min(15, secs))
	var n = nsScareBox(ctx.source.getServer(), p, secs)
	nsScareReply(ctx, 'коробка из глаз: ' + n + ' блоков на ' + secs + ' с')
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	nsScareArgName = ctx => String(Arguments.STRING.getResult(ctx, 'name'))
	nsScareArgInt = (ctx, key) => Number(Arguments.INTEGER.getResult(ctx, key))

	var root = Commands.literal('scare').requires(src => nsScareAllowed(src))
	for (var k in NS_SCARE_KINDS) {
		// замыкание на kind — отдельной функцией (var в цикле общий)
		root = root.then(
			(kind =>
				Commands.literal(kind).then(
					Commands.argument('name', Arguments.STRING.create(event))
						.executes(ctx => nsScareRun(ctx, kind, nsScareArgName(ctx), null))
						.then(Commands.argument('mode', Arguments.STRING.create(event)).executes(ctx => nsScareRun(ctx, kind, nsScareArgName(ctx), String(Arguments.STRING.getResult(ctx, 'mode')))))
				))(k)
		)
	}
	root = root
		.then(
			Commands.literal('faces').then(
				Commands.argument('name', Arguments.STRING.create(event))
					.executes(ctx => nsScareFaces(ctx, nsScareArgName(ctx), 6, 4))
					.then(
						Commands.argument('r', Arguments.INTEGER.create(event))
							.executes(ctx => nsScareFaces(ctx, nsScareArgName(ctx), nsScareArgInt(ctx, 'r'), 4))
							.then(Commands.argument('secs', Arguments.INTEGER.create(event)).executes(ctx => nsScareFaces(ctx, nsScareArgName(ctx), nsScareArgInt(ctx, 'r'), nsScareArgInt(ctx, 'secs'))))
					)
			)
		)
		.then(Commands.literal('dweller').then(Commands.argument('name', Arguments.STRING.create(event)).executes(ctx => nsScareRunKind(ctx, 'dweller', nsScareArgName(ctx), 'dweller'))))
		.then(
			Commands.literal('preset').then(
				Commands.argument('name', Arguments.STRING.create(event))
					.executes(ctx => nsScareRunKind(ctx, 'preset', nsScareArgName(ctx), 'hunt'))
					.then(Commands.argument('preset', Arguments.STRING.create(event)).executes(ctx => nsScareRunKind(ctx, 'preset', nsScareArgName(ctx), String(Arguments.STRING.getResult(ctx, 'preset')))))
			)
		)
		.then(Commands.literal('watcher').then(Commands.argument('name', Arguments.STRING.create(event)).executes(ctx => nsScareRunExtra(ctx, 'watcher', nsScareArgName(ctx)))))
		.then(Commands.literal('face').then(Commands.argument('name', Arguments.STRING.create(event)).executes(ctx => nsScareRunExtra(ctx, 'face', nsScareArgName(ctx)))))
		.then(
			Commands.literal('voice').then(
				Commands.argument('name', Arguments.STRING.create(event))
					.executes(ctx => nsScareVoice(ctx, nsScareArgName(ctx), 'behind'))
					.then(Commands.argument('which', Arguments.STRING.create(event)).executes(ctx => nsScareVoice(ctx, nsScareArgName(ctx), String(Arguments.STRING.getResult(ctx, 'which')))))
			)
		)
		.then(
			Commands.literal('box').then(
				Commands.argument('name', Arguments.STRING.create(event))
					.executes(ctx => nsScareBoxCmd(ctx, nsScareArgName(ctx), 6))
					.then(Commands.argument('secs', Arguments.INTEGER.create(event)).executes(ctx => nsScareBoxCmd(ctx, nsScareArgName(ctx), nsScareArgInt(ctx, 'secs'))))
			)
		)
		.then(
			Commands.literal('whisper').then(
				Commands.argument('name', Arguments.STRING.create(event)).then(
					Commands.argument('text', Arguments.GREEDY_STRING.create(event)).executes(ctx => {
						var p = nsScareTarget(ctx, nsScareArgName(ctx))
						if (!p) return 0
						p.setStatusMessage(Text.darkRed(String(Arguments.GREEDY_STRING.getResult(ctx, 'text'))).italic())
						nsScareReply(ctx, 'шёпот отправлен')
						return 1
					})
				)
			)
		)
		.then(
			Commands.literal('stop').executes(ctx => {
				for (var i = 0; i < nsScares.length; i++) nsScareVanish(nsScares[i])
				nsScares = []
				for (var j = 0; j < nsFaceJobs.length; j++) nsFaceRestore(nsFaceJobs[j])
				nsFaceJobs = []
				nsFaceSave(ctx.source.getServer())
				nsScareCmd(ctx.source.getServer(), 'kill @e[tag=ns_scare]')
				nsScareReply(ctx, 'всё убрано')
				return 1
			})
		)
	event.register(root)
})
