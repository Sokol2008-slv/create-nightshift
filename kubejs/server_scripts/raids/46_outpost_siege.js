// ==========================================================================
// Ночная смена — «Осада форпоста» (04.10.2026, Георгий: «форпосты жизненно необходимы»; особые стадии 38 и 57).
// Сеть форпостов команды: механический экструдер (обычный или латунный), поставленный на месторождение
// (тег блоков nightshift:outpost_deposits, vahta/80_outposts.js), записывается в state.outposts.
// На стадии осады набег идёт не на базу, а на один из форпостов: на время набега экструдер становится «алтарём»
// (state.siege — его ищет nsFindAltar), поэтому вся механика набега работает как есть: кольцо спавна вокруг,
// путь мобов к экструдеру, моб у экструдера — провал, кнопка телепорта защитникам, добыча.
// Хуки: nsFindAltar (40_), nsStartChallenge (50_), стадии и прогноз — 45_special_stages.js.
// ==========================================================================
var NS_OUTPOST_EXTRUDERS = { 'create_mechanical_extruder:mechanical_extruder': 1, 'create_mechanical_extruder:mechanical_brass_extruder': 1 }
var NS_OUTPOST_NAMES = {
	'nightshift:hevea_soil': 'Каучуковая плантация',
	'nightshift:salt_deposit': 'Солеварня',
	'nightshift:magnetic_anomaly': 'Магнитная аномалия',
	'nightshift:sulfur_spring': 'Серный источник',
	'nightshift:quartz_vein': 'Кварцевый карьер',
	'nightshift:bauxite_deposit': 'Бокситовый карьер',
	'nightshift:helium_ice': 'Высотный конденсатор',
	'nightshift:permafrost': 'Ледник',
	'nightshift:peat_bog': 'Торфяник',
	'nightshift:mycelium_vein': 'Грибные пещеры',
	'nightshift:star_stone': 'Обсерватория',
}

function nsOutpostId(dim, x, y, z) {
	return 'outpost_' + String(dim).replace(/[^a-z0-9]/gi, '_') + '_' + x + '_' + y + '_' + z
}

function nsOutpostName(o) {
	return NS_OUTPOST_NAMES[o.deposit] || 'Форпост'
}

// Экструдер на месторождении — новый форпост в сети команды
BlockEvents.placed(event => {
	try {
		var b = event.getBlock()
		if (!NS_OUTPOST_EXTRUDERS[String(b.getId())]) return
		var below = b.offset(0, -1, 0)
		if (!below.hasTag('nightshift:outpost_deposits')) return
		var st = nsGetState()
		st.outposts = st.outposts || []
		var dim = String(b.getDimension())
		var id = nsOutpostId(dim, b.getX(), b.getY(), b.getZ())
		for (var i = 0; i < st.outposts.length; i++) if (st.outposts[i].id === id) return
		var o = { id: id, dim: dim, x: b.getX(), y: b.getY(), z: b.getZ(), deposit: String(below.getId()) }
		st.outposts.push(o)
		nsSaveState(st)
		nsTellAll(Text.aqua('[Ночная смена] Форпост «' + nsOutpostName(o) + '» вошёл в сеть (' + o.x + ', ' + o.z + '). ').append(Text.gray('Орда может прийти и сюда — особые стадии «Осада форпоста».')))
	} catch (e) {
		console.error('[nightshift] форпост: ' + e)
	}
})

// Экструдер убран — форпост выходит из сети
BlockEvents.broken(event => {
	try {
		var b = event.getBlock()
		if (!NS_OUTPOST_EXTRUDERS[String(b.getId())]) return
		var st = nsGetState()
		if (!st.outposts || !st.outposts.length) return
		var id = nsOutpostId(String(b.getDimension()), b.getX(), b.getY(), b.getZ())
		for (var i = st.outposts.length - 1; i >= 0; i--) if (st.outposts[i].id === id) st.outposts.splice(i, 1)
		nsSaveState(st)
	} catch (e) {}
})

// Живые форпосты: экструдер на месте (чанк подгружаем), мёртвые записи вычищаем
function nsOutpostsAlive(st) {
	var out = []
	var keep = []
	for (var i = 0; i < (st.outposts || []).length; i++) {
		var o = st.outposts[i]
		try {
			var lv = nsAltarLevel(o) // KubeJS принимает id измерения строкой
			lv.getChunk(o.x >> 4, o.z >> 4)
			if (!NS_OUTPOST_EXTRUDERS[String(lv.getBlock(o.x, o.y, o.z).getId())]) continue
			keep.push(o)
			out.push(o)
		} catch (e) {
			keep.push(o) // измерение не нашли — запись не трогаем
		}
	}
	st.outposts = keep
	return out
}

// Старт осады (из nsStartChallenge): выбрать форпост и сделать его «алтарём» набега. null — форпостов нет.
function nsSiegeAltarFor(st) {
	var alive = nsOutpostsAlive(st)
	if (!alive.length) return null
	var o = alive[Math.floor(Math.random() * alive.length)]
	st.siege = { id: 'siege_' + o.id, dim: o.dim, x: o.x, y: o.y, z: o.z, outpost: o.id, name: nsOutpostName(o) }
	nsSaveState(st)
	return st.siege
}

// Набег закончился — «алтарь» форпоста больше не нужен
var nsSiegeTick = 0
ServerEvents.tick(event => {
	try {
		if (++nsSiegeTick % 100 !== 0) return
		var st = nsGetState()
		if (!st || !st.siege) return
		if (st.raid && st.raid.state !== 'idle' && st.raid.state !== 'cooldown' && st.raid.altarId === st.siege.id) return
		delete st.siege
		nsSaveState(st)
	} catch (e) {}
})

// /nightshift outposts — список форпостов сети (всем)
ServerEvents.commandRegistry(event => {
	var C = event.commands
	event.register(
		C.literal('outposts').executes(ctx => {
			var st = nsGetState()
			var alive = nsOutpostsAlive(st)
			nsSaveState(st)
			var src = ctx.source
			if (!alive.length) {
				src.sendSystemMessage(Text.gray('[Ночная смена] В сети форпостов пусто: поставьте механический экструдер на месторождение.'))
				return 1
			}
			src.sendSystemMessage(Text.aqua('[Ночная смена] Сеть форпостов: ' + alive.length))
			for (var i = 0; i < alive.length; i++) {
				var o = alive[i]
				src.sendSystemMessage(Text.white(' • ' + nsOutpostName(o) + ' — ' + o.x + ', ' + o.y + ', ' + o.z + (o.dim !== 'minecraft:overworld' ? ' (' + o.dim + ')' : '')))
			}
			return 1
		})
	)
})
