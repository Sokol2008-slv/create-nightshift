// ==========================================================================
// Ночная смена — боссы L_Ender's Cataclysm (3.33) для поздних волн 70–100 и «Бесконечности».
// Данные и функция выбора; набег берёт их в nsChallengeHorde (40_nightshift_raid.js) с 70-й волны.
// Проверено 30.09 на витрине (70-я волна, Кобольдиатор). Файл безопасен и без мода: классы мода
// не загружаются, id — просто строки.
//
// Разбор мода и обоснование ротации — docs/research/cataclysm.md.
//
// Важно про NBT. Набег спавнит через /summon с NBT, а /summon с NBT НЕ вызывает finalizeSpawn —
// поэтому флаги «пробуждения» кладём явно, иначе босс спит/неуязвим/стоит на месте:
//   Кобольдиатор, Уаджет — Awaken:1b (спящий неуязвим);
//   Древний реликт — has_necklace:1b (без ожерелья спит и неуязвим);
//   Незеритовое чудовище — is_Awaken:1b (иначе стоит «глыбой», пока не увидит цель ближе 16 бл.);
//   Предвестник — Is_Act:1b (иначе выключен, включается только незерзвездой в руке игрока);
//   Сцилла — Act:1b.
// HomePos не задаём: тогда боссы не телепортируются «домой» и не ставят блоки
// (надгробие/возрождатель) на месте смерти.
//
// У боссов мода свои ограничители урона (конфиг cataclysm-common.toml, cap_config):
// damageCap — максимум урона за удар, dpsCap — урон в секунду, rangeCap — урон от атакующего
// дальше rangeCap снижается, дальше ×1,5 — ноль. Поэтому HP боссов Cataclysm не раздуваем
// общим scale.hp Кошмара: время убийства ≥ HP / dpsCap. Потолок — hpScaleMax ниже.
// ==========================================================================

// Флаги пробуждения (см. шапку)
var NS_CM_AWAKE = 'Awaken:1b'

// Список боссов. Поля:
//   from — с какой волны может выпасть; to — до какой (не задано = без конца);
//   id, label, hpLabel (базовое HP мода, для прогноза), nbt — как у boss в 00_nightshift_config.js;
//   tier — 'mini' (без боссбара мода, для пар и «свиты») или 'major' (свой боссбар и музыка);
//   max — сколько одновременно не больше (на 2–3 игроков);
//   flying — летает (щит-купол и зенитные турели, наземные ловушки не помогут);
//   caps — [damageCap, dpsCap, rangeCap] по умолчанию мода (для справки, у мини — нет капов).
NSG.NS_CATACLYSM_BOSSES = [
	// --- 70–79: мини-боссы, 150–225 HP, по одному-два ---
	{ from: 70, to: 84, id: 'cataclysm:kobolediator', label: 'Кобольдиатор', hpLabel: 180, nbt: NS_CM_AWAKE, tier: 'mini', max: 2 },
	{ from: 70, to: 84, id: 'cataclysm:amethyst_crab', label: 'Аметистовый краб', hpLabel: 200, nbt: '', tier: 'mini', max: 2 },
	{ from: 72, to: 86, id: 'cataclysm:wadjet', label: 'Уаджет', hpLabel: 150, nbt: NS_CM_AWAKE, tier: 'mini', max: 2 },
	{ from: 74, to: 88, id: 'cataclysm:the_prowler', label: 'Рыскун', hpLabel: 160, nbt: '', tier: 'mini', max: 2 },
	{ from: 75, to: 89, id: 'cataclysm:aptrgangr', label: 'Аптргангр', hpLabel: 160, nbt: '', tier: 'mini', max: 2 },
	{ from: 76, to: 90, id: 'cataclysm:ender_golem', label: 'Голем Края', hpLabel: 150, nbt: '', tier: 'mini', max: 3 },
	{ from: 78, to: 92, id: 'cataclysm:clawdian', label: 'Клаудиан', hpLabel: 225, nbt: '', tier: 'mini', max: 2 },

	// --- 80+: настоящие боссы, по одному (с 95-й — до двух) ---
	{ from: 80, id: 'cataclysm:ender_guardian', label: 'Страж Края', hpLabel: 333, nbt: '', tier: 'major', max: 2, caps: [22, 13, 12] },
	{ from: 82, id: 'cataclysm:ignis', label: 'Игнис', hpLabel: 450, nbt: '', tier: 'major', max: 2, caps: [20, 14, 15] },
	{ from: 85, id: 'cataclysm:maledictus', label: 'Маледиктус', hpLabel: 420, nbt: '', tier: 'major', max: 2, flying: true, caps: [20, 13, 14] },
	{ from: 87, id: 'cataclysm:the_harbinger', label: 'Предвестник', hpLabel: 390, nbt: 'Is_Act:1b', tier: 'major', max: 1, flying: true, caps: [22, 14, 35] },
	{ from: 90, id: 'cataclysm:ancient_remnant', label: 'Древний реликт', hpLabel: 450, nbt: 'has_necklace:1b', tier: 'major', max: 1, caps: [21, 14, 14] },
	{ from: 92, id: 'cataclysm:netherite_monstrosity', label: 'Незеритовое чудовище', hpLabel: 600, nbt: 'is_Awaken:1b', tier: 'major', max: 1, caps: [25, 20, 18] },
	{ from: 95, id: 'cataclysm:scylla', label: 'Сцилла', hpLabel: 390, nbt: 'Act:1b', tier: 'major', max: 1, caps: [21, 13, 12] },
	// Левиафан (cataclysm:the_leviathan) НЕ берём: вне воды неуязвим (immune_out_of_water),
	// на суше беспомощен — набег не закончится.
]

