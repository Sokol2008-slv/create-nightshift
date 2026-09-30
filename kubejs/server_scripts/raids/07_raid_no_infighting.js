// ==========================================================================
// Ночная смена — мобы набега не дерутся друг с другом (30.09, Георгий: «на 6-й подволне пиглины и визер-скелеты
// поссорились и начали друг друга убивать»). У пиглинов врождённая вражда к визер-скелетам, скелеты мажут по своим,
// те в ответ злятся — орда выкашивала сама себя.
//  - LivingChangeTargetEvent: моб набега не выбирает целью другого моба набега (и «мозговые» пиглины тоже —
//    NeoForge шлёт это событие и из StartAttacking);
//  - LivingIncomingDamageEvent: моб набега не ранит другого (стрелы, взрыв крипера, клыки заклинателя).
// Метка набега — тег nightshift_raid (40_nightshift_raid.js).
// ВАЖНО (30.09, 20:38 — два падения основного сервера): исключение внутри нативного обработчика роняет сервер
// («Ticking entity»). У DamageSource в KubeJS 2101 нет getEntity() — горящий зомби уронил мир. Поэтому: тело каждого
// обработчика — в try/catch, методы источника урона — через nsNfAttacker (перебор имён).
// ==========================================================================
var NS_NF_TARGET = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingChangeTargetEvent')
var NS_NF_DAMAGE = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')

function nsNfRaid(e) {
	try {
		return e != null && e.getTags().contains('nightshift_raid')
	} catch (x) {
		return false
	}
}

// атакующий (владелец снаряда) или прямой источник урона; null — урон без сущности (огонь, падение, солнце)
function nsNfAttacker(src) {
	var names = ['getActual', 'getEntity', 'getImmediate', 'getDirectEntity']
	for (var i = 0; i < names.length; i++) {
		try {
			var f = src[names[i]]
			if (typeof f !== 'function') continue
			var e = f.call(src)
			if (e != null) return e
		} catch (x) {}
	}
	return null
}

NativeEvents.onEvent(NS_NF_TARGET, function (event) {
	try {
		var t = event.getNewAboutToBeSetTarget()
		if (t != null && nsNfRaid(t) && nsNfRaid(event.getEntity())) event.setCanceled(true)
	} catch (x) {}
})

NativeEvents.onEvent(NS_NF_DAMAGE, function (event) {
	try {
		var victim = event.getEntity()
		if (!nsNfRaid(victim)) return
		var by = nsNfAttacker(event.getSource())
		if (by != null && by !== victim && nsNfRaid(by)) event.setCanceled(true)
	} catch (x) {}
})
