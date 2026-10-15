// ==========================================================================
// Ночная смена — «НОЧНОЙ ВЫЗОВ» и «ВЫЖИВАНИЕ» на арене (05.10.2026, поток W).
//
// Ночной вызов — вместо малых набегов (их трижды гасили командой и 05.10 выключили: «монстры должны быть только по
// нашему выбору»). В сумерки (с 13000 тиков) алтарь сам ПРЕДЛАГАЕТ короткую волну из уже пройденных: 3 подволны
// (первая, средняя, последняя; босс — если волна с боссом) и одно случайное условие смены. Принять — кнопкой в чате,
// командой /nightshift call или «Старт» на этой волне в пульте алтаря. Премия победителям — артефакт смены наверняка
// (как с волны «лучшая + 5»), осколки орды и обычная добыча волны. Отказ (или просто не принять до рассвета) и
// провал — без штрафа: ни проклятия, ни ран от провала. Одно предложение за ночь, только пока набега нет.
// Включение — NIGHTSHIFT_TUNABLES.nightCall (00_), с какой пройденной волны — nightCallFrom.
// Тише (15.10, «меньше чата»): колокол, строка над хотбаром и кнопки в чате — только тем, кто в Верхнем мире ближе
// NS_CALL_NEAR блоков к алтарю базы; остальным ничего, а вернутся на базу ночью — тихая строка над хотбаром, один раз.
// Две ночи подряд без ответа (не приняли и не отказались) — вызовы на паузе, одна строка в журнал смены; вернуть —
// /nightshift call (сразу и принять, если ночь) или /nightshift call resume и строка в пульте (только снять паузу и
// предложить вызов этой ночи). Награды и сам вызов прежние.
//
// Выживание (/arena endless, только на арене): подволны лучшей обычной волны идут по кругу без конца, каждый круг
// орда на 15 % толще, на 8 % злее и на 10 % многочисленнее. Забег кончается, когда прочность алтаря кончилась
// (или /arena endless stop). Добыча — бросок за каждую пройденную подволну (до 40), артефакт смены за каждые 5,
// рекорд арены — всем в чат. Проклятия нет: арена — полигон.
// Хуки: nsStartRaid/nsHordeCfg/nsRaidVictory/nsRaidFail (40_), nsStartChallenge (50_), пульт и меню (16_, 30_).
// Правила Rhino: только var.
// ==========================================================================

var NS_CALL_TWISTS = ['double', 'glass', 'rage', 'bosses', 'champions', 'escalation', 'regen', 'blast', 'dark']
var NS_CALL_NEAR = 300 // блоков до алтаря базы (по горизонтали, Верхний мир): кому звонит колокол
var NS_CALL_IGNORE_MAX = 2 // ночей подряд без ответа — и вызовы на паузе

function nsCallDay() {
	try {
		var t = Number(NSG.nsServer.getOverworld().getDayTime())
		return { day: Math.floor(t / 24000), tod: t % 24000 }
	} catch (e) {
		return { day: 0, tod: 0 }
	}
}

function nsCallIsSpecial(w) {
	return !!(NSG.NS_SPECIAL_STAGES && NSG.NS_SPECIAL_STAGES[w])
}

// Волна вызова: из пройденных в окне [лучшая − 6, лучшая], без особых стадий; по номеру дня — разная
function nsCallWaveFor(best, day) {
	var c = []
	for (var w = Math.max(1, best - 6); w <= best; w++) if (!nsCallIsSpecial(w)) c.push(w)
	if (!c.length) return 0
	return c[Math.floor(nsMwRng(day * 31 + 7)() * c.length) % c.length]
}

function nsCallTwistFor(day, w) {
	var list = []
	for (var i = 0; i < NS_CALL_TWISTS.length; i++) {
		var k = NS_CALL_TWISTS[i]
		if (typeof nsMutFind === 'function' && !nsMutFind(k)) continue
		if (k === 'blast' && w < 18) continue // подрывники — с 18-й
		list.push(k)
	}
	return list.length ? list[Math.floor(nsMwRng(day * 53 + w * 7 + 1)() * list.length) % list.length] : null
}