// Фиксированные волны-«вехи»: пара разных боссов. Текущий код набега спавнит bossCount боссов
// ОДНОГО вида — второй (extra) понадобится поддержать в nsSpawnCurrentWave при подключении.
// Подволны из обычных мобов Cataclysm для волн 70+ (Георгий, 30.09: «70-е волны — уже с модовыми монстрами»).
// Здоровье / урон / броня — из атрибутов мода 3.33: драугр 28/4/3, элитный 32/5/3, королевский 30/5/5, кобoletон 25/3,
// пылающий берсерк 65/7,5/8, пылающий ревенант 80/6/12, глубинник 26/4, громила-глубинник 60/5/8, жрец и
// чернокнижник глубин 45/4, эндермаптера 16/4/6, коралловый голем 110/11/5, аптргангр 160/18/10.
// Числа — на одного игрока, дальше их умножают плотность и Кошмар (40_nightshift_raid.js, nsChallengeHorde).
function nsCmMob(id, count, label, nbt) {
	return { id: 'cataclysm:' + id, count: count, label: label, nbt: nbt || '' }
}
NSG.NS_CATACLYSM_WAVES = [
	[nsCmMob('draugr', 16, 'драугр'), nsCmMob('elite_draugr', 8, 'элитный драугр'), nsCmMob('royal_draugr', 4, 'королевский драугр')],
	[nsCmMob('ignited_berserker', 8, 'пылающий берсерк'), nsCmMob('ignited_revenant', 5, 'пылающий ревенант'), nsCmMob('koboleton', 14, 'кобoletон')],
	[nsCmMob('deepling_brute', 8, 'громила-глубинник'), nsCmMob('deepling', 12, 'глубинник'), nsCmMob('deepling_priest', 3, 'жрец глубин'), nsCmMob('deepling_warlock', 3, 'чернокнижник глубин')],
	[nsCmMob('coral_golem', 3, 'коралловый голем'), nsCmMob('aptrgangr', 1, 'аптргангр'), nsCmMob('endermaptera', 16, 'эндермаптера')],
]

NSG.NS_CATACLYSM_FIXED = {
	80: { boss: 'cataclysm:ender_guardian', count: 1, extra: ['cataclysm:ender_golem', 2] },
	90: { boss: 'cataclysm:ancient_remnant', count: 1, extra: ['cataclysm:wadjet', 2] },
	100: { boss: 'cataclysm:netherite_monstrosity', count: 1, extra: ['cataclysm:ignis', 1] }, // финал: «Кузница»
}

