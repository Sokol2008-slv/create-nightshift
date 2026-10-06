// ==========================================================================
// /idea — копилка замечаний для большой обновы (04.10.2026, Георгий: «пройдём сборку один раз, потом соберём всё,
// чего не хватило»). Любой игрок пишет «/idea <текст>» — запись с ником, временем, местом и прогрессом волн уходит
// в persistentData сервера и в файл nightshift_ideas.json в корне сервера (его читает Claude при подготовке обновы).
// /ideas — последние 10 записей. Подсказка про команду — один раз каждому при входе.
// ==========================================================================
var NS_IDEA_KEY = 'nightshift_ideas'
var NS_IDEA_MAX_LEN = 500
var NS_IDEA_LAST = {} // hud/ грузится раньше raids/ — NSG здесь ещё нет
// Что из идей уже сделано (финальный аудит 06.10: игроки должны видеть, что их слышат). Номер → в какой версии и что.
var NS_IDEA_DONE = {
	1: '3.3 — «Пульт алтаря»: ПКМ по алтарю открывает окно',
	2: '3.4.0 — «Атлас месторождений» (/atlas) и дрон-разведчик',
}

function nsIdeasLoad(server) {
	try {
		var raw = server.persistentData.getString(NS_IDEA_KEY)
		if (raw && String(raw).length) return JSON.parse(String(raw))
	} catch (e) {}
	return []
}

function nsIdeasSave(server, list) {
	server.persistentData.putString(NS_IDEA_KEY, JSON.stringify(list))
	try {
		JsonIO.write('nightshift_ideas.json', { ideas: list })
	} catch (e) {
		console.error('[nightshift] не удалось записать nightshift_ideas.json: ' + e)
	}
}

function nsIdeaNow() {
	var d = new Date()
	var p = function (n) {
		return (n < 10 ? '0' : '') + n
	}
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('idea').then(
			C.argument('text', A.GREEDY_STRING.create(event)).executes(ctx => {
				var src = ctx.source
				var player = src.getPlayer()
				var who = player ? String(player.getUsername()) : 'Консоль'
				var text = String(A.GREEDY_STRING.getResult(ctx, 'text')).trim()
				if (!text.length) return 0
				if (text.length > NS_IDEA_MAX_LEN) text = text.substring(0, NS_IDEA_MAX_LEN) + '…'
				var now = Date.now()
				if (now - (NS_IDEA_LAST[who] || 0) < 5000) {
					src.sendSystemMessage(Text.gray('[Идеи] Не так быстро — раз в 5 секунд.'))
					return 0
				}
				NS_IDEA_LAST[who] = now
				var server = src.getServer()
				var list = nsIdeasLoad(server)
				var e = { n: list.length + 1, t: nsIdeaNow(), who: who, text: text }
				if (player) {
					e.dim = String(player.getLevel().getDimension())
					e.pos = [Math.floor(player.getX()), Math.floor(player.getY()), Math.floor(player.getZ())]
				}
				try {
					var st = nsGetState()
					e.waves = st.phase || 0
					if (st.raid && st.raid.state === 'active') e.raid = st.raid.difficulty
				} catch (x) {}
				list.push(e)
				nsIdeasSave(server, list)
				src.sendSystemMessage(Text.green('[Идеи] Записал №' + e.n + ' — спасибо! К большой обнове всё соберём.'))
				// команде — коротко, чтобы видели, что уже предложено
				server.getPlayers().forEach(p => {
					if (String(p.getUsername()) !== who) p.tell(Text.darkGray('[Идеи] ' + who + ': ').append(Text.gray(text.length > 120 ? text.substring(0, 120) + '…' : text)))
				})
				return 1
			})
		)
	)
	event.register(
		C.literal('ideas').executes(ctx => {
			var list = nsIdeasLoad(ctx.source.getServer())
			if (!list.length) {
				ctx.source.sendSystemMessage(Text.gray('[Идеи] Пока пусто. Напишите: /idea <что не хватает или бесит>'))
				return 1
			}
			ctx.source.sendSystemMessage(Text.gold('[Идеи] Всего ' + list.length + ', последние:'))
			for (var i = Math.max(0, list.length - 10); i < list.length; i++) {
				var e = list[i]
				var line = Text.white('№' + e.n + ' ').append(Text.gray(e.t + ' · ' + e.who + ': ')).append(Text.white(e.text))
				if (NS_IDEA_DONE[e.n]) line = line.append(Text.green(' ✔ сделано: ' + NS_IDEA_DONE[e.n]))
				ctx.source.sendSystemMessage(line)
			}
			return 1
		})
	)
})

// Один раз каждому: про /idea
PlayerEvents.loggedIn(event => {
	try {
		var p = event.player
		if (p.getTags().contains('ns_idea_hint')) return
		p.addTag('ns_idea_hint')
		p.tell(Text.gold('[Ночная смена] ').append(Text.white('Чего-то не хватает или что-то бесит? Пишите ')).append(Text.yellow('/idea <текст>').clickSuggestCommand('/idea ')).append(Text.white(' — всё соберём к большой обнове. Список — ')).append(Text.yellow('/ideas').clickRunCommand('/ideas')).append(Text.white('.')))
	} catch (e) {}
})
