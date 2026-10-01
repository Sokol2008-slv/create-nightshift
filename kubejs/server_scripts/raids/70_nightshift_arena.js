// ==========================================================================
// Ночная смена — АРЕНА (прототип, 30.09.2026; идея Георгия): отдельное измерение, где орда идёт по длинному
// коридору на алтарь. Базу не жалко: перед набегом арена запоминается, после — восстанавливается как была
// (ядерный заряд, боссы, взрывы — всё откатится). Строй тут турели, щит, ставь големов — постройки
// сохраняются между набегами (снимок — в момент выхода орды). Откатываются БЛОКИ: содержимое сундуков,
// ток в батареях и патроны остаются как в конце набега (без дюпа); сломанное хранилище возвращается пустым.
//  /arena        — войти (запоминается, откуда пришёл); /arena leave — вернуться.
//  /arena reset  — (оператор) восстановить арену из снимка вручную.
// Коридор: x −10…10, пол y=64, z 0…127; алтарь у входа (0, 66, 6); орда выходит в дальнем конце (z≈120).
// Ток с базы — передатчиком энергии Create: Ender Transmission (передаёт между измерениями).
// Големы и драконы — мобы, их снимок не сохраняет (решение Георгия: «их восстанавливать нам самим»).
//
// Арена v2 (01.10, Георгий: «стены и фонари неразрушимые, крутой ландшафт, приукрасить, нужна крыша — фантомы
// убегают; главное — не делать кривым пол, а то с турелями сложно»):
//  - коридор тот же (постройки игроков внутри не трогаются), пол ровный;
//  - стены до крыши (y 64…92) с колоннами, окнами и светом, стеклянная крыша на балках с висячими фонарями,
//    ворота орды в дальнем конце;
//  - снаружи — каньон: долина с руинами, фонарями и лавовыми озёрами, за ней скалы до y≈135 (видно в окна и сквозь
//    крышу), звёзды и луна (в измерении вечная полночь);
//  - оболочка (стены, пол, крыша, верх под крышей, всё снаружи) не ломается ни грызением, ни подрывниками —
//    nsArenaIsShell в nsIsBlockProtected. Ломаются только постройки игроков (и откатываются после набега);
//  - старая арена (v1) достраивается сама при загрузке сервера, если набега нет (nsArenaUpgradeTick).
// ==========================================================================
var NS_ARENA_DIM = 'nightshift:arena'
var NS_ARENA_BACKUP_DX = 4000 // резервная копия — та же арена, сдвинутая по x
var NS_ARENA_VERSION = 2
var NS_ARENA_ROOF = 92
// блок арены [x1, y1, z1, x2, y2, z2], кусками — у /clone предел 32 768 блоков за раз (25 × 31 × 33 ≈ 25,6 тыс.)
var NS_ARENA_BOX = [-12, 63, -2, 12, 93, 130]
var NS_ARENA_Z_SLICES = [[-2, 30], [31, 63], [64, 96], [97, 130]]
// ландшафт вокруг: [x1, z1, x2, z2]
var NS_ARENA_LAND = [-44, -30, 44, 158]

// Оболочка арены — стены, пол, крыша, полоса под крышей (висячие фонари) и всё снаружи коридора.
// Мобы её не грызут, подрывники не выбивают (10_nightshift_state.js, nsIsBlockProtected).
function nsArenaIsShell(dim, x, y, z) {
	if (dim !== NS_ARENA_DIM) return false
	if (x < NS_ARENA_LAND[0] - 16 || x > NS_ARENA_LAND[2] + 16) return false // запасная копия (x+4000) — не здесь
	return x <= -11 || x >= 11 || z <= -1 || z >= 128 || y <= 64 || y >= NS_ARENA_ROOF - 4
}
var NS_ARENA_CONTAINER = Java.loadClass('net.minecraft.world.Container')

function nsArenaRun(cmd) {
	NSG.nsServer.runCommandSilent('execute in ' + NS_ARENA_DIM + ' run ' + cmd)
}

