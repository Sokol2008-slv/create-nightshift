// ==========================================================================
// Ночная смена — зонды и очиститель жил (Create Ore Excavation).
// ПКМ зондом по земле → бесконечная жила этого типа в чанке (/coe setvein).
// ПКМ очистителем → жила в чанке стёрта (/coe removevein).
// Команды мода требуют прав оператора — запускаем от сервера.
// Фаза — из nightshift_phase.json (nightshiftReadPhase в nightshift/00_stages.js).
// ==========================================================================

var NS_PLANETS = ['northstar:moon', 'northstar:mars', 'northstar:mercury', 'northstar:venus']

// тип → жила, фаза открытия, где работает (null — где угодно)
var NS_VEINS = {
	coal: { vein: 'createoreexcavation:ore_vein_type/coal', phase: 1, dims: null },
	copper: { vein: 'createoreexcavation:ore_vein_type/copper', phase: 1, dims: null },
	iron: { vein: 'createoreexcavation:ore_vein_type/iron', phase: 1, dims: null },
	gold: { vein: 'createoreexcavation:ore_vein_type/gold', phase: 2, dims: null },
	zinc: { vein: 'createoreexcavation:ore_vein_type/zinc', phase: 2, dims: null },
	redstone: { vein: 'createoreexcavation:ore_vein_type/redstone', phase: 3, dims: null },
	lapis: { vein: 'createoreexcavation:ore_vein_type/lapis', phase: 3, dims: null },
	diamond: { vein: 'createoreexcavation:ore_vein_type/diamond', phase: 3, dims: null },
	emerald: { vein: 'createoreexcavation:ore_vein_type/emerald', phase: 3, dims: null },
	quartz: { vein: 'createoreexcavation:ore_vein_type/quartz', phase: 3, dims: null },
	glowstone: { vein: 'createoreexcavation:ore_vein_type/glowstone', phase: 3, dims: null },
	netherite: { vein: 'createoreexcavation:ore_vein_type/netherite', phase: 3, dims: null },
	hardened_diamond: { vein: 'createoreexcavation:ore_vein_type/hardened_diamond', phase: 3, dims: null },
	lead: { vein: 'nightshift:ore_vein_type/lead', phase: 4, dims: null },
	nickel: { vein: 'nightshift:ore_vein_type/nickel', phase: 4, dims: null },
	lithium: { vein: 'nightshift:ore_vein_type/lithium', phase: 4, dims: null },
	sulfur: { vein: 'nightshift:ore_vein_type/sulfur', phase: 4, dims: null },
	platinum: { vein: 'nightshift:ore_vein_type/platinum', phase: 4, dims: null },
	thorium: { vein: 'nightshift:ore_vein_type/thorium', phase: 5, dims: null },
	titanium: { vein: 'nightshift:ore_vein_type/titanium', phase: 6, dims: NS_PLANETS },
	tungsten: { vein: 'nightshift:ore_vein_type/tungsten', phase: 6, dims: ['northstar:mercury'] },
	martian_iron: { vein: 'nightshift:ore_vein_type/martian_iron', phase: 6, dims: ['northstar:mars'] },
}

var NS_PROBE_PREFIX = 'nightshift:vein_seed_'
var NS_PROBE_MULTIPLIER = 1 // множитель объёма жилы для /coe setvein

BlockEvents.rightClicked(event => {
	var item = event.getItem()
	if (!item || item.isEmpty()) return
	var id = String(item.getId())
	if (id !== 'nightshift:vein_cleaner' && id.indexOf(NS_PROBE_PREFIX) !== 0) return
	if (String(event.getHand()) !== 'MAIN_HAND') {
		event.cancel()
		return
	}
	nsUseProbe(event, item, id)
	event.cancel() // cancel() в 2101 выходит из обработчика — последним
})

function nsUseProbe(event, item, id) {
	var player = event.getEntity()
	var block = event.getBlock()
	var pos = block.getX() + ' ' + block.getY() + ' ' + block.getZ()
	var dim = String(block.getDimension())
	var cmdIn = 'execute in ' + dim + ' run '

	if (id === 'nightshift:vein_cleaner') {
		event.server.runCommandSilent(cmdIn + 'coe removevein ' + pos)
		if (!player.isCreative()) item.shrink(1)
		player.tell(Text.gray('[Жилы] Жила в этом чанке стёрта.'))
		return
	}

	var key = id.substring(NS_PROBE_PREFIX.length)
	var entry = NS_VEINS[key]
	if (!entry) return
	var phase = nightshiftReadPhase()
	if (phase < entry.phase) {
		player.tell(Text.red('[Жилы] Этот зонд оживёт в фазе ' + entry.phase + ' (сейчас ' + phase + ').'))
		return
	}
	if (entry.dims && entry.dims.indexOf(dim) === -1) {
		player.tell(Text.red('[Жилы] Этот зонд работает только на своей планете.'))
		return
	}
	event.server.runCommandSilent(cmdIn + 'coe setvein ' + pos + ' ' + entry.vein + ' ' + NS_PROBE_MULTIPLIER)
	if (!player.isCreative()) item.shrink(1)
	player.tell(Text.green('[Жилы] В этом чанке теперь бесконечная жила. Ставьте буровую Create Ore Excavation.'))
}
