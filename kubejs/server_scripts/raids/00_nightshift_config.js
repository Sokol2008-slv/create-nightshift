// ==========================================================================
// Ночная смена — конфиг фаз, жертв и составов орд (server_scripts)
// Загружается первым (префикс 00_), кладёт всё в NSG.NIGHTSHIFT_CONFIG,
// остальные server_scripts/*.js (10_, 20_, 30_, 40_) читают из NSG.
//
// KubeJS грузит все файлы server_scripts одного типа в общий Rhino-контекст,
// объект `global` — общий между файлами одной перезагрузки скриптов (стандартное
// и многократно задокументированное поведение KubeJS, отдельно по jar не
// проверялось — не специфично для 2101, не менялось версиями).
//
// Цифры жертв и составов орд — из docs/PLAN.md §8 (таблица "Оборона и орды")
// и docs/phases/defense_and_hordes.md (§ Задача 3). Где два документа
// расходились в числах — взят PLAN.md как основной документ, второй как
// сверочный. ВСЁ ПОМЕЧЕНО "оценка, проверить на тесте" — это заложено и в
// самом плане (спорить с реальным HP мобов будем через Jade на сервере).
// ==========================================================================

// Общее состояние скриптов набегов. В KubeJS 2101 серверным скриптам запрещено
// писать в global, а top-level var виден всем серверным скриптам.
var NSG = {}

NSG.NIGHTSHIFT_NS = 'nightshift'

// --------------------------------------------------------------------------
// Жертвы по фазам: ключ — номер ФАЗЫ, В КОТОРУЮ переходим (т.е. запись под
// ключом 1 — это жертва P0→P1, под ключом 2 — жертва P1→P2, и т.д.)
// Формат: { items: {itemId: count}, manual: true|false }
//   manual: true  — жертва руками (ПКМ по алтарю предметом в руке), сейчас
//                    это только переход 0→1.
//   manual: false — жертва только через инвентарь алтаря (конвейер Create).
// --------------------------------------------------------------------------
// Моб набега: id без неймспейса minecraft, число на одного игрока, подпись для прогноза, NBT
function nsMob(id, count, label, nbt) {
	return { id: 'minecraft:' + id, count: count, label: label, nbt: nbt || '' }
}
function nsArmor(mat) {
	var slots = ['boots', 'leggings', 'chestplate', 'helmet']
	var items = []
	for (var i = 0; i < slots.length; i++) items.push('{id:"minecraft:' + mat + '_' + slots[i] + '",count:1}')
	return 'ArmorItems:[' + items.join(',') + '],ArmorDropChances:[0f,0f,0f,0f]'
}
function nsHand(item) {
	return 'HandItems:[{id:"minecraft:' + item + '",count:1},{}],HandDropChances:[0f,0f]'
}
var NS_ARMOR = { leather: nsArmor('leather'), chain: nsArmor('chainmail'), iron: nsArmor('iron'), diamond: nsArmor('diamond') }
var NS_BABY = 'IsBaby:1b'
var NS_SPEED = 'active_effects:[{id:"minecraft:speed",amplifier:0b,duration:-1,show_particles:0b}]'

