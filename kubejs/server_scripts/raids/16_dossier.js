// ==========================================================================
// Ночная смена — досье волн, бестиарий и «Пульт алтаря» (04.10.2026, поток C).
// Георгий: «можно какую-то удобную менюшку для волн сделать? А то в чате — неудобно»; «бестиарий — очень крутая
// штука»; «досье волн очень надо: запустим волну и не поймём, что за фигня, почему проигрываем».
//
//  - Досье волны: подволны по составу nsChallengeHorde(d) с условиями смены (nsApplyMutators) — у каждого моба
//    число на команду, здоровье с усилениями волны, удар, метки угроз (летает, невидимый, подрывник, лезет по
//    стенам, плодит детёнышей, бронированный, сквозь щит / по щиту / выжигает щит, босс, быстрый) и советы «чем
//    бить»; босс, условия смены, тема арены, добыча и шансы артефактов.
//  - Бестиарий: моб открывается после первой встречи в набеге — state.bestiary {ключ: волна} в общем состоянии
//    набегов (10_nightshift_state.js), отметка — при выходе подволны (хук в nsSpawnCurrentWave, 40_). Всё, что
//    стояло в уже пройденных волнах, считается встреченным (старые миры без поля bestiary).
//  - В чате на старте каждой подволны — одна строка досье: «Подволна 3: невидимые — нужен прожектор; летуны — ПВО».
//  - «Пульт алтаря» — окно аддона Axiomativ Industries 0.5.0 (AltarMenu.open): ПКМ по алтарю открывает его вместо
//    меню в чате. Нет аддона у игрока — прежнее меню в чате (30_nightshift_altar.js, nsShowAltarMenuChat).
//    Окно шлёт обычные команды: /nightshift start N, /nsmut <ключ>, /nsart reforge, /arena,
//    /nightshift menu_json <с какой> <выбранная> (обновить данные).
//
// Команды (любой игрок): /nightshift menu_json [с какой волны] [выбранная] — открыть/обновить пульт;
// /nightshift dossier <N> — досье волны N текстом в чат (и в консоль).
// Правило Rhino: только var; Java-строки — через String().
// ==========================================================================

// Окно аддона (нет аддона в сборке — null, остаётся меню в чате)
var NS_DOS_AM = null
try {
	NS_DOS_AM = Java.loadClass('com.axiomativ.industries.content.altar.AltarMenu')
} catch (e) {
	console.info('[nightshift] пульт алтаря: аддона Axiomativ Industries 0.5+ нет — меню набегов в чате')
}

// --------------------------------------------------------------------------
// Метки угроз. Порядок — приоритет в досье и в строке чата. icon — предмет-значок в окне («potion:…» — зелье).
// --------------------------------------------------------------------------
NSG.NS_DOS_THREATS = [
	{ key: 'inv', name: 'Невидимые', short: 'невидимые — нужен прожектор', tip: 'их не видно: прожектор (подсвечивает орду) или спектральные стрелы. Последние мобы подволны сами подсвечиваются через 20 с', icon: 'potion:invisibility' },
	{ key: 'fly', name: 'Летают', short: 'летуны — ПВО', tip: 'стены не помогут: луки, арбалеты, зенитные турели, крыша над алтарём. До алтаря долетев, не проваливают набег — пикируют на защитников', icon: 'minecraft:phantom_membrane' },
	{ key: 'kami', name: 'Подрывники', short: 'подрывники — сбивай на подходе', tip: 'бегут к стене и взрываются (дыра ~2 блока, у тяжеловеса — втрое больше), рядом с игроком — тоже взрыв. Одного удара хватает: луки и турели на подходе. Машины и обсидиан не берут', icon: 'minecraft:tnt' },
	{ key: 'pierce', name: 'Сквозь щит', short: 'идут сквозь щит — держи оборону внутри купола', tip: 'проходят купол генератора щита насквозь — нужна оборона и внутри купола', icon: 'minecraft:arrow' },
	{ key: 'breaker', name: 'Ломают щит', short: 'ломают щит — бей их первыми', tip: 'бьют по куполу ×10 — их первыми, иначе купол рухнет', icon: 'minecraft:mace' },
	{ key: 'drain', name: 'Выжигают щит', short: 'выжигают щит — держи запас FE', tip: 'выжигают запас FE генератора щита — запас и подзарядка с запасом, их — первыми', icon: 'minecraft:redstone' },
	{ key: 'brood', name: 'Плодят детёнышей', short: 'плодят детёнышей — бей по площади', tip: 'плодят личинок (на ходу, от ударов или при смерти) — бей по площади: размашистый меч, огнемёт, взрывы; не давай копиться у алтаря', icon: 'minecraft:turtle_egg' },
	{ key: 'climb', name: 'Лезут по стенам', short: 'лезут по стенам — нужен козырёк', tip: 'стену без козырька переползают — козырёк наружу в 2–3 блока или крыша над алтарём', icon: 'minecraft:ladder' },
	{ key: 'armor', name: 'Бронированные', short: 'броня — тяжёлое оружие', tip: 'стрелы и слабые удары отскакивают — тяжёлое оружие, «Острота», пушки', icon: 'minecraft:iron_chestplate' },
	{ key: 'fast', name: 'Быстрые', short: 'быстрые — ловушки на подходе', tip: 'добегают за секунды — ловушки и турели на подходе, от них не убежать', icon: 'minecraft:sugar' },
	{ key: 'caster', name: 'Колдуны', short: 'колдуны — снимать первыми', tip: 'колдуют из-за спин орды: клыки, огонь, призыв мертвецов. Стены от заклинаний не спасают — стрелки, турели и тесла по колдунам первыми', icon: 'minecraft:enchanted_book' },
	{ key: 'split', name: 'Делятся', short: 'делятся при гибели — бей по площади', tip: 'особая стадия «Гидра»: убитый моб делится на двоих поменьше — огнемёт, взрывы, размашистый меч', icon: 'minecraft:slime_ball' },
	{ key: 'champion', name: 'Чемпионы', short: 'чемпионы ×4 — пушки по ним', tip: 'условие «Чемпионы»: светящийся моб ×4 здоровья в каждой подволне — тяжёлое оружие и пушки по нему', icon: 'minecraft:golden_helmet' },
	{ key: 'boss', name: 'Босс', short: 'босс в конце — пушки и турели по готовности', tip: 'в конце волны — пушки и турели по готовности, держите дистанцию; пока жив, волна не кончится', icon: 'minecraft:wither_skeleton_skull' },
]
var NS_DOS_TH = {}
for (var nsDti = 0; nsDti < NSG.NS_DOS_THREATS.length; nsDti++) NS_DOS_TH[NSG.NS_DOS_THREATS[nsDti].key] = NSG.NS_DOS_THREATS[nsDti]

