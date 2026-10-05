// ==========================================================================
// «Странствующий снабженец» (05.10.2026, поток T). Раз в 2–3 игровых дня утром к алтарю базы приходит снабженец
// (бродячий торговец с двумя ламами каравана) и стоит сутки. Товар каждый раз новый из пула: то, чего машинами не
// сделать или долго — пластинки, редкие саженцы и цветы, шаблоны отделки, книги чар, свитки заклинаний, косметика,
// карты к кладам и постройкам (купил — метка Xaero), ракеты, «Ящик снабжения» (сюрприз), иногда — яйцо дракона,
// элитры, зачарованное золотое яблоко. Валюта — жетоны смены (EMC 0: торговля не печатает EMC из воздуха).
//
//  - Приход: только утром (время суток 0–6000), не во время набега, есть алтарь базы и кто-то в его измерении.
//    Место — у алтаря (кольцо 4–10 блоков, на высоте алтаря ±16) или «лавка», которую игроки задали /trader post.
//  - Объявление: строка над хотбаром и звук всем в измерении; метка Xaero в чат — только если лавка сдвинулась.
//  - Снабженец без ИИ (стоит на месте, не пьёт зелье невидимости, не убегает от зомби), неуязвим, поворачивается
//    к ближнему игроку, Carry On его не берёт. Уходит через сутки (ждёт, пока с ним торгуют).
//  - Товар: лоты с запасом 1–4 штуки на всю команду, цены в жетонах (до 128 — двумя стопками).
// Команды: /trader — где и до когда (всем); /trader post [clear] — лавка снабженца здесь (всем);
//   оператор: /trader call | here | leave | reroll | next <дней>.
// Состояние — server.persistentData «ns_trader_json». Сущности — теги ns_fun_npc, ns_trader, ns_trader_s<номер>.
// ==========================================================================

var NS_TR = {
	everyDays: [2, 3], // раз в 2–3 игровых дня
	stayTicks: 24000, // стоит сутки
	morningTo: 6000, // приходит утром (время суток 0…6000)
	ringMin: 4, // от алтаря
	ringMax: 10,
	turnR: 10, // поворачивается к игроку ближе
	greetR: 14, // приветствие над хотбаром (раз за визит)
	names: ['Михалыч', 'Кузьмич', 'Петрович', 'Семёныч', 'Палыч', 'Иваныч', 'Саныч', 'Степаныч'],
	lines: [
		'Жетоны вперёд — товар потом. Бухгалтерия так велела.',
		'Всё со склада штаба на Аксиоматив. Почти не краденое.',
		'Машиной такого не сделать. А у меня — пожалуйста.',
		'Возврат не принимаю. Обмен тоже. Я снабженец, а не ОТК.',
		'Пластинки свежие. Ну как свежие — без царапин.',
		'Завтра уйду. Не тяните с покупками.',
		'Метеорит видели? Я — нет. Я везу товар, а не в небо смотрю.',
		'Ламы не продаются. Даже не спрашивайте. Особенно левая.',
		'Яйцо дракона? Бывает. Не каждый раз, но бывает.',
		'Карты рисовал сам. Крестик — там, где клад. Наверное.',
		'Скидок нет. Есть только хорошее настроение. Бесплатно.',
	],
}
var NS_TR_KEY = 'ns_trader_json'
var NS_TR_UUID = Java.loadClass('java.util.UUID')
var NS_TR_OPTIONAL = Java.loadClass('java.util.Optional')
var NS_TR_OFFER = Java.loadClass('net.minecraft.world.item.trading.MerchantOffer')
var NS_TR_COST = Java.loadClass('net.minecraft.world.item.trading.ItemCost')
var NS_TR_DC = Java.loadClass('net.minecraft.core.component.DataComponents')
var NS_TR_BLOCKPOS = Java.loadClass('net.minecraft.core.BlockPos')