function nsArenaForceload() {
	var B = NS_ARENA_BOX
	nsArenaRun('forceload add ' + B[0] + ' ' + B[2] + ' ' + B[3] + ' ' + B[5])
	nsArenaRun('forceload add ' + (B[0] + NS_ARENA_BACKUP_DX) + ' ' + B[2] + ' ' + (B[3] + NS_ARENA_BACKUP_DX) + ' ' + B[5])
}

// Копирование арены: toBackup = true — в резервную зону, false — обратно. Возвращает true, если все куски
// скопировались: clone молча не срабатывает в незагруженном чанке, поэтому угол каждого куска в месте
// назначения заранее делаем «маяком» (structure_void) — после копии он обязан совпасть с источником.
function nsArenaClone(toBackup) {
	var B = NS_ARENA_BOX
	var dx = NS_ARENA_BACKUP_DX
	var level = NSG.nsServer.getLevel(NS_ARENA_DIM)
	var ok = true
	for (var i = 0; i < NS_ARENA_Z_SLICES.length; i++) {
		var z1 = NS_ARENA_Z_SLICES[i][0],
			z2 = NS_ARENA_Z_SLICES[i][1]
		var from = toBackup ? B[0] : B[0] + dx
		var to = toBackup ? B[0] + dx : B[0]
		nsArenaRun('setblock ' + to + ' ' + B[1] + ' ' + z1 + ' minecraft:structure_void')
		nsArenaRun('clone ' + from + ' ' + B[1] + ' ' + z1 + ' ' + (from + (B[3] - B[0])) + ' ' + B[4] + ' ' + z2 + ' ' + to + ' ' + B[1] + ' ' + z1 + ' replace')
		try {
			var src = level.getBlock(from, B[1], z1).getBlockState()
			var dst = level.getBlock(to, B[1], z1).getBlockState()
			// сравнение строкой: у части состояний (трава снаружи арены v2) Rhino не видит equals — снимок «не удавался»
			if (String(src) !== String(dst)) {
				ok = false
				console.warn('[nightshift] арена: кусок z ' + z1 + '…' + z2 + ' не скопировался (' + src + ' → ' + dst + ')')
			}
		} catch (e) {
			ok = false
			console.warn('[nightshift] арена: проверка куска z ' + z1 + ': ' + e)
		}
	}
	return ok
}

// Живое содержимое блок-сущностей арены (сундуки, батареи, турели, баки) — до отката. Откат возвращает
// БЛОКИ, а не ресурсы: иначе забрал из сундука во время набега → после отката сундук снова полный (дюп),
// потраченные ток и патроны — снова на месте.
function nsArenaSaveLive(level) {
	var B = NS_ARENA_BOX
	var live = {}
	var reg = level.registryAccess()
	for (var cx = Math.floor(B[0] / 16); cx <= Math.floor(B[3] / 16); cx++) {
		for (var cz = Math.floor(B[2] / 16); cz <= Math.floor(B[5] / 16); cz++) {
			var it = level.getChunk(cx, cz).getBlockEntities().values().iterator()
			while (it.hasNext()) {
				var be = it.next()
				var pos = be.getBlockPos()
				if (pos.getX() < B[0] || pos.getX() > B[3] || pos.getY() < B[1] || pos.getY() > B[4] || pos.getZ() < B[2] || pos.getZ() > B[5]) continue
				try {
					live[pos.getX() + ',' + pos.getY() + ',' + pos.getZ()] = { block: be.getBlockState().getBlock(), nbt: be.saveWithFullMetadata(reg) }
				} catch (e) {
					console.warn('[nightshift] арена: не прочитать ' + pos + ': ' + e)
				}
			}
		}
	}
	return live
}

