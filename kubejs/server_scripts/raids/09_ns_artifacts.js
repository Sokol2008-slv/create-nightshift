// ==========================================================================
// Ночная смена — артефакты смены (01.10.2026, Георгий: «урон мобов не режем, делаем нас плотнее»;
// «хоть 4 ряда сердец»; «гриндить волны ради крутого артефакта — чем выше волна, тем выше шанс»).
//
// 19 артефактов, 7 уровней: обычный, редкий, сверхредкий, эпический, легендарный, мифический, божественный.
// Надеваются в свой слот Curios «Реликвия» (4 слота — это и есть билд). Слот, тег и предметы — датапаком и
// стартовым скриптом (tools/gen_ns_artifacts.py), интеграции KubeJS↔Curios в паке нет: эффекты считаем здесь.
//  - раз в секунду (и сразу после смены надетого — CurioChangeEvent) смотрим слоты «Реликвия» через Java-API
//    Curios и ставим постоянные модификаторы атрибутов с id nightshift:relic_<стат> (здоровье, броня, прочность
//    брони, отбрасывание, скорость, урон, тики неуязвимости мода Artifacts). Чужие модификаторы
//    (nightshift:penalty — проклятие, раны, «Сердца ночи») не трогаем. Постоянные — чтобы при входе в игру
//    здоровье сверх 20 не обрезалось до загрузки скрипта;
//  - срез входящего урона и «щит» мифического (1 с полной неуязвимости после удара, потом перезарядка) —
//    LivingIncomingDamageEvent; второе дыхание (смертельный удар оставляет 1 HP) — LivingDamageEvent$Pre;
//    вампиризм, отражение, «был в бою» — LivingDamageEvent$Post;
//  - одинаковые не складываются: второй такой же в слот не встанет (CurioCanEquipEvent), а эффекты считаются
//    по уникальным id. Неуязвимость после удара и второе дыхание не суммируются — работает лучший.
// Добыча: NSG.nsNsArtifactRoll(d, first) и NSG.nsNsArtifactHoverText(d) — вызывает набег (40_nightshift_raid.js,
// алтарь), сами функции здесь. Справка — глава квест-бука «Артефакты смены» (tools/quests/spec_artifacts.json).
// Проверка в игре: /nsart — что даёт надетое; /nsart odds <волна> — шансы; /nsart roll <волна> — 1000 бросков (оп).
//
// ВАЖНО (30.09): исключение внутри нативного обработчика роняет сервер — тело КАЖДОГО обработчика в try/catch.
// У DamageSource в KubeJS 2101 нет надёжного getEntity — атакующего берём перебором имён методов.
// Правило Rhino: только var.
// ==========================================================================

