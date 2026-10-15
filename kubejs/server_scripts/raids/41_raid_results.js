// ==========================================================================
// Ночная смена — итоги набега одной строкой (15.10, «меньше чата»). После победы в чат шло 5–10 строк: добыча
// каждому, артефакты, «итог боя», контракты, проклятие, раны, веха. Теперь на время победы (nsRaidVictory, 40_)
// всё это копится в буфер, а каждому в сети уходит одна строка:
//   [Итоги волны 23] добыча: 14 шт., артефакт смены · открыта 24-я · лучший боец — Sokol2008 (31) · контракт выполнен
// Наведи — полный список (общие строки и своя добыча), клик — /nightshift itogi: пульт алтаря на вкладке «Итоги»
// (последний набег, то же целиком); без аддона — те же строки в чат.
// Хуки (все — через typeof): nsTellAll и nsGiveLoot (40_) пишут в буфер, пока он открыт; nsVicNote — пункты строки
// (контракт, лучший боец, проклятие, раны, веха, первое прохождение). Последние итоги — persistentData
// «ns_last_raid_json» (строки — JSON компонентов, как в журнале смены: переводимые названия предметов).
// Правило Rhino: только var; тела — в try.
// ==========================================================================
var NS_VIC_KEY = 'ns_last_raid_json'
var NS_VIC_SER = null
try {
	NS_VIC_SER = Java.loadClass('net.minecraft.network.chat.Component$Serializer')
} catch (e) {
	console.warn('[nightshift] итоги набега: сериализатор компонентов не найден — в пульт уйдёт простой текст')
}

// Открыть буфер на время победы на волне d
function nsVicBegin(d) {
	NSG.nsVic = { d: d, all: [], per: {}, loot: {}, notes: {} }
}

// Пункт строки итогов: kind — contract | best | curse | wounds | milestone | first
function nsVicNote(kind, value) {
	var V = NSG.nsVic
	if (!V) return
	if (kind === 'contract') V.notes.contract = (V.notes.contract || 0) + 1
	else V.notes[kind] = value === undefined ? true : value
}

// Строка игроку: в буфер, пока он открыт, иначе сразу
function nsVicTell(player, comp) {
	var V = NSG.nsVic
	if (!V) {
		player.tell(comp)
		return
	}
	var n = String(player.getUsername())
	if (!V.per[n]) V.per[n] = []
	V.per[n].push(comp)
}

// nsTellAll в буфер (true — забрали)
function nsVicTellAll(comp) {
	var V = NSG.nsVic
	if (!V) return false
	V.all.push(comp)
	return true
}

// Добыча игрока для строки: штук и редкого (nsGiveLoot, 40_)
function nsVicLoot(name, items, rare) {
	var V = NSG.nsVic
	if (!V) return
	var L = V.loot[name] || (V.loot[name] = { items: 0, rare: 0 })
	L.items += items
	L.rare += rare
}

function nsVicPlural(n, one, few, many) {
	var m10 = n % 10,
		m100 = n % 100
	if (m10 === 1 && m100 !== 11) return n + ' ' + one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few
	return n + ' ' + many
}

// Компонент → JSON-строка (для пульта и для /nightshift itogi без окна); нет сериализатора — простой текст
function nsVicJson(comp) {
	try {
		if (NS_VIC_SER) return String(NS_VIC_SER.toJson(comp, NSG.nsServer.registryAccess()))
	} catch (e) {}
	try {
		return JSON.stringify({ text: String(comp.getString()) })
	} catch (e2) {
		return JSON.stringify({ text: String(comp) })
	}
}