// Предложение в силе: этой ночью, до рассвета, не принято и не отклонено
function nsCallOffer(st) {
	var c = st && st.call
	if (!c || c.status !== 'offer') return null
	var now = nsCallDay()
	if (c.day !== now.day || now.tod >= 23000 || now.tod < 12000) return null
	return c
}

function nsCallMutName(key) {
	var m = typeof nsMutFind === 'function' ? nsMutFind(key) : null
	return m ? m.name : 'без условий'
}

function nsCallText(c) {
	return 'Ночной вызов до рассвета: ' + nsDifficultyName(c.wave) + ', 3 подволны, условие «' + nsCallMutName(c.mut) + '». Премия — артефакт смены наверняка. Отказ и провал — без штрафа.'
}

function nsCallButtons() {
	return Text.green('[Принять]').clickRunCommand('/nightshift call').hover(Text.gray('Набег у алтаря базы (если вы на арене — у алтаря арены). Кто далеко — получит кнопку телепорта.')).append(Text.of(' ')).append(Text.gray('[Не сейчас]').clickRunCommand('/nightshift call no').hover(Text.gray('Без штрафа. Следующей ночью будет другой вызов.')))
}

// Есть кому предлагать (в сети хоть кто-то)
function nsCallAnyone() {
	return NSG.nsServer.getPlayers().length > 0
}

// Раз в секунду: в сумерки — предложение, к рассвету — снять
var nsCallTickN = 0
ServerEvents.tick(event => {
	try {
		if (++nsCallTickN % 20 !== 0) return
		var T = NSG.NIGHTSHIFT_TUNABLES
		if (!T.nightCall) return
		var now = nsCallDay()
		var st = nsGetStateRO()
		if (!st) return
		var c = st.call
		// просроченное предложение — тихо снять; вторая ночь подряд без ответа — вызовы на паузу
		if (c && c.status === 'offer' && (c.day !== now.day || now.tod >= 23000)) {
			var s1 = nsGetState()
			s1.call.status = 'expired'
			s1.callIgnored = (s1.callIgnored || 0) + 1
			if (s1.callIgnored >= NS_CALL_IGNORE_MAX && !s1.callPause) {
				s1.callPause = true
				if (typeof nsJournal === 'function') nsJournal('call', 'Ночные вызовы на паузе: ' + NS_CALL_IGNORE_MAX + ' ночи без ответа. Вернуть — /nightshift call или строка в пульте алтаря', 'gray')
				console.info('[nightshift] ночной вызов: ' + s1.callIgnored + ' ночи без ответа — на паузе')
			}
			nsSaveState(s1)
			return
		}
		// предложение в силе — тем, кто вернулся на базу, тихая строка над хотбаром (один раз за ночь)
		if (c && c.status === 'offer' && c.day === now.day) {
			nsCallQuietReminders(st, c)
			return
		}
		if (now.tod < 13000 || now.tod >= 21000) return
		if (c && c.day === now.day) return // этой ночью уже предлагали
		if (st.callPause) return // две ночи без ответа — ждём /nightshift call
		nsCallOfferNow(null)
	} catch (e) {
		console.error('[nightshift] ночной вызов: ' + e)
	}
})

// Предложить вызов этой ночи (тик в сумерки, /nightshift call resume). Возвращает предложение или null — нельзя:
// не ночь, набег, нет алтаря, волн мало, этой ночью уже было. who — кто снял паузу (ему строка с кнопками всегда).
function nsCallOfferNow(who, silent) {
	var T = NSG.NIGHTSHIFT_TUNABLES
	if (!T.nightCall) return null
	var now = nsCallDay()
	if (now.tod < 13000 || now.tod >= 21000) return null
	var st = nsGetStateRO()
	if (st.call && st.call.day === now.day) return null
	if (nsRaidActive(st) || (st.phase || 0) < (T.nightCallFrom || 3) || !nsHomeAltar(st)) return null
	if (!nsCallAnyone()) return null
	var w = nsCallWaveFor(st.phase || 0, now.day)
	if (!w) return null
	var s2 = nsGetState()
	s2.call = { day: now.day, wave: w, mut: nsCallTwistFor(now.day, w), status: 'offer' }
	nsSaveState(s2)
	var n = silent ? 0 : nsCallNotify(s2, s2.call, who)
	console.info('[nightshift] ночной вызов: волна ' + w + ', условие ' + s2.call.mut + '; у базы ' + n)
	return s2.call
}

