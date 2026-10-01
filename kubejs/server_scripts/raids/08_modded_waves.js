// ==========================================================================
// Ночная смена — модовые волны с 16-й (Георгий, 01.10: «ванильные мобы в волнах — скучно; после 15-й чисто модовых
// кидать; чтобы каждая волна чувствовалась как праздник — какой-то новый моб»; «боссы слабые — медленные»;
// «камикадзе: быстрые, легко убить, бегут и взрывают стены — толстые стены сейчас решают всё»).
//
//  - Волны 1–15 — прежние (ванильные), с 16-й — только мобы модов: ArPhEx (пауки, сколопендры, скорпионы, летуны),
//    Cataclysm (глубинники, драугры, пылающие), Northstar (агрессивные с планет), Cave Dweller (хоррор).
//  - У каждой волны 16–69 — «праздник» (название) и ПРЕМЬЕРА: новый моб, которого раньше не было. На старте —
//    титр «Премьера» и подсказка в чат: что делает моб и как с ним бороться. После премьеры моб входит в общий пул.
//    С 58-й премьеры — особые варианты (королева шнырей, подрывник-тяжеловес, невидимый жнец…).
//  - Боссы каждой 5-й волны с 15-й — боссы ArPhEx, крепче и быстрее (раньше «Вожак орды» — зомби на 190 HP).
//  - Подрывник (с 18-й): быстрый, хлипкий, светится; у стены или рядом с игроком взрывается и выбивает дыру ~2 блока.
//    Машины (блоки с блок-сущностью), моды обороны и обсидиан не берёт (40_nightshift_raid.js, nsKamikazeBlast).
//  - Числа мобов считаются «бюджетом здоровья»: подволна весит столько же HP, сколько ванильная подволна той же
//    волны (состав якоря × рост — как раньше), поэтому кривая сложности прежняя, а мобы — новые. Урон модовых
//    мобов выше ванильных, его НЕ режем (Георгий: «дал бы волю урону мобов, а нас сделал плотнее» — артефакты).
//
// Проверено на арене тестового сервера 01.10 (игрок рядом): мобы ниже агрессивны, подходят и бьют, блоки не
// ломают, паутину не ставят. Мирные мобы Northstar (улитка, черепаха, тихоход, жаба, угорь, мимик, бык) не берём —
// стоят на месте. HP — из атрибутов модов (javap createAttributes) и /data get … Health.
// Мобы ArPhEx исчезают сами, если в 75 блоках нет игрока (их тик-процедура) — у алтаря защитники рядом всегда.
// ==========================================================================

// Моб модов: ключ, id, базовое HP, русское имя, совет на премьеру; opt — nbt, tags, flyer, kamikaze
function nsMm(key, id, hp, name, tip, opt) {
	opt = opt || {}
	NSG.NS_MOD_MOBS[key] = { key: key, id: id, hp: hp, name: name, tip: tip || '', nbt: opt.nbt || '', tags: opt.tags || null, flyer: !!opt.flyer, heavy: !!opt.heavy }
}
NSG.NS_MOD_MOBS = {}
// Летуны: долетев до алтаря, не «проваливают» набег (как фантомы) — пикируют на защитников; стены не грызут
NSG.NS_MOD_FLYERS = {}

