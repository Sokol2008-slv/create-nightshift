// ==========================================================================
// «Атлас месторождений» (3.4.0, 05.10.2026; аудит 05.10: «атлас форпостов для всех», Георгий: «есть координаты
// форпостов? сделать все метки»).
//  - Предмет nightshift:deposit_atlas: ПКМ — по одному ближайшему месторождению каждого вида: координаты,
//    расстояние и сторона света, «✔ форпост», если там уже стоит экструдер сети. Клик по строке — метка Xaero.
//    Команда /atlas — то же без предмета.
//  - Атлас пополняется сам: встал на месторождение, которого в атласе нет ближе 64 блоков, — запись и
//    сообщение всем. Экструдеры сети форпостов (state.outposts) тоже попадают в атлас.
//  - Предзаполнен геологоразведкой: месторождения, найденные по сиду основного мира 05.10 (вне старых чанков).
//  - Первый вход после 3.4.0 — атлас каждому в инвентарь (тег ns_atlas_given). Рецепт: деплоер, компас на книгу.
// Состояние — server.persistentData «ns_atlas_json».
// ==========================================================================

var NS_ATLAS_KEY = 'ns_atlas_json'
var NS_ATLAS_TYPES = [
	['nightshift:salt_deposit', 'Солеварня'],
	['nightshift:hevea_soil', 'Каучуковая плантация'],
	['nightshift:sulfur_spring', 'Серный источник'],
	['nightshift:magnetic_anomaly', 'Магнитная аномалия'],
	['nightshift:quartz_vein', 'Кварцевый карьер'],
	['nightshift:bauxite_deposit', 'Бокситовый карьер'],
	['nightshift:mycelium_vein', 'Грибные пещеры'],
	['nightshift:peat_bog', 'Торфяник'],
	['nightshift:permafrost', 'Ледник'],
	['nightshift:helium_ice', 'Высотный конденсатор'],
	['nightshift:star_stone', 'Обсерватория'],
	['axiomativ:geothermal_source', 'Геотермальный источник'],
	['axiomativ:river_rapids', 'Речной порог'],
]
var NS_ATLAS_NAME = {}
NS_ATLAS_TYPES.forEach(function (t) {
	NS_ATLAS_NAME[t[0]] = t[1]
})
// найдено по сиду основного мира (тестовая копия мира, 05.10), y — высота блока месторождения
var NS_ATLAS_SEED = [
	['nightshift:hevea_soil', 1192, 63, -2129],
	['nightshift:salt_deposit', 1184, 64, -2129],
	['nightshift:salt_deposit', 1386, 62, -1862],
	['nightshift:magnetic_anomaly', 1919, 118, 647],
	['nightshift:sulfur_spring', 244, -50, -1153],
	['nightshift:sulfur_spring', 4983, 99, 165],
	['nightshift:quartz_vein', 3801, 62, 980],
	['nightshift:bauxite_deposit', 1876, 91, 719],
	['nightshift:helium_ice', 1147, 197, -4445],
	['nightshift:permafrost', -258, 98, -1357],
	['nightshift:peat_bog', 2261, 62, -2954],
	['nightshift:mycelium_vein', 1595, -25, -1523],
	['nightshift:star_stone', 1193, 198, -4626],
	['axiomativ:geothermal_source', 1967, 103, 639],
	['axiomativ:river_rapids', 1771, 61, -2325],
]
var NS_ATLAS_DEPOSIT_IDS = {}
NS_ATLAS_TYPES.forEach(function (t) {
	NS_ATLAS_DEPOSIT_IDS[t[0]] = true
})

