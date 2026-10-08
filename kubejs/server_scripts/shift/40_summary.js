// ==========================================================================
// «Сводка смены» (07.10.2026, идея №2 финального аудита: «утром — одна кликабельная строка вместо разрозненных
// объявлений»). Каждое игровое утро каждому в сети — одна строка (длинная — две): заказы факторий (сколько сдано и
// сколько до срока), метеорит (остывает / ждём сегодня), снабженец (у базы / придёт утром), что ждёт ночью (ночной
// вызов этой ночи), контракты бригадира; в первый день недели — работник недели (shift/45_board.js).
// Наведи на пункт — подробности, клик — нужная команда. Чат она сокращает: всё дневное — одной строкой.
//  - Когда: время суток 400…12000 (утро и день) и не во время набега (дождётся конца). Кто зашёл позже — получит её
//    через 8 с после входа (после журнала смены), один раз за игровой день. Рассказать нечего — не шлём.
//  - Объявления событий в свой час остаются. Убран только утренний дубль: напоминание снабженца над хотбаром при
//    входе, если следом придёт сводка (zabava/10_trader.js спрашивает nsSumLoginDue).
//  - /svodka — сводка сейчас (в любое время суток), /svodka meteor — где метеорит и метка для карты.
//    Оператор: /svodka log — собрать и напечатать в лог сервера (проверка без клиента), /svodka reset — разослать
//    сегодняшнюю сводку заново.
// Читает: FactoryApi.listJson() аддона (factory/10_factories.js: NSF_API), nsSkyState (метеорит), nsTrState
// (снабженец), nsCallWaveFor / nsCallTwistFor (вызов этой ночи — тот же, что предложит алтарь в сумерки),
// nsCtBoard (контракты), nsBoardSummaryChip (работник недели).
// Состояние — server.persistentData «ns_summary_json»: {day — последний день рассылки, got: {ник: день}}.
// KubeJS 2101 / Rhino: только var; тела обработчиков — в try.
// ==========================================================================

var NS_SUM = { from: 400, to: 12000, loginDelay: 160 }
var NS_SUM_KEY = 'ns_summary_json'
var NS_SUM_SINCE = {} // ник → тик сервера, когда вошёл (в памяти)
var NS_SUM_DESC = {} // id предмета → ключ перевода
var NS_SUM_DIR = { 'Север': 'С', 'Северо-Восток': 'СВ', 'Восток': 'В', 'Юго-Восток': 'ЮВ', 'Юг': 'Ю', 'Юго-Запад': 'ЮЗ', 'Запад': 'З', 'Северо-Запад': 'СЗ' }

function nsSumState() {
	if (NSG.nsSum) return NSG.nsSum
	var st = { day: -1, got: {} }
	try {
		var pd = NSG.nsServer.persistentData
		if (pd.contains(NS_SUM_KEY)) st = Object.assign(st, JSON.parse(String(pd.getString(NS_SUM_KEY))))
	} catch (e) {
		console.warn('[сводка] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsSum = st
	return st
}
function nsSumSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_SUM_KEY, JSON.stringify(nsSumState()))
	} catch (e) {}
}
function nsSumClock() {
	var t = 0
	try {
		t = Number(NSG.nsServer.getOverworld().getDayTime())
	} catch (e) {}
	return { day: Math.floor(t / 24000), tod: t % 24000 }
}
function nsSumRaidBusy() {
	try {
		var rs = nsGetStateRO()
		return rs.raid.state === 'countdown' || rs.raid.state === 'active'
	} catch (e) {
		return false
	}
}

