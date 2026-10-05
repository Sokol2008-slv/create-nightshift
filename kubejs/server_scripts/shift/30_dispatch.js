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

var nsDspTick = 0
ServerEvents.tick(function (event) {
	if (!NS_DSP_API) return
	try {
		if (++nsDspTick % 100 !== 0) return
		if (nsDspTick === 100) nsDspNames() // после /reload имена приходят заново
		var list = JSON.parse(String(NS_DSP_API.journal()))
		for (var i = 0; i < list.length; i++) {
			var lvl = list[i].lvl
			nsJournal('dispatch', (lvl === 'bad' ? '⚠ ' : lvl === 'ok' ? '✔ ' : '') + list[i].text, lvl === 'bad' ? 'red' : lvl === 'ok' ? 'green' : 'gray')
		}
	} catch (e) {
		console.warn('[dispatch] журнал: ' + e)
	}
})