// --- лёгкие и стаи (HP ≤ 65) ---
nsMm('lurker', 'arphex:spider_lurker', 15, 'Паук-шнырь', 'Быстрый и хлипкий, бегает стаей. Бей по площади: размашистый меч, огнемёт, взрывы.')
nsMm('brood', 'arphex:spider_brood', 15, 'Паучий выводок', 'Мелочь, которая лезет по стенам. Не давай им копиться у алтаря.')
nsMm('frozen_zombie', 'northstar:frozen_zombie', 20, 'Мёрзлый зомби', 'Гость с ледяных планет. Медленный, но толстокожий — держи его на расстоянии.')
nsMm('centipede', 'arphex:centipede_stalker', 50, 'Сколопендра-ловчая', 'Догоняет бегущих. Не убегай — встречай оружием.')
nsMm('millipede', 'arphex:millipede_marauder', 40, 'Кивсяк-мародёр', 'Броня 3, лезет напролом. Тяжёлое оружие и пушки.')
nsMm('kamikaze', 'arphex:ant_arsonist_worker', 6, 'Подрывник', 'Бежит к стене и взрывается: дыра ~2 блока, рядом с игроком — тоже взрыв. Машины и обсидиан не берёт. Одного удара хватает — сбивай на подходе: луки, турели, ловушки.', {
	nbt: 'attributes:[{id:"minecraft:generic.max_health",base:6.0d},{id:"minecraft:generic.movement_speed",base:0.38d}],Health:6.0f,Glowing:1b,CustomName:\'"Подрывник"\'',
	tags: ['ns_kamikaze'],
})
nsMm('venus_scorpion', 'northstar:venus_scorpion', 20, 'Венерианский скорпион', 'Ядовитый жар Венеры. Мелкий, но жалит больно.')
nsMm('striker', 'arphex:scorpion_striker', 65, 'Скорпион-ударник', 'Бьёт хвостом с ядом. Молоко или «Противоядие» (артефакт) — в карман.')
nsMm('termite_worker', 'arphex:termite_tunneler_worker', 20, 'Термит-рабочий', 'Мелкий и многочисленный. Ловушки на подходе решают.')
nsMm('jumper', 'arphex:spider_jump', 40, 'Паук-прыгун', 'Прыгает высоко и лазает по стенам. Нужна крыша над алтарём или стена с козырьком.')
nsMm('ant_soldier', 'arphex:ant_arsonist_soldier', 100, 'Муравей-солдат', 'Крепкий муравей с огнём в жвалах. Огнестойкость и вода под рукой.')
nsMm('recluse', 'arphex:spider_recluse', 50, 'Паук-отшельник', 'Яд, от которого гниёт плоть. Не стой в ближнем бою долго.')
nsMm('bulwark', 'arphex:beetle_bulwark', 30, 'Жук-бастион', 'Броня 5 — стрелы и слабые удары отскакивают. Бей тяжёлым.')
nsMm('funnel', 'arphex:spider_funnel', 60, 'Воронковый паук', 'Ядовитый и юркий. Держи строй у алтаря.')
nsMm('raptor', 'northstar:mercury_raptor', 36, 'Меркурианский раптор', 'Быстрый хищник с Меркурия. Ловушки на пути решают.')
nsMm('termite_soldier', 'arphex:termite_tunneler_soldier', 60, 'Термит-солдат', 'Кусается больно, броня 4.')
nsMm('flat', 'arphex:spider_flat', 60, 'Плоский паук', 'Плоский и быстрый, пролезает куда угодно. Проверь щели в стене.')
nsMm('obstructer', 'arphex:spider_obstructer', 50, 'Паук-заградитель', 'Мешает подойти и путает. Работай издалека.')
nsMm('sinker', 'arphex:spider_sinker', 50, 'Паук-ныряльщик', 'Утягивает вниз. Не стой у края.')
// --- средние (100–200) ---
nsMm('mantis', 'arphex:mantis_mutilator', 120, 'Богомол-потрошитель', 'Бьёт на 15 — броня с «Защитой» и щит обязательны.')
nsMm('ambusher', 'arphex:spider_ambusher', 120, 'Паук-засадник', 'Сидит в засаде и прыгает на зазевавшегося.')
nsMm('lunger', 'arphex:spider_lunger', 150, 'Паук-рывок', 'Рывок на несколько блоков. Не думай, что ты далеко.')
nsMm('crab_larva', 'arphex:crab_larvae', 200, 'Личинка краба-душителя', 'Толстая и упорная. Пушки и турели.')
nsMm('cave_dweller', 'cave_dweller:cave_dweller', 450, 'Пещерный житель', 'Хоррор: отворачиваешься — он ближе. Смотри на него и бей вместе.', { heavy: true })
nsMm('snatcher', 'arphex:spider_snatcher', 200, 'Паук-похититель', 'Хватает и утаскивает. Держитесь вместе — выручайте своих.')
nsMm('goliath', 'arphex:spider_goliath', 200, 'Паук-голиаф', 'Большой и быстрый. Двухблочные проходы ему тесны — грызёт.')
nsMm('deepling', 'cataclysm:deepling', 26, 'Глубинник', 'Пехота глубин, ходит толпой с громилами.')
nsMm('deepling_brute', 'cataclysm:deepling_brute', 60, 'Громила-глубинник', 'Броня 8. Бей тяжёлым или пушкой.')
nsMm('koboleton', 'cataclysm:koboleton', 25, 'Кобольд', 'Скелет-кобольд, мелкий и злой.')
nsMm('draugr', 'cataclysm:draugr', 28, 'Драугр', 'Северный мертвец, ходит строем.')
nsMm('berserker', 'cataclysm:ignited_berserker', 65, 'Пылающий берсерк', 'Горит и поджигает. Огнестойкость — твой друг.')
// --- тяжёлые (250–300) ---
nsMm('evictor', 'arphex:centipede_evictor', 250, 'Сколопендра-выселитель', 'Длинная, бронированная. Выселяет из укрытий.', { heavy: true })
nsMm('solifuge', 'arphex:solifuge_skulker', 250, 'Сольпуга-скрытень', 'Подкрадывается тихо и прыгает. Смотри по сторонам.', { heavy: true })
nsMm('prowler', 'arphex:spider_prowler', 250, 'Паук-рыщущий', 'Охотник, обходит оборону. Стены — со всех сторон.', { heavy: true })
nsMm('reaper', 'arphex:spider_reaper', 275, 'Паук-жнец', 'Бьёт так, что «Защита IV» еле держит. Энергощит и артефакты.', { heavy: true })
nsMm('infestor', 'arphex:spider_infestor', 300, 'Паук-заразитель', 'Заражает: урон идёт и после удара. Лечись сразу.', { heavy: true })
nsMm('crab', 'arphex:crab_constrictor', 300, 'Краб-душитель', 'Очень быстрый для краба и душит. Стены и турели — в первую очередь по нему.', { heavy: true })
nsMm('revenant', 'cataclysm:ignited_revenant', 80, 'Пылающий ревенант', 'Броня 12 и щиты. Только тяжёлое оружие и пушки.')
nsMm('endermaptera', 'cataclysm:endermaptera', 16, 'Эндермаптера', 'Телепортируется к тебе. Стены не спасут — держи оружие наготове.')
nsMm('coral_golem', 'cataclysm:coral_golem', 110, 'Коралловый голем', 'Удар на 11, броня 5. Пушки.')
nsMm('deepling_priest', 'cataclysm:deepling_priest', 45, 'Жрец глубин', 'Колдует издалека. Добирайся до него первым.')
nsMm('deepling_warlock', 'cataclysm:deepling_warlock', 45, 'Чернокнижник глубин', 'Колдует издалека. Стрелы и турели по нему.')
nsMm('elite_draugr', 'cataclysm:elite_draugr', 32, 'Элитный драугр', 'Драугр-ветеран с броней.')
nsMm('royal_draugr', 'cataclysm:royal_draugr', 30, 'Королевский драугр', 'Командует строем. Сначала его.')
nsMm('aptrgangr', 'cataclysm:aptrgangr', 160, 'Аптргангр', 'Удар на 18, броня 10. Мини-босс в строю.', { heavy: true })
// --- летуны ---
nsMm('dragonfly', 'arphex:dragonfly_dreadnought', 75, 'Стрекоза-дредноут', 'Летает быстро — стены не помогут. Луки, арбалеты, зенитные турели.', { flyer: true })
nsMm('hornet', 'arphex:hornet_harbinger_giant', 45, 'Шершень-вестник', 'Летает и жалит. ПВО и крыша над алтарём.', { flyer: true })
nsMm('locust', 'arphex:locust_landscourge', 8, 'Саранча', 'Летучий рой. Мелкая, но её много.', { flyer: true })
nsMm('moth', 'arphex:spider_moth', 300, 'Паучья моль', 'Тяжёлый летун на 300 HP. Зенитки и щит-купол.', { flyer: true, heavy: true })
nsMm('wasp', 'arphex:wasp_nemesis', 250, 'Оса-немезида', 'Висит в воздухе и бьёт на 19. Сбивать первой.', { flyer: true, heavy: true })
nsMm('vulture', 'northstar:venus_vulture', 40, 'Стервятник Венеры', 'Кружит над полем. Лук или зенитка.', { flyer: true })
// --- особые варианты (премьеры 58+) ---
function nsMmVariant(key, base, hp, name, tip, extraNbt, opt) {
	var b = NSG.NS_MOD_MOBS[base]
	opt = opt || {}
	nsMm(key, b.id, hp, name, tip, {
		nbt: 'attributes:[{id:"minecraft:generic.max_health",base:' + hp + '.0d}' + (opt.scale ? ',{id:"minecraft:generic.scale",base:' + opt.scale + 'd}' : '') + (opt.speed ? ',{id:"minecraft:generic.movement_speed",base:' + opt.speed + 'd}' : '') + '],Health:' + hp + '.0f,CustomName:\'"' + name + '"\'' + (extraNbt ? ',' + extraNbt : ''),
		tags: opt.tags || b.tags,
		flyer: b.flyer,
		heavy: true,
	})
}
var NS_MM_INVIS = 'active_effects:[{id:"minecraft:invisibility",amplifier:0b,duration:-1,show_particles:0b}]'
var NS_MM_RAGE = 'active_effects:[{id:"minecraft:speed",amplifier:1b,duration:-1,show_particles:0b},{id:"minecraft:strength",amplifier:0b,duration:-1,show_particles:0b}]'
nsMmVariant('lurker_queen', 'lurker', 150, 'Королева шнырей', 'Шнырь размером с лошадь и с выводком. Сначала её — стая без неё глупеет (нет).', '', { scale: 2.5 })
nsMmVariant('kamikaze_heavy', 'kamikaze', 30, 'Подрывник-тяжеловес', 'Крупный подрывник: дыра втрое больше. Сбивать издалека, любой ценой.', 'Glowing:1b', { scale: 1.8, speed: 0.36, tags: ['ns_kamikaze', 'ns_kamikaze_heavy'] })
nsMmVariant('reaper_ghost', 'reaper', 275, 'Невидимый жнец', 'Жнец под невидимостью. Слушай шаги, ставь свет и ловушки.', NS_MM_INVIS)
nsMmVariant('goliath_titan', 'goliath', 600, 'Голиаф-титан', 'Голиаф вдвое больше и втрое крепче. Пушки по готовности.', '', { scale: 2 })
nsMmVariant('mantis_rage', 'mantis', 240, 'Бешеный богомол', 'Богомол со скоростью II и силой. Не подпускай.', NS_MM_RAGE)
nsMmVariant('crab_king', 'crab', 700, 'Краб-владыка', 'Краб-душитель величиной с дом. Всё оружие — по нему.', '', { scale: 1.8 })
for (var nsMf in NSG.NS_MOD_MOBS) if (NSG.NS_MOD_MOBS[nsMf].flyer) NSG.NS_MOD_FLYERS[NSG.NS_MOD_MOBS[nsMf].id] = true
NSG.NS_MOD_FLYERS['arphex:scorpioid_bloodluster'] = true
NSG.NS_MOD_FLYERS['arphex:draconic_voidlasher'] = true

