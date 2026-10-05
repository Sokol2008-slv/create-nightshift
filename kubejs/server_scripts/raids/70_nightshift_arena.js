// ==========================================================================
// Ночная смена — АРЕНА (прототип, 30.09.2026; идея Георгия): отдельное измерение, где орда идёт по длинному
// коридору на алтарь. Базу не жалко: перед набегом арена запоминается, после — восстанавливается как была
// (ядерный заряд, боссы, взрывы — всё откатится). Строй тут турели, щит, ставь големов — постройки
// сохраняются между набегами (снимок — в момент выхода орды). Откатываются БЛОКИ: содержимое сундуков,
// ток в батареях и патроны остаются как в конце набега (без дюпа); сломанное хранилище возвращается пустым.
//  /arena        — войти (запоминается, откуда пришёл); /arena leave — вернуться.
//  /arena reset  — (оператор) восстановить арену из снимка вручную.
//  /arena endless [stop] — «Выживание»: подволны лучшей волны по кругу, рекорд арены (48_night_call.js).
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
					if (was && String(was.block) === String(be.getBlockState().getBlock())) { // строкой: у части блоков Rhino не видит equals
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

// --------------------------------------------------------------------------
// ТЕМЫ АРЕНЫ (Георгий, 01.10: «локацию менять — сами блоки, снежная тематика с такой-то по такую-то волну, приколы;
// креативь на полную»). Тема — по номеру волны набега на арене: при старте набега, если тема другая, арена
// перестраивается за отсчёт (стены, крыша, ворота, ландшафт, биом — снег, пепел, души); пол и постройки игроков
// внутри не трогаются. У каждой темы свои «приколы» — эффекты игрокам и мобам на время набега на арене.
// Места рельефа и украшений одни для всех тем (хеш клетки) — меняются только блоки; старые украшения сносятся
// заменой по тегу nightshift:arena_decor.
// --------------------------------------------------------------------------
function nsAt(id) {
	return 'minecraft:' + id
}
NSG.NS_ARENA_THEMES = [
	{
		key: 'shaft', name: 'Шахта', from: 1, biome: 'the_void', color: 'gray',
		note: 'обычная смена, без сюрпризов',
		rocks: ['stone', 'andesite', 'tuff', 'deepslate', 'stone', 'blackstone'],
		top: { low: ['coarse_dirt', 'moss_block', 'grass_block'], mid: 'grass_block', high: 'moss_block', peak: 'snow_block' },
		glows: ['ochre_froglight', 'verdant_froglight', 'pearlescent_froglight', 'glowstone'],
		decor: { post: 'dark_oak_fence', postTop: 'lantern', ruinA: 'cracked_stone_bricks', ruinB: 'mossy_stone_bricks', plant1: 'short_grass', plant2: 'fern', tree: 'dark_oak_log' },
		pool: { base: 'blackstone', rim: 'polished_blackstone', fill: 'lava' },
		wall: { base: 'polished_deepslate', main: 'deepslate_bricks', trim: 'chiseled_deepslate', pillar: 'polished_basalt', light: 'ochre_froglight', light2: 'sea_lantern', window: 'glass' },
		roof: { glass: 'glass', beam: 'polished_deepslate', lantern: 'lantern' },
		gate: { frame: 'crying_obsidian', bars: 'iron_bars', core: 'magma_block', crown: 'gilded_blackstone' },
		fx: null,
	},
	{
		key: 'canyon', name: 'Каньон пауков', from: 16, biome: 'badlands', color: 'gold',
		note: 'сухой воздух: у вас «Спешка II» (бить и копать быстрее), у орды — «Скорость I»',
		rocks: ['terracotta'],
		bands: ['orange_terracotta', 'terracotta', 'yellow_terracotta', 'red_terracotta', 'white_terracotta', 'orange_terracotta', 'brown_terracotta', 'terracotta', 'light_gray_terracotta', 'red_terracotta'],
		top: { low: ['coarse_dirt', 'red_sand', 'red_sand'], mid: 'red_sand', high: 'red_sand', peak: 'red_sandstone' },
		glows: ['ochre_froglight', 'glowstone'],
		decor: { post: 'dark_oak_fence', postTop: 'lantern', ruinA: 'cut_red_sandstone', ruinB: 'chiseled_red_sandstone', plant1: 'dead_bush', plant2: 'cobweb', tree: 'stripped_dark_oak_log' },
		pool: { base: 'red_sandstone', rim: 'smooth_red_sandstone', fill: 'lava' },
		wall: { base: 'smooth_red_sandstone', main: 'cut_red_sandstone', trim: 'chiseled_red_sandstone', pillar: 'red_terracotta', light: 'ochre_froglight', light2: 'glowstone', window: 'orange_stained_glass' },
		roof: { glass: 'glass', beam: 'smooth_red_sandstone', lantern: 'lantern' },
		gate: { frame: 'chiseled_red_sandstone', bars: 'iron_bars', core: 'magma_block', crown: 'gold_block' },
		fx: { players: { haste: 2 }, mobs: { speed: 1 } },
	},
	{
		key: 'frost', name: 'Вечная мерзлота', from: 30, biome: 'snowy_plains', color: 'aqua',
		note: 'метель: вы на льду быстрее («Скорость I»), орда медленнее, но закалённая («Медлительность I», «Сопротивление II»)',
		rocks: ['stone', 'calcite', 'diorite', 'packed_ice', 'snow_block', 'andesite'],
		top: { low: ['powder_snow', 'snow_block', 'snow_block'], mid: 'snow_block', high: 'snow_block', peak: 'packed_ice' },
		glows: ['pearlescent_froglight', 'blue_ice'],
		decor: { post: 'spruce_fence', postTop: 'soul_lantern', ruinA: 'packed_ice', ruinB: 'blue_ice', plant1: 'snow', plant2: 'snow', tree: 'spruce_log', treeTop: 'spruce_leaves[persistent=true]' },
		pool: { base: 'snow_block', rim: 'packed_ice', fill: 'blue_ice' },
		wall: { base: 'polished_diorite', main: 'calcite', trim: 'packed_ice', pillar: 'blue_ice', light: 'pearlescent_froglight', light2: 'sea_lantern', window: 'light_blue_stained_glass' },
		roof: { glass: 'light_blue_stained_glass', beam: 'packed_ice', lantern: 'soul_lantern' },
		gate: { frame: 'blue_ice', bars: 'iron_bars', core: 'pearlescent_froglight', crown: 'packed_ice' },
		fx: { players: { speed: 1 }, mobs: { slowness: 1, resistance: 2 } },
	},
	{
		key: 'inferno', name: 'Пекло', from: 45, biome: 'basalt_deltas', color: 'red',
		note: 'жар: орда горит и злее («Сила I», огнестойкость), вам — огнестойкость (спецовки ОТК)',
		rocks: ['netherrack', 'blackstone', 'basalt', 'netherrack', 'smooth_basalt', 'blackstone'],
		top: { low: ['netherrack', 'crimson_nylium', 'crimson_nylium'], mid: 'crimson_nylium', high: 'netherrack', peak: 'magma_block' },
		glows: ['shroomlight', 'glowstone', 'magma_block'],
		decor: { post: 'nether_brick_fence', postTop: 'lantern', ruinA: 'cracked_nether_bricks', ruinB: 'nether_bricks', plant1: 'crimson_roots', plant2: 'crimson_fungus', tree: 'crimson_stem', treeTop: 'nether_wart_block' },
		pool: { base: 'magma_block', rim: 'polished_blackstone', fill: 'lava' },
		wall: { base: 'polished_blackstone', main: 'nether_bricks', trim: 'chiseled_nether_bricks', pillar: 'polished_basalt', light: 'shroomlight', light2: 'glowstone', window: 'red_stained_glass' },
		roof: { glass: 'glass', beam: 'nether_bricks', lantern: 'lantern' },
		gate: { frame: 'gilded_blackstone', bars: 'iron_bars', core: 'magma_block', crown: 'gold_block' },
		fx: { players: { fire_resistance: 1 }, mobs: { strength: 1, fire_resistance: 1 }, burning: true },
	},
	{
		key: 'ender', name: 'Край', from: 60, biome: 'end_highlands', color: 'light_purple',
		note: 'низкая гравитация: вы прыгаете выше и падаете медленно, но и орда скачет через стены в два блока («Прыгучесть II»)',
		rocks: ['end_stone', 'end_stone', 'end_stone_bricks', 'obsidian', 'purpur_block', 'end_stone'],
		top: { low: ['end_stone', 'end_stone', 'end_stone'], mid: 'end_stone', high: 'end_stone', peak: 'purpur_block' },
		glows: ['pearlescent_froglight', 'crying_obsidian'],
		decor: { post: 'end_stone_brick_wall', postTop: 'end_rod', ruinA: 'purpur_pillar', ruinB: 'end_stone_bricks', plant1: 'end_rod', plant2: 'end_rod', tree: 'purpur_pillar', treeTop: 'end_rod' },
		pool: { base: 'obsidian', rim: 'obsidian', fill: 'crying_obsidian' },
		wall: { base: 'end_stone_bricks', main: 'purpur_block', trim: 'purpur_pillar', pillar: 'obsidian', light: 'pearlescent_froglight', light2: 'sea_lantern', window: 'purple_stained_glass' },
		roof: { glass: 'glass', beam: 'purpur_pillar', lantern: 'soul_lantern' },
		gate: { frame: 'obsidian', bars: 'iron_bars', core: 'crying_obsidian', crown: 'purpur_pillar' },
		fx: { players: { jump_boost: 2, slow_falling: 1 }, mobs: { jump_boost: 2 } },
	},
	{
		key: 'nightmare', name: 'Кошмар', from: 70, biome: 'soul_sand_valley', color: 'dark_aqua',
		note: 'тьма накатывает каждые 30 с, зато орда светится — видно, кого бить',
		rocks: ['soul_soil', 'soul_sand', 'deepslate', 'sculk', 'blackstone', 'bone_block'],
		top: { low: ['soul_sand', 'soul_soil', 'soul_soil'], mid: 'soul_soil', high: 'sculk', peak: 'bone_block' },
		glows: ['verdant_froglight', 'crying_obsidian'],
		decor: { post: 'deepslate_brick_wall', postTop: 'soul_lantern', ruinA: 'cracked_deepslate_bricks', ruinB: 'chiseled_deepslate', plant1: 'soul_fire', plant2: 'soul_fire', tree: 'bone_block' },
		pool: { base: 'soul_soil', rim: 'polished_blackstone', fill: 'soul_soil', top: 'soul_fire' },
		wall: { base: 'deepslate_tiles', main: 'cracked_deepslate_bricks', trim: 'sculk', pillar: 'bone_block', light: 'verdant_froglight', light2: 'crying_obsidian', window: 'gray_stained_glass' },
		roof: { glass: 'gray_stained_glass', beam: 'deepslate_tiles', lantern: 'soul_lantern' },
		gate: { frame: 'crying_obsidian', bars: 'iron_bars', core: 'verdant_froglight', crown: 'bone_block' },
		fx: { players: {}, mobs: { glowing: 1 }, darkness: true },
	},
	{
		key: 'abyss', name: 'Звёздная бездна', from: 100, biome: 'small_end_islands', color: 'dark_purple',
		note: 'звёздный ветер: у вас «Регенерация I», у орды — «Сопротивление II»',
		rocks: ['obsidian', 'calcite', 'amethyst_block', 'deepslate', 'obsidian', 'polished_blackstone'],
		top: { low: ['calcite', 'amethyst_block', 'calcite'], mid: 'calcite', high: 'amethyst_block', peak: 'crying_obsidian' },
		glows: ['pearlescent_froglight', 'crying_obsidian', 'sea_lantern'],
		decor: { post: 'polished_blackstone_wall', postTop: 'end_rod', ruinA: 'amethyst_block', ruinB: 'polished_blackstone_bricks', plant1: 'amethyst_cluster', plant2: 'large_amethyst_bud', tree: 'amethyst_block', treeTop: 'amethyst_cluster' },
		pool: { base: 'obsidian', rim: 'obsidian', fill: 'crying_obsidian' },
		wall: { base: 'obsidian', main: 'polished_blackstone_bricks', trim: 'amethyst_block', pillar: 'crying_obsidian', light: 'pearlescent_froglight', light2: 'sea_lantern', window: 'glass' },
		roof: { glass: 'glass', beam: 'obsidian', lantern: 'soul_lantern' },
		gate: { frame: 'amethyst_block', bars: 'iron_bars', core: 'pearlescent_froglight', crown: 'crying_obsidian' },
		fx: { players: { regeneration: 1 }, mobs: { resistance: 2 } },
	},
]

// Тема арены для волны d (выше 100 — Бесконечность → «Звёздная бездна»)
NSG.nsArenaThemeFor = function (d) {
	var T = NSG.NS_ARENA_THEMES
	var pick = T[0]
	for (var i = 0; i < T.length; i++) if (d >= T[i].from) pick = T[i]
	return pick
}
NSG.nsArenaThemeByKey = function (key) {
	var T = NSG.NS_ARENA_THEMES
	for (var i = 0; i < T.length; i++) if (T[i].key === key) return T[i]
	return T[0]
}

// Полосы снаружи коридора (стены и коридор не трогаем): запад, восток, север, юг — [x1, z1, x2, z2]
function nsArenaStrips() {
	var L = NS_ARENA_LAND
	return [
		[L[0], L[1], -12, L[3]],
		[12, L[1], L[2], L[3]],
		[-11, L[1], 11, -2],
		[-11, 129, 11, L[3]],
	]
}
// Куски бокса не больше 32 768 блоков (лимит fill/fillbiome) — режем по z
function nsArenaBoxes(x1, y1, z1, x2, y2, z2) {
	var out = []
	var per = Math.max(1, Math.floor(32768 / ((x2 - x1 + 1) * (y2 - y1 + 1))))
	for (var z = z1; z <= z2; z += per) out.push([x1, y1, z, x2, y2, Math.min(z2, z + per - 1)])
	return out
}

function nsArenaDecorCmds(th) {
	th = th || NSG.NS_ARENA_THEMES[0]
	var c = []
	var R = NS_ARENA_ROOF
	var L = NS_ARENA_LAND
	var D = th.decor
	// --- биом (снег, пепел, души, чёрное небо Края) — на весь район арены, коридор тоже ---
	var bx = nsArenaBoxes(L[0], 48, L[1], L[2], 150, L[3])
	for (var b = 0; b < bx.length; b++) c.push('fillbiome ' + bx[b].join(' ') + ' minecraft:' + th.biome)
	// --- снести украшения прошлой темы (тег nightshift:arena_decor) — только снаружи коридора ---
	var strips = nsArenaStrips()
	for (var si0 = 0; si0 < strips.length; si0++) {
		var S0 = strips[si0]
		var parts = nsArenaBoxes(S0[0], 60, S0[1], S0[2], 145, S0[3])
		for (var p0 = 0; p0 < parts.length; p0++) c.push('fill ' + parts[p0].join(' ') + ' minecraft:air replace #nightshift:arena_decor')
	}
	// --- рельеф: колонны, верх, украшения ---
	for (var x = L[0]; x <= L[2]; x++) {
		for (var z = L[1]; z <= L[3]; z++) {
			if (x >= -11 && x <= 11 && z >= -1 && z <= 128) continue
			var h = nsArenaLandHeight(x, z)
			var r = nsArenaHash(x * 3 + 7, z * 5 + 1)
			var rock = th.rocks[Math.floor(nsArenaNoise(x + 500, z, 7) * 2.99 + 3) % th.rocks.length]
			c.push('fill ' + x + ' 52 ' + z + ' ' + x + ' ' + (h - 1) + ' ' + z + ' ' + nsAt(rock))
			var top
			if (h <= 66) top = r < 0.12 ? th.top.low[0] : r < 0.2 ? th.top.low[1] : th.top.low[2]
			else if (h >= 120) top = th.top.peak
			else if (h >= 100) top = r < 0.5 ? th.top.high : rock
			else top = r < 0.04 ? th.glows[Math.floor(r * 100) % th.glows.length] : r < 0.5 ? th.top.mid : rock
			c.push('setblock ' + x + ' ' + h + ' ' + z + ' ' + nsAt(top))
			if (h <= 66) {
				if (r > 0.985) {
					c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 2) + ' ' + z + ' ' + nsAt(D.post))
					c.push('setblock ' + x + ' ' + (h + 3) + ' ' + z + ' ' + nsAt(D.postTop))
				} else if (r > 0.975) c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 1 + (Math.floor(r * 1000) % 5)) + ' ' + z + ' ' + nsAt(D.ruinA))
				else if (r > 0.96) c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + (h + 2 + (Math.floor(r * 1000) % 3)) + ' ' + z + ' ' + nsAt(D.ruinB))
				else if (r > 0.8 && top === th.top.low[2]) c.push('setblock ' + x + ' ' + (h + 1) + ' ' + z + ' ' + nsAt(r > 0.9 ? D.plant2 : D.plant1))
			} else if (h < 112 && top === th.top.mid && r > 0.992) {
				var th2 = h + 3 + (Math.floor(r * 1000) % 3)
				c.push('fill ' + x + ' ' + (h + 1) + ' ' + z + ' ' + x + ' ' + th2 + ' ' + z + ' ' + nsAt(D.tree))
				if (D.treeTop) c.push('setblock ' + x + ' ' + (th2 + 1) + ' ' + z + ' ' + nsAt(D.treeTop))
			}
		}
	}
	// полосы породы (каньон: терракота слоями) — замена основной породы по высоте
	if (th.bands) {
		for (var by = 52, bi = 0; by <= 136; by += 3, bi++) {
			for (var si1 = 0; si1 < strips.length; si1++) {
				var S1 = strips[si1]
				c.push('fill ' + S1[0] + ' ' + by + ' ' + S1[1] + ' ' + S1[2] + ' ' + (by + 2) + ' ' + S1[3] + ' ' + nsAt(th.bands[bi % th.bands.length]) + ' replace ' + nsAt(th.rocks[0]))
			}
		}
	}
	// озёра в долине: ровная площадка 5×5, кромка, середина 3×3
	var pools = [[-16, 18], [16, 46], [-17, 78], [17, 104], [0, 142], [0, -14]]
	for (var i = 0; i < pools.length; i++) {
		var px = pools[i][0],
			pz = pools[i][1]
		c.push('fill ' + (px - 2) + ' 52 ' + (pz - 2) + ' ' + (px + 2) + ' 63 ' + (pz + 2) + ' ' + nsAt(th.pool.base))
		c.push('fill ' + (px - 2) + ' 64 ' + (pz - 2) + ' ' + (px + 2) + ' 67 ' + (pz + 2) + ' minecraft:air')
		c.push('fill ' + (px - 2) + ' 63 ' + (pz - 2) + ' ' + (px + 2) + ' 63 ' + (pz + 2) + ' ' + nsAt(th.pool.rim))
		c.push('fill ' + (px - 1) + ' 63 ' + (pz - 1) + ' ' + (px + 1) + ' 63 ' + (pz + 1) + ' ' + nsAt(th.pool.fill))
		if (th.pool.top) c.push('fill ' + (px - 1) + ' 64 ' + (pz - 1) + ' ' + (px + 1) + ' 64 ' + (pz + 1) + ' ' + nsAt(th.pool.top))
	}
	// --- стены коридора (x = ±11) до крыши: цоколь, кладка, пояс, колонны с огнями, окна в долину ---
	var W = th.wall
	var sides = [-11, 11]
	for (var sj = 0; sj < 2; sj++) {
		var X = sides[sj]
		c.push('fill ' + X + ' 63 -1 ' + X + ' 66 128 ' + nsAt(W.base))
		c.push('fill ' + X + ' 67 -1 ' + X + ' ' + (R - 1) + ' 128 ' + nsAt(W.main))
		c.push('fill ' + X + ' 80 -1 ' + X + ' 80 128 ' + nsAt(W.trim))
		for (var pp = 0; pp <= 128; pp += 8) {
			c.push('fill ' + X + ' 64 ' + pp + ' ' + X + ' ' + (R - 1) + ' ' + pp + ' ' + nsAt(W.pillar))
			c.push('setblock ' + X + ' 70 ' + pp + ' ' + nsAt(W.light))
			c.push('setblock ' + X + ' 86 ' + pp + ' ' + nsAt(W.light))
			if (pp + 6 <= 127) {
				c.push('fill ' + X + ' 73 ' + (pp + 2) + ' ' + X + ' 78 ' + (pp + 6) + ' ' + nsAt(W.window))
				c.push('setblock ' + X + ' 69 ' + (pp + 4) + ' ' + nsAt(W.light2))
			}
		}
	}
	// --- торцы: у входа — стена со щелями-окнами, в дальнем конце — ворота орды ---
	var G = th.gate
	c.push('fill -10 63 -1 10 66 -1 ' + nsAt(W.base))
	c.push('fill -10 67 -1 10 ' + (R - 1) + ' -1 ' + nsAt(W.main))
	c.push('fill -10 80 -1 10 80 -1 ' + nsAt(W.trim))
	for (var w = -8; w <= 8; w += 8) c.push('fill ' + w + ' 70 -1 ' + w + ' 84 -1 ' + nsAt(W.window))
	c.push('fill -10 63 128 10 66 128 ' + nsAt(W.base))
	c.push('fill -10 67 128 10 ' + (R - 1) + ' 128 ' + nsAt(W.main))
	c.push('fill -6 64 128 6 78 128 ' + nsAt(G.frame))
	c.push('fill -5 65 128 5 77 128 ' + nsAt(G.bars))
	c.push('fill -6 63 129 6 79 131 ' + nsAt(G.core)) // за решёткой — нутро ворот
	c.push('fill -1 79 128 1 81 128 ' + nsAt(G.crown))
	// --- крыша: стекло на балках, висячие фонари ---
	var F = th.roof
	c.push('fill -11 ' + R + ' -1 11 ' + R + ' 128 ' + nsAt(F.glass))
	for (var bz = 0; bz <= 128; bz += 8) {
		c.push('fill -11 ' + R + ' ' + bz + ' 11 ' + R + ' ' + bz + ' ' + nsAt(F.beam))
		var lx = [-6, 0, 6]
		for (var li = 0; li < lx.length; li++) {
			c.push('setblock ' + lx[li] + ' ' + (R - 1) + ' ' + bz + ' minecraft:chain[axis=y]')
			c.push('setblock ' + lx[li] + ' ' + (R - 2) + ' ' + bz + ' ' + nsAt(F.lantern) + '[hanging=true]')
		}
	}
	c.push('fill 0 ' + R + ' -1 0 ' + R + ' 128 ' + nsAt(F.beam))
	// снег, нападавший на крышу и стены в метель, — долой (в других темах ему не место)
	c.push('fill -11 ' + (R + 1) + ' -1 11 ' + (R + 1) + ' 128 minecraft:air replace minecraft:snow')
	return c
}