// <ДАННЫЕ> — генерирует tools/gen_ns_artifacts.py, руками не править (правка таблицы там и перезапуск)
var NS_ART = {
	"slot": "relic",
	"slots": 4,
	"tiers": [{"key": "common", "name": "обычный", "from": 1}, {"key": "rare", "name": "редкий", "from": 1}, {"key": "superrare", "name": "сверхредкий", "from": 8}, {"key": "epic", "name": "эпический", "from": 15}, {"key": "legendary", "name": "легендарный", "from": 27}, {"key": "mythic", "name": "мифический", "from": 43}, {"key": "divine", "name": "божественный", "from": 90}],
	"items": {
		"nightshift:art_patch": {"tier": 0, "name": "Заплатка вахтовика", "hp": 4},
		"nightshift:art_badge": {"tier": 0, "name": "Жетон смены", "armor": 1, "speed": 0.05},
		"nightshift:art_thermos": {"tier": 0, "name": "Термос бригадира", "regen": 0.5},
		"nightshift:art_buckle": {"tier": 1, "name": "Стальная пряжка", "hp": 6, "kb": 0.1},
		"nightshift:art_qc_stripe": {"tier": 1, "name": "Нашивка ОТК", "dr": 0.05},
		"nightshift:art_watch_charm": {"tier": 1, "name": "Оберег сторожа", "iframes": 6, "armor": 1},
		"nightshift:art_fang": {"tier": 2, "name": "Клык кровососа", "life": 0.05, "lifeCap": 2, "dmg": 1},
		"nightshift:art_pauldron": {"tier": 2, "name": "Наплечник из сплава", "armor": 4, "tough": 2},
		"nightshift:art_collar": {"tier": 2, "name": "Шипастый ошейник", "thorns": 0.25, "armor": 1},
		"nightshift:art_stone_heart": {"tier": 3, "name": "Каменное сердце", "hp": 8, "kb": 0.25, "speed": -0.05},
		"nightshift:art_rosary": {"tier": 3, "name": "Чётки дозорного", "iframes": 12, "dr": 0.05},
		"nightshift:art_butcher_glove": {"tier": 3, "name": "Перчатка мясника", "life": 0.1, "lifeCap": 3, "dmg": 2},
		"nightshift:art_titan_blood": {"tier": 4, "name": "Кровь титана", "hp": 12, "regen": 0.5},
		"nightshift:art_visor": {"tier": 4, "name": "Щиток бригадира", "dr": 0.12, "armor": 3, "kb": 0.2},
		"nightshift:art_second_wind": {"tier": 4, "name": "Жетон второго дыхания", "hp": 4, "wind": {"cd": 6000, "after": 40}},
		"nightshift:art_hourglass": {"tier": 5, "name": "Песочные часы смены", "shield": {"dur": 20, "cd": 120}, "armor": 2},
		"nightshift:art_horde_heart": {"tier": 5, "name": "Сердце орды", "hp": 14, "life": 0.06, "lifeCap": 3, "regen": 0.5},
		"nightshift:art_vakhta_heart": {"tier": 6, "name": "Сердце Вахты", "hp": 18, "armor": 4, "dr": 0.1, "regen": 1.0},
		"nightshift:art_halo": {"tier": 6, "name": "Нимб бессменного", "shield": {"dur": 20, "cd": 80}, "wind": {"cd": 2400, "after": 60}, "life": 0.1, "lifeCap": 4}
	},
	"byTier": [["nightshift:art_patch", "nightshift:art_badge", "nightshift:art_thermos"], ["nightshift:art_buckle", "nightshift:art_qc_stripe", "nightshift:art_watch_charm"], ["nightshift:art_fang", "nightshift:art_pauldron", "nightshift:art_collar"], ["nightshift:art_stone_heart", "nightshift:art_rosary", "nightshift:art_butcher_glove"], ["nightshift:art_titan_blood", "nightshift:art_visor", "nightshift:art_second_wind"], ["nightshift:art_hourglass", "nightshift:art_horde_heart"], ["nightshift:art_vakhta_heart", "nightshift:art_halo"]],
	"chance": {"from": 0.08, "to": 0.6, "toWave": 100, "infPerWave": 0.0125, "infMax": 0.85, "firstMult": 1.5, "firstMax": 0.95, "firstSureEvery": 10},
	"weights": [
		[1, [78, 22, 0, 0, 0, 0, 0]],
		[8, [66, 28, 6, 0, 0, 0, 0]],
		[15, [55, 30, 12, 3, 0, 0, 0]],
		[27, [40, 30, 19, 9, 2, 0, 0]],
		[43, [28, 27, 23, 13, 7, 2, 0]],
		[60, [18, 22, 25, 18, 11, 6, 0]],
		[80, [10, 16, 23, 23, 16, 12, 0]],
		[90, [8, 14, 22, 24, 17, 14, 1]],
		[100, [6, 12, 20, 24, 19, 16, 3]],
		[120, [4, 10, 18, 24, 21, 17, 6]]
	],
	"caps": {"dr": 0.35, "life": 0.2, "lifeCap": 5, "regen": 2, "thorns": 0.5},
	"combatTicks": 100,
	"attrs": [["hp", "minecraft:generic.max_health", "ADD_VALUE"], ["armor", "minecraft:generic.armor", "ADD_VALUE"], ["tough", "minecraft:generic.armor_toughness", "ADD_VALUE"], ["kb", "minecraft:generic.knockback_resistance", "ADD_VALUE"], ["speed", "minecraft:generic.movement_speed", "ADD_MULTIPLIED_BASE"], ["dmg", "minecraft:generic.attack_damage", "ADD_VALUE"], ["iframes", "artifacts:generic.invincibility_ticks", "ADD_VALUE"]]
}
// </ДАННЫЕ>

