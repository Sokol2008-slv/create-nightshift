// ==========================================================================
// «Вахта» — ручного крафта нет (docs/VAHTA.md, решение 2).
//  1. Верстак не открывается: ПКМ по ванильному верстаку, ванильному крафтеру, камнерезу, кузнечному
//     столу (с 28.09; долото Rechiseled руками — тоже) и любому блоку
//     с тегом c:player_workstations/crafting_tables или id *crafting_table* / *workbench* —
//     отмена и строка над хотбаром.
//  2. Сетка 2×2 в инвентаре не работает: раз в NS_VAHTA_GRID_PERIOD тиков всё, что лежит в
//     слотах крафта player.inventoryMenu (слоты 1–4), возвращается в инвентарь (не влезло —
//     падает под ноги) + строка над хотбаром.
// Творческий режим не трогаем (строительство, проверки админа).
//
// ПРОВЕРИТЬ ВЖИВУЮ (имена в Rhino могут отличаться — KubeJS прячет/переименовывает часть ванильных):
//  - player.inventoryMenu — публичное поле Player; если не находится, в логе будет
//    «[vahta] сетка 2×2: …» один раз, и п.2 молча выключится (тик не ломается);
//  - menu.getSlot(i) / slot.getItem() / slot.remove(n) / menu.broadcastChanges();
//  - player.give(stack) (KubeJS: кладёт в инвентарь, лишнее бросает под ноги);
//  - что результат (слот 0) пустеет сразу после чистки сетки и клиент это видит;
//  - быстрый игрок успевает забрать результат за ≤5 тиков? (JEI «+» → Shift+клик по результату).
//    Если да — поставить NS_VAHTA_GRID_PERIOD = 1 (4 слота на игрока за тик — копейки);
//  - ПКМ по верстаку с блоком в руке и Shift — ставит блок (не отменяем), без Shift — отмена;
//  - state['is(net.minecraft.tags.TagKey)'] для тега блока.
// ==========================================================================

var NS_VAHTA_GRID_PERIOD = 1 // каждый тик: иначе быстрый игрок успевает забрать результат (4 слота на игрока — копейки)
var NS_VAHTA_MSG_COOLDOWN = 60 // тиков между одинаковыми сообщениями одному игроку

var NS_VAHTA_REG = Java.loadClass('net.minecraft.core.registries.Registries')
var NS_VAHTA_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
var NS_VAHTA_TAGKEY = Java.loadClass('net.minecraft.tags.TagKey')

// теги блоков-верстаков (c: — NeoForge; дамп тегов предметов их не содержит, поэтому ещё и по id)
var NS_VAHTA_BENCH_TAGS = ['c:player_workstations/crafting_tables', 'c:workbench']
var NS_VAHTA_BENCH_KEYS = NS_VAHTA_BENCH_TAGS.map(t => NS_VAHTA_TAGKEY.create(NS_VAHTA_REG.BLOCK, NS_VAHTA_RL.parse(t)))
// явные id: ванильный верстак и ванильный крафтер (автокрафтер с окном-сеткой 3×3)
var NS_VAHTA_BENCH_IDS = ['minecraft:crafting_table', 'minecraft:crafter', 'minecraft:stonecutter', 'minecraft:smithing_table']
// свои подсказки у станций, которые закрыты позже верстака (Георгий, 28.09: «закрывай камнерез, кузню и долото»)
var NS_VAHTA_STATION_MSGS = {
	'minecraft:stonecutter': 'Камнерез мёртв — камень режет механическая пила (форму выбери фильтром)',
	'modulargolems:golem_workbench': 'Верстак големов мёртв — голем собирается на Create: пила, деплоер, пресс, механический крафтер',
	'minecraft:smithing_table': 'Кузня мёртва — улучшения на механических крафтерах: шаблон, вещь, слиток в ряд',
}
var NS_VAHTA_CHISEL = 'rechiseled:chisel' // долото руками закрыто; механическое долото (Rechiseled Create) работает
var NS_VAHTA_CHISEL_MSG = 'Долото руками не работает — нужно механическое долото'
var NS_VAHTA_BENCH_RE = /crafting_table|workbench/
// столы, которые не «верстак», а сборка/станция своего мода — не трогаем.
// Верстак големов (modulargolems:golem_workbench) из списка УБРАН (29.09): это не только сборка големов,
// а плавающий хаб с вкладками ванильных верстака, камнереза, наковальни, кузни и точила
// (TableTabType в jar) — то есть полный обход «ручного крафта». Голем целиком собирается на Create,
// см. 45_golems.js.
var NS_VAHTA_BENCH_ALLOW = []