// --------------------------------------------------------------------------
// Пул товаров. Строка: [предмет (с компонентами) | 'loot:<таблица>', штук, цена, запас, вес, с волны, подпись-заметка]
// Группы: сколько лотов берём за визит (min–max) и шанс, что группа вообще будет.
// --------------------------------------------------------------------------
function nsTrBook(ench, lvl) {
	return 'minecraft:enchanted_book[minecraft:stored_enchantments={levels:{"minecraft:' + ench + '":' + lvl + '}}]'
}
function nsTrDiscs() {
	var ids = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait', 'otherside', '5', 'pigstep', 'relic', 'creator', 'creator_music_box', 'precipice']
	var out = []
	for (var i = 0; i < ids.length; i++) out.push(['minecraft:music_disc_' + ids[i], 1, ids[i] === 'pigstep' || ids[i] === 'otherside' || ids[i] === 'creator' ? 9 : 7, 1, 1, 0])
	out.push(['aeronautics:music_disc_cloud_skipper', 1, 8, 1, 1, 0])
	out.push(['create_connected:music_disc_elevator', 1, 7, 1, 1, 0])
	out.push(['create_connected:music_disc_interlude', 1, 7, 1, 1, 0])
	return out
}
function nsTrTrims() {
	var t = { sentry: 11, dune: 11, coast: 11, wild: 12, ward: 15, eye: 16, vex: 16, tide: 12, snout: 12, rib: 12, spire: 15, wayfinder: 12, shaper: 12, silence: 18, raiser: 12, host: 12, flow: 13, bolt: 13 }
	var out = []
	for (var k in t) out.push(['minecraft:' + k + '_armor_trim_smithing_template', 1, t[k], 1, 1, 0])
	return out
}
// цвет 0xRRGGBB → int для компонентов
function nsTrRgb(hex) {
	return parseInt(hex, 16)
}
var NS_TR_GROUPS = [
	{
		key: 'crate', min: 1, max: 1, chance: 1,
		pool: [['nightshift:supply_crate', 1, 8, 3, 1, 0]],
	},
	{
		key: 'rockets', min: 1, max: 1, chance: 1,
		pool: [
			['minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}]', 32, 4, 4, 3, 0, 'для элитр — полёт 3'],
			['minecraft:firework_rocket[minecraft:fireworks={flight_duration:1,explosions:[{shape:"large_ball",colors:[I;' + nsTrRgb('3DAA88') + ',' + nsTrRgb('C53A47') + '],fade_colors:[I;' + nsTrRgb('F2C623') + '],has_trail:true,has_twinkle:true},{shape:"star",colors:[I;' + nsTrRgb('F2C623') + '],has_twinkle:true}]}]', 16, 4, 3, 2, 0, 'салют смены: изумруд и бордо'],
			['minecraft:firework_rocket[minecraft:fireworks={flight_duration:2,explosions:[{shape:"creeper",colors:[I;' + nsTrRgb('4CAF50') + '],has_trail:true}]}]', 16, 4, 3, 1, 0, 'салют «Крипер»'],
		],
	},
	{ key: 'disc', min: 1, max: 1, chance: 1, pool: nsTrDiscs() },
	{
		key: 'flora', min: 1, max: 2, chance: 1,
		pool: [
			['minecraft:cherry_sapling', 2, 3, 2, 2, 0], ['minecraft:mangrove_propagule', 4, 3, 2, 1, 0], ['minecraft:pink_petals', 16, 3, 2, 2, 0],
			['minecraft:torchflower', 4, 4, 2, 2, 0], ['minecraft:pitcher_plant', 2, 4, 2, 2, 0], ['minecraft:wither_rose', 2, 6, 1, 1, 10],
			['minecraft:spore_blossom', 2, 5, 2, 2, 0], ['minecraft:flowering_azalea', 4, 3, 2, 1, 0], ['minecraft:chorus_flower', 2, 6, 1, 1, 20],
			['minecraft:big_dripleaf', 4, 3, 2, 1, 0], ['minecraft:glow_berries', 16, 3, 2, 1, 0], ['minecraft:sea_pickle', 8, 3, 2, 1, 0],
			['minecraft:lily_of_the_valley', 8, 2, 2, 1, 0], ['minecraft:blue_orchid', 8, 2, 2, 1, 0], ['minecraft:sunflower', 4, 2, 2, 1, 0],
			['minecraft:crimson_fungus', 4, 4, 2, 1, 0], ['minecraft:warped_fungus', 4, 4, 2, 1, 0], ['minecraft:dark_oak_sapling', 4, 2, 2, 1, 0],
			['minecraft:jungle_sapling', 4, 2, 2, 1, 0], ['minecraft:cocoa_beans', 8, 2, 2, 1, 0], ['minecraft:sweet_berries', 16, 2, 2, 1, 0],
			['minecraft:azalea', 4, 2, 2, 1, 0], ['minecraft:moss_block', 16, 2, 2, 1, 0], ['minecraft:lily_pad', 8, 2, 2, 1, 0],
		],
	},
	{ key: 'trim', min: 1, max: 1, chance: 1, pool: nsTrTrims() },
	{
		key: 'book', min: 1, max: 2, chance: 1,
		pool: [
			[nsTrBook('mending', 1), 1, 18, 1, 2, 0], [nsTrBook('unbreaking', 3), 1, 9, 1, 2, 0], [nsTrBook('efficiency', 5), 1, 10, 1, 2, 0],
			[nsTrBook('fortune', 3), 1, 12, 1, 2, 0], [nsTrBook('silk_touch', 1), 1, 10, 1, 2, 0], [nsTrBook('looting', 3), 1, 11, 1, 2, 0],
			[nsTrBook('sharpness', 5), 1, 10, 1, 2, 0], [nsTrBook('protection', 4), 1, 10, 1, 2, 0], [nsTrBook('feather_falling', 4), 1, 9, 1, 2, 0],
			[nsTrBook('power', 5), 1, 9, 1, 1, 0], [nsTrBook('infinity', 1), 1, 9, 1, 1, 0], [nsTrBook('swift_sneak', 3), 1, 14, 1, 1, 0],
			[nsTrBook('soul_speed', 3), 1, 10, 1, 1, 0], [nsTrBook('depth_strider', 3), 1, 8, 1, 1, 0], [nsTrBook('respiration', 3), 1, 8, 1, 1, 0],
			[nsTrBook('frost_walker', 2), 1, 9, 1, 1, 0], [nsTrBook('piercing', 4), 1, 8, 1, 1, 0], [nsTrBook('quick_charge', 3), 1, 8, 1, 1, 0],
			[nsTrBook('loyalty', 3), 1, 8, 1, 1, 0], [nsTrBook('wind_burst', 3), 1, 12, 1, 1, 10], [nsTrBook('density', 5), 1, 10, 1, 1, 10],
			[nsTrBook('breach', 4), 1, 10, 1, 1, 10], [nsTrBook('fire_aspect', 2), 1, 8, 1, 1, 0], [nsTrBook('sweeping_edge', 3), 1, 8, 1, 1, 0],
		],
	},
	{
		key: 'scroll', min: 1, max: 1, chance: 0.6,
		pool: [['loot:nightshift:magic/wave_scroll', 1, 10, 1, 3, 0, 'свиток заклинания'], ['loot:nightshift:magic/wave_scroll_strong', 1, 16, 1, 2, 27, 'сильный свиток заклинания']],
	},
	{
		key: 'cosmetic', min: 1, max: 2, chance: 1,
		pool: [
			['minecraft:goat_horn[minecraft:instrument="minecraft:ponder_goat_horn"]', 1, 6, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:sing_goat_horn"]', 1, 6, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:seek_goat_horn"]', 1, 6, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:feel_goat_horn"]', 1, 6, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:admire_goat_horn"]', 1, 7, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:call_goat_horn"]', 1, 7, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:yearn_goat_horn"]', 1, 7, 1, 1, 0],
			['minecraft:goat_horn[minecraft:instrument="minecraft:dream_goat_horn"]', 1, 7, 1, 1, 0],
			['minecraft:globe_banner_pattern', 1, 5, 1, 1, 0], ['minecraft:piglin_banner_pattern', 1, 5, 1, 1, 0],
			['minecraft:flow_banner_pattern', 1, 5, 1, 1, 0], ['minecraft:guster_banner_pattern', 1, 5, 1, 1, 0],
			['minecraft:skull_banner_pattern', 1, 6, 1, 1, 0], ['minecraft:mojang_banner_pattern', 1, 6, 1, 1, 0],
			['minecraft:name_tag', 2, 5, 2, 2, 0], ['minecraft:saddle', 1, 5, 2, 1, 0],
			['minecraft:angler_pottery_sherd', 1, 3, 1, 1, 0], ['minecraft:heart_pottery_sherd', 1, 3, 1, 1, 0], ['minecraft:skull_pottery_sherd', 1, 3, 1, 1, 0],
			['minecraft:axolotl_bucket[minecraft:bucket_entity_data={Variant:4}]', 1, 20, 1, 1, 0, 'синий аксолотль — один на тысячу'],
			['minecraft:leather_helmet[minecraft:dyed_color={rgb:' + nsTrRgb('3DAA88') + '},minecraft:unbreakable={},minecraft:custom_name=\'{"text":"Кепка снабженца","color":"green","italic":false}\']', 1, 4, 2, 1, 0, 'неломаемая'],
		],
	},
	{
		// карты к кладам: точку выбираем сами, сундук зарываем, когда игрок подлетит (поиск ванильных построек для
		// карт в мире Terralith/Tectonic занимает минуты — 05.10 так сторож уронил тестовый сервер)
		key: 'map', min: 1, max: 1, chance: 0.65,
		pool: [
			['stash:treasure', 1, 10, 1, 3, 0, 'клад: сундук под землёй у крестика'],
			['stash:camp', 1, 14, 1, 2, 5, 'схрон разбойников: сундук под охраной'],
		],
	},
	{
		key: 'rare', min: 1, max: 1, chance: 0.45,
		pool: [
			['dragon_egg', 1, 112, 1, 3, 5, 'яйцо дракона'],
			['minecraft:elytra', 1, 88, 1, 2, 15],
			['minecraft:enchanted_golden_apple', 1, 30, 1, 3, 10],
			['minecraft:totem_of_undying', 1, 22, 1, 2, 10],
			['minecraft:heart_of_the_sea', 1, 24, 1, 2, 5],
			['minecraft:sniffer_egg', 1, 12, 1, 2, 0],
			['minecraft:netherite_upgrade_smithing_template', 1, 40, 1, 1, 20],
			['minecraft:echo_shard', 4, 16, 1, 1, 20],
		],
	},
]
// породы яиц Dragon Mounts (компонент dmr:dragon_breed) — подпись лота
var NS_TR_BREEDS = { fire: 'огненный', forest: 'лесной', ice: 'ледяной', lush: 'цветущий', end: 'эндерский', sculk: 'скалковый', nether: 'незерский', aether: 'небесный', ghost: 'призрачный', water: 'водный', amethyst: 'аметистовый' }

