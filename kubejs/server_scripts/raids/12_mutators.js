// ==========================================================================
// Ночная смена — «Условия смены» (мутаторы, 01.10.2026; Георгий: «механики замутить, новый эндгейм — гриндить
// волны ради крутого артефакта»). Риск за добычу: у алтаря перед набегом включаешь условия — орда злее, добычи
// больше. Каждое условие даёт бонус: бросков обычной добычи ×(1 + бонус/2), шанс артефакта смены — лишние броски
// (целая часть бонуса — гарантированно, дробная — шансом). Условия общие на команду, запоминаются; на время набега
// фиксируются (state.raid.mut), малые набеги их не берут.
//
// 05.10 (поток W):
//  - +5 условий: «Хрупкий алтарь» (прочность алтаря 1 — прежнее правило «первый дошедший — провал»), «Чемпионы»
//    (в каждой подволне светящийся моб ×4 здоровья), «Эскалация» (каждую минуту набега орда сильнее и быстрее, до III),
//    «Живучие» (орда с «Регенерацией II»), «Ручная работа» (урон машин по орде — вполовину).
//  - Афиша: в пульте алтаря помещается 7 строк, условий теперь 12. Всегда на афише — Двойная смена, Ночь боссов,
//    Железная воля; ещё 4 меняются с рассветом (по номеру дня). Включённые видны всегда — их можно выключить; условие из
//    контракта бригадира — тоже.
//  - Честная награда: условие, которое на этой волне ничего не меняет, бонуса не даёт (Подрывной день до 18-й волны).
//    Бонусы подправлены под реальную тяжесть (Двойная смена +60 %: мобов вдвое, а бросков за подволны столько же).
// Хуки: nsHordeCfg/nsRaidRewards/nsStartRaid (40_), меню и прогноз алтаря (30_), пульт (16_). Команда: /nsmut <ключ>.
// ==========================================================================
NSG.NS_MUTATORS = [
	{ key: 'double', name: 'Двойная смена', desc: 'мобов вдвое больше', bonus: 0.6 },
	{ key: 'glass', name: 'Стеклянная пушка', desc: 'орда бьёт вдвое сильнее, но здоровья у неё на 40 % меньше', bonus: 0.25 },
	{ key: 'bosses', name: 'Ночь боссов', desc: 'босс в каждой волне, на кратных 5 — вдвое больше', bonus: 0.4 },
	{ key: 'rage', name: 'Ярость', desc: 'орда со «Скоростью II»', bonus: 0.3 },
	{ key: 'blast', name: 'Подрывной день', desc: 'подрывников втрое больше (с 18-й волны; раньше — без бонуса)', bonus: 0.2, from: 18 },
	{ key: 'dark', name: 'Без света', desc: 'у защитников «Тьма» весь набег', bonus: 0.2 },
	{ key: 'iron', name: 'Железная воля', desc: 'смерть любого защитника — провал набега', bonus: 0.6 },
	{ key: 'fragile', name: 'Хрупкий алтарь', desc: 'прочность алтаря 1: первый дошедший моб — провал', bonus: 0.3 },
	{ key: 'champions', name: 'Чемпионы', desc: 'в каждой подволне светящийся чемпион: ×4 здоровья, крупнее', bonus: 0.35 },
	{ key: 'escalation', name: 'Эскалация', desc: 'каждую минуту набега орда сильнее и быстрее (до III) — тянуть нельзя', bonus: 0.3 },
	{ key: 'regen', name: 'Живучие', desc: 'орда с «Регенерацией II» — добивать сразу', bonus: 0.25 },
	{ key: 'machines', name: 'Ручная работа', desc: 'урон турелей, пушек и теслы по орде — вполовину', bonus: 0.35 },
]
// Афиша: эти всегда, ещё NS_MUT_POSTER_ROT из остальных — по номеру игрового дня
var NS_MUT_FIXED = ['double', 'bosses', 'iron']
var NS_MUT_POSTER_ROT = 4
var NS_MUT_POSTER_MAX = 7 // строк в пульте алтаря (окно аддона без прокрутки)

function nsMutFind(key) {
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) if (NSG.NS_MUTATORS[i].key === key) return NSG.NS_MUTATORS[i]
	return null
}

// Условия текущего набега (зафиксированы на старте) или выбранные у алтаря
function nsMutSet(state) {
	if (state && state.raid && state.raid.state !== 'idle' && state.raid.mut) return state.raid.mut
	return (state && state.mutators) || {}
}

function nsMutOn(state, key) {
	return !!nsMutSet(state)[key]
}