var NS_VAHTA_BENCH_MSGS = [
	'Руками здесь ничего не собрать — нужен механический крафтер',
	'Верстак мёртв. На вахте собирают машины: механический крафтер, миксер, пресс',
	'Сетка не отзывается. Ищи механический крафтер',
]

var nsVahtaTick = 0
var nsVahtaMsgAt = {} // ник → тик последнего сообщения
var nsVahtaGridBroken = false // п.2 выключен после ошибки (см. лог)

function nsVahtaSay(player, text) {
	var name = String(player.getUsername())
	var now = nsVahtaTick
	if (nsVahtaMsgAt[name] !== undefined && now - nsVahtaMsgAt[name] < NS_VAHTA_MSG_COOLDOWN) return
	nsVahtaMsgAt[name] = now
	player.setStatusMessage(Text.gold(text))
}

function nsVahtaIsBench(block) {
	var id = String(block.getId())
	if (NS_VAHTA_BENCH_ALLOW.indexOf(id) >= 0) return false
	if (NS_VAHTA_BENCH_IDS.indexOf(id) >= 0) return true
	if (id !== 'create:mechanical_crafter' && NS_VAHTA_BENCH_RE.test(id.split(':')[1])) return true
	try {
		var state = block.getBlockState()
		for (var i = 0; i < NS_VAHTA_BENCH_KEYS.length; i++) {
			if (state['is(net.minecraft.tags.TagKey)'](NS_VAHTA_BENCH_KEYS[i])) return true
		}
	} catch (e) {
		console.warn('[vahta] верстак: проверка тега блока не работает: ' + e)
		NS_VAHTA_BENCH_KEYS = []
	}
	return false
}

// ---------- 1. верстак не открывается ----------

BlockEvents.rightClicked(event => {
	var player = event.getPlayer()
	if (!player || player.isCreative()) return
	// долото по блоку — тоже окно выбора варианта
	if (String(event.getItem().getId()) === NS_VAHTA_CHISEL) {
		event.cancel()
		nsVahtaSay(player, NS_VAHTA_CHISEL_MSG)
		return
	}
	if (!nsVahtaIsBench(event.getBlock())) return
	// Shift + предмет в руке — ваниль ставит блок/использует предмет, окно не открывает: не мешаем
	if (player.isShiftKeyDown() && !(player.getMainHandItem().isEmpty() && player.getOffHandItem().isEmpty())) return
	event.cancel()
	if (String(event.getHand()) === 'MAIN_HAND') {
		var own = NS_VAHTA_STATION_MSGS[String(event.getBlock().getId())]
		nsVahtaSay(player, own || NS_VAHTA_BENCH_MSGS[Math.floor(Math.random() * NS_VAHTA_BENCH_MSGS.length)])
	}
})

// долото в воздух — окно выбора варианта блока
ItemEvents.rightClicked(NS_VAHTA_CHISEL, event => {
	var player = event.getPlayer()
	if (!player || player.isCreative()) return
	event.cancel()
	nsVahtaSay(player, NS_VAHTA_CHISEL_MSG)
})

// ---------- 2. сетка 2×2 в инвентаре ----------

// InventoryMenu (1.21.1): 0 — результат, 1–4 — сетка 2×2, 5–8 — броня, 9–44 — инвентарь, 45 — вторая рука
function nsVahtaClearGrid(player) {
	var menu = player.inventoryMenu
	var moved = false
	for (var i = 1; i <= 4; i++) {
		var slot = menu.getSlot(i)
		var stack = slot.getItem()
		if (stack.isEmpty()) continue
		var taken = slot.remove(stack.getCount())
		if (!taken.isEmpty()) player.give(taken)
		moved = true
	}
	if (!moved) return
	menu.broadcastChanges()
	nsVahtaSay(player, 'Руками здесь ничего не собрать — нужен механический крафтер')
}

ServerEvents.tick(event => {
	nsVahtaTick++
	if (nsVahtaGridBroken || nsVahtaTick % NS_VAHTA_GRID_PERIOD !== 0) return
	var players = event.server.getPlayers()
	for (var i = 0; i < players.length; i++) {
		var p = players[i]
		if (p.isSpectator() || p.isCreative()) continue
		try {
			nsVahtaClearGrid(p)
		} catch (e) {
			nsVahtaGridBroken = true
			console.error('[vahta] сетка 2×2: чистка не работает, п.2 выключен до перезагрузки скриптов: ' + e)
			return
		}
	}
})