// --------------------------------------------------------------------------
// Состояние
// --------------------------------------------------------------------------
function nsTrDefault() {
	return { nextDay: -1, seq: 0, v: null, post: null, wp: {} }
}
function nsTrState() {
	if (NSG.nsTr) return NSG.nsTr
	var st = nsTrDefault()
	try {
		var raw = String(NSG.nsServer.persistentData.getString(NS_TR_KEY))
		if (raw.length) st = Object.assign(nsTrDefault(), JSON.parse(raw))
	} catch (e) {
		console.warn('[снабженец] битое состояние, сбрасываю: ' + e)
	}
	NSG.nsTr = st
	return st
}
function nsTrSave() {
	try {
		NSG.nsServer.persistentData.putString(NS_TR_KEY, JSON.stringify(nsTrState()))
	} catch (e) {
		console.warn('[снабженец] не сохранить состояние: ' + e)
	}
}
function nsTrNow() {
	var level = NSG.nsServer.getOverworld()
	try {
		return Number(level.getTime())
	} catch (e) {}
	return Number(level.getGameTime())
}
function nsTrLevel(dim) {
	return NSG.nsServer.getLevel(dim)
}
function nsTrRun(dim, cmd) {
	NSG.nsServer.runCommandSilent('execute in ' + dim + ' run ' + cmd)
}

// --------------------------------------------------------------------------
// Предметы: строка «id[компоненты]» → ItemStack; таблица добычи → ItemStack
// --------------------------------------------------------------------------
var NS_TR_PARSER = null
function nsFunItem(str, count) {
	// разбор как у /give: ванильный разборщик предметов с компонентами
	try {
		if (!NS_TR_PARSER) {
			var IP = Java.loadClass('net.minecraft.commands.arguments.item.ItemParser')
			NS_TR_PARSER = new IP(NSG.nsServer.registryAccess())
		}
		var SR = Java.loadClass('com.mojang.brigadier.StringReader')
		var r = NS_TR_PARSER.parse(new SR(str))
		var IS = Java.loadClass('net.minecraft.world.item.ItemStack')
		return new IS(r.item(), count, r.components())
	} catch (e) {
		console.warn('[снабженец] разбор «' + str + '» ванильным разборщиком: ' + e + ' — пробую Item.of')
	}
	return Item.of(str, count)
}
var NS_TR_LP = Java.loadClass('net.minecraft.world.level.storage.loot.LootParams$Builder')
var NS_TR_LCP = Java.loadClass('net.minecraft.world.level.storage.loot.parameters.LootContextParams')
var NS_TR_LCPS = Java.loadClass('net.minecraft.world.level.storage.loot.parameters.LootContextParamSets')
var NS_TR_RK = Java.loadClass('net.minecraft.resources.ResourceKey')
var NS_TR_REGS = Java.loadClass('net.minecraft.core.registries.Registries')
var NS_TR_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
var NS_TR_VEC3 = Java.loadClass('net.minecraft.world.phys.Vec3')
// таблица добычи → массив ItemStack (origin — точка мира: карты ищут постройку от неё)
function nsFunLoot(level, table, x, y, z, entity) {
	var key = NS_TR_RK.create(NS_TR_REGS.LOOT_TABLE, NS_TR_RL.parse(table))
	var lt = NSG.nsServer.reloadableRegistries().getLootTable(key)
	var b = new NS_TR_LP(level).withParameter(NS_TR_LCP.ORIGIN, new NS_TR_VEC3(x, y, z))
	if (entity) b = b.withParameter(NS_TR_LCP.THIS_ENTITY, entity)
	var list = lt.getRandomItems(b.create(entity ? NS_TR_LCPS.GIFT : NS_TR_LCPS.CHEST))
	var out = []
	for (var i = 0; i < list.size(); i++) if (!list.get(i).isEmpty()) out.push(list.get(i))
	return out
}

