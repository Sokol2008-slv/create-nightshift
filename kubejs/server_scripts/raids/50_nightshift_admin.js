// ==========================================================================
// Ночная смена — команды набегов.
// Любой игрок:
//   /nightshift menu [с волны]    — меню сложностей (как ПКМ по алтарю), рядом с алтарём; число — листание
//   /nightshift start <N>         — набег сложности N у ближайшего алтаря (кнопки меню алтаря)
//   /nightshift altar             — телепорт к алтарю во время набега, после — обратно
//   /nightshift spawn add|remove|list|clear — точки спавна орды у ближайшего алтаря (там, где стоишь)
// Оператор (уровень 2):
//   /nightshift status            — прогресс, набег, проклятие, алтари
//   /nightshift raid [N]          — набег сложности N (по умолчанию следующей) без проверок
//   /nightshift minor             — малый набег у ближайшего алтаря
//   /nightshift stop              — остановить набег и убрать мобов набега
//   /nightshift phase <N>         — выставить наибольшую пройденную сложность
//   /nightshift setaltar          — поставить блок базы с алтарём на месте оператора (тест, восстановление)
//   /nightshift fresh             — всем онлайн: раны сняты, рассудок/здоровье/еда полные, утро, все на спавне
//   /nightshift curse <N>         — выставить проклятие алтаря (сердец у всех), 0 — снять
//   /nightshift heal <ник> <N>    — снять игроку N ран (сердец за смерти)
//   /nightshift hearts <ник> <N>  — выставить максимум N сердец без «Сердец ночи» (бонус 0, раны под N)
// ==========================================================================

function nsNearestAltar(state, source) {
	var best = null
	var bestD = 1e18
	var pos = source.getPosition()
	var dim = String(source.getLevel().getDimension())
	for (var i = 0; i < state.altars.length; i++) {
		var a = state.altars[i]
		if (a.dim !== dim) continue
		var d = (a.x - pos.x()) * (a.x - pos.x()) + (a.z - pos.z()) * (a.z - pos.z())
		if (d < bestD) {
			bestD = d
			best = a
		}
	}
	return best
}

// Меню алтаря командой (кнопки листания волн шлют /nightshift menu <с какой волны>)
function nsMenuCmd(ctx, from) {
	var player = ctx.source.getPlayer()
	if (!player) return 0
	var st = nsGetState()
	var altar = nsNearestAltar(st, ctx.source)
	var pos = ctx.source.getPosition()
	if (!altar || (altar.x - pos.x()) * (altar.x - pos.x()) + (altar.z - pos.z()) * (altar.z - pos.z()) > 64 * 64) {
		nsAdminReply(ctx, 'меню набегов — у алтаря (ближе 64 блоков)')
		return 0
	}
	if (nsRaidActive(st)) {
		nsAdminReply(ctx, 'идёт набег — алтарь занят до его завершения')
		return 0
	}
	nsShowAltarMenuChat(player, st, from) // меню в чате — запасное; окно «Пульт алтаря» — ПКМ по алтарю
	return 1
}