// Кто у базы: Верхний мир (измерение алтаря базы), ближе NS_CALL_NEAR блоков по горизонтали
function nsCallNearBase(p, altar) {
	try {
		if (!altar || String(p.getLevel().getDimension()) !== (altar.dim || 'minecraft:overworld')) return false
		var dx = p.getX() - altar.x,
			dz = p.getZ() - altar.z
		return dx * dx + dz * dz <= NS_CALL_NEAR * NS_CALL_NEAR
	} catch (e) {
		return false
	}
}

// Кому уже сказали про вызов этой ночи (в памяти; перезапуск сервера — скажем ещё раз, не страшно)
function nsCallTold(c) {
	var key = c.day + ':' + c.wave
	if (!NSG.nsCallTold || NSG.nsCallTold.key !== key) NSG.nsCallTold = { key: key, names: {} }
	return NSG.nsCallTold.names
}

// 06.10 (финальный аудит): без титра на весь экран — строка над хотбаром и звук, кнопки — в чате.
// 15.10: только тем, кто у базы (и who — кто сам попросил). Возвращает, скольким сказали.
function nsCallNotify(st, c, who) {
	var altar = nsHomeAltar(st)
	var told = nsCallTold(c)
	var n = 0
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		var name = String(ps[i].getUsername())
		if (name !== who && !nsCallNearBase(ps[i], altar)) continue
		told[name] = 1
		n++
		try {
			ps[i].setStatusMessage(Text.gold('Ночной вызов: ').append(Text.yellow(nsDifficultyName(c.wave) + ' за премию')).append(Text.gray(' — кнопки в чате')))
			NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:block.bell.use ambient @s ~ ~ ~ 0.6 0.8')
		} catch (e2) {}
		ps[i].tell(Text.gold('[Ночная смена] ').append(Text.white(nsCallText(c) + ' ')).append(nsCallButtons()))
	}
	return n
}

// Вызов в силе, а кто-то только что вернулся на базу — тихая строка над хотбаром, без колокола и чата
function nsCallQuietReminders(st, c) {
	var altar = nsHomeAltar(st)
	var told = nsCallTold(c)
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		var name = String(ps[i].getUsername())
		if (told[name] || !nsCallNearBase(ps[i], altar)) continue
		told[name] = 1
		try {
			ps[i].setStatusMessage(Text.gold('Ночной вызов ждёт: ').append(Text.yellow(nsDifficultyName(c.wave))).append(Text.gray(' — /nightshift call или «Старт» в пульте')))
		} catch (e2) {}
	}
}

// Снять паузу вызовов (/nightshift call, /nightshift call resume, строка в пульте)
function nsCallResume(player) {
	var st = nsGetState()
	var was = !!st.callPause
	st.callPause = false
	st.callIgnored = 0
	nsSaveState(st)
	if (was) {
		var who = player ? String(player.getUsername()) : 'Смена'
		if (typeof nsJournal === 'function') nsJournal('call', 'Ночные вызовы снова включены (' + who + ')', 'gray')
		console.info('[nightshift] ночной вызов: пауза снята (' + who + ')')
	}
	return was
}

