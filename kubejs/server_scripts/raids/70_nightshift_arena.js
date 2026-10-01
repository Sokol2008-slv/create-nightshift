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
// ==========================================================================
var NS_ARENA_DIM = 'nightshift:arena'
var NS_ARENA_BACKUP_DX = 4000 // резервная копия — та же арена, сдвинутая по x
// блок арены [x1, y1, z1, x2, y2, z2], кусками — у /clone предел 32 768 блоков за раз
var NS_ARENA_BOX = [-12, 63, -2, 12, 80, 130]
var NS_ARENA_Z_SLICES = [[-2, 42], [43, 87], [88, 130]]
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
			if (!src.equals(dst)) ok = false
		} catch (e) {
			ok = false
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