// --------------------------------------------------------------------------
// Клады снабженца: карта с крестиком к точке в 350–800 блоках от базы. Сундук появляется, когда игрок подлетит
// ближе 40 блоков (чанк уже загружен им — сервер ничего не генерирует заранее): клад — под землёй (2 блока),
// схрон — на поверхности у костра, его охраняют разбойники (их больше с пройденными волнами).
// Над местом — столб частиц, пока сундук не открыт. Купленная карта — метка Xaero и координаты в чат.
// Непроданные карты пропадают с уходом снабженца, клады — через 12 дней.
// --------------------------------------------------------------------------
var NS_TR_MAPITEM = Java.loadClass('net.minecraft.world.item.MapItem')
var NS_TR_MAPDATA = Java.loadClass('net.minecraft.world.level.saveddata.maps.MapItemSavedData')
var NS_TR_MAPDECO = Java.loadClass('net.minecraft.world.level.saveddata.maps.MapDecorationTypes')
var NS_TR_CDATA = Java.loadClass('net.minecraft.world.item.component.CustomData')
var NS_TR_CTAG = Java.loadClass('net.minecraft.nbt.CompoundTag')
var NS_TR_LORE = Java.loadClass('net.minecraft.world.item.component.ItemLore')
var NS_TR_JLIST = Java.loadClass('java.util.List')
var NS_TR_HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
var NS_TR_STASH = {
	treasure: { name: 'Карта клада', table: 'nightshift:trader/stash', lore: 'Сундук зарыт у крестика — копай на 2–3 блока вниз' },
	camp: { name: 'Карта схрона разбойников', table: 'nightshift:trader/stash_camp', lore: 'Сундук у костра, его стерегут разбойники' },
}
function nsTrStashSpot(level, bx, bz) {
	var rs = nsGetStateRO()
	for (var i = 0; i < 24; i++) {
		var a = Math.random() * Math.PI * 2,
			d = 350 + Math.random() * 450
		var x = Math.floor(bx + Math.cos(a) * d),
			z = Math.floor(bz + Math.sin(a) * d)
		// быстрые проверки без загрузки чанков: зоны баз, алтари, водные биомы (как у метеорита)
		if (typeof nsSkyQuickCheck === 'function' && !nsSkyQuickCheck(x, z, rs).ok) continue
		return { x: x, z: z }
	}
	return null
}
function nsTrStashMap(level, kind, bx, bz) {
	if (String(level.getDimension()) !== 'minecraft:overworld') return null
	var K = NS_TR_STASH[kind]
	var spot = nsTrStashSpot(level, bx, bz)
	if (!K || !spot) return null
	var st = nsTrState()
	st.stashSeq = (st.stashSeq || 0) + 1
	var id = 's' + st.stashSeq
	var t0 = Date.now()
	// рисунок биомов (~0,4 с на тестовом сервере) — не здесь, а при покупке (nsTrStashPreview)
	var stack = NS_TR_MAPITEM.create(level, spot.x, spot.z, 2, true, true)
	NS_TR_MAPDATA.addTargetDecoration(stack, new NS_TR_BLOCKPOS(spot.x, 64, spot.z), '+', kind === 'camp' ? NS_TR_MAPDECO.TARGET_X : NS_TR_MAPDECO.RED_X)
	stack.set(NS_TR_DC.ITEM_NAME, Text.gold(K.name))
	var tag = new NS_TR_CTAG()
	tag.putString('ns_stash', id)
	stack.set(NS_TR_DC.CUSTOM_DATA, NS_TR_CDATA.of(tag))
	stack.set(NS_TR_DC.LORE, new NS_TR_LORE(NS_TR_JLIST.of(Text.gray(K.lore).italic(false), Text.darkGray('Купишь — метка для карты придёт в чат').italic(false))))
	st.stashes = st.stashes || []
	st.stashes.push({ id: id, kind: kind, x: spot.x, z: spot.z, made: nsFunDay(), visit: st.seq, bought: null, placed: false })
	console.info('[снабженец] клад ' + id + ' (' + kind + ') в ' + spot.x + ' ' + spot.z + ', карта за ' + (Date.now() - t0) + ' мс')
	return stack
}
// при покупке: нарисовать на карте биомы (как у ванильной карты сокровищ); данные карты общие по её номеру
function nsTrStashPreview(stack) {
	try {
		var t0 = Date.now()
		NS_TR_MAPITEM.renderBiomePreviewMap(NSG.nsServer.getOverworld(), stack)
		console.info('[снабженец] рисунок карты клада: ' + (Date.now() - t0) + ' мс')
	} catch (e) {
		console.warn('[снабженец] карта без рисунка биомов: ' + e)
	}
}
function nsTrStashById(id) {
	var list = nsTrState().stashes || []
	for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]
	return null
}
// Раз в 2 с: поставить сундук, когда игрок рядом; подсветить место; убрать открытые и старые
function nsTrStashTick() {
	var st = nsTrState()
	var list = st.stashes
	if (!list || !list.length) return
	var level = NSG.nsServer.getOverworld()
	var ps = level.getPlayers()
	var day = nsFunDay()
	var changed = false
	for (var i = list.length - 1; i >= 0; i--) {
		var S = list[i]
		if (!S.bought && (!st.v || st.v.seq !== S.visit)) {
			list.splice(i, 1) // карта так и не продана
			changed = true
			continue
		}
		if (day - S.made > 12 || S.done) {
			list.splice(i, 1)
			changed = true
			continue
		}
		if (!S.bought) continue
		var near = 1e9,
			nearP = null
		for (var k = 0; k < ps.length; k++) {
			var dx = ps[k].getX() - (S.x + 0.5),
				dz = ps[k].getZ() - (S.z + 0.5)
			var d = Math.sqrt(dx * dx + dz * dz)
			if (d < near) {
				near = d
				nearP = ps[k]
			}
		}
		if (!S.placed) {
			if (near > 40 || !level.isLoaded(new NS_TR_BLOCKPOS(S.x, 64, S.z))) continue
			nsTrStashPlace(level, S)
			changed = true
			if (nearP && !nsFunHudBusy(nearP)) nearP.setStatusMessage(S.kind === 'camp' ? Text.red('Схрон разбойников! Охрана уже заметила вас.') : Text.gold('Клад где-то здесь — ищите столб света и копайте вниз.'))
			continue
		}
		// открыт? (сундук сломан или добыча уже выдана)
		// NBT сундука: пока не открыт, в нём LootTable (getLootTable() из Rhino не сработал; == null у ResourceKey ещё и
		// роняет «особое равенство» Rhino NPE мимо try — проверено 05.10)
		var be = level.getBlock(S.x, S.y, S.z).getEntity()
		var opened = !be
		if (!opened) {
			try {
				opened = !be.saveWithoutMetadata(level.registryAccess()).contains('LootTable')
			} catch (e) {}
		}
		if (opened) {
			S.done = true
			changed = true
			for (var q = 0; q < ps.length; q++) {
				var qx = ps[q].getX() - S.x,
					qz = ps[q].getZ() - S.z
				if (qx * qx + qz * qz < 16 * 16) nsFunStage(nsFunName(ps[q]), 'ns_fun_stash')
			}
			continue
		}
		// столб света над местом, пока не открыт
		if (near < 160) NSG.nsServer.runCommandSilent('execute in minecraft:overworld run particle minecraft:end_rod ' + (S.x + 0.5) + ' ' + (S.top + 14) + ' ' + (S.z + 0.5) + ' 0.1 12 0.1 0.004 30 force')
	}
	if (changed) nsTrSave()
}
function nsTrStashPlace(level, S) {
	var K = NS_TR_STASH[S.kind]
	var top = Number(level.getHeight(NS_TR_HM.MOTION_BLOCKING_NO_LEAVES, S.x, S.z)) // первый воздух над землёй
	S.top = top
	var phase = 0
	try {
		phase = nsGetStateRO().phase || 0
	} catch (e) {}
	var at = function (dx, dy, dz) {
		return S.x + dx + ' ' + (top + dy) + ' ' + (S.z + dz)
	}
	var run = function (c) {
		NSG.nsServer.runCommandSilent('execute in minecraft:overworld run ' + c)
	}
	if (S.kind === 'camp') {
		S.y = top
		run('setblock ' + at(0, 0, 0) + ' minecraft:chest{LootTable:"' + K.table + '"} replace')
		run('setblock ' + at(2, 0, 1) + ' minecraft:campfire replace')
		run('setblock ' + at(-2, 0, 0) + ' minecraft:hay_block replace')
		run('setblock ' + at(-1, 0, 2) + ' minecraft:barrel replace')
		var guards = Math.min(7, 3 + Math.floor(phase / 10))
		for (var g = 0; g < guards; g++) {
			var a = (g / guards) * Math.PI * 2
			var gx = S.x + 0.5 + Math.cos(a) * 5,
				gz = S.z + 0.5 + Math.sin(a) * 5
			var gy = Number(level.getHeight(NS_TR_HM.MOTION_BLOCKING_NO_LEAVES, Math.floor(gx), Math.floor(gz)))
			var type = phase >= 10 && g === 0 ? 'minecraft:vindicator' : 'minecraft:pillager'
			run('summon ' + type + ' ' + gx.toFixed(1) + ' ' + gy + ' ' + gz.toFixed(1) + ' {PersistenceRequired:1b,Tags:["ns_stash_guard"]}')
		}
	} else {
		S.y = top - 3
		run('setblock ' + at(0, -3, 0) + ' minecraft:chest{LootTable:"' + K.table + '"} replace')
	}
	console.info('[снабженец] клад ' + S.id + ' (' + S.kind + ') поставлен: ' + S.x + ' ' + S.y + ' ' + S.z)
	S.placed = true
}

// --------------------------------------------------------------------------
// Набор лотов на визит
// --------------------------------------------------------------------------
function nsTrPick(pool, phase, taken) {
	var sum = 0,
		ok = []
	for (var i = 0; i < pool.length; i++) {
		var r = pool[i]
		if ((r[5] || 0) > phase || taken[r[0]]) continue
		ok.push(r)
		sum += r[4] || 1
	}
	if (!ok.length) return null
	var roll = Math.random() * sum
	for (var j = 0; j < ok.length; j++) {
		roll -= ok[j][4] || 1
		if (roll <= 0) return ok[j]
	}
	return ok[ok.length - 1]
}
// цена ±15 %, не меньше 1, не больше 128 (две стопки)
function nsTrPrice(base) {
	return Math.max(1, Math.min(128, Math.round(base * (0.85 + Math.random() * 0.3))))
}
// Строка пула → {stack, price, uses, label} или null (карта не нашла постройку и т.п.)
function nsTrMakeLot(r, level, x, y, z) {
	var stack = null,
		label = r[6] || ''
	var id = r[0]
	if (id === 'dragon_egg') {
		var keys = Object.keys(NS_TR_BREEDS)
		var br = keys[Math.floor(Math.random() * keys.length)]
		stack = nsFunItem('dmr:dragon_egg[dmr:dragon_breed="' + br + '"]', 1)
		label = 'яйцо дракона: ' + NS_TR_BREEDS[br]
	} else if (id.indexOf('stash:') === 0) {
		stack = nsTrStashMap(level, id.substring(6), x, z)
		if (!stack) return null
	} else if (id.indexOf('loot:') === 0) {
		var got = nsFunLoot(level, id.substring(5), x, y, z, null)
		if (!got.length) return null
		stack = got[0]
	} else {
		stack = nsFunItem(id, r[1])
	}
	if (!stack || stack.isEmpty()) return null
	return { stack: stack, price: nsTrPrice(r[2]), uses: r[3] || 1, label: label }
}
function nsTrRoll(level, x, y, z) {
	var phase = 0
	try {
		phase = nsGetStateRO().phase || 0
	} catch (e) {}
	var lots = []
	for (var g = 0; g < NS_TR_GROUPS.length; g++) {
		var G = NS_TR_GROUPS[g]
		if (Math.random() > G.chance) continue
		var n = G.min + Math.floor(Math.random() * (G.max - G.min + 1))
		var taken = {}
		for (var k = 0; k < n; k++) {
			var r = nsTrPick(G.pool, phase, taken)
			if (!r) break
			taken[r[0]] = true
			var t0 = Date.now()
			try {
				var lot = nsTrMakeLot(r, level, x, y, z)
				if (lot) {
					lot.group = G.key
					lots.push(lot)
				}
			} catch (e) {
				console.warn('[снабженец] лот ' + r[0] + ' не собрался: ' + e)
			}
			if (Date.now() - t0 > 200) console.info('[снабженец] лот ' + r[0] + ' собирался ' + (Date.now() - t0) + ' мс')
		}
	}
	return lots
}
function nsTrApplyOffers(trader, lots) {
	var tok = Item.of(NS_FUN_TOKEN).getItem()
	var offers = trader.getOffers()
	offers.clear()
	for (var i = 0; i < lots.length; i++) {
		var L = lots[i]
		var a = Math.min(64, L.price),
			b = L.price - a
		var costB = b > 0 ? NS_TR_OPTIONAL.of(new NS_TR_COST(tok, b)) : NS_TR_OPTIONAL.empty()
		offers.add(new NS_TR_OFFER(new NS_TR_COST(tok, a), costB, L.stack, L.uses, 0, 0.0))
	}
}

