// ==========================================================================
// «Продать можно, купить нельзя» (Георгий, 29.09): стол трансмутации даёт «кайф», но не должен
// обесценивать заводы. Если машину, слиток или алмаз можно купить — строить их линию незачем.
//   Покупать можно: ванильную еду, стройблоки и природное (камень, дерево, доски, в т.ч. камни и доски
//   аддонов), руду и сырые металлы (цены — config/ProjectE/custom_emc.json, чёрные списки руды выключены
//   в config/ProjectE/mapping.toml), самолёты Immersive Aircraft.
//   Только продать: всё из модов Create и аддонов (машины, детали, материалы, декор, еда), слитки,
//   самородки и блоки металлов, обсидиан, алмазы, изумруды, незерит.
// Как: предмет «только продать» сжигается за EMC как обычно, но стол его не выучивает (купить можно
// только выученное); конденсатор и звено EMC (ProjectExpansion — оно знание не проверяет) на такой
// предмет не настраиваются. Уже выученные такие предметы стираются из знаний при входе игрока.
// ==========================================================================

var NS_SO_PREFIX = 'create' // create, createaddition, createdeco, create_new_age, createfood…
var NS_SO_MODS = ['tfmg', 'railways', 'northstar', 'cbc_at', 'aeronautics', 'simulated', 'sable', 'copycats', 'dndecor', 'dndesires', 'garnished', 'rechiseledcreate', 'interiors']
// камни, дерево и доски аддонов — стройблоки, руда и сырые металлы любых модов — сырьё: их покупать можно
var NS_SO_BUILD_TAGS = ['minecraft:planks', 'minecraft:logs', 'c:stones', 'c:cobblestones', 'minecraft:base_stone_overworld', 'c:ores', 'c:raw_materials', 'c:storage_blocks/raw_iron', 'c:storage_blocks/raw_copper', 'c:storage_blocks/raw_gold', 'c:storage_blocks/raw_zinc']
var NS_SO_BUILD_ITEMS = ['create:limestone', 'create:scoria', 'create:scorchia', 'create:asurine', 'create:crimsite', 'create:ochrum', 'create:veridium', 'create:raw_zinc_block']
var NS_SO_METAL_TAGS = ['c:ingots', 'c:nuggets']
var NS_SO_ITEMS = [
	'minecraft:obsidian', 'minecraft:crying_obsidian',
	'minecraft:diamond', 'minecraft:diamond_block',
	'minecraft:emerald', 'minecraft:emerald_block',
	'minecraft:netherite_ingot', 'minecraft:netherite_scrap', 'minecraft:netherite_block'
]
var NS_SO_CAP = Java.loadClass('moze_intel.projecte.api.capabilities.PECapabilities').KNOWLEDGE_CAPABILITY
var NS_SO_ARRAYLIST = Java.loadClass('java.util.ArrayList')

var nsSoCache = {} // id → true/false
var nsSoSets = null // металлы и стройблоки по тегам — считаем один раз, когда теги уже загружены

function nsSoTagIds(tag) {
	var out = {}
	var arr = Ingredient.of('#' + tag).getStackArray()
	for (var i = 0; i < arr.length; i++) out[String(arr[i].getId())] = true
	return out
}

function nsSoBuildSets() {
	var metal = {}
	var build = {}
	for (var t = 0; t < NS_SO_METAL_TAGS.length; t++) {
		var ids = nsSoTagIds(NS_SO_METAL_TAGS[t])
		for (var id in ids) {
			metal[id] = true
			// блок металла: <мод>:<металл>_block рядом со слитком <мод>:<металл>_ingot
			if (/_ingot$/.test(id)) metal[id.replace(/_ingot$/, '_block')] = true
		}
	}
	for (var b = 0; b < NS_SO_BUILD_TAGS.length; b++) {
		var bids = nsSoTagIds(NS_SO_BUILD_TAGS[b])
		for (var bid in bids) build[bid] = true
	}
	for (var k = 0; k < NS_SO_BUILD_ITEMS.length; k++) build[NS_SO_BUILD_ITEMS[k]] = true
	nsSoSets = { metal: metal, build: build }
}

