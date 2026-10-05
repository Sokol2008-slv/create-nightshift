// ==========================================================================
// «Вахта» — наши посохи: рецепты и действие по ПКМ (магия, 01.10). Предметы — startup_scripts/vahta/60_staffs.js.
//  - Посох молнии (заряд молнии 15-й волны + электрическая медь): молния в точку взгляда до 48 блоков —
//    первый враг на луче или блок; врагам в радиусе 2,5 от удара 14 урона магией и поджог на 3 с.
//    Молния «зрелищная» (setVisualOnly): не поджигает базу, не бьёт своих, не превращает свиней и жителей.
//  - Посох сплава (межпланетный сплав): ударная волна вокруг себя, радиус 10 — 30 урона магией, отброс и
//    замедление II на 3 с каждому врагу.
//  - Посох равновесия (стабилит): радиус 12 — своим +8 здоровья, регенерация II на 5 с, тушит огонь; врагам
//    16 урона магией и слабость II на 5 с.
// Враг — моб с тегом nightshift_raid (мобы набега) или любой монстр (интерфейс Enemy), кроме приручённых и
// призванных игроком (заклинания Iron's). Свои — игроки, големы (железные, снежные, Modular Golems), приручённые.
// Перезарядка — кулдаун предмета (белая шторка на иконке), каждое применение −1 прочности.
// Мана Iron's Spells: если мод стоит — посох тратит ману (без маны не сработает, игрок видит «Не хватает маны»).
// Нет мода или API не нашлось — работает только перезарядка (в лог одно предупреждение).
// Правило Rhino: только var. ItemEvents — не нативные события, но тело всё равно в try/catch: посох не должен
// ронять тик игрока.
// Проверено 01.10 на тест-сервере без игрока (стойка для брони вместо игрока): прицел по лучу, молния (без огня),
// урон 14/30/16, отброс, эффекты по UUID, лечение голема +8, свои/чужие (голем, корова, дикий волк), −1 прочности.
// Вживую не проверено: мана и перезарядка у настоящего игрока, строка над хотбаром.
// ==========================================================================
var NS_STAFF = {
	'nightshift:lightning_staff': { cd: 30, mana: 10, range: 48, radius: 2.5, damage: 14, fire: 3 },
	'nightshift:alloy_staff': { cd: 160, mana: 40, radius: 10, damage: 30, knock: 1.2 },
	'nightshift:balance_staff': { cd: 200, mana: 50, radius: 12, damage: 16, heal: 8 },
}
var NS_STAFF_MOB = Java.loadClass('net.minecraft.world.entity.Mob')
var NS_STAFF_ENEMY = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
var NS_STAFF_PLAYER = Java.loadClass('net.minecraft.world.entity.player.Player')
var NS_STAFF_GOLEM = Java.loadClass('net.minecraft.world.entity.animal.AbstractGolem')
var NS_STAFF_OWNABLE = Java.loadClass('net.minecraft.world.entity.OwnableEntity')
var NS_STAFF_LIVING = Java.loadClass('net.minecraft.world.entity.LivingEntity')
var NS_STAFF_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_STAFF_SLOT = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
// бренд: бордо #94243a и денежный зелёный #85bb65 — для частиц dust
var NS_STAFF_DUST_RED = 'minecraft:dust{color:[0.58,0.14,0.23],scale:1.6}'
var NS_STAFF_DUST_GREEN = 'minecraft:dust{color:[0.52,0.73,0.4],scale:1.6}'

// Iron's Spells: мана игрока (MagicData) и призванные заклинаниями мобы (IMagicSummon)
var NS_STAFF_MAGIC = null
var NS_STAFF_SUMMON = null
try {
	NS_STAFF_MAGIC = Java.loadClass('io.redspace.ironsspellbooks.api.magic.MagicData')
	NS_STAFF_SUMMON = Java.loadClass('io.redspace.ironsspellbooks.entity.mobs.IMagicSummon')
} catch (e) {
	console.warn('[nightshift] посохи: API Iron\'s Spells не найдено — посохи без маны, только перезарядка: ' + e)
}

