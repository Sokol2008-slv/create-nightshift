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
//  - Окно (08.10, аддон Axiomativ Industries: AtlasMenu.open): ПКМ атласом и /atlas открывают окно — вкладки
//    «Месторождения» и «Жилы» (атлас аэрофотоаппарата, aviation/30_aerial_camera.js), сверху карта вокруг игрока.
//    Клик по строке или точке — метка Xaero (окно Xaero с клиента; без Xaero — /atlas wp_at x y z <вид>, строка в чат).
//    Строки в чат — /atlas chat и запасной путь, если окна нет (старый jar аддона, клиент без аддона).
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

// Окно атласа: [цвет точки на карте, цвет метки Xaero (0–15), буквы метки, где искать коротко, где искать подробно]
// (где искать — как в подсказках JEI client_scripts/outposts_jei.js и описаниях блоков аддона)
var NS_ATLAS_LOOK = {
	'nightshift:salt_deposit': [0xffb3c7, 13, 'Сл', 'пляжи, у самой воды', 'пляжи — розово-белый пласт у самой воды.'],
	'nightshift:hevea_soil': [0x4caf50, 2, 'Кп', 'джунгли', 'джунгли — красная почва с серыми деревьями-гевеями.'],
	'nightshift:sulfur_spring': [0xffeb3b, 14, 'Си', 'бесплодные земли, пещеры', 'бесплодные земли (озерца на поверхности) и глубокие пещеры ниже −12 — жёлтое озеро жидкой серы, над ним дымок.'],
	'nightshift:magnetic_anomaly': [0xe040fb, 5, 'Ма', 'горы выше 120', 'горы выше высоты 120 — фиолетовый камень с искрами.'],
	'nightshift:quartz_vein': [0xffffff, 15, 'Кк', 'пустыни', 'пустыни — белая блестящая жила.'],
	'nightshift:bauxite_deposit': [0xe07b39, 6, 'Бк', 'саванны и плато', 'саванны и плато — рыжий пласт.'],
	'nightshift:mycelium_vein': [0x00e5a0, 3, 'Гп', 'грибные поля, пещеры', 'грибные поля и пышные пещеры — светящаяся синяя грибница.'],
	'nightshift:peat_bog': [0x8d6e63, 8, 'Тф', 'болота', 'болота — тёмная тлеющая земля, над ней дым.'],
	'nightshift:permafrost': [0xa8e6ff, 11, 'Лд', 'ледяные биомы', 'ледяные биомы (ледяные шипы, морозные пики) — сине-белая мёрзлая земля в снежинках.'],
	'nightshift:helium_ice': [0x26c6da, 3, 'Вк', 'горы выше 180', 'горы выше высоты 180 — голубой лёд с облачками.'],
	'nightshift:star_stone': [0x7e57c2, 1, 'Об', 'пики выше 200', 'самые высокие пики, выше 200 — тёмно-синий камень со звёздами, светится.'],
	'axiomativ:geothermal_source': [0xf44336, 12, 'Гт', 'вулканы, бесплодные земли', 'на поверхности — вулканы, базальтовые скалы, Йеллоустоун, бесплодные земли; глубоко — термальные и мантийные пещеры. Над жерлом курится дым.'],
	'axiomativ:river_rapids': [0x1e88e5, 9, 'Рп', 'реки', 'реки — над каменной грядой пенится вода, со дна идут пузыри.'],
}
var NS_ATLAS_DIM_NAMES = {
	'minecraft:overworld': 'Верхний мир',
	'minecraft:the_nether': 'Незер',
	'minecraft:the_end': 'Край',
	'nightshift:arena': 'Арена',
	'northstar:moon': 'Луна',
	'northstar:mars': 'Марс',
	'northstar:mercury': 'Меркурий',
	'northstar:venus': 'Венера',
}

// Окно аддона (старый jar без класса — null, атлас пишет в чат)
var NS_ATLAS_MENU = null
try {
	NS_ATLAS_MENU = Java.loadClass('com.axiomativ.industries.content.atlas.AtlasMenu')
} catch (e) {
	console.info('[atlas] окна атласа нет (аддон Axiomativ Industries без AtlasMenu) — атлас пишет в чат')
}

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
				clickEvent: { action: 'run_command', value: '/atlas wp_at ' + Math.round(best.x) + ' ' + Math.round(best.y + 1) + ' ' + Math.round(best.z) + ' ' + k },
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

