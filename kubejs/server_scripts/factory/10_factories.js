// ==========================================================================
// Ночная смена — «Фактории и заказы» (04.10.2026; Георгий: «разбавить заказы и фактории, и системы вокруг них»).
// Завод делает «на экспорт», поезда и дирижабли возят. Механику держит аддон Axiomativ Industries 0.6.0
// (content/factory): постройки факторий в 800–1500 блоках от алтаря, терминал приёмки, заказы, касса, лавка, окно,
// команды /factory. Здесь — то, что знает только пак:
//  - НАСТРОЙКИ: какие предметы заказывать на какой волне (вес = «труд» штуки), цепочки, товары лавки, шутки;
//  - СИНХРОНИЗАЦИЯ: лучшая пройденная волна (state.phase) и алтари (state.altars) → аддону раз в 5 с;
//  - «ПРЕМИЯ СМЕНЫ»: купленная в лавке прибавка к броскам добычи — забирается при победе в набеге
//    (хук nsFactoryRaidBoost в raids/40_nightshift_raid.js, nsRaidRewards);
//  - команда /nsfactory_grant <ник> artifact — товар лавки «Наряд на артефакт» (её зовёт аддон от имени сервера).
// Формула заказа (FactoryOrders в аддоне): труд = 240 + 24 × волна (волна 15 → 600), 2–4 строки, штук = доля труда /
// вес; плата = труд / 30 × дальность 0,9–1,2 (волна 15 → ~20 жетонов); срочный (20 %) — срок 1 день, объём ×0,6,
// плата ×2. Срок обычного — 2–3 игровых дня, новый заказ — через 4 игровых часа после закрытия.
// ==========================================================================

var NSF_API = null
try {
	NSF_API = Java.loadClass('com.axiomativ.industries.content.factory.FactoryApi')
} catch (e) {
	console.warn('[nightshift] фактории: аддон Axiomativ Industries 0.6.0 не найден — фактории выключены: ' + e)
}