// После отката: уцелевшим блокам — их живое содержимое; восстановленные из снимка (были сломаны в набеге)
// хранилища — пустые (иначе: вынул всё, сломал сундук — после отката он полный).
function nsArenaApplyLive(level, live) {
	var B = NS_ARENA_BOX
	var reg = level.registryAccess()
	var kept = 0,
		emptied = 0
	for (var cx = Math.floor(B[0] / 16); cx <= Math.floor(B[3] / 16); cx++) {
		for (var cz = Math.floor(B[2] / 16); cz <= Math.floor(B[5] / 16); cz++) {
			var it = level.getChunk(cx, cz).getBlockEntities().values().iterator()
			while (it.hasNext()) {
				var be = it.next()
				var pos = be.getBlockPos()
				if (pos.getX() < B[0] || pos.getX() > B[3] || pos.getY() < B[1] || pos.getY() > B[4] || pos.getZ() < B[2] || pos.getZ() > B[5]) continue
				var was = live[pos.getX() + ',' + pos.getY() + ',' + pos.getZ()]
				try {
					if (was && was.block.equals(be.getBlockState().getBlock())) {
						be.loadWithComponents(was.nbt, reg)
						kept++
					} else if (be instanceof NS_ARENA_CONTAINER) {
						be.clearContent()
						emptied++
					} else continue
					be.setChanged()
					level.sendBlockUpdated(pos, be.getBlockState(), be.getBlockState(), 3)
				} catch (e) {
					console.warn('[nightshift] арена: не вернуть содержимое ' + pos + ': ' + e)
				}
			}
		}
	}
	console.info('[nightshift] арена: содержимое оставлено как в конце набега у ' + kept + ', опустошено восстановленных ' + emptied)
}

function nsArenaBuild(st) {
	nsArenaForceload()
	// пол ровный, по центру — дорожка света; дальний конец — «ворота» орды
	nsArenaRun('fill -12 63 -2 12 ' + (NS_ARENA_ROOF + 1) + ' 130 minecraft:air')
	nsArenaRun('fill -10 64 0 10 64 127 minecraft:polished_blackstone_bricks')
	nsArenaRun('fill -5 64 0 -5 64 117 minecraft:polished_deepslate')
	nsArenaRun('fill 5 64 0 5 64 117 minecraft:polished_deepslate')
	for (var z = 4; z < 128; z += 8) nsArenaRun('setblock 0 64 ' + z + ' minecraft:shroomlight')
	nsArenaRun('fill -10 64 118 10 64 127 minecraft:crying_obsidian')
	// алтарь и блок базы
	nsArenaRun('setblock 0 65 6 nightshift:base_core')
	nsArenaRun('setblock 0 66 6 nightshift:altar')
	var level = NSG.nsServer.getLevel(NS_ARENA_DIM)
	var altar = nsUpsertAltar(st, level.getBlock(0, 66, 6))
	altar.spawns = [
		{ x: -6, y: 65, z: 122 },
		{ x: 0, y: 65, z: 124 },
		{ x: 6, y: 65, z: 122 },
	]
	st.arena = { built: true, altarId: altar.id, v: 1 }
	nsSaveState(st)
	nsArenaRun('setblock -11 64 -1 minecraft:deepslate_tiles') // пока стены строятся — хоть угол
	console.info('[nightshift] арена: пол и алтарь ' + altar.id + ', стены и ландшафт — следом')
	nsArenaStartDecor(st)
}

// --------------------------------------------------------------------------
// Стены, крыша, ворота и ландшафт v2 — очередью команд по ~400 за тик (тысячи fill разом подвесили бы сервер),
// чанки ландшафта сначала грузим (fill в незагруженном чанке молча не срабатывает), в конце — снимок арены.
// --------------------------------------------------------------------------
// Шум для рельефа: детерминированный хеш по клетке + билинейная сглаживающая сетка
function nsArenaHash(x, z) {
	var h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
	return h - Math.floor(h)
}
function nsArenaNoise(x, z, cell) {
	var gx = Math.floor(x / cell),
		gz = Math.floor(z / cell)
	var fx = x / cell - gx,
		fz = z / cell - gz
	var a = nsArenaHash(gx, gz),
		b = nsArenaHash(gx + 1, gz),
		c = nsArenaHash(gx, gz + 1),
		d = nsArenaHash(gx + 1, gz + 1)
	var sx = fx * fx * (3 - 2 * fx),
		sz = fz * fz * (3 - 2 * fz)
	return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1
}
// Высота земли снаружи: долина у стен (62–65), дальше скалы ступенями до ~135
function nsArenaLandHeight(x, z) {
	var dx = Math.max(0, Math.abs(x) - 11),
		dz = Math.max(0, -1 - z, z - 128)
	var d = Math.max(dx, dz)
	var n = nsArenaNoise(x, z, 9) * 0.65 + nsArenaNoise(x, z, 4) * 0.35
	if (d <= 7) return 63 + Math.round(n * 1.5)
	var h = 66 + (d - 7) * 3.4 + n * 9
	h = Math.floor(h / 3) * 3 + (nsArenaHash(x, z) < 0.3 ? 1 : 0) // уступы
	return Math.max(64, Math.min(136, h))
}