// --------------------------------------------------------------------------
// Окно атласа: данные (схема — AtlasMenu.java аддона) и открытие
// --------------------------------------------------------------------------
function nsAtlasWindowOk(p) {
	try {
		return !!(NS_ATLAS_MENU && p && NS_ATLAS_MENU.canOpen(p))
	} catch (e) {
		return false
	}
}

// tab: 'deps' | 'veins' | null (окно откроется на прошлой вкладке)
function nsAtlasMenuData(p, tab) {
	var st = nsAtlasState()
	var rs = nsGetStateRO()
	var outs = rs.outposts || []
	var dim = String(p.getLevel().getDimension())
	var px = Math.floor(Number(p.getX())),
		py = Math.floor(Number(p.getY())),
		pz = Math.floor(Number(p.getZ()))
	var who = [],
		whoIdx = {}
	function whoOf(s) {
		s = s ? String(s) : ''
		if (!s) return -1
		if (whoIdx[s] === undefined) {
			whoIdx[s] = who.length
			who.push(s)
		}
		return whoIdx[s]
	}
	var base = [],
		seen = {}
	var alts = rs.altars || []
	for (var a = 0; a < alts.length; a++) {
		if (String(alts[a].dim) !== dim) continue
		var bx = Math.round(Number(alts[a].x)),
			bz = Math.round(Number(alts[a].z))
		if (seen[bx + ',' + bz]) continue // алтарь с несколькими записями (арена) — одна метка
		seen[bx + ',' + bz] = true
		base.push({ x: bx, z: bz })
	}
	// месторождения форпостов: все известные точки, «форпост» — экструдер сети в 24 блоках
	var types = [],
		index = {}
	for (var t = 0; t < NS_ATLAS_TYPES.length; t++) {
		var k = NS_ATLAS_TYPES[t][0]
		var look = NS_ATLAS_LOOK[k] || [0xa8a29a, 11, NS_ATLAS_TYPES[t][1].charAt(0), '', '']
		index[k] = types.length
		types.push({ k: k, name: NS_ATLAS_TYPES[t][1], wn: NS_ATLAS_TYPES[t][1], ini: look[2], wc: look[1], color: look[0], icon: k, n: 0, where: look[3], tip: look[4] })
	}
	var pts = []
	for (var i = 0; i < st.deps.length; i++) {
		var d = st.deps[i]
		var ti = index[d.k]
		if (ti === undefined) continue
		var built = 0
		for (var o = 0; o < outs.length; o++) if (outs[o].deposit === d.k && Math.abs(outs[o].x - d.x) <= 24 && Math.abs(outs[o].z - d.z) <= 24) built = 1
		types[ti].n++
		pts.push([ti, Math.round(d.x), Math.round(d.y), Math.round(d.z), built, whoOf(d.by)])
	}
	var data = {
		v: 1,
		x: px,
		y: py,
		z: pz,
		dim: dim,
		dimName: NS_ATLAS_DIM_NAMES[dim] || '',
		base: base,
		deps: {
			here: dim === 'minecraft:overworld',
			dim: 'minecraft:overworld',
			wy: 1,
			types: types,
			pts: pts,
			hint: 'Новое месторождение атлас записывает сам, когда встаёшь на него; дрон в «Разведке» находит их в 64 блоках.',
			empty: 'Атлас пуст. Встань на месторождение — атлас запишет его сам.',
		},
	}
	if (tab) data.tab = tab
	if (typeof nsCamAtlasMenu === 'function') data.veins = nsCamAtlasMenu(p.getServer(), dim, px, pz, whoOf)
	data.who = who
	return data
}

// Открыть окно. false — окна нет (старый аддон, клиент без аддона) или не собралось: тогда — чат
function nsAtlasOpen(p, tab) {
	if (!nsAtlasWindowOk(p)) return false
	try {
		return !!NS_ATLAS_MENU.open(p, JSON.stringify(nsAtlasMenuData(p, tab)), true)
	} catch (e) {
		console.error('[atlas] окно не открыто: ' + e)
		return false
	}
}

// ПКМ атласом и /atlas: окно, запасной путь — строки в чат
function nsAtlasUse(p, tab) {
	if (!nsAtlasOpen(p, tab)) nsAtlasShow(p)
}