// Предмет заказов: [id, вес (труд штуки), с волны, по волну, не больше штук в строке]
var NSF_ITEMS = [
	// основы Create — первые волны
	['create:andesite_alloy', 1, 0, 25, 256],
	['create:iron_sheet', 1.5, 0, 35, 256],
	['create:copper_sheet', 1.5, 0, 35, 256],
	['create:cogwheel', 1.5, 0, 30, 192],
	['create:large_cogwheel', 2.5, 0, 30, 128],
	['create:shaft', 1, 0, 20, 128],
	['create:andesite_casing', 3, 0, 35, 128],
	['create:copper_casing', 3, 2, 35, 128],
	['create:fluid_pipe', 1.2, 2, 35, 256],
	['create:belt_connector', 3, 0, 25, 32],
	// латунь и механизмы
	['create:zinc_ingot', 1.5, 4, 40, 256],
	['create:brass_ingot', 2.5, 6, 50, 256],
	['create:track', 1.5, 6, 50, 256],
	['create:brass_sheet', 3, 8, 50, 192],
	['create:brass_casing', 4, 8, 55, 128],
	['create:golden_sheet', 3, 8, 45, 128],
	['create:precision_mechanism', 14, 10, 70, 64],
	['create:electron_tube', 6, 10, 60, 128],
	['create:polished_rose_quartz', 4, 10, 50, 128],
	['create:railway_casing', 5, 10, 60, 96],
	// ток (заряд молнии с 15-й волны) и самолёты
	['nightshift:electric_copper', 4, 15, 100000, 128],
	['createaddition:copper_wire', 1, 15, 60, 256],
	['createaddition:copper_spool', 6, 15, 60, 64],
	['create_new_age:overcharged_iron', 6, 15, 70, 96],
	['createaddition:electrum_ingot', 5, 18, 100000, 128],
	['createaddition:electrum_wire', 3, 20, 100000, 192],
	['immersive_aircraft:hull', 8, 12, 60, 64],
	['immersive_aircraft:sail', 4, 12, 50, 64],
	['immersive_aircraft:propeller', 6, 15, 60, 48],
	['immersive_aircraft:boiler', 8, 15, 60, 48],
	['immersive_aircraft:engine', 20, 15, 80, 24],
	['immersive_aircraft:industrial_gears', 8, 18, 70, 48],
	['immersive_aircraft:sturdy_pipes', 6, 18, 70, 48],
	['immersive_aircraft:gyroscope', 8, 18, 70, 32],
	['immersive_aircraft:enhanced_propeller', 10, 25, 80, 32],
	['immersive_aircraft:steel_boiler', 20, 25, 90, 24],
	// сталь, нефть, электроника
	['tfmg:steel_ingot', 4, 20, 100000, 256],
	['tfmg:cast_iron_ingot', 3, 20, 70, 192],
	['tfmg:steel_mechanism', 18, 25, 100000, 48],
	['tfmg:heavy_plate', 10, 25, 100000, 64],
	['createaddition:capacitor', 10, 25, 100000, 48],
	['create_new_age:overcharged_gold', 10, 25, 100000, 64],
	['tfmg:aluminum_ingot', 4, 27, 100000, 192],
	['tfmg:nickel_ingot', 3, 27, 100000, 192],
	['tfmg:lead_ingot', 3, 27, 100000, 192],
	['tfmg:plastic_sheet', 6, 30, 100000, 128],
	['tfmg:capacitor_item', 10, 30, 100000, 48],
	['tfmg:magnetic_alloy_ingot', 8, 30, 100000, 64],
	['tfmg:circuit_board', 12, 32, 100000, 48],
	['tfmg:lithium_ingot', 6, 35, 100000, 96],
	['tfmg:n_semiconductor', 12, 40, 100000, 48],
	['tfmg:p_semiconductor', 12, 40, 100000, 48],
	['northstar:circuit', 20, 40, 100000, 32],
	['create_new_age:overcharged_diamond', 40, 45, 100000, 16],
	// космос
	['northstar:titanium_sheet', 12, 60, 100000, 96],
	['northstar:hardened_precision_mechanism', 30, 60, 100000, 24],
	['northstar:advanced_circuit', 40, 60, 100000, 16],
	['northstar:tungsten_sheet', 16, 65, 100000, 64],
	['northstar:martian_steel_sheet', 16, 65, 100000, 64],
]

function nsfItems(list) {
	var out = []
	for (var i = 0; i < list.length; i++) out.push({ id: list[i][0], w: list[i][1], from: list[i][2] || 0, to: list[i][3] || 100000, max: list[i][4] || 512 })
	return out
}