// Точки спавна орды: волны появляются у них, а не случайным кольцом
function nsSpawnCmd(ctx, op) {
	var player = ctx.source.getPlayer()
	var st = nsGetState()
	var altar = nsNearestAltar(st, ctx.source)
	if (!altar) return nsAdminReply(ctx, 'алтарь не найден в этом измерении') || 0
	var pos = ctx.source.getPosition()
	var x = Math.floor(pos.x()),
		y = Math.floor(pos.y()),
		z = Math.floor(pos.z())
	var d = Math.round(Math.sqrt((x - altar.x) * (x - altar.x) + (z - altar.z) * (z - altar.z)))
	altar.spawns = altar.spawns || []
	if (op === 'add') {
		if (d > 128) return nsAdminReply(ctx, 'слишком далеко от алтаря (' + d + ' блоков, можно до 128)') || 0
		if (d < 20) return nsAdminReply(ctx, 'слишком близко к алтарю (' + d + ' блоков, нужно не ближе 20)') || 0
		if (nsPointInAnyZone(st, altar.dim, x, y, z)) return nsAdminReply(ctx, 'внутри зоны базы нельзя — орда приходит снаружи') || 0
		if (altar.spawns.length >= 8) return nsAdminReply(ctx, 'уже 8 точек — убери лишнюю: встань рядом и /nightshift spawn remove') || 0
		altar.spawns.push({ x: x, y: y, z: z })
		nsSaveState(st)
		nsTellAll(Text.gold('[Ночная смена] ' + (player ? player.getUsername() : 'Консоль') + ' поставил точку спавна орды №' + altar.spawns.length + ' (' + d + ' блоков от алтаря). Точки видно с разметчиком в руке.'))
		return 1
	}
	if (op === 'remove') {
		var best = -1,
			bd = 1e9
		for (var i = 0; i < altar.spawns.length; i++) {
			var s = altar.spawns[i]
			var dd = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) + (s.z - z) * (s.z - z)
			if (dd < bd) {
				bd = dd
				best = i
			}
		}
		if (best < 0 || bd > 36) return nsAdminReply(ctx, 'рядом (6 блоков) нет точки спавна') || 0
		altar.spawns.splice(best, 1)
		nsSaveState(st)
		nsAdminReply(ctx, 'точка убрана, осталось ' + altar.spawns.length)
		return 1
	}
	if (op === 'clear') {
		altar.spawns = []
		nsSaveState(st)
		nsTellAll(Text.gold('[Ночная смена] Точки спавна убраны — орда снова приходит кольцом со всех сторон.'))
		return 1
	}
	if (altar.spawns.length === 0) nsAdminReply(ctx, 'точек нет — орда приходит кольцом. Встань, где должна появляться орда, и /nightshift spawn add')
	for (var k = 0; k < altar.spawns.length; k++) {
		var q = altar.spawns[k]
		nsAdminReply(ctx, '№' + (k + 1) + ': ' + q.x + ' ' + q.y + ' ' + q.z + ' (' + Math.round(Math.sqrt((q.x - altar.x) * (q.x - altar.x) + (q.z - altar.z) * (q.z - altar.z))) + ' от алтаря)')
	}
	return 1
}

function nsAdminReply(ctx, text) {
	ctx.source.sendSystemMessage(Text.gold('[Ночная смена] ').append(Text.white(text)))
}

