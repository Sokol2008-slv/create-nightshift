// ==========================================================================
// Ночная смена — цена смерти. Вещи остаются (keepInventory), но:
//  - каждая смерть — рана: −1 сердце максимального здоровья (до woundMax), лечит «Настойка жизни»;
//  - рассудок при возрождении не сбрасывается: какой был в момент смерти, такой и остаётся.
//    Если убила тьма (рассудок около нуля, урон из 20_darkness.js) — даём немного сверху,
//    чтобы не умирать по кругу.
// Раны и проклятие алтаря применяет nsApplyPenalty (raids/10_nightshift_state.js).
// ==========================================================================

var NS_TONIC_RESTORE = 1 // ран за одну настойку

EntityEvents.death('minecraft:player', event => {
	var player = event.getEntity()
	var name = String(player.getUsername())
	var st = nsGetState()
	st.wounds = st.wounds || {}
	st.deathSanity = st.deathSanity || {}
	st.wounds[name] = Math.min(NSG.NIGHTSHIFT_TUNABLES.woundMax, (st.wounds[name] || 0) + 1)
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
			if (cap) cap.setSanity(Math.max(0, ds.v - bump))
		} catch (e) {}
		delete st.deathSanity[name]
		nsSaveState(st)
	}
	var w = (st.wounds || {})[name] || 0
	if (w > 0) {
		player.tell(
			Text.red('[Ночная смена] Рана: −' + w + ' серд. максимального здоровья. ')
				.append(Text.gray('Лечит «Настойка жизни» (одна рана за настойку). Рассудок после смерти не восстанавливается.'))
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
	// Настойка жизни: мёд, светящиеся ягоды (пышные пещеры — туда ещё надо дойти), сладкие ягоды, костная мука
	var ing = ['minecraft:honey_bottle', 'minecraft:glow_berries', 'minecraft:sweet_berries', 'minecraft:sweet_berries', 'minecraft:bone_meal']
	event.shapeless('nightshift:life_tonic', ing).id('nightshift:life_tonic_by_hand')
	event.recipes.create.mixing('2x nightshift:life_tonic', ing).id('nightshift:life_tonic_mixing')
})