// Очередь: строки — команды в измерении арены, {wait: N} — пауза в тиках, {fn} — шаг кодом
NSG.nsArenaJobs = NSG.nsArenaJobs || []
function nsArenaStartDecor(st, theme) {
	var L = NS_ARENA_LAND
	var th = theme || NSG.nsArenaThemeByKey((st.arena && st.arena.theme) || 'shaft')
	var jobs = []
	jobs.push({ fn: function () {
		nsArenaRun('forceload add ' + L[0] + ' ' + L[1] + ' ' + L[2] + ' ' + L[3])
	} })
	jobs.push({ wait: 60 }) // чанки ландшафта догружаются
	jobs = jobs.concat(nsArenaDecorCmds(th))
	jobs.push({ fn: function () {
		var s2 = nsGetState()
		// контроль: крыша над серединой коридора и стена на месте
		var lvl = NSG.nsServer.getLevel(NS_ARENA_DIM)
		var ok = String(lvl.getBlock(3, NS_ARENA_ROOF, 60).getBlockState().getBlock().id) === nsAt(th.roof.glass) && String(lvl.getBlock(11, 75, 60).getBlockState().getBlock().id) !== 'minecraft:air'
		nsArenaRun('forceload remove ' + L[0] + ' ' + L[1] + ' ' + L[2] + ' ' + L[3])
		nsArenaForceload()
		if (!ok) {
			console.warn('[nightshift] арена: тема «' + th.name + '» — проверка не прошла (чанки не загрузились?) — повторю при следующей загрузке')
			return
		}
		if (s2.arena) {
			s2.arena.v = NS_ARENA_VERSION
			s2.arena.theme = th.key
			nsSaveState(s2)
		}
		// снимок — сразу (и в отсчёте: иначе остановленный набег откатил бы стены к прошлой теме); только когда орда
		// уже вышла, его не трогаем — откат вернёт арену к снимку выхода орды
		var active = s2.raid && s2.raid.state === 'active' && s2.raid.altarId === (s2.arena && s2.arena.altarId)
		console.info('[nightshift] арена: тема «' + th.name + '» готова')
		if (!active) nsArenaSnapRetry(3)
	} })
	NSG.nsArenaJobs = NSG.nsArenaJobs.concat(jobs)
	console.info('[nightshift] арена: тема «' + th.name + '», в очереди ' + jobs.length + ' шагов')
}

