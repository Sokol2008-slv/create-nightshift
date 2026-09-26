// ==========================================================================
// Ночная смена — конфиг набегов: сложности, составы орд, добыча (server_scripts)
// Загружается первым (префикс 00_), кладёт всё в NSG.NIGHTSHIFT_CONFIG,
// остальные server_scripts/*.js (10_, 20_, 30_, 40_) читают из NSG.
//
// KubeJS грузит все файлы server_scripts одного типа в общий Rhino-контекст,
// объект `global` — общий между файлами одной перезагрузки скриптов (стандартное
// и многократно задокументированное поведение KubeJS, отдельно по jar не
// проверялось — не специфично для 2101, не менялось версиями).
//
// Составы орд и добыча — оценка, подбираются по живым набегам (HP мобов — через Jade).
// ==========================================================================

// Общее состояние скриптов набегов. В KubeJS 2101 серверным скриптам запрещено
// писать в global, а top-level var виден всем серверным скриптам.
var NSG = {}

NSG.NIGHTSHIFT_NS = 'nightshift'

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
// «Бегун» — скорость II; «Громила» — 60 HP; «Тень» — невидимость; имена видны при наведении
var NS_RUNNER = 'active_effects:[{id:"minecraft:speed",amplifier:1b,duration:-1,show_particles:0b}],CustomName:\'"Бегун"\''
var NS_BRUTE = 'attributes:[{id:"minecraft:generic.max_health",base:60.0d}],Health:60.0f,CustomName:\'"Громила"\''
var NS_SHADOW = 'active_effects:[{id:"minecraft:invisibility",amplifier:0b,duration:-1,show_particles:0b}],CustomName:\'"Тень"\''
var NS_SLIME = 'Size:2'
// Моб из мода (id целиком)
function nsModMob(id, count, label, nbt) {
	return { id: id, count: count, label: label, nbt: nbt || '' }
}
// Предмет в руке с чарами: nsHandEnch('bow', {power:3, flame:1})
function nsHandEnch(item, ench) {
	var lv = []
	for (var k in ench) lv.push('"minecraft:' + k + '":' + ench[k])
	return 'HandItems:[{id:"minecraft:' + item + '",count:1,components:{"minecraft:enchantments":{levels:{' + lv.join(',') + '}}}},{}],HandDropChances:[0f,0f]'
}
function nsName(name) {
	return "CustomName:'\"" + name + "\"'"
}
// Пиглины и хоглины в Верхнем мире через 15 с становятся зомби-пиглинами (мирными) — запрещаем
var NS_NO_ZOMBIFY = 'IsImmuneToZombification:1b'
var NS_MAGMA_BIG = 'Size:3'
// Подражатель (мод Artifacts): после смерти всегда роняет артефакт — «пиньята» в поздних волнах
var NS_MIMIC = nsModMob('artifacts:mimic', 0.4, 'подражатель (роняет артефакт)')

