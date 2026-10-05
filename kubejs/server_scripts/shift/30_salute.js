// ==========================================================================
// Салют победы (3.4.0, 06.10.2026): волна отбита впервые (state.phase вырос) — над алтарём набега 10 секунд
// фейерверков в цветах смены; на юбилейных волнах (каждая 10-я) — вдвое больше залпов и титр всем.
// Набеги не правим: смотрим на их состояние раз в секунду (как журнал смены, shift/10_journal.js).
// ==========================================================================

var NS_SALUTE_COLORS = [16737843, 16766720, 3800852, 6737151, 15435844, 16777215] // красный, золото, зелёный, голубой, розовый, белый
var NS_SALUTE_SHAPES = ['large_ball', 'star', 'burst', 'small_ball']
NSG.nsSalute = null // { x, y, z, left, big }
NSG.nsSalutePrev = null

function nsSaluteRocket(x, y, z, big) {
	var r = function (a) {
		return a[Math.floor(Math.random() * a.length)]
	}
	var cols = [r(NS_SALUTE_COLORS), r(NS_SALUTE_COLORS)]
	var nbt =
		'{LifeTime:' + (22 + Math.floor(Math.random() * 14)) + ',FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"' +
		(big && Math.random() < 0.3 ? 'creeper' : r(NS_SALUTE_SHAPES)) + '",colors:[I;' + cols.join(',') + '],fade_colors:[I;16777215],has_trail:true,has_twinkle:' + (Math.random() < 0.5) + '}]}}}}'
	var ax = x + (Math.random() - 0.5) * 18,
		az = z + (Math.random() - 0.5) * 18
	NSG.nsServer.runCommandSilent('execute in ' + NSG.nsSalute.dim + ' run summon minecraft:firework_rocket ' + ax.toFixed(1) + ' ' + (y + 1) + ' ' + az.toFixed(1) + ' ' + nbt)
}

ServerEvents.tick(event => {
	if (!NSG.nsServer) return
	try {
		var sal = NSG.nsSalute
		if (sal && sal.left > 0) {
			// залп каждые 4 тика (на юбилее — каждые 2)
			if (event.server.getTickCount() % (sal.big ? 2 : 4) === 0) {
				nsSaluteRocket(sal.x, sal.y, sal.z, sal.big)
				sal.left--
			}
		}
		if (event.server.getTickCount() % 20 !== 0) return
		var rs = nsGetStateRO()
		var cur = { phase: rs.phase || 0, altar: rs.raid.altarId, state: rs.raid.state }
		var prev = NSG.nsSalutePrev
		NSG.nsSalutePrev = cur
		if (!prev || cur.phase <= prev.phase) return
		// где праздновать: алтарь последнего набега, иначе первый алтарь Верхнего мира
		var altarId = prev.altar || cur.altar
		var a = null
		for (var i = 0; i < rs.altars.length; i++) if (rs.altars[i].id === altarId) a = rs.altars[i]
		if (!a) for (var j = 0; j < rs.altars.length && !a; j++) if (rs.altars[j].dim === 'minecraft:overworld') a = rs.altars[j]
		if (!a) return
		var big = cur.phase % 10 === 0
		NSG.nsSalute = { x: a.x + 0.5, y: a.y, z: a.z + 0.5, dim: a.dim, left: big ? 50 : 25, big: big }
		if (big) {
			NSG.nsServer.runCommandSilent('title @a times 10 80 20')
			NSG.nsServer.runCommandSilent('title @a subtitle ' + JSON.stringify({ text: 'Смена держит рубеж — салют!', color: 'gray' }))
			NSG.nsServer.runCommandSilent('title @a title ' + JSON.stringify({ text: 'Волна ' + cur.phase + ' взята', color: 'gold' }))
		}
	} catch (e) {
		console.error('[salute] ' + e)
	}
})

ServerEvents.loaded(event => {
	NSG.nsSalute = null
	NSG.nsSalutePrev = null
})

ServerEvents.commandRegistry(event => {
	event.register(
		event.commands
			.literal('nssalute')
			.requires(s => s.hasPermission(2))
			.executes(ctx => {
				var rs = nsGetStateRO()
				var a = null
				for (var i = 0; i < rs.altars.length && !a; i++) if (rs.altars[i].dim === 'minecraft:overworld') a = rs.altars[i]
				if (!a) return 0
				NSG.nsSalute = { x: a.x + 0.5, y: a.y, z: a.z + 0.5, dim: a.dim, left: 25, big: false }
				return 1
			})
	)
})