function nsArenaDecorCmds() {
	var c = []
	var R = NS_ARENA_ROOF
	var L = NS_ARENA_LAND
	// --- ландшафт: колонны рельефа, кроме коридора и стен ---
	var rocks = ['minecraft:stone', 'minecraft:andesite', 'minecraft:tuff', 'minecraft:deepslate', 'minecraft:stone', 'minecraft:blackstone']
	var glows = ['minecraft:ochre_froglight', 'minecraft:verdant_froglight', 'minecraft:pearlescent_froglight', 'minecraft:glowstone', 'minecraft:crying_obsidian']
	for (var x = L[0]; x <= L[2]; x++) {
		for (var z = L[1]; z <= L[3]; z++) {
			if (x >= -11 && x <= 11 && z >= -1 && z <= 128) continue
			var h = nsArenaLandHeight(x, z)
			var r = nsArenaHash(x * 3 + 7, z * 5 + 1)
			var rock = rocks[Math.floor(nsArenaNoise(x + 500, z, 7) * 2.99 + 3) % rocks.length]
			c.push('fill ' + x + ' 52 ' + z + ' ' + x + ' ' + (h - 1) + ' ' + z + ' ' + rock)
			var top
			if (h <= 66) top = r < 0.12 ? 'minecraft:coarse_dirt' : r < 0.2 ? 'minecraft:moss_block' : 'minecraft:grass_block'
			else if (h >= 120) top = 'minecraft:snow_block'
			else if (h >= 100) top = r < 0.5 ? 'minecraft:moss_block' : rock
			else top = r < 0.04 ? glows[Math.floor(r * 100) % glows.length] : r < 0.5 ? 'minecraft:grass_block' : rock
			c.push('setblock ' + x + ' ' + h + ' ' + z + ' ' + top)
			// убранство долины: фонари на столбах, трава, руины, сухие деревья на склонах
			if (h <= 66) {
				if (r > 0.985) {
					c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 2) + ' ' + z + ' minecraft:dark_oak_fence')
					c.push('setblock ' + x + ' ' + (h + 3) + ' ' + z + ' minecraft:lantern')
				} else if (r > 0.975) c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 1 + Math.floor(r * 1000) % 5) + ' ' + z + ' minecraft:cracked_stone_bricks')
				else if (r > 0.96) c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 2 + Math.floor(r * 1000) % 3) + ' ' + z + ' minecraft:mossy_stone_bricks')
				else if (r > 0.8 && top === 'minecraft:grass_block') c.push('setblock ' + x + ' ' + (h + 1) + ' ' + z + ' ' + (r > 0.9 ? 'minecraft:fern' : 'minecraft:short_grass'))
			} else if (h < 112 && top === 'minecraft:grass_block' && r > 0.992) c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 3 + Math.floor(r * 1000) % 3) + ' ' + z + ' minecraft:dark_oak_log')
		}
	}
	// лавовые озёра в долине: ровная площадка 5×5, кромка из чернокамня, лава 3×3
	var pools = [[-16, 18], [16, 46], [-17, 78], [17, 104], [0, 142], [0, -14]]
	for (var i = 0; i < pools.length; i++) {
		var px = pools[i][0],
			pz = pools[i][1]
		c.push('fill ' + (px - 2) + ' 52 ' + (pz - 2) + ' ' + (px + 2) + ' 63 ' + (pz + 2) + ' minecraft:blackstone')
		c.push('fill ' + (px - 2) + ' 64 ' + (pz - 2) + ' ' + (px + 2) + ' 67 ' + (pz + 2) + ' minecraft:air')
		c.push('fill ' + (px - 2) + ' 63 ' + (pz - 2) + ' ' + (px + 2) + ' 63 ' + (pz + 2) + ' minecraft:polished_blackstone')
		c.push('fill ' + (px - 1) + ' 63 ' + (pz - 1) + ' ' + (px + 1) + ' 63 ' + (pz + 1) + ' minecraft:lava')
	}
	// --- стены коридора (x = ±11) до крыши: цоколь, кладка, пояс, колонны с огнями, окна в долину ---
	var sides = [-11, 11]
	for (var si = 0; si < 2; si++) {
		var X = sides[si]
		c.push('fill ' + X + ' 63 -1 ' + X + ' 66 128 minecraft:polished_deepslate')
		c.push('fill ' + X + ' 67 -1 ' + X + ' ' + (R - 1) + ' 128 minecraft:deepslate_bricks')
		c.push('fill ' + X + ' 80 -1 ' + X + ' 80 128 minecraft:chiseled_deepslate')
		for (var p = 0; p <= 128; p += 8) {
			c.push('fill ' + X + ' 64 ' + p + ' ' + X + ' ' + (R - 1) + ' ' + p + ' minecraft:polished_basalt')
			c.push('setblock ' + X + ' 70 ' + p + ' minecraft:ochre_froglight')
			c.push('setblock ' + X + ' 86 ' + p + ' minecraft:ochre_froglight')
			if (p + 6 <= 127) {
				c.push('fill ' + X + ' 73 ' + (p + 2) + ' ' + X + ' 78 ' + (p + 6) + ' minecraft:glass')
				c.push('setblock ' + X + ' 69 ' + (p + 4) + ' minecraft:sea_lantern')
			}
		}
	}
	// --- торцы: у входа (z = −1) — стена со щелями-окнами, в дальнем конце (z = 128) — ворота орды ---
	c.push('fill -10 63 -1 10 66 -1 minecraft:polished_deepslate')
	c.push('fill -10 67 -1 10 ' + (R - 1) + ' -1 minecraft:deepslate_bricks')
	c.push('fill -10 80 -1 10 80 -1 minecraft:chiseled_deepslate')
	for (var w = -8; w <= 8; w += 8) c.push('fill ' + w + ' 70 -1 ' + w + ' 84 -1 minecraft:glass')
	c.push('fill -10 63 128 10 66 128 minecraft:polished_deepslate')
	c.push('fill -10 67 128 10 ' + (R - 1) + ' 128 minecraft:deepslate_bricks')
	c.push('fill -6 64 128 6 78 128 minecraft:crying_obsidian')
	c.push('fill -5 65 128 5 77 128 minecraft:iron_bars')
	c.push('fill -6 63 129 6 79 131 minecraft:magma_block') // за решёткой — раскалённое нутро
	c.push('fill -1 79 128 1 81 128 minecraft:gilded_blackstone')
	// --- крыша: стекло на балках, висячие фонари ---
	c.push('fill -11 ' + R + ' -1 11 ' + R + ' 128 minecraft:glass')
	for (var bz = 0; bz <= 128; bz += 8) {
		c.push('fill -11 ' + R + ' ' + bz + ' 11 ' + R + ' ' + bz + ' minecraft:polished_deepslate')
		var lx = [-6, 0, 6]
		for (var li = 0; li < lx.length; li++) {
			c.push('setblock ' + lx[li] + ' ' + (R - 1) + ' ' + bz + ' minecraft:chain[axis=y] keep')
			c.push('setblock ' + lx[li] + ' ' + (R - 2) + ' ' + bz + ' minecraft:lantern[hanging=true] keep')
		}
	}
	c.push('fill 0 ' + R + ' -1 0 ' + R + ' 128 minecraft:polished_deepslate')
	return c
}