NSG.NIGHTSHIFT_CONFIG = {
	// ------------------------------------------------------------------
	// Базовые составы орд уровней угрозы 0–6: из них собраны сложности 1–6 и 10
	// (NIGHTSHIFT_DIFFICULTY ниже), minor — малый набег раз в 5 ночей.
	// Числа — на ОДНОГО игрока: nsPartyScale() умножает их на размер команды
	// (×1,5 на двоих, ×2 на троих).
	// Экипировка мобов — NBT для /summon (броня и оружие не выпадают).
	// Криперов нет: взрыв сносит машины.
	// ------------------------------------------------------------------
	hordes: {
		0: {
			waves: [
				[nsMob('zombie', 8, 'зомби'), nsMob('zombie', 3, 'зомби-малыш', NS_BABY)],
				[nsMob('zombie', 6, 'зомби'), nsMob('zombie', 3, 'бегун', NS_RUNNER), nsMob('zombie', 3, 'зомби в коже', NS_ARMOR.leather)],
				[nsMob('spider', 4, 'паук'), nsMob('zombie', 6, 'зомби')],
			],
			minor: [nsMob('zombie', 5, 'зомби'), nsMob('zombie', 2, 'бегун', NS_RUNNER)],
		},
		1: {
			waves: [
				[nsMob('zombie', 10, 'зомби'), nsMob('zombie', 4, 'зомби-малыш', NS_BABY), nsMob('zombie', 3, 'бегун', NS_RUNNER)],
				[nsMob('skeleton', 6, 'скелет'), nsMob('bogged', 3, 'трясинный скелет'), nsMob('spider', 4, 'паук')],
				[nsMob('zombie', 8, 'зомби в коже с мечом', NS_ARMOR.leather + ',' + nsHand('stone_sword')), nsMob('zombie', 1, 'громила', NS_BRUTE), nsMob('zombie', 4, 'зомби')],
				[nsMob('slime', 4, 'слизень', NS_SLIME), nsMob('husk', 6, 'кадавр')],
			],
			minor: [nsMob('zombie', 6, 'зомби'), nsMob('skeleton', 3, 'скелет'), nsMob('zombie', 2, 'бегун', NS_RUNNER)],
		},
		2: {
			waves: [
				[nsMob('zombie', 14, 'зомби'), nsMob('husk', 6, 'кадавр'), nsMob('zombie', 4, 'бегун', NS_RUNNER)],
				[nsMob('skeleton', 8, 'скелет'), nsMob('stray', 3, 'зимогор'), nsMob('bogged', 3, 'трясинный скелет'), nsMob('spider', 6, 'паук')],
				[nsMob('zombie', 10, 'зомби в кольчуге', NS_ARMOR.chain + ',' + nsHand('iron_sword')), nsMob('witch', 3, 'ведьма'), nsMob('zombie', 2, 'громила', NS_BRUTE)],
				[nsMob('vindicator', 5, 'поборник'), nsMob('pillager', 6, 'разбойник')],
				[nsMob('zombie', 12, 'зомби'), nsMob('zombie', 5, 'зомби-малыш', NS_BABY), nsMob('drowned', 4, 'утопленник', nsHand('trident'))],
			],
			minor: [nsMob('zombie', 8, 'зомби'), nsMob('husk', 3, 'кадавр'), nsMob('spider', 3, 'паук'), nsMob('bogged', 2, 'трясинный скелет')],
		},
		3: {
			waves: [
				[nsMob('husk', 14, 'кадавр'), nsMob('zombie', 6, 'зомби-малыш', NS_BABY), nsMob('zombie', 8, 'бегун', NS_RUNNER)],
				[nsMob('skeleton', 14, 'скелет'), nsMob('stray', 6, 'зимогор'), nsMob('bogged', 4, 'трясинный скелет')],
				[nsMob('phantom', 12, 'фантом')], // воздушная волна — коридор не спасёт
				[nsMob('zombie', 12, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_sword')), nsMob('vindicator', 7, 'поборник'), nsMob('witch', 3, 'ведьма'), nsMob('zombie', 2, 'громила', NS_BRUTE)],
				[nsMob('spider', 10, 'паук'), nsMob('cave_spider', 10, 'пещерный паук'), nsMob('spider', 4, 'тень', NS_SHADOW)], // лезут по стенам
				[nsMob('breeze', 5, 'вихрь'), nsMob('zombie', 14, 'зомби')],
			],
			minor: [nsMob('zombie', 8, 'зомби'), nsMob('skeleton', 4, 'скелет'), nsMob('phantom', 3, 'фантом'), nsMob('cave_spider', 3, 'пещерный паук')],
		},
		4: {
			waves: [
				[nsMob('zombie', 16, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_axe')), nsMob('husk', 10, 'кадавр'), nsMob('zombie', 6, 'бегун', NS_RUNNER)],
				[nsMob('skeleton', 16, 'скелет'), nsMob('stray', 8, 'зимогор')],
				[nsMob('phantom', 14, 'фантом')],
				[nsMob('vindicator', 12, 'поборник'), nsMob('evoker', 2, 'заклинатель'), nsMob('pillager', 10, 'разбойник'), nsMob('illusioner', 1, 'иллюзионист')],
				[nsMob('ravager', 2, 'опустошитель'), nsMob('pillager', 8, 'разбойник'), nsMob('wither_skeleton', 8, 'визер-скелет')],
				[nsMob('zoglin', 4, 'зоглин'), nsMob('zombie', 3, 'громила', NS_BRUTE), nsMob('zombie', 12, 'зомби в железе', NS_ARMOR.iron)],
			],
			minor: [nsMob('zombie', 8, 'зомби в железе', NS_ARMOR.iron), nsMob('skeleton', 4, 'скелет'), nsMob('vindicator', 3, 'поборник'), nsMob('breeze', 2, 'вихрь')],
		},
		5: {
			waves: [
				[nsMob('zombie', 14, 'зомби в алмазе, быстрый', NS_ARMOR.diamond + ',' + nsHand('diamond_sword') + ',' + NS_SPEED), nsMob('zombie', 16, 'зомби')],
				[nsMob('skeleton', 18, 'скелет'), nsMob('stray', 10, 'зимогор'), nsMob('bogged', 6, 'трясинный скелет')],
				[nsMob('phantom', 16, 'фантом')],
				[nsMob('vindicator', 14, 'поборник'), nsMob('evoker', 3, 'заклинатель'), nsMob('illusioner', 2, 'иллюзионист')],
				[nsMob('ravager', 3, 'опустошитель'), nsMob('pillager', 12, 'разбойник')],
				[nsMob('wither_skeleton', 14, 'визер-скелет'), nsMob('zoglin', 4, 'зоглин')],
				[nsMob('zombie', 22, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_sword')), nsMob('zombie', 10, 'зомби-малыш', NS_BABY), nsMob('zombie', 4, 'громила', NS_BRUTE)],
				[nsMob('breeze', 6, 'вихрь'), nsMob('spider', 6, 'тень', NS_SHADOW)],
			],
			minor: [nsMob('zombie', 6, 'зомби в алмазе', NS_ARMOR.diamond), nsMob('zombie', 10, 'зомби'), nsMob('skeleton', 5, 'скелет'), nsMob('phantom', 4, 'фантом')],
		},
		6: {
			// Вторая половина Великой орды. Мобы планет Northstar и рядовые твари ArPhEx
			// в Верхнем мире исчезают сразу после /summon (проверено 26.09) — здесь ванильные.
			waves: [
				[nsMob('wither_skeleton', 14, 'визер-скелет с алмазным мечом', nsHand('diamond_sword'))],
				[nsMob('evoker', 4, 'заклинатель'), nsMob('vindicator', 12, 'поборник')],
				[nsMob('stray', 14, 'зимогор'), nsMob('husk', 14, 'кадавр')],
				[nsMob('ravager', 4, 'опустошитель'), nsMob('pillager', 12, 'разбойник')],
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
// Сложности набега (игрок выбирает у алтаря). Победа на N открывает N+1.
// waves — список волн, boss — последний противник (опц.), buff — эффекты всем мобам
// набега (уровень эффекта, 1 = I), loot — уровень таблицы добычи.
// Сложности 1–6 — прежние уровни угрозы 0–5, 10 — Великая орда. Выше 10 — «Кошмар N»:
// волны 10-й сложности, мобов больше и они крепче с каждым уровнем (nsChallengeHorde).
// --------------------------------------------------------------------------
var NSH = NSG.NIGHTSHIFT_CONFIG.hordes
NSG.NIGHTSHIFT_DIFFICULTY = {
	1: { name: 'Ночной дозор', waves: NSH[0].waves },
	2: { name: 'Бродяги', waves: NSH[1].waves },
	3: { name: 'Нашествие', waves: NSH[2].waves },
	4: { name: 'Кровавая луна', waves: NSH[3].waves },
	5: {
		name: 'Осада',
		waves: NSH[4].waves,
		boss: { id: 'minecraft:vindicator', hpLabel: 150, label: 'Вожак разбойников', nbt: nsName('Вожак разбойников') + ',' + nsHandEnch('netherite_axe', { sharpness: 2 }) + ',Health:150.0f,attributes:[{id:"minecraft:generic.max_health",base:150.0d},{id:"minecraft:generic.scale",base:1.3d}]' },
	},
	6: { name: 'Легион', waves: NSH[5].waves },
	7: {
		name: 'Пекло',
		waves: [
			[nsMob('wither_skeleton', 14, 'визер-скелет'), nsMob('magma_cube', 8, 'магмовый куб', 'Size:2')],
			[nsMob('piglin_brute', 8, 'брут пиглинов', NS_NO_ZOMBIFY), nsMob('hoglin', 6, 'хоглин', NS_NO_ZOMBIFY)],
			[nsMob('zoglin', 8, 'зоглин'), nsMob('zombie', 10, 'бегун', NS_RUNNER)],
			[nsMob('wither_skeleton', 12, 'визер-скелет с алмазным мечом', nsHand('diamond_sword')), nsMob('skeleton', 12, 'скелет с огненным луком', nsHandEnch('bow', { power: 2, flame: 1 }))],
			[nsMob('magma_cube', 8, 'большой магмовый куб', NS_MAGMA_BIG), nsMob('piglin_brute', 6, 'брут пиглинов', NS_NO_ZOMBIFY), NS_MIMIC],
			[nsMob('hoglin', 8, 'хоглин', NS_NO_ZOMBIFY), nsMob('wither_skeleton', 16, 'визер-скелет'), nsMob('zombie', 4, 'громила', NS_BRUTE)],
			[nsMob('skeleton', 14, 'скелет с огненным луком', nsHandEnch('bow', { power: 2, flame: 1 })), nsMob('wither_skeleton', 10, 'визер-скелет'), nsMob('zoglin', 6, 'зоглин')],
			[nsMob('piglin_brute', 10, 'брут пиглинов', NS_NO_ZOMBIFY), nsMob('hoglin', 8, 'хоглин', NS_NO_ZOMBIFY), nsMob('magma_cube', 6, 'большой магмовый куб', NS_MAGMA_BIG)],
		],
		boss: { id: 'minecraft:piglin_brute', hpLabel: 220, label: 'Вождь пекла', nbt: NS_NO_ZOMBIFY + ',' + nsName('Вождь пекла') + ',' + nsHandEnch('netherite_axe', { sharpness: 3, fire_aspect: 1 }) + ',Health:220.0f,attributes:[{id:"minecraft:generic.max_health",base:220.0d},{id:"minecraft:generic.scale",base:1.4d}]' },
	},
	8: {
		name: 'Мёртвый легион',
		buff: { resistance: 1 },
		waves: [
			[nsMob('zombie', 22, 'зомби в железе', NS_ARMOR.iron + ',' + nsHand('iron_sword')), nsMob('zombie', 8, 'бегун', NS_RUNNER)],
			[nsMob('skeleton', 18, 'скелет с мощным луком', nsHandEnch('bow', { power: 3 })), nsMob('stray', 10, 'зимогор')],
			[nsMob('husk', 18, 'кадавр в кольчуге', NS_ARMOR.chain), nsMob('drowned', 10, 'утопленник с трезубцем', nsHand('trident'))],
			[nsMob('wither_skeleton', 14, 'визер-скелет с алмазным мечом', nsHand('diamond_sword')), nsMob('zombie', 5, 'громила', NS_BRUTE)],
			[nsMob('phantom', 20, 'фантом')],
			[nsMob('spider', 10, 'тень', NS_SHADOW), nsMob('cave_spider', 14, 'пещерный паук')],
			[nsMob('zombie', 18, 'зомби в алмазе', NS_ARMOR.diamond + ',' + nsHand('diamond_sword')), nsMob('skeleton', 12, 'скелет'), NS_MIMIC],
			[nsMob('stray', 14, 'зимогор'), nsMob('bogged', 10, 'трясинный скелет'), nsMob('husk', 14, 'кадавр')],
			[nsMob('zombie', 6, 'громила', NS_BRUTE), nsMob('wither_skeleton', 12, 'визер-скелет'), nsMob('zombie', 10, 'зомби в алмазе', NS_ARMOR.diamond)],
		],
		boss: { id: 'minecraft:wither_skeleton', hpLabel: 260, label: 'Костяной король', nbt: nsName('Костяной король') + ',' + nsHandEnch('netherite_sword', { sharpness: 4, knockback: 2 }) + ',ArmorItems:[{},{},{},{id:"minecraft:netherite_helmet",count:1}],ArmorDropChances:[0f,0f,0f,0f],Health:260.0f,attributes:[{id:"minecraft:generic.max_health",base:260.0d},{id:"minecraft:generic.scale",base:1.6d}]' },
	},
	9: {
		name: 'Буря',
		waves: [
			[nsMob('breeze', 11, 'вихрь'), nsMob('phantom', 16, 'фантом')],
			[nsMob('pillager', 18, 'разбойник'), nsMob('vindicator', 13, 'поборник'), nsMob('evoker', 3, 'заклинатель')],
			[nsMob('ravager', 5, 'опустошитель'), nsMob('vindicator', 10, 'поборник')],
			[nsMob('witch', 8, 'ведьма'), nsMob('illusioner', 4, 'иллюзионист'), nsMob('vindicator', 10, 'поборник')],
			[nsMob('phantom', 26, 'фантом')],
			[nsMob('breeze', 12, 'вихрь'), nsMob('spider', 10, 'тень', NS_SHADOW)],
			[nsMob('zoglin', 10, 'зоглин'), nsMob('piglin_brute', 8, 'брут пиглинов', NS_NO_ZOMBIFY)],
			[nsMob('evoker', 6, 'заклинатель'), nsMob('vindicator', 18, 'поборник'), NS_MIMIC],
			[nsMob('ravager', 7, 'опустошитель'), nsMob('pillager', 18, 'разбойник')],
			[nsMob('breeze', 15, 'вихрь'), nsMob('phantom', 18, 'фантом'), nsMob('evoker', 4, 'заклинатель')],
		],
		boss: { id: 'minecraft:ravager', hpLabel: 400, label: 'Громовой таран', nbt: nsName('Громовой таран') + ',Health:400.0f,attributes:[{id:"minecraft:generic.max_health",base:400.0d},{id:"minecraft:generic.scale",base:1.4d}]' },
	},
	10: {
		name: 'Великая орда',
		buff: { resistance: 1, strength: 1 },
		waves: NSH[5].waves.concat(NSH[6].waves),
		boss: NSH[6].boss,
	},
}
NSG.NIGHTSHIFT_DIFFICULTY_MAX = 10 // выше — «Кошмар N», бесконечно

// Кошмар k (сложность 10 + k): волны Великой орды + финальная «Свита Кошмара» перед боссом.
// Сила растёт плавно: мобов +10% за уровень, здоровье +12%, урон +8%, скорость +2% (до +20%).
// Добыча: таблица 10-й + 4 броска за уровень и особая таблица Кошмара (только здесь).
var NS_NIGHTMARE_RIDER = nsName('Всадник Кошмара') + ',Health:200.0f,attributes:[{id:"minecraft:generic.max_health",base:200.0d},{id:"minecraft:generic.scale",base:1.3d}],Passengers:[{id:"minecraft:wither_skeleton",Tags:["nightshift_raid"],PersistenceRequired:1b,' + nsHandEnch('netherite_sword', { sharpness: 3 }) + '}]'
NSG.NIGHTSHIFT_NIGHTMARE = {
	finale: [
		nsMob('ravager', 1, 'всадник Кошмара', NS_NIGHTMARE_RIDER),
		nsMob('wither_skeleton', 8, 'рыцарь Кошмара', nsName('Рыцарь Кошмара') + ',' + nsHandEnch('netherite_sword', { sharpness: 2 }) + ',ArmorItems:[{},{},{id:"minecraft:netherite_chestplate",count:1},{id:"minecraft:netherite_helmet",count:1}],ArmorDropChances:[0f,0f,0f,0f]'),
		nsMob('piglin_brute', 6, 'брут пиглинов', NS_NO_ZOMBIFY),
		nsMob('phantom', 10, 'фантом'),
	],
	countPerLevel: 0.1,
	hpPerLevel: 0.12,
	damagePerLevel: 0.08,
	speedPerLevel: 0.02,
	speedMax: 0.2,
	rollsPerLevel: 4,
}

// --------------------------------------------------------------------------
// Добыча за победу — каждому защитнику, который простоял у алтаря хотя бы половину волн.
// Бросков обычной таблицы — по одному за волну и два за босса; у каждого броска шанс rareChance
// на редкую строку. Раз за набег — шанс на артефакт (artifactChance) и на легендарное.
// Баланс — по EMC ProjectE (всё в сборке продаётся за EMC): средний бросок обычной таблицы
// 1,8к на 1-й → 37к на 10-й, редкая строка ≈ ×3; ценность добычи растёт вслед за угрозой орды
// (сумма HP × опасность мобов, ×1,3–1,5 за уровень) с небольшим бонусом за риск.
// Проверка: node tools/raid_balance.js (угроза и EMC по сложностям). Зонды жил стоят 128к–10М EMC,
// поэтому в редких таблицах только дешёвые, как джекпот; дорогие — за первое прохождение, один на команду.
// Строка: [id, количество] или [id с компонентами, количество, id для названия, пояснение].
// --------------------------------------------------------------------------
function nsBook(ench, lvl) {
	return ['minecraft:enchanted_book[minecraft:stored_enchantments={levels:{"minecraft:' + ench + '":' + lvl + '}}]', 1, 'minecraft:enchanted_book', ench + ' ' + lvl]
}
// Незеритовая вещь с чарами: nsGear('netherite_sword', {sharpness:5, mending:1}, 'Острота V, Починка')
function nsGear(item, ench, label) {
	var lv = []
	for (var k in ench) lv.push('"minecraft:' + k + '":' + ench[k])
	return ['minecraft:' + item + '[minecraft:enchantments={levels:{' + lv.join(',') + '}}]', 1, 'minecraft:' + item, label]
}
NSG.NIGHTSHIFT_LOOT = {
	rareChance: 0.14,
	legendaryChance: 0.01,
	artifactChance: { 1: 0.03, 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.16, 6: 0.22, 7: 0.3, 8: 0.38, 9: 0.48, 10: 0.6 },
	common: {
		1: [['minecraft:oak_log', 16], ['minecraft:iron_ingot', 16], ['minecraft:copper_ingot', 16], ['minecraft:coal', 16], ['minecraft:bread', 8]],
		2: [['minecraft:iron_ingot', 16], ['minecraft:copper_ingot', 32], ['create:andesite_alloy', 16], ['minecraft:coal', 32], ['create:zinc_ingot', 8], ['minecraft:oak_log', 32]],
		3: [['minecraft:iron_ingot', 24], ['minecraft:gold_ingot', 4], ['create:zinc_ingot', 16], ['create:brass_ingot', 16], ['minecraft:redstone', 32], ['minecraft:experience_bottle', 16], ['minecraft:lapis_lazuli', 8]],
		4: [['minecraft:iron_ingot', 32], ['minecraft:gold_ingot', 8], ['minecraft:redstone', 32], ['minecraft:lapis_lazuli', 16], ['minecraft:quartz', 16], ['create:brass_ingot', 16]],
		5: [['tfmg:steel_ingot', 6], ['tfmg:lead_ingot', 16], ['tfmg:nickel_ingot', 12], ['minecraft:iron_ingot', 40], ['minecraft:lapis_lazuli', 12], ['minecraft:experience_bottle', 16]],
		6: [['tfmg:steel_ingot', 8], ['minecraft:diamond', 2], ['create_new_age:thorium', 2], ['minecraft:gold_ingot', 8], ['minecraft:emerald', 1], ['minecraft:iron_ingot', 64]],
		7: [['tfmg:steel_ingot', 10], ['minecraft:diamond', 2], ['minecraft:blaze_rod', 12], ['minecraft:netherite_scrap', 1], ['minecraft:ghast_tear', 4], ['minecraft:magma_cream', 24], ['minecraft:gold_ingot', 10]],
		8: [['minecraft:diamond', 3], ['create_new_age:thorium', 4], ['minecraft:netherite_scrap', 2], ['tfmg:steel_ingot', 12], ['minecraft:lapis_lazuli', 28], ['minecraft:gold_ingot', 12]],
		9: [['minecraft:diamond', 4], ['minecraft:netherite_scrap', 2], ['minecraft:breeze_rod', 14], ['minecraft:ender_pearl', 32], ['create_new_age:thorium', 5], ['tfmg:steel_ingot', 16]],
		10: [['minecraft:diamond', 5], ['minecraft:netherite_scrap', 3], ['create_new_age:thorium', 6], ['minecraft:emerald', 2], ['tfmg:steel_ingot', 18], ['minecraft:gold_ingot', 18]],
	},
	rare: {
		1: [['nightshift:sedative', 4], ['minecraft:golden_carrot', 4], ['sophisticatedbackpacks:backpack', 1], ['minecraft:name_tag', 1], ['minecraft:iron_ingot', 16]],
		2: [['minecraft:diamond', 1], ['nightshift:life_tonic', 2], ['sophisticatedbackpacks:iron_backpack', 1], ['minecraft:saddle', 1], ['minecraft:golden_carrot', 8]],
		3: [['minecraft:diamond', 2], ['minecraft:golden_apple', 1], ['create:extendo_grip', 1], ['minecraft:gold_ingot', 8], ['nightshift:life_tonic', 4]],
		4: [['minecraft:diamond', 3], ['sophisticatedbackpacks:gold_backpack', 1], nsBook('unbreaking', 3), ['create:potato_cannon', 1], ['minecraft:golden_apple', 2]],
		5: [['minecraft:diamond', 4], nsBook('mending', 1), ['minecraft:totem_of_undying', 1], ['minecraft:lapis_lazuli', 48], nsBook('protection', 4)],
		6: [['minecraft:diamond', 5], ['minecraft:netherite_ingot', 1], ['sophisticatedbackpacks:diamond_backpack', 1], nsBook('sharpness', 5), nsBook('efficiency', 5), ['nightshift:vein_seed_coal', 1], ['nightshift:vein_seed_copper', 1]],
		7: [['minecraft:netherite_ingot', 1], ['minecraft:totem_of_undying', 1], nsBook('fortune', 3), ['minecraft:trident', 1], ['create:wand_of_symmetry', 1], ['nightshift:vein_seed_zinc', 1], ['nightshift:vein_seed_sulfur', 1]],
		8: [['minecraft:netherite_ingot', 1], ['minecraft:heavy_core', 1], ['minecraft:enchanted_golden_apple', 1], nsBook('looting', 3), ['sophisticatedbackpacks:netherite_backpack', 1], ['nightshift:vein_seed_iron', 1]],
		9: [['minecraft:netherite_ingot', 2], ['minecraft:elytra', 1], ['minecraft:enchanted_golden_apple', 1], nsBook('mending', 1), ['minecraft:totem_of_undying', 2], ['nightshift:vein_seed_quartz', 1]],
		10: [['minecraft:netherite_ingot', 2], ['minecraft:elytra', 1], ['minecraft:nether_star', 1], ['minecraft:enchanted_golden_apple', 2], ['nightshift:night_heart', 1]],
	},
	legendary: [['nightshift:night_heart', 1], ['minecraft:enchanted_golden_apple', 1], ['minecraft:netherite_ingot', 2], ['minecraft:totem_of_undying', 1]],
	// Только в Кошмаре: бросков 1 + уровень/2, строка доступна с уровня minK
	nightmare: [
		{ minK: 1, e: ['minecraft:wither_skeleton_skull', 1] },
		{ minK: 1, e: ['minecraft:ancient_debris', 4] },
		{ minK: 1, e: ['minecraft:heart_of_the_sea', 1] },
		{ minK: 1, e: ['minecraft:netherite_upgrade_smithing_template', 1] },
		{ minK: 1, e: ['minecraft:totem_of_undying', 2] },
		{ minK: 2, e: ['minecraft:silence_armor_trim_smithing_template', 1] },
		{ minK: 3, e: nsGear('netherite_sword', { sharpness: 5, looting: 3, unbreaking: 3, mending: 1 }, 'Острота V, Добыча III, Прочность III, Починка') },
		{ minK: 3, e: nsGear('netherite_chestplate', { protection: 4, unbreaking: 3, mending: 1 }, 'Защита IV, Прочность III, Починка') },
		{ minK: 3, e: nsGear('netherite_pickaxe', { efficiency: 5, fortune: 3, unbreaking: 3, mending: 1 }, 'Эффективность V, Удача III, Прочность III, Починка') },
		{ minK: 3, e: ['minecraft:nether_star', 1] },
		{ minK: 5, e: nsGear('elytra', { unbreaking: 3, mending: 1 }, 'Прочность III, Починка') },
		{ minK: 5, e: nsGear('netherite_helmet', { protection: 4, unbreaking: 3, mending: 1, respiration: 3 }, 'Защита IV, Подводное дыхание III, Починка') },
		{ minK: 5, e: nsGear('netherite_leggings', { protection: 4, unbreaking: 3, mending: 1 }, 'Защита IV, Прочность III, Починка') },
		{ minK: 5, e: nsGear('netherite_boots', { protection: 4, feather_falling: 4, unbreaking: 3, mending: 1 }, 'Защита IV, Невесомость IV, Починка') },
		{ minK: 5, e: ['minecraft:beacon', 1] },
		{ minK: 8, e: ['minecraft:enchanted_golden_apple', 3] },
		{ minK: 8, e: ['nightshift:night_heart', 1] },
	],
	// Артефакты мода Artifacts (надеваются в слоты Curios). top — сильные, для наград первого прохождения
	artifacts: [
		'anglers_hat', 'antidote_vessel', 'aqua_dashers', 'bunny_hoppers', 'charm_of_shrinking', 'charm_of_sinking', 'chorus_totem', 'cloud_in_a_bottle',
		'cowboy_hat', 'cross_necklace', 'crystal_heart', 'digging_claws', 'eternal_steak', 'everlasting_beef', 'feral_claws', 'fire_gauntlet',
		'flame_pendant', 'flippers', 'golden_hook', 'helium_flamingo', 'kitty_slippers', 'lucky_scarf', 'night_vision_goggles', 'novelty_drinking_hat',
		'obsidian_skull', 'onion_ring', 'panic_necklace', 'pickaxe_heater', 'plastic_drinking_hat', 'pocket_piston', 'power_glove', 'rooted_boots',
		'running_shoes', 'scarf_of_invisibility', 'shock_pendant', 'snorkel', 'snowshoes', 'steadfast_spikes', 'strider_shoes', 'superstitious_hat',
		'thorn_pendant', 'umbrella', 'universal_attractor', 'vampiric_glove', 'villager_hat', 'warp_drive', 'whoopee_cushion', 'withered_bracelet',
	],
	artifactsTop: [
		'crystal_heart', 'power_glove', 'vampiric_glove', 'cloud_in_a_bottle', 'running_shoes', 'feral_claws', 'fire_gauntlet', 'universal_attractor',
		'cross_necklace', 'chorus_totem', 'flame_pendant', 'thorn_pendant', 'shock_pendant', 'withered_bracelet', 'eternal_steak', 'obsidian_skull',
		'lucky_scarf', 'steadfast_spikes', 'bunny_hoppers', 'warp_drive',
	],
}

// Первое прохождение сложности: ОДИН зонд жилы на команду (случайному защитнику), с 5-й — сильный
// артефакт каждому, за Великую орду — «Сердце ночи» каждому. В Кошмаре: артефакт каждому за каждый
// новый уровень и «Сердце ночи» каждому за каждый пятый.
NSG.NIGHTSHIFT_FIRST_CLEAR_PROBES = {
	1: ['coal', 'copper'],
	2: ['iron', 'zinc'],
	3: ['quartz', 'redstone', 'sulfur'],
	4: ['gold', 'lapis'],
	5: ['lead', 'nickel'],
	6: ['lithium', 'glowstone'],
	7: ['platinum'],
	8: ['thorium'],
	9: ['diamond'],
	10: ['titanium', 'tungsten', 'martian_iron'],
}

// Искупление проклятия алтаря: стопка ресурса по наибольшей пройденной сложности
// (ПКМ по алтарю или конвейером в алтарь) снимает одно сердце проклятия.
// Пока проклятие не снято, алтарь не начинает новый набег.
function nsTributeFor(best) {
	if (best <= 1) return { item: '#minecraft:logs', count: 64, label: 'брёвен' }
	if (best <= 3) return { item: 'create:andesite_alloy', count: 64, label: 'андезитового сплава' }
	if (best <= 5) return { item: 'create:brass_ingot', count: 64, label: 'латунных слитков' }
	if (best <= 7) return { item: 'tfmg:steel_ingot', count: 64, label: 'стальных слитков' }
	return { item: 'create_new_age:thorium', count: 32, label: 'тория' }
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
	'minecraft:bogged': 16,
	'minecraft:breeze': 30,
	'minecraft:zoglin': 40,
	'minecraft:illusioner': 32,
	'minecraft:slime': 16,
	'minecraft:pillager': 24,
	'minecraft:ravager': 100,
	'minecraft:phantom': 20,
	'minecraft:piglin': 16,
	'minecraft:wither_skeleton': 20,
	'minecraft:blaze': 20,
	'minecraft:wither': 300,
	'minecraft:piglin_brute': 50,
	'minecraft:hoglin': 40,
	'minecraft:magma_cube': 16,
	'artifacts:mimic': 60,
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
	// Штрафы (в сердцах максимального здоровья). Проклятие алтаря — у всей команды,
	// раны от смертей — у каждого свои; вместе не больше penaltyMaxHearts (минимум 3 сердца остаётся).
	curseHeartsMinor: 2, // прорыв к алтарю в малом набеге
	curseMaxHearts: 5,
	woundMax: 5, // −1 сердце за смерть, до 5
	penaltyMaxHearts: 7,
	bonusHeartsMax: 5, // «Сердце ночи»: +1 сердце максимума навсегда, до 5
	darknessDeathSanityBump: 0.15, // убила тьма — при возрождении +15% рассудка, чтобы не умирать по кругу
}