function nsArtClass(name) {
	try {
		return Java.loadClass(name)
	} catch (e) {
		console.warn('[nightshift] артефакты смены: класс ' + name + ' недоступен: ' + e)
		return null
	}
}
var NS_ART_CURIOS = nsArtClass('top.theillusivec4.curios.api.CuriosApi')
var NS_ART_EV_IN = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
var NS_ART_EV_PRE = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingDamageEvent$Pre')
var NS_ART_EV_POST = nsArtClass('net.neoforged.neoforge.event.entity.living.LivingDamageEvent$Post')
var NS_ART_EV_EQUIP = nsArtClass('top.theillusivec4.curios.api.event.CurioCanEquipEvent')
var NS_ART_EV_CHANGE = nsArtClass('top.theillusivec4.curios.api.event.CurioChangeEvent')
var NS_ART_TRI = nsArtClass('net.neoforged.neoforge.common.util.TriState')
var NS_ART_REG = nsArtClass('net.minecraft.core.registries.BuiltInRegistries')
var NS_ART_RL = nsArtClass('net.minecraft.resources.ResourceLocation')
var NS_ART_MOD = nsArtClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
var NS_ART_OP = nsArtClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
var NS_ART_DTT = nsArtClass('net.minecraft.tags.DamageTypeTags')

var NS_ART_P = {} // uuid → сумма эффектов надетого (null — ничего не надето)
var NS_ART_M = {} // uuid → {hurt, shieldUntil, shieldReady, fill, windTold} — память боя
var NS_ART_DIRTY = {} // uuid → пересчитать на ближайшем тике (сменили надетое, возродился, вошёл)
var NS_ART_ANY = 0 // сколько игроков онлайн с артефактами — быстрый выход из обработчиков урона
var NS_ART_LIFE = 0 // у скольких есть вампиризм — иначе урон по мобам (турели!) не разбираем вовсе
var NS_ART_HOLDERS = {} // id атрибута → Holder (или false, если атрибута нет)

// --------------------------------------------------------------------------
// Шансы выпадения (числа — в блоке данных: NS_ART.chance, NS_ART.weights)
// --------------------------------------------------------------------------

// Шанс получить артефакт смены за победу на волне d (выше 100 — Бесконечность). first — первое прохождение:
// шанс ×firstMult, каждая firstSureEvery-я волна в первый раз — наверняка.
function nsArtChance(d, first) {
	var C = NS_ART.chance
	d = Math.max(1, Number(d) || 1)
	var p = d <= C.toWave ? C.from + ((C.to - C.from) * (d - 1)) / (C.toWave - 1) : Math.min(C.infMax, C.to + C.infPerWave * (d - C.toWave))
	if (first) p = d % C.firstSureEvery === 0 ? 1 : Math.min(C.firstMax, p * C.firstMult)
	return p
}

// Распределение по уровням на волне d: 7 чисел в процентах (сумма 100). Между опорными волнами — линейно,
// уровень до своей волны (tiers[t].from) — 0.
function nsArtWeights(d) {
	var W = NS_ART.weights
	d = Math.max(1, Number(d) || 1)
	var row = W[W.length - 1][1].slice()
	if (d <= W[0][0]) row = W[0][1].slice()
	else {
		for (var i = 0; i + 1 < W.length; i++) {
			if (d >= W[i][0] && d <= W[i + 1][0]) {
				var f = (d - W[i][0]) / (W[i + 1][0] - W[i][0])
				row = []
				for (var t = 0; t < W[i][1].length; t++) row.push(W[i][1][t] + (W[i + 1][1][t] - W[i][1][t]) * f)
				break
			}
		}
	}
	var sum = 0
	for (var k = 0; k < row.length; k++) {
		if (d < NS_ART.tiers[k].from) row[k] = 0
		sum += row[k]
	}
	for (var j = 0; j < row.length; j++) row[j] = sum > 0 ? (row[j] * 100) / sum : 0
	return row
}

// Бросок уровня по весам; страховка от погрешности — последний уровень с ненулевым весом
function nsArtPickTier(w) {
	var r = Math.random() * 100
	var last = 0
	for (var t = 0; t < w.length; t++) {
		if (w[t] <= 0) continue
		last = t
		if (r < w[t]) return t
		r -= w[t]
	}
	return last
}

// Добыча набега — для КАЖДОГО защитника отдельно: [] или [[id, 1, id, 'мифический артефакт смены']]
// (формат строк nsGiveLoot). d — номер волны (выше 100 — Бесконечность), first — первое прохождение.
NSG.nsNsArtifactRoll = function (d, first) {
	var out = []
	try {
		if (Math.random() >= nsArtChance(d, first)) return out
		var t = nsArtPickTier(nsArtWeights(d))
		var pool = NS_ART.byTier[t]
		var id = pool[Math.floor(Math.random() * pool.length)]
		out.push([id, 1, id, NS_ART.tiers[t].name + ' артефакт смены'])
	} catch (e) {
		console.warn('[nightshift] артефакт смены: бросок не удался: ' + e)
	}
	return out
}