// --------------------------------------------------------------------------
// Место у алтаря (или лавка /trader post)
// --------------------------------------------------------------------------
function nsTrSpot(level, ax, ay, az) {
	var a0 = Math.random() * Math.PI * 2
	for (var r = NS_TR.ringMin; r <= NS_TR.ringMax; r++) {
		for (var k = 0; k < 16; k++) {
			var a = a0 + (k * Math.PI * 2) / 16
			var x = Math.floor(ax + Math.cos(a) * r),
				z = Math.floor(az + Math.sin(a) * r)
			var y = nsFindSpawnY(level, x, z, ay, true)
			if (y === null || Math.abs(y - ay) > 6) continue
			return { x: x, y: y, z: z }
		}
	}
	return { x: ax + 2, y: ay, z: az } // запасной вариант — рядом с алтарём
}
function nsTrHome() {
	var st = nsTrState()
	if (st.post) return { dim: st.post.dim, x: st.post.x, y: st.post.y, z: st.post.z, post: true }
	var rs = nsGetStateRO()
	var a = nsHomeAltar(rs)
	if (!a) return null
	return { dim: a.dim, x: a.x, y: a.y, z: a.z, post: false }
}

// UUID для сущности: строка и массив int для NBT (поводок лам держится за снабженца по UUID)
function nsTrNewUuid() {
	var u = NS_TR_UUID.randomUUID()
	var s = String(u.toString()).replace(/-/g, '')
	var ints = []
	for (var i = 0; i < 4; i++) {
		var v = parseInt(s.substring(i * 8, i * 8 + 8), 16)
		if (v > 2147483647) v -= 4294967296
		ints.push(v)
	}
	return { str: String(u.toString()), nbt: '[I;' + ints.join(',') + ']' }
}

// --------------------------------------------------------------------------
// Приход и уход
// --------------------------------------------------------------------------
function nsTrPlayersIn(dim) {
	var out = []
	var ps = NSG.nsServer.getPlayers()
	for (var i = 0; i < ps.length; i++) if (nsFunDim(ps[i]) === dim) out.push(ps[i])
	return out
}
// снабженец визита: ссылка в памяти, после рестарта — поиск по тегу у лавки (если чанк загружен)
function nsTrEntity(v) {
	var e = NSG.nsTrEnt
	if (e && !nsFunGone(e) && nsFunHasTag(e, 'ns_trader_s' + v.seq)) return e
	NSG.nsTrEnt = null
	try {
		e = nsFunFindUuid(nsTrLevel(v.dim), v.x + 0.5, v.y + 1, v.z + 0.5, 6, 'ns_trader', v.uuid)
	} catch (x) {
		e = null
	}
	if (e) NSG.nsTrEnt = e
	return e
}

function nsTrArrive(at) {
	var st = nsTrState()
	if (st.v) nsTrLeave('сменился', true)
	var home = at || nsTrHome()
	if (!home) return 'нет алтаря базы — снабженцу некуда идти'
	var level = nsTrLevel(home.dim)
	var spot = (at || home.post) ? { x: Math.floor(home.x), y: Math.floor(home.y), z: Math.floor(home.z) } : nsTrSpot(level, home.x, home.y, home.z)
	st.seq++
	var name = 'Снабженец ' + NS_TR.names[Math.floor(Math.random() * NS_TR.names.length)]
	var id = nsTrNewUuid()
	var tags = '["ns_fun_npc","ns_trader","ns_trader_s' + st.seq + '"]'
	// лицом к алтарю (или к центру лавки)
	var yaw = home.post || at ? 0 : Math.round((Math.atan2(-(home.x - spot.x), home.z - spot.z) * 180) / Math.PI)
	var cname = JSON.stringify({ text: name, color: 'gold' })
	NSG.nsTrSpawning = st.seq // EntityEvents.spawned пропускает сущности этого визита
	nsTrRun(home.dim, 'summon minecraft:wandering_trader ' + (spot.x + 0.5) + ' ' + spot.y + ' ' + (spot.z + 0.5) + ' {UUID:' + id.nbt + ',NoAI:1b,Invulnerable:1b,PersistenceRequired:1b,DespawnDelay:2000000000,CanPickUpLoot:0b,CustomNameVisible:1b,CustomName:' + JSON.stringify(cname) + ',Rotation:[' + yaw + 'f,0f],Tags:' + tags + ',Offers:{Recipes:[]}}')
	NSG.nsTrEnt = null
	var trader = nsTrEntity({ dim: home.dim, x: spot.x, y: spot.y, z: spot.z, seq: st.seq, uuid: id.str })
	if (!trader) {
		NSG.nsTrSpawning = null
		return 'не удалось поставить снабженца в ' + spot.x + ' ' + spot.y + ' ' + spot.z
	}
	// две ламы каравана по бокам, на поводке у снабженца
	var llamas = 0
	var side = ((yaw + 90) * Math.PI) / 180
	for (var s = -1; s <= 1; s += 2) {
		var lx = Math.floor(spot.x + 0.5 + Math.cos(side) * 2 * s),
			lz = Math.floor(spot.z + 0.5 + Math.sin(side) * 2 * s)
		var ly = nsFindSpawnY(level, lx, lz, spot.y, true)
		if (ly === null || Math.abs(ly - spot.y) > 2) continue
		nsTrRun(home.dim, 'summon minecraft:trader_llama ' + (lx + 0.5) + ' ' + ly + ' ' + (lz + 0.5) + ' {NoAI:1b,Invulnerable:1b,PersistenceRequired:1b,Silent:1b,Variant:' + Math.floor(Math.random() * 4) + ',Rotation:[' + yaw + 'f,0f],leash:{UUID:' + id.nbt + '},Tags:["ns_fun_npc","ns_trader_llama","ns_trader_s' + st.seq + '"]}')
		llamas++
	}
	NSG.nsTrSpawning = null
	var t0 = Date.now()
	var lots = nsTrRoll(level, spot.x, spot.y, spot.z)
	nsTrApplyOffers(trader, lots)
	var now = nsTrNow()
	st.v = { seq: st.seq, name: name, dim: home.dim, x: spot.x, y: spot.y, z: spot.z, uuid: id.str, at: now, leaveAt: now + NS_TR.stayTicks, lots: lots.length, greeted: {} }
	nsTrSave()
	var labels = []
	for (var i = 0; i < lots.length; i++) labels.push(String(lots[i].stack.getHoverName().getString()) + (lots[i].label ? ' (' + lots[i].label + ')' : '') + ' — ' + lots[i].price)
	console.info('[снабженец] #' + st.seq + ' ' + name + ' пришёл в ' + spot.x + ' ' + spot.y + ' ' + spot.z + ' (' + home.dim + '), лам ' + llamas + ', лотов ' + lots.length + ' за ' + (Date.now() - t0) + ' мс: ' + labels.join('; '))
	// объявление: строка над хотбаром и звук всем в измерении; метка Xaero — тем, у кого её ещё нет (лавка сдвинулась)
	var ps = nsTrPlayersIn(home.dim)
	for (var q = 0; q < ps.length; q++) {
		var p = ps[q]
		var pn = nsFunName(p)
		var dx = spot.x - p.getX(),
			dz = spot.z - p.getZ()
		var d = Math.round(Math.sqrt(dx * dx + dz * dz))
		p.setStatusMessage(Text.gold(name + ' пришёл к базе: ').append(Text.yellow(lots.length + ' лотов за жетоны смены, до завтрашнего утра')).append(Text.gray(' · ' + nsFunArrow(p, dx, dz) + ' ' + d + ' бл.')))
		nsFunSound(pn, 'minecraft:block.bell.use', 0.7, 1.2)
		nsFunSound(pn, 'minecraft:entity.wandering_trader.yes', 1, 1)
		var key = spot.x + ',' + spot.z
		var old = st.wp[pn]
		var moved = true
		if (old) {
			var o = String(old).split(',')
			moved = Math.abs(Number(o[0]) - spot.x) > 16 || Math.abs(Number(o[1]) - spot.z) > 16
		}
		if (moved) {
			p.tell(Text.of('xaero-waypoint:Снабженец:С:' + spot.x + ':' + (spot.y + 1) + ':' + spot.z + ':14:false:0:Internal-' + (home.dim === 'minecraft:the_nether' ? 'the_nether' : 'overworld') + '-waypoints'))
			st.wp[pn] = key
		}
	}
	nsTrSave()
	if (typeof nsJournal === 'function') nsJournal('trader', name + ' пришёл к базе (' + spot.x + ' ' + spot.y + ' ' + spot.z + '): ' + lots.length + ' лотов за жетоны смены, до утра дня ' + (nsFunDay() + 1) + ' — /trader', 'gold')
	nsTrRun(home.dim, 'particle minecraft:cloud ' + (spot.x + 0.5) + ' ' + (spot.y + 1) + ' ' + (spot.z + 0.5) + ' 1.2 0.8 1.2 0.02 40 normal')
	nsTrRun(home.dim, 'particle minecraft:happy_villager ' + (spot.x + 0.5) + ' ' + (spot.y + 1.5) + ' ' + (spot.z + 0.5) + ' 1 1 1 0 20 normal')
	return name + ' у ' + spot.x + ' ' + spot.y + ' ' + spot.z + ', лотов ' + lots.length
}