// Плодят детёнышей (ArPhEx): выводок лопается на личинок, рыщущий плодит на ходу, матриарх / выселитель / моль — когда
// их бьют, краб-душитель — при смерти (40_nightshift_raid.js, NS_MINION_TYPES)
var NS_DOS_BROOD = { 'arphex:spider_brood': 1, 'arphex:spider_prowler': 1, 'arphex:spider_matriarch': 1, 'arphex:centipede_evictor': 1, 'arphex:crab_constrictor': 1, 'arphex:spider_moth': 1 }

// Быстрый: скорость шага от этой (зомби 0,23, паук 0,3, подрывник 0,38) или «Скорость» в NBT / у всей орды
var NS_DOS_FAST_SPEED = 0.36
// Бронированный: броня от этой (зомби 2) или железная/алмазная/незеритовая броня в NBT
var NS_DOS_ARMOR_MIN = 4

// Ванильные мобы набегов — имя и совет для бестиария (модовые — из NS_MOD_MOBS, 08_modded_waves.js)
var NS_DOS_VANILLA = {
	'minecraft:zombie': ['Зомби', 'Пехота орды: медленный, но толпой грызёт стены. Держи строй у алтаря.'],
	'minecraft:husk': ['Кадавр', 'Зомби пустыни: удар насылает голод. Еда — под рукой.'],
	'minecraft:drowned': ['Утопленник', 'С трезубцем бьёт издалека — не стой на открытом месте.'],
	'minecraft:skeleton': ['Скелет', 'Стреляет издалека: щит, укрытия, турели по стрелкам.'],
	'minecraft:stray': ['Зимогор', 'Стрелы замедляют. Укрытия и щит.'],
	'minecraft:bogged': ['Трясинный скелет', 'Стрелы отравляют. Молоко — в карман.'],
	'minecraft:spider': ['Паук', 'Лезет по стенам: нужен козырёк или крыша над алтарём.'],
	'minecraft:cave_spider': ['Пещерный паук', 'Мелкий, ядовитый, пролезает в щели в один блок.'],
	'minecraft:slime': ['Слизень', 'Делится при смерти — добивай мелочь.'],
	'minecraft:witch': ['Ведьма', 'Кидает зелья и лечится. Сбивай первой — стрелами.'],
	'minecraft:vindicator': ['Поборник', 'Топор бьёт больно — не подпускай вплотную.'],
	'minecraft:pillager': ['Разбойник', 'Арбалетчик: укрытия и щит.'],
	'minecraft:evoker': ['Заклинатель', 'Вызывает вредин и клыки из-под земли. Убей первым.'],
	'minecraft:illusioner': ['Иллюзионист', 'Ослепляет и множит копии — бей по настоящему.'],
	'minecraft:ravager': ['Опустошитель', 'Таран на 100 HP: сбивает с ног. Пушки и тяжёлое оружие.'],
	'minecraft:phantom': ['Фантом', 'Кружит над алтарём и пикирует: луки, арбалеты, зенитки.'],
	'minecraft:breeze': ['Вихрь', 'Отбивает снаряды и сбивает с ног вихрем — бей вблизи.'],
	'minecraft:wither_skeleton': ['Визер-скелет', 'Удар насылает иссушение — не стой в ближнем бою долго.'],
	'minecraft:zoglin': ['Зоглин', 'Бешеный, подбрасывает. Держи дистанцию.'],
	'minecraft:magma_cube': ['Магмовый куб', 'Прыгает и делится при смерти. Огнестойкость.'],
	'minecraft:piglin_brute': ['Брут пиглинов', 'Громила с топором: 50 HP, бьёт очень больно.'],
	'minecraft:hoglin': ['Хоглин', 'Подбрасывает. Держи дистанцию.'],
	'minecraft:vex': ['Вредина', 'Летает сквозь стены и висит над алтарём. ПВО и ближний бой.'],
	'minecraft:silverfish': ['Чешуйница', 'Рой: мелкие, их много. Бей по площади.'],
	'artifacts:mimic': ['Подражатель', 'После смерти всегда роняет артефакт — пиньята!'],
}
// Именные ванильные варианты и боссы прежних сложностей
var NS_DOS_NAMED_TIPS = {
	'Бегун': 'Зомби со «Скоростью II». Ловушки на подходе.',
	'Громила': 'Зомби на 60 HP. Тяжёлое оружие.',
	'Тень': 'Невидимый паук: прожектор или спектральные стрелы.',
	'Вожак орды': 'Босс 5-й и 10-й волн: зомби в железе, «Скорость I» и «Сила I», здоровье растёт с волной.',
	'Всадник Кошмара': 'Визер-скелет верхом на опустошителе. Сначала скакуна — пушки.',
	'Рыцарь Кошмара': 'Визер-скелет в незерите с мечом. Тяжёлое оружие.',
	'Мёртвый король': 'Босс Iron\'s Spells: броня 15, удар 10, колдует. Пушки и тяжёлое оружие; держитесь вместе.',
	'Эхо Тироса': 'Босс Iron\'s Spells: огненные заклинания и броня 15. Огнестойкость и пушки; блоки его огонь не жжёт.',
	'Магистр цитадели': 'Древний рыцарь-босс: медленный, меч бьёт больно. Бей и отходи.',
}
// Колдуны (метка «Колдуны»): модовые — флаг caster в NS_MOD_MOBS (08_), здесь — остальные
var NS_DOS_CASTERS = { 'cataclysm:deepling_priest': 1, 'cataclysm:deepling_warlock': 1, 'minecraft:evoker': 1, 'irons_spellbooks:necromancer': 1, 'irons_spellbooks:cultist': 1, 'irons_spellbooks:archevoker': 1 }

// --------------------------------------------------------------------------
// Справочники: базовые атрибуты (аддон), модовые мобы по id, ключи бестиария
// --------------------------------------------------------------------------
NSG.nsDosStatsCache = {}
// {hp, dmg, armor, speed} по атрибутам моба (AltarMenu.mobStats) или null
function nsDosStats(id) {
	id = String(id)
	if (NSG.nsDosStatsCache[id] !== undefined) return NSG.nsDosStatsCache[id]
	var out = null
	try {
		var a = NS_DOS_AM ? NS_DOS_AM.mobStats(id) : null
		if (a) out = { hp: Number(a[0]), dmg: Number(a[1]), armor: Number(a[2]), speed: Number(a[3]) }
	} catch (e) {}
	NSG.nsDosStatsCache[id] = out
	return out
}

// Первый ключ NS_MOD_MOBS с этим id — «базовый» моб, остальные с тем же id — особые варианты (королева шнырей…)
function nsDosModBase() {
	if (NSG.nsDosModBaseMap) return NSG.nsDosModBaseMap
	var m = {}
	for (var k in NSG.NS_MOD_MOBS || {}) {
		var id = NSG.NS_MOD_MOBS[k].id
		if (!m[id]) m[id] = k
	}
	NSG.nsDosModBaseMap = m
	return m
}

