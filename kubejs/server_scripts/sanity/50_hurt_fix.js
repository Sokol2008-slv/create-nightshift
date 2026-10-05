// ==========================================================================
// Рассудок за урон — только за урон, который реально прошёл (05.10.2026, Георгий: «в лаве, даже если урон не
// получаешь, менталка в 0 улетает»).
// Sanity: Renewed снимает рассудок на LivingIncomingDamageEvent (через Architectury LIVING_HURT). Это событие
// приходит на КАЖДЫЙ вызов hurt: лава и огонь бьют 20 раз в секунду, а урон проходит раз в полсекунды
// (неуязвимость после удара), плюс щит и артефакты гасят удары — мод списывал рассудок за всё подряд.
// Поэтому в конфиге мода hurt_ratio = 0, а здесь — тот же курс (−0,5 рассудка за 1 урона, с множителями мода через
// его же addSanity), но по LivingDamageEvent.Post: один раз на удар и ровно на прошедший урон.
// ==========================================================================
var NS_SAN_PROC = Java.loadClass('guivnf.sanity_renewed.SanityProcessor')
var NS_SAN_HOLDER = Java.loadClass('guivnf.sanity_renewed.capability.SanityHolder')
var NS_DMG_POST = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingDamageEvent$Post')
var NS_SAN_SPLAYER = Java.loadClass('net.minecraft.server.level.ServerPlayer')
var NS_HURT_SANITY = -0.5 // как было в config/sanity_renewed/default.toml (hurt_ratio)

NativeEvents.onEvent(NS_DMG_POST, function (event) {
	try {
		var p = event.getEntity()
		if (!(p instanceof NS_SAN_SPLAYER) || p.isCreative() || p.isSpectator()) return
		var dmg = Number(event.getNewDamage())
		if (!(dmg > 0)) return
		var cap = NS_SAN_HOLDER.get(p)
		if (cap) NS_SAN_PROC.addSanity(cap, dmg * NS_HURT_SANITY, p)
	} catch (e) {}
})
