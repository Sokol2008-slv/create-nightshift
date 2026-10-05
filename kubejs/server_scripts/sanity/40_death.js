// ==========================================================================
// Ночная смена — цена смерти. Вещи остаются (keepInventory), но:
//  - каждая смерть — рана: −1 сердце максимального здоровья (до woundMax), лечит «Настойка жизни»;
//  - рассудок при возрождении не сбрасывается: какой был в момент смерти, такой и остаётся,
//    но не ниже deathSanityFloor (40%) — иначе ночью умирали бы по кругу.
//    Если убила тьма (рассудок около нуля, урон из 20_darkness.js) — даём немного сверху,
//    чтобы не умирать по кругу.
// Раны и проклятие алтаря применяет nsApplyPenalty (raids/10_nightshift_state.js).
//
// 05.10 (поток W, аудит: «из 49 смертей на Вахте 16 — падения, 8 — свои машины, 5 — союзники»; сердца просили вернуть
// 4 раза): рана — только за смерть от монстра (враждебный моб или моб набега, в том числе его стрела). Падение, лава,
// утопление, тьма, свои машины (пила, вентилятор, FakePlayer деплоера и турелей), союзники (игроки, дракон, големы,
// питомцы и призванные игроком) — без раны. Каждая победа в набеге затягивает одну рану (raids/40_, nsHealWoundsOnWin).
// ==========================================================================

var NS_TONIC_RESTORE = 1 // ран за одну настойку
var NS_DEATH_ENEMY = Java.loadClass('net.minecraft.world.entity.monster.Enemy')

// Смерть «от монстра»: враждебный моб (или его снаряд), не призванный игроком; моб набега — всегда
function nsDeathByMonster(src) {
	var by = null
	try {
		by = typeof nsNfAttacker === 'function' ? nsNfAttacker(src) : null
	} catch (e) {}
	if (by == null) return false
	try {
		if (by.isPlayer()) return false // другой игрок или FakePlayer машины
	} catch (e) {}
	try {
		if (by.getTags().contains('nightshift_raid')) return true
	} catch (e) {}
	if (!(by instanceof NS_DEATH_ENEMY)) return false
	try {
		var owner = by.getOwner ? by.getOwner() : null
		if (owner != null && owner.isPlayer()) return false // призван игроком
	} catch (e) {}
	return true
}

EntityEvents.death('minecraft:player', event => {
	var player = event.getEntity()
	var name = String(player.getUsername())
	var st = nsGetState()
	st.wounds = st.wounds || {}
	st.deathSanity = st.deathSanity || {}
	st.noWound = st.noWound || {}
	var wound = true
	try {
		wound = nsDeathByMonster(event.getSource())
	} catch (e) {}
	if (wound) {
		st.wounds[name] = Math.min(NSG.NIGHTSHIFT_TUNABLES.woundMax, (st.wounds[name] || 0) + 1)
		delete st.noWound[name]
	} else st.noWound[name] = true
	var dark = false
	try {
		var pd = player.persistentData
		dark = pd.contains('ns_dark_hit') && event.server.getTickCount() - pd.getLong('ns_dark_hit') < 60
	} catch (e) {}
	try {
		var cap = NS_SANITY.get(player)
		if (cap) st.deathSanity[name] = { v: cap.getSanity(), dark: dark }
	} catch (e) {}
	nsSaveState(st)
})

PlayerEvents.respawned(event => {
	var player = event.getEntity()
	var name = String(player.getUsername())
	var st = nsGetState()
	nsApplyPenalty(player)
	var ds = st.deathSanity ? st.deathSanity[name] : null
	if (ds) {
		try {
			var cap = NS_SANITY.get(player)
			var bump = ds.dark ? NSG.NIGHTSHIFT_TUNABLES.darknessDeathSanityBump : 0
			// безумие после смерти не выше 1 − пол рассудка: смерть не оставляет на нуле
			if (cap) cap.setSanity(Math.max(0, Math.min(1 - NSG.NIGHTSHIFT_TUNABLES.deathSanityFloor, ds.v - bump)))
		} catch (e) {}
		delete st.deathSanity[name]
		nsSaveState(st)
	}
	var w = (st.wounds || {})[name] || 0
	var noWound = !!(st.noWound && st.noWound[name])
	if (noWound) {
		delete st.noWound[name]
		nsSaveState(st)
	}
	if (noWound) player.tell(Text.gray('[Ночная смена] Смерть не от монстра — новой раны нет.' + (w > 0 ? ' Ран: ' + w + '.' : '')))
	else if (w > 0) {
		player.tell(
			Text.red('[Ночная смена] Рана: −' + w + ' серд. максимального здоровья. ')
				.append(Text.gray('Лечит «Настойка жизни» или победа в набеге (рана за победу). Рассудок после смерти не восстанавливается.'))
		)
	}
})

ItemEvents.foodEaten('nightshift:life_tonic', event => {
	var player = event.getEntity()
	if (!player || !player.isPlayer()) return
	var name = String(player.getUsername())
	var st = nsGetState()
	st.wounds = st.wounds || {}
	var w = st.wounds[name] || 0
	if (w <= 0) {
		player.tell(Text.gray('[Ночная смена] Ран нет — настойка ушла впустую.'))
		return
	}
	st.wounds[name] = Math.max(0, w - NS_TONIC_RESTORE)
	nsSaveState(st)
	nsApplyPenalty(player)
	player.tell(Text.green('[Ночная смена] Рана затянулась. ' + (st.wounds[name] > 0 ? 'Осталось ран: ' + st.wounds[name] + '.' : 'Здоровье восстановлено.')))
})

// Сердце ночи (только из набегов): +1 сердце максимума навсегда, до bonusHeartsMax
ItemEvents.foodEaten('nightshift:night_heart', event => {
	var player = event.getEntity()
	if (!player || !player.isPlayer()) return
	var name = String(player.getUsername())
	var st = nsGetState()
	st.bonusHearts = st.bonusHearts || {}
	var have = st.bonusHearts[name] || 0
	var max = NSG.NIGHTSHIFT_TUNABLES.bonusHeartsMax
	if (have >= max) {
		// уже предел — сердце не пропадает, возвращаем
		NSG.nsServer.runCommandSilent('give ' + name + ' nightshift:night_heart 1')
		player.tell(Text.gray('[Ночная смена] Больше ' + max + ' Сердец ночи не прижить — сердце вернулось в инвентарь. Отдайте его другу.'))
		return
	}
	st.bonusHearts[name] = have + 1
	nsSaveState(st)
	nsApplyPenalty(player)
	player.heal(2)
	NSG.nsServer.runCommandSilent('playsound minecraft:block.beacon.power_select player ' + name)
	player.tell(Text.lightPurple('[Ночная смена] Сердце ночи прижилось: +1 сердце навсегда (' + (have + 1) + '/' + max + ').'))
})

ServerEvents.recipes(event => {
	// Настойка жизни: мёд, светящиеся ягоды (пышные пещеры — туда ещё надо дойти), сладкие ягоды, костная мука и
	// целебные споры форпоста «Грибные пещеры» (04.10)
	var ing = ['minecraft:honey_bottle', 'minecraft:glow_berries', 'minecraft:sweet_berries', 'nightshift:spores', 'nightshift:spores', 'minecraft:bone_meal']
	// только миксер (вручную нельзя — так интереснее; и миксер больше не подхватывает ручной рецепт на 1 шт.)
	event.recipes.create.mixing('2x nightshift:life_tonic', ing).id('nightshift:life_tonic_mixing')
})