ServerEvents.recipes(function (event) {
	// Посох молнии: 2 электрической меди, громоотвод, 2 эссенции волшебства, 2 медных стержня C&A
	// (05.10, аудит: раньше брал заряд молнии — единственный ключ к электромеди: собрал посох — потерял ключ)
	event.recipes.create.mechanical_crafting('nightshift:lightning_staff', [
		'ECE',
		'ARA',
		' R '
	], {
		E: 'nightshift:electric_copper',
		C: 'minecraft:lightning_rod',
		A: 'irons_spellbooks:arcane_essence',
		R: 'createaddition:copper_rod'
	}).id('nightshift:vahta/staffs/lightning_staff')
	// Посох сплава: 2 межпланетных сплава, волшебный слиток, 2 латунных стержня
	event.recipes.create.mechanical_crafting('nightshift:alloy_staff', [
		'XIX',
		' R ',
		' R '
	], {
		X: 'axiomativ:interplanetary_alloy',
		I: 'irons_spellbooks:arcane_ingot',
		R: 'createaddition:brass_rod'
	}).id('nightshift:vahta/staffs/alloy_staff')
	// Посох равновесия: 2 слитка стабилита, божественная жемчужина, 2 эссенции, 2 золотых стержня
	event.recipes.create.mechanical_crafting('nightshift:balance_staff', [
		'SPS',
		'ARA',
		' R '
	], {
		S: 'kubejs:stabilite_ingot',
		P: 'irons_spellbooks:divine_pearl',
		A: 'irons_spellbooks:arcane_essence',
		R: 'createaddition:gold_rod'
	}).id('nightshift:vahta/staffs/balance_staff')
})

function nsStaffSay(player, text, color) {
	try {
		player.setStatusMessage(color === 'red' ? Text.red(text) : Text.gold(text))
	} catch (e) {}
}

// Первый сработавший из вариантов имени метода: KubeJS 2101 переименовывает часть ванильных
// (getStringUUID → getStringUuid, см. scares/10_scares.js). undefined — ни одного нет.
function nsStaffCall(obj, names) {
	for (var i = 0; i < names.length; i++) {
		try {
			var f = obj[names[i]]
			if (typeof f === 'function') return f.call(obj)
		} catch (e) {}
	}
	return undefined
}

// игрок или его подопечный: голем, приручённый, призванный игроком
function nsStaffAlly(ent) {
	if (ent == null || !ent.isAlive()) return false
	if (ent instanceof NS_STAFF_PLAYER) return !ent.isSpectator()
	if (ent instanceof NS_STAFF_ENEMY && !(ent instanceof NS_STAFF_OWNABLE)) {
		// монстр без хозяина — не свой, кроме призванных игроком (заклинания Iron's)
		if (NS_STAFF_SUMMON && ent instanceof NS_STAFF_SUMMON) return nsStaffCall(ent, ['getSummoner']) instanceof NS_STAFF_PLAYER
		return false
	}
	if (ent instanceof NS_STAFF_GOLEM) return true
	if (ent instanceof NS_STAFF_OWNABLE) return nsStaffCall(ent, ['getOwnerUUID', 'getOwnerUuid']) != null
	return false
}

// моб набега или монстр, не подопечный игрока
function nsStaffEnemy(ent) {
	if (ent == null || !ent.isAlive() || !(ent instanceof NS_STAFF_MOB)) return false
	var raid = false
	try {
		raid = ent.getTags().contains('nightshift_raid')
	} catch (e) {}
	if (!raid && !(ent instanceof NS_STAFF_ENEMY)) return false
	return !nsStaffAlly(ent)
}

// живые сущности в шаре радиуса r вокруг точки
function nsStaffAround(level, x, y, z, r) {
	var out = []
	var list = level.getEntitiesWithin(new NS_STAFF_AABB(x - r, y - r, z - r, x + r, y + r, z + r))
	for (var i = 0; i < list.size(); i++) {
		var e = list.get(i)
		if (!(e instanceof NS_STAFF_LIVING)) continue
		var dx = e.getX() - x,
			dy = e.getY() + e.getBbHeight() / 2 - y,
			dz = e.getZ() - z
		if (dx * dx + dy * dy + dz * dz <= r * r) out.push(e)
	}
	return out
}

// урон магией от имени игрока (добыча и опыт — как за убийство игроком; магия идёт мимо брони).
// Ванильного hurt в Rhino KubeJS 2101 нет — attack(источник, урон) из KubeJS (проверено на тест-сервере 01.10).
var nsStaffHurtWarned = false
function nsStaffHurt(player, ent, amount) {
	try {
		ent.attack(player.damageSources().indirectMagic(player, player), amount)
	} catch (e) {
		if (!nsStaffHurtWarned) console.warn('[nightshift] посохи: урон от игрока не прошёл, бьём без источника: ' + e)
		nsStaffHurtWarned = true
		ent.attack(amount)
	}
}

// эффект по UUID через команду — не зависит от имён классов эффектов в Rhino
function nsStaffEffect(player, ent, effect, seconds, amp) {
	var id = nsStaffCall(ent, ['getStringUuid', 'getStringUUID'])
	if (id) player.server.runCommandSilent('effect give ' + id + ' ' + effect + ' ' + seconds + ' ' + amp + ' true')
}