// Старт набега сложности d у ближайшего алтаря. check — проверки для игрока.
function nsStartChallenge(ctx, d, check) {
	var st = nsGetState()
	var altar = nsNearestAltar(st, ctx.source)
	if (!altar) {
		nsAdminReply(ctx, 'алтарь не найден в этом измерении')
		return 0
	}
	if (check) {
		var pos = ctx.source.getPosition()
		var dx = altar.x - pos.x(),
			dz = altar.z - pos.z()
		if (dx * dx + dz * dz > 64 * 64) {
			nsAdminReply(ctx, 'набег начинают у алтаря — подойдите ближе 64 блоков')
			return 0
		}
		if (nsRaidActive(st)) {
			nsAdminReply(ctx, 'набег уже идёт')
			return 0
		}
		if ((st.curse || 0) > 0) {
			ctx.source.sendSystemMessage(nsCurseLine(st))
			return 0
		}
		if (d < 1 || d > (st.phase || 0) + 1) {
			nsAdminReply(ctx, 'эта сложность ещё закрыта — сначала пройдите: ' + nsDifficultyName((st.phase || 0) + 1))
			return 0
		}
	} else if (nsRaidActive(st)) nsResetRaidIdle(st)
	// сценарии особых стадий — только под открытым небом у алтаря базы (арена закрыта крышей)
	var spc = NSG.NS_SPECIAL_STAGES ? NSG.NS_SPECIAL_STAGES[d] : null
	if (spc && spc.kind === 'scenario' && altar.dim === 'nightshift:arena') {
		nsAdminReply(ctx, '«' + spc.name + '» — особая стадия под открытым небом: начните её у алтаря базы, не на арене')
		return 0
	}
	// «Осада форпоста»: набег идёт на один из форпостов сети (46_outpost_siege.js)
	if (spc && spc.kind === 'siege') {
		var sa = typeof nsSiegeAltarFor === 'function' ? nsSiegeAltarFor(st) : null
		if (!sa) {
			nsAdminReply(ctx, '«' + spc.name + '» — орда идёт на форпост, а в сети форпостов пусто: поставьте механический экструдер на месторождение (глава «Сеть форпостов»)')
			return 0
		}
		altar = sa
		nsTellAll(Text.gold('[Ночная смена] Орда идёт на форпост «' + sa.name + '» (' + sa.x + ', ' + sa.z + '). Моб у экструдера — провал. ').append(Text.gray('Кто далеко — кнопка телепорта придёт со стартом.')))
	}
	var who = ctx.source.getPlayer()
	nsStartRaid('challenge', altar.id, d)
	nsTellAll(Text.gold('[Ночная смена] ' + (who ? who.getUsername() + ' начинает набег: ' : 'Набег: ')).append(Text.white(nsDifficultyName(d))))
	return 1
}

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments

	event.register(
		Commands.literal('nightshift')
			// игроку — старт набега у алтаря и телепорт к алтарю во время набега; остальное — операторам
			.then(
				Commands.literal('menu')
					.executes(ctx => nsMenuCmd(ctx, 0))
					.then(Commands.argument('from', Arguments.INTEGER.create(event)).executes(ctx => nsMenuCmd(ctx, Number(Arguments.INTEGER.getResult(ctx, 'from')))))
			)
			.then(
				Commands.literal('spawn')
					.then(Commands.literal('add').executes(ctx => nsSpawnCmd(ctx, 'add')))
					.then(Commands.literal('remove').executes(ctx => nsSpawnCmd(ctx, 'remove')))
					.then(Commands.literal('list').executes(ctx => nsSpawnCmd(ctx, 'list')))
					.then(Commands.literal('clear').executes(ctx => nsSpawnCmd(ctx, 'clear')))
			)
			.then(
				Commands.literal('start').then(
					Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
						return nsStartChallenge(ctx, Number(Arguments.INTEGER.getResult(ctx, 'n')), true)
					})
				)
			)
			.then(
				Commands.literal('altar').executes(ctx => {
					var player = ctx.source.getPlayer()
					if (!player) return 0
					var st = nsGetState()
					var altar = nsRaidActive(st) ? nsFindAltar(st, st.raid.altarId) : null
					if (!altar) {
						nsAdminReply(ctx, 'сейчас набега нет — телепорт только на защиту алтаря')
						return 0
					}
					var name = String(player.getUsername())
					st.returns = st.returns || {}
					if (!st.returns[name]) {
						st.returns[name] = { dim: String(player.getLevel().getDimension()), x: player.getX(), y: player.getY(), z: player.getZ() }
					}
					nsSaveState(st)
					NSG.nsServer.runCommandSilent('execute in ' + altar.dim + ' run tp ' + name + ' ' + (altar.x + 0.5) + ' ' + (altar.y + 1) + ' ' + (altar.z + 0.5))
					nsAdminReply(ctx, 'вы у алтаря. После набега вернёт туда, где вы были.')
					return 1
				})
			)
			.then(
				Commands.literal('status').requires(src => src.hasPermission(2)).executes(ctx => {
					var st = nsGetState()
					nsAdminReply(ctx, 'пройдено: ' + st.phase + ', набег: ' + st.raid.state + (st.raid.kind ? ' (' + st.raid.kind + ' ' + (st.raid.difficulty || '') + ', волна ' + (st.raid.waveIndex + 1) + ')' : ''))
					for (var a = 0; a < st.altars.length; a++) nsAdminReply(ctx, 'алтарь ' + st.altars[a].dim + ' ' + st.altars[a].x + ' ' + st.altars[a].y + ' ' + st.altars[a].z)
					nsAdminReply(ctx, 'проклятие: ' + (st.curse || 0) + ', алтарей: ' + st.altars.length + ', зон: ' + st.zones.length + ', ночей до малого: ' + (NSG.NIGHTSHIFT_TUNABLES.minorRaidEveryNights - st.dayCounter))
					return 1
				})
			)
			.then(
				Commands.literal('raid')
					.requires(src => src.hasPermission(2))
					.executes(ctx => nsStartChallenge(ctx, (nsGetState().phase || 0) + 1, false))
					.then(
						Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
							return nsStartChallenge(ctx, Math.max(1, Number(Arguments.INTEGER.getResult(ctx, 'n'))), false)
						})
					)
			)
			.then(
				Commands.literal('minor').requires(src => src.hasPermission(2)).executes(ctx => {
					var st = nsGetState()
					var altar = nsNearestAltar(st, ctx.source)
					if (!altar) {
						nsAdminReply(ctx, 'алтарь не найден в этом измерении')
						return 0
					}
					nsStartRaid('minor', altar.id)
					nsAdminReply(ctx, 'малый набег запущен у ' + altar.id)
					return 1
				})
			)
			.then(
				Commands.literal('stop').requires(src => src.hasPermission(2)).executes(ctx => {
					var st = nsGetState()
					nsResetRaidIdle(st) // сам убирает мобов набега
					NSG.nsServer.runCommandSilent('weather clear')
					nsAdminReply(ctx, 'набег остановлен, мобы набега убраны')
					return 1
				})
			)
			.then(
				Commands.literal('setaltar').requires(src => src.hasPermission(2)).executes(ctx => {
					var pos = ctx.source.getPosition()
					var level = ctx.source.getLevel()
					var x = Math.floor(pos.x()),
						y = Math.floor(pos.y()),
						z = Math.floor(pos.z())
					level.getBlock(x, y, z).set('nightshift:base_core')
					var altarBlock = level.getBlock(x, y + 1, z)
					altarBlock.set('nightshift:altar')
					var st = nsGetState()
					var altar = nsUpsertAltar(st, altarBlock)
					nsSaveState(st)
					nsAdminReply(ctx, 'алтарь поставлен: ' + altar.id)
					return 1
				})
			)
			.then(
				Commands.literal('fresh').requires(src => src.hasPermission(2)).executes(ctx => {
					var st = nsGetState()
					st.wounds = {}
					st.deathSanity = {}
					st.returns = {}
					nsSaveState(st)
					var S = NSG.nsServer
					S.runCommandSilent('time set 0')
					S.runCommandSilent('weather clear')
					S.runCommandSilent('execute in minecraft:overworld positioned 0 0 0 positioned over motion_blocking_no_leaves run tp @a ~ ~ ~')
					S.runCommandSilent('sanity add @a 100')
					S.runCommandSilent('effect give @a minecraft:instant_health 1 10 true')
					S.runCommandSilent('effect give @a minecraft:saturation 1 20 true')
					nsApplyPenalty(null)
					nsTellAll(Text.green('[Ночная смена] Новое утро: все на спавне, раны сняты, рассудок полный.'))
					return 1
				})
			)
			.then(
				Commands.literal('curse').requires(src => src.hasPermission(2)).then(
					Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
						var st = nsGetState()
						st.curse = Math.max(0, Math.min(NSG.NIGHTSHIFT_TUNABLES.curseMaxHearts, Number(Arguments.INTEGER.getResult(ctx, 'n'))))
						if (st.curse === 0 && st.raid.state === 'cooldown') st.raid = nsDefaultState().raid
						nsSaveState(st)
						nsApplyPenalty(null)
						nsTellAll(Text.green('[Ночная смена] Проклятие алтаря: ' + (st.curse > 0 ? '−' + st.curse + ' сердец у всех.' : 'снято.')))
						return 1
					})
				)
			)
			.then(
				Commands.literal('heal').requires(src => src.hasPermission(2)).then(
					Commands.argument('name', Arguments.STRING.create(event)).then(
						Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
							var name = String(Arguments.STRING.getResult(ctx, 'name'))
							var st = nsGetState()
							st.wounds = st.wounds || {}
							var before = st.wounds[name] || 0
							st.wounds[name] = Math.max(0, before - Number(Arguments.INTEGER.getResult(ctx, 'n')))
							nsSaveState(st)
							nsApplyPenalty(null)
							nsAdminReply(ctx, name + ': ран было ' + before + ', стало ' + st.wounds[name])
							return 1
						})
					)
				)
			)
			.then(
				// максимум сердец игрока без «Сердец ночи»: бонус обнуляется, раны = 10 − N − проклятие
				Commands.literal('hearts').requires(src => src.hasPermission(2)).then(
					Commands.argument('name', Arguments.STRING.create(event)).then(
						Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
							var name = String(Arguments.STRING.getResult(ctx, 'name'))
							var n = Math.max(3, Math.min(10, Number(Arguments.INTEGER.getResult(ctx, 'n'))))
							var st = nsGetState()
							st.wounds = st.wounds || {}
							st.bonusHearts = st.bonusHearts || {}
							var T = NSG.NIGHTSHIFT_TUNABLES
							var was = 10 - Math.min(T.penaltyMaxHearts, (st.curse || 0) + (st.wounds[name] || 0)) + Math.min(T.bonusHeartsMax, st.bonusHearts[name] || 0)
							st.bonusHearts[name] = 0
							st.wounds[name] = Math.max(0, Math.min(T.woundMax, 10 - n - (st.curse || 0)))
							nsSaveState(st)
							nsApplyPenalty(null)
							var now = 10 - Math.min(T.penaltyMaxHearts, (st.curse || 0) + st.wounds[name])
							nsAdminReply(ctx, name + ': было ' + was + ' сердец, стало ' + now + ' (ран ' + st.wounds[name] + ', бонус 0, проклятие ' + (st.curse || 0) + ')')
							return 1
						})
					)
				)
			)
			.then(
				Commands.literal('phase').requires(src => src.hasPermission(2)).then(
					Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
						var n = Math.max(0, Math.min(999, Number(Arguments.INTEGER.getResult(ctx, "n"))))
						var st = nsGetState()
						st.phase = n
						nsSaveState(st)
						nsCompletePhaseQuests(null, n)
						nsAdminReply(ctx, 'пройдено выставлено: ' + n + ', открыта: ' + nsDifficultyName(n + 1))
						return 1
					})
				)
			)
	)
})
