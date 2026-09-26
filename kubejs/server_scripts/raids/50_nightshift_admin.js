// ==========================================================================
// Ночная смена — админ-команды (уровень оператора 2):
//   /nightshift status            — фаза, набег, прогресс жертвы, алтари
//   /nightshift raid              — жертвенный набег у ближайшего алтаря (проверка)
//   /nightshift minor             — малый набег у ближайшего алтаря
//   /nightshift stop              — остановить набег и убрать мобов набега
//   /nightshift phase <0..6>      — выставить фазу (стадии AStages + состояние)
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

ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments

	event.register(
		Commands.literal('nightshift')
			.requires(src => src.hasPermission(2))
			.then(
				Commands.literal('status').executes(ctx => {
					var st = nsGetState()
					nsAdminReply(ctx, 'фаза ' + st.phase + ', набег: ' + st.raid.state + (st.raid.kind ? ' (' + st.raid.kind + ', волна ' + (st.raid.waveIndex + 1) + ')' : ''))
					nsAdminReply(ctx, 'жертва: ' + JSON.stringify(st.sacrificeProgress) + ', алтарей: ' + st.altars.length + ', зон: ' + st.zones.length + ', ночей до малого: ' + (NSG.NIGHTSHIFT_TUNABLES.minorRaidEveryNights - st.dayCounter))
					return 1
				})
			)
			.then(
				Commands.literal('raid').executes(ctx => {
					var st = nsGetState()
					var altar = nsNearestAltar(st, ctx.source)
					if (!altar) {
						nsAdminReply(ctx, 'алтарь не найден в этом измерении')
						return 0
					}
					nsStartRaid('sacrifice', altar.id)
					nsAdminReply(ctx, 'жертвенный набег запущен у ' + altar.id)
					return 1
				})
			)
			.then(
				Commands.literal('minor').executes(ctx => {
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
				Commands.literal('stop').executes(ctx => {
					var st = nsGetState()
					nsResetRaidIdle(st)
					NSG.nsServer.runCommandSilent('kill @e[tag=nightshift_raid]')
					NSG.nsServer.runCommandSilent('weather clear')
					nsAdminReply(ctx, 'набег остановлен, мобы набега убраны')
					return 1
				})
			)
			.then(
				Commands.literal('phase').then(
					Commands.argument('n', Arguments.INTEGER.create(event)).executes(ctx => {
						var n = Math.max(0, Math.min(6, Number(Arguments.INTEGER.getResult(ctx, 'n'))))
						// файл фазы пишем заранее — тогда whenGranted не зовёт /reload на каждую стадию
						nightshiftWritePhase(n)
						NSG.nsServer.runCommandSilent('astages server remove_all')
						for (var p = 1; p <= n; p++) NSG.nsServer.runCommandSilent('astages server add nightshift_p' + p)
						var st = nsGetState()
						st.phase = n
						st.sacrificeProgress = {}
						nsSaveState(st)
						nsCompletePhaseQuests(null, n)
						// один /reload на всё (рецепты бурения) и перерисовка руд у клиентов
						NSG.nsServer.persistentData.putLong('nightshift_rerender_at', NSG.nsServer.getTickCount() + 60)
						NSG.nsServer.runCommandSilent('reload')
						nsAdminReply(ctx, 'фаза выставлена: ' + n)
						return 1
					})
				)
			)
	)
})