function nsStaffCmd(player, cmd) {
	player.server.runCommandSilent('execute in ' + String(player.level.getDimension()) + ' run ' + cmd)
}

function nsStaffAt(x, y, z) {
	return ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2)
}

// кольцо частиц на высоте y вокруг (x, z)
function nsStaffRing(player, particle, x, y, z, r, n) {
	for (var i = 0; i < n; i++) {
		var a = (Math.PI * 2 * i) / n
		nsStaffCmd(player, 'particle ' + particle + nsStaffAt(x + Math.cos(a) * r, y, z + Math.sin(a) * r) + ' 0.1 0.1 0.1 0 2 force')
	}
}

// мана Iron's: true — можно колдовать (и мана уже списана)
function nsStaffMana(player, cost) {
	if (!NS_STAFF_MAGIC || player.isCreative()) return true
	try {
		var md = NS_STAFF_MAGIC.getPlayerMagicData(player)
		var have = md.getMana()
		if (have < cost) {
			nsStaffSay(player, 'Не хватает маны: ' + Math.floor(have) + ' из ' + cost, 'red')
			return false
		}
		md.setMana(have - cost) // клиент увидит на ближайшем тике восстановления маны (раз в 0,5 с)
		return true
	} catch (e) {
		console.warn('[nightshift] посохи: мана Iron\'s не читается, дальше только перезарядка: ' + e)
		NS_STAFF_MAGIC = null
		return true
	}
}

// −1 прочности; сломался — исчез (как инструмент)
function nsStaffWear(player, hand, stack) {
	if (player.isCreative()) return
	try {
		stack.hurtAndBreak(1, player, String(hand) === 'OFF_HAND' ? NS_STAFF_SLOT.OFFHAND : NS_STAFF_SLOT.MAINHAND)
	} catch (e) {
		var d = stack.getDamageValue() + 1
		if (d >= stack.getMaxDamage()) stack.shrink(1)
		else stack.setDamageValue(d)
	}
}

// точка удара молнии: первый враг на луче взгляда (ближе блока) или блок; ничего — конец луча
function nsStaffAim(player, range) {
	var eye = player.getEyePosition()
	var look = player.getLookAngle()
	var dist = range
	var hit = player.pick(range, 0, false)
	if (hit != null && String(hit.getType()) === 'BLOCK') dist = eye.distanceTo(hit.getLocation())
	var ex = eye.x + look.x * dist,
		ey = eye.y + look.y * dist,
		ez = eye.z + look.z * dist
	var box = new NS_STAFF_AABB(Math.min(eye.x, ex) - 2, Math.min(eye.y, ey) - 2, Math.min(eye.z, ez) - 2, Math.max(eye.x, ex) + 2, Math.max(eye.y, ey) + 2, Math.max(eye.z, ez) + 2)
	var list = player.level.getEntitiesWithin(box)
	var best = null,
		bestT = dist
	for (var i = 0; i < list.size(); i++) {
		var e = list.get(i)
		if (!nsStaffEnemy(e)) continue
		var cx = e.getX() - eye.x,
			cy = e.getY() + e.getBbHeight() / 2 - eye.y,
			cz = e.getZ() - eye.z
		var t = cx * look.x + cy * look.y + cz * look.z
		if (t <= 0 || t > bestT) continue
		var px = cx - look.x * t,
			py = cy - look.y * t,
			pz = cz - look.z * t
		var rad = Math.max(e.getBbWidth(), e.getBbHeight()) / 2 + 0.4
		if (px * px + py * py + pz * pz > rad * rad) continue
		best = e
		bestT = t
	}
	if (best) return { x: best.getX(), y: best.getY(), z: best.getZ() }
	return { x: ex, y: ey, z: ez }
}

function nsStaffLightning(player, cfg) {
	var p = nsStaffAim(player, cfg.range)
	var level = player.level
	// только вспышка и гром (visualOnly): огня и урона от самой молнии нет, урон — ниже, только врагам
	try {
		level.spawnLightning(p.x, p.y, p.z, true, player)
	} catch (e) {
		try {
			level.spawnLightning(p.x, p.y, p.z, true)
		} catch (e2) {
			nsStaffCmd(player, 'particle minecraft:flash' + nsStaffAt(p.x, p.y + 1, p.z) + ' 0 0 0 0 1 force')
		}
	}
	nsStaffCmd(player, 'particle minecraft:electric_spark' + nsStaffAt(p.x, p.y + 1, p.z) + ' 1.2 1.2 1.2 0.3 60 force')
	var n = 0
	var list = nsStaffAround(level, p.x, p.y + 1, p.z, cfg.radius)
	for (var i = 0; i < list.length; i++) {
		if (!nsStaffEnemy(list[i])) continue
		nsStaffHurt(player, list[i], cfg.damage)
		try {
			list[i].igniteForSeconds(cfg.fire)
		} catch (e) {}
		n++
	}
	return n
}

