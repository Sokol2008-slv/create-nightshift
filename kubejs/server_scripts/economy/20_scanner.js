// ==========================================================================
// Ночная смена — сканер жил (с P4). ПКМ по земле в чанке с жилой → зонд этого
// типа навсегда доступен в столе трансмутации (знание ProjectE; с TeamProjectE —
// у всей команды). Первый скан каждого типа на сервере дарит один зонд.
// Жилы закрытых фаз не изучаются.
// ==========================================================================

var NS_ORE_DATA = Java.loadClass('com.tom.createores.OreDataAttachment')
var NS_SCANNER_PHASE = 4

BlockEvents.rightClicked(event => {
	var item = event.getItem()
	if (!item || String(item.getId()) !== 'nightshift:vein_scanner') return
	if (String(event.getHand()) === 'MAIN_HAND') nsScanVein(event)
	event.cancel()
})

function nsVeinKeyByRecipe(recipeId) {
	for (var key in NS_VEINS) if (NS_VEINS[key].vein === recipeId) return key
	return null
}

function nsScanVein(event) {
	var player = event.getEntity()
	var server = event.server
	var phase = nightshiftReadPhase()
	if (phase < NS_SCANNER_PHASE) {
		player.tell(Text.red('[Сканер] Сканер оживёт в фазе ' + NS_SCANNER_PHASE + ' (сейчас ' + phase + ').'))
		return
	}
	var data
	try {
		var chunk = event.getLevel().getChunkAt(event.getBlock().getPos())
		data = NS_ORE_DATA.getData(chunk)
	} catch (e) {
		console.error('[nightshift] сканер: не прочитал жилу: ' + e)
		player.tell(Text.red('[Сканер] Не удалось прочитать жилу.'))
		return
	}
	var recipeId = data ? data.getRecipeId() : null
	if (!recipeId) {
		player.tell(Text.gray('[Сканер] В этом чанке жилы нет.'))
		return
	}
	var key = nsVeinKeyByRecipe(String(recipeId))
	if (!key) {
		player.tell(Text.gray('[Сканер] Эту жилу ' + String(recipeId) + ' зондом не повторить.'))
		return
	}
	if (phase < NS_VEINS[key].phase) {
		player.tell(Text.red('[Сканер] Эта жила откроется для изучения в фазе ' + NS_VEINS[key].phase + '.'))
		return
	}
	var probe = NS_PROBE_PREFIX + key
	server.runCommandSilent('projecte knowledge learn ' + player.getUsername() + ' ' + probe)
	player.tell(Text.green('[Сканер] Зонд изучен — теперь его можно купить за EMC в столе трансмутации.'))

	var scanned = server.persistentData.getCompound('nightshift_scanned_types')
	if (!scanned.getBoolean(key)) {
		scanned.putBoolean(key, true)
		server.persistentData.put('nightshift_scanned_types', scanned)
		player.give(Item.of(probe))
		player.tell(Text.gold('[Сканер] Первое сканирование этой жилы — зонд в подарок.'))
	}
}
