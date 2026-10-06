// ==========================================================================
// Разрастить известные месторождения (06.10.2026, Георгий: «у меня 11 меток на каждую залежь — открытые сделал бы
// больше, чтобы 1 форпост закрывал ресурс до конца игры»).
//  /nsdeposit grow_known [радиус]       — все месторождения атласа (кроме энергетических), по одному в 2 с
//  /nsdeposit grow <x> <y> <z> <радиус> — одно: тип берётся из ближайшего блока месторождения
//  /nsdeposit status                    — очередь
// Месторождение ложится на природный грунт поверхности (2 слоя; на мелководье — на дно) в круге с неровным краем; постройки, лава, брёвна
// не трогаются, обрывы дальше 14 блоков по высоте от центра — тоже. Подземные (сера в пещерах, грибница) растут по полу
// пещеры вокруг центра. На Каучуковой плантации сажаются гевеи. Чанки грузятся и (если надо) генерируются на время.
// ==========================================================================

var NS_DG = { queue: [], busy: false }
var NS_DG_HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
var NS_DG_DEEP = { 'nightshift:sulfur_spring': true, 'nightshift:mycelium_vein': true }
var NS_DG_SKIP = { 'axiomativ:geothermal_source': true, 'axiomativ:river_rapids': true }
var NS_DG_IDS = [
	'nightshift:hevea_soil', 'nightshift:salt_deposit', 'nightshift:magnetic_anomaly', 'nightshift:sulfur_spring', 'nightshift:quartz_vein',
	'nightshift:bauxite_deposit', 'nightshift:helium_ice', 'nightshift:permafrost', 'nightshift:peat_bog', 'nightshift:mycelium_vein', 'nightshift:star_stone',
]

function nsDgGround(blk) {
	var id = String(blk.getId())
	if (/water|lava|_log$|_wood$|stripped|planks|leaves/.test(id)) return false
	if (NS_DG_IDS.indexOf(id) >= 0) return false
	try {
		if (blk.getEntity && blk.getEntity()) return false
	} catch (e) {}
	return nsSkyNatural(blk)
}

// неровный край: радиус по углу (две синусоиды от координат центра — повтор даёт ту же форму)
function nsDgEdge(r, ang, cx, cz) {
	var s = ((cx * 31 + cz * 17) % 97) / 97
	return r * (0.82 + 0.1 * Math.sin(ang * 3 + s * 6.28) + 0.08 * Math.sin(ang * 7 + s * 3.1))
}

function nsDgGrow(level, id, cx, cy, cz, r) {
	var block = Block.getBlock(id).defaultBlockState()
	// чанки — загрузить (сгенерировать, если их ещё нет)
	for (var ccx = (cx - r - 2) >> 4; ccx <= (cx + r + 2) >> 4; ccx++) for (var ccz = (cz - r - 2) >> 4; ccz <= (cz + r + 2) >> 4; ccz++) level.getChunk(ccx, ccz)
	var BP = Java.loadClass('net.minecraft.core.BlockPos')
	var placed = 0
	var spots = []
	for (var dx = -r; dx <= r; dx++) {
		for (var dz = -r; dz <= r; dz++) {
			var d = Math.sqrt(dx * dx + dz * dz)
			if (d > nsDgEdge(r, Math.atan2(dz, dx), cx, cz)) continue
			var x = cx + dx,
				z = cz + dz
			if (NS_DG_DEEP[id]) {
				// пол пещеры: природный камень с воздухом над ним, ±8 от центра
				for (var y = cy + 8; y >= cy - 8; y--) {
					var b = level.getBlock(x, y, z)
					var above = String(level.getBlock(x, y + 1, z).getId())
					if ((above === 'minecraft:air' || above === 'minecraft:cave_air') && nsDgGround(b)) {
						level.setBlockAndUpdate(new BP(x, y, z), block)
						placed++
						break
					}
				}
				continue
			}
			var top = Number(level.getHeight(NS_DG_HM.MOTION_BLOCKING_NO_LEAVES, x, z)) - 1
			// мелководье (пляж, болото): дно под водой до 4 блоков — тоже месторождение (соли нужна вода рядом)
			for (var w = 0; w < 4 && String(level.getBlock(x, top, z).getId()) === 'minecraft:water'; w++) top--
			if (Math.abs(top - cy) > 14) continue
			var t = level.getBlock(x, top, z)
			if (String(t.getId()) === id) {
				// уже месторождение (было или выросло раньше): гевее — место под дерево
				if (dx % 5 === 0 && dz % 5 === 0) spots.push([x, top + 1, z])
				continue
			}
			if (!nsDgGround(t)) continue
			level.setBlockAndUpdate(new BP(x, top, z), block)
			placed++
			if (nsDgGround(level.getBlock(x, top - 1, z))) level.setBlockAndUpdate(new BP(x, top - 1, z), block)
			if (dx % 5 === 0 && dz % 5 === 0) spots.push([x, top + 1, z])
		}
	}
	// гевеи на новой почве: ствол 5–6 из бревна гевеи, крона из листвы джунглей (стандартное дерево почву не признаёт)
	if (id === 'nightshift:hevea_soil') {
		var log = Block.getBlock('nightshift:hevea_log').defaultBlockState()
		for (var i = 0; i < spots.length; i++) {
			if (Math.random() > 0.55) continue
			var s = spots[i]
			var h = 5 + Math.floor(Math.random() * 2)
			var free = true
			for (var k = 0; k < h + 2 && free; k++) if (!level.getBlock(s[0], s[1] + k, s[2]).getBlockState().canBeReplaced()) free = false
			if (!free) continue
			for (var k2 = 0; k2 < h; k2++) level.setBlockAndUpdate(new BP(s[0], s[1] + k2, s[2]), log)
			for (var lx = -2; lx <= 2; lx++)
				for (var ly = h - 2; ly <= h + 1; ly++)
					for (var lz = -2; lz <= 2; lz++) {
						var rr = Math.abs(lx) + Math.abs(lz) + Math.max(0, ly - h)
						if (rr > 3 || (lx === 0 && lz === 0 && ly < h)) continue
						var lb = level.getBlock(s[0] + lx, s[1] + ly, s[2] + lz)
						if (lb.getBlockState().canBeReplaced()) lb.set('minecraft:jungle_leaves', { persistent: 'true' })
					}
		}
	}
	return placed
}