// Уход: снабженец и ламы растворяются; если чанк не загружен — уберёт EntityEvents.spawned при загрузке
function nsTrLeave(why, quiet) {
	var st = nsTrState()
	var v = st.v
	if (!v) return 'снабженца нет'
	var level = nsTrLevel(v.dim)
	var gone = nsFunFind(level, v.x + 0.5, v.y + 1, v.z + 0.5, 8, 'ns_trader_s' + v.seq)
	for (var i = 0; i < gone.length; i++) {
		try {
			gone[i].discard()
		} catch (e) {}
	}
	nsTrRun(v.dim, 'particle minecraft:poof ' + (v.x + 0.5) + ' ' + (v.y + 1) + ' ' + (v.z + 0.5) + ' 1.2 0.8 1.2 0.02 30 normal')
	nsTrRun(v.dim, 'playsound minecraft:entity.wandering_trader.disappeared neutral @a ' + (v.x + 0.5) + ' ' + (v.y + 1) + ' ' + (v.z + 0.5) + ' 1 1')
	st.v = null
	var day = nsFunDay()
	st.nextDay = day + NS_TR.everyDays[0] + Math.floor(Math.random() * (NS_TR.everyDays[1] - NS_TR.everyDays[0] + 1))
	nsTrSave()
	console.info('[снабженец] #' + v.seq + ' ' + v.name + ' ушёл (' + why + '), убрано сущностей ' + gone.length + ', следующий — день ' + st.nextDay)
	if (!quiet) {
		var ps = nsTrPlayersIn(v.dim)
		for (var q = 0; q < ps.length; q++) ps[q].setStatusMessage(Text.gray(v.name + ' ушёл дальше по трассе. Следующий снабженец — через ' + (st.nextDay - day) + ' дн.'))
	}
	return v.name + ' ушёл'
}

// --------------------------------------------------------------------------
// Тик: раз в секунду
// --------------------------------------------------------------------------
ServerEvents.tick(event => {
	if (event.server.getTickCount() % 20 !== 7) return
	try {
		if (!NSG.nsServer) return
		var st = nsTrState()
		var v = st.v
		if (v) {
			var tr = nsTrEntity(v)
			var now = nsTrNow()
			if (now >= v.leaveAt) {
				var trading = false
				try {
					trading = !!tr && tr.isTrading()
				} catch (e) {}
				if (!trading || now > v.leaveAt + 1200) nsTrLeave('сутки прошли')
				return
			}
			if (!tr) {
				// чанк загружен, а снабженца нет полминуты (убит командой, пропал) — визит окончен.
				// Полминуты — потому что сущности грузятся позже чанка.
				if (nsTrLevel(v.dim).isLoaded(new NS_TR_BLOCKPOS(v.x, v.y, v.z))) {
					NSG.nsTrMiss = (NSG.nsTrMiss || 0) + 1
					if (NSG.nsTrMiss >= 30) {
						NSG.nsTrMiss = 0
						nsTrLeave('пропал', true)
					}
				} else NSG.nsTrMiss = 0
				return
			}
			NSG.nsTrMiss = 0
			// повернуться к ближнему игроку, поприветствовать подошедших
			nsTrRun(v.dim, 'execute as ' + v.uuid + ' at @s if entity @p[distance=..' + NS_TR.turnR + '] facing entity @p[distance=..' + NS_TR.turnR + '] eyes run tp @s ~ ~ ~ ~ ~')
			var ps = nsTrPlayersIn(v.dim)
			for (var i = 0; i < ps.length; i++) {
				var p = ps[i]
				var dx = p.getX() - (v.x + 0.5),
					dz = p.getZ() - (v.z + 0.5)
				if (dx * dx + dz * dz > NS_TR.greetR * NS_TR.greetR) continue
				var pn = nsFunName(p)
				if (v.greeted[pn]) continue
				v.greeted[pn] = true
				nsTrSave()
				if (nsFunHudBusy(p)) continue
				var left = Math.max(0, Math.round((v.leaveAt - now) / 1000)) // игровых часов
				p.setStatusMessage(Text.gold(v.name + ': ').append(Text.white('«' + NS_TR.lines[Math.floor(Math.random() * NS_TR.lines.length)] + '»')).append(Text.gray(' · уйдёт через ' + left + ' ч')))
			}
			if (event.server.getTickCount() % 60 === 7) nsTrRun(v.dim, 'particle minecraft:happy_villager ' + (v.x + 0.5) + ' ' + (v.y + 2.3) + ' ' + (v.z + 0.5) + ' 0.4 0.3 0.4 0 2 normal')
			return
		}
		// по графику: утром, без набега, при живых игроках у базы
		var day = nsFunDay()
		if (st.nextDay < 0) {
			st.nextDay = day + 1
			nsTrSave()
			return
		}
		if (day < st.nextDay - 10) {
			st.nextDay = day + 1 // время откатили командой
			nsTrSave()
		}
		if (day < st.nextDay) return
		var tod = Number(NSG.nsServer.getOverworld().getDayTime()) % 24000
		if (tod >= NS_TR.morningTo || nsFunRaidBusy()) return
		var home = nsTrHome()
		if (!home || !nsTrPlayersIn(home.dim).length) return
		var r = nsTrArrive(null)
		console.info('[снабженец] по графику (день ' + day + '): ' + r)
	} catch (e) {
		console.error('[снабженец] тик: ' + e)
	}
})

