// ==========================================================================
// Ночная смена — добавки к Sanity: Renewed.
// 1) «Тьма убивает»: рассудок около нуля + темнота + нет света в руках →
//    урон магией раз в 2 с (броня не спасает), пока не выйдешь к свету.
// 2) Чем больше монстров рядом, тем быстрее уходит рассудок (сам мод
//    учитывает только «есть ли монстр рядом»).
// 3) Во время набега рассудок у игроков рядом с алтарём не падает: держится на уровне
//    начала набега (восстанавливаться может), без доп. безумия от толпы и без урона тьмы —
//    иначе посреди волн приходят «внутренние» мобы мода и убивают.
// Внутреннее значение мода — доля БЕЗУМИЯ: 0 = вменяем, 1 = безумен.
// ==========================================================================

var NS_SANITY = Java.loadClass('guivnf.sanity_renewed.capability.SanityHolder')
var NS_MONSTER = Java.loadClass('net.minecraft.world.entity.monster.Monster')

var NS_DARK_LIGHT = 1 // свет в точке игрока не выше этого — «тьма»
var NS_DARK_INSANITY = 0.97 // безумие от этого (рассудок ≤ 3%)
var NS_DARK_DAMAGE = 2
var NS_EXTRA_MOB_INSANITY = 0.0004 // за каждого монстра сверх первого, в секунду (+0,04%/с; 05.10 было 0,01 — толпа не чувствовалась)
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
var NS_RAID_SANITY_RANGE = 160 // блоков от алтаря — «участвует в набеге»
var nsRaidSanity = {} // имя → безумие на старте набега (выше не поднимается до конца набега)

// алтарь идущего набега или null
function nsRaidSanityAltar() {
	var st = nsGetStateRO()
	if (!nsRaidActive(st)) return null
	return nsFindAltar(st, st.raid.altarId)
}

function nsInRaidRange(p, altar) {
	if (!altar || String(p.getLevel().getDimension()) !== altar.dim) return false
	var dx = p.getX() - altar.x,
		dz = p.getZ() - altar.z
	return dx * dx + dz * dz <= NS_RAID_SANITY_RANGE * NS_RAID_SANITY_RANGE
}

// заморозка рассудка на время волн: раз в 5 тиков, только пока идёт набег
ServerEvents.tick(event => {
	if (nsSanityTick % 5 !== 0) return
	var altar = nsRaidSanityAltar()
	if (!altar) {
		nsRaidSanity = {}
		return
	}
	var players = event.server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		if (!nsInRaidRange(p, altar)) continue
		var cap = NS_SANITY.get(p)
		if (!cap) continue
		var name = String(p.getUsername())
		var cur = cap.getSanity()
		if (nsRaidSanity[name] === undefined || cur < nsRaidSanity[name]) nsRaidSanity[name] = cur
		else if (cur > nsRaidSanity[name]) cap.setSanity(nsRaidSanity[name])
	}
})

ServerEvents.tick(event => {
	nsSanityTick++
	if (nsSanityTick % 20 !== 0) return
	var darkCheck = nsSanityTick % 40 === 0
	var raidAltar = nsRaidSanityAltar()
	var players = event.server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		if (p.isSpectator() || p.isCreative()) continue
		if (nsInRaidRange(p, raidAltar)) continue // во время волн — см. заморозку выше
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
		if (p.persistentData.getLong('ns_scare_grace') > event.server.getTickCount()) continue // свет погасил скример (/scare lights)
		var name = p.getUsername()
		p.persistentData.putLong('ns_dark_hit', event.server.getTickCount()) // смерть от тьмы — см. sanity/40_death.js
		event.server.runCommandSilent('damage ' + name + ' ' + NS_DARK_DAMAGE + ' minecraft:magic')
		event.server.runCommandSilent('execute at ' + name + ' run playsound sanity_renewed:heartbeat ambient ' + name + ' ~ ~ ~ 1 0.7')
		p.setStatusMessage(Text.darkRed('Тьма сжимается… Нужен свет или таблетка'))
	}
})