function nsAtlasState() {
	if (NSG.nsAtlas) return NSG.nsAtlas
	var st = { deps: [], seeded: false }
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_ATLAS_KEY)) st = Object.assign(st, JSON.parse(String(pd.getString(NS_ATLAS_KEY))))
	} catch (e) {
		console.warn('[atlas] битое состояние, сбрасываю: ' + e)
	}
	if (!st.seeded) {
		NS_ATLAS_SEED.forEach(function (s) {
			st.deps.push({ k: s[0], x: s[1], y: s[2], z: s[3], by: 'геологоразведка' })
		})
		st.seeded = true
	}
	NSG.nsAtlas = st
	return st
}
function nsAtlasSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_ATLAS_KEY, JSON.stringify(nsAtlasState()))
	} catch (e) {}
}
function nsAtlasNear(st, k, x, z, r) {
	for (var i = 0; i < st.deps.length; i++) {
		var d = st.deps[i]
		if (d.k === k && Math.abs(d.x - x) <= r && Math.abs(d.z - z) <= r) return d
	}
	return null
}
function nsAtlasAdd(k, x, y, z, by, announce) {
	var st = nsAtlasState()
	if (nsAtlasNear(st, k, x, z, 64)) return false
	st.deps.push({ k: k, x: x, y: y, z: z, by: by })
	nsAtlasSave()
	if (announce) {
		var name = NS_ATLAS_NAME[k] || k
		var ps = NSG.nsServer.getPlayers()
		for (var i = 0; i < ps.length; i++) ps[i].tell(Text.aqua('[Атлас] ').append(Text.white('Найдено месторождение «' + name + '» (' + Math.round(x) + ', ' + Math.round(z) + ')')).append(Text.gray(' — нашёл ' + by + '. ПКМ атласом — метка.')))
		if (typeof nsJournal === 'function') nsJournal('atlas', 'Найдено месторождение «' + name + '» (' + x + ', ' + z + '), нашёл ' + by, 'aqua')
	}
	return true
}

// --------------------------------------------------------------------------
// Показ
// --------------------------------------------------------------------------
function nsAtlasDir(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI
	if (ang < 0) ang += 360
	return ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][Math.round(ang / 45) % 8]
}
function nsAtlasShow(p) {
	var name = String(p.getUsername())
	var st = nsAtlasState()
	var rs = nsGetStateRO()
	var outs = rs.outposts || []
	var px = Number(p.getX()),
		pz = Number(p.getZ())
	var srv = NSG.nsServer
	var known = 0
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: 'Атлас месторождений — ближайшее каждого вида (клик — метка Xaero):', color: 'gold' }))
	NSG.nsAtlasLast = NSG.nsAtlasLast || {}
	var picks = []
	for (var t = 0; t < NS_ATLAS_TYPES.length; t++) {
		var k = NS_ATLAS_TYPES[t][0]
		var best = null,
			bd = Infinity,
			count = 0
		for (var i = 0; i < st.deps.length; i++) {
			var d = st.deps[i]
			if (d.k !== k) continue
			count++
			var dist = Math.sqrt((d.x - px) * (d.x - px) + (d.z - pz) * (d.z - pz))
			if (dist < bd) {
				bd = dist
				best = d
			}
		}
		if (!best) {
			srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify([{ text: ' ▸ ' + NS_ATLAS_TYPES[t][1] + ' — ', color: 'gray' }, { text: 'не найдено', color: 'dark_gray', italic: true }]))
			continue
		}
		known++
		var built = false
		for (var o = 0; o < outs.length; o++) if (outs[o].deposit === k && Math.abs(outs[o].x - best.x) <= 24 && Math.abs(outs[o].z - best.z) <= 24) built = true
		picks.push(best)
		var idx = picks.length - 1
		var line = [
			{ text: ' ▸ ' + NS_ATLAS_TYPES[t][1] + ' ', color: built ? 'green' : 'white' },
			{
				text: Math.round(best.x) + ' ' + Math.round(best.y) + ' ' + Math.round(best.z),
				color: 'yellow',
				underlined: true,
				clickEvent: { action: 'run_command', value: '/atlas wp ' + idx },
				hoverEvent: { action: 'show_text', contents: 'Поставить метку Xaero' },
			},
			{ text: ' · ' + Math.round(bd) + ' бл. ' + nsAtlasDir(best.x - px, best.z - pz), color: 'gray' },
		]
		if (built) line.push({ text: ' ✔ форпост', color: 'green' })
		if (count > 1) line.push({ text: ' (ещё ' + (count - 1) + ')', color: 'dark_gray' })
		srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify(line))
	}
	NSG.nsAtlasLast[name] = picks
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: 'Известно видов: ' + known + ' из ' + NS_ATLAS_TYPES.length + '. Новые месторождения атлас записывает сам, когда на них встаёшь. Жилы руды с аэрофотоаппарата — /veins [тип].', color: 'dark_gray' }))
}