// Премьеры: волна → { star: ключ моба-премьеры, join: кто ещё входит в пул без титра, name: праздник }
NSG.NS_MOD_DEBUTS = {
	16: { star: 'lurker', join: ['brood', 'frozen_zombie'], name: 'Ночь шнырей' },
	17: { star: 'centipede', join: ['millipede'], name: 'День ста ног' },
	18: { star: 'kamikaze', join: ['venus_scorpion'], name: 'День открытых дверей' },
	19: { star: 'striker', join: ['termite_worker'], name: 'Скорпионий карнавал' },
	20: { star: 'jumper', name: 'Олимпиада по прыжкам' },
	21: { star: 'ant_soldier', name: 'Ночь костров' },
	22: { star: 'dragonfly', name: 'Авиашоу' },
	23: { star: 'recluse', name: 'День затворника' },
	24: { star: 'bulwark', name: 'День щита' },
	25: { star: 'funnel', name: 'Субботник у алтаря' },
	26: { star: 'raptor', name: 'Юрский период' },
	27: { star: 'termite_soldier', name: 'Новоселье' },
	28: { star: 'flat', name: 'День тонких намёков' },
	29: { star: 'hornet', name: 'Пасека' },
	30: { star: 'mantis', name: 'Молитвенный вечер' },
	31: { star: 'obstructer', name: 'Пробки на дорогах' },
	32: { star: 'sinker', name: 'Водное шоу' },
	33: { star: 'locust', name: 'Неурожай' },
	34: { star: 'ambusher', name: 'Игра в прятки' },
	35: { star: 'crab_larva', name: 'Морской день' },
	36: { star: 'lunger', name: 'Спринт' },
	37: { star: 'cave_dweller', name: 'Ночь страшилок' },
	38: { star: 'snatcher', name: 'День похищений' },
	39: { star: 'goliath', name: 'День гигантов' },
	40: { star: 'evictor', name: 'День выселения' },
	41: { star: 'solifuge', name: 'Тихий час' },
	42: { star: 'deepling_brute', join: ['deepling'], name: 'День флота' },
	43: { star: 'moth', name: 'Ночь мотыльков' },
	44: { star: 'prowler', name: 'Ночной обход' },
	45: { star: 'draugr', join: ['koboleton'], name: 'Скандинавская неделя' },
	46: { star: 'wasp', name: 'Месть ос' },
	47: { star: 'reaper', name: 'Праздник урожая' },
	48: { star: 'berserker', name: 'Огненное шоу' },
	49: { star: 'infestor', name: 'Санитарный день' },
	50: { star: 'crab', name: 'Крабовая вечеринка' },
	51: { star: 'vulture', name: 'Пир стервятников' },
	52: { star: 'revenant', name: 'Ночь щитов' },
	53: { star: 'endermaptera', name: 'Телепорт-шоу' },
	54: { star: 'coral_golem', name: 'Рифовый бал' },
	55: { star: 'royal_draugr', join: ['elite_draugr'], name: 'Коронация' },
	56: { star: 'deepling_warlock', join: ['deepling_priest'], name: 'Ночь проповедей' },
	57: { star: 'aptrgangr', name: 'Ночь мертвецов' },
	58: { star: 'lurker_queen', name: 'Свадьба шнырей' },
	59: { star: 'kamikaze_heavy', name: 'Снос под ключ' },
	60: { star: 'reaper_ghost', name: 'Ночь невидимок' },
	61: { star: 'goliath_titan', name: 'Парад великанов' },
	62: { star: 'mantis_rage', name: 'Ночь ярости' },
	63: { star: 'crab_king', name: 'Крабовый апокалипсис' },
	64: { name: 'Авиапарад', theme: 'flyers' },
	65: { name: 'Ярмарка чудищ', theme: 'heavy' },
	66: { name: 'Бенефис премьер', theme: 'stars' },
	67: { name: 'Тёмная ночь', theme: 'heavy' },
	68: { name: 'Последний звонок', theme: 'stars' },
	69: { name: 'Генеральная репетиция', theme: 'heavy' },
}
// Праздники Кошмара (70+) — по кругу
NSG.NS_MOD_LATE_NAMES = ['Кошмарный бал', 'Ночь длинных теней', 'Карнавал чудищ', 'Шабаш', 'Парад тварей', 'Полуночный рынок', 'Бал-маскарад', 'Ночь без утра', 'Пир орды', 'Великий сбор']