function nsDgFindKind(level, x, y, z) {
	for (var r = 0; r <= 8; r++)
		for (var dx = -r; dx <= r; dx++)
			for (var dy = -r; dy <= r; dy++)
				for (var dz = -r; dz <= r; dz++) {
					var id = String(level.getBlock(x + dx, y + dy, z + dz).getId())
					if (NS_DG_IDS.indexOf(id) >= 0) return id
				}
	return null
}

ServerEvents.tick(event => {
	if (!NS_DG.queue.length || event.server.getTickCount() % 40 !== 0) return
	var job = NS_DG.queue.shift()
	try {
		var level = event.server.getOverworld()
		for (var ccx = (job.x - 8) >> 4; ccx <= (job.x + 8) >> 4; ccx++) for (var ccz = (job.z - 8) >> 4; ccz <= (job.z + 8) >> 4; ccz++) level.getChunk(ccx, ccz)
		var had = nsDgFindKind(level, job.x, job.y, job.z)
		var n = nsDgGrow(level, job.id, job.x, job.y, job.z, job.r)
		console.info('[deposits] ' + job.id + ' у ' + job.x + ' ' + job.y + ' ' + job.z + ': ' + (had ? 'было ' + had : 'НЕ БЫЛО месторождения') +
			', уложено ' + n + ' блоков (r=' + job.r + '), осталось ' + NS_DG.queue.length)
	} catch (e) {
		console.error('[deposits] ' + job.id + ' у ' + job.x + ' ' + job.z + ': ' + e)
	}
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var I = event.arguments.INTEGER
	event.register(
		C.literal('nsdeposit')
			.requires(s => s.hasPermission(2))
			.then(C.literal('status').executes(ctx => {
				ctx.source.sendSystemMessage(Text.of('[deposits] в очереди: ' + NS_DG.queue.length))
				return 1
			}))
			.then(
				C.literal('grow_known')
					.executes(ctx => nsDgQueueKnown(ctx, 20))
					.then(C.argument('r', I.create(event)).executes(ctx => nsDgQueueKnown(ctx, Number(I.getResult(ctx, 'r')))))
			)
			.then(
				C.literal('grow').then(C.argument('x', I.create(event)).then(C.argument('y', I.create(event)).then(C.argument('z', I.create(event)).then(
					C.argument('r', I.create(event)).executes(ctx => {
						var level = ctx.source.server.getOverworld()
						var x = Number(I.getResult(ctx, 'x')), y = Number(I.getResult(ctx, 'y')), z = Number(I.getResult(ctx, 'z'))
						for (var ccx = (x - 8) >> 4; ccx <= (x + 8) >> 4; ccx++) for (var ccz = (z - 8) >> 4; ccz <= (z + 8) >> 4; ccz++) level.getChunk(ccx, ccz)
						var id = nsDgFindKind(level, x, y, z)
						if (!id) {
							ctx.source.sendSystemMessage(Text.red('[deposits] рядом нет месторождения'))
							return 0
						}
						NS_DG.queue.push({ id: id, x: x, y: y, z: z, r: Number(I.getResult(ctx, 'r')) })
						ctx.source.sendSystemMessage(Text.of('[deposits] в очереди: ' + id))
						return 1
					})
				))))
			)
	)
})

function nsDgQueueKnown(ctx, r) {
	var st = nsAtlasState()
	var n = 0
	for (var i = 0; i < st.deps.length; i++) {
		var d = st.deps[i]
		if (NS_DG_SKIP[d.k]) continue
		NS_DG.queue.push({ id: d.k, x: Math.round(d.x), y: Math.round(d.y), z: Math.round(d.z), r: NS_DG_DEEP[d.k] ? Math.min(r, 14) : r })
		n++
	}
	ctx.source.sendSystemMessage(Text.of('[deposits] в очереди ' + n + ' месторождений, по одному в 2 с'))
	return 1
}