function nsArtPct(x) {
	if (x > 0 && x < 1) return '<1'
	return String(Math.round(x))
}

// Подсказка у алтаря: «Артефакт смены: 34 % — обычный 24 %, редкий 26 %, …» (first — с учётом первого прохождения)
NSG.nsNsArtifactHoverText = function (d, first) {
	try {
		var w = nsArtWeights(d)
		var parts = []
		for (var t = 0; t < w.length; t++) if (w[t] > 0) parts.push(NS_ART.tiers[t].name + ' ' + nsArtPct(w[t]) + ' %')
		var p = nsArtChance(d, false)
		var head = 'Артефакт смены: ' + nsArtPct(p * 100) + ' %'
		if (first) head += ' (первое прохождение — ' + nsArtPct(nsArtChance(d, true) * 100) + ' %)'
		return head + ' — ' + parts.join(', ')
	} catch (e) {
		return 'Артефакт смены: шанс растёт с волной'
	}
}

// Это артефакт смены? (для подсветки в сводке добычи) и его уровень 0–6 (-1 — нет)
NSG.nsNsArtifactIs = function (id) {
	return !!NS_ART.items[String(id)]
}
NSG.nsNsArtifactTier = function (id) {
	var e = NS_ART.items[String(id)]
	return e ? e.tier : -1
}
NSG.nsNsArtifactWeights = nsArtWeights
NSG.nsNsArtifactChance = nsArtChance

// --------------------------------------------------------------------------
// Что надето и сколько это даёт
// --------------------------------------------------------------------------

function nsArtItemId(stack) {
	try {
		if (stack == null || stack.isEmpty()) return ''
		return String(NS_ART_REG.ITEM.getKey(stack.getItem()))
	} catch (e) {
		return ''
	}
}

// Ячейки слота «Реликвия» игрока (IDynamicStackHandler) или null
function nsArtRelicStacks(entity) {
	if (!NS_ART_CURIOS || entity == null) return null
	var inv = NS_ART_CURIOS.getCuriosInventory(entity).orElse(null)
	if (inv == null) return null
	var h = inv.getStacksHandler(NS_ART.slot).orElse(null)
	return h == null ? null : h.getStacks()
}

// Уникальные id надетых артефактов смены
function nsArtWorn(player) {
	var out = []
	var st = nsArtRelicStacks(player)
	if (st == null) return out
	var seen = {}
	for (var i = 0; i < st.getSlots(); i++) {
		var id = nsArtItemId(st.getStackInSlot(i))
		if (id && NS_ART.items[id] && !seen[id]) {
			seen[id] = true
			out.push(id)
		}
	}
	return out
}

// Сумма эффектов с потолками NS_ART.caps; щит и второе дыхание — лучший из надетых
function nsArtSum(ids) {
	var a = { ids: ids, hp: 0, armor: 0, tough: 0, kb: 0, speed: 0, dmg: 0, iframes: 0, dr: 0, life: 0, lifeCap: 0, regen: 0, thorns: 0, shield: null, wind: null }
	var sums = ['hp', 'armor', 'tough', 'kb', 'speed', 'dmg', 'iframes', 'dr', 'life', 'lifeCap', 'regen', 'thorns']
	for (var i = 0; i < ids.length; i++) {
		var e = NS_ART.items[ids[i]]
		for (var k = 0; k < sums.length; k++) if (e[sums[k]]) a[sums[k]] += e[sums[k]]
		if (e.shield && (!a.shield || e.shield.cd < a.shield.cd)) a.shield = e.shield
		if (e.wind && (!a.wind || e.wind.cd < a.wind.cd)) a.wind = e.wind
	}
	var C = NS_ART.caps
	a.dr = Math.min(C.dr, a.dr)
	a.life = Math.min(C.life, a.life)
	a.lifeCap = Math.min(C.lifeCap, a.lifeCap)
	a.regen = Math.min(C.regen, a.regen)
	a.thorns = Math.min(C.thorns, a.thorns)
	a.kb = Math.min(1, a.kb)
	return a
}

function nsArtHolder(attrId) {
	if (NS_ART_HOLDERS[attrId] !== undefined) return NS_ART_HOLDERS[attrId]
	var h = false
	try {
		var o = NS_ART_REG.ATTRIBUTE.getHolder(NS_ART_RL.parse(attrId))
		if (o.isPresent()) h = o.get()
	} catch (e) {}
	if (!h) console.warn('[nightshift] артефакты смены: атрибута ' + attrId + ' нет — этот эффект пропускается')
	NS_ART_HOLDERS[attrId] = h
	return h
}