// Игровое время: «1 д 3 ч» (short — «1д3ч»)
function nsSumGame(ticks, short) {
	ticks = Math.max(0, Math.round(ticks))
	var d = Math.floor(ticks / 24000),
		h = Math.floor((ticks % 24000) / 1000)
	if (!d && !h) return short ? '<1ч' : 'меньше часа'
	if (short) return (d ? d + 'д' : '') + (h ? h + 'ч' : '')
	return (d ? d + ' д' : '') + (d && h ? ' ' : '') + (h ? h + ' ч' : '')
}
// То же в реальных минутах: «≈ 23 мин»
function nsSumReal(ticks) {
	var m = Math.round(Math.max(0, ticks) / 1200)
	if (m < 1) return '≈ 1 мин'
	if (m < 60) return '≈ ' + m + ' мин'
	return '≈ ' + Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин'
}
function nsSumPlural(n, one, few, many) {
	var m10 = n % 10,
		m100 = n % 100
	if (m10 === 1 && m100 !== 11) return n + ' ' + one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few
	return n + ' ' + many
}
// Название предмета — ключом перевода (у игрока покажется по-русски)
function nsSumItem(id) {
	if (NS_SUM_DESC[id] === undefined) {
		var key = null
		try {
			key = String(Item.of(id).getItem().getDescriptionId())
		} catch (e) {}
		NS_SUM_DESC[id] = key && key !== 'block.minecraft.air' ? key : null
	}
	return NS_SUM_DESC[id] ? { translate: NS_SUM_DESC[id] } : { text: id }
}
function nsSumT(text, color) {
	return { text: String(text), color: color || 'white' }
}

// --------------------------------------------------------------------------
// Пункты сводки. Пункт: {text, color, extra?, hover: [компоненты], click?: {action, value}, plain}
// --------------------------------------------------------------------------

// Заказы факторий: «Заказы: С 45 %·1д3ч, Ю 0 %·2д»
function nsSumFactories() {
	if (typeof NSF_API === 'undefined' || !NSF_API) return null
	var list = JSON.parse(String(NSF_API.listJson()))
	if (!list || !list.length) return null
	var extra = []
	var plain = []
	var hover = [nsSumT('Заказы факторий\n', 'gold')]
	var any = false
	for (var i = 0; i < list.length; i++) {
		var f = list[i]
		hover.push(nsSumT('«' + f.name + '» ', 'yellow'), nsSumT(f.dist + ' бл. ' + f.dir + ' от алтаря\n', 'gray'))
		var o = f.order
		if (!o) {
			hover.push(nsSumT('   ждёт нового заказа\n', 'dark_gray'))
			continue
		}
		any = true
		var need = 0,
			have = 0
		for (var l = 0; l < o.lines.length; l++) {
			need += o.lines[l].need
			have += Math.min(o.lines[l].have, o.lines[l].need)
		}
		var pct = need ? Math.floor((have * 100) / need) : 0
		var tag = (NS_SUM_DIR[f.name] || String(f.name).substring(0, 3)) + ' ' + pct + ' %·' + nsSumGame(o.left, true) + (o.urgent ? '!' : '')
		if (extra.length) extra.push(nsSumT(', ', 'gray'))
		extra.push(nsSumT(tag, o.urgent ? 'red' : pct > 0 ? 'green' : 'white'))
		plain.push(tag)
		var title = o.title && String(o.title).indexOf('Заказ №') !== 0 ? ' «' + o.title + '»' : ''
		hover.push(nsSumT('   №' + o.no + title + (o.urgent ? ' — СРОЧНЫЙ, плата ×2' : '') + ': сдано ' + pct + ' %, до срока ' + nsSumGame(o.left) + ' (' + nsSumReal(o.left) + '), плата ' + nsSumPlural(o.reward, 'жетон', 'жетона', 'жетонов') + '\n', o.urgent ? 'red' : 'white'))
		for (var k = 0; k < o.lines.length; k++) {
			var ln = o.lines[k]
			hover.push(nsSumT('     ' + Math.min(ln.have, ln.need) + '/' + ln.need + ' ', ln.have >= ln.need ? 'green' : 'gray'), Object.assign(nsSumItem(ln.id), { color: 'aqua' }), nsSumT('\n'))
		}
	}
	// итоги заказов за сутки — из журнала сдачи (shift/45_board.js, аддон с FactoryApi.drainJson)
	var fo = null
	try {
		if (typeof nsBoardFactOutcomes === 'function' && typeof nsBrdDay === 'function') fo = nsBoardFactOutcomes(nsBrdDay() - 1)
	} catch (e) {}
	if (fo && fo.done + fo.failed > 0) {
		var tag2 = (fo.done ? '✔' + fo.done : '') + (fo.done && fo.failed ? ' ' : '') + (fo.failed ? '✖' + fo.failed : '')
		if (extra.length) extra.push(nsSumT(', ', 'gray'))
		extra.push(nsSumT('за сутки ' + tag2, fo.failed && !fo.done ? 'red' : 'green'))
		plain.push('за сутки ' + tag2)
		hover.push(nsSumT('За сутки: закрыто ' + fo.done + (fo.tokens ? ' (+' + nsSumPlural(fo.tokens, 'жетон', 'жетона', 'жетонов') + ')' : '') + ', сгорело ' + fo.failed + '\n', 'gold'))
		for (var q = 0; q < fo.lines.length; q++) hover.push(nsSumT('   ' + fo.lines[q] + '\n', fo.lines[q].indexOf('сгорел') >= 0 ? 'red' : 'green'))
		any = true
	}
	if (!any) return null
	hover.push(nsSumT('Сдать — в терминал фактории (руками, лентой, поездом). Клик — /factory', 'dark_gray'))
	return { text: 'Заказы: ', color: 'gold', extra: extra, hover: hover, click: { action: 'run_command', value: '/factory' }, plain: 'Заказы: ' + plain.join(', ') }
}