// Очередь: строки — команды в измерении арены, {wait: N} — пауза в тиках, {fn} — шаг кодом
NSG.nsArenaJobs = NSG.nsArenaJobs || []
function nsArenaStartDecor(st) {
	var L = NS_ARENA_LAND
	var jobs = []
	jobs.push({ fn: function () {
		nsArenaRun('forceload add ' + L[0] + ' ' + L[1] + ' ' + L[2] + ' ' + L[3])
	} })
	jobs.push({ wait: 60 }) // чанки ландшафта догружаются
	jobs = jobs.concat(nsArenaDecorCmds())
	jobs.push({ fn: function () {
		var s2 = nsGetState()
		// контроль: крыша над серединой коридора и стена на месте
		var lvl = NSG.nsServer.getLevel(NS_ARENA_DIM)
		var ok = String(lvl.getBlock(3, NS_ARENA_ROOF, 60).getBlockState().getBlock().id) === 'minecraft:glass' && String(lvl.getBlock(11, 75, 60).getBlockState().getBlock().id) !== 'minecraft:air'
		nsArenaRun('forceload remove ' + L[0] + ' ' + L[1] + ' ' + L[2] + ' ' + L[3])
		nsArenaForceload()
		if (!ok) {
			console.warn('[nightshift] арена v2: проверка не прошла (чанки не загрузились?) — повторю при следующей загрузке')
			return
		}
		if (s2.arena) {
			s2.arena.v = NS_ARENA_VERSION
			nsSaveState(s2)
		}
		// снимок — только вне набега на арене (во время набега его снимет начало следующего)
		var active = s2.raid && s2.raid.state !== 'idle' && s2.raid.altarId === (s2.arena && s2.arena.altarId)
		if (!active) nsArenaClone(true)
		console.info('[nightshift] арена v2 готова: стены до крыши, крыша, ландшафт' + (active ? ' (снимок — в начале следующего набега)' : ', снимок обновлён'))
		nsArenaRun('tellraw @a[distance=0..] {"text":"[Ночная смена] Арена перестроена: крыша, стены до неба, каньон вокруг. Пол — как был.","color":"gold"}')
	} })
	NSG.nsArenaJobs = NSG.nsArenaJobs.concat(jobs)
	console.info('[nightshift] арена v2: в очереди ' + jobs.length + ' шагов')
}

