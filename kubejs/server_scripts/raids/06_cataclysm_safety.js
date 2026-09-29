// ==========================================================================
// Ночная смена — боссы L_Ender's Cataclysm не ломают базу (разбор: docs/research/cataclysm.md, раздел 3).
// gamerule mobGriefing не трогаем (глобальный). Вместо него — три события NeoForge:
//  - EntityMobGriefingEvent: мобам и снарядам мода — запрет (при ignore_mobgriefing=false в конфиге мод спрашивает это событие);
//  - ExplosionEvent.Detonate: взрывы мода (Игнис) без блоков и без огня;
//  - LivingDestroyBlockEvent: страховка — разрушение блоков сущностью мода отменяется.
// Конфиг мода: config/cataclysm-common.toml (ignore_mobgriefing=false, nature_heal=0, лава и гроза выключены).
// ==========================================================================
var NS_CM_GRIEF = Java.loadClass('net.neoforged.neoforge.event.entity.EntityMobGriefingEvent')
var NS_CM_DETONATE = Java.loadClass('net.neoforged.neoforge.event.level.ExplosionEvent$Detonate')
var NS_CM_DESTROY = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingDestroyBlockEvent')
var NS_CM_TYPES = Java.loadClass('net.minecraft.world.entity.EntityType')

function nsCmEntity(e) {
	try {
		return e != null && String(NS_CM_TYPES.getKey(e.getType()).getNamespace()) === 'cataclysm'
	} catch (x) {
		return false
	}
}

NativeEvents.onEvent(NS_CM_GRIEF, function (event) {
	if (nsCmEntity(event.getEntity())) event.setCanGrief(false)
})

NativeEvents.onEvent(NS_CM_DETONATE, function (event) {
	var ex = event.getExplosion()
	if (nsCmEntity(ex.getDirectSourceEntity()) || nsCmEntity(ex.getIndirectSourceEntity())) event.getAffectedBlocks().clear()
})

NativeEvents.onEvent(NS_CM_DESTROY, function (event) {
	if (nsCmEntity(event.getEntity())) event.setCanceled(true)
})