// Цепочки: шаги по очереди на одной фактории; за всю цепочку — премия (доля суммы платы) и посылка
var NSF_CHAINS = [
	{
		key: 'bridge',
		name: 'Мост через реку',
		desc: 'Соседнюю ветку отрезало рекой — фактория строит мост. Три поставки подряд, не сорвите сроки.',
		from: 6,
		to: 30,
		chance: 0.3,
		bonusMult: 0.5,
		bonus: [['nightshift:vein_seed_iron', 1]],
		steps: [
			{ title: 'Опоры', items: nsfItems([['create:andesite_alloy', 1], ['create:iron_sheet', 1.5], ['create:andesite_casing', 3]]) },
			{ title: 'Пролёт и рельсы', items: nsfItems([['create:track', 1.5], ['create:metal_girder', 2], ['create:iron_sheet', 1.5]]) },
			{ title: 'Разводной механизм', items: nsfItems([['create:cogwheel', 1.5], ['create:large_cogwheel', 2.5], ['create:mechanical_bearing', 12, 0, 100000, 16]]) },
		],
	},
	{
		key: 'airfield',
		name: 'Аэродром у фактории',
		desc: 'Фактория строит свой аэродром: ангар, моторный цех, навигация. Премия — заряд молнии.',
		from: 15,
		to: 45,
		chance: 0.3,
		bonusMult: 0.5,
		bonus: [['nightshift:lightning_charge', 1]],
		steps: [
			{ title: 'Ангар', items: nsfItems([['immersive_aircraft:hull', 8], ['immersive_aircraft:sail', 4]]) },
			{ title: 'Моторный цех', items: nsfItems([['immersive_aircraft:engine', 20, 0, 100000, 24], ['immersive_aircraft:boiler', 8], ['immersive_aircraft:propeller', 6]]) },
			{ title: 'Связь и навигация', items: nsfItems([['immersive_aircraft:gyroscope', 8], ['nightshift:electric_copper', 4], ['createaddition:copper_wire', 1]]) },
		],
	},
	{
		key: 'moon_station',
		name: 'Снабдить станцию на Луне',
		desc: 'Подготовка к космосу: на Луне ставят станцию — каркас, воздух, ток. Премия — железный скафандр.',
		from: 40,
		to: 100000,
		chance: 0.35,
		bonusMult: 0.6,
		bonus: [['northstar:iron_space_suit_helmet', 1], ['northstar:iron_space_suit_chestpiece', 1], ['northstar:iron_space_suit_leggings', 1], ['northstar:iron_space_suit_boots', 1]],
		steps: [
			{ title: 'Каркас станции', items: nsfItems([['tfmg:heavy_plate', 10], ['create:industrial_iron_block', 3], ['tfmg:steel_ingot', 4]]) },
			{ title: 'Жизнеобеспечение', items: nsfItems([['tfmg:plastic_sheet', 6], ['create:fluid_tank', 5], ['create:fluid_pipe', 1.2], ['northstar:circuit', 20, 0, 100000, 32]]) },
			{ title: 'Энергия и связь', items: nsfItems([['createaddition:capacitor', 10], ['tfmg:circuit_board', 12], ['createaddition:electrum_wire', 3]]) },
		],
	},
]

