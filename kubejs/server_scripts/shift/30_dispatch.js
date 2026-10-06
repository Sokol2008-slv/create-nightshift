// ==========================================================================
// Диспетчерская (аддон Axiomativ Industries 0.7.0) ↔ пак.
//  - Имена форпостов: экструдер на месторождении аддон видит сам (читает сеть форпостов state.outposts), а имя
//    («Солеварня», «Ледник») берёт отсюда — NS_OUTPOST_NAMES из raids/46_outpost_siege.js.
//  - Тревоги диспетчерской (форпост встал / снова работает, поезд сошёл с рельс, ток на исходе) — в журнал смены
//    (shift/10_journal.js, nsJournal), чтобы их видели и те, кого не было в игре. Пишет аддон, только если в мире
//    есть экран диспетчерской.
// Аддона нет (старый jar) — скрипт молчит. Правило Rhino: только var; тело обработчика — в try.
// ==========================================================================
var NS_DSP_API = null
try {
	NS_DSP_API = Java.loadClass('com.axiomativ.industries.content.dispatch.DispatchApi')
} catch (e) {
	console.info('[dispatch] аддона с диспетчерской нет — связь с паком выключена')
}

function nsDspNames() {
	if (!NS_DSP_API) return
	try {
		NS_DSP_API.outpostNames(JSON.stringify(NS_OUTPOST_NAMES))
	} catch (e) {
		console.warn('[dispatch] имена форпостов: ' + e)
	}
}

ServerEvents.loaded(function (event) {
	nsDspNames()
})

// «Чанк не загружен» (финальный аудит 06.10): форпост без загрузчика чанков «встаёт» каждый раз, когда все ушли,
// и «снова работает», когда кто-то пришёл. В журнал смены такая пара пишется ОДИН раз на объект за запуск сервера —
// иначе она вытесняла из 8 записей при входе настоящие события (волны, набеги, метеорит). Тост на экране — как был.
var NS_DSP_AWAY = {} // имя объекта → 1: последняя тревога была «чанк не загружен»
var NS_DSP_AWAY_LOGGED = {} // имя объекта → 1: про незагруженный чанк уже записали
function nsDspSite(text) {
	// «Форпост встал: Солеварня — чанк не загружен» / «Форпост снова работает: Солеварня»
	var s = String(text)
	var i = s.indexOf(': ')
	if (i < 0) return s
	s = s.substring(i + 2)
	var j = s.indexOf(' — ')
	return j < 0 ? s : s.substring(0, j)
}
function nsDspJournalSkip(lvl, text) {
	var site = nsDspSite(text)
	if (lvl === 'bad' && String(text).indexOf('чанк не загружен') >= 0) {
		NS_DSP_AWAY[site] = 1
		if (NS_DSP_AWAY_LOGGED[site]) return true
		NS_DSP_AWAY_LOGGED[site] = 1
		return false
	}
	if (lvl === 'ok' && NS_DSP_AWAY[site]) {
		delete NS_DSP_AWAY[site]
		return true // «снова работает» после «чанк не загружен» — просто кто-то пришёл
	}
	if (lvl === 'bad') delete NS_DSP_AWAY[site]
	return false
}

var nsDspTick = 0
ServerEvents.tick(function (event) {
	if (!NS_DSP_API) return
	try {
		if (++nsDspTick % 100 !== 0) return
		if (nsDspTick === 100) nsDspNames() // после /reload имена приходят заново
		var list = JSON.parse(String(NS_DSP_API.journal()))
		for (var i = 0; i < list.length; i++) {
			var lvl = list[i].lvl
			if (nsDspJournalSkip(lvl, list[i].text)) continue
			nsJournal('dispatch', (lvl === 'bad' ? '⚠ ' : lvl === 'ok' ? '✔ ' : '') + list[i].text, lvl === 'bad' ? 'red' : lvl === 'ok' ? 'green' : 'gray')
		}
	} catch (e) {
		console.warn('[dispatch] журнал: ' + e)
	}
})