// Метеорит: остывает (где, сколько), падает, или ждём сегодня
function nsSumMeteor(clk, rs) {
	if (typeof nsSkyState !== 'function') return null
	var st = nsSkyState()
	var m = st.m
	if (m) {
		var dx = m.x - m.ax,
			dz = m.z - m.az
		var dist = Math.round(Math.sqrt(dx * dx + dz * dz))
		var alive = Math.max(0, (m.guards || 0) - (m.killed || 0))
		var hot = m.stage === 'hot'
		var text = hot ? 'Метеорит: ' + Math.max(1, Math.round((m.left || 0) / 60)) + ' мин' : 'Метеорит падает!'
		return {
			text: text,
			color: 'gold',
			hover: [
				nsSumT('Метеорит: ', 'gold'),
				nsSumT(m.x + ' ' + m.y + ' ' + m.z, 'yellow'),
				nsSumT(' — ' + dist + ' бл. от базы на ' + nsSkyCompass(dx, dz) + '\n', 'gray'),
				nsSumT(hot ? 'Остынет через ' + Math.max(1, Math.round((m.left || 0) / 60)) + ' мин (на время набега — пауза), потом руда тускнеет в камень.\n' : 'Удар через несколько секунд.\n'),
				nsSumT(alive > 0 ? 'Стража: ' + alive + ' из ' + m.guards + ' — пока жива, руда под щитом.\n' : 'Стража пала — руда открыта.\n', alive > 0 ? 'red' : 'green'),
				nsSumT('Долю с каждого блока руды получает каждый в 32 блоках от кратера. Пешком не успеть — летите.\n', 'gray'),
				nsSumT('Клик — координаты, стрелка и метка для карты', 'dark_gray'),
			],
			click: { action: 'run_command', value: '/svodka meteor' },
			plain: text + ' (остывает, ' + m.x + ' ' + m.y + ' ' + m.z + ')',
		}
	}
	var due = !!st.search || !!st.bonus || (st.nextDay >= 0 && clk.day >= st.nextDay && (rs.phase || 0) >= NS_SKY.minPhase)
	if (!due) return null
	var today = clk.tod <= NS_SKY.dayTo
	var t2 = today ? 'Метеорит — сегодня днём' : 'Метеорит — завтра днём'
	return {
		text: t2,
		color: 'gold',
		hover: [nsSumT('Метеорит упадёт ' + (today ? 'сегодня' : 'завтра') + ' днём в 400–900 блоках от алтаря базы.\n', 'gold'), nsSumT('Титр, координаты и метка для карты придут сами. Держите самолёт заправленным: остывает 20 минут, стража держит щит над рудой.', 'gray')],
		plain: t2,
	}
}

// Снабженец: у базы (до когда) или придёт этим утром
function nsSumTrader(clk) {
	if (typeof nsTrState !== 'function') return null
	var st = nsTrState()
	var v = st.v
	if (v) {
		var left = Math.max(0, Math.round((v.leaveAt - nsTrNow()) / 1000))
		return {
			text: 'Снабженец у базы',
			color: 'green',
			hover: [nsSumT(v.name, 'gold'), nsSumT(' — ' + v.x + ' ' + v.y + ' ' + v.z + ', ещё ' + left + ' ч (' + nsSumReal(left * 1000) + '), лотов ' + v.lots + '.\n'), nsSumT('Только то, чего машинами не сделать: пластинки, шаблоны, книги, живность, ящик снабжения. Валюта — жетоны смены.\n', 'gray'), nsSumT('Клик — /trader: где он и сколько идти', 'dark_gray')],
			click: { action: 'run_command', value: '/trader' },
			plain: 'Снабженец у базы (' + v.name + ', ещё ' + left + ' ч)',
		}
	}
	if (st.nextDay >= 0 && clk.day >= st.nextDay && clk.tod < NS_TR.morningTo) {
		return {
			text: 'Снабженец придёт утром',
			color: 'green',
			hover: [nsSumT('Снабженец придёт к алтарю базы этим утром, когда кто-нибудь будет у базы (не во время набега). Стоит сутки.\n', 'white'), nsSumT('Клик — /trader', 'dark_gray')],
			click: { action: 'run_command', value: '/trader' },
			plain: 'Снабженец придёт утром',
		}
	}
	return null
}

