// ==========================================================================
// Закреплённый рецепт — список «что принести» справа на экране у всех.
//   /pin            — рецепт предмета в руке ×1
//   /pin <N>        — ×N
//   /pin add [N]    — добавить к уже закреплённому (списки складываются)
//   /unpin          — убрать
// Показ — боковая панель скорборда (ванильная, справа): «детали» — что класть
// в верстак, «сырьё» — во что это раскладывается до слитков, руды, брёвен и камня.
// Разбор идёт по рецептам верстака, механического крафтера и пресса Create;
// слитки, самоцветы, пыль, сырая руда и брёвна дальше не раскладываются.
// KubeJS 2101 / Rhino: только var.
// ==========================================================================

var PIN_RT = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
var PIN_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
var PIN_TAGKEY = Java.loadClass('net.minecraft.tags.TagKey')
var PIN_REG = Java.loadClass('net.minecraft.core.registries.Registries')

var PIN_TYPES = { 'minecraft:crafting': 3, 'create:mechanical_crafting': 2, 'create:pressing': 1 }
var PIN_STOP_TAGS = ['c:ingots', 'c:gems', 'c:dusts', 'c:raw_materials', 'minecraft:logs', 'c:stones', 'c:cobblestones', 'c:sands', 'c:gravels']
// природное, что тоже не раскладываем (у некоторых есть «обратные» рецепты из других модов)
var PIN_STOP_IDS = {
	'minecraft:andesite': 1, 'minecraft:diorite': 1, 'minecraft:granite': 1, 'minecraft:stone': 1, 'minecraft:cobblestone': 1,
	'minecraft:deepslate': 1, 'minecraft:cobbled_deepslate': 1, 'minecraft:tuff': 1, 'minecraft:calcite': 1, 'minecraft:dirt': 1,
	'minecraft:clay_ball': 1, 'minecraft:string': 1, 'minecraft:leather': 1, 'minecraft:slime_ball': 1, 'minecraft:wheat': 1,
	'minecraft:sugar_cane': 1, 'minecraft:dried_kelp': 1, 'minecraft:bone_meal': 1, 'minecraft:glass': 1,
}
var PIN_OBJ = 'nspin'
var PIN_MAX_DETAILS = 5
var PIN_MAX_RAW = 8

var PIN_INDEX = null // {itemId: [{score, count, ins: {id: n}}]}
var PIN_STOP_KEYS = null

function pinIndex(server) {
	if (PIN_INDEX) return PIN_INDEX
	var idx = {}
	var ra = server.registryAccess()
	var all = server.getRecipeManager().getRecipes()
	var it = all.iterator()
	while (it.hasNext()) {
		var holder = it.next()
		var r = holder.value()
		var type = String(PIN_RT.RECIPE_TYPE.getKey(r.getType()))
		var score = PIN_TYPES[type]
		if (!score) continue
		var out
		try {
			out = r.getResultItem(ra)
		} catch (e) {
			continue
		}
		if (!out || out.isEmpty()) continue
		var outId = String(out.getId())
		var ins = {}
		var n = 0
		var ings = r.getIngredients()
		for (var i = 0; i < ings.size(); i++) {
			var ing = ings.get(i)
			if (ing.isEmpty()) continue
			// из тега берём предмет ванили или Create, иначе первый
			var ids = []
			var iit = ing.getItemIds().iterator()
			while (iit.hasNext()) ids.push(String(iit.next()))
			if (ids.length === 0) continue
			ids.sort()
			var pid = ids[0]
			for (var k = 1; k < ids.length; k++) if (pinRank(ids[k]) < pinRank(pid)) pid = ids[k]
			ins[pid] = (ins[pid] || 0) + 1
			n++
		}
		if (n === 0) continue
		// «блок → 9 штук» и сжатые блоки — разборка, а не рецепт: в самый низ
		var keys = Object.keys(ins)
		for (var ck = 0; ck < keys.length; ck++) if (keys[ck].indexOf('compressed') >= 0 || (keys.length === 1 && keys[ck].indexOf('_block') >= 0)) score -= 5
		// переделка «1 → 1» (вертикальный редуктор ↔ редуктор, перекраска) — только если другого рецепта нет
		if (type === 'minecraft:crafting' && keys.length === 1 && ins[keys[0]] === 1 && out.getCount() === 1) score -= 2
		if (score <= 0) continue
		var rid = String(holder.id())
		// свой рецепт мода предмета надёжнее совместимых
		if (rid.split(':')[0] === outId.split(':')[0]) score += 0.5
		;(idx[outId] = idx[outId] || []).push({ score: score, count: out.getCount(), ins: ins })
	}
	for (var id in idx) idx[id].sort(function (a, b) { return b.score - a.score })
	PIN_INDEX = idx
	return idx
}