// Суммарный бонус условий (0 — без условий). d — волна: условие, которое на ней ничего не меняет, бонуса не даёт
function nsMutBonus(set, d) {
	var b = 0
	for (var k in set || {}) {
		var m = nsMutFind(k)
		if (!m || !set[k]) continue
		if (m.from && d && d < m.from) continue
		b += m.bonus
	}
	return Math.round(b * 100) / 100
}

function nsMutNames(set) {
	var out = []
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) if ((set || {})[NSG.NS_MUTATORS[i].key]) out.push(NSG.NS_MUTATORS[i].name)
	return out
}

function nsMutDay() {
	try {
		return Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
	} catch (e) {
		return 0
	}
}

// Афиша дня: ключи сменных условий (детерминированно по дню)
function nsMutRotation(day) {
	var rot = []
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) if (NS_MUT_FIXED.indexOf(NSG.NS_MUTATORS[i].key) < 0) rot.push(NSG.NS_MUTATORS[i].key)
	var s = (Math.abs(Math.floor(day)) % 2147483646) + 1
	for (var j = rot.length - 1; j > 0; j--) {
		s = (s * 16807) % 2147483647
		var k = s % (j + 1)
		var t = rot[j]
		rot[j] = rot[k]
		rot[k] = t
	}
	return rot.slice(0, NS_MUT_POSTER_ROT)
}

// Что показать (и что можно переключить): включённые, условие контракта бригадира, постоянные, сменные дня. Не больше 7.
function nsMutPoster(state) {
	var set = (state && state.mutators) || {}
	var want = []
	function add(k) {
		if (want.indexOf(k) < 0 && nsMutFind(k)) want.push(k)
	}
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) if (set[NSG.NS_MUTATORS[i].key]) add(NSG.NS_MUTATORS[i].key)
	var cl = (state && state.contracts && state.contracts.list) || []
	for (var c = 0; c < cl.length; c++) if (cl[c].kind === 'mutator' && !cl[c].done && cl[c].mut) add(cl[c].mut)
	for (var f = 0; f < NS_MUT_FIXED.length; f++) add(NS_MUT_FIXED[f])
	var rot = nsMutRotation(nsMutDay())
	for (var r = 0; r < rot.length; r++) add(rot[r])
	var out = []
	for (var m = 0; m < NSG.NS_MUTATORS.length; m++) if (want.indexOf(NSG.NS_MUTATORS[m].key) >= 0 && want.indexOf(NSG.NS_MUTATORS[m].key) < NS_MUT_POSTER_MAX) out.push(NSG.NS_MUTATORS[m])
	return out
}

// Копия состава с условиями (исходный объект волны не трогаем — он общий для всех вызовов)
function nsApplyMutators(cfg, state, d) {
	var set = nsMutSet(state)
	var any = false
	for (var k in set) if (set[k]) any = true
	if (!any || !cfg) return cfg
	if (cfg.scenario) return cfg // сценарий особой стадии (45_) — без подволн и босса, условия к нему не применяются
	var out = {}
	for (var f in cfg) out[f] = cfg[f]
	if (set.double) out.mult = (cfg.mult || 1) * 2
	if (set.glass) {
		var sc = {}
		for (var s1 in cfg.scale || {}) sc[s1] = cfg.scale[s1]
		sc.damage = (sc.damage || 0) + 1
		sc.hp = (1 + (sc.hp || 0)) * 0.6 - 1
		out.scale = sc
		if (cfg.bossScale) {
			var bs = {}
			for (var s2 in cfg.bossScale) bs[s2] = cfg.bossScale[s2]
			bs.damage = (bs.damage || 0) + 1
			bs.hp = (1 + (bs.hp || 0)) * 0.6 - 1
			out.bossScale = bs
		}
	}
	if (set.rage || set.regen) {
		var bf = {}
		for (var b1 in cfg.buff || {}) bf[b1] = cfg.buff[b1]
		if (set.rage) bf.speed = Math.max(bf.speed || 0, 2)
		if (set.regen) bf.regeneration = Math.max(bf.regeneration || 0, 2)
		out.buff = bf
	}
	// босс в каждой волне — кроме «по кругу» (Ритуал, Вожаки, Рубежи, выживание): там боссов нет
	if (set.bosses && !cfg.loop) {
		if (!cfg.boss && typeof nsChallengeHorde === 'function') {
			// босс ближайшей кратной 5 волны (у 1–4 — пятой)
			var bw = Math.max(5, Math.floor(d / 5) * 5)
			var src = nsChallengeHorde(bw)
			out.boss = src.boss
			out.bossExtra = src.bossExtra
			out.bossScale = src.bossScale
			out.bossCount = src.bossCount || 1
		} else out.bossCount = (cfg.bossCount || 1) * 2
	}
	if (set.blast || set.champions) {
		var ws = []
		for (var w = 0; w < cfg.waves.length; w++) {
			var sub = []
			var top = null
			for (var e = 0; e < cfg.waves[w].length; e++) {
				var en = cfg.waves[w][e]
				var kami = en.tags && en.tags.indexOf && en.tags.indexOf('ns_kamikaze') >= 0
				if (!kami && (!top || nsMutEntryHp(en) > nsMutEntryHp(top))) top = en
				if (!kami || !set.blast) {
					sub.push(en)
					continue
				}
				var c2 = {}
				for (var f2 in en) c2[f2] = en[f2]
				c2.count = en.count * 3
				sub.push(c2)
			}
			if (set.champions && top) sub.push(nsMutChampion(top))
			ws.push(sub)
		}
		out.waves = ws
	}
	return out
}