// Что ждёт ночью: ночной вызов этой ночи (алтарь предложит в сумерки ту же волну — выбор по номеру дня)
function nsSumCall(clk, rs) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	if (!T || !T.nightCall || typeof nsCallWaveFor !== 'function') return null
	if ((rs.phase || 0) < (T.nightCallFrom || 3) || !nsHomeAltar(rs)) return null
	var c = rs.call
	if (c && c.day === clk.day) {
		var off = typeof nsCallOffer === 'function' ? nsCallOffer(rs) : null
		if (off)
			return {
				text: 'Вызов ждёт: волна ' + off.wave,
				color: 'red',
				hover: [nsSumT(nsCallText(off) + '\n'), nsSumT('Клик — вставить /nightshift call (Enter — принять)', 'dark_gray')],
				click: { action: 'suggest_command', value: '/nightshift call' },
				plain: 'Вызов ждёт: волна ' + off.wave,
			}
		var done = { accepted: 'Вызов принят', won: 'Вызов выигран', lost: 'Вызов не удался', declined: 'От вызова отказались' }[c.status]
		return done ? { text: done, color: 'gray', hover: [nsSumT('Ночной вызов этой ночи — ' + nsDifficultyName(c.wave) + '. Следующий — следующей ночью.', 'gray')], plain: done } : null
	}
	var w = nsCallWaveFor(rs.phase || 0, clk.day)
	if (!w) return null
	var mut = nsCallTwistFor(clk.day, w)
	var hover = [
		nsSumT('Ночью алтарь предложит вызов: ', 'gold'),
		nsSumT(nsDifficultyName(w) + ', 3 подволны, условие «' + nsCallMutName(mut) + '».\n'),
		nsSumT('Премия — артефакт смены наверняка; отказ и провал — без штрафа. Кнопки «Принять» придут в чат в сумерки.\n', 'gray'),
	]
	try {
		var poster = typeof nsMutPoster === 'function' ? nsMutPoster(rs) : []
		if (poster && poster.length)
			hover.push(nsSumT('Условия смены на сегодня (пульт алтаря): ' + poster.map(function (m) { return m.name }).join(', ') + '.\n', 'gray'))
	} catch (e) {}
	hover.push(nsSumT('Клик — досье волны: мобы, угрозы, чем бить', 'dark_gray'))
	return { text: 'Ночью вызов: волна ' + w, color: 'red', hover: hover, click: { action: 'run_command', value: '/nightshift dossier ' + w }, plain: 'Ночью вызов: волна ' + w + ' («' + nsCallMutName(mut) + '»)' }
}

// Контракты бригадира: сколько открыто, список — при наведении
function nsSumContracts(rs) {
	if (typeof nsCtBoard !== 'function' || !nsHomeAltar(rs)) return null // без алтаря набегов нет — и контракты ни к чему
	var list = nsCtBoard(nsGetState()) // как пульт алтаря: выполненные с рассветом меняются на новые
	if (!list || !list.length) return null
	var open = 0
	var hover = [nsSumT('Контракты бригадира\n', 'gold')]
	for (var i = 0; i < list.length; i++) {
		var c = list[i]
		if (!c.done) open++
		var prog = c.need > 1 ? ' — ' + Math.min(c.have || 0, c.need) + '/' + c.need : ''
		hover.push(nsSumT((c.done ? '✔ ' : '• ') + c.text + prog + '\n', c.done ? 'green' : 'white'))
	}
	hover.push(nsSumT('В работе — ' + open + ' из ' + list.length + '. Награда каждому в сети: артефакт смены и ресурсы. Клик — /nscontracts', 'dark_gray'))
	var text = open ? 'Контракты: ' + open : 'Контракты сданы'
	return { text: text, color: 'aqua', hover: hover, click: { action: 'run_command', value: '/nscontracts' }, plain: text }
}