// Снимок арены с повтором: сразу после стройки чанки запасной копии иногда не готовы (01.10: 3 куска из 4 не легли)
function nsArenaSnapRetry(tries) {
	nsArenaForceload()
	if (nsArenaClone(true)) {
		console.info('[nightshift] арена: снимок обновлён')
		return
	}
	if (tries <= 0) {
		console.warn('[nightshift] арена: снимок не удался — снимет выход орды')
		return
	}
	NSG.nsArenaJobs.push({ wait: 40 })
	NSG.nsArenaJobs.push({ fn: function () {
		nsArenaSnapRetry(tries - 1)
	} })
}

// Выполнить очередь сразу (выход орды не ждёт: снимок должен быть с готовой арены)
function nsArenaFlushJobs() {
	var jobs = NSG.nsArenaJobs
	var n = 0
	while (jobs && jobs.length) {
		var j = jobs.shift()
		if (typeof j === 'string') nsArenaRun(j)
		else if (j.fn) {
			try {
				j.fn()
			} catch (e) {
				console.error('[nightshift] арена: шаг очереди: ' + e)
			}
		}
		n++
	}
	if (n > 0) console.warn('[nightshift] арена: достроил очередь разом (' + n + ' шагов) — отсчёт кончился раньше')
}

// Старт набега (из nsStartRaid): набег на арене — тема по волне; другая — перестройка за отсчёт и титр
function nsArenaOnRaidStart(altarId, d) {
	var st = nsGetState()
	if (!st.arena || !st.arena.built || st.arena.altarId !== altarId) return
	var th = NSG.nsArenaThemeFor(d)
	var msg = '{"text":"","extra":[{"text":"[Арена · ' + th.name + '] ","color":"' + th.color + '","bold":true},{"text":"' + th.note + '","color":"gray"}]}'
	if ((st.arena.theme || 'shaft') !== th.key) {
		nsArenaRun('title @a[distance=0..] subtitle {"text":"' + th.name + '","color":"' + th.color + '"}')
		nsArenaRun('title @a[distance=0..] title {"text":"Арена меняется","color":"white"}')
		nsArenaRun('playsound minecraft:block.beacon.power_select ambient @a[distance=0..] 0 70 60 2 0.6')
		nsArenaStartDecor(st, th)
	}
	nsArenaRun('tellraw @a[distance=0..] ' + msg)
}

