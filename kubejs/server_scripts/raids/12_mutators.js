// ==========================================================================
// Ночная смена — «Условия смены» (мутаторы, 01.10.2026; Георгий: «механики замутить, новый эндгейм — гриндить
// волны ради крутого артефакта»). Риск за добычу: у алтаря перед набегом включаешь условия — орда злее, добычи
// больше. Каждое условие даёт бонус: бросков обычной добычи ×(1 + бонус/2), шанс артефакта смены — лишние броски
// (целая часть бонуса — гарантированно, дробная — шансом). Условия общие на команду, запоминаются; на время набега
// фиксируются (state.raid.mut), малые набеги их не берут.
// Хуки: nsHordeCfg/nsRaidRewards/nsStartRaid (40_), меню и прогноз алтаря (30_). Команда: /nsmut <ключ>.
// ==========================================================================
NSG.NS_MUTATORS = [
	{ key: 'double', name: 'Двойная смена', desc: 'мобов вдвое больше', bonus: 0.5 },
	{ key: 'glass', name: 'Стеклянная пушка', desc: 'орда бьёт вдвое сильнее, но здоровья у неё на 40 % меньше', bonus: 0.25 },
	{ key: 'bosses', name: 'Ночь боссов', desc: 'босс в каждой волне, на кратных 5 — вдвое больше', bonus: 0.4 },
	{ key: 'rage', name: 'Ярость', desc: 'орда со «Скоростью II»', bonus: 0.3 },
	{ key: 'blast', name: 'Подрывной день', desc: 'подрывников втрое больше (с 18-й волны)', bonus: 0.2 },
	{ key: 'dark', name: 'Без света', desc: 'у защитников «Тьма» весь набег', bonus: 0.2 },
	{ key: 'iron', name: 'Железная воля', desc: 'смерть любого защитника — провал набега', bonus: 0.6 },
]

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

// Суммарный бонус условий (0 — без условий)
function nsMutBonus(set) {
	var b = 0
	for (var k in set || {}) {
		var m = nsMutFind(k)
		if (m && set[k]) b += m.bonus
	}
	return Math.round(b * 100) / 100
}

function nsMutNames(set) {
	var out = []
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) if ((set || {})[NSG.NS_MUTATORS[i].key]) out.push(NSG.NS_MUTATORS[i].name)
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
	if (set.rage) {
		var bf = {}
		for (var b1 in cfg.buff || {}) bf[b1] = cfg.buff[b1]
		bf.speed = Math.max(bf.speed || 0, 2)
		out.buff = bf
	}
	if (set.bosses) {
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
	if (set.blast) {
		var ws = []
		for (var w = 0; w < cfg.waves.length; w++) {
			var sub = []
			for (var e = 0; e < cfg.waves[w].length; e++) {
				var en = cfg.waves[w][e]
				var kami = en.tags && en.tags.indexOf && en.tags.indexOf('ns_kamikaze') >= 0
				if (!kami) {
					sub.push(en)
					continue
				}
				var c2 = {}
				for (var f2 in en) c2[f2] = en[f2]
				c2.count = en.count * 3
				sub.push(c2)
			}
			ws.push(sub)
		}
		out.waves = ws
	}
	return out
}

// Строка условий в меню алтаря: кнопки-переключатели с подсказкой
function nsMutatorsRow(state) {
	var set = state.mutators || {}
	var row = Text.gray('Условия смены: ')
	for (var i = 0; i < NSG.NS_MUTATORS.length; i++) {
		var m = NSG.NS_MUTATORS[i]
		var on = !!set[m.key]
		var lbl = '[' + (on ? '✔ ' : '') + m.name + ']'
		var btn = on ? Text.red(lbl).bold(true) : Text.darkGray(lbl)
		row = row.append(btn.clickRunCommand('/nsmut ' + m.key).hover(Text.white(m.name + ': ' + m.desc).append(Text.gold('\nДобыча +' + Math.round(m.bonus * 100) + ' %')).append(Text.gray(on ? '\nНажми — выключить' : '\nНажми — включить')))).append(Text.of(' '))
	}
	var b = nsMutBonus(set)
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
				st.mutators[key] = !st.mutators[key]
				nsSaveState(st)
				var who = player ? String(player.getUsername()) : 'Консоль'
				nsTellAll(Text.gold('[Ночная смена] ' + who + (st.mutators[key] ? ' включает' : ' выключает') + ' условие «' + m.name + '»').append(Text.gray(' — ' + m.desc + '. Итого добыча +' + Math.round(nsMutBonus(st.mutators) * 100) + ' %')))
				if (player && typeof nsShowAltarMenu === 'function') nsShowAltarMenu(player, st, 0)
				return 1
			})
		)
	)
})

// «Без света»: тьма защитникам весь набег (раз в 5 с на 7 с) — в измерении алтаря набега
var nsMutTick = 0
ServerEvents.tick(event => {
	try {
		if (++nsMutTick % 100 !== 0) return
		var st = nsGetState()
		if (!st || !st.raid || st.raid.state !== 'active' || !st.raid.mut || !st.raid.mut.dark) return
		var altar = nsFindAltar(st, st.raid.altarId)
		if (altar) NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run effect give @a[distance=0..,gamemode=!creative,gamemode=!spectator] minecraft:darkness 7 0 true')
	} catch (e) {}
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