// Достройка старой арены (v1) — один раз после загрузки сервера, когда на арене нет набега
var nsArenaUpgradeWait = 0
ServerEvents.tick(event => {
	try {
		var jobs = NSG.nsArenaJobs
		if (jobs && jobs.length) {
			var budget = 400
			while (budget > 0 && jobs.length) {
				var j = jobs[0]
				if (typeof j === 'string') {
					jobs.shift()
					nsArenaRun(j)
					budget--
				} else if (j.wait !== undefined) {
					if (j.wait-- <= 0) jobs.shift()
					break
				} else {
					jobs.shift()
					try {
						j.fn()
					} catch (e) {
						console.error('[nightshift] арена: шаг очереди: ' + e)
					}
					budget -= 50
				}
			}
			return
		}
		if (NSG.nsArenaUpgradeChecked) return
		if (++nsArenaUpgradeWait < 400) return // ~20 с после старта
		NSG.nsArenaUpgradeChecked = true
		var st = nsGetState()
		if (!st || !st.arena || !st.arena.built || (st.arena.v || 1) >= NS_ARENA_VERSION) return
		var busy = st.raid && st.raid.state !== 'idle' && st.raid.altarId === st.arena.altarId
		if (busy) {
			NSG.nsArenaUpgradeChecked = false
			nsArenaUpgradeWait = 0 // на арене набег — проверим позже
			return
		}
		nsArenaForceload()
		nsArenaStartDecor(st)
	} catch (e) {
		console.error('[nightshift] арена: ' + e)
	}
})

