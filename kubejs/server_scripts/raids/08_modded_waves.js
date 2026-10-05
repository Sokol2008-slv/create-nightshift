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
//
// 05.10 (поток W; 16-ю провалили 02.10 — паучий выводок заполз на алтарь, после 4,5 минуты боя, «найти пауков анрил»,
// «лагает — пауки спавнят мелких»; с тех пор новых волн не было):
//  - вход плавный: 16–19 — переходные (модовые 2 → 5 подволн из 6, остальные — ванильные подволны якоря), бюджет
//    модовой подволны 0,7 → 0,95 до 21-й (NS_MOD_ENTRY, nsMwMixVanilla);
//  - «цена угрозы» (cost) у мелких опасных мобов: шныря на 16-й было 37 в одной подволне, стало ~11 (на троих);
//  - выводок — с 23-й, подрывники на премьере 18-й — 5 на игрока (было 8), в подволнах — с 19-й;
//  - строка «Готовьтесь» у премьер 16–20 (prep), премьеры, съеденные сценариями, выходят на следующей волне;
//  - гастроли (NS_MOD_GUESTS): маги и древняя стража Iron's Spells, глубоководные Cataclysm, крылатые термиты;
//  - варианты боссов для фарма (alt): на повторах волны — Магистры цитадели, Мёртвый король, Эхо Тироса.
// ==========================================================================