// Лавка: цены в жетонах, limit — на всю команду за сезон (10 игровых дней), from — с какой волны
function nsfProbe(type, label, price, from, limit, desc) {
	return { key: 'probe_' + type, kind: 'item', item: 'nightshift:vein_seed_' + type, count: 1, price: price, limit: limit, from: from, group: 'probe', label: 'Зонд жилы: ' + label, desc: desc || 'ПКМ по земле — бесконечная жила в чанке, ставьте буровую Create Ore Excavation' }
}
var NSF_SHOP = [
	{ key: 'raid_boost', kind: 'raid_boost', value: 0.5, price: 15, limit: 3, from: 1, label: 'Премия смены', desc: '+50 % бросков добычи за следующую победу в набеге (одна за раз)' },
	{ key: 'haste', kind: 'effect', effect: 'minecraft:haste', amp: 1, seconds: 900, price: 5, limit: 6, from: 0, icon: 'minecraft:golden_pickaxe', label: 'Ударная смена', desc: 'Спешка II на 15 минут всем в сети' },
	{ key: 'artifact', kind: 'command', command: 'nsfactory_grant %player% artifact', price: 30, limit: 2, from: 5, icon: 'minecraft:nether_star', label: 'Наряд на артефакт', desc: 'Артефакт смены — как с волны на 5 выше лучшей пройденной' },
	{ key: 'night_heart', kind: 'item', item: 'nightshift:night_heart', count: 1, price: 120, limit: 2, from: 20, label: 'Сердце ночи', desc: '+1 сердце максимума навсегда (не больше 5). Не больше двух за сезон на команду' },
	{ key: 'lightning', kind: 'item', item: 'nightshift:lightning_charge', count: 1, price: 40, limit: 1, from: 15, desc: 'Второй заряд — вторая линия электрической меди' },
	{ key: 'totem', kind: 'item', item: 'minecraft:totem_of_undying', count: 1, price: 25, limit: 2, from: 15 },
	{ key: 'tonic', kind: 'item', item: 'nightshift:life_tonic', count: 2, price: 8, limit: 4, from: 0, desc: 'Лечит раны — сердца, потерянные за смерти' },
	{ key: 'sedative', kind: 'item', item: 'nightshift:sedative', count: 4, price: 3, limit: 8, from: 0 },
	{ key: 'xp', kind: 'item', item: 'minecraft:experience_bottle', count: 16, price: 4, limit: 4, from: 0 },
	{ key: 'nether_engine', kind: 'item', item: 'immersive_aircraft:nether_engine', count: 1, price: 35, limit: 1, from: 25, desc: 'Лучший мотор самолёта — без незеритового слитка' },
	{ key: 'seeds_torch', kind: 'item', item: 'minecraft:torchflower_seeds', count: 4, price: 4, limit: 3, from: 0, desc: 'Редкие семена: факельник' },
	{ key: 'seeds_pitcher', kind: 'item', item: 'minecraft:pitcher_pod', count: 2, price: 5, limit: 3, from: 0, desc: 'Редкие семена: кувшинка-ловушка' },
	{ key: 'sniffer', kind: 'item', item: 'minecraft:sniffer_egg', count: 1, price: 12, limit: 1, from: 0, desc: 'Нюхач выкапывает древние семена' },
	nsfProbe('coal', 'уголь', 12, 1, 2),
	nsfProbe('copper', 'медь', 12, 1, 2),
	nsfProbe('iron', 'железо', 16, 4, 2),
	nsfProbe('zinc', 'цинк', 16, 4, 2),
	nsfProbe('quartz', 'кварц', 20, 8, 2),
	nsfProbe('redstone', 'редстоун', 20, 8, 2),
	nsfProbe('sulfur', 'сера', 20, 8, 2),
	nsfProbe('gold', 'золото', 24, 14, 2),
	nsfProbe('lapis', 'лазурит', 24, 14, 2),
	nsfProbe('lead', 'свинец', 30, 20, 2),
	nsfProbe('nickel', 'никель', 30, 20, 2),
	nsfProbe('lithium', 'литий', 36, 27, 2),
	nsfProbe('glowstone', 'светокамень', 36, 27, 2),
	nsfProbe('platinum', 'платина', 44, 35, 1),
	nsfProbe('thorium', 'торий', 52, 43, 1),
	nsfProbe('diamond', 'алмазы', 64, 50, 1),
	nsfProbe('titanium', 'титан', 72, 60, 1, 'Работает только на планетах'),
	nsfProbe('tungsten', 'вольфрам', 72, 60, 1, 'Работает только на Меркурии'),
	nsfProbe('martian_iron', 'марсианское железо', 72, 60, 1, 'Работает только на Марсе'),
]

var NSF_FLAVORS = [
	'Заказчик: шахта «Глубокая». Пишут: «Срочно, но не очень».',
	'Бухгалтерия напоминает: сданное не возвращается. Даже если очень жалко.',
	'Депо на соседней линии чинит паровоз. Третий раз за неделю.',
	'Отдел снабжения: «Нам вчера надо было». Как всегда.',
	'Старый мост съела орда. Буквально. Нужен новый.',
	'Строители вышки связи. Связь будет. Когда-нибудь.',
	'Склад пустой, кладовщик грустный. Помогите кладовщику.',
	'Пресс-служба: «Это для выставки достижений». Каких — не уточняют.',
	'Заказчик просил «как в прошлый раз, только больше».',
	'Техника безопасности: груз не кидать. Груз класть. Поездом.',
	'Отдел по работе с ордой просит запчасти для ловушек.',
	'Аэроклуб строит ангар. Пилоты уже купили кепки.',
	'Юротдел: сдача после срока — не сдача, а подарок.',
	'Служба доставки: «Мы бы сами привезли, но у нас лапки».',
	'ОТК: «Ржавое не примем». Ржавого и не делаем.',
]

