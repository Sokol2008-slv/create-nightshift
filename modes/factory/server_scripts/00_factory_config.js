// ==========================================================================
// Режим «Завод: вал» — конфиг. Энергия только от центрального вала из скрытой
// машинной (творческие моторы, мощность мотора в create-server.toml = 16 SU/об),
// руда — из рудных точек, деньги — на бирже. Всё прокачивается за кредиты.
// KubeJS 2101 / Rhino: только var.
// ==========================================================================

var FS = {}

// Плоский мир: трава на y=-57, стоим на y=-56
FS.GROUND = -57
FS.SPAWN = [0, -56, 0]

// Машинная: бедроковая коробка x -24..-6, выход вала на (-5,-56,0)
FS.ROOM = { x1: -24, x2: -6, y1: -58, y2: -53, z1: -2, z2: 2 }
FS.SHAFT_Y = -56
FS.GEARBOX_X = [-7, -9, -11, -13, -15, -17, -19, -21] // по мотору под каждым редуктором
FS.OUTPUT = [-5, -56, 0]

// Уровни вала: моторы × обороты × 16 SU = мощность
FS.SHAFT_TIERS = [
	{ motors: 1, rpm: 16, price: 0 },
	{ motors: 1, rpm: 32, price: 150 },
	{ motors: 2, rpm: 32, price: 400 },
	{ motors: 3, rpm: 64, price: 1200 },
	{ motors: 4, rpm: 64, price: 2500 },
	{ motors: 5, rpm: 128, price: 6000 },
	{ motors: 6, rpm: 128, price: 10000 },
	{ motors: 8, rpm: 256, price: 25000 },
]
FS.SU_PER_RPM = 16

// Рудные точки (бочки): выдают руду в себя, забирать воронкой/жёлобом Create
FS.ORES = [
	{ key: 'andesite', item: 'minecraft:andesite', name: 'Андезит', pos: [8, -56, -6], unlock: 0, mult: 0.5 },
	{ key: 'iron', item: 'minecraft:raw_iron', name: 'Железо', pos: [8, -56, -3], unlock: 0, mult: 1 },
	{ key: 'copper', item: 'minecraft:raw_copper', name: 'Медь', pos: [8, -56, 0], unlock: 0, mult: 0.8 },
	{ key: 'coal', item: 'minecraft:coal', name: 'Уголь', pos: [8, -56, 3], unlock: 0, mult: 0.6 },
	{ key: 'zinc', item: 'create:raw_zinc', name: 'Цинк', pos: [8, -56, 6], unlock: 300, mult: 1.2 },
	{ key: 'gold', item: 'minecraft:raw_gold', name: 'Золото', pos: [8, -56, 9], unlock: 800, mult: 1.6 },
]
FS.ORE_RATES = [0, 0.5, 1, 2, 4, 8] // предметов в секунду по уровню точки
FS.ORE_UPGRADE = [0, 0, 80, 250, 700, 2000] // цена перехода на уровень (× mult руды)

// Биржа: бочка, всё из неё с ценой продаётся раз в секунду; сырьё не берут
FS.MARKET = [0, -56, 8]
FS.PRICES = {
	'minecraft:iron_ingot': 2,
	'minecraft:copper_ingot': 1,
	'minecraft:gold_ingot': 6,
	'minecraft:iron_nugget': 0.2,
	'minecraft:charcoal': 0.5,
	'minecraft:bread': 0.5,
	'create:andesite_alloy': 2,
	'create:zinc_ingot': 3,
	'create:brass_ingot': 8,
	'create:iron_sheet': 3,
	'create:copper_sheet': 2,
	'create:golden_sheet': 8,
	'create:brass_sheet': 10,
	'create:shaft': 1,
	'create:cogwheel': 4,
	'create:large_cogwheel': 6,
	'create:andesite_casing': 6,
	'create:copper_casing': 6,
	'create:brass_casing': 20,
	'create:electron_tube': 12,
	'create:belt_connector': 8,
	'create:precision_mechanism': 60,
	'create:rose_quartz': 4,
	'create:polished_rose_quartz': 7,
}
