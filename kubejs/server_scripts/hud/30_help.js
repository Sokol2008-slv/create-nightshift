// ==========================================================================
// «/smena» — справка смены одним экраном (финальный аудит 06.10.2026: «у каждой системы своя команда, общей
// справки нет»). Строки кликабельные: клик вставляет команду в чат (suggest_command) — Enter, и готово.
//   /smena          — все разделы коротко: раздел строкой, наведи на команду — что делает
//   /smena full     — подробно, каждая команда строкой
//   /smena keys [N] — раскладка смены: разделы строкой (наведи — что делает), N — раздел подробно
// Подсказка «/smena — все команды» приходит один раз каждому (тег ns_help_hint), через минуту после входа,
// чтобы не теряться в стене текста при входе.
// KubeJS 2101 / Rhino: только var; тела обработчиков — в try.
// ==========================================================================

// [команда для вставки, как показать, что делает]
var NS_HELP = [
	['Цели и рецепты', [
		['', 'J', 'планшет инженера: поиск предмета, цепочка до сырья, чем делать'],
		['/pin ', '/pin [N]', 'закрепить предмет из руки себе; P над предметом в JEI — то же'],
		['/pin team ', '/pin team [N]', 'цель смены для всех (Shift + P)'],
		['/unpin', '/unpin [team]', 'убрать свои закрепы (team — цель смены)'],
	]],
	['Набеги и арена', [
		['', 'ПКМ по алтарю', 'пульт алтаря: волны, досье, старт набега'],
		['/nightshift call', '/nightshift call', 'принять ночной вызов (в сумерки); /nightshift call no — отказаться'],
		['/nightshift altar', '/nightshift altar', 'во время набега — к алтарю и обратно'],
		['/arena', '/arena', 'на арену и обратно; /arena endless — «Выживание» на рекорд'],
		['/nightshift dossier ', '/nightshift dossier <N>', 'досье волны N: мобы, угрозы, чем бить, босс'],
		['/nscontracts', '/nscontracts', 'контракты смены: задания на набег и награды'],
		['/nsart', '/nsart', 'артефакты смены: что надето и что даёт'],
	]],
	['Карта и база', [
		['/atlas', '/atlas', 'месторождения форпостов: ближайшее каждого вида, клик — метка'],
		['/veins ', '/veins [тип]', 'жилы руды с аэрофотоаппарата (/veins железо)'],
		['/outposts', '/outposts', 'сеть форпостов: что стоит и работает'],
		['/journal', '/journal [N]', 'журнал смены: что было, пока тебя не было'],
		['/factory', '/factory', 'фактории: заказы и жетоны смены'],
		['/axsupply status', '/axsupply status', 'ранец снабжения: привязка, заряд, дальность'],
		['/axdrone', '/axdrone', 'твои дроны; /axdrone recall — все домой'],
	]],
	['Развлечения', [
		['/trader', '/trader', 'где странствующий снабженец и до когда'],
		['/race list', '/race list', 'гонки по кольцам: трассы, старт; /race top — рекорды'],
		['/tir', '/tir', 'тир на арене; /tir top — рекорды'],
		['/aeroclub', '/aeroclub', 'аэроклуб: налёт и удостоверения пилота'],
	]],
	['Связь', [
		['/idea ', '/idea <текст>', 'предложить идею сборке (пишется в копилку)'],
	]],
]

// Клавиши — раскладка смены: NS_KEYS_GROUPS в 31_keys.js (генерирует tools/keys_scheme.py, ставит всем аддон)

function nsHelpLine(srv, name, cmd, show, what) {
	var parts = [{ text: ' ▸ ', color: 'dark_gray' }]
	if (cmd) {
		parts.push({
			text: show,
			color: 'yellow',
			clickEvent: { action: 'suggest_command', value: cmd },
			hoverEvent: { action: 'show_text', contents: 'Клик — вставить в чат' },
		})
	} else {
		parts.push({ text: show, color: 'aqua' })
	}
	parts.push({ text: ' — ' + what, color: 'gray' })
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify(parts))
}

// Коротко (по умолчанию): раздел — одной строкой, команды «фишками»; навёл — что делает, клик — в чат.
function nsHelpShow(p) {
	var name = String(p.getUsername())
	var srv = p.getServer()
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: '— Смена: команды (наведи — что делает, клик — в чат) —', color: 'gold' }))
	for (var s = 0; s < NS_HELP.length; s++) {
		var parts = [{ text: NS_HELP[s][0] + ': ', color: 'gold' }]
		var rows = NS_HELP[s][1]
		for (var r = 0; r < rows.length; r++) {
			if (r) parts.push({ text: ' · ', color: 'dark_gray' })
			var chip = { text: rows[r][1], color: rows[r][0] ? 'yellow' : 'aqua', hoverEvent: { action: 'show_text', contents: rows[r][1] + ' — ' + rows[r][2] } }
			if (rows[r][0]) chip.clickEvent = { action: 'suggest_command', value: rows[r][0] }
			parts.push(chip)
		}
		srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify(parts))
	}
	srv.runCommandSilent(
		'tellraw ' +
			name +
			' ' +
			JSON.stringify([
				{ text: 'Списком с пояснениями — ', color: 'dark_gray' },
				{ text: '/smena full', color: 'yellow', clickEvent: { action: 'run_command', value: '/smena full' } },
				{ text: ', клавиши — ', color: 'dark_gray' },
				{ text: '/smena keys', color: 'yellow', clickEvent: { action: 'run_command', value: '/smena keys' } },
				{ text: '. Частые вопросы — книга (L).', color: 'dark_gray' },
			])
	)
}