// Модификаторы атрибутов nightshift:relic_<стат>: меняем только то, что разошлось с надетым
function nsArtApplyAttrs(player, a) {
	for (var i = 0; i < NS_ART.attrs.length; i++) {
		var key = NS_ART.attrs[i][0]
		var h = nsArtHolder(NS_ART.attrs[i][1])
		if (!h) continue
		var inst = player.getAttribute(h)
		if (inst == null) continue
		var rl = NS_ART_RL.parse('nightshift:relic_' + key)
		var want = a ? a[key] || 0 : 0
		var cur = inst.getModifier(rl)
		var have = cur == null ? 0 : Number(cur.amount())
		if (cur != null && Math.abs(have - want) < 1e-6) continue
		if (cur == null && want === 0) continue
		// AttributeInstance.removeModifier в Rhino неоднозначен (обе перегрузки, проверено 01.10) — снимаем методом
		// KubeJS removeAttribute(атрибут, id), ставим addOrReplacePermanentModifier
		if (want === 0) player.removeAttribute(h, rl)
		else inst.addOrReplacePermanentModifier(new NS_ART_MOD(rl, want, NS_ART_OP[NS_ART.attrs[i][2]]))
	}
}

// KubeJS 2101 переименовывает для JS часть методов Mojang (RemapForJS, проверено javap 01.10):
// getStringUUID → getStringUuid, Level.getGameTime → getTime, DamageSource.getMsgId → getType,
// getEntity → getActual, getDirectEntity → getImmediate. Поэтому — перебор имён (nsArtCall).
function nsArtUuid(e) {
	try {
		if (e == null || !e.isPlayer()) return null
		var u = nsArtCall(e, ['getStringUuid', 'getStringUUID'])
		return u == null ? null : String(u)
	} catch (x) {
		return null
	}
}

function nsArtMem(u) {
	if (!NS_ART_M[u]) NS_ART_M[u] = { hurt: -1e9, shieldUntil: 0, shieldReady: 0, fill: false, windTold: true }
	return NS_ART_M[u]
}

// Игровое время мира (общее для измерений, переживает рестарт) — для перезарядок
// (у сущности в JS level — свойство, а не метод; берём getLevel)
function nsArtNow(e) {
	var lvl = e != null ? nsArtCall(e, ['getLevel']) : null
	if (lvl == null) lvl = NSG.nsServer.overworld()
	return Number(nsArtCall(lvl, ['getTime', 'getGameTime']))
}

function nsArtRun(cmd) {
	try {
		NSG.nsServer.runCommandSilent(cmd)
	} catch (e) {}
}

// Пересчёт игрока: надетое → модификаторы; раз в секунду (second) — лечение вне боя и «второе дыхание готово»
function nsArtRefresh(player, u, second) {
	var ids = nsArtWorn(player)
	var a = ids.length ? nsArtSum(ids) : null
	NS_ART_P[u] = a
	nsArtApplyAttrs(player, a)
	var m = nsArtMem(u)
	if (m.fill) {
		// после возрождения здоровье — полное по новому максимуму (иначе +50 HP артефактов пришлось бы отращивать)
		m.fill = false
		if (!player.isDeadOrDying()) player.setHealth(player.getMaxHealth())
	}
	if (!second || !a) return
	var now = nsArtNow(player)
	if (a.regen > 0 && now - m.hurt >= NS_ART.combatTicks && !player.isDeadOrDying() && player.getHealth() < player.getMaxHealth()) player.heal(a.regen)
	if (a.wind && !m.windTold) {
		var pd = player.persistentData
		if (!pd.contains('ns_art_wind') || now >= Number(pd.getLong('ns_art_wind'))) {
			m.windTold = true
			player.tell(Text.gold('[Ночная смена] Второе дыхание снова готово.'))
		}
	}
}