// Детерминированный случай по номеру волны: прогноз у алтаря совпадает с тем, что придёт
function nsMwRng(seed) {
	var s = (Math.abs(Math.floor(seed)) % 2147483646) + 1
	return function () {
		s = (s * 16807) % 2147483647
		return (s - 1) / 2147483646
	}
}

// Пул мобов, доступных на волне d (премьеры и «join» с волн ≤ d); вес новых — выше
function nsMwPool(d) {
	var out = []
	for (var w in NSG.NS_MOD_DEBUTS) {
		var wn = Number(w)
		if (wn > d) continue
		var e = NSG.NS_MOD_DEBUTS[w]
		var keys = (e.star ? [e.star] : []).concat(e.join || [])
		for (var i = 0; i < keys.length; i++) out.push({ m: NSG.NS_MOD_MOBS[keys[i]], since: wn })
	}
	return out
}

// Выбор моба из пула по фильтру; свежие (вышли недавно) — чаще
function nsMwPick(pool, rnd, filter, d) {
	var cand = []
	var total = 0
	for (var i = 0; i < pool.length; i++) {
		var m = pool[i].m
		if (filter && !filter(m)) continue
		var wgt = 1 + Math.max(0, 12 - (d - pool[i].since)) / 6 // вышедшие за последние 12 волн — до ×3
		cand.push([m, wgt])
		total += wgt
	}
	if (!cand.length) return null
	var r = rnd() * total
	for (var c = 0; c < cand.length; c++) {
		r -= cand[c][1]
		if (r <= 0) return cand[c][0]
	}
	return cand[cand.length - 1][0]
}