// Подробно: каждая команда — строкой с пояснением
function nsHelpFull(p) {
	var name = String(p.getUsername())
	var srv = p.getServer()
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: '— Смена: команды подробно (клик — вставить в чат) —', color: 'gold' }))
	for (var s = 0; s < NS_HELP.length; s++) {
		srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: NS_HELP[s][0], color: 'gold', bold: true }))
		var rows = NS_HELP[s][1]
		for (var r = 0; r < rows.length; r++) nsHelpLine(srv, name, rows[r][0], rows[r][1], rows[r][2])
	}
}

// Раскладка смены (07.10): коротко — раздел строкой, клавиши «фишками» (наведи — что делает), клик по разделу —
// подробно; /smena keys N — раздел N строками.
function nsHelpKeys(p, gi) {
	var name = String(p.getUsername())
	var srv = p.getServer()
	var G = NS_KEYS_GROUPS
	if (gi !== null && gi >= 0 && gi < G.length) {
		srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: '— ' + G[gi][0] + ' —', color: 'gold' }))
		for (var r = 0; r < G[gi][1].length; r++) nsHelpLine(srv, name, '', G[gi][1][r][0], G[gi][1][r][1])
		return
	}
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: '— Раскладка смены v' + NS_KEYS_VERSION + ': одна на всех (наведи — что делает, клик по разделу — подробно) —', color: 'gold' }))
	for (var i = 0; i < G.length; i++) {
		var parts = [{ text: G[i][0] + ': ', color: 'gold', clickEvent: { action: 'run_command', value: '/smena keys ' + (i + 1) }, hoverEvent: { action: 'show_text', contents: 'Подробно: /smena keys ' + (i + 1) } }]
		for (var k = 0; k < G[i][1].length; k++) {
			if (k) parts.push({ text: ' · ', color: 'dark_gray' })
			parts.push({ text: G[i][1][k][0], color: 'aqua', hoverEvent: { action: 'show_text', contents: G[i][1][k][0] + ' — ' + G[i][1][k][1] } })
		}
		srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify(parts))
	}
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: 'Сбилась раскладка — /nskeys apply или «Сброс» в «Управлении». Таблица — docs/KEYS.md в репозитории пака.', color: 'gray' }))
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var IA = event.arguments.INTEGER
	var reg = function (lit) {
		event.register(
			C.literal(lit)
				.executes(ctx => {
					try {
						var p = ctx.source.getPlayer()
						if (p) nsHelpShow(p)
					} catch (e) {
						console.warn('[help] ' + e)
					}
					return 1
				})
				.then(
					C.literal('full').executes(ctx => {
						try {
							var p = ctx.source.getPlayer()
							if (p) nsHelpFull(p)
						} catch (e) {
							console.warn('[help] ' + e)
						}
						return 1
					})
				)
				.then(
					C.literal('keys')
						.executes(ctx => {
							try {
								var p = ctx.source.getPlayer()
								if (p) nsHelpKeys(p, null)
							} catch (e) {
								console.warn('[help] ' + e)
							}
							return 1
						})
						.then(
							C.argument('n', IA.create(event)).executes(ctx => {
								try {
									var p = ctx.source.getPlayer()
									if (p) nsHelpKeys(p, Number(IA.getResult(ctx, 'n')) - 1)
								} catch (e) {
									console.warn('[help] ' + e)
								}
								return 1
							})
						)
				)
		)
	}
	reg('smena')
	reg('ns')
})

// Одна подсказка каждому — через минуту после входа (не в стене текста журнала и атласа)
var NS_HELP_DUE = {} // ник → тик, когда показать подсказку (hud/ грузится раньше raids/: NSG здесь ещё нет)
PlayerEvents.loggedIn(event => {
	try {
		var p = event.getPlayer()
		if (p.getTags().contains('ns_help_hint')) return
		NS_HELP_DUE[String(p.getUsername())] = Number(event.server.getTickCount()) + 1200
	} catch (e) {}
})
var nsHelpTick = 0
ServerEvents.tick(event => {
	if (++nsHelpTick % 100 !== 0) return
	try {
		var now = Number(event.server.getTickCount())
		for (var name in NS_HELP_DUE) {
			if (NS_HELP_DUE[name] > now) continue
			delete NS_HELP_DUE[name]
			var p = event.server.getPlayerList().getPlayerByName(name)
			if (!p) continue
			p.addTag('ns_help_hint')
			event.server.runCommandSilent(
				'tellraw ' +
					name +
					' ' +
					JSON.stringify([
						{ text: '[Смена] ', color: 'gold' },
						{ text: 'Все команды сборки одним экраном — ', color: 'gray' },
						{ text: '/smena', color: 'yellow', underlined: true, clickEvent: { action: 'run_command', value: '/smena' } },
						{ text: ' (клавиши — /smena keys).', color: 'gray' },
					])
			)
		}
	} catch (e) {
		console.warn('[help] подсказка: ' + e)
	}
})