ItemEvents.rightClicked('nightshift:deposit_atlas', event => {
	try {
		var p = event.getPlayer()
		if (!p) return
		var key = String(p.getUsername())
		var now = Number(event.server.getTickCount())
		NSG.nsAtlasCd = NSG.nsAtlasCd || {}
		if (NSG.nsAtlasCd[key] && now - NSG.nsAtlasCd[key] < 20) return
		NSG.nsAtlasCd[key] = now
		nsAtlasShow(p)
		p.playSound('minecraft:item.book.page_turn', 1, 1)
	} catch (e) {
		console.error('[atlas] ПКМ: ' + e)
	}
})

// --------------------------------------------------------------------------
// Разведка шагами: встал на месторождение — запись
// --------------------------------------------------------------------------
NSG.nsAtlasTick = 0
ServerEvents.tick(event => {
	NSG.nsAtlasTick++
	if (NSG.nsAtlasTick % 60 !== 0 || !NSG.nsServer) return
	try {
		var ps = event.server.getPlayers()
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i]
			if (p.isSpectator()) continue
			var lv = p.getLevel()
			var dim = String(typeof lv.dimension === 'function' ? lv.dimension().location() : lv.dimension)
			if (dim !== 'minecraft:overworld') continue
			var x = Math.floor(Number(p.getX())),
				y = Math.floor(Number(p.getY())),
				z = Math.floor(Number(p.getZ()))
			for (var dy = 1; dy <= 2; dy++) {
				var id = String(lv.getBlock(x, y - dy, z).getId())
				if (NS_ATLAS_DEPOSIT_IDS[id]) {
					nsAtlasAdd(id, x, y - dy, z, String(p.getUsername()), true)
					break
				}
			}
		}
		// экструдеры сети форпостов — в атлас (тихо)
		if (NSG.nsAtlasTick % 1200 === 0) {
			var outs = nsGetStateRO().outposts || []
			for (var o = 0; o < outs.length; o++) if (NS_ATLAS_DEPOSIT_IDS[outs[o].deposit] && outs[o].dim === 'minecraft:overworld') nsAtlasAdd(outs[o].deposit, outs[o].x, outs[o].y - 1, outs[o].z, 'сеть форпостов', false)
		}
	} catch (e) {
		console.error('[atlas] разведка: ' + e)
	}
})

// Первый вход после 3.4.0 — атлас каждому
PlayerEvents.loggedIn(event => {
	try {
		var p = event.getPlayer()
		if (p.getTags().contains('ns_atlas_given')) return
		p.addTag('ns_atlas_given')
		p.give(Item.of('nightshift:deposit_atlas'))
		p.tell(Text.aqua('[Атлас] ').append(Text.white('Геологоразведка прислала атлас месторождений — ПКМ им: где ближайшая Солеварня, Гевея, Сера…')))
	} catch (e) {}
})

ServerEvents.recipes(event => {
	event.recipes.create.deploying('nightshift:deposit_atlas', ['minecraft:book', 'minecraft:compass']).id('nightshift:shift/deploying/deposit_atlas')
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var I = event.arguments.INTEGER
	event.register(
		C.literal('atlas')
			.executes(ctx => {
				var p = ctx.source.getPlayer()
				if (p) nsAtlasShow(p)
				else ctx.source.sendSystemMessage(Text.of('[atlas] записей: ' + nsAtlasState().deps.length + ' — ' + JSON.stringify(nsAtlasState().deps.slice(0, 20))))
				return 1
			})
			.then(
				C.literal('wp').then(
					C.argument('i', I.create(event)).executes(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var picks = (NSG.nsAtlasLast || {})[String(p.getUsername())] || []
						var d = picks[Number(I.getResult(ctx, 'i'))]
						if (!d) return 0
						var nm = (NS_ATLAS_NAME[d.k] || 'Месторождение').replace(/[:]/g, ' ')
						p.tell(Text.of('xaero-waypoint:' + nm + ':' + nm.charAt(0) + ':' + Math.round(d.x) + ':' + Math.round(d.y + 1) + ':' + Math.round(d.z) + ':11:false:0:Internal-overworld-waypoints'))
						return 1
					})
				)
			)
	)
})

ServerEvents.loaded(event => {
	NSG.nsAtlas = null
})