// Принять вызов: игрок на арене — у алтаря арены, иначе — у алтаря базы.
// Вызовы на паузе (две ночи без ответа): /nightshift call снимает паузу и, если ночь, сразу берёт вызов этой ночи.
function nsCallAccept(player) {
	var st = nsGetState()
	var c = nsCallOffer(st)
	if (!c && st.callPause) {
		nsCallResume(player)
		if (!nsCallOfferNow(player ? String(player.getUsername()) : null, true)) {
			if (player) player.tell(Text.gold('[Ночная смена] ').append(Text.white('Ночные вызовы снова включены — алтарь предложит вызов в сумерки.')))
			return 1
		}
		st = nsGetState()
		c = nsCallOffer(st)
	}
	if (!c) {
		if (player) player.tell(Text.gray('[Ночная смена] Сейчас вызова нет — алтарь предлагает его в сумерки, раз за ночь.'))
		return 0
	}
	if (nsRaidActive(st)) {
		if (player) player.tell(Text.gray('[Ночная смена] Идёт набег — вызов подождёт до его конца (до рассвета).'))
		return 0
	}
	var altar = null
	if (player && String(player.getLevel().getDimension()) === 'nightshift:arena' && st.arena && st.arena.altarId) altar = nsFindAltar(st, st.arena.altarId)
	if (!altar) altar = nsHomeAltar(st)
	if (!altar) return 0
	c.status = 'accepted'
	st.callIgnored = 0 // ответили — счёт ночей без ответа с нуля
	nsSaveState(st)
	nsStartRaid('challenge', altar.id, c.wave, { call: { wave: c.wave, mut: c.mut, day: c.day, best: st.phase || 0 }, countdown: NSG.NIGHTSHIFT_TUNABLES.nightCallCountdown || 20 })
	nsTellAll(Text.gold('[Ночная смена] ' + (player ? player.getUsername() + ' принимает' : 'Принят') + ' ночной вызов: ').append(Text.white(nsDifficultyName(c.wave) + ', условие «' + nsCallMutName(c.mut) + '»')))
	return 1
}

function nsCallDecline(player) {
	var st = nsGetState()
	var c = nsCallOffer(st)
	if (!c) return 0
	c.status = 'declined'
	st.callIgnored = 0 // отказ — тоже ответ, не «без ответа»
	nsSaveState(st)
	// 15.10: только тем, кому вызов предлагали (у базы), и тому, кто отказался
	var told = nsCallTold(c)
	var line = Text.gray('[Ночная смена] ' + (player ? player.getUsername() : 'Смена') + ' отказывается от вызова этой ночью — без штрафа.')
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) {
		var n = String(ps[i].getUsername())
		if (told[n] || (player && n === String(player.getUsername()))) ps[i].tell(line)
	}
	return 1
}

// /nightshift call resume и строка в пульте: снять паузу и, если ночь, предложить вызов этой ночи (не принимая)
function nsCallResumeCmd(player) {
	var was = nsCallResume(player)
	var who = player ? String(player.getUsername()) : null
	var off = nsCallOfferNow(who, false)
	if (off) return 1
	var cur = nsCallOffer(nsGetStateRO())
	if (cur && player) {
		player.tell(Text.gold('[Ночная смена] ').append(Text.white(nsCallText(cur) + ' ')).append(nsCallButtons()))
		return 1
	}
	if (player) player.tell(Text.gold('[Ночная смена] ').append(Text.white(was ? 'Ночные вызовы снова включены — алтарь предложит вызов в сумерки.' : 'Ночные вызовы включены — алтарь предлагает вызов в сумерки, раз за ночь.')))
	return 1
}

// «Старт» в пульте на волне вызова = принять вызов (50_: nsStartChallenge)
function nsCallMaybeStart(ctx, d) {
	var st = nsGetStateRO()
	var c = nsCallOffer(st)
	if (!c || c.wave !== d) return false
	nsCallAccept(ctx.source.getPlayer())
	return true
}

// Состав вызова: 3 подволны волны (первая, средняя, последняя), босс — как у волны
function nsCallHorde(cfg, state) {
	var out = {}
	for (var f in cfg) out[f] = cfg[f]
	var w = cfg.waves || []
	if (w.length > 3) out.waves = [w[0], w[Math.floor(w.length / 2)], w[w.length - 1]]
	out.name = 'Ночной вызов · ' + cfg.name
	return out
}

function nsCallWaves(raid) {
	return Math.min(3, nsChallengeHorde(raid.difficulty || 1).waves.length)
}

function nsCallRolls(raid) {
	var cfg = nsChallengeHorde(raid.difficulty || 1)
	return nsCallWaves(raid) + (cfg.boss ? 2 * (cfg.bossCount || 1) : 0)
}

// Премия: артефакт смены «как с волны лучшая + 5» и 4 осколка орды каждому, кто получил добычу
function nsCallPremium(raid, names) {
	var best = (raid.call && raid.call.best) || nsGetState().phase || 0
	var players = NSG.nsServer.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var n = String(players[i].getUsername())
		if (names.indexOf(n) < 0) continue
		var got = [['nightshift:horde_shard', 4, 'nightshift:horde_shard', 'премия вызова']]
		if (typeof nsCtArtifact === 'function') got = got.concat(nsCtArtifact(best + 5))
		nsGiveLoot(players[i], got)
	}
}