// Какой предмет брать из тега: обычные дубовые брёвна/доски, потом ваниль, потом Create
function pinRank(id) {
	if (id === 'minecraft:oak_log' || id === 'minecraft:oak_planks') return 0
	if (id.indexOf('minecraft:oak_') === 0 && id.indexOf('stripped') < 0 && id.indexOf('_wood') < 0) return 0.5
	if (id.indexOf('minecraft:') === 0) return id.indexOf('stripped') >= 0 || id.indexOf('_wood') >= 0 ? 2 : 1
	if (id.indexOf('create:') === 0) return 3
	return 4
}

function pinIsStop(id) {
	if (!PIN_STOP_KEYS) {
		PIN_STOP_KEYS = []
		for (var i = 0; i < PIN_STOP_TAGS.length; i++) PIN_STOP_KEYS.push(PIN_TAGKEY.create(PIN_REG.ITEM, PIN_RL.parse(PIN_STOP_TAGS[i])))
	}
	if (PIN_STOP_IDS[id]) return true
	var st = Item.of(id)
	// у ItemStack.is несколько перегрузок — Rhino нужен явный вариант с TagKey
	for (var j = 0; j < PIN_STOP_KEYS.length; j++) if (st['is(net.minecraft.tags.TagKey)'](PIN_STOP_KEYS[j])) return true
	return false
}

// Раскладывает count штук id до сырья, копит в acc
function pinExpand(idx, id, count, depth, acc, path) {
	var recs = idx[id]
	if (depth > 0 && (pinIsStop(id) || !recs || depth > 7 || path[id])) {
		acc[id] = (acc[id] || 0) + count
		return
	}
	if (!recs) {
		acc[id] = (acc[id] || 0) + count
		return
	}
	var r = recs[0]
	// рецепт не должен требовать сам себя (переплавка блоков и т.п.)
	for (var q = 0; q < recs.length && recs[q].ins[id]; q++) r = recs[q + 1] || r
	if (r.ins[id]) {
		acc[id] = (acc[id] || 0) + count
		return
	}
	var times = Math.ceil(count / r.count)
	var p2 = {}
	for (var pk in path) p2[pk] = true
	p2[id] = true
	for (var ing in r.ins) pinExpand(idx, ing, r.ins[ing] * times, depth + 1, acc, p2)
}

function pinName(id) {
	try {
		return { translate: String(Item.of(id).getDescriptionId()) }
	} catch (e) {
		return { text: id }
	}
}

function pinState(server) {
	var pd = server.persistentData
	if (!pd.contains('nightshift_pins')) return []
	try {
		return JSON.parse(pd.getString('nightshift_pins'))
	} catch (e) {
		return []
	}
}

