// ==========================================================================
// Ночная смена — добавки к Sanity: Renewed.
// 1) «Тьма убивает»: рассудок около нуля + темнота + нет света в руках →
//    урон магией раз в 2 с (броня не спасает), пока не выйдешь к свету.
// 2) Чем больше монстров рядом, тем быстрее уходит рассудок (сам мод
//    учитывает только «есть ли монстр рядом»).
// Внутреннее значение мода — доля БЕЗУМИЯ: 0 = вменяем, 1 = безумен.
// ==========================================================================

var NS_SANITY = Java.loadClass('guivnf.sanity_renewed.capability.SanityHolder')
var NS_MONSTER = Java.loadClass('net.minecraft.world.entity.monster.Monster')

var NS_DARK_LIGHT = 1 // свет в точке игрока не выше этого — «тьма»
var NS_DARK_INSANITY = 0.97 // безумие от этого (рассудок ≤ 3%)
var NS_DARK_DAMAGE = 2
var NS_EXTRA_MOB_INSANITY = 0.0003 // за каждого монстра сверх первого, в секунду (+0,03%/с)
var NS_EXTRA_MOB_CAP = 10

var NS_LIGHT_ITEMS = [
	'minecraft:torch',
	'minecraft:soul_torch',
	'minecraft:lantern',
	'minecraft:soul_lantern',
	'minecraft:glowstone',
	'minecraft:sea_lantern',
	'minecraft:shroomlight',
	'minecraft:jack_o_lantern',
	'minecraft:end_rod',
	'minecraft:glow_berries',
	'minecraft:glow_ink_sac',
	'create:rose_quartz_lamp',
]

function nsLightInHands(player) {
	var hands = [player.getMainHandItem(), player.getOffHandItem()]
	for (var i = 0; i < hands.length; i++) {
		if (hands[i] && !hands[i].isEmpty() && NS_LIGHT_ITEMS.indexOf(String(hands[i].getId())) !== -1) return true
	}
	return false
}

var nsSanityTick = 0

ServerEvents.tick(event => {
	nsSanityTick++
	if (nsSanityTick % 20 !== 0) return
	var darkCheck = nsSanityTick % 40 === 0
	var players = event.server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		if (p.isSpectator() || p.isCreative()) continue
		var cap = NS_SANITY.get(p)
		if (!cap) continue

		// монстры сверх первого (куб 16×16×16, как у самого мода)
		var count = 0
		try {
			count = p.getLevel().getEntitiesOfClass(NS_MONSTER, p.getBoundingBox().inflate(8)).size()
		} catch (e) {}
		var extra = Math.min(NS_EXTRA_MOB_CAP, count - 1)
		if (extra > 0) cap.setSanity(Math.min(1.0, cap.getSanity() + extra * NS_EXTRA_MOB_INSANITY))

		if (!darkCheck || cap.getSanity() < NS_DARK_INSANITY) continue
		if (p.getBlock().getLight() > NS_DARK_LIGHT || nsLightInHands(p)) continue
		var name = p.getUsername()
		event.server.runCommandSilent('damage ' + name + ' ' + NS_DARK_DAMAGE + ' minecraft:magic')
		event.server.runCommandSilent('execute at ' + name + ' run playsound sanity_renewed:heartbeat ambient ' + name + ' ~ ~ ~ 1 0.7')
		p.setStatusMessage(Text.darkRed('Тьма сжимается… Нужен свет или таблетка'))
	}
})