var NSF_CONFIG = {
	count: 3,
	distMin: 900,
	distMax: 1400,
	minSpacing: 500,
	pauseHours: 4,
	daysMin: 2,
	daysMax: 3,
	urgentChance: 0.2,
	urgentDays: 1,
	urgentMult: 2,
	budgetBase: 240,
	budgetPerWave: 24,
	budgetMax: 3000,
	effortPerToken: 30,
	distMultMin: 0.9,
	distMultMax: 1.2,
	linesMin: 2,
	linesMax: 4,
	warnHours: 2,
	quietPosts: true, // 07.10: обычный новый заказ — без строки в чат, его показывает утренняя сводка смены (shift/40_summary.js); срочный — в чат
	seasonDays: 10,
	items: nsfItems(NSF_ITEMS),
	chains: NSF_CHAINS,
	shop: NSF_SHOP,
	flavors: NSF_FLAVORS,
}

function nsfConfigure() {
	if (!NSF_API) return false
	var r = String(NSF_API.configure(JSON.stringify(NSF_CONFIG)))
	if (r.indexOf('сервер') === 0) return false // сервер ещё не поднят — повторим из тика
	console.info('[nightshift] фактории: настройки отправлены — ' + r)
	return true
}

// /reload: сервер уже есть — отправить сразу; первый запуск — из ServerEvents.loaded
var NSF_CONFIGURED = nsfConfigure()

ServerEvents.loaded(event => {
	try {
		NSF_CONFIGURED = nsfConfigure()
	} catch (e) {
		console.error('[nightshift] фактории: настройки — ' + e)
	}
})

// Волна и алтари → аддону (раз в 5 с). Базой станет первый алтарь верхнего мира.
ServerEvents.tick(event => {
	if (!NSF_API || event.server.getTickCount() % 100 !== 13) return
	try {
		if (!NSF_CONFIGURED) NSF_CONFIGURED = nsfConfigure()
		if (typeof nsGetStateRO !== 'function') return
		var st = nsGetStateRO()
		var altars = []
		for (var i = 0; i < (st.altars || []).length; i++) {
			var a = st.altars[i]
			altars.push({ id: a.id, dim: a.dim, x: a.x, y: a.y, z: a.z })
		}
		NSF_API.sync(st.phase || 0, JSON.stringify(altars))
	} catch (e) {
		console.error('[nightshift] фактории: синхронизация — ' + e)
	}
})

// Хук 40_nightshift_raid.js (nsRaidRewards): «премия смены» из лавки факторий — больше бросков добычи
function nsFactoryRaidBoost(rolls, d) {
	if (!NSF_API) return rolls
	try {
		var b = Number(NSF_API.takeRaidBoost())
		if (!(b > 0)) return rolls
		var more = Math.max(1, Math.round(rolls * b))
		nsTellAll(Text.gold('[Фактории] Премия смены: ').append(Text.white('+' + Math.round(b * 100) + ' % добычи — ' + nsPlural(more, 'бросок', 'броска', 'бросков') + ' сверху каждому.')))
		return rolls + more
	} catch (e) {
		console.error('[nightshift] фактории: премия смены — ' + e)
		return rolls
	}
}

// Товары лавки, которые выдаёт пак (аддон зовёт от имени сервера): /nsfactory_grant <ник> artifact
ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	event.register(
		Commands.literal('nsfactory_grant')
			.requires(src => src.hasPermission(2))
			.then(
				Commands.argument('name', Arguments.STRING.create(event)).then(
					Commands.argument('what', Arguments.STRING.create(event)).executes(ctx => {
						var name = String(Arguments.STRING.getResult(ctx, 'name'))
						var what = String(Arguments.STRING.getResult(ctx, 'what'))
						var p = ctx.source.getServer().getPlayerList().getPlayerByName(name)
						if (!p) return 0
						try {
							if (what === 'artifact' && typeof nsCtArtifact === 'function' && typeof nsGiveLoot === 'function') {
								var st = nsGetState()
								var got = nsCtArtifact(Math.max(1, (st.phase || 0) + 5))
								if (!got.length) {
									p.tell(Text.red('[Фактории] Артефакт не выпал — жетоны целы, попробуйте ещё раз.'))
									return 0
								}
								nsGiveLoot(p, got)
								return 1
							}
						} catch (e) {
							console.error('[nightshift] фактории: выдача ' + what + ' — ' + e)
						}
						return 0
					})
				)
			)
	)
})
