// ==========================================================================
// «Атлас месторождений» ← разведка дрона (аддон Axiomativ Industries 0.7.0, поток R, 05.10.2026).
// Дрон в режиме «Разведка» раз в 5 с ищет месторождения форпостов в 64 блоках (тег axiomativ:drone_scan_deposits:
// nightshift:outpost_deposits + геотермальный источник и речной порог) и на каждый вид шлёт событие
// DroneDepositEvent (ближайшее за импульс). Здесь — запись в атлас через nsAtlasAdd (shift/20_atlas.js): атлас
// сам отсекает повторы ближе 64 блоков и сообщает всем «Найдено месторождение … — нашёл дрон игрока <хозяин>».
// Только верхний мир (как и атлас). Старый аддон без класса события — тихо пропускаем. Правило Rhino: только var.
// ==========================================================================
var NS_ATLAS_DRONE_EVENT = null
try {
	NS_ATLAS_DRONE_EVENT = Java.loadClass('com.axiomativ.industries.content.drone.DroneDepositEvent')
} catch (e) {
	console.warn('[atlas] дроны: класса DroneDepositEvent нет (аддон старше 0.7.0) — разведка дронов в атлас не пишет')
}

if (NS_ATLAS_DRONE_EVENT) {
	NativeEvents.onEvent(NS_ATLAS_DRONE_EVENT, function (e) {
		try {
			if (String(e.getDimensionId()) !== 'minecraft:overworld') return
			var id = String(e.getBlockId())
			if (typeof NS_ATLAS_DEPOSIT_IDS === 'undefined' || !NS_ATLAS_DEPOSIT_IDS[id]) return
			var who = String(e.getOwnerName() || '')
			nsAtlasAdd(id, Number(e.getX()), Number(e.getY()), Number(e.getZ()), who ? 'дрон игрока ' + who : 'дрон', true)
		} catch (x) {
			console.error('[atlas] находка дрона: ' + x)
		}
	})
}