function nsCallDone(won) {
	var st = nsGetState()
	if (st.call) {
		st.call.status = won ? 'won' : 'lost'
		nsSaveState(st)
	}
	if (won && typeof nsContractsOnCall === 'function') nsContractsOnCall()
}

// --------------------------------------------------------------------------
// Выживание на арене
// --------------------------------------------------------------------------
NSG.NS_ENDLESS = { hpPerLoop: 0.15, dmgPerLoop: 0.08, multPerLoop: 0.1, maxRolls: 40, artEvery: 5, minBest: 5 }

// Волна забега: самая высокая пройденная без особой стадии
function nsEndlessWave(best) {
	for (var w = best; w >= 1; w--) if (!nsCallIsSpecial(w)) return w
	return 1
}

function nsEndlessHorde(cfg, state) {
	var E = NSG.NS_ENDLESS
	var L = state.raid.loops || 0
	var out = {}
	for (var f in cfg) out[f] = cfg[f]
	out.loop = true
	out.loopEvery = 0
	out.boss = null
	out.bossExtra = []
	out.special = null
	out.name = 'Выживание · ' + cfg.name
	var sc = {}
	for (var k in cfg.scale || {}) sc[k] = cfg.scale[k]
	sc.hp = (sc.hp || 0) + E.hpPerLoop * L
	sc.damage = (sc.damage || 0) + E.dmgPerLoop * L
	out.scale = sc
	out.mult = (cfg.mult || 1) * (1 + E.multPerLoop * L)
	return out
}

function nsEndlessSubs(raid) {
	var n = nsChallengeHorde(raid.difficulty || 1).waves.length
	return Math.max(0, (raid.loops || 0) * n + (raid.waveIndex || 0))
}

function nsEndlessStart(player) {
	var st = nsGetState()
	if (!st.arena || !st.arena.built || String(player.getLevel().getDimension()) !== 'nightshift:arena') {
		player.tell(Text.gray('[Ночная смена] Выживание — только на арене: /arena.'))
		return 0
	}
	if (nsRaidActive(st)) {
		player.tell(Text.gray('[Ночная смена] Алтарь занят набегом.'))
		return 0
	}
	var best = st.phase || 0
	if (best < NSG.NS_ENDLESS.minBest) {
		player.tell(Text.gray('[Ночная смена] Выживание откроется после ' + NSG.NS_ENDLESS.minBest + '-й волны.'))
		return 0
	}
	var w = nsEndlessWave(best)
	nsStartRaid('challenge', st.arena.altarId, w, { endless: { started: true }, countdown: 15 })
	var rec = st.arenaRecord
	nsTellAll(Text.gold('[Ночная смена] ' + player.getUsername() + ' начинает выживание на арене: ').append(Text.white(nsDifficultyName(w) + ' по кругу, каждый круг злее.')).append(Text.gray(rec ? ' Рекорд: ' + nsPlural(rec.subs, 'подволна', 'подволны', 'подволн') + ' (' + rec.names.join(', ') + ').' : ' Рекорда ещё нет.')))
	return 1
}