// Строка состава: моб, доля бюджета подволны → { id, count (на игрока), label, nbt, tags, hp }
function nsMwEntry(m, share, budget, minCount) {
	// не больше 24 на игрока (рой мельче 10 HP — 16): сотня саранчи — это лаг, а не сложность
	var n = Math.max(minCount || 0.5, Math.min(m.hp < 10 ? 16 : 24, Math.round((budget * share) / m.hp * 10) / 10))
	return { id: m.id, count: n, label: m.name, nbt: m.nbt, tags: m.tags, hp: m.hp, key: m.key }
}

function nsMwIsKamikaze(m) {
	return m.key === 'kamikaze' || m.key === 'kamikaze_heavy'
}

// Одинаковые мобы в подволне — одной строкой
function nsMwMerge(sub) {
	var out = []
	var at = {}
	for (var i = 0; i < sub.length; i++) {
		var e = sub[i]
		var k = e.id + '|' + e.nbt + '|' + (e.tags || []).join(',')
		if (at[k] !== undefined) out[at[k]].count = Math.round((out[at[k]].count + e.count) * 10) / 10
		else {
			at[k] = out.length
			out.push(e)
		}
	}
	return out
}

// Подволна «против щита» из модовых мобов (50+): пронзатель — летун, разрушитель — краб, разрядник — оса
function nsMwShieldBreakers(budget, d) {
	var M = NSG.NS_MOD_MOBS
	function tagged(m, tag, label, share) {
		var e = nsMwEntry(m, share, budget, 1)
		e.tags = (m.tags || []).concat([tag])
		e.label = m.name + ' — ' + label
		return e
	}
	var out = [tagged(M.dragonfly, 'ns_shield_pierce', 'сквозь щит', 0.25), tagged(d >= 50 ? M.crab : M.goliath, 'ns_shield_breaker', '×10 по щиту', 0.35)]
	out.push(tagged(d >= 46 ? M.wasp : M.hornet, 'ns_shield_drain', 'выжигает запас щита', 0.2))
	out.push(nsMwEntry(M.brood, 0.2, budget, 2))
	return out
}