// «Приколы» темы на время набега на арене: игрокам — эффекты раз в 10 с (на 15 с), «Кошмар» — тьма каждые 30 с;
// мобам — через NSG.nsArenaMobFx в nsBoostRaidMobs (40_nightshift_raid.js)
var nsArenaFxTick = 0
function nsArenaFxTickRun() {
	var st = nsGetState()
	if (!st || !st.arena || !st.raid || st.raid.state !== 'active' || st.raid.altarId !== st.arena.altarId) return
	var th = NSG.nsArenaThemeFor(st.raid.difficulty || 1)
	if (!th.fx) return
	nsArenaFxTick++
	if (nsArenaFxTick % 10 === 1) {
		for (var e in th.fx.players || {}) nsArenaRun('effect give @a[distance=0..] minecraft:' + e + ' 15 ' + (th.fx.players[e] - 1) + ' true')
	}
	if (th.fx.darkness && nsArenaFxTick % 30 === 0) nsArenaRun('effect give @a[distance=0..,gamemode=!creative] minecraft:darkness 5 0 true')
	// метель Мерзлоты — частицами (грозы в набегах больше нет, а без неё снег не идёт)
	if (th.key === 'frost') nsArenaRun('execute as @a[distance=0..] at @s run particle minecraft:snowflake ~ ~6 ~ 10 4 10 0.02 120 normal')
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
		if (event.server.getTickCount() % 20 === 0) nsArenaFxTickRun()
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
		nsArenaFlushJobs()
		var th = NSG.nsArenaThemeFor((st.raid && st.raid.difficulty) || 1)
		NSG.nsArenaMobFx = th.fx ? { effects: th.fx.mobs || {}, burning: !!th.fx.burning } : null
		NSG.nsArenaSnapOk = nsArenaClone(true)
		if (NSG.nsArenaSnapOk) console.info('[nightshift] арена: снимок перед набегом')
		else {
			console.warn('[nightshift] арена: снимок НЕ удался (чанк не загружен?) — откат после набега отключён')
			nsArenaRun('tellraw @a {"text":"[Ночная смена] Снимок арены не удался — после этого набега она не восстановится.","color":"red"}')
		}
	} else {
		NSG.nsArenaMobFx = null
		// снять эффекты темы с игроков арены
		var fxOff = ['haste', 'speed', 'fire_resistance', 'jump_boost', 'slow_falling', 'regeneration', 'darkness']
		for (var fo = 0; fo < fxOff.length; fo++) nsArenaRun('effect clear @a[distance=0..] minecraft:' + fxOff[fo])
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
				var thNow = NSG.nsArenaThemeByKey((st.arena && st.arena.theme) || 'shaft')
				player.tell(Text.gold('[Ночная смена] Арена «' + thNow.name + '»: алтарь впереди, орда выйдет из ворот в дальнем конце. ').append(Text.gray('Тема меняется по номеру волны набега. Всё, что сломается, восстановится, провал здесь стоит одно сердце проклятия. Назад — /arena ещё раз (или «На базу» в меню алтаря)')))
				// выживание (48_night_call.js) — с 5-й пройденной волны
				if ((st.phase || 0) >= 5) {
					var rec = st.arenaRecord
					player.tell(Text.gray('Выживание: подволны по кругу, каждый круг злее, без проклятия — ').append(Text.gold('[/arena endless]').clickRunCommand('/arena endless')).append(Text.gray(rec ? '. Рекорд: ' + nsPlural(rec.subs, 'подволна', 'подволны', 'подволн') + ' (' + rec.names.join(', ') + ')' : '. Рекорда ещё нет')))
				}
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
