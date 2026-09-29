// ==========================================================================
// «Вахта» — тактический ядерный заряд (Георгий, 30.09: «после руд — ядерное оружие, которое большую часть
// монстров убивает, дальше в основном заруба с боссами»).
//  - ПКМ зарядом: всем враждебным мобам и мобам набега в радиусе 48 — смерть; боссам (макс. здоровье ≥ 150)
//    — минус 35 % максимума. Игроков, големов, животных не трогает, БЛОКИ НЕ ЛОМАЕТ (кратер с восстановлением —
//    потом, в арене).
//  - Вспышка, гриб из частиц, грохот на всю округу; заряд тратится; перезарядка 60 с на игрока.
//  - Рецепт — механические крафтеры из руд наших планет (волна 70+: звёздная кирка) и радиоактивного тория.
// ==========================================================================
var NS_NUKE_RADIUS = 48
var NS_NUKE_BOSS_HP = 150 // с какого максимума здоровья моб считается боссом
var NS_NUKE_BOSS_CUT = 0.35
var NS_NUKE_COOLDOWN = 20 * 60
var NS_NUKE_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_NUKE_ENEMY = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
var NS_NUKE_MOB = Java.loadClass('net.minecraft.world.entity.Mob')

ServerEvents.recipes(event => {
	event.recipes.create.mechanical_crafting('nightshift:tactical_nuke', [
		'SAS',
		'ATA',
		'SRS'
	], {
		S: 'kubejs:stabilite_ingot',
		A: 'kubejs:axiomite_ingot',
		T: 'minecraft:tnt',
		R: 'create_new_age:radioactive_thorium'
	}).id('nightshift:vahta/tactical_nuke')
})

function nsNukeIsTarget(ent) {
	if (!ent || !ent.isAlive()) return false
	if (!(ent instanceof NS_NUKE_MOB)) return false
	var tags = ent.getTags()
	return ent instanceof NS_NUKE_ENEMY || tags.contains('nightshift_raid')
}

function nsNukeDetonate(player) {
	var level = player.level
	var x = player.x,
		y = player.y,
		z = player.z
	var r = NS_NUKE_RADIUS
	var list = level.getEntitiesWithin(new NS_NUKE_AABB(x - r, y - r, z - r, x + r, y + r, z + r))
	var killed = 0,
		bosses = 0
	for (var i = 0; i < list.size(); i++) {
		var ent = list.get(i)
		if (!nsNukeIsTarget(ent)) continue
		var dx = ent.getX() - x,
			dy = ent.getY() - y,
			dz = ent.getZ() - z
		if (dx * dx + dy * dy + dz * dz > r * r) continue
		var max = ent.getMaxHealth()
		if (max >= NS_NUKE_BOSS_HP) {
			var left = ent.getHealth() - max * NS_NUKE_BOSS_CUT
			if (left <= 0) ent.kill()
			else ent.setHealth(left)
			bosses++
		} else {
			ent.kill()
			killed++
		}
	}
	// вспышка, гриб и грохот — только эффекты, блоки целы
	var at = ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1)
	var srv = player.server
	var dim = String(level.getDimension())
	var ex = 'execute in ' + dim + ' run '
	srv.runCommandSilent(ex + 'particle minecraft:flash' + at + ' 6 6 6 0 40 force')
	srv.runCommandSilent(ex + 'particle minecraft:explosion_emitter' + at + ' 8 2 8 0 30 force')
	srv.runCommandSilent(ex + 'particle minecraft:campfire_signal_smoke ' + x.toFixed(1) + ' ' + (y + 6).toFixed(1) + ' ' + z.toFixed(1) + ' 2 12 2 0.02 400 force')
	srv.runCommandSilent(ex + 'particle minecraft:large_smoke ' + x.toFixed(1) + ' ' + (y + 18).toFixed(1) + ' ' + z.toFixed(1) + ' 10 3 10 0.05 400 force')
	srv.runCommandSilent(ex + 'playsound minecraft:entity.generic.explode master @a' + at + ' 16 0.5')
	srv.runCommandSilent(ex + 'playsound minecraft:entity.lightning_bolt.thunder master @a' + at + ' 16 0.6')
	srv.runCommandSilent(ex + 'playsound minecraft:entity.wither.death master @a' + at + ' 8 0.5')
	srv.runCommandSilent(ex + 'title @a[distance=..96] times 0 20 20')
	srv.runCommandSilent(ex + 'title @a[distance=..96] title {"text":"☢","color":"yellow","bold":true}')
	srv.runCommandSilent(ex + 'title @a[distance=..96] subtitle {"text":"Уничтожено: ' + killed + (bosses > 0 ? ', боссов задето: ' + bosses : '') + '","color":"gold"}')
	console.info('[nightshift] ядерный заряд ' + player.username + ' в ' + dim + at + ': убито ' + killed + ', боссов ' + bosses)
}

ItemEvents.rightClicked('nightshift:tactical_nuke', event => {
	var player = event.player
	if (!player || event.level.isClientSide()) return
	var cd = player.getCooldowns()
	if (cd.isOnCooldown(event.item.getItem())) return
	nsNukeDetonate(player)
	if (!player.isCreative()) event.item.shrink(1)
	cd.addCooldown(event.item.getItem(), NS_NUKE_COOLDOWN)
	event.cancel()
})
