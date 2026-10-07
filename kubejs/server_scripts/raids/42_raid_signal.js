// ==========================================================================
// Датчик набега и сирена (аддон Axiomativ Industries 0.7.0) ↔ набеги пака.
// Аддон не читает состояние набега сам — пак присылает ему короткую сводку (RaidSignalApi.sync):
//  - при каждом изменении набега: все изменения идут через nsSaveState (10_nightshift_state.js), там — вызов
//    nsRsigPush; отправляется, только если сводка поменялась (отсчёт, старт, подволна, мобы, победа, провал, отмена);
//  - раз в секунду — число живых мобов подволны (оно не в состоянии, его считает nsTickActiveRaid);
//  - раз в 5 с — та же сводка пульсом: без него аддон через 30 с считает, что набега нет (сломанный скрипт не оставит
//    двери базы закрытыми навсегда);
//  - при загрузке сервера — сразу: после перезапуска посреди набега датчики знают, что он идёт;
//  - победа — nsRsigVictory из nsRaidVictory (40_): импульс 5 с датчикам в режимах «победа» и «любой». Малый набег,
//    до алтаря которого дошли мобы, — не победа.
// Сводка: {s: idle|countdown|active|cooldown, kind: wave|minor|call|endless, where: base|arena|outpost, wave, cd,
//   sub, subs, loop, boss, left, paused, best, call}. Аддона нет (старый jar) — скрипт молчит.
// Правила Rhino: только var; тело обработчика — в try.
// ==========================================================================
var NS_RSIG_API = null
try {
	NS_RSIG_API = Java.loadClass('com.axiomativ.industries.content.raid.RaidSignalApi')
} catch (e) {
	console.info('[nightshift] датчик набега: аддона с датчиком нет — связь выключена')
}

// Подволн в набеге: из конфига орды (как полоса босса), один раз на набег
function nsRsigSubs(st) {
	var r = st.raid
	var key = String(r.rid || '') + '|' + String(r.kind) + '|' + String(r.difficulty)
	if (NSG.nsRsigSubsKey === key) return NSG.nsRsigSubsN
	var n = 0
	try {
		var hc = nsHordeCfg(st)
		n = hc && hc.waves ? hc.waves.length : 0
	} catch (e) {
		n = 0
	}
	NSG.nsRsigSubsKey = key
	NSG.nsRsigSubsN = n
	return n
}

function nsRsigSnapshot(st) {
	var r = st.raid || {}
	var s = String(r.state || 'idle')
	var o = { s: s, best: st.phase || 0 }
	if (s === 'countdown' || s === 'active') {
		o.kind = r.kind === 'minor' ? 'minor' : r.call ? 'call' : r.endless ? 'endless' : 'wave'
		o.wave = r.kind === 'minor' ? (typeof nsMinorWave === 'function' ? nsMinorWave(st.phase || 0) : 0) : r.difficulty || 0
		var arenaId = st.arena ? st.arena.altarId : null
		o.where = st.siege && st.siege.id === r.altarId ? 'outpost' : arenaId && arenaId === r.altarId ? 'arena' : 'base'
		if (r.paused) o.paused = true
	}
	if (s === 'countdown') o.cd = Math.max(0, Math.round(r.countdownRemaining || 0))
	if (s === 'active') {
		o.sub = Math.max(1, (r.waveIndex || 0) + 1)
		if (r.loops) o.loop = r.loops
		if (r.bossSpawned) o.boss = true
		o.subs = nsRsigSubs(st)
		var q = typeof nsQueuedCount === 'function' ? nsQueuedCount(st) : 0
		o.left = Math.max(0, (NSG.nsRaidAlive || 0) + q)
	}
	if (s === 'idle' && typeof nsCallOffer === 'function' && nsCallOffer(st)) o.call = true
	return o
}

// Отправить сводку аддону, если она поменялась (force — всегда). Пульс — не чаще раза в 5 с.
function nsRsigPush(st, force) {
	if (!NS_RSIG_API || !st || !NSG.nsServer) return
	try {
		var snap = JSON.stringify(nsRsigSnapshot(st))
		var now = Number(NSG.nsServer.getTickCount())
		if (!force && snap === NSG.nsRsigLast && now - (NSG.nsRsigAt || 0) < 100) return
		NSG.nsRsigLast = snap
		NSG.nsRsigAt = now
		NS_RSIG_API.sync(snap)
	} catch (e) {
		console.warn('[nightshift] датчик набега: сводка — ' + e)
	}
}

// Победа (из nsRaidVictory, 40_): raid — набег до сброса
function nsRsigVictory(raid) {
	if (!NS_RSIG_API || !raid) return
	try {
		if (raid.kind === 'minor' && (raid.reached || 0) > 0) return // малый набег прорвался к алтарю — не победа
		NS_RSIG_API.victory()
	} catch (e) {
		console.warn('[nightshift] датчик набега: победа — ' + e)
	}
}

ServerEvents.loaded(function (event) {
	try {
		NSG.nsServer = event.server
		nsRsigPush(nsGetStateRO(), true)
	} catch (e) {
		console.warn('[nightshift] датчик набега: сводка при загрузке — ' + e)
	}
})

// Раз в секунду: живые мобы подволны и пульс (сводка та же — отправится раз в 5 с)
var nsRsigTickN = 0
ServerEvents.tick(function (event) {
	if (!NS_RSIG_API || ++nsRsigTickN % 20 !== 7) return
	try {
		nsRsigPush(nsGetStateRO(), false)
	} catch (e) {
		console.warn('[nightshift] датчик набега: такт — ' + e)
	}
})