function nsMutEntryHp(e) {
	return e.hp || (NSG.NIGHTSHIFT_MOB_HP && NSG.NIGHTSHIFT_MOB_HP[e.id]) || 20
}

// Чемпион подволны: самый толстый моб строки, ×4 здоровья, ×1,3 роста, светится (полный NBT строки + свои поля —
// при повторе ключа в SNBT побеждает последний)
function nsMutChampion(top) {
	var hp = Math.round(nsMutEntryHp(top) * 4)
	var nm = String(top.label || top.id.split(':')[1])
	var c = {}
	for (var f in top) c[f] = top[f]
	c.count = 0.5
	c.hp = hp
	c.label = 'Чемпион: ' + nm
	c.nbt = (top.nbt ? top.nbt + ',' : '') + 'Glowing:1b,CustomName:\'"Чемпион: ' + nm + '"\',attributes:[{id:"minecraft:generic.max_health",base:' + hp + '.0d},{id:"minecraft:generic.scale",base:1.3d}],Health:' + hp + '.0f'
	c.tags = (top.tags || []).concat(['ns_champion'])
	return c
}

// Строка условий в меню алтаря: кнопки-переключатели с подсказкой (афиша дня)
function nsMutatorsRow(state) {
	var set = state.mutators || {}
	var row = Text.gray('Условия смены (афиша меняется с рассветом): ')
	var list = nsMutPoster(state)
	for (var i = 0; i < list.length; i++) {
		var m = list[i]
		var on = !!set[m.key]
		var lbl = '[' + (on ? '✔ ' : '') + m.name + ']'
		var btn = on ? Text.red(lbl).bold(true) : Text.darkGray(lbl)
		row = row.append(btn.clickRunCommand('/nsmut ' + m.key).hover(Text.white(m.name + ': ' + m.desc).append(Text.gold('\nДобыча +' + Math.round(m.bonus * 100) + ' %')).append(Text.gray(on ? '\nНажми — выключить' : '\nНажми — включить')))).append(Text.of(' '))
	}
	var b = nsMutBonus(set, (state.phase || 0) + 1)
	if (b > 0) row = row.append(Text.gold('→ добыча +' + Math.round(b * 100) + ' %'))
	return row
}

// Лишние броски артефакта смены по бонусу условий: целая часть — наверняка, дробная — шансом
function nsMutExtraArtifactRolls(bonus) {
	if (!(bonus > 0)) return 0
	var n = Math.floor(bonus)
	if (Math.random() < bonus - n) n++
	return n
}

ServerEvents.commandRegistry(event => {
	var C = event.commands
	event.register(
		C.literal('nsmut').then(
			C.argument('key', event.arguments.STRING.create(event)).executes(ctx => {
				var player = ctx.source.getPlayer()
				var key = String(event.arguments.STRING.getResult(ctx, 'key'))
				var m = nsMutFind(key)
				if (!m) return 0
				var st = nsGetState()
				if (st.raid && st.raid.state !== 'idle' && st.raid.state !== 'cooldown') {
					if (player) player.tell(Text.gray('[Ночная смена] Условия меняются только между набегами.'))
					return 0
				}
				st.mutators = st.mutators || {}
				// не с афиши — только выключить (включённое и так на афише)
				var onPoster = false
				var poster = nsMutPoster(st)
				for (var i = 0; i < poster.length; i++) if (poster[i].key === key) onPoster = true
				if (!st.mutators[key] && !onPoster && !(ctx.source.hasPermission(2) && !player)) {
					if (player) player.tell(Text.gray('[Ночная смена] «' + m.name + '» сегодня не на афише — афиша меняется с рассветом.'))
					return 0
				}
				st.mutators[key] = !st.mutators[key]
				nsSaveState(st)
				var who = player ? String(player.getUsername()) : 'Консоль'
				nsTellAll(Text.gold('[Ночная смена] ' + who + (st.mutators[key] ? ' включает' : ' выключает') + ' условие «' + m.name + '»').append(Text.gray(' — ' + m.desc + '. Итого добыча +' + Math.round(nsMutBonus(st.mutators, (st.phase || 0) + 1) * 100) + ' %')))
				if (player && typeof nsShowAltarMenu === 'function') nsShowAltarMenu(player, st, 0)
				return 1
			})
		)
	)
})