// Бюджет здоровья ванильной подволны (на игрока, без множителей набега) — для пересчёта числа модовых мобов
function nsMwBudget(vanillaWaves) {
	var T = NSG.NIGHTSHIFT_MOB_HP
	var sum = 0
	var n = 0
	for (var w = 0; w < vanillaWaves.length; w++) {
		var s = 0
		for (var i = 0; i < vanillaWaves[w].length; i++) {
			var e = vanillaWaves[w][i]
			s += e.count * (e.hp || T[e.id] || 20)
		}
		sum += s
		n++
	}
	return n ? sum / n : 400
}

// Состав модовой волны d: nSub подволн по budget HP каждая (на игрока).
// Возвращает { name, star (моб-премьера или звезда вечера), waves }
NSG.nsModWave = function (d, budget, nSub, late) {
	var rnd = nsMwRng(d * 7919 + 17)
	var deb = late ? null : NSG.NS_MOD_DEBUTS[Math.min(d, 69)]
	var pool = nsMwPool(Math.min(d, 69))
	var M = NSG.NS_MOD_MOBS
	var notKami = function (m) {
		return !nsMwIsKamikaze(m)
	}
	var light = function (m) {
		return m.hp <= 65 && !m.flyer && !nsMwIsKamikaze(m)
	}
	var ground = function (m) {
		return !m.flyer && !nsMwIsKamikaze(m)
	}
	var big = function (m) {
		return m.heavy && !nsMwIsKamikaze(m)
	}
	var star = deb && deb.star ? M[deb.star] : null
	var name = deb ? deb.name : NSG.NS_MOD_LATE_NAMES[(d - 70 + NSG.NS_MOD_LATE_NAMES.length * 10) % NSG.NS_MOD_LATE_NAMES.length]
	// без премьеры (64–69, Кошмар) — «звезда вечера» по теме
	var theme = deb && deb.theme ? deb.theme : late ? ['stars', 'heavy', 'flyers'][d % 3] : null
	if (!star) {
		var tf = theme === 'flyers' ? function (m) {
			return m.flyer
		} : theme === 'heavy' ? big : function (m) {
			return notKami(m) && m.hp >= 100
		}
		star = nsMwPick(pool, rnd, tf, d) || M.prowler
	}
	var waves = []
	var kamiFrom = 18
	for (var s = 0; s < nSub; s++) {
		var sub = []
		if (s === 0) {
			// премьера: звезда занимает 70 % подволны (подрывники — числом, их здоровье бюджет не мерит)
			if (nsMwIsKamikaze(star)) {
				var ks = nsMwEntry(star, 0, budget, 1)
				ks.count = star.key === 'kamikaze' ? 8 : 2
				sub.push(ks)
			} else sub.push(nsMwEntry(star, 0.7, budget, star.hp >= 200 ? 1 : 2))
			var sup = nsMwPick(pool, rnd, light, d)
			if (sup && sup.key !== star.key) sub.push(nsMwEntry(sup, nsMwIsKamikaze(star) ? 0.9 : 0.3, budget, 2))
		} else if (s === nSub - 1) {
			// финал волны: звезда ещё раз + самый тяжёлый из пула + стая
			if (nsMwIsKamikaze(star)) {
				var kf = nsMwEntry(star, 0, budget, 1)
				kf.count = star.key === 'kamikaze' ? 6 : 1.5
				sub.push(kf)
			} else sub.push(nsMwEntry(star, 0.4, budget, 1))
			var heavy = nsMwPick(pool, rnd, big, d)
			if (heavy && heavy.key !== star.key) sub.push(nsMwEntry(heavy, 0.4, budget, 1))
			var sw = nsMwPick(pool, rnd, light, d)
			if (sw) sub.push(nsMwEntry(sw, 0.2, budget, 2))
		} else if (d >= 50 && s === nSub - 2) {
			sub = nsMwShieldBreakers(budget, d)
		} else {
			var flyRow = theme === 'flyers' || s % 3 === 2
			var main = flyRow ? nsMwPick(pool, rnd, function (m) {
				return m.flyer
			}, d) : null
			if (!main) main = nsMwPick(pool, rnd, theme === 'heavy' ? big : ground, d) || star
			sub.push(nsMwEntry(main, 0.55, budget, 1))
			var second = nsMwPick(pool, rnd, function (m) {
				return ground(m) && m.key !== main.key
			}, d)
			if (second) sub.push(nsMwEntry(second, 0.3, budget, 1))
			var third = nsMwPick(pool, rnd, function (m) {
				return light(m) && m.key !== main.key && (!second || m.key !== second.key)
			}, d)
			if (third) sub.push(nsMwEntry(third, 0.15, budget, 2))
		}
		// подрывники — в каждой второй подволне с 18-й, больше с ростом волны
		if (d >= kamiFrom && s % 2 === 1) {
			var kn = Math.round(Math.min(6, 2 + (d - kamiFrom) / 10) * 10) / 10
			var ke = nsMwEntry(M.kamikaze, 0, budget, kn)
			ke.count = kn
			sub.push(ke)
			if (d >= 59 && s % 4 === 1) {
				var kh = nsMwEntry(M.kamikaze_heavy, 0, budget, 1)
				kh.count = Math.round(Math.min(1.5, 1 + (d - 59) / 30) * 10) / 10
				sub.push(kh)
			}
		}
		waves.push(nsMwMerge(sub))
	}
	return { name: name, star: star, premiere: !!(deb && deb.star), waves: waves }
}

