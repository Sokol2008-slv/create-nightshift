// ==========================================================================
// «/smena» — справка смены одним экраном (финальный аудит 06.10.2026: «у каждой системы своя команда, общей
// справки нет»). Строки кликабельные: клик вставляет команду в чат (suggest_command) — Enter, и готово.
//   /smena          — все разделы коротко: раздел строкой, наведи на команду — что делает
//   /smena full     — подробно, каждая команда строкой
//   /smena keys     — клавиши пака
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

var NS_HELP_KEYS = [
	['J', 'планшет инженера; Shift + J — панель целей: подробно / кратко / скрыта'],
	['P / Shift + P', 'над предметом — закрепить себе / цель смены'],
	['Shift + ПКМ пустой рукой', 'по машине — что она делает'],
	['L', 'книга квестов'],
	["' (Э)", 'ранец снабжения'],
	['Боковая кнопка мыши 5', 'метка команде; зажать — колесо меток'],
	['Alt + V / Alt + M', 'голосовой чат: меню / микрофон'],
	['Alt + B', 'новая метка Xaero'],
	['Alt + U', 'история смертей'],
	['Alt + K', 'шейдеры вкл/выкл'],
]

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

function nsHelpKeys(p) {
	var name = String(p.getUsername())
	var srv = p.getServer()
	srv.runCommandSilent('tellraw ' + name + ' ' + JSON.stringify({ text: '— Клавиши пака (переназначить: Настройки → Управление) —', color: 'gold' }))
	for (var i = 0; i < NS_HELP_KEYS.length; i++) nsHelpLine(srv, name, '', NS_HELP_KEYS[i][0], NS_HELP_KEYS[i][1])
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
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
					C.literal('keys').executes(ctx => {
						try {
							var p = ctx.source.getPlayer()
							if (p) nsHelpKeys(p)
						} catch (e) {
							console.warn('[help] ' + e)
						}
						return 1
					})
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