function nsSellOnly(id) {
	id = String(id)
	if (nsSoCache[id] !== undefined) return nsSoCache[id]
	if (!nsSoSets) nsSoBuildSets()
	var ns = id.split(':')[0]
	var res = false
	if (NS_SO_ITEMS.indexOf(id) >= 0 || nsSoSets.metal[id]) res = true
	else if ((ns.indexOf(NS_SO_PREFIX) === 0 || NS_SO_MODS.indexOf(ns) >= 0) && !nsSoSets.build[id]) res = true
	nsSoCache[id] = res
	return res
}

function nsSoInfoId(info) {
	try {
		return String(info.getItem().getRegisteredName())
	} catch (e) {
		return ''
	}
}

function nsSoSay(player, text) {
	try {
		player.setStatusMessage(Text.gold(text))
	} catch (e) {}
}

// стол: не выучивать (EMC за сожжённый предмет начисляется отдельно — TransmutationInventory.handleKnowledge
// только про знание)
NativeEvents.onEvent(Java.loadClass('moze_intel.projecte.api.event.PlayerAttemptLearnEvent'), e => {
	if (!nsSellOnly(nsSoInfoId(e.getReducedInfo()))) return
	e.setCanceled(true)
	nsSoSay(e.getPlayer(), 'Продано за EMC. Это делает завод — купить такое нельзя')
})

// конденсатор: не копировать
NativeEvents.onEvent(Java.loadClass('moze_intel.projecte.api.event.PlayerAttemptCondenserSetEvent'), e => {
	if (!nsSellOnly(nsSoInfoId(e.getReducedInfo()))) return
	e.setCanceled(true)
	nsSoSay(e.getPlayer(), 'Конденсатор такое не делает — это продукция завода')
})

// звено EMC (ProjectExpansion): ПКМ предметом по звену выставляет, что оно покупает
BlockEvents.rightClicked(event => {
	var bid = String(event.getBlock().getId())
	if (bid.indexOf('projectexpansion:') !== 0 || !/_emc_link$/.test(bid)) return
	var held = event.getItem()
	if (held.isEmpty() || !nsSellOnly(held.getId())) return
	event.cancel()
	nsSoSay(event.getPlayer(), 'Звено EMC такое не покупает — это продукция завода')
})

// уже выученное «только продать» — стереть из знаний (вчера успели выучить машины)
function nsSoPurge(player) {
	var cap = player.getCapability(NS_SO_CAP)
	if (!cap) return 0
	var list = new NS_SO_ARRAYLIST(cap.getKnowledge())
	var n = 0
	for (var i = 0; i < list.size(); i++) {
		var info = list.get(i)
		if (nsSellOnly(nsSoInfoId(info)) && cap.removeKnowledge(info)) n++
	}
	if (n > 0) {
		cap.sync(player)
		console.info('[emc] ' + player.getGameProfile().getName() + ': из знаний убрано «только продать»: ' + n)
	}
	return n
}

PlayerEvents.loggedIn(event => {
	try {
		nsSoPurge(event.getPlayer())
	} catch (e) {
		console.error('[emc] чистка знаний: ' + e)
	}
})

// проверка админом: /emc_rule <предмет> — «купить можно» или «только продать»; /emc_rule purge — всем онлайн
ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('emc_rule')
			.requires(s => s.hasPermission(2))
			.then(
				C.literal('purge').executes(ctx => {
					var ps = ctx.source.getServer().getPlayers()
					var total = 0
					for (var i = 0; i < ps.length; i++) total += nsSoPurge(ps[i])
					ctx.source.sendSystemMessage(Text.gold('[emc] убрано из знаний: ' + total))
					return 1
				})
			)
			.then(
				C.argument('item', A.GREEDY_STRING.create(event)).executes(ctx => {
					var id = String(A.GREEDY_STRING.getResult(ctx, 'item')).trim()
					ctx.source.sendSystemMessage(Text.gold('[emc] ' + id + ': ' + (nsSellOnly(id) ? 'только продать' : 'купить можно')))
					return 1
				})
			)
	)
})