// --------------------------------------------------------------------------
// Боссы каждой 5-й волны с 15-й (Георгий, 01.10: «боссы слабые — медленные»). Боссы ArPhEx крепкие и бьют сильно
// (матриарх убила игрока с «Сопротивлением IV» за 10 с на проверке) — до 30-й их урон снижен на 30 %, до 45-й — на 15 %,
// дальше — как в моде. Здоровье — ×(1 + волна/12) поверх живучести волны, скорость +20 %.
// --------------------------------------------------------------------------
function nsMb(id, hp, label, opt) {
	opt = opt || {}
	return { id: id, hpLabel: hp, label: label, nbt: "CustomName:'\"" + label + "\"'" + (opt.nbt ? ',' + opt.nbt : '') + (opt.scale ? ',attributes:[{id:"minecraft:generic.scale",base:' + opt.scale + 'd}]' : '') }
}
NSG.NS_MOD_BOSSES = {
	15: { boss: nsMb('arphex:spider_goliath', 200, 'Голиаф', { scale: 1.8 }) },
	20: { boss: nsMb('arphex:spider_matriarch', 350, 'Паучиха-матриарх') },
	25: { boss: nsMb('arphex:termite_tunneler_king', 250, 'Термитный король', { scale: 1.3 }) },
	30: { boss: nsMb('arphex:arthropleura_abomination', 300, 'Артроплевра-мерзость') },
	35: { boss: nsMb('arphex:scorpioid_bloodluster', 450, 'Скорпиоид-кровопийца') },
	40: { boss: nsMb('arphex:draconic_voidlasher', 500, 'Пустотный драконохвост') },
	45: { boss: nsMb('arphex:arachnoid_trisector', 650, 'Арахноид-трисектор') },
	50: { boss: nsMb('arphex:diabolos_decimator', 750, 'Диаболос-истребитель') },
	55: { boss: nsMb('arphex:spider_matriarch', 350, 'Паучиха-матриарх'), extra: [{ boss: nsMb('arphex:arthropleura_abomination', 300, 'Артроплевра-мерзость'), count: 1 }] },
	60: { boss: nsMb('arphex:arachnoid_trisector', 650, 'Арахноид-трисектор'), extra: [{ boss: nsMb('arphex:scorpioid_bloodluster', 450, 'Скорпиоид-кровопийца'), count: 1 }] },
	65: { boss: nsMb('arphex:diabolos_decimator', 750, 'Диаболос-истребитель'), extra: [{ boss: nsMb('arphex:draconic_voidlasher', 500, 'Пустотный драконохвост'), count: 1 }] },
}
// Модовый босс волны d (15–69, кратные 5) или null; scale — множители (доли к базе), применяются к боссу и его паре
NSG.nsModBossFor = function (d, toughHp) {
	var b = NSG.NS_MOD_BOSSES[d]
	if (!b) return null
	return {
		boss: b.boss,
		extra: b.extra || [],
		scale: { hp: toughHp + d / 12, damage: d <= 30 ? -0.3 : d <= 45 ? -0.15 : 0, speed: 0.2, size: 1 },
	}
}

// Свита Кошмара (финал волн 70+) — модовая: тяжёлые пауки, краб, жнец, моль
NSG.NS_MOD_FINALE = function () {
	var M = NSG.NS_MOD_MOBS
	return [nsMwEntry(M.crab, 0, 1, 1), nsMwEntry(M.reaper, 0, 1, 2), nsMwEntry(M.prowler, 0, 1, 2), nsMwEntry(M.moth, 0, 1, 1), nsMwEntry(M.kamikaze_heavy, 0, 1, 1)]
}