function nsDosCustomName(nbt) {
	var mt = String(nbt || '').match(/CustomName:'"([^"]+)"'/)
	return mt ? mt[1] : null
}

// Ключ бестиария: id моба; у особых вариантов и именных — id#вариант
function nsDosKey(e, isBoss) {
	var id = String(e.id)
	var M = NSG.NS_MOD_MOBS || {}
	if (e.key && M[e.key]) return nsDosModBase()[id] === e.key ? id : id + '#' + e.key
	var cn = nsDosCustomName(e.nbt)
	if (cn) return id + '#' + cn
	return id
}

// Имя для бестиария (не подпись строки состава: там «Стрекоза-дредноут — сквозь щит»)
function nsDosName(e, isBoss) {
	var id = String(e.id)
	var M = NSG.NS_MOD_MOBS || {}
	if (e.key && M[e.key]) return M[e.key].name
	if (isBoss && e.label) return String(e.label)
	var cn = nsDosCustomName(e.nbt)
	if (cn) return cn
	var mk = nsDosModBase()[id]
	if (mk) return M[mk].name
	if (NS_DOS_VANILLA[id]) return NS_DOS_VANILLA[id][0]
	var lb = String(e.label || id.split(':')[1])
	return lb.charAt(0).toUpperCase() + lb.substring(1)
}

function nsDosTip(e, isBoss, th) {
	var id = String(e.id)
	var M = NSG.NS_MOD_MOBS || {}
	if (e.key && M[e.key]) return M[e.key].tip
	var cn = nsDosCustomName(e.nbt)
	if (cn && NS_DOS_NAMED_TIPS[cn]) return NS_DOS_NAMED_TIPS[cn]
	if (isBoss) {
		var t = ''
		if (id.indexOf('cataclysm:') === 0) t = 'Босс Cataclysm: у него потолок урона за удар и в секунду — лишние пушки не ускорят, нужна выдержка.'
		else if (id.indexOf('arphex:') === 0) t = 'Босс ArPhEx: скорость +20 %, здоровье растёт с волной. Пушки и турели — по нему.'
		else t = 'Босс: здоровье растёт с волной. Пушки и турели — по нему.'
		if (th && th.fly) t += ' Летает — купол щита и зенитки.'
		if (th && th.brood) t += ' Плодит личинок — бей по площади.'
		return t
	}
	var mk = nsDosModBase()[id]
	if (mk) return M[mk].tip
	if (NS_DOS_VANILLA[id]) return NS_DOS_VANILLA[id][1]
	return ''
}

function nsDosHasTag(e, tag) {
	var t = e.tags || []
	for (var i = 0; i < t.length; i++) if (String(t[i]) === tag) return true
	return false
}

function nsDosCmFlying(id) {
	var L = NSG.NS_CATACLYSM_BOSSES || []
	for (var i = 0; i < L.length; i++) if (L[i].id === id) return !!L[i].flying
	return false
}

// Метки угроз строки состава: {ключ: true}. buff — бафф орды (Ярость: вся орда быстрая)
function nsDosThreatSet(e, isBoss, buff) {
	var id = String(e.id)
	var nbt = String(e.nbt || '')
	var st = nsDosStats(id)
	var out = {}
	if (nbt.indexOf('minecraft:invisibility') >= 0) out.inv = true
	var flyers = typeof NS_FLYERS !== 'undefined' ? NS_FLYERS : {}
	if (flyers[id] || (NSG.NS_MOD_FLYERS && NSG.NS_MOD_FLYERS[id]) || nsDosCmFlying(id)) out.fly = true
	if (nsDosHasTag(e, 'ns_kamikaze')) out.kami = true
	if (nsDosHasTag(e, 'ns_shield_pierce')) out.pierce = true
	if (nsDosHasTag(e, 'ns_shield_breaker')) out.breaker = true
	if (nsDosHasTag(e, 'ns_shield_drain')) out.drain = true
	if (NS_DOS_BROOD[id]) out.brood = true
	if (NS_DOS_CASTERS[id] || (e.key && NSG.NS_MOD_MOBS && NSG.NS_MOD_MOBS[e.key] && NSG.NS_MOD_MOBS[e.key].caster)) out.caster = true
	if (nsDosHasTag(e, 'ns_champion')) out.champion = true
	if (id.indexOf('spider') >= 0 && !out.fly) out.climb = true
	var armored = /ArmorItems:\[[^\]]*(iron|diamond|netherite)_(helmet|chestplate|leggings|boots)/.test(nbt)
	if (st && st.armor >= NS_DOS_ARMOR_MIN) armored = true
	if (!st && !armored && (id.indexOf('arphex:') === 0 || id.indexOf('cataclysm:') === 0) && (e.hp || 0) >= 60) armored = true
	if (armored) out.armor = true
	var fastNbt = nbt.indexOf('minecraft:speed') >= 0 || nbt.indexOf('generic.movement_speed",base:0.3') >= 0
	if (fastNbt || (st && st.speed >= NS_DOS_FAST_SPEED && !out.fly) || (buff && buff.speed > 0)) out.fast = true
	if (isBoss) out.boss = true
	return out
}

// Метки по порядку приоритета
function nsDosThreatList(set) {
	var out = []
	for (var i = 0; i < NSG.NS_DOS_THREATS.length; i++) if (set[NSG.NS_DOS_THREATS[i].key]) out.push(NSG.NS_DOS_THREATS[i].key)
	return out
}

