// ==========================================================================
// Ночная смена — АРЕНА (прототип, 30.09.2026; идея Георгия): отдельное измерение, где орда идёт по длинному
// коридору на алтарь. Базу не жалко: перед набегом арена запоминается, после — восстанавливается как была
// (ядерный заряд, боссы, взрывы — всё откатится). Строй тут турели, щит, ставь големов — постройки
// сохраняются между набегами (снимок делается в начале каждого набега).
//  /arena        — войти (запоминается, откуда пришёл); /arena leave — вернуться.
//  /arena reset  — (оператор) восстановить арену из снимка вручную.
// Коридор: x −10…10, пол y=64, z 0…127; алтарь у входа (0, 66, 6); орда выходит в дальнем конце (z≈120).
// Ток с базы — передатчиком энергии Create: Ender Transmission (передаёт между измерениями).
// Големы и драконы — мобы, их снимок не сохраняет (решение Георгия: «их восстанавливать нам самим»).
// ==========================================================================
var NS_ARENA_DIM = 'nightshift:arena'
var NS_ARENA_BACKUP_DX = 4000 // резервная копия — та же арена, сдвинутая по x
// блок арены [x1, y1, z1, x2, y2, z2], кусками — у /clone предел 32 768 блоков за раз
var NS_ARENA_BOX = [-12, 63, -2, 12, 80, 130]
var NS_ARENA_Z_SLICES = [[-2, 42], [43, 87], [88, 130]]

function nsArenaRun(cmd) {
	NSG.nsServer.runCommandSilent('execute in ' + NS_ARENA_DIM + ' run ' + cmd)
}

function nsArenaForceload() {
	var B = NS_ARENA_BOX
	nsArenaRun('forceload add ' + B[0] + ' ' + B[2] + ' ' + B[3] + ' ' + B[5])
	nsArenaRun('forceload add ' + (B[0] + NS_ARENA_BACKUP_DX) + ' ' + B[2] + ' ' + (B[3] + NS_ARENA_BACKUP_DX) + ' ' + B[5])
}

// копирование арены: toBackup = true — в резервную зону, false — обратно
function nsArenaClone(toBackup) {
	var B = NS_ARENA_BOX
	var dx = NS_ARENA_BACKUP_DX
	for (var i = 0; i < NS_ARENA_Z_SLICES.length; i++) {
		var z1 = NS_ARENA_Z_SLICES[i][0],
			z2 = NS_ARENA_Z_SLICES[i][1]
		var from = toBackup ? B[0] : B[0] + dx
		var to = toBackup ? B[0] + dx : B[0]
		nsArenaRun('clone ' + from + ' ' + B[1] + ' ' + z1 + ' ' + (from + (B[3] - B[0])) + ' ' + B[4] + ' ' + z2 + ' ' + to + ' ' + B[1] + ' ' + z1 + ' replace')
	}
}

function nsArenaBuild(st) {
	nsArenaForceload()
	// пол, стены, подсветка; верх открыт — летающим боссам есть где летать
	nsArenaRun('fill -12 63 -2 12 80 130 minecraft:air')
	nsArenaRun('fill -10 64 0 10 64 127 minecraft:polished_blackstone_bricks')
	nsArenaRun('fill -11 64 -1 -11 74 128 minecraft:deepslate_tiles')
	nsArenaRun('fill 11 64 -1 11 74 128 minecraft:deepslate_tiles')
	nsArenaRun('fill -10 64 -1 10 74 -1 minecraft:deepslate_tiles')
	for (var z = 4; z < 128; z += 8) {
		nsArenaRun('setblock -11 68 ' + z + ' minecraft:sea_lantern')
		nsArenaRun('setblock 11 68 ' + z + ' minecraft:sea_lantern')
		nsArenaRun('setblock 0 64 ' + z + ' minecraft:shroomlight')
	}
	// дальний конец — «ворота» орды
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
	st.arena = { built: true, altarId: altar.id }
	nsSaveState(st)
	nsArenaClone(true)
	console.info('[nightshift] арена построена, алтарь ' + altar.id)
}

// Хук набега (из 40_nightshift_raid.js): 'start' — снимок, 'end' — восстановление. Только для алтаря арены.
function nsArenaHook(kind, altarId) {
	var st = nsGetState()
	if (!st.arena || !st.arena.built || st.arena.altarId !== altarId) return
	nsArenaForceload()
	if (kind === 'start') {
		nsArenaClone(true)
		console.info('[nightshift] арена: снимок перед набегом')
	} else {
		NSG.nsServer.runCommandSilent('execute in ' + NS_ARENA_DIM + ' run kill @e[type=item,x=-12,y=0,z=-2,dx=24,dy=255,dz=132]')
		nsArenaClone(false)
		nsArenaRun('tellraw @a {"text":"[Ночная смена] Арена восстановлена — как была перед набегом.","color":"gray"}')
		console.info('[nightshift] арена: восстановлена из снимка')
	}
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	event.register(
		C.literal('arena')
			.executes(ctx => {
				var player = ctx.source.getPlayer()
				if (!player) return 0
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
				player.tell(Text.gold('[Ночная смена] Арена: алтарь впереди, орда выйдет из дальнего конца коридора. ').append(Text.gray('Всё, что сломается в набеге, восстановится. Назад — /arena leave')))
				return 1
			})
			.then(
				C.literal('leave').executes(ctx => {
					var player = ctx.source.getPlayer()
					if (!player) return 0
					var st = nsGetState()
					var name = String(player.getUsername())
					var back = (st.arenaReturns || {})[name]
					if (!back) {
						NSG.nsServer.runCommandSilent('execute in minecraft:overworld positioned 0 0 0 positioned over motion_blocking_no_leaves run tp ' + name + ' ~ ~ ~')
					} else {
						nsReturnPlayer(name, back)
						delete st.arenaReturns[name]
						nsSaveState(st)
					}
					return 1
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
