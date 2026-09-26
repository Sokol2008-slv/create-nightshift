// ==========================================================================
// Ночная смена — команды набегов.
// Любой игрок:
//   /nightshift menu              — меню сложностей (как ПКМ по алтарю), рядом с алтарём
//   /nightshift start <N>         — набег сложности N у ближайшего алтаря (кнопки меню алтаря)
//   /nightshift altar             — телепорт к алтарю во время набега, после — обратно
// Оператор (уровень 2):
//   /nightshift status            — прогресс, набег, проклятие, алтари
//   /nightshift raid [N]          — набег сложности N (по умолчанию следующей) без проверок
//   /nightshift minor             — малый набег у ближайшего алтаря
//   /nightshift stop              — остановить набег и убрать мобов набега
//   /nightshift phase <N>         — выставить наибольшую пройденную сложность
//   /nightshift setaltar          — поставить блок базы с алтарём на месте оператора (тест, восстановление)
//   /nightshift fresh             — всем онлайн: раны сняты, рассудок/здоровье/еда полные, утро, все на спавне
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
				Commands.literal('menu').executes(ctx => {
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
					nsShowAltarMenu(player, st)
					return 1
				})
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
				Commands.literal('phase').requires(src => src.hasPermission(2)).then(
					Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
						var n = Math.max(0, Math.min(99, Number(Arguments.INTEGER.getResult(ctx, 'n'))))
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