function pinRender(server) {
	var pins = pinState(server)
	server.runCommandSilent('scoreboard objectives remove ' + PIN_OBJ)
	if (pins.length === 0) return
	var idx = pinIndex(server)
	var details = {}
	var raw = {}
	for (var i = 0; i < pins.length; i++) {
		var p = pins[i]
		var recs = idx[p.id]
		if (!recs) {
			raw[p.id] = (raw[p.id] || 0) + p.n
			continue
		}
		var times = Math.ceil(p.n / recs[0].count)
		for (var ing in recs[0].ins) details[ing] = (details[ing] || 0) + recs[0].ins[ing] * times
		pinExpand(idx, p.id, p.n, 0, raw, {})
	}
	var title = [{ text: 'Собрать: ', color: 'gold' }, pinName(pins[0].id), { text: ' ×' + pins[0].n, color: 'white' }]
	if (pins.length > 1) title.push({ text: ' и ещё ' + (pins.length - 1), color: 'gray' })
	server.runCommandSilent('scoreboard objectives add ' + PIN_OBJ + ' dummy ' + JSON.stringify(title))
	server.runCommandSilent('scoreboard objectives setdisplay sidebar ' + PIN_OBJ)
	// строки: счёт — только порядок сверху вниз, число справа — отдельный текст
	var rows = []
	rows.push({ text: [{ text: '— детали —', color: 'gray' }], num: null })
	var dk = Object.keys(details).sort(function (a, b) { return details[b] - details[a] })
	for (var d = 0; d < dk.length && d < PIN_MAX_DETAILS; d++) rows.push({ text: [pinName(dk[d])], num: details[dk[d]] })
	rows.push({ text: [{ text: '— сырьё —', color: 'gray' }], num: null })
	var rk = Object.keys(raw).sort(function (a, b) { return raw[b] - raw[a] })
	for (var r = 0; r < rk.length && r < PIN_MAX_RAW; r++) rows.push({ text: [pinName(rk[r])], num: raw[rk[r]] })
	if (rk.length > PIN_MAX_RAW) rows.push({ text: [{ text: '…и ещё ' + (rk.length - PIN_MAX_RAW), color: 'gray' }], num: null })
	for (var k = 0; k < rows.length; k++) {
		var e = 'pin' + (k < 10 ? '0' : '') + k
		server.runCommandSilent('scoreboard players set ' + e + ' ' + PIN_OBJ + ' ' + (100 - k))
		server.runCommandSilent('scoreboard players display name ' + e + ' ' + PIN_OBJ + ' ' + JSON.stringify(rows[k].text))
		var fmt = rows[k].num === null ? 'blank' : 'fixed ' + JSON.stringify({ text: String(rows[k].num), color: 'yellow' })
		server.runCommandSilent('scoreboard players display numberformat ' + e + ' ' + PIN_OBJ + ' ' + fmt)
	}
}

function pinSet(ctx, count, add) {
	var player = ctx.source.getPlayer()
	if (!player) return 0
	var held = player.getMainHandItem()
	if (!held || held.isEmpty()) {
		ctx.source.sendSystemMessage(Text.gray('[Рецепт] Возьми в руку предмет, который хочешь собрать, и повтори /pin.'))
		return 0
	}
	var server = ctx.source.getServer()
	var id = String(held.getId())
	var n = Math.max(1, Math.min(999, count || 1))
	var pins = add ? pinState(server) : []
	var found = false
	for (var i = 0; i < pins.length; i++) if (pins[i].id === id) {
		pins[i].n += n
		found = true
	}
	if (!found) pins.push({ id: id, n: n })
	if (pins.length > 4) pins.shift()
	server.persistentData.putString('nightshift_pins', JSON.stringify(pins))
	pinRender(server)
	var has = !!pinIndex(server)[id]
	var msg = Text.gold('[Рецепт] ' + player.getUsername() + (add ? ' добавил: ' : ' закрепил: ')).append(Text.translate(String(held.getDescriptionId()))).append(Text.white(' ×' + n))
	if (!has) msg = msg.append(Text.gray(' — рецепта верстака у него нет, показан как есть'))
	server.tell(msg)
	return 1
}

// один раз каждому: подсказка про /pin
PlayerEvents.loggedIn(event => {
	var p = event.getPlayer()
	if (p.persistentData.getBoolean('ns_pin_hint')) return
	p.persistentData.putBoolean('ns_pin_hint', true)
	p.tell(Text.gold('[Новое] Возьми в руку предмет, который хочешь собрать, и введи ').append(Text.yellow('/pin')).append(Text.gold(' (или /pin 4) — справа у всех появится список: детали и сырьё. ')).append(Text.yellow('/pin add')).append(Text.gold(' — добавить ещё, ')).append(Text.yellow('/unpin')).append(Text.gold(' — убрать.')))
})

ServerEvents.loaded(event => {
	PIN_INDEX = null
	pinRender(event.server)
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('pin')
			.executes(ctx => pinSet(ctx, 1, false))
			.then(C.argument('n', A.INTEGER.create(event)).executes(ctx => pinSet(ctx, Number(A.INTEGER.getResult(ctx, 'n')), false)))
			.then(
				C.literal('add')
					.executes(ctx => pinSet(ctx, 1, true))
					.then(C.argument('n', A.INTEGER.create(event)).executes(ctx => pinSet(ctx, Number(A.INTEGER.getResult(ctx, 'n')), true)))
			)
	)
	event.register(
		C.literal('unpin').executes(ctx => {
			var server = ctx.source.getServer()
			server.persistentData.putString('nightshift_pins', '[]')
			pinRender(server)
			ctx.source.sendSystemMessage(Text.gray('[Рецепт] Список убран.'))
			return 1
		})
	)
})