function nsStaffShockwave(player, cfg) {
	var level = player.level
	var x = player.getX(),
		y = player.getY(),
		z = player.getZ()
	var n = 0
	var list = nsStaffAround(level, x, y + 1, z, cfg.radius)
	for (var i = 0; i < list.length; i++) {
		var e = list[i]
		if (!nsStaffEnemy(e)) continue
		nsStaffHurt(player, e, cfg.damage)
		try {
			e.knockback(cfg.knock, x - e.getX(), z - e.getZ())
		} catch (er) {}
		nsStaffEffect(player, e, 'minecraft:slowness', 3, 1)
		n++
	}
	// волна: два кольца бордо и зелёного, хлопок
	nsStaffRing(player, NS_STAFF_DUST_RED, x, y + 0.3, z, cfg.radius * 0.5, 16)
	nsStaffRing(player, NS_STAFF_DUST_GREEN, x, y + 0.3, z, cfg.radius, 28)
	nsStaffCmd(player, 'particle minecraft:explosion' + nsStaffAt(x, y + 0.5, z) + ' 2 0.2 2 0 6 force')
	nsStaffCmd(player, 'playsound minecraft:entity.warden.sonic_boom player @a' + nsStaffAt(x, y, z) + ' 1.5 1.3')
	return n
}

function nsStaffBalance(player, cfg) {
	var level = player.level
	var x = player.getX(),
		y = player.getY(),
		z = player.getZ()
	var hit = 0,
		healed = 0
	var list = nsStaffAround(level, x, y + 1, z, cfg.radius)
	for (var i = 0; i < list.length; i++) {
		var e = list[i]
		if (nsStaffEnemy(e)) {
			nsStaffHurt(player, e, cfg.damage)
			nsStaffEffect(player, e, 'minecraft:weakness', 5, 1)
			nsStaffCmd(player, 'particle minecraft:enchanted_hit' + nsStaffAt(e.getX(), e.getY() + 1, e.getZ()) + ' 0.3 0.5 0.3 0.1 8 force')
			hit++
		} else if (nsStaffAlly(e)) {
			e.heal(cfg.heal)
			try {
				e.clearFire()
			} catch (er) {}
			nsStaffEffect(player, e, 'minecraft:regeneration', 5, 1)
			nsStaffCmd(player, 'particle minecraft:heart' + nsStaffAt(e.getX(), e.getY() + e.getBbHeight() + 0.3, e.getZ()) + ' 0.3 0.2 0.3 0 3 force')
			healed++
		}
	}
	nsStaffRing(player, 'minecraft:end_rod', x, y + 0.2, z, cfg.radius, 32)
	nsStaffRing(player, NS_STAFF_DUST_GREEN, x, y + 1.2, z, cfg.radius * 0.6, 20)
	nsStaffCmd(player, 'playsound minecraft:block.beacon.power_select player @a' + nsStaffAt(x, y, z) + ' 1.2 1.4')
	return { hit: hit, healed: healed }
}

function nsStaffUse(event) {
	var id = String(event.item.getId())
	var cfg = NS_STAFF[id]
	if (!cfg) return
	var player = event.player
	if (!player || event.level.isClientSide()) return
	var used = false
	try {
		var cd = player.getCooldowns()
		if (cd.isOnCooldown(event.item.getItem())) return
		if (!nsStaffMana(player, cfg.mana)) {
			cd.addCooldown(event.item.getItem(), 10) // чтобы сообщение не сыпалось при зажатой ПКМ
			return
		}
		if (id === 'nightshift:lightning_staff') {
			var n = nsStaffLightning(player, cfg)
			if (n > 0) nsStaffSay(player, 'Молния: задето ' + n)
		} else if (id === 'nightshift:alloy_staff') {
			nsStaffSay(player, 'Ударная волна: задето ' + nsStaffShockwave(player, cfg))
		} else {
			var r = nsStaffBalance(player, cfg)
			nsStaffSay(player, 'Равновесие: вылечено ' + r.healed + ', задето врагов ' + r.hit)
		}
		cd.addCooldown(event.item.getItem(), cfg.cd)
		nsStaffWear(player, event.hand, event.item)
		used = true
	} catch (e) {
		console.error('[nightshift] посох ' + id + ' у ' + player.username + ': ' + e)
	}
	// cancel() выходит из обработчика исключением — поэтому вне try и последним (как у ядерного заряда)
	if (used) event.cancel()
}

for (var nsStaffId in NS_STAFF) ItemEvents.rightClicked(nsStaffId, nsStaffUse)