ServerEvents.tick(event => {
	var server = event.server
	var second = server.getTickCount() % 20 === 0
	var dirty = false
	for (var k in NS_ART_DIRTY) {
		dirty = true
		break
	}
	if (!second && !dirty) return
	try {
		var players = server.getPlayers()
		var any = 0
		var life = 0
		for (var i = 0; i < players.length; i++) {
			var p = players[i]
			var u = nsArtUuid(p)
			if (!u) continue
			try {
				if (second || NS_ART_DIRTY[u]) nsArtRefresh(p, u, second)
			} catch (e) {
				console.warn('[nightshift] артефакты смены: пересчёт ' + p.getUsername() + ': ' + e)
			}
			if (NS_ART_P[u]) any++
			if (NS_ART_P[u] && NS_ART_P[u].life > 0) life++
		}
		NS_ART_ANY = any
		NS_ART_LIFE = life
	} catch (e) {
		console.warn('[nightshift] артефакты смены: тик: ' + e)
	}
	NS_ART_DIRTY = {}
})

PlayerEvents.loggedIn(event => {
	var u = nsArtUuid(event.getPlayer())
	if (u) NS_ART_DIRTY[u] = true
})

PlayerEvents.respawned(event => {
	var u = nsArtUuid(event.getPlayer())
	if (!u) return
	nsArtMem(u).fill = true
	NS_ART_DIRTY[u] = true
})

PlayerEvents.loggedOut(event => {
	var u = nsArtUuid(event.getPlayer())
	if (!u) return
	delete NS_ART_P[u]
	delete NS_ART_M[u]
})

// --------------------------------------------------------------------------
// Бой
// --------------------------------------------------------------------------

// Урон, который нельзя отменять: падение в пустоту, /kill
function nsArtBypass(src) {
	try {
		if (NS_ART_DTT && src.is(NS_ART_DTT.BYPASSES_INVULNERABILITY)) return true
	} catch (x) {}
	try {
		var id = nsArtMsgId(src)
		return id === 'outOfWorld' || id === 'genericKill'
	} catch (x) {
		return false
	}
}

function nsArtCall(o, names) {
	for (var i = 0; i < names.length; i++) {
		try {
			var f = o[names[i]]
			if (typeof f !== 'function') continue
			var r = f.call(o)
			if (r != null) return r
		} catch (x) {}
	}
	return null
}

// id типа урона («thorns», «outOfWorld», …)
function nsArtMsgId(src) {
	var id = nsArtCall(src, ['getType', 'getMsgId'])
	return id == null ? '' : String(id)
}

// атакующий (владелец снаряда) и прямой источник (сам моб или снаряд)
function nsArtAttacker(src) {
	return nsArtCall(src, ['getActual', 'getEntity'])
}
function nsArtDirect(src) {
	return nsArtCall(src, ['getImmediate', 'getDirectEntity'])
}

function nsArtFx(name, sound, particle) {
	if (sound) nsArtRun('execute at ' + name + ' run playsound ' + sound + ' player ' + name + ' ~ ~ ~ 0.7 1.4')
	if (particle) nsArtRun('execute at ' + name + ' run particle ' + particle)
}

// Срез урона и щит после удара: удар во время щита отменяется целиком (ни урона, ни отбрасывания)
if (NS_ART_EV_IN) {
	NativeEvents.onEvent(NS_ART_EV_IN, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var p = event.getEntity()
			var u = nsArtUuid(p)
			if (!u) return
			var a = NS_ART_P[u]
			if (!a) return
			var src = event.getSource()
			if (nsArtBypass(src)) return
			var m = NS_ART_M[u]
			if (m && m.shieldUntil > nsArtNow(p)) {
				event.setCanceled(true)
				return
			}
			if (a.dr > 0) event.setAmount(event.getAmount() * (1 - a.dr))
		} catch (x) {}
	})
}

// Второе дыхание: смертельный удар (с учётом поглощения) оставляет 1 HP и даёт несколько секунд щита
if (NS_ART_EV_PRE) {
	NativeEvents.onEvent(NS_ART_EV_PRE, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var p = event.getEntity()
			var u = nsArtUuid(p)
			if (!u) return
			var a = NS_ART_P[u]
			if (!a || !a.wind) return
			var src = event.getSource()
			if (nsArtBypass(src)) return
			var pool = p.getHealth() + p.getAbsorptionAmount()
			if (event.getNewDamage() < pool) return
			var now = nsArtNow(p)
			var pd = p.persistentData
			if (pd.contains('ns_art_wind') && now < Number(pd.getLong('ns_art_wind'))) return
			event.setNewDamage(Math.max(0, pool - 1))
			pd.putLong('ns_art_wind', now + a.wind.cd)
			var m = nsArtMem(u)
			m.shieldUntil = Math.max(m.shieldUntil, now + a.wind.after)
			m.windTold = false
			var name = String(p.getUsername())
			nsArtFx(name, 'minecraft:item.totem.use', 'minecraft:totem_of_undying ~ ~1 ~ 0.4 0.6 0.4 0.4 40 normal ' + name)
			p.tell(Text.gold('[Ночная смена] Второе дыхание! ').append(Text.white('Смертельный удар оставил 1 HP, ' + Math.round(a.wind.after / 20) + ' с неуязвимости. Снова — через ' + Math.round(a.wind.cd / 1200) + ' мин.')))
		} catch (x) {}
	})
}