ServerEvents.tick(event => {
	if (event.server.getTickCount() % 40 !== 27) return
	try {
		if (NSG.nsServer) nsTrStashTick()
	} catch (e) {
		console.error('[снабженец] клады: ' + e)
	}
})

// Сущности прошлых визитов (чанк был выгружен при уходе) — не пускать в мир
EntityEvents.spawned(event => {
	try {
		var e = event.entity
		if (!nsFunHasTag(e, 'ns_fun_npc')) return
		if (!nsFunHasTag(e, 'ns_trader') && !nsFunHasTag(e, 'ns_trader_llama')) return
		var v = NSG.nsServer ? nsTrState().v : null
		if (v && nsFunHasTag(e, 'ns_trader_s' + v.seq)) return
		if (NSG.nsTrSpawning && nsFunHasTag(e, 'ns_trader_s' + NSG.nsTrSpawning)) return // приход прямо сейчас
	} catch (x) {
		return
	}
	event.cancel()
})

// Вход во время визита — напоминание над хотбаром
PlayerEvents.loggedIn(event => {
	try {
		var p = event.player
		var name = nsFunName(p)
		event.server.scheduleInTicks(80, function () {
			try {
				var v = nsTrState().v
				var q = nsFunPlayer(name)
				if (!v || !q || nsFunHudBusy(q)) return
				var left = Math.max(0, Math.round((v.leaveAt - nsTrNow()) / 1000))
				q.setStatusMessage(Text.gold(v.name + ' торгует у базы').append(Text.gray(' (' + v.x + ' ' + v.y + ' ' + v.z + ') ещё ' + left + ' ч — /trader')))
			} catch (e) {}
		})
	} catch (e) {}
})

// --------------------------------------------------------------------------
// Покупка: квест, метка Xaero для карт, объявление о редкой покупке
// --------------------------------------------------------------------------
var NS_TR_TRADE_EV = Java.loadClass('net.neoforged.neoforge.event.entity.player.TradeWithVillagerEvent')
NativeEvents.onEvent(NS_TR_TRADE_EV, function (event) {
	try {
		if (!nsFunGenOk()) return
		if (!nsFunHasTag(event.getAbstractVillager(), 'ns_trader')) return
		var p = event.getEntity()
		var name = nsFunName(p)
		nsFunStage(name, 'ns_fun_trader')
		var res = event.getMerchantOffer().getResult()
		// карта клада: отметить покупку, метка Xaero и координаты
		var sid = ''
		try {
			var cd = res.get(NS_TR_DC.CUSTOM_DATA)
			if (cd) sid = String(cd.copyTag().getString('ns_stash'))
		} catch (x) {}
		var S = sid ? nsTrStashById(sid) : null
		if (S) {
			S.bought = name
			nsTrSave()
			nsTrStashPreview(res)
			var dx = S.x - p.getX(),
				dz = S.z - p.getZ()
			var title = NS_TR_STASH[S.kind].name
			p.tell(Text.gold('[Снабженец] ').append(Text.white(title + ': ')).append(Text.yellow('X ' + S.x + ', Z ' + S.z)).append(Text.gray(' — ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл. на ' + nsFunCompass(dx, dz) + '. Над местом будет столб света. Метка — строкой ниже.')))
			p.tell(Text.of('xaero-waypoint:' + (S.kind === 'camp' ? 'Схрон' : 'Клад') + ':' + (S.kind === 'camp' ? 'С' : 'К') + ':' + S.x + ':70:' + S.z + ':6:false:0:Internal-overworld-waypoints'))
		}
		var rid = nsFunId(res)
		if (rid.indexOf('dragon_egg') >= 0 || rid.indexOf('elytra') >= 0 || rid.indexOf('enchanted_golden_apple') >= 0 || rid.indexOf('netherite_upgrade') >= 0) {
			nsTellAll(Text.gold('[Снабженец] ').append(Text.white(name + ' купил редкость: ')).append(res.getHoverName()))
			NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound minecraft:ui.toast.challenge_complete master @a ~ ~ ~ 0.6 1.2')
		} else nsFunSound(name, 'minecraft:entity.experience_orb.pickup', 0.6, 1.4)
	} catch (e) {
		console.error('[снабженец] покупка: ' + e)
	}
})

// --------------------------------------------------------------------------
// «Ящик снабжения»: ПКМ — открыть
// --------------------------------------------------------------------------
ItemEvents.rightClicked('nightshift:supply_crate', event => {
	var opened = false
	try {
		var p = event.player
		if (!p || event.level.isClientSide()) return
		var cd = p.getCooldowns()
		if (cd.isOnCooldown(event.item.getItem())) return
		var name = nsFunName(p)
		var got = nsFunLoot(event.level, 'nightshift:trader/supply_crate', p.getX(), p.getY(), p.getZ(), p)
		event.item.shrink(1)
		var parts = []
		for (var i = 0; i < got.length; i++) {
			parts.push(got[i].getCount() + '× ' + String(got[i].getHoverName().getString()))
			p.give(got[i])
		}
		// артефакт смены — 4 % (как с волны на 2 выше лучшей пройденной)
		if (Math.random() < 0.04 && typeof nsCtArtifact === 'function' && typeof nsGiveLoot === 'function') {
			try {
				var art = nsCtArtifact(Math.max(1, (nsGetStateRO().phase || 0) + 2))
				if (art.length) {
					nsGiveLoot(p, art)
					parts.push('артефакт смены')
				}
			} catch (x) {}
		}
		cd.addCooldown(event.item.getItem(), 10)
		NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run particle minecraft:happy_villager ~ ~1.2 ~ 0.6 0.6 0.6 0 16 normal')
		NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run particle minecraft:firework ~ ~1.2 ~ 0.3 0.3 0.3 0.08 20 normal')
		nsFunSound(name, 'minecraft:block.barrel.open', 1, 1.1)
		nsFunSound(name, 'minecraft:entity.player.levelup', 0.6, 1.5)
		p.tell(Text.gold('[Ящик снабжения] ').append(Text.white(parts.length ? parts.join(', ') : 'пусто — бывает и такое. Бухгалтерия извиняется.')))
		opened = true
	} catch (e) {
		console.error('[снабженец] ящик: ' + e)
	}
	if (opened) event.cancel()
})

// --------------------------------------------------------------------------
// Команды
// --------------------------------------------------------------------------
// Команда внутри команды в 1.21 встаёт в очередь и выполнится ПОСЛЕ текущей: summon из обработчика /trader ещё не
// поставил бы снабженца, когда мы его ищем. Поэтому приход по команде — на следующем тике, ответ — тогда же.
function nsTrArriveLater(ctx, at) {
	var src = ctx.source
	NSG.nsServer.scheduleInTicks(1, function () {
		var msg
		try {
			msg = nsTrArrive(at)
		} catch (e) {
			msg = 'ошибка: ' + e
			console.error('[снабженец] приход: ' + e)
		}
		src.sendSystemMessage(Text.gold('[Снабженец] ').append(Text.white(String(msg))))
	})
	return 1
}