NSG.NIGHTSHIFT_CONFIG = {
	sacrifices: {
		// P0 -> P1 (Разнорабочий): ровно как в плане, руками.
		1: {
			manual: true,
			items: {
				'minecraft:dirt': 64,
				'minecraft:stone': 64,
			},
		},
		// P1 -> P2 (Латунь): продукция текущей (P1) фазы — андезитовый сплав,
		// железо/медь, водяные колёса Create. Только конвейером.
		2: {
			manual: false,
			items: {
				'create:andesite_alloy': 64,
				'minecraft:iron_ingot': 32,
				'minecraft:copper_ingot': 32,
				'create:water_wheel': 4,
			},
		},
		// P2 -> P3 (Пар и глубина): латунь/механизм точности — продукция P2.
		3: {
			manual: false,
			items: {
				'create:brass_block': 32,
				'create:precision_mechanism': 8,
				'minecraft:gold_ingot': 16,
				'create:zinc_ingot': 32,
			},
		},
		// P3 -> P4 (Сталь и нефть): редстоун/лазурит/алмазы/Нижний мир — продукция P3.
		4: {
			manual: false,
			items: {
				'minecraft:redstone': 64,
				'minecraft:lapis_lazuli': 32,
				'minecraft:diamond': 16,
				'minecraft:blaze_rod': 16,
			},
		},
		// P4 -> P5 (Энергия): свинец/никель/литий/сера/нефть TFMG — продукция P4.
		// ID проверены по jar (models/item) 26.09.
		// свериться в JEI на тестовом сервере перед использованием!
		5: {
			manual: false,
			items: {
				'tfmg:steel_ingot': 64,
				'tfmg:lead_ingot': 32,
				'tfmg:nickel_ingot': 32,
			},
		},
		// P5 -> P6 (Космос): торий — продукция P5. Финал: "Великая орда с боссом".
		// ID проверен по jar 26.09.
		6: {
			manual: false,
			items: {
				'create_new_age:thorium': 32, // торий Create: New Age
			},
			isFinal: true, // после этой жертвы — Великая орда с боссом, а не обычный жертвенный набег
		},
	},

	// ------------------------------------------------------------------
	// Составы орд: hordes[P] — жертвенный набег из фазы P и малый набег в фазе P.
	// Числа — на ОДНОГО игрока: nsPartyScale() умножает их на размер команды
	// (×1,5 на двоих, ×2 на троих). Финальная жертва (P5→P6) — волны P5, затем P6 и босс.
	// Экипировка мобов — NBT для /summon (броня и оружие не выпадают).
	// Криперов нет: взрыв сносит машины.
	// ------------------------------------------------------------------
	hordes: {
		0: {
			waves: [
				[nsMob('zombie', 6, 'зомби'), nsMob('zombie', 2, 'зомби-малыш', NS_BABY)],
				[nsMob('zombie', 5, 'зомби'), nsMob('zombie', 3, 'зомби в коже', NS_ARMOR.leather)],
			],
			minor: [nsMob('zombie', 4, 'зомби'), nsMob('zombie', 1, 'зомби-малыш', NS_BABY)],
		},
		1: {
			waves: [
				[nsMob('zombie', 8, 'зомби'), nsMob('zombie', 2, 'зомби-малыш', NS_BABY)],
				[nsMob('skeleton', 5, 'скелет'), nsMob('spider', 3, 'паук')],
				[nsMob('zombie', 6, 'зомби в коже с мечом', NS_ARMOR.leather + ',' + nsHand('stone_sword')), nsMob('zombie', 4, 'зомби')],
			],
			minor: [nsMob('zombie', 5, 'зомби'), nsMob('skeleton', 2, 'скелет'), nsMob('spider', 1, 'паук')],
		},
		2: {
			waves: [
				[nsMob('zombie', 10, 'зомби'), nsMob('husk', 4, 'кадавр')],
				[nsMob('skeleton', 6, 'скелет'), nsMob('stray', 2, 'зимогор'), nsMob('spider', 4, 'паук')],
				[nsMob('zombie', 6, 'зомби в кольчуге', NS_ARMOR.chain + ',' + nsHand('iron_sword')), nsMob('witch', 2, 'ведьма')],
				[nsMob('vindicator', 3, 'поборник'), nsMob('pillager', 4, 'разбойник')],
			],
			minor: [nsMob('zombie', 6, 'зомби'), nsMob('husk', 2, 'кадавр'), nsMob('spider', 2, 'паук'), nsMob('skeleton', 2, 'скелет')],
		},
		3: {
			waves: [
				[nsMob('husk', 8, 'кадавр'), nsMob('zombie', 4, 'зомби-малыш', NS_BABY), nsMob('zombie', 6, 'зомби')],
				[nsMob('skeleton', 8, 'скелет'), nsMob('stray', 4, 'зимогор')],
				[nsMob('phantom', 6, 'фантом')], // воздушная волна — коридор не спасёт
				[nsMob('zombie', 6, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_sword')), nsMob('vindicator', 4, 'поборник'), nsMob('witch', 2, 'ведьма')],
				[nsMob('spider', 6, 'паук'), nsMob('cave_spider', 6, 'пещерный паук')], // лезут по стенам
			],
			minor: [nsMob('zombie', 6, 'зомби'), nsMob('skeleton', 3, 'скелет'), nsMob('phantom', 2, 'фантом'), nsMob('cave_spider', 2, 'пещерный паук')],
		},
		4: {
			waves: [
				[nsMob('zombie', 10, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_axe')), nsMob('husk', 6, 'кадавр')],
				[nsMob('skeleton', 10, 'скелет'), nsMob('stray', 4, 'зимогор')],
				[nsMob('phantom', 8, 'фантом')],
				[nsMob('vindicator', 6, 'поборник'), nsMob('evoker', 1, 'заклинатель'), nsMob('pillager', 6, 'разбойник')],
				[nsMob('ravager', 1, 'опустошитель'), nsMob('pillager', 4, 'разбойник'), nsMob('wither_skeleton', 4, 'визер-скелет')],
			],
			minor: [nsMob('zombie', 6, 'зомби в железе', NS_ARMOR.iron), nsMob('skeleton', 3, 'скелет'), nsMob('vindicator', 2, 'поборник'), nsMob('pillager', 2, 'разбойник')],
		},
		5: {
			waves: [
				[nsMob('zombie', 8, 'зомби в алмазе, быстрый', NS_ARMOR.diamond + ',' + nsHand('diamond_sword') + ',' + NS_SPEED), nsMob('zombie', 10, 'зомби')],
				[nsMob('skeleton', 12, 'скелет'), nsMob('stray', 6, 'зимогор')],
				[nsMob('phantom', 10, 'фантом')],
				[nsMob('vindicator', 8, 'поборник'), nsMob('evoker', 2, 'заклинатель')],
				[nsMob('ravager', 2, 'опустошитель'), nsMob('pillager', 6, 'разбойник')],
				[nsMob('wither_skeleton', 8, 'визер-скелет')],
			],
			minor: [nsMob('zombie', 4, 'зомби в алмазе', NS_ARMOR.diamond), nsMob('zombie', 8, 'зомби'), nsMob('skeleton', 4, 'скелет'), nsMob('phantom', 3, 'фантом')],
		},
		6: {
			// Вторая половина Великой орды. Мобы планет Northstar и рядовые твари ArPhEx
			// в Верхнем мире исчезают сразу после /summon (проверено 26.09) — здесь ванильные.
			waves: [
				[nsMob('wither_skeleton', 10, 'визер-скелет с алмазным мечом', nsHand('diamond_sword'))],
				[nsMob('evoker', 3, 'заклинатель'), nsMob('vindicator', 8, 'поборник')],
				[nsMob('stray', 10, 'зимогор'), nsMob('husk', 10, 'кадавр')],
				[nsMob('ravager', 3, 'опустошитель'), nsMob('pillager', 8, 'разбойник')],
			],
			// Scorpioid Bloodluster (ArPhEx): наземный, 450 HP, разрушение блоков у ArPhEx
			// выключено в конфиге. Tormentor не взят: механика запечатывания — набег мог
			// бы не закончиться. Wither ломал бы машины взрывами.
			boss: { id: 'arphex:scorpioid_bloodluster', hpLabel: 450, label: 'Скорпиоид-кровопийца' },
			minor: null, // в P6 малых набегов нет
		},
	},
}

// --------------------------------------------------------------------------
// Оценочный HP мобов — ТОЛЬКО для прогноза орды в чате/боссбаре (не влияет на
// реальную игровую логику урона). Ванильные значения — общеизвестные, для
// northstar-мобов и мода в целом — оценка "как у зомби", проверить Jade.
// --------------------------------------------------------------------------
NSG.NIGHTSHIFT_MOB_HP = {
	'minecraft:zombie': 20,
	'minecraft:husk': 20,
	'minecraft:drowned': 20,
	'minecraft:skeleton': 20,
	'minecraft:stray': 20,
	'minecraft:spider': 16,
	'minecraft:cave_spider': 8,
	'minecraft:creeper': 20,
	'minecraft:witch': 26,
	'minecraft:vindicator': 24,
	'minecraft:evoker': 24,
	'minecraft:pillager': 24,
	'minecraft:ravager': 100,
	'minecraft:phantom': 20,
	'minecraft:piglin': 16,
	'minecraft:wither_skeleton': 20,
	'minecraft:blaze': 20,
	'minecraft:wither': 300,
	'northstar:frozen_zombie': 20, // оценка, проверить Jade
	'northstar:mercury_raptor': 20,
	'northstar:mercury_roach': 12,
	'northstar:mercury_tortoise': 30,
	'northstar:venus_vulture': 16,
	'northstar:venus_stone_bull': 40,
	'northstar:venus_scorpion': 20,
	'northstar:venus_mimic': 24,
	'northstar:mars_cobra': 16,
	'northstar:mars_moth': 14,
	'northstar:mars_toad': 18,
	'northstar:mars_worm': 24,
	'northstar:moon_eel': 20,
	'northstar:moon_snail': 12,
	'northstar:moon_lunargrade': 20,
}

// --------------------------------------------------------------------------
// Защищённые от "грызения" ордой пространства имён блоков — механизмы этих
// модов НИКОГДА не ломаются, независимо от наличия блок-сущности (белый список
// расширять по мере добавления новых модов обороны/логистики).
// Блоки С блок-сущностью (getEntity() != null) не ломаются в любом случае —
// это отдельная, более общая проверка в 40_nightshift_raid.js.
// --------------------------------------------------------------------------
// Машины защищены проверкой «есть блок-сущность» (nsIsBlockProtected) — это все
// механизмы Create/TFMG, сундуки, валы, ленты. Моды целиком НЕ защищаем: иначе стена
// из декоративного камня или обшивки Create стала бы неразрушимой уже в P1.
// Здесь — только моды обороны, у которых и декоративные части — часть оружия.
NSG.NIGHTSHIFT_PROTECTED_NAMESPACES = [
	'createbigcannons',
	'create_radar',
	'creategbd', // Create Guardian Beam Defense
	'cbc_at', // автопушки для Big Cannons
]

// Параметры набега/зон — общие константы.
NSG.NIGHTSHIFT_TUNABLES = {
	zoneParticleType: 'minecraft:end_rod',
	raidRingMinDist: 30,
	raidRingMaxDist: 45,
	raidCountdownSeconds: 60,
	raidFailRadius: 2, // моб ближе этого расстояния до алтаря = провал
	raidPlayerRadius: 64, // набег идёт, только пока игрок ближе этого к алтарю (иначе пауза)
	raidTrackRadius: 96, // в какой коробке вокруг алтаря ищем мобов набега
	navTickInterval: 20, // "раз в секунду" — тики
	stuckEpsilonSq: 0.15 * 0.15, // квадрат минимального смещения, которое считаем "не застрял"
	stuckTicksToChew: 60, // 3 секунды простоя подряд — начинаем "грызть" блок
	chewTicksPerHardness: 40, // время грызения = прочность × это (тики): булыжник 4 с, глубинный сланец 6 с, железный блок 10 с
	chewTicksMin: 20, // не быстрее секунды даже для hardness=0
	chewTicksMax: 1200, // не дольше минуты даже для обсидиана
	minorRaidEveryNights: 5,
}