// После урона: щит мифических, отражение, «был в бою»; вампиризм — когда урон нанёс игрок
if (NS_ART_EV_POST) {
	NativeEvents.onEvent(NS_ART_EV_POST, function (event) {
		try {
			if (NS_ART_ANY <= 0) return
			var dmg = event.getNewDamage()
			if (!(dmg > 0)) return
			var v = event.getEntity()
			var src = event.getSource()
			var vu = nsArtUuid(v)
			if (vu) {
				var a = NS_ART_P[vu]
				if (!a) return
				var now = nsArtNow(v)
				var m = nsArtMem(vu)
				m.hurt = now
				var by = nsArtAttacker(src)
				var direct = nsArtDirect(src)
				// щит включает только удар моба или снаряда: огонь, яд и падение его не тратят
				if (a.shield && (by != null || direct != null) && now >= m.shieldReady && m.shieldUntil <= now) {
					m.shieldUntil = now + a.shield.dur
					m.shieldReady = now + a.shield.cd
					var nm = String(v.getUsername())
					nsArtFx(nm, 'minecraft:block.amethyst_block.chime', 'minecraft:end_rod ~ ~1 ~ 0.3 0.5 0.3 0.02 8 normal ' + nm)
				}
				if (a.thorns > 0) {
					// только ближний бой: прямой источник — сам атакующий, а не стрела
					if (by != null && direct != null && !by.isPlayer() && by.getId() === direct.getId() && by.getId() !== v.getId() && by.isAlive()) {
						by.attack(v.damageSources().thorns(v), dmg * a.thorns) // hurt в KubeJS для JS скрыт — attack(источник, урон)
					}
				}
				return
			}
			if (NS_ART_LIFE <= 0) return
			var att = nsArtAttacker(src)
			var bu = nsArtUuid(att)
			if (!bu) return
			var b = NS_ART_P[bu]
			if (!b || !(b.life > 0)) return
			if (nsArtMsgId(src) === 'thorns') return // отражённый урон не лечит
			if (att.isDeadOrDying()) return
			att.heal(Math.min(b.lifeCap, dmg * b.life))
		} catch (x) {}
	})
}

// Одинаковые не складываются: второй такой же артефакт в слот «Реликвия» не встанет
if (NS_ART_EV_EQUIP && NS_ART_TRI) {
	NativeEvents.onEvent(NS_ART_EV_EQUIP, function (event) {
		try {
			var ctx = event.getSlotContext()
			if (String(ctx.identifier()) !== NS_ART.slot) return
			var id = nsArtItemId(event.getStack())
			if (!NS_ART.items[id]) return
			var st = nsArtRelicStacks(ctx.entity())
			if (st == null) return
			var idx = Number(ctx.index())
			for (var i = 0; i < st.getSlots(); i++) {
				if (i !== idx && nsArtItemId(st.getStackInSlot(i)) === id) {
					event.setEquipResult(NS_ART_TRI.FALSE)
					return
				}
			}
		} catch (x) {}
	})
}

// Сменили надетое — пересчёт на ближайшем тике, не ждём секунду
if (NS_ART_EV_CHANGE) {
	NativeEvents.onEvent(NS_ART_EV_CHANGE, function (event) {
		try {
			if (String(event.getIdentifier()) !== NS_ART.slot) return
			var u = nsArtUuid(event.getEntity())
			if (u) NS_ART_DIRTY[u] = true
		} catch (x) {}
	})
}

// --------------------------------------------------------------------------
// Команды: /nsart — что даёт надетое; /nsart odds <волна> — шансы; /nsart roll <волна> [first] — 1000 бросков (оп)
// --------------------------------------------------------------------------

function nsArtNum(x) {
	return String(Math.round(x * 100) / 100).replace('.', ',')
}