// Моб модов: ключ, id, базовое HP, русское имя, совет на премьеру; opt — nbt, tags, flyer, heavy, cost, caster.
// cost — «цена угрозы» для бюджета подволны (05.10, поток W): у мелких, но опасных (лезут по стенам, плодят детёнышей,
// бегут быстрее игрока) здоровье не отражает угрозу — 16-ю провалили 37 паучьих шнырей + 16 выводков в первой же
// подволне (бюджет 420 HP / 15 HP шныря). Число моба в подволне считается по max(hp, cost).
// caster — колдун (гастроли «Шабаш» и др.): метка досье «Колдуны», в «стаю» не берётся.
function nsMm(key, id, hp, name, tip, opt) {
	opt = opt || {}
	NSG.NS_MOD_MOBS[key] = { key: key, id: id, hp: hp, name: name, tip: tip || '', nbt: opt.nbt || '', tags: opt.tags || null, flyer: !!opt.flyer, heavy: !!opt.heavy, cost: opt.cost || 0, caster: !!opt.caster }
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
// --- гастроли (05.10, поток W): мобы других модов, которых раньше в набегах не было. Проверено на тестовом сервере
// 05.10 без игрока: призываются /summon с NBT, 15 с не исчезают сами, по пути к цели идут (moveTo, ровная площадка),
// враждебны (Enemy). Пиромант, криомант и аптекарь Iron's Spells НЕ взяты — нейтральные, сами не нападают;
// глубинник-удильщик и Коралссус не идут к цели (стоят в засаде); ледяной паук — броня 20. Заклинания Iron's Spells
// блоки не ломают и не жгут (spellGriefing = false в irons_spellbooks-server.toml).
nsMm('necromancer', 'irons_spellbooks:necromancer', 25, 'Некромант', 'Поднимает мертвецов и прячется за ними. Его — первым: стрелы, турели, тесла.', { cost: 70, caster: true })
nsMm('cultist', 'irons_spellbooks:cultist', 60, 'Культист', 'Колдует кровью из-за спин орды. Стрелки и турели — по нему первым.', { cost: 75, caster: true })
nsMm('archevoker', 'irons_spellbooks:archevoker', 60, 'Архизаклинатель', 'Клыки из-под земли и рой вредин. Убей, пока он не начал колдовать.', { cost: 90, caster: true })
nsMm('catacombs_zombie', 'irons_spellbooks:catacombs_zombie', 20, 'Мертвец катакомб', 'Пехота некромантов в броне. Толпой — к стене.', { cost: 25 })
nsMm('citadel_keeper', 'irons_spellbooks:citadel_keeper', 60, 'Древний рыцарь', 'Медленный, но меч бьёт на 10. Бей и отходи, не стой под ударом.', { cost: 80 })
nsMm('magehunter', 'irons_spellbooks:magehunter_vindicator', 24, 'Охотник на магов', 'Быстрый поборник с топором: бежит к тем, кто колдует. Встречай клинком.', { cost: 40 })
nsMm('ice_spider', 'irons_spellbooks:ice_spider', 50, 'Ледяной паук', 'Броня 20: стрелы и слабые удары почти не берут. Огонь, тяжёлое оружие, пушки.', { cost: 110 })
nsMm('hippocamtus', 'cataclysm:hippocamtus', 85, 'Гиппокамт', 'Морской рыцарь: броня 15, удар на 10. Пушки и тяжёлое оружие.', { cost: 130 })
nsMm('cindaria', 'cataclysm:cindaria', 60, 'Синдария', 'Тварь затонувшего акрополя, удар на 7. Держи строй.')
nsMm('urchinkin', 'cataclysm:urchinkin', 12, 'Ежовник', 'Колючий и быстрый шарик. Бей по площади.', { cost: 25 })
nsMm('drowned_host', 'cataclysm:drowned_host', 20, 'Утопленник акрополя', 'Пехота глубин в броне. Толпой опасен.', { cost: 25 })
nsMm('termite_alate', 'arphex:termite_tunneler_alate', 25, 'Крылатый термит', 'Перелетает стены. Зенитки, тесла, луки.', { flyer: true, cost: 40 })

// Цена угрозы прежних мобов (см. nsMm): шнырь и выводок — стаи по стенам, выводок ещё и лопается на паучат
var NS_MM_COST = { lurker: 35, brood: 45, frozen_zombie: 25, venus_scorpion: 30, termite_worker: 30, jumper: 55, bulwark: 45, raptor: 45, recluse: 60, centipede: 60, mantis: 150, locust: 18, funnel: 70, flat: 70 }
for (var nsMc in NS_MM_COST) if (NSG.NS_MOD_MOBS[nsMc]) NSG.NS_MOD_MOBS[nsMc].cost = NS_MM_COST[nsMc]

for (var nsMf in NSG.NS_MOD_MOBS) if (NSG.NS_MOD_MOBS[nsMf].flyer) NSG.NS_MOD_FLYERS[NSG.NS_MOD_MOBS[nsMf].id] = true
NSG.NS_MOD_FLYERS['arphex:scorpioid_bloodluster'] = true
NSG.NS_MOD_FLYERS['arphex:draconic_voidlasher'] = true

// Премьеры: волна → { star: ключ моба-премьеры, join: кто ещё входит в пул без титра, name: праздник }
NSG.NS_MOD_DEBUTS = {
	// выводок (лопается на паучат) — не с 16-й, а с 23-й: 16-ю провалили 02.10 из-за выводка на алтаре
	16: { star: 'lurker', join: ['frozen_zombie'], name: 'Ночь шнырей', prep: 'Шныри лезут по стенам: козырёк наружу или крыша над алтарём. Модовые мобы приходят постепенно: на 16-й — 2 подволны из 6, к 20-й — все.' },
	17: { star: 'centipede', join: ['millipede'], name: 'День ста ног', prep: 'Сколопендры догоняют бегущих — встречай оружием, не убегай.' },
	18: { star: 'kamikaze', join: ['venus_scorpion'], name: 'День открытых дверей', prep: 'Подрывники выбивают дыру в стене: луки и турели на подходе, обсидиан там, где орда упирается.' },
	19: { star: 'striker', join: ['termite_worker'], name: 'Скорпионий карнавал', prep: 'Яд скорпионов: молоко в карман.' },
	20: { star: 'jumper', name: 'Олимпиада по прыжкам', prep: 'Прыгуны перескакивают стены в 3 блока — крыша над алтарём. Босс — Паучиха-матриарх, плодит паучат.' },
	21: { star: 'ant_soldier', name: 'Ночь костров' },
	22: { star: 'dragonfly', name: 'Авиашоу' },
	23: { star: 'recluse', join: ['brood'], name: 'День затворника' },
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

// Гастроли (05.10, поток W): на волне-премьере гостей одна средняя подволна целиком из «труппы» — мобов других модов
// (маги Iron's Spells, древняя стража, глубоководные Cataclysm, крылатые термиты). Объявление в чат, дальше мобы
// труппы входят в общий пул. Волны — без новых особых стадий и не кратные 5 (там боссы).
NSG.NS_MOD_GUESTS = {
	27: { key: 'sabbath', name: 'Шабаш', mobs: [['necromancer', 0.35], ['cultist', 0.35], ['catacombs_zombie', 0.3]], tip: 'маги Iron\'s Spells: некроманты поднимают мертвецов, культисты колдуют из-за спин орды. Колдунов — первыми: стрелки, турели, тесла' },
	31: { key: 'ice', name: 'Ледяной поход', mobs: [['ice_spider', 0.6], ['frozen_zombie', 0.4]], tip: 'ледяные пауки в броне 20 — стрелы почти не берут: огонь, тяжёлое оружие, пушки' },
	37: { key: 'termites', name: 'Термитник', mobs: [['termite_alate', 0.4], ['termite_soldier', 0.35], ['termite_worker', 0.25]], tip: 'крылатые термиты перелетают стены — зенитки и тесла; солдаты в броне 4' },
	41: { key: 'guard', name: 'Древняя стража', mobs: [['citadel_keeper', 0.45], ['magehunter', 0.3], ['archevoker', 0.25]], tip: 'древние рыцари бьют мечом на 10, охотники на магов бегут к тем, кто колдует, архизаклинатель — клыки и вредины' },
	49: { key: 'acropolis', name: 'Глубоководная ночь', mobs: [['hippocamtus', 0.45], ['cindaria', 0.25], ['urchinkin', 0.15], ['drowned_host', 0.15]], tip: 'гиппокамты в броне 15 бьют на 10 — пушки и тяжёлое оружие; ежовники быстрые, бей по площади' },
}

// Пул мобов, доступных на волне d (премьеры, «join» и труппы гастролей с волн ≤ d); вес новых — выше
function nsMwPool(d) {
	var out = []
	for (var w in NSG.NS_MOD_DEBUTS) {
		var wn = Number(w)
		if (wn > d) continue
		var e = NSG.NS_MOD_DEBUTS[w]
		var keys = (e.star ? [e.star] : []).concat(e.join || [])
		for (var i = 0; i < keys.length; i++) out.push({ m: NSG.NS_MOD_MOBS[keys[i]], since: wn })
	}
	var seen = {}
	for (var k = 0; k < out.length; k++) seen[out[k].m.key] = true
	for (var g in NSG.NS_MOD_GUESTS) {
		var gn = Number(g)
		if (gn > d) continue
		var gm = NSG.NS_MOD_GUESTS[g].mobs
		for (var j = 0; j < gm.length; j++) {
			if (seen[gm[j][0]]) continue
			seen[gm[j][0]] = true
			out.push({ m: NSG.NS_MOD_MOBS[gm[j][0]], since: gn })
		}
	}
	return out
}

// Премьеры, «съеденные» сценарием (Воздушный бой, Побег… — без подволн): звезда выходит на первой следующей волне с
// подволнами вместе со своей (раньше премьеры 24, 28, 36, 42, 43, 46, 54, 58, 62, 63 не показывались вовсе)
function nsMwDeferred(d) {
	var S = NSG.NS_SPECIAL_STAGES || {}
	function scen(w) {
		return !!(S[w] && S[w].kind === 'scenario')
	}
	if (scen(d)) return []
	var out = []
	for (var w = d - 1; w >= NSG.NS_MOD_WAVES_FROM && scen(w); w--) {
		var e = NSG.NS_MOD_DEBUTS[w]
		if (e && e.star) out.unshift(e.star)
	}
	return out
}

// Вход в модовые волны (05.10, поток W): на 16–20 бюджет здоровья модовой подволны меньше (0,7 → 0,95), полностью — с 21-й
NSG.NS_MOD_ENTRY = { 16: 0.7, 17: 0.75, 18: 0.8, 19: 0.9, 20: 0.95 }
// Сколько подволн из модовых на переходных волнах (остальные — ванильные подволны якоря, как на 14–15): 16 → 2, 17 → 3,
// 18 → 4, 19 → 5, с 20-й — все. Модовые: премьера (первая), финал (последняя) и вторая, третья… по порядку
NSG.nsMwModCount = function (d, n) {
	return d >= 20 ? n : Math.max(2, Math.min(n, d - 14))
}
NSG.nsMwMixVanilla = function (d, modWaves, vanillaWaves) {
	var n = modWaves.length
	var mc = NSG.nsMwModCount(d, n)
	if (mc >= n) return modWaves
	var out = []
	for (var s = 0; s < n; s++) {
		var modded = s === 0 || s === n - 1 || s <= mc - 2
		out.push(modded ? modWaves[s] : vanillaWaves[s % vanillaWaves.length])
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
	var n = Math.max(minCount || 0.5, Math.min(m.hp < 10 ? 16 : 24, Math.round((budget * share) / Math.max(m.hp, m.cost || 0) * 10) / 10))
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
	if (!late && NSG.NS_MOD_ENTRY[d]) budget = budget * NSG.NS_MOD_ENTRY[d]
	var costars = late ? [] : nsMwDeferred(d)
	var guest = late ? null : NSG.NS_MOD_GUESTS[d] || null
	var notKami = function (m) {
		return !nsMwIsKamikaze(m)
	}
	var light = function (m) {
		return m.hp <= 65 && !m.flyer && !m.caster && !nsMwIsKamikaze(m)
	}
	var ground = function (m) {
		return !m.flyer && !nsMwIsKamikaze(m)
	}
	var big = function (m) {
		return m.heavy && !nsMwIsKamikaze(m)
	}
	var star = deb && deb.star ? M[deb.star] : null
	// звезда, «съеденная» сценарием прошлой волны, без своей премьеры на этой (кратные 5 и т.п.) — главная звезда
	var deferredStar = false
	if (!star && costars.length) {
		star = M[costars.shift()]
		deferredStar = true
	}
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
			// премьера: звезда занимает 70 % подволны (подрывники — числом, их здоровье бюджет не мерит); со звёздами
			// прошлых сценариев — делят подволну
			var starShare = costars.length ? 0.45 : 0.7
			if (nsMwIsKamikaze(star)) {
				var ks = nsMwEntry(star, 0, budget, 1)
				ks.count = star.key === 'kamikaze' ? 5 : 2 // 05.10: 8 на игрока на первом знакомстве — слишком много дыр сразу
				sub.push(ks)
			} else sub.push(nsMwEntry(star, starShare, budget, star.hp >= 200 ? 1 : 2))
			for (var cs = 0; cs < costars.length; cs++) {
				var cm = M[costars[cs]]
				if (nsMwIsKamikaze(cm)) {
					var kc = nsMwEntry(cm, 0, budget, 1)
					kc.count = cm.key === 'kamikaze' ? 3 : 1
					sub.push(kc)
				} else sub.push(nsMwEntry(cm, 0.25, budget, 1))
			}
			var sup = nsMwPick(pool, rnd, light, d)
			if (sup && sup.key !== star.key) sub.push(nsMwEntry(sup, nsMwIsKamikaze(star) ? 0.9 : 0.3, budget, 2))
		} else if (guest && s === (nSub >= 4 ? 2 : 1)) {
			// гастроли: подволна целиком из труппы
			for (var gi = 0; gi < guest.mobs.length; gi++) sub.push(nsMwEntry(M[guest.mobs[gi][0]], guest.mobs[gi][1], budget, 1))
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
			// колдуны — не основной строкой (4 некроманта на подволну — это каша из призванной нежити), только второй
			if (!main) main = nsMwPick(pool, rnd, theme === 'heavy' ? big : function (m) {
				return ground(m) && !m.caster
			}, d) || star
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
		// подрывники — в каждой второй подволне с 19-й (на 18-й — только премьера), больше с ростом волны
		if (d > kamiFrom && s % 2 === 1) {
			var kn = Math.round(Math.min(6, 1.5 + (d - kamiFrom) / 8) * 10) / 10
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
	var cos = []
	for (var cn = 0; cn < costars.length; cn++) cos.push(M[costars[cn]])
	return { name: name, star: star, premiere: !!(deb && deb.star) || deferredStar, costars: cos, guest: guest, waves: waves }
}

// --------------------------------------------------------------------------
// Боссы каждой 5-й волны с 15-й (Георгий, 01.10: «боссы слабые — медленные»). Боссы ArPhEx крепкие и бьют сильно
// (матриарх убила игрока с «Сопротивлением IV» за 10 с на проверке) — до 30-й их урон снижен на 30 %, до 45-й — на 15 %,
// дальше — как в моде. Здоровье — ×(1 + волна/12) поверх живучести волны, скорость +20 %.
// --------------------------------------------------------------------------
function nsMb(id, hp, label, opt) {
	opt = opt || {}
	var attrs = []
	// opt.hp — своё базовое здоровье (Древний рыцарь как босс: 60 HP мода мало); hp — подпись для прогноза
	if (opt.hp) attrs.push('{id:"minecraft:generic.max_health",base:' + opt.hp + '.0d}')
	if (opt.scale) attrs.push('{id:"minecraft:generic.scale",base:' + opt.scale + 'd}')
	return { id: id, hpLabel: opt.hp || hp, label: label, nbt: "CustomName:'\"" + label + "\"'" + (opt.nbt ? ',' + opt.nbt : '') + (attrs.length ? ',attributes:[' + attrs.join(',') + ']' : '') + (opt.hp ? ',Health:' + opt.hp + '.0f' : '') }
}
// Боссы Iron's Spells (05.10, поток W; проверено на тестовом сервере: идут к цели, враждебны, не исчезают сами):
// Мёртвый король — 500 HP, броня 15, удар 10; Эхо Тироса (fire_boss) — 1000 HP, броня 15, удар 10. Заклинания блоки не
// ломают (spellGriefing = false). Своё базовое здоровье — как у главного босса волны (иначе Тирос на 35-й вдвое толще
// скорпиоида), дальше его, как всех боссов, раздувает живучесть волны.
function nsMbKing(hp) {
	return nsMb('irons_spellbooks:dead_king', 500, 'Мёртвый король', { hp: hp, scale: 1.15 })
}
function nsMbTyros(hp) {
	return nsMb('irons_spellbooks:fire_boss', 1000, 'Эхо Тироса', { hp: hp })
}
function nsMbKeeper(hp) {
	return nsMb('irons_spellbooks:citadel_keeper', 60, 'Магистр цитадели', { hp: hp, scale: 1.5 })
}
// alt — варианты для ПОВТОРОВ волны (фарм): первое прохождение — всегда главный босс (его описывает книга), дальше по
// кругу: главный → вариант 1 → вариант 2… Счётчик повторов — state.bossRot[волна] (растёт с каждой победой на ней)
NSG.NS_MOD_BOSSES = {
	15: { boss: nsMb('arphex:spider_goliath', 200, 'Голиаф', { scale: 1.8 }) },
	20: { boss: nsMb('arphex:spider_matriarch', 350, 'Паучиха-матриарх'), alt: [{ boss: nsMbKeeper(220), extra: [{ boss: nsMbKeeper(220), count: 1 }] }] },
	25: { boss: nsMb('arphex:termite_tunneler_king', 250, 'Термитный король', { scale: 1.3 }), alt: [{ boss: nsMbKing(260) }] },
	30: { boss: nsMb('arphex:arthropleura_abomination', 300, 'Артроплевра-мерзость'), alt: [{ boss: nsMbKing(300), extra: [{ boss: nsMbKeeper(200), count: 1 }] }] },
	35: { boss: nsMb('arphex:scorpioid_bloodluster', 450, 'Скорпиоид-кровопийца'), alt: [{ boss: nsMbTyros(480) }] },
	40: { boss: nsMb('arphex:draconic_voidlasher', 500, 'Пустотный драконохвост'), alt: [{ boss: nsMbTyros(520) }, { boss: nsMbKing(420), extra: [{ boss: nsMbKeeper(260), count: 2 }] }] },
	45: { boss: nsMb('arphex:arachnoid_trisector', 650, 'Арахноид-трисектор'), alt: [{ boss: nsMbTyros(650), extra: [{ boss: nsMbKeeper(260), count: 1 }] }] },
	50: { boss: nsMb('arphex:diabolos_decimator', 750, 'Диаболос-истребитель'), alt: [{ boss: nsMbTyros(750), extra: [{ boss: nsMbKing(400), count: 1 }] }] },
	55: { boss: nsMb('arphex:spider_matriarch', 350, 'Паучиха-матриарх'), extra: [{ boss: nsMb('arphex:arthropleura_abomination', 300, 'Артроплевра-мерзость'), count: 1 }], alt: [{ boss: nsMbKing(450), extra: [{ boss: nsMb('arphex:arachnoid_trisector', 650, 'Арахноид-трисектор'), count: 1 }] }] },
	60: { boss: nsMb('arphex:arachnoid_trisector', 650, 'Арахноид-трисектор'), extra: [{ boss: nsMb('arphex:scorpioid_bloodluster', 450, 'Скорпиоид-кровопийца'), count: 1 }], alt: [{ boss: nsMbTyros(700), extra: [{ boss: nsMb('arphex:draconic_voidlasher', 500, 'Пустотный драконохвост'), count: 1 }] }] },
	65: { boss: nsMb('arphex:diabolos_decimator', 750, 'Диаболос-истребитель'), extra: [{ boss: nsMb('arphex:draconic_voidlasher', 500, 'Пустотный драконохвост'), count: 1 }], alt: [{ boss: nsMbTyros(800), extra: [{ boss: nsMbKing(500), count: 1 }, { boss: nsMbKeeper(300), count: 2 }] }] },
}
// Вариант босса волны d: 0 — главный; на повторах (d ≤ лучшей пройденной) — по счётчику state.bossRot[d]
NSG.nsModBossVariant = function (d) {
	var b = NSG.NS_MOD_BOSSES[d]
	if (!b || !b.alt || !b.alt.length) return 0
	try {
		var st = typeof nsGetStateRO === 'function' ? nsGetStateRO() : null
		if (!st || d > (st.phase || 0)) return 0
		return ((st.bossRot && st.bossRot[d]) || 0) % (b.alt.length + 1)
	} catch (e) {
		return 0
	}
}
// Все варианты боссов (для бестиария и контрактов): [{d, boss}]
NSG.nsModBossAll = function () {
	var out = []
	for (var w in NSG.NS_MOD_BOSSES) {
		var b = NSG.NS_MOD_BOSSES[w]
		var vs = [{ boss: b.boss, extra: b.extra || [] }].concat(b.alt || [])
		for (var v = 0; v < vs.length; v++) {
			out.push({ d: Number(w), boss: vs[v].boss })
			for (var x = 0; vs[v].extra && x < vs[v].extra.length; x++) out.push({ d: Number(w), boss: vs[v].extra[x].boss })
		}
	}
	return out
}
// Модовый босс волны d (15–69, кратные 5) или null; scale — множители (доли к базе), применяются к боссу и его паре
NSG.nsModBossFor = function (d, toughHp) {
	var b = NSG.NS_MOD_BOSSES[d]
	if (!b) return null
	var v = NSG.nsModBossVariant(d)
	var pick = v > 0 ? b.alt[v - 1] : b
	return {
		boss: pick.boss,
		extra: pick.extra || [],
		variant: v,
		scale: { hp: toughHp + d / 12, damage: d <= 30 ? -0.3 : d <= 45 ? -0.15 : 0, speed: 0.2, size: 1 },
	}
}

// Свита Кошмара (финал волн 70+) — модовая: тяжёлые пауки, краб, жнец, моль
NSG.NS_MOD_FINALE = function () {
	var M = NSG.NS_MOD_MOBS
	return [nsMwEntry(M.crab, 0, 1, 1), nsMwEntry(M.reaper, 0, 1, 2), nsMwEntry(M.prowler, 0, 1, 2), nsMwEntry(M.moth, 0, 1, 1), nsMwEntry(M.kamikaze_heavy, 0, 1, 1)]
}