function nsSumChipJson(c) {
	var o = { text: c.text, color: c.color || 'white' }
	if (c.extra && c.extra.length) o.extra = c.extra
	if (c.hover && c.hover.length) o.hoverEvent = { action: 'show_text', contents: [''].concat(c.hover) }
	if (c.click) o.clickEvent = c.click
	return o
}

// Сводка целиком: {json — для tellraw, plain — для лога, n — пунктов} или null, если рассказать нечего
function nsSumBuild() {
	var clk = nsSumClock()
	var rs = nsGetStateRO()
	var chips = []
	var add = function (what, fn) {
		try {
			var c = fn()
			if (c) chips.push(c)
		} catch (e) {
			console.warn('[сводка] ' + what + ': ' + e)
		}
	}
	add('фактории', function () {
		return nsSumFactories()
	})
	add('метеорит', function () {
		return nsSumMeteor(clk, rs)
	})
	add('снабженец', function () {
		return nsSumTrader(clk)
	})
	add('вызов', function () {
		return nsSumCall(clk, rs)
	})
	add('контракты', function () {
		return nsSumContracts(rs)
	})
	add('почёт', function () {
		return typeof nsBoardSummaryChip === 'function' ? nsBoardSummaryChip(clk.day) : null
	})
	if (!chips.length) return null
	var head = {
		text: '☀ День ' + clk.day,
		color: 'gold',
		hoverEvent: {
			action: 'show_text',
			contents: ['', nsSumT('Сводка смены на день ' + clk.day + '\n', 'gold'), nsSumT('Наведи на пункт — подробности, клик — команда.\n'), nsSumT('Показать ещё раз — /svodka. Клик — журнал смены (/journal).', 'gray')],
		},
		clickEvent: { action: 'run_command', value: '/journal' },
	}
	var parts = [{ text: '' }, head]
	var plain = ['День ' + clk.day]
	for (var i = 0; i < chips.length; i++) {
		parts.push({ text: ' · ', color: 'dark_gray' })
		parts.push(nsSumChipJson(chips[i]))
		plain.push(chips[i].plain || chips[i].text)
	}
	return { json: JSON.stringify(parts), plain: plain.join(' · '), n: chips.length }
}

// Придёт ли сводка этому игроку прямо сейчас (утро, ещё не получал) — снабженец не дублирует её над хотбаром
function nsSumLoginDue(name) {
	try {
		var clk = nsSumClock()
		if (clk.tod < NS_SUM.from || clk.tod >= NS_SUM.to) return false
		return nsSumState().got[String(name)] !== clk.day
	} catch (e) {
		return false
	}
}

// --------------------------------------------------------------------------
// Рассылка: раз в секунду — тем, кто сегодня её ещё не получал
// --------------------------------------------------------------------------
var nsSumTickN = 0
ServerEvents.tick(event => {
	if (++nsSumTickN % 20 !== 3) return
	try {
		if (!NSG.nsServer) return
		var ps = NSG.nsServer.getPlayers()
		if (!ps.length) return
		var clk = nsSumClock()
		if (clk.tod < NS_SUM.from || clk.tod >= NS_SUM.to) return
		if (nsSumRaidBusy()) return
		var st = nsSumState()
		var now = Number(event.server.getTickCount())
		var due = []
		for (var i = 0; i < ps.length; i++) {
			var n = String(ps[i].getUsername())
			if (st.got[n] === clk.day) continue
			var since = NS_SUM_SINCE[n]
			if (since !== undefined && now - since < NS_SUM.loginDelay) continue // сначала журнал смены
			due.push(n)
		}
		if (!due.length) return
		var sum = nsSumBuild()
		for (var j = 0; j < due.length; j++) {
			st.got[due[j]] = clk.day
			if (sum) NSG.nsServer.runCommandSilent('tellraw ' + due[j] + ' ' + sum.json)
		}
		for (var k in st.got) if (st.got[k] < clk.day - 1) delete st.got[k]
		st.day = clk.day
		nsSumSave()
		console.info('[сводка] день ' + clk.day + ' → ' + due.join(', ') + ': ' + (sum ? sum.plain : 'рассказать нечего'))
	} catch (e) {
		console.error('[сводка] рассылка: ' + e)
	}
})