// Конец забега (прочность алтаря кончилась, «Железная воля» или /arena endless stop): добыча, рекорд, без проклятия
function nsEndlessFinish(state, mobs) {
	var raid = state.raid
	var E = NSG.NS_ENDLESS
	var altar = nsFindAltar(state, raid.altarId)
	var d = raid.difficulty || 1
	var subs = nsEndlessSubs(raid)
	var atAltar = nsParticipants(altar)
	for (var i = 0; mobs && i < mobs.length; i++) nsRemoveMob(mobs[i])
	if (raid.sp && typeof nsSpecialCleanup === 'function' && altar) nsSpecialCleanup(state, nsAltarLevel(altar))
	state.raid = nsDefaultState().raid
	state.raid.state = 'cooldown'
	state.raid.countdownRemaining = 10
	var names = []
	for (var a = 0; a < atAltar.length; a++) names.push(String(atAltar[a].getUsername()))
	var rec = state.arenaRecord
	var isRec = subs > 0 && (!rec || subs > rec.subs)
	if (isRec) state.arenaRecord = { subs: subs, wave: d, names: names, day: nsCallDay().day }
	nsSaveState(state)
	nsTry('откат арены', function () {
		if (typeof nsArenaHook === 'function') nsArenaHook('end', raid.altarId)
	})
	nsRaidEnded()
	nsBossbarRemove('nightshift:raid_countdown')
	nsBossbarRemove('nightshift:raid_wave')
	nsTitleAll('Выживание окончено', { color: 'gold', bold: true, subtitle: 'Пройдено: ' + nsPlural(subs, 'подволна', 'подволны', 'подволн') + (isRec ? ' — РЕКОРД!' : ''), subColor: isRec ? 'yellow' : 'gray' })
	if (isRec) {
		nsTellAll(Text.gold('[Ночная смена] Новый рекорд арены: ' + nsPlural(subs, 'подволна', 'подволны', 'подволн') + ' — ' + names.join(', ') + '!'))
		NSG.nsServer.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master @a')
	}
	console.info('[nightshift] выживание: волна ' + d + ', подволн ' + subs + (isRec ? ' (рекорд)' : ''))
	nsTry('доска почёта', function () {
		if (subs > 0 && typeof nsBoardOnEndless === 'function') nsBoardOnEndless(names, subs) // shift/45_board.js
	})
	if (subs > 0) {
		nsTry('добыча выживания', function () {
			var present = {}
			for (var n = 0; n < names.length; n++) present[names[n]] = subs // забег целиком — у всех, кто на арене
			nsRaidRewards(altar, d, Math.min(E.maxRolls, subs), false, present, subs, atAltar, {})
			var arts = Math.floor(subs / E.artEvery)
			for (var p = 0; p < atAltar.length && arts > 0; p++) {
				var got = []
				for (var r = 0; r < arts; r++) if (typeof nsCtArtifact === 'function') got = got.concat(nsCtArtifact(d + Math.floor(subs / 6)))
				if (got.length) nsGiveLoot(atAltar[p], got)
			}
		})
	}
	nsTry('возврат игроков', function () {
		var st = nsGetState()
		nsReturnAll(st)
		nsSaveState(st)
	})
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	event.register(
		C.literal('nightshift').then(
			C.literal('call')
				.executes(ctx => nsCallAccept(ctx.source.getPlayer()))
				.then(C.literal('no').executes(ctx => nsCallDecline(ctx.source.getPlayer())))
				.then(C.literal('resume').executes(ctx => nsCallResumeCmd(ctx.source.getPlayer())))
				// оператор: предложить вызов сейчас (проверка)
				.then(
					C.literal('offer')
						.requires(src => src.hasPermission(2))
						.executes(ctx => {
							var st = nsGetState()
							var now = nsCallDay()
							var w = nsCallWaveFor(st.phase || 0, now.day)
							if (!w) return 0
							if (now.tod < 13000 || now.tod >= 21000) NSG.nsServer.runCommandSilent('time set 13500')
							var n2 = nsCallDay()
							st.call = { day: n2.day, wave: w, mut: nsCallTwistFor(n2.day, w), status: 'offer' }
							nsSaveState(st)
							// как в сумерки: колокол и кнопки — тем, кто у базы (и оператору)
							var n = nsCallNotify(st, st.call, ctx.source.getPlayer() ? String(ctx.source.getPlayer().getUsername()) : null)
							ctx.source.sendSystemMessage(Text.gray('[nightshift] вызов предложен: волна ' + w + ', сказали ' + n + ' (у базы ближе ' + NS_CALL_NEAR + ' бл.)'))
							return 1
						})
				)
		)
	)
	event.register(
		C.literal('arena').then(
			C.literal('endless')
				.executes(ctx => {
					var p = ctx.source.getPlayer()
					return p ? nsEndlessStart(p) : 0
				})
				.then(
					C.literal('stop').executes(ctx => {
						var st = nsGetState()
						if (!st.raid || !st.raid.endless || !nsRaidActive(st)) return 0
						var altar = nsFindAltar(st, st.raid.altarId)
						var mobs = altar ? nsCollectRaidMobs(nsAltarLevel(altar), altar, nsTrackRadius(st)) || [] : []
						nsEndlessFinish(st, mobs)
						return 1
					})
				)
		)
	)
})
