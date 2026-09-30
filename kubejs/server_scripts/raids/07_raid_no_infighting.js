// ==========================================================================
// Ночная смена — мобы набега не дерутся друг с другом (30.09, Георгий: «на 6-й подволне пиглины и визер-скелеты
// поссорились и начали друг друга убивать»). У пиглинов врождённая вражда к визер-скелетам, скелеты мажут по своим,
// те в ответ злятся — орда выкашивала сама себя.
//  - LivingChangeTargetEvent: моб набега не выбирает целью другого моба набега (и «мозговые» пиглины тоже —
//    NeoForge шлёт это событие и из StartAttacking);
//  - LivingIncomingDamageEvent: моб набега не ранит другого (стрелы, взрыв крипера, клыки заклинателя).
// Метка набега — тег nightshift_raid (40_nightshift_raid.js).
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

NativeEvents.onEvent(NS_NF_TARGET, function (event) {
	var t = event.getNewAboutToBeSetTarget()
	if (t != null && nsNfRaid(t) && nsNfRaid(event.getEntity())) event.setCanceled(true)
})

NativeEvents.onEvent(NS_NF_DAMAGE, function (event) {
	var src = event.getSource()
	var by = src.getEntity() // стрелок/владелец снаряда, иначе сам атакующий
	if (by == null) by = src.getDirectEntity()
	if (by != null && by !== event.getEntity() && nsNfRaid(by) && nsNfRaid(event.getEntity())) event.setCanceled(true)
})