PlayerEvents.loggedIn(event => {
	try {
		NS_SUM_SINCE[String(event.getPlayer().getUsername())] = Number(event.server.getTickCount())
	} catch (e) {}
})

// --------------------------------------------------------------------------
// Команды
// --------------------------------------------------------------------------
function nsSumMeteorCmd(src) {
	var st = typeof nsSkyState === 'function' ? nsSkyState() : null
	var m = st ? st.m : null
	if (!m) {
		var wait = st && st.nextDay >= 0 ? Math.max(0, st.nextDay - nsSumClock().day) : -1
		src.sendSystemMessage(Text.gold('[Метеорит] ').append(Text.gray(st && st.bonus ? 'Сейчас метеорита нет — внеочередной упадёт днём.' : wait > 0 ? 'Сейчас метеорита нет. Следующий — примерно через ' + nsSumPlural(wait, 'день', 'дня', 'дней') + ' (с 10-й волны).' : 'Сейчас метеорита нет.')))
		return 1
	}
	var line = Text.gold('[Метеорит] ').append(Text.white(m.stage === 'hot' ? 'Остывает в ' : 'Падает в ')).append(Text.yellow(m.x + ' ' + m.y + ' ' + m.z))
	var p = src.getPlayer()
	if (p && String(p.getLevel().getDimension()) === 'minecraft:overworld') {
		var dx = m.x - p.getX(),
			dz = m.z - p.getZ()
		line = line.append(Text.gray(' — ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл. на ' + nsSkyCompass(dx, dz) + ' от тебя'))
	}
	if (m.stage === 'hot') line = line.append(Text.gray(', остынет через ' + Math.max(1, Math.round((m.left || 0) / 60)) + ' мин.'))
	src.sendSystemMessage(line)
	// путевая точка Xaero: клиент сам превратит строку в кнопку «добавить» (как в объявлении метеорита)
	if (p) p.tell(Text.of('xaero-waypoint:Метеорит:М:' + m.x + ':' + m.y + ':' + m.z + ':6:false:0:Internal-overworld-waypoints'))
	return 1
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var op = function (s) {
		return s.hasPermission(2)
	}
	event.register(
		C.literal('svodka')
			.executes(ctx => {
				try {
					var p = ctx.source.getPlayer()
					var sum = nsSumBuild()
					if (!sum) ctx.source.sendSystemMessage(Text.gray('[Смена] Сводка пуста: ни заказов, ни событий, ни контрактов.'))
					else if (p) NSG.nsServer.runCommandSilent('tellraw ' + String(p.getUsername()) + ' ' + sum.json)
					else ctx.source.sendSystemMessage(Text.of(sum.plain))
				} catch (e) {
					console.error('[сводка] /svodka: ' + e)
				}
				return 1
			})
			.then(
				C.literal('meteor').executes(ctx => {
					try {
						return nsSumMeteorCmd(ctx.source)
					} catch (e) {
						console.error('[сводка] /svodka meteor: ' + e)
						return 0
					}
				})
			)
			// проверка без клиента: собрать и напечатать в лог (и JSON — им же пользуется tellraw)
			.then(
				C.literal('log')
					.requires(op)
					.executes(ctx => {
						try {
							var sum = nsSumBuild()
							var clk = nsSumClock()
							console.info('[сводка] проверка, день ' + clk.day + ', время ' + clk.tod + ': ' + (sum ? sum.plain : 'пусто'))
							if (sum) console.info('[сводка] JSON (' + sum.json.length + ' симв.): ' + sum.json)
							ctx.source.sendSystemMessage(Text.gray('[сводка] ' + (sum ? sum.n + ' пунктов: ' + sum.plain : 'пусто')))
						} catch (e) {
							console.error('[сводка] /svodka log: ' + e)
						}
						return 1
					})
			)
			.then(
				C.literal('reset')
					.requires(op)
					.executes(ctx => {
						nsSumState().got = {}
						nsSumSave()
						ctx.source.sendSystemMessage(Text.gray('[сводка] сегодняшняя придёт всем заново (если сейчас утро или день)'))
						return 1
					})
			)
	)
})

ServerEvents.loaded(event => {
	NSG.nsSum = null
})