// Потолок роста HP боссов Cataclysm от Кошмара (доля к базе): +100% — время убийства
// Незеритового чудовища ≥ 1200 / 20 = 60 с даже при бесконечном уроне обороны.
NSG.NS_CATACLYSM_HP_SCALE_MAX = 1.0

function nsCmFind(id) {
	var L = NSG.NS_CATACLYSM_BOSSES
	for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]
	return null
}

// Сколько боссов выбранного вида на волне d: мини — 1 до 79-й, 2 с 80-й (3 для голема с 90-й);
// major — 1, с 95-й 2 (если max позволяет), в Бесконечности +1 за каждые 15 волн, но не больше max.
function nsCmCount(e, d) {
	var n
	if (e.tier === 'mini') n = d >= 90 ? 3 : d >= 80 ? 2 : 1
	else n = (d >= 95 ? 2 : 1) + (d > NSG.NS_WAVES_MAX ? Math.floor((d - NSG.NS_WAVES_MAX) / 15) : 0)
	return Math.max(1, Math.min(e.max || 1, n))
}

// Кандидаты волны d: доступные по from/to; на волнах, кратных 5, — только major (если есть)
function nsCmList(d) {
	var L = NSG.NS_CATACLYSM_BOSSES
	var pool = []
	var majors = []
	for (var i = 0; i < L.length; i++) {
		var e = L[i]
		if (e.from > d) continue
		if (e.to && e.to < d) continue
		pool.push(e)
		if (e.tier === 'major') majors.push(e)
	}
	return d % 5 === 0 && majors.length > 0 ? majors : pool
}

// Вид по кругу списка кандидатов; совпал с видом прошлой волны — берём следующий.
// Считаем цепочку с 70-й волны (дёшево: сотня шагов), чтобы проверка шла по реальному прошлому виду.
function nsCmPick(d) {
	var prevId = null
	var pick = null
	for (var w = NSG.NS_WAVE_BOSS_FROM; w <= d; w++) {
		var list = nsCmList(w)
		if (list.length === 0) {
			pick = null
			continue
		}
		var k = (w - NSG.NS_WAVE_BOSS_FROM) % list.length
		if (list.length > 1 && list[k].id === prevId) k = (k + 1) % list.length
		pick = list[k]
		var fx = NSG.NS_CATACLYSM_FIXED[w]
		prevId = fx ? fx.boss : pick.id
	}
	return pick
}

// Босс волны d (>= 70) из пула Cataclysm. Возвращает
//   { boss: {id, label, hpLabel, nbt}, bossCount, extra: [{boss, count}], hpScaleMax }
// или null до 70-й. Выбор детерминированный (по номеру волны), чтобы прогноз у алтаря совпадал
// с тем, что придёт. На волнах-вехах (NS_CATACLYSM_FIXED) — заданная пара.
NSG.nsCataclysmBossForWave = function (d) {
	if (d < NSG.NS_WAVE_BOSS_FROM) return null
	var picked = null
	var count = 1
	var extra = []
	var fx = NSG.NS_CATACLYSM_FIXED[d]
	if (fx) {
		picked = nsCmFind(fx.boss)
		count = fx.count
		var ex = fx.extra ? nsCmFind(fx.extra[0]) : null
		if (ex) extra.push({ boss: { id: ex.id, label: ex.label, hpLabel: ex.hpLabel, nbt: ex.nbt }, count: fx.extra[1] })
	} else {
		picked = nsCmPick(d)
		if (picked) count = nsCmCount(picked, d)
	}
	if (!picked) return null
	return {
		boss: { id: picked.id, label: picked.label, hpLabel: picked.hpLabel, nbt: picked.nbt },
		bossCount: count,
		extra: extra,
		hpScaleMax: NSG.NS_CATACLYSM_HP_SCALE_MAX,
	}
}