function nsArtStatus(ctx) {
	var p = ctx.source.getPlayer()
	if (!p) return 0
	var u = nsArtUuid(p)
	var ids = nsArtWorn(p)
	if (!ids.length) {
		ctx.source.sendSystemMessage(Text.gold('[Ночная смена] ').append(Text.white('Артефактов смены в слотах «Реликвия» нет (кнопка Curios в инвентаре).')))
		return 1
	}
	var a = nsArtSum(ids)
	var t = Text.gold('[Ночная смена] Надето: ')
	for (var i = 0; i < ids.length; i++) {
		if (i > 0) t = t.append(Text.gray(', '))
		t = t.append(Text.translate('item.' + ids[i].replace(':', '.')))
	}
	var parts = []
	if (a.hp) parts.push('здоровье +' + nsArtNum(a.hp))
	if (a.armor) parts.push('броня +' + nsArtNum(a.armor))
	if (a.tough) parts.push('прочность брони +' + nsArtNum(a.tough))
	if (a.kb) parts.push('отбрасывание −' + Math.round(a.kb * 100) + ' %')
	if (a.speed) parts.push('скорость ' + (a.speed > 0 ? '+' : '−') + Math.round(Math.abs(a.speed) * 100) + ' %')
	if (a.dmg) parts.push('урон +' + nsArtNum(a.dmg))
	if (a.iframes) parts.push('неуязвимость после удара +' + nsArtNum(a.iframes / 20) + ' с')
	if (a.dr) parts.push('входящий урон −' + Math.round(a.dr * 100) + ' %')
	if (a.life) parts.push('вампиризм ' + Math.round(a.life * 100) + ' % (до ' + nsArtNum(a.lifeCap) + ' HP за удар)')
	if (a.regen) parts.push('вне боя +' + nsArtNum(a.regen) + ' HP/с')
	if (a.thorns) parts.push('отражение ' + Math.round(a.thorns * 100) + ' %')
	if (a.shield) parts.push('щит ' + nsArtNum(a.shield.dur / 20) + ' с после удара, раз в ' + nsArtNum(a.shield.cd / 20) + ' с')
	if (a.wind) {
		var pd = p.persistentData
		var left = pd.contains('ns_art_wind') ? Number(pd.getLong('ns_art_wind')) - nsArtNow(p) : 0
		parts.push('второе дыхание ' + (left > 0 ? 'через ' + Math.ceil(left / 20) + ' с' : 'готово'))
	}
	ctx.source.sendSystemMessage(t)
	ctx.source.sendSystemMessage(Text.white(parts.join('; ')))
	ctx.source.sendSystemMessage(Text.gray('Здоровье ' + nsArtNum(p.getHealth()) + ' / ' + nsArtNum(p.getMaxHealth()) + (NS_ART_P[u] ? '' : ' (эффекты включатся в течение секунды)')))
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	event.register(
		Commands.literal('nsart')
			.executes(ctx => nsArtStatus(ctx))
			.then(
				Commands.literal('odds').then(
					Commands.argument('wave', Arguments.INTEGER.create(event)).executes(ctx => {
						var d = Number(Arguments.INTEGER.getResult(ctx, 'wave'))
						ctx.source.sendSystemMessage(Text.gold('[Ночная смена] Волна ' + d + ': ').append(Text.white(NSG.nsNsArtifactHoverText(d, true))))
						return 1
					})
				)
			)
			.then(
				Commands.literal('roll')
					.requires(src => src.hasPermission(2))
					.then(
						Commands.argument('wave', Arguments.INTEGER.create(event))
							.executes(ctx => nsArtRollTest(ctx, Number(Arguments.INTEGER.getResult(ctx, 'wave')), false))
							.then(Commands.literal('first').executes(ctx => nsArtRollTest(ctx, Number(Arguments.INTEGER.getResult(ctx, 'wave')), true)))
					)
			)
	)
})

// 1000 бросков на волне d — проверка шансов без набега
function nsArtRollTest(ctx, d, first) {
	var n = 1000
	var got = 0
	var byTier = [0, 0, 0, 0, 0, 0, 0]
	for (var i = 0; i < n; i++) {
		var r = NSG.nsNsArtifactRoll(d, first)
		if (!r.length) continue
		got++
		byTier[NS_ART.items[r[0][0]].tier]++
	}
	var parts = []
	for (var t = 0; t < byTier.length; t++) if (byTier[t]) parts.push(NS_ART.tiers[t].name + ' ' + byTier[t])
	ctx.source.sendSystemMessage(Text.gold('[Ночная смена] ' + n + ' бросков, волна ' + d + (first ? ' (первое прохождение)' : '') + ': ').append(Text.white('артефактов ' + got + ' — ' + parts.join(', '))))
	return 1
}