// Базовое здоровье строки состава (без усилений волны)
function nsDosBaseHp(e, isBoss) {
	if (isBoss && e.hpLabel) return Number(e.hpLabel)
	if (e.hp) return Number(e.hp)
	var mh = String(e.nbt || '').match(/generic\.max_health",base:([0-9.]+)/)
	if (mh) return Number(mh[1])
	var T = NSG.NIGHTSHIFT_MOB_HP
	if (T[String(e.id)]) return T[String(e.id)]
	var st = nsDosStats(e.id)
	return st && st.hp > 0 ? st.hp : 20
}

// Боссы конфига волны строками состава: [{e, n}]
function nsDosBossRows(cfg) {
	var out = []
	if (!cfg || !cfg.boss) return out
	out.push({ e: cfg.boss, n: cfg.bossCount || 1 })
	for (var i = 0; cfg.bossExtra && i < cfg.bossExtra.length; i++) out.push({ e: cfg.bossExtra[i].boss, n: cfg.bossExtra[i].count || 1 })
	return out
}

// --------------------------------------------------------------------------
// Каталог бестиария: все мобы волн 1–100 (без условий смены), с какой волны впервые. Считается один раз за загрузку
// скриптов (~100 составов орды).
// --------------------------------------------------------------------------
function nsDosCatalog() {
	if (NSG.nsDosCat) return NSG.nsDosCat
	var t0 = Date.now()
	var cat = { list: [], by: {} }
	function add(e, isBoss, d) {
		var k = nsDosKey(e, isBoss)
		if (cat.by[k]) return
		var th = nsDosThreatSet(e, isBoss, null)
		var st = nsDosStats(e.id)
		var c = { k: k, id: String(e.id), name: nsDosName(e, isBoss), hp: Math.round(nsDosBaseHp(e, isBoss)), dmg: st && st.dmg > 0 ? Math.round(st.dmg * 10) / 10 : 0, armor: st && st.armor > 0 ? Math.round(st.armor) : 0, th: nsDosThreatList(th), tip: nsDosTip(e, isBoss, th), from: d, boss: !!isBoss }
		cat.by[k] = c
		cat.list.push(c)
	}
	for (var d = 1; d <= NSG.NS_WAVES_MAX; d++) {
		var cfg
		try {
			cfg = nsChallengeHorde(d)
		} catch (e) {
			continue
		}
		for (var w = 0; w < cfg.waves.length; w++) for (var i = 0; i < cfg.waves[w].length; i++) add(cfg.waves[w][i], false, d)
		var br = nsDosBossRows(cfg)
		for (var b = 0; b < br.length; b++) add(br[b].e, true, d)
	}
	// варианты боссов для фарма (08_: alt) — первое прохождение их не показывает, но в бестиарии им место
	var alts = typeof NSG.nsModBossAll === 'function' ? NSG.nsModBossAll() : []
	for (var a = 0; a < alts.length; a++) add(alts[a].boss, true, alts[a].d)
	NSG.nsDosCat = cat
	console.info('[nightshift] бестиарий: ' + cat.list.length + ' мобов в каталоге (' + (Date.now() - t0) + ' мс)')
	return cat
}

// Волна первой встречи с мобом k или 0. Пройденные волны — встречены (старые миры без state.bestiary)
function nsDosSeen(state, k) {
	var b = (state && state.bestiary) || {}
	if (b[k]) return b[k]
	var c = nsDosCatalog().by[k]
	return c && c.from <= (state.phase || 0) ? c.from : 0
}

// --------------------------------------------------------------------------
// Досье волны d. opts: {state, players, inArena, cfg (готовый состав, без пересчёта)}
// --------------------------------------------------------------------------
var NS_DOS_BUFF_NAMES = { resistance: 'сопротивление', strength: 'сила', speed: 'скорость' }
var NS_DOS_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

function nsDosPct(x) {
	return Math.round(x * 100)
}

function nsDosWaveState(d, best) {
	return d <= best ? 'done' : d === best + 1 ? 'next' : 'locked'
}

function nsDosWaveTitle(d, name) {
	return (d > NSG.NS_WAVES_MAX ? 'Бесконечность ' + (d - NSG.NS_WAVES_MAX) : 'Волна ' + d) + ' · ' + name
}

// Праздник без приставки «Кошмар · » — для клетки сетки
function nsDosShortName(name) {
	var s = String(name)
	var i = s.indexOf(' · ')
	return i >= 0 ? s.substring(i + 3) : s
}

// withTip — совет прямо в досье: моб показан (волна открыта), но в бестиарии ещё не открыт (премьера следующей волны)
function nsDosMob(e, n, scale, buff, isBoss, known, withTip) {
	var thSet = nsDosThreatSet(e, isBoss, buff)
	var st = nsDosStats(e.id)
	var hp = Math.round(nsDosBaseHp(e, isBoss) * (1 + ((scale && scale.hp) || 0)))
	var dmg = st && st.dmg > 0 ? Math.round((st.dmg * (1 + ((scale && scale.damage) || 0)) + 3 * ((buff && buff.strength) || 0)) * 10) / 10 : 0
	var m = { k: nsDosKey(e, isBoss), id: String(e.id), name: isBoss ? String(e.label || nsDosName(e, true)) : String(e.label || nsDosName(e, false)), n: n, hp: hp, dmg: dmg, th: nsDosThreatList(thSet), known: !!known }
	if (m.name.length) m.name = m.name.charAt(0).toUpperCase() + m.name.substring(1)
	// совет моба окно берёт из бестиария по ключу k (в каждом досье не повторяем — JSON вдвое меньше)
	if (known && withTip) m.tip = nsDosTip(e, isBoss, thSet)
	if (!known) {
		m.name = '???'
		m.id = ''
		m.k = ''
	}
	return m
}

function nsDosDossier(d, opts) {
	var state = opts.state
	var best = state.phase || 0
	var st = nsDosWaveState(d, best)
	var raw = opts.raw || nsChallengeHorde(d)
	var cfg = typeof nsApplyMutators === 'function' ? nsApplyMutators(raw, state, d) : raw
	var party = opts.players || 1
	var scale = cfg.scale || {}
	var bscale = cfg.bossScale || cfg.scale || {}
	var buff = cfg.buff || {}
	var mult = party * (cfg.mult || 1)
	var reveal = st !== 'locked' // впереди — только уже встреченные мобы, остальные «???»
	var subs = []
	var all = {}
	var total = 0
	for (var w = 0; w < cfg.waves.length; w++) {
		var mobs = []
		var subTh = {}
		var subHp = 0
		for (var i = 0; i < cfg.waves[w].length; i++) {
			var e = cfg.waves[w][i]
			var n = Math.ceil(e.count * mult)
			var seenAt = nsDosSeen(state, nsDosKey(e, false))
			var m = nsDosMob(e, n, scale, buff, false, reveal || seenAt > 0, reveal && !seenAt)
			mobs.push(m)
			subHp += m.hp * n
			for (var t = 0; t < m.th.length; t++) {
				subTh[m.th[t]] = true
				all[m.th[t]] = true
			}
		}
		total += subHp
		subs.push({ hp: subHp, th: nsDosThreatList(subTh), mobs: mobs })
	}
	if (cfg.split) all.split = true
	var bosses = []
	var br = nsDosBossRows(cfg)
	for (var b = 0; b < br.length; b++) {
		var bSeen = nsDosSeen(state, nsDosKey(br[b].e, true))
		var bm = nsDosMob(br[b].e, br[b].n, bscale, buff, true, reveal || bSeen > 0, reveal && !bSeen)
		bosses.push(bm)
		total += bm.hp * br[b].n
		for (var bt = 0; bt < bm.th.length; bt++) all[bm.th[bt]] = true
	}
	var buffs = []
	for (var bf in buff) if (buff[bf] > 0 && NS_DOS_BUFF_NAMES[bf]) buffs.push(NS_DOS_BUFF_NAMES[bf] + ' ' + NS_DOS_ROMAN[Math.min(5, Math.round(buff[bf]))])
	var sc = []
	if (scale.hp > 0) sc.push('здоровье +' + nsDosPct(scale.hp) + ' %')
	else if (scale.hp < 0) sc.push('здоровье ' + nsDosPct(scale.hp) + ' %')
	if (scale.damage > 0) sc.push('урон +' + nsDosPct(scale.damage) + ' %')
	if (scale.speed > 0) sc.push('скорость +' + nsDosPct(scale.speed) + ' %')
	if (scale.size > 1) sc.push('крупнее ×' + scale.size.toFixed(2).replace('.', ','))
	var name = String(cfg.name || raw.name || '')
	var dos = {
		n: d,
		title: nsDosWaveTitle(d, nsDosShortName(name)),
		st: st,
		subs: subs,
		boss: bosses,
		total: Math.round(total),
		buffs: buffs.join(', '),
		scale: sc.join(', '),
		th: nsDosThreatList(all),
	}
	// особая стадия (45_special_stages.js): неуязвимость орды или сценарий вместо подволн
	if (raw.special) {
		var sl = []
		try {
			sl = typeof nsSpecialForecast === 'function' ? nsSpecialForecast(raw, d).slice(1) : [raw.special.need]
		} catch (e) {
			sl = [raw.special.need || '']
		}
		var spl = []
		for (var si = 0; si < sl.length; si++) if (sl[si]) spl.push(String(sl[si]))
		dos.special = { name: String(raw.special.name), kind: String(raw.special.kind || ''), lines: spl }
	}
	// ночной вызов этой ночи (48_night_call.js) — блоком особой стадии
	var co = typeof nsCallOffer === 'function' ? nsCallOffer(state) : null
	if (co && co.wave === d && !dos.special) dos.special = { name: 'Ночной вызов', kind: 'call', lines: [nsCallText(co), '«Старт» на этой волне до рассвета — принять вызов: 3 подволны, условие «' + nsCallMutName(co.mut) + '».'] }
	// премьера / звезда вечера (08_modded_waves.js)
	if (raw.star) {
		var sk = nsDosKey(raw.star, false)
		var sKnown = reveal || nsDosSeen(state, sk) > 0
		var stip = sKnown ? String(raw.star.tip || '') : 'узнаете, когда волна откроется'
		var cos = raw.costars || []
		var sname = sKnown ? String(raw.star.name) : '???'
		for (var ci = 0; ci < cos.length; ci++) {
			var cKnown = reveal || nsDosSeen(state, nsDosKey(cos[ci], false)) > 0
			sname += ' и ' + (cKnown ? cos[ci].name : '???')
			if (cKnown) stip += ' ' + cos[ci].name + ': ' + cos[ci].tip
		}
		if (reveal && raw.prep) stip += ' Готовьтесь: ' + raw.prep
		if (reveal && raw.guest) stip += ' Гастроли «' + raw.guest.name + '»: ' + raw.guest.tip + '.'
		dos.star = { id: sKnown ? String(raw.star.id) : '', name: sname, tip: stip, prem: !!raw.premiere }
	}
	// условия смены
	var set = typeof nsMutSet === 'function' && !raw.scenario ? nsMutSet(state) : {} // сценарий — без условий смены
	var mn = []
	var me = []
	for (var mi = 0; NSG.NS_MUTATORS && mi < NSG.NS_MUTATORS.length; mi++) {
		var mu = NSG.NS_MUTATORS[mi]
		if (!set[mu.key]) continue
		mn.push(mu.name)
		me.push(mu.desc)
	}
	if (mn.length) dos.mut = { names: mn, effects: me, bonus: nsDosPct(nsMutBonus(set, d)) }
	// арена
	if (NSG.nsArenaThemeFor) {
		var th = NSG.nsArenaThemeFor(d)
		dos.arena = { name: th.name, note: th.note || '', color: th.color || 'aqua' }
	}
	dos.loot = nsDosLoot(d, raw, cfg, state, opts)
	var fh = typeof nsFailHearts === 'function' ? nsFailHearts(d, !!opts.inArena) : 1
	var ahp = set.fragile ? 1 : NSG.NIGHTSHIFT_TUNABLES.altarHp || 1
	var fl = 'Алтарь выдержит ' + nsPlural(ahp, 'моба', 'моба', 'мобов') + ' (босс — за двоих); дальше провал: −' + nsPlural(fh, 'сердце', 'сердца', 'сердец') + ' у всех, добычи нет. Проклятие снимают победы.'
	if (co && co.wave === d) fl = 'Ночной вызов: провал без последствий. ' + fl
	if (raw.special && raw.special.kind === 'hold') fl = 'Пали все три рубежа или кончилась прочность алтаря — провал: −' + nsPlural(fh, 'сердце', 'сердца', 'сердец') + ' у всех.'
	dos.fail = fl + (set.iron ? ' «Железная воля»: смерть любого защитника — провал' : '')
	// можно ли начать (проклятие больше не запирает алтарь — 05.10)
	var why = ''
	if (st === 'locked') why = 'Закрыта — сначала пройдите волну ' + (best + 1)
	else if (opts.raidActive) why = 'Идёт набег — алтарь занят'
	dos.canStart = !why
	if (why) dos.why = why
	return dos
}

// Добыча волны: броски, примеры обычной таблицы, шансы редкого и артефактов, бонусы первого прохождения
function nsDosLoot(d, raw, cfg, state, opts) {
	var L = NSG.NIGHTSHIFT_LOOT
	var tier = nsWaveTier(d)
	var k = nsWaveLate(d)
	// бросков — как у набега (nsRaidRolls, 40_: там же сценарии особых стадий), с бонусом условий смены
	var rolls = typeof nsRaidRolls === 'function' ? nsRaidRolls(d) : raw.waves.length + (raw.boss ? 2 * (raw.bossCount || 1) : 0) + k
	var bonus = typeof nsMutBonus === 'function' ? nsMutBonus(nsMutSet(state), d) : 0
	if (bonus > 0) rolls = Math.round(rolls * (1 + bonus / 2))
	var items = []
	var common = L.common[tier] || []
	for (var c = 0; c < common.length && items.length < 6; c++) items.push([String(common[c][2] || common[c][0]).split('[')[0], common[c][1]])
	var first = d > (state.phase || 0)
	var out = { rolls: rolls, items: items, rare: nsDosPct(L.rareChance), art: nsDosPct(Math.min(1, (L.artifactChance[tier] || 0) + 0.01 * k)) }
	if (typeof NSG.nsNsArtifactHoverText === 'function') {
		try {
			var bosses = []
			var br = nsDosBossRows(raw)
			for (var b = 0; b < br.length; b++) if (bosses.indexOf(String(br[b].e.id)) < 0) bosses.push(String(br[b].e.id))
			var th = opts.inArena && NSG.nsArenaThemeFor ? NSG.nsArenaThemeFor(d).key : null
			out.nsArt = String(NSG.nsNsArtifactHoverText(d, first, { arena: !!opts.inArena, theme: th, bosses: bosses, players: opts.players || 1 }))
		} catch (e) {}
	}
	if (k > 0) out.late = 'С 70-й волны: ' + nsPlural(1 + Math.floor(k / 6), 'особый бросок', 'особых броска', 'особых бросков') + ' — череп визера, незеритовая броня и оружие с чарами, элитры, маяк'
	if (first) {
		var fb = []
		if (k === 0 && nsWaveAnchor(d)[1] === 0) fb.push('зонд жилы на команду')
		if (d >= 20 && d % 5 === 0) fb.push('сильный артефакт каждому')
		if (nsWaveGivesHeart(d)) fb.push('Сердце ночи каждому')
		if (fb.length) out.first = fb.join(', ')
		var ms = NSG.NS_WAVE_MILESTONES[d]
		if (ms) out.ms = ms.text
	}
	return out
}

// Сводка волны для клетки сетки
function nsDosWaveCell(d, dos, best) {
	var th = []
	for (var i = 0; i < dos.th.length; i++) if (dos.th[i] !== 'boss') th.push(dos.th[i])
	var c = { n: d, label: d > NSG.NS_WAVES_MAX ? '∞' + (d - NSG.NS_WAVES_MAX) : String(d), name: nsDosShortName(dos.title.substring(dos.title.indexOf(' · ') + 3)), st: dos.st, boss: dos.boss.length > 0, ms: !!(NSG.NS_WAVE_MILESTONES[d] && d > best), th: th }
	if (dos.star && dos.star.prem) c.prem = dos.star.name
	if (dos.special) c.special = dos.special.name
	return c
}

// --------------------------------------------------------------------------
// Данные пульта целиком (схема — в AltarMenu.java аддона). view: {from, sel, tab}
// --------------------------------------------------------------------------
NSG.NS_DOS_PAGE = 20
NSG.nsAltarView = NSG.nsAltarView || {}

function nsDosMenuData(player, state, view) {
	var t0 = Date.now()
	var best = state.phase || 0
	var next = best + 1
	var raidOn = nsRaidActive(state)
	var raidWave = raidOn ? (state.raid.kind === 'minor' ? nsMinorWave(best) : state.raid.difficulty || 1) : 0
	var players = Math.round((nsPartyScale() - 1) / 0.5) + 1
	var inArena = !!player && String(player.getLevel().getDimension()) === 'nightshift:arena'
	var P = NSG.NS_DOS_PAGE
	var last = Math.max(NSG.NS_WAVES_MAX, next)
	var sel = view && view.sel > 0 ? Math.floor(view.sel) : raidWave || next
	var from = view && view.from > 0 ? Math.floor(view.from) : Math.floor((sel - 1) / P) * P + 1
	from = Math.max(1, Math.min(from, Math.floor((last - 1) / P) * P + 1))
	if (sel < from || sel >= from + P) sel = Math.max(from, Math.min(from + P - 1, sel))
	var data = { v: 1, best: best, next: next, max: NSG.NS_WAVES_MAX, players: players, inArena: inArena, sel: sel, page: { from: from, size: P, last: last } }
	if (view && view.tab) data.tab = view.tab
	data.raid = { active: raidOn, wave: raidWave, sub: raidOn && !state.raid.bossSpawned ? state.raid.waveIndex + 1 : 0, subs: 0, boss: raidOn && !!state.raid.bossSpawned }
	data.curse = { hearts: state.curse || 0, text: '' }
	if ((state.curse || 0) > 0) {
		var tr = nsTributeFor(best)
		data.curse.text = 'Проклятие алтаря: −' + nsPlural(state.curse, 'сердце', 'сердца', 'сердец') + ' у всех. Снимает победа на волне ' + Math.max(1, best - (NSG.NIGHTSHIFT_TUNABLES.curseLiftWindow || 5)) + '+ (сердце за победу) или сразу — ' + tr.count + ' ' + tr.label + ' за сердце: ПКМ стопкой по алтарю или конвейером.'
	}
	var msn = null
	for (var m in NSG.NS_WAVE_MILESTONES) if (Number(m) > best && (msn === null || Number(m) < msn)) msn = Number(m)
	if (msn !== null) data.milestone = { n: msn, text: NSG.NS_WAVE_MILESTONES[msn].text }
	// ночной вызов этой ночи — вместо вехи в верхней строке «Волн»
	var callOffer = typeof nsCallOffer === 'function' ? nsCallOffer(state) : null
	if (callOffer) data.milestone = { n: callOffer.wave, text: 'НОЧНОЙ ВЫЗОВ до рассвета — «Старт» на этой волне: 3 подволны, условие «' + nsCallMutName(callOffer.mut) + '», премия — артефакт смены. Отказ и провал без штрафа.' }
	data.spawns = 0
	try {
		var altar = player ? nsNearestAltar(state, player.createCommandSourceStack()) : null
		if (altar && altar.spawns) data.spawns = altar.spawns.length
	} catch (e) {}
	// сетка и досье страницы
	data.waves = []
	data.dossiers = {}
	var opts = { state: state, players: players, inArena: inArena, raidActive: raidOn }
	for (var d = from; d < from + P; d++) {
		var dos
		try {
			dos = nsDosDossier(d, opts)
		} catch (e) {
			console.error('[nightshift] досье волны ' + d + ': ' + e)
			continue
		}
		data.dossiers[String(d)] = dos
		data.waves.push(nsDosWaveCell(d, dos, best))
		if (raidOn && d === raidWave) data.raid.subs = dos.subs.length
	}
	if (raidOn && !data.raid.subs) {
		try {
			data.raid.subs = nsHordeCfg(state).waves.length
		} catch (e) {}
	}
	// легенда меток
	data.threats = {}
	for (var i = 0; i < NSG.NS_DOS_THREATS.length; i++) {
		var T = NSG.NS_DOS_THREATS[i]
		data.threats[T.key] = { name: T.name, short: T.short, tip: T.tip, icon: T.icon }
	}
	// условия смены
	var mset = state.mutators || {}
	data.mut = { list: [], bonus: nsDosPct(typeof nsMutBonus === 'function' ? nsMutBonus(mset, next) : 0), locked: raidOn }
	// афиша дня (12_mutators.js): в окне 7 строк, условий 12
	var poster = typeof nsMutPoster === 'function' ? nsMutPoster(state) : NSG.NS_MUTATORS || []
	for (var mi = 0; mi < poster.length; mi++) {
		var mu = poster[mi]
		data.mut.list.push({ key: mu.key, name: mu.name, desc: mu.desc, bonus: nsDosPct(mu.bonus), on: !!mset[mu.key] })
	}
	// контракты бригадира
	data.contracts = []
	try {
		var cl = nsCtBoard(state)
		for (var ci = 0; ci < cl.length; ci++) {
			var c = cl[ci]
			var items = []
			for (var ri = 0; ri < c.reward.items.length; ri++) items.push([String(c.reward.items[ri][0]), c.reward.items[ri][1]])
			data.contracts.push({ text: String(c.text), have: Math.min(c.have || 0, c.need || 1), need: c.need || 1, done: !!c.done, reward: 'артефакт смены как с волны ' + c.reward.artWave, items: items })
		}
	} catch (e) {
		console.warn('[nightshift] пульт: контракты: ' + e)
	}
	// артефакты смены
	data.art = nsDosArt(player, next)
	// бестиарий
	var cat = nsDosCatalog()
	data.bestiary = []
	var seenN = 0
	for (var b = 0; b < cat.list.length; b++) {
		var e = cat.list[b]
		var s = nsDosSeen(state, e.k)
		if (s > 0) seenN++
		var row = { k: e.k, id: s > 0 ? e.id : '', name: s > 0 ? e.name : '???', hp: e.hp, dmg: e.dmg, armor: e.armor, th: s > 0 ? e.th : [], tip: s > 0 ? e.tip : '', from: e.from, seen: s, boss: e.boss }
		data.bestiary.push(row)
	}
	data.bestSeen = seenN
	data.bestTotal = cat.list.length
	if (!NSG.nsDosTimeLogged) {
		console.info('[nightshift] пульт алтаря: данные собраны за ' + (Date.now() - t0) + ' мс (дальше в лог не пишу)')
		NSG.nsDosTimeLogged = true
	}
	return data
}

// Вкладка «Артефакты»: план переплавки, что в инвентаре, шансы на следующей волне
function nsDosArt(player, next) {
	var out = { inv: [], rule: 'Переплавка: 3 артефакта волн одного уровня (в инвентаре, не в слотах) → 1 случайный следующего уровня, до мифического. Сначала повторы. Трофеи и артефакты арены не переплавляются.' }
	if (typeof NS_ART === 'undefined') return out
	try {
		var R = NS_ART.reforge
		out.rule = 'Переплавка: ' + R.n + ' артефакта волн одного уровня (в инвентаре, не в слотах) → 1 случайный следующего уровня, до ' + NS_ART.tiers[R.maxTier].gen.replace(/их$/, 'ого') + '. Сначала повторы. Трофеи и артефакты арены не переплавляются.'
		var plan = player && typeof nsArtReforgePlan === 'function' ? nsArtReforgePlan(player) : null
		if (plan) {
			var ids = []
			for (var i = 0; i < plan.take.length; i++) ids.push(String(plan.take[i].id))
			out.plan = { from: NS_ART.tiers[plan.tier].gen, to: NS_ART.tiers[plan.tier + 1].name, n: R.n, items: ids }
		}
		var inv = player ? player.getInventory() : null
		var by = {}
		for (var s = 0; inv && s < 36; s++) {
			var id = nsArtItemId(inv.getItem(s))
			var e = NS_ART.items[id]
			if (!e || typeof e !== 'object') continue
			if (!by[id]) {
				by[id] = { id: id, name: e.name, tier: e.tier, tierName: NS_ART.tiers[e.tier].name + (e.pool === 'wave' ? '' : ' (не переплавляется)'), count: 0 }
				out.inv.push(by[id])
			}
			by[id].count += inv.getItem(s).getCount()
		}
		out.inv.sort(function (a, b) {
			return a.tier - b.tier
		})
		if (typeof NSG.nsNsArtifactHoverText === 'function') out.odds = 'На следующей волне (' + next + '): ' + String(NSG.nsNsArtifactHoverText(next, true))
	} catch (e) {
		console.warn('[nightshift] пульт: артефакты: ' + e)
	}
	return out
}

// --------------------------------------------------------------------------
// Открыть пульт. Нет аддона у игрока — false (вызывающий покажет меню в чате).
// --------------------------------------------------------------------------
function nsAltarScreenOk(player) {
	try {
		return !!(NS_DOS_AM && player && NS_DOS_AM.canOpen(player))
	} catch (e) {
		return false
	}
}

// view: {from, sel, tab} — не задан, берём последний вид игрока (листание и выбор переживают переключение условий)
function nsAltarScreenSend(player, state, view, open) {
	if (!nsAltarScreenOk(player)) return false
	try {
		var name = String(player.getUsername())
		var v = view || NSG.nsAltarView[name] || {}
		NSG.nsAltarView[name] = { from: v.from || 0, sel: v.sel || 0 }
		var data = nsDosMenuData(player, state || nsGetState(), v)
		return !!NS_DOS_AM.open(player, JSON.stringify(data), !!open)
	} catch (e) {
		console.error('[nightshift] пульт алтаря не открыт: ' + e)
		return false
	}
}

// ПКМ по алтарю и nsShowAltarMenu (30_): from > 0 — с какой волны (листание из чата)
function nsAltarScreenOpen(player, state, from) {
	var name = String(player.getUsername())
	var v = NSG.nsAltarView[name] || {}
	return nsAltarScreenSend(player, state, from > 0 ? { from: from, sel: 0 } : { from: v.from || 0, sel: v.sel || 0 }, true)
}

// Кнопка в сообщении «идёт набег» (30_): досье текущей волны — окном или текстом
function nsDosRaidButton(player) {
	try {
		var st = nsGetState()
		if (!nsRaidActive(st)) return Text.of('')
		var d = st.raid.kind === 'minor' ? nsMinorWave(st.phase) : st.raid.difficulty || 1
		var cmd = nsAltarScreenOk(player) ? '/nightshift menu_json 0 ' + d : '/nightshift dossier ' + d
		return Text.of(' ').append(Text.yellow('[Досье волны]').clickRunCommand(cmd).hover(Text.gray('Состав, метки угроз и чем бить')))
	} catch (e) {
		return Text.of('')
	}
}

// --------------------------------------------------------------------------
// Строка досье в чат на старте подволны + отметки бестиария. Зовётся из nsSpawnCurrentWave (40_) до спавна:
// wave — строки состава подволны или undefined (дальше босс или победа). Пишет в state (его сохраняет 40_).
// --------------------------------------------------------------------------
function nsDossierOnSpawn(state, hordeCfg, wave) {
	try {
		if (!state || !state.raid || !hordeCfg) return
		var boss = !wave
		if (boss && (!hordeCfg.boss || state.raid.bossSpawned)) return
		var tag = state.raid.rid + ':' + state.raid.waveIndex + ':' + (boss ? 'b' : 'w')
		if (NSG.nsDosLastLine === tag) return // повтор спавна той же подволны — строку не дублируем
		NSG.nsDosLastLine = tag
		var d = Math.max(1, Math.round(Number(state.raid.kind === 'minor' ? nsMinorWave(state.phase) : state.raid.difficulty || 1)))
		var rows = []
		if (boss) {
			var br = nsDosBossRows(hordeCfg)
			for (var b = 0; b < br.length; b++) rows.push({ e: br[b].e, n: br[b].n })
		} else {
			var mult = nsPartyScale() * (hordeCfg.mult || 1)
			for (var i = 0; i < wave.length; i++) rows.push({ e: wave[i], n: Math.ceil(wave[i].count * mult) })
		}
		state.bestiary = state.bestiary || {}
		var fresh = []
		var thAll = {}
		var parts = []
		for (var r = 0; r < rows.length; r++) {
			var e = rows[r].e
			var k = nsDosKey(e, boss)
			if (!state.bestiary[k]) {
				state.bestiary[k] = d
				fresh.push(nsDosName(e, boss))
			}
			var ts = nsDosThreatSet(e, boss, hordeCfg.buff)
			for (var t in ts) thAll[t] = true
			parts.push(rows[r].n + '× ' + (boss ? String(e.label || nsDosName(e, true)) : String(e.label || nsDosName(e, false))))
		}
		var keys = nsDosThreatList(thAll)
		var shorts = []
		var tips = []
		for (var j = 0; j < keys.length; j++) {
			if (keys[j] === 'boss') continue
			shorts.push(NS_DOS_TH[keys[j]].short)
			tips.push(NS_DOS_TH[keys[j]].name + ' — ' + NS_DOS_TH[keys[j]].tip)
		}
		var head = boss ? 'Босс «' + (hordeCfg.boss.label || nsDosName(hordeCfg.boss, true)) + '»' : 'Подволна ' + (state.raid.waveIndex + 1)
		var line = head + ': ' + (shorts.length ? shorts.join('; ') : boss ? 'пушки и турели — по нему' : 'без сюрпризов — держите строй')
		var hover = Text.gold(head).append(Text.white('\n' + parts.join(', ')))
		for (var h = 0; h < tips.length; h++) hover = hover.append(Text.gray('\n• ' + tips[h]))
		if (fresh.length) hover = hover.append(Text.lightPurple('\nВ бестиарии: ' + fresh.join(', ')))
		var msg = Text.gold('[Ночная смена] ').append(Text.yellow(line))
		if (fresh.length) msg = msg.append(Text.lightPurple(' (+' + fresh.length + ' в бестиарий)'))
		nsTellAll(msg.hover(hover))
	} catch (e) {
		console.error('[nightshift] строка досье: ' + e)
	}
}

// Досье волны текстом (чат без аддона, консоль)
function nsDosChatLines(d, state) {
	var dos = nsDosDossier(d, { state: state, players: Math.round((nsPartyScale() - 1) / 0.5) + 1, inArena: false, raidActive: nsRaidActive(state) })
	var out = []
	var scen = dos.special && dos.special.kind === 'scenario'
	out.push(Text.gold('[Ночная смена] Досье: ' + dos.title + (scen ? ' — сценарий вместо подволн' : ' — ~' + dos.total + ' HP')))
	if (dos.special) out.push(Text.lightPurple('Особая стадия «' + dos.special.name + '»: ').append(Text.white(dos.special.lines.join(' '))))
	if (dos.star) out.push(Text.yellow((dos.star.prem ? 'Премьера: ' : 'Звезда вечера: ') + dos.star.name).append(Text.gray(' — ' + dos.star.tip)))
	for (var s = 0; s < dos.subs.length; s++) {
		var sub = dos.subs[s]
		var ps = []
		for (var i = 0; i < sub.mobs.length; i++) ps.push(sub.mobs[i].n + '× ' + sub.mobs[i].name + ' (' + sub.mobs[i].hp + ' HP)')
		var sh = []
		for (var t = 0; t < sub.th.length; t++) sh.push(NS_DOS_TH[sub.th[t]].short)
		out.push(Text.white('Подволна ' + (s + 1) + ': ' + ps.join(', ')).append(sh.length ? Text.red(' — ' + sh.join('; ')) : Text.of('')))
	}
	for (var b = 0; b < dos.boss.length; b++) out.push(Text.red('Босс: ' + dos.boss[b].n + '× ' + dos.boss[b].name + ' (~' + dos.boss[b].hp + ' HP)'))
	for (var k = 0; k < dos.th.length; k++) {
		var T = NS_DOS_TH[dos.th[k]]
		if (T.key !== 'boss') out.push(Text.gray('• ' + T.name + ' — ' + T.tip))
	}
	if (!scen && (dos.buffs || dos.scale)) out.push(Text.gray('Мобы: ' + [dos.buffs, dos.scale].filter(function (x) { return !!x }).join(' · ')))
	if (dos.mut) out.push(Text.red('Условия смены: ' + dos.mut.names.join(', ') + ' — добыча +' + dos.mut.bonus + ' %'))
	if (dos.arena) out.push(Text.aqua('Арена: «' + dos.arena.name + '» — ' + dos.arena.note))
	return out
}

// Каталог бестиария — при старте сервера (первый расчёт ~1 с, пока прогревается Rhino), а не на первом ПКМ по алтарю
ServerEvents.loaded(event => {
	try {
		nsDosCatalog()
	} catch (e) {
		console.warn('[nightshift] бестиарий: каталог не собран: ' + e)
	}
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	var A = event.arguments
	function menuJson(ctx, from, sel, open) {
		var p = ctx.source.getPlayer()
		if (!p) return 0
		try {
			var st = nsGetState()
			if (!nsAltarScreenOk(p)) {
				// без аддона — досье текстом
				var lines = nsDosChatLines(sel > 0 ? sel : (st.phase || 0) + 1, st)
				for (var i = 0; i < lines.length; i++) p.tell(lines[i])
				return 1
			}
			return nsAltarScreenSend(p, st, { from: from, sel: sel }, open) ? 1 : 0
		} catch (e) {
			console.error('[nightshift] /nightshift menu_json: ' + e)
			return 0
		}
	}
	// «nightshift» уже есть (50_nightshift_admin.js) — Brigadier сливает ветки одного имени
	event.register(
		C.literal('nightshift')
			.then(
				C.literal('menu_json')
					.executes(ctx => menuJson(ctx, 0, 0, true))
					.then(
						C.argument('from', A.INTEGER.create(event))
							.executes(ctx => menuJson(ctx, Number(A.INTEGER.getResult(ctx, 'from')), 0, true))
							// из окна: обновить открытое, не открывать заново
							.then(C.argument('sel', A.INTEGER.create(event)).executes(ctx => menuJson(ctx, Number(A.INTEGER.getResult(ctx, 'from')), Number(A.INTEGER.getResult(ctx, 'sel')), false)))
					)
			)
			.then(
				C.literal('dossier').then(
					C.argument('n', A.INTEGER.create(event)).executes(ctx => {
						try {
							var lines = nsDosChatLines(Math.max(1, Number(A.INTEGER.getResult(ctx, 'n'))), nsGetState())
							for (var i = 0; i < lines.length; i++) ctx.source.sendSystemMessage(lines[i])
							return 1
						} catch (e) {
							console.error('[nightshift] /nightshift dossier: ' + e)
							return 0
						}
					})
				)
			)
	)
})
