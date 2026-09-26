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
	// Составы орд. waves — массив волн, каждая волна — массив {id, count}.
	// minor — состав малого набега (каждые 5 ночей, без провала).
	// boss (только phase 6) — отдельная волна-босс, спавнится ПОСЛЕ того,
	// как обычные волны зачищены; победа = смерть босса.
	// ------------------------------------------------------------------
	hordes: {
		0: {
			waves: [[{ id: 'minecraft:zombie', count: 8 }]], // 160 HP, PLAN.md §8
			minor: [{ id: 'minecraft:zombie', count: 4 }],
		},
		1: {
			waves: [
				[{ id: 'minecraft:zombie', count: 8 }],
				[
					{ id: 'minecraft:skeleton', count: 4 },
					{ id: 'minecraft:spider', count: 2 },
				],
			], // 272 HP суммарно, совпадает с PLAN.md §8
			minor: [
				{ id: 'minecraft:zombie', count: 5 },
				{ id: 'minecraft:skeleton', count: 2 },
			],
		},
		2: {
			waves: [
				[{ id: 'minecraft:zombie', count: 10 }],
				[
					{ id: 'minecraft:skeleton', count: 5 },
					{ id: 'minecraft:spider', count: 2 },
				],
				[
					{ id: 'minecraft:vindicator', count: 2 },
					{ id: 'minecraft:witch', count: 1 },
				],
			], // ~406 HP, план ждёт ~400
			minor: [
				{ id: 'minecraft:zombie', count: 6 },
				{ id: 'minecraft:spider', count: 2 },
				{ id: 'minecraft:creeper', count: 1 },
			],
		},
		3: {
			waves: [
				[{ id: 'minecraft:zombie', count: 10 }],
				[
					{ id: 'minecraft:skeleton', count: 5 },
					{ id: 'minecraft:spider', count: 3 },
				],
				[
					{ id: 'minecraft:vindicator', count: 3 },
					{ id: 'minecraft:witch', count: 1 },
				],
				[{ id: 'minecraft:phantom', count: 6 }], // воздушная волна, как в плане
			], // ~566 HP, план ждёт ~590
			minor: [
				{ id: 'minecraft:zombie', count: 8 },
				{ id: 'minecraft:skeleton', count: 2 },
				{ id: 'minecraft:phantom', count: 2 },
			],
		},
		4: {
			waves: [
				[{ id: 'minecraft:zombie', count: 12 }],
				[
					{ id: 'minecraft:skeleton', count: 6 },
					{ id: 'minecraft:spider', count: 3 },
				],
				[
					{ id: 'minecraft:vindicator', count: 4 },
					{ id: 'minecraft:witch', count: 2 },
				],
				[
					// "элита" из плана — Draugr Invasion пока НЕ установлен в паке,
					// временно замещаем Ravager+Pillager (ravager ~100 HP как заглушка
					// под "тяжёлую" цель). Заменить на драугра, когда мод добавят.
					{ id: 'minecraft:ravager', count: 1 },
					{ id: 'minecraft:pillager', count: 2 },
				],
			], // ~704 HP, план ждёт ~680
			minor: [
				{ id: 'minecraft:zombie', count: 10 },
				{ id: 'minecraft:skeleton', count: 1 },
				{ id: 'minecraft:vindicator', count: 2 },
			],
		},
		5: {
			// "как P4 × 1.5" по плану
			waves: [
				[{ id: 'minecraft:zombie', count: 14 }],
				[
					{ id: 'minecraft:skeleton', count: 7 },
					{ id: 'minecraft:spider', count: 3 },
				],
				[
					{ id: 'minecraft:vindicator', count: 5 },
					{ id: 'minecraft:witch', count: 2 },
				],
				[
					{ id: 'minecraft:ravager', count: 1 },
					{ id: 'minecraft:pillager', count: 4 },
				],
			], // ~836 HP, план ждёт ~950 — недобор, поднять числа на тесте при необходимости
			minor: [
				{ id: 'minecraft:zombie', count: 15 },
				{ id: 'minecraft:skeleton', count: 3 },
			],
		},
		6: {
			// Мобы планет Northstar — ID подтверждены по jar (data/northstar/loot_table/entities/*)
			waves: [
				[{ id: 'northstar:frozen_zombie', count: 6 }],
				[
					{ id: 'northstar:mercury_raptor', count: 4 },
					{ id: 'northstar:venus_vulture', count: 3 },
				],
				[
					{ id: 'northstar:venus_stone_bull', count: 4 },
					{ id: 'northstar:mars_cobra', count: 3 },
				],
				[
					{ id: 'northstar:mars_toad', count: 6 },
					{ id: 'northstar:moon_eel', count: 4 },
				],
			], // ~600 HP обычных волн, план ждёт ~700 без босса — донастроить
			// Финальный босс. В паке физически нет ни одной boss-сущности
			// (проверено: Northstar, ArPhEx и др. хоррор-моды не установлены/без
			// боссов). Решение по плану (§12, п.2) — выбрать между ArPhEx и
			// Draugr Invasion ПОСЛЕ теста. Пока — заглушка на ванильном Wither
			// (300 HP, летает, дальний бой), самый дешёвый путь без новых модов.
			// ЗАМЕНИТЬ на выбранного босса, когда решение будет принято.
			boss: { id: 'minecraft:wither', hpLabel: 300 },
			minor: null, // на планетах малых набегов нет (P6 — свой хоррор, не набеги)
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