// Закрыть буфер: каждому в сети — одна строка, итоги — в persistentData (вкладка «Итоги» пульта)
function nsVicFlush(title) {
	var V = NSG.nsVic
	NSG.nsVic = null
	if (!V) return
	try {
		var d = V.d
		var N = V.notes
		var common = []
		if (N.first) common.push('открыта ' + N.first + '-я')
		if (N.milestone) common.push('веха')
		if (N.best) common.push('лучший боец — ' + N.best)
		if (N.contract) common.push(N.contract > 1 ? 'контрактов выполнено: ' + N.contract : 'контракт выполнен')
		if (N.curse) common.push(N.curse)
		if (N.wounds) common.push('раны затянуты')
		var rec = { d: d, title: title || 'Волна ' + d + ' — победа', day: 0, ts: Date.now(), all: [], per: {} }
		try {
			rec.day = Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
		} catch (e) {}
		for (var a = 0; a < V.all.length; a++) rec.all.push(nsVicJson(V.all[a]))
		for (var pn in V.per) {
			rec.per[pn] = []
			for (var q = 0; q < V.per[pn].length; q++) rec.per[pn].push(nsVicJson(V.per[pn][q]))
		}
		var ps = NSG.nsServer.getPlayers()
		for (var i = 0; i < ps.length; i++) {
			var name = String(ps[i].getUsername())
			var L = V.loot[name]
			var parts = []
			parts.push(L && L.items > 0 ? 'добыча: ' + L.items + ' шт.' + (L.rare > 0 ? ', редкого ' + L.rare : '') : 'без добычи')
			parts = parts.concat(common)
			var own = V.per[name] || []
			var hov = Text.gold('Итоги волны ' + d)
			for (var o = 0; o < own.length; o++) hov = hov.append(Text.of('\n')).append(own[o])
			for (var b = 0; b < V.all.length; b++) hov = hov.append(Text.of('\n')).append(V.all[b])
			hov = hov.append(Text.darkGray('\nКлик — итоги в пульте алтаря (вкладка «Итоги»)'))
			var line = Text.gold('[Итоги волны ' + d + '] ').append(Text.white(parts.join(' · '))).hover(hov).clickRunCommand('/nightshift itogi')
			ps[i].tell(line)
		}
		NSG.nsServer.persistentData.putString(NS_VIC_KEY, JSON.stringify(rec))
		console.info('[nightshift] итоги волны ' + d + ': общих строк ' + V.all.length + ', ' + common.join(' · '))
	} catch (e) {
		console.error('[nightshift] итоги набега: ' + e)
		// строка не собралась — хотя бы всё накопленное, как раньше
		try {
			var ps2 = NSG.nsServer.getPlayers()
			for (var j = 0; j < ps2.length; j++) {
				var nm = String(ps2[j].getUsername())
				var mine = V.per[nm] || []
				for (var k = 0; k < mine.length; k++) ps2[j].tell(mine[k])
				for (var m = 0; m < V.all.length; m++) ps2[j].tell(V.all[m])
			}
		} catch (e2) {}
	}
}

// Последние итоги или null
function nsVicLast() {
	try {
		var pd = NSG.nsServer.persistentData
		if (!pd.contains(NS_VIC_KEY)) return null
		return JSON.parse(String(pd.getString(NS_VIC_KEY)))
	} catch (e) {
		return null
	}
}

// Вкладка «Итоги» пульта (16_dossier.js, nsDosMenuData): {title, when, lines: [JSON компонента]} или null
function nsVicMenu(player) {
	var r = nsVicLast()
	if (!r) return null
	var lines = []
	var mine = player ? r.per[String(player.getUsername())] || [] : []
	for (var i = 0; i < mine.length; i++) lines.push(mine[i])
	for (var j = 0; j < r.all.length; j++) lines.push(r.all[j])
	return { title: r.title || 'Волна ' + r.d, when: 'день ' + r.day, lines: lines }
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var show = function (ctx, chat) {
		try {
			var p = ctx.source.getPlayer()
			// вкладка «Итоги» — в том же jar аддона, что и окно-список: старый jar — в чат
			var tabOk = typeof NS_LIST_API !== 'undefined' && !!NS_LIST_API
			if (!chat && p && tabOk && typeof nsAltarScreenTab === 'function' && nsAltarScreenTab(p, 'itogi', 0)) return 1
			var r = nsVicLast()
			if (!r) {
				ctx.source.sendSystemMessage(Text.gray('[Ночная смена] Итогов ещё нет — они появятся после первой победы в набеге.'))
				return 1
			}
			if (!p) {
				console.info('[nightshift] итоги: ' + r.title + ', день ' + r.day + ', строк ' + r.all.length)
				return 1
			}
			var name = String(p.getUsername())
			NSG.nsServer.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: 'Итоги: ' + r.title + ' (день ' + r.day + ')', color: 'gold' }))
			var mine = r.per[name] || []
			for (var i = 0; i < mine.length; i++) NSG.nsServer.runCommandSilent('tellraw ' + name + ' ' + mine[i])
			for (var j = 0; j < r.all.length; j++) NSG.nsServer.runCommandSilent('tellraw ' + name + ' ' + r.all[j])
		} catch (e) {
			console.error('[nightshift] /nightshift itogi: ' + e)
		}
		return 1
	}
	// «nightshift» уже есть (50_) — Brigadier сливает ветки одного имени
	event.register(
		C.literal('nightshift').then(
			C.literal('itogi')
				.executes(ctx => show(ctx, false))
				.then(C.literal('chat').executes(ctx => show(ctx, true)))
		)
	)
})