// «Без света»: тьма защитникам весь набег (раз в 5 с на 7 с) — в измерении алтаря набега.
// «Эскалация»: раз в 10 с — сила и скорость орды по минутам набега (I на 2-й минуте, II на 3-й, III с 4-й)
var nsMutTick = 0
NSG.nsEscal = NSG.nsEscal || null
ServerEvents.tick(event => {
	try {
		if (++nsMutTick % 20 !== 0) return
		var st = nsGetStateRO()
		if (!st || !st.raid || st.raid.state !== 'active' || !st.raid.mut) return
		var altar = nsFindAltar(st, st.raid.altarId)
		if (!altar) return
		if (st.raid.mut.dark && nsMutTick % 100 === 0) NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run effect give @a[distance=0..,gamemode=!creative,gamemode=!spectator] minecraft:darkness 7 0 true')
		if (st.raid.mut.escalation && !st.raid.paused) {
			if (!NSG.nsEscal || NSG.nsEscal.rid !== st.raid.rid) NSG.nsEscal = { rid: st.raid.rid, secs: 0, lvl: 0 }
			var E = NSG.nsEscal
			E.secs++
			var lvl = Math.min(3, Math.floor(E.secs / 60))
			if (lvl > E.lvl) {
				E.lvl = lvl
				nsTellAll(Text.red('[Ночная смена] Эскалация: орда звереет — уровень ' + ['', 'I', 'II', 'III'][lvl] + '.'))
			}
			if (E.lvl > 0 && E.secs % 10 === 0) {
				NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run effect give @e[tag=nightshift_raid] minecraft:strength 12 ' + (E.lvl - 1) + ' true')
				NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run effect give @e[tag=nightshift_raid] minecraft:speed 12 ' + (E.lvl - 1) + ' true')
			}
		}
	} catch (e) {}
})

// «Ручная работа»: урон по мобам набега не от живого игрока (турели, пушки, тесла, големы, деплоеры) — вполовину.
// Тело — в try: исключение в нативном обработчике роняет сервер.
var NS_MUT_DAMAGE = Java.loadClass('net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent')
var NS_MUT_FAKE = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayer')
NativeEvents.onEvent(NS_MUT_DAMAGE, function (event) {
	try {
		var v = event.getEntity()
		if (!v.getTags().contains('nightshift_raid')) return
		var st = nsGetStateRO()
		if (!st || !st.raid || st.raid.state !== 'active' || !st.raid.mut || !st.raid.mut.machines) return
		var by = nsNfAttacker(event.getSource())
		var real = false
		try {
			real = by != null && by.isPlayer() && !(by instanceof NS_MUT_FAKE)
		} catch (x) {}
		if (!real) event.setAmount(event.getAmount() * 0.5)
	} catch (x) {}
})

// «Железная воля»: смерть защитника в измерении алтаря во время набега — провал
EntityEvents.death('minecraft:player', event => {
	try {
		var st = nsGetState()
		if (!st || !st.raid || st.raid.state !== 'active' || st.raid.kind === 'minor' || !st.raid.mut || !st.raid.mut.iron) return
		var altar = nsFindAltar(st, st.raid.altarId)
		if (!altar || String(event.entity.getLevel().getDimension()) !== altar.dim) return
		var name = String(event.entity.getUsername())
		nsTellAll(Text.darkRed('[Ночная смена] Железная воля: ' + name + ' пал — смена сорвана.'))
		var level = nsAltarLevel(altar)
		var mobs = nsCollectRaidMobs(level, altar, nsTrackRadius(st)) || []
		nsRaidFail(st, mobs)
	} catch (e) {
		console.error('[nightshift] железная воля: ' + e)
	}
})