function nsTrStatus(src) {
	var st = nsTrState()
	var v = st.v
	var day = nsFunDay()
	if (v) {
		var left = Math.max(0, Math.round((v.leaveAt - nsTrNow()) / 1000))
		var line = Text.gold('[Снабженец] ').append(Text.white(v.name + ' у ')).append(Text.yellow(v.x + ' ' + v.y + ' ' + v.z)).append(Text.white(' ещё ' + left + ' ч, лотов ' + v.lots + '.'))
		var p = src.getPlayer()
		if (p && nsFunDim(p) === v.dim) {
			var dx = v.x - p.getX(),
				dz = v.z - p.getZ()
			line = line.append(Text.gray(' ' + nsFunArrow(p, dx, dz) + ' ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' бл. на ' + nsFunCompass(dx, dz) + '.'))
		}
		src.sendSystemMessage(line)
	} else {
		var wait = st.nextDay < 0 ? 1 : Math.max(0, st.nextDay - day)
		src.sendSystemMessage(Text.gold('[Снабженец] ').append(Text.white(wait > 0 ? 'Придёт утром через ' + nsFunPlural(wait, 'день', 'дня', 'дней') + '.' : 'Должен прийти этим или следующим утром (не во время набега).')))
	}
	src.sendSystemMessage(Text.gray('Лавка: ' + (st.post ? st.post.x + ' ' + st.post.y + ' ' + st.post.z + ' (/trader post clear — снова у алтаря)' : 'у алтаря базы (/trader post — поставить лавку там, где стоишь)') + '. Валюта — жетоны смены (фактории).'))
	return 1
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	function op(s) {
		return s.hasPermission(2)
	}
	function say(ctx, msg) {
		ctx.source.sendSystemMessage(Text.gold('[Снабженец] ').append(Text.white(String(msg))))
		return 1
	}
	event.register(
		C.literal('trader')
			.executes(ctx => nsTrStatus(ctx.source))
			.then(
				C.literal('post')
					.executes(ctx => {
						var p = ctx.source.getPlayer()
						if (!p) return 0
						var st = nsTrState()
						st.post = { dim: nsFunDim(p), x: Math.floor(p.getX()), y: Math.floor(p.getY()), z: Math.floor(p.getZ()) }
						nsTrSave()
						return say(ctx, 'Лавка снабженца — здесь (' + st.post.x + ' ' + st.post.y + ' ' + st.post.z + '). Следующий визит придёт сюда.')
					})
					.then(
						C.literal('clear').executes(ctx => {
							nsTrState().post = null
							nsTrSave()
							return say(ctx, 'Лавка убрана: снабженец снова встаёт у алтаря базы.')
						})
					)
			)
			.then(C.literal('call').requires(op).executes(ctx => nsTrArriveLater(ctx, null)))
			.then(
				C.literal('here')
					.requires(op)
					.executes(ctx => {
						var pos = ctx.source.getPosition()
						var dim = String(ctx.source.getLevel().getDimension())
						return nsTrArriveLater(ctx, { dim: dim, x: Math.floor(pos.x()), y: Math.floor(pos.y()), z: Math.floor(pos.z()), post: true })
					})
			)
			.then(C.literal('leave').requires(op).executes(ctx => say(ctx, nsTrLeave('команда'))))
			.then(
				C.literal('reroll')
					.requires(op)
					.executes(ctx => {
						var v = nsTrState().v
						var tr = v ? nsTrEntity(v) : null
						if (!tr) return say(ctx, 'снабженца нет (или его чанк не загружен)')
						var lots = nsTrRoll(nsTrLevel(v.dim), v.x, v.y, v.z)
						nsTrApplyOffers(tr, lots)
						v.lots = lots.length
						nsTrSave()
						var labels = []
						for (var i = 0; i < lots.length; i++) labels.push(String(lots[i].stack.getHoverName().getString()) + ' — ' + lots[i].price)
						return say(ctx, 'новый товар: ' + labels.join('; '))
					})
			)
			.then(
				C.literal('stash')
					.requires(op)
					.executes(ctx => {
						var list = nsTrState().stashes || []
						if (!list.length) return say(ctx, 'кладов нет')
						for (var i = 0; i < list.length; i++) {
							var S = list[i]
							say(ctx, S.id + ' ' + S.kind + ' ' + S.x + ' ' + S.z + (S.bought ? ' куплен (' + S.bought + ')' : ' не продан') + (S.placed ? ', сундук ' + S.y : '') + (S.done ? ', открыт' : ''))
						}
						return 1
					})
					.then(
						// проверка без клиента: клад вида treasure|camp рядом с точкой команды — «купить» и поставить сразу
						// (чанк грузится/генерируется); сундук и охрану видно через тик — команды внутри команды в очереди
						C.literal('test').then(
							C.argument('kind', A.STRING.create(event)).executes(ctx => {
								var kind = String(A.STRING.getResult(ctx, 'kind'))
								if (!NS_TR_STASH[kind]) return say(ctx, 'виды: treasure, camp')
								var level = NSG.nsServer.getOverworld()
								var pos = ctx.source.getPosition()
								var st = nsTrState()
								var visit = st.v ? st.v.seq : -1
								var map = nsTrStashMap(level, kind, Math.floor(pos.x()), Math.floor(pos.z()))
								if (!map) return say(ctx, 'место для клада не нашлось')
								var S = st.stashes[st.stashes.length - 1]
								S.bought = 'проверка'
								S.visit = visit
								level.getChunk(S.x >> 4, S.z >> 4)
								nsTrStashPlace(level, S)
								nsTrSave()
								return say(ctx, 'клад ' + S.id + ' (' + kind + '): сундук ' + S.x + ' ' + S.y + ' ' + S.z + ' — проверка: /execute in minecraft:overworld run data get block ' + S.x + ' ' + S.y + ' ' + S.z + ' LootTable')
							})
						)
					)
			)
			.then(
				// проверка без клиента: бот-покупатель берёт лот N (событие покупки — как у игрока)
				C.literal('testbuy').requires(op).then(
					C.argument('n', A.INTEGER.create(event)).executes(ctx => {
						var v = nsTrState().v
						var tr = v ? nsTrEntity(v) : null
						if (!tr) return say(ctx, 'снабженца нет')
						var offers = tr.getOffers()
						var n = A.INTEGER.getResult(ctx, 'n')
						if (n < 0 || n >= offers.size()) return say(ctx, 'лотов ' + offers.size())
						var offer = offers.get(n)
						var Factory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory')
						var Profile = Java.loadClass('com.mojang.authlib.GameProfile')
						var fp = Factory.get(tr.getLevel(), new Profile(NS_TR_UUID.fromString('6e737472-6164-4000-8000-000000000001'), 'Покупатель'))
						var EB = Java.loadClass('net.neoforged.neoforge.common.NeoForge').EVENT_BUS
						var before = offer.getUses()
						offer.increaseUses()
						EB.post(new NS_TR_TRADE_EV(fp, offer, tr))
						var res = offer.getResult()
						var cost = offer.getCostA().getCount() + (offer.getCostB().isEmpty() ? 0 : offer.getCostB().getCount())
						return say(ctx, 'куплено: ' + res.getCount() + '× ' + res.getHoverName().getString() + ' за ' + cost + ' жетонов (' + nsFunId(offer.getCostA()) + '), продано ' + before + '→' + offer.getUses() + ' из ' + offer.getMaxUses())
					})
				)
			)
			.then(
				C.literal('next').requires(op).then(
					C.argument('days', A.INTEGER.create(event)).executes(ctx => {
						var st = nsTrState()
						st.nextDay = nsFunDay() + Math.max(0, A.INTEGER.getResult(ctx, 'days'))
						nsTrSave()
						return say(ctx, 'следующий визит — день ' + st.nextDay + ' (сейчас ' + nsFunDay() + ')')
					})
				)
			)
	)
})