// Хук набега (из 40_nightshift_raid.js): 'start' — снимок (в момент выхода орды, чтобы попало всё построенное
// за отсчёт), 'end' — откат. Только для алтаря арены. Снимок не удался — не откатываем (иначе вернули бы
// арену к старому снимку и стёрли постройки прошлых набегов). Флаг — в памяти: состояние набега сохраняет
// вызывающий код своим объектом и затёр бы поле в сохранённом.
function nsArenaHook(kind, altarId) {
	var st = nsGetState()
	if (!st.arena || !st.arena.built || st.arena.altarId !== altarId) return
	nsArenaForceload()
	if (kind === 'start') {
		NSG.nsArenaSnapOk = nsArenaClone(true)
		if (NSG.nsArenaSnapOk) console.info('[nightshift] арена: снимок перед набегом')
		else {
			console.warn('[nightshift] арена: снимок НЕ удался (чанк не загружен?) — откат после набега отключён')
			nsArenaRun('tellraw @a {"text":"[Ночная смена] Снимок арены не удался — после этого набега она не восстановится.","color":"red"}')
		}
	} else {
		if (NSG.nsArenaSnapOk === false) {
			NSG.nsArenaSnapOk = undefined
			nsArenaRun('tellraw @a {"text":"[Ночная смена] Арена не восстановлена: снимка этого набега нет.","color":"red"}')
			return
		}
		var level = NSG.nsServer.getLevel(NS_ARENA_DIM)
		var live = nsArenaSaveLive(level)
		NSG.nsServer.runCommandSilent('execute in ' + NS_ARENA_DIM + ' run kill @e[type=item,x=-12,y=0,z=-2,dx=24,dy=255,dz=132]')
		var ok = nsArenaClone(false)
		nsArenaApplyLive(level, live)
		NSG.nsArenaSnapOk = undefined
		if (ok) nsArenaRun('tellraw @a {"text":"[Ночная смена] Арена восстановлена как перед набегом. Сундуки, ток и патроны — как в конце набега.","color":"gray"}')
		else nsArenaRun('tellraw @a {"text":"[Ночная смена] Арена восстановлена не целиком (чанк не загружен?) — /arena reset (оператор).","color":"red"}')
		console.info('[nightshift] арена: восстановлена из снимка' + (ok ? '' : ' НЕ целиком'))
	}
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	// выход из арены (кнопка «На базу», /arena leave, и /arena изнутри арены — старые кнопки «Арена» в чате тоже ведут домой)
	function nsArenaLeave(player) {
		var st = nsGetState()
		var name = String(player.getUsername())
		var back = (st.arenaReturns || {})[name]
		if (!back) {
			// нет записи, откуда пришёл, — к алтарю базы, а если его нет — на поверхность у 0 0
			var home = typeof nsHomeAltar === 'function' ? nsHomeAltar(st) : null
			if (home) NSG.nsServer.runCommandSilent('execute in ' + home.dim + ' run tp ' + name + ' ' + (home.x + 0.5) + ' ' + (home.y + 1) + ' ' + (home.z + 2.5))
			else NSG.nsServer.runCommandSilent('execute in minecraft:overworld positioned 0 0 0 positioned over motion_blocking_no_leaves run tp ' + name + ' ~ ~ ~')
		} else {
			nsReturnPlayer(name, back)
			delete st.arenaReturns[name]
			nsSaveState(st)
		}
		return 1
	}

	event.register(
		C.literal('arena')
			.executes(ctx => {
				var player = ctx.source.getPlayer()
				if (!player) return 0
				if (String(player.getLevel().getDimension()) === NS_ARENA_DIM) return nsArenaLeave(player)
				var st = nsGetState()
				if (!st.arena || !st.arena.built) nsArenaBuild(st)
				st = nsGetState()
				var name = String(player.getUsername())
				var dim = String(player.getLevel().getDimension())
				if (dim !== NS_ARENA_DIM) {
					st.arenaReturns = st.arenaReturns || {}
					st.arenaReturns[name] = { dim: dim, x: player.getX(), y: player.getY(), z: player.getZ() }
					nsSaveState(st)
				}
				NSG.nsServer.runCommandSilent('execute in ' + NS_ARENA_DIM + ' run tp ' + name + ' 0 65 2 0 0')
				player.tell(Text.gold('[Ночная смена] Арена: алтарь впереди, орда выйдет из дальнего конца коридора. ').append(Text.gray('Всё, что сломается в набеге, восстановится. Назад — /arena ещё раз (или кнопка «На базу» в меню алтаря)')))
				return 1
			})
			.then(
				C.literal('leave').executes(ctx => {
					var player = ctx.source.getPlayer()
					if (!player) return 0
					return nsArenaLeave(player)
				})
			)
			.then(
				C.literal('reset').requires(s => s.hasPermission(2)).executes(ctx => {
					var st = nsGetState()
					if (!st.arena || !st.arena.built) return 0
					nsArenaHook('end', st.arena.altarId)
					return 1
				})
			)
	)
})