// Метка Xaero по координатам (клик в чате и окно без Xaero). kind — id месторождения или «vein:<жила>»
function nsAtlasWpAt(p, x, y, z, kind) {
	var k = String(kind || '').trim()
	var name, ini, wc, dim
	if (k.indexOf('vein:') === 0) {
		var info = typeof nsCamVeinInfo === 'function' ? nsCamVeinInfo(k.substring(5)) : [k.substring(5), 'Ж', 7]
		name = 'Жила ' + String(info[0]).toLowerCase()
		ini = info[1]
		wc = info[2]
		dim = String(p.getLevel().getDimension())
	} else {
		name = NS_ATLAS_NAME[k] || 'Месторождение'
		var look = NS_ATLAS_LOOK[k]
		ini = look ? look[2] : name.charAt(0)
		wc = look ? look[1] : 11
		dim = 'minecraft:overworld'
	}
	name = name.replace(/[:]/g, ' ')
	var line = 'xaero-waypoint:' + name + ':' + ini + ':' + x + ':' + y + ':' + z + ':' + wc + ':false:0'
	var vanilla = { 'minecraft:overworld': 'overworld', 'minecraft:the_nether': 'the_nether', 'minecraft:the_end': 'the_end' }
	if (vanilla[dim]) line += ':Internal-' + vanilla[dim] + '-waypoints'
	p.tell(Text.of(line))
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
		nsAtlasUse(p, null)
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
		p.tell(Text.aqua('[Атлас] ').append(Text.white('Геологоразведка прислала атлас месторождений — ПКМ им: окно с картой, где ближайшая Солеварня, Гевея, Сера…')))
	} catch (e) {}
})

ServerEvents.recipes(event => {
	event.recipes.create.deploying('nightshift:deposit_atlas', ['minecraft:book', 'minecraft:compass']).id('nightshift:shift/deploying/deposit_atlas')
})

// /atlas — окно (запасной путь — чат), /atlas chat — строками в чат, /atlas wp_at x y z <вид> — метка Xaero строкой в чат,
// /atlas wp <N> — метка по номеру строки (старые строки чата до 08.10). /atlas <тип жилы> — жилы (aviation/30_aerial_camera.js).
ServerEvents.commandRegistry(event => {
	var C = event.commands
	var I = event.arguments.INTEGER
	var S = event.arguments.GREEDY_STRING
	event.register(
		C.literal('atlas')
			.executes(ctx => {
				try {
					var p = ctx.source.getPlayer()
					if (p) nsAtlasUse(p, null)
					else ctx.source.sendSystemMessage(Text.of('[atlas] записей: ' + nsAtlasState().deps.length + ' — ' + JSON.stringify(nsAtlasState().deps.slice(0, 20))))
				} catch (e) {
					console.error('[atlas] /atlas: ' + e)
				}
				return 1
			})
			.then(
				C.literal('chat').executes(ctx => {
					try {
						var p = ctx.source.getPlayer()
						if (p) nsAtlasShow(p)
					} catch (e) {
						console.error('[atlas] /atlas chat: ' + e)
					}
					return 1
				})
			)
			.then(
				C.literal('wp_at').then(
					C.argument('x', I.create(event)).then(
						C.argument('y', I.create(event)).then(
							C.argument('z', I.create(event)).then(
								C.argument('kind', S.create(event)).executes(ctx => {
									try {
										var p = ctx.source.getPlayer()
										if (!p) return 0
										nsAtlasWpAt(p, Number(I.getResult(ctx, 'x')), Number(I.getResult(ctx, 'y')), Number(I.getResult(ctx, 'z')), String(S.getResult(ctx, 'kind')))
									} catch (e) {
										console.error('[atlas] /atlas wp_at: ' + e)
									}
									return 1
								})
							)
						)
					)
				)
			)
			.then(
				C.literal('wp').then(
					C.argument('i', I.create(event)).executes(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var picks = (NSG.nsAtlasLast || {})[String(p.getUsername())] || []
						var d = picks[Number(I.getResult(ctx, 'i'))]
						if (!d) return 0
						nsAtlasWpAt(p, Math.round(d.x), Math.round(d.y + 1), Math.round(d.z), d.k)
						return 1
					})
				)
			)
	)
})

ServerEvents.loaded(event => {
	NSG.nsAtlas = null
})
