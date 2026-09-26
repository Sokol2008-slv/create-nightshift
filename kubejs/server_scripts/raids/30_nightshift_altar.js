// ==========================================================================
// Ночная смена — Алтарь: жертва руками (P0→P1) и через конвейер (остальные),
// прогноз орды, запуск набега при накоплении жертвы.
// ==========================================================================
//
// ПРОВЕРЕНО ПО JAR:
//  - BlockEvents.rightClicked('nightshift:altar', event => {...}) — глобальный
//    серверный обработчик, живёт целиком в server_scripts (в отличие от
//    BlockBuilder#rightClick() из startup_scripts, который в ДРУГОМ Rhino-
//    контексте — см. комментарий в startup_scripts/nightshift_items_blocks.js).
//  - BlockEvents.blockEntityTick('nightshift:altar', event) — тикает согласно
//    be.serverTicking()+be.tickFrequency(20), заданным в startup-скрипте блока.
//  - LevelBlock#getEntity() возвращает BlockEntity, по факту это реальный
//    KubeBlockEntity с публичным полем `attachments` (Map<String,Object>) —
//    оттуда достаём инвентарь по ключу 'items' (тот же id, что дали в be.inventory()).
//  - InventoryKJS (обёртка вокруг ItemStackHandler) даёт getSlots()/
//    getStackInSlot(i)/extractItem(i,count,simulate) — стандартный набор,
//    подтверждено javap.
//  - ItemStackKJS.kjs$getId() -> "modid:path" строка, доступна как .getId().
//
// НЕ ПРОВЕРЕНО (проверить в игре):
//  - Реально ли Create-воронка/лента кладёт предметы В ЭТОТ инвентарь (это
//    ключевой риск №1 всей задачи, см. README).
//  - event.getItem().shrink(int) — публичный Mojang-метод ItemStack, должен
//    мутировать стек в руке игрока по ссылке. Не протестировано вживую.
// ==========================================================================

// --------------------------------------------------------------------------
// Утилиты алтаря/жертвы
// --------------------------------------------------------------------------

function nsRaidActive(state) {
	return state.raid.state !== 'idle' && state.raid.state !== 'cooldown'
}

// Находит или создаёт запись алтаря в state.altars по координатам блока.
function nsUpsertAltar(state, block) {
	var dim = String(block.getDimension())
	var x = block.getX(),
		y = block.getY(),
		z = block.getZ()
	var id = 'altar_' + dim.replace(/[^a-z0-9]/gi, '_') + '_' + x + '_' + y + '_' + z
	var altar = null
	for (var i = 0; i < state.altars.length; i++) {
		if (state.altars[i].id === id) {
			altar = state.altars[i]
			break
		}
	}
	if (!altar) {
		altar = { id: id, dim: dim, x: x, y: y, z: z }
		state.altars.push(altar)
	}
	return altar
}

// Прогноз следующей жертвенной орды — сообщение в чат в духе примера из
// docs/phases/defense_and_hordes.md ("Задача 3", формат прогноза).
function nsForecastText(nextPhase) {
	var horde = nsSacrificeHorde(nextPhase - 1)
	if (!horde) return 'Нет данных по орде для фазы ' + nextPhase
	var hpTable = NSG.NIGHTSHIFT_MOB_HP
	var scale = nsPartyScale()
	var lines = []
	var total = 0
	for (var w = 0; w < horde.waves.length; w++) {
		var wave = horde.waves[w]
		var waveHp = 0
		var parts = []
		for (var i = 0; i < wave.length; i++) {
			var n = Math.ceil(wave[i].count * scale)
			waveHp += (hpTable[wave[i].id] || 20) * n
			parts.push(n + '× ' + (wave[i].label || wave[i].id.split(':')[1]))
		}
		total += waveHp
		lines.push('Волна ' + (w + 1) + ': ' + parts.join(', ') + ' (' + waveHp + ' HP)')
	}
	if (horde.boss) lines.push('БОСС: ' + (horde.boss.label || horde.boss.id.split(':')[1]) + ' (~' + horde.boss.hpLabel + ' HP)')
	var players = Math.round((scale - 1) / 0.5) + 1
	lines.push('Итого: ' + horde.waves.length + ' волн, ' + total + ' HP' + (horde.boss ? ' + босс' : '') + ' — расчёт на игроков: ' + players)
	return lines.join('\n')
}

// Название предмета для чата: ключ перевода, переводит клиент
function nsItemText(id) {
	try {
		return Text.translate(String(Item.of(id).getDescriptionId()))
	} catch (e) {
		return Text.of(id)
	}
}

function nsShowForecast(player, state) {
	var nextPhase = state.phase + 1
	var target = NSG.NIGHTSHIFT_CONFIG.sacrifices[nextPhase]
	if (!target) {
		player.tell(Text.gray('[Ночная смена] Открыта последняя предусмотренная фаза.'))
		return
	}
	player.tell(Text.gold('[Ночная смена] Прогноз набега при жертве фазы ' + nextPhase + ':'))
	var lines = nsForecastText(nextPhase).split('\n')
	for (var i = 0; i < lines.length; i++) player.tell(Text.white(lines[i]))

	player.tell(Text.gold('Нужно для жертвы (' + (target.manual ? 'руками' : 'конвейером') + '):'))
	for (var id in target.items) {
		var have = state.sacrificeProgress[id] || 0
		var need = target.items[id]
		player.tell((have >= need ? Text.green('✓ ') : Text.yellow('• ')).append(nsItemText(id)).append(Text.white(': ' + have + '/' + need)))
	}
}

// Проверяет, набралась ли жертва полностью; если да — запускает жертвенный набег.
function nsCheckSacrificeComplete(state, block) {
	var nextPhase = state.phase + 1
	var target = NSG.NIGHTSHIFT_CONFIG.sacrifices[nextPhase]
	if (!target) return
	for (var id in target.items) {
		var have = state.sacrificeProgress[id] || 0
		if (have < target.items[id]) return // ещё не всё собрано
	}
	// Всё собрано — запускаем жертвенный набег у ЭТОГО алтаря.
	var altar = nsUpsertAltar(state, block)
	nsSaveState(state)
	nsStartRaid('sacrifice', altar.id) // определена в 40_nightshift_raid.js
}

// --------------------------------------------------------------------------
// Ручная жертва / просмотр прогноза — ПКМ по алтарю.
// --------------------------------------------------------------------------
// ВАЖНО: в KubeJS 2101 event.cancel() — это выход из обработчика (бросает EventExit),
// поэтому вся логика вынесена в функцию, а отмена (чтобы блок из руки не ставился
// на алтарь) — последней строкой обработчика.
BlockEvents.rightClicked('nightshift:altar', event => {
	if (String(event.getHand()) === 'MAIN_HAND') nsAltarClick(event)
	event.cancel()
})

function nsAltarClick(event) {
	var state = nsGetState()
	var player = event.getEntity()
	var block = event.getBlock()
	nsUpsertAltar(state, block)

	var nextPhase = state.phase + 1
	var target = NSG.NIGHTSHIFT_CONFIG.sacrifices[nextPhase]

	if (!target) {
		player.tell(Text.gray('[Ночная смена] Жертвовать больше нечего — последняя фаза открыта.'))
		nsSaveState(state)
		return
	}

	if (nsRaidActive(state)) {
		player.tell(Text.red('[Ночная смена] Идёт набег — алтарь занят до его завершения.'))
		nsSaveState(state)
		return
	}

	if (!target.manual) {
		// Эта жертва — только конвейером. ПКМ (в т.ч. пустой рукой) — только прогноз.
		nsShowForecast(player, state)
		nsSaveState(state)
		return
	}

	var heldStack = event.getItem()
	if (!heldStack || heldStack.isEmpty()) {
		nsShowForecast(player, state)
		nsSaveState(state)
		return
	}

	var id = String(heldStack.getId())
	var need = target.items[id]
	if (!need) {
		player.tell(Text.gray('[Ночная смена] Алтарь не примет этот предмет руками.'))
		nsSaveState(state)
		return
	}
	var have = state.sacrificeProgress[id] || 0
	if (have >= need) {
		player.tell(Text.gray('[Ночная смена] Этого уже хватает: ').append(nsItemText(id)).append(Text.gray(' ' + have + '/' + need)))
		nsSaveState(state)
		return
	}
	var want = need - have
	var take = Math.min(want, heldStack.getCount())
	heldStack.shrink(take) // мутирует стек в руке игрока (публичный Mojang-метод)
	state.sacrificeProgress[id] = have + take
	player.tell(Text.yellow('[Ночная смена] Принято ' + take + '× ').append(nsItemText(id)).append(Text.yellow(' (' + state.sacrificeProgress[id] + '/' + need + ')')))

	nsCheckSacrificeComplete(state, block) // сохраняет state сама, если наберётся
	if (!nsRaidActive(nsGetState())) {
		nsSaveState(state) // на случай если ещё не набралось — сохраняем прогресс
	}
}

// Прогресс жертвы над хотбаром у игроков рядом с алтарём. Названия предметов —
// ключами перевода, их переводит клиент (сервер языковых файлов модов не знает).
function nsAltarProgressBar(block, changed, burned) {
	var parts = [{ text: 'Алтарь: ', color: 'gold' }]
	for (var i = 0; i < changed.length; i++) {
		if (i > 0) parts.push({ text: ' · ', color: 'gray' })
		parts.push({ translate: changed[i].key, color: 'white' })
		parts.push({ text: ' ' + changed[i].have + '/' + changed[i].need, color: changed[i].have >= changed[i].need ? 'green' : 'yellow' })
	}
	if (burned > 0) parts.push({ text: (changed.length ? ' · ' : '') + 'сгорело лишнего: ' + burned, color: 'red' })
	var sel = '@a[x=' + block.getX() + ',y=' + block.getY() + ',z=' + block.getZ() + ',distance=..16]'
	NSG.nsServer.runCommandSilent('execute in ' + String(block.getDimension()) + ' run title ' + sel + ' actionbar ' + JSON.stringify(parts))
}

// --------------------------------------------------------------------------
// Автопотребление из инвентаря алтаря (воронки/ленты Create) — раз в 20 тиков
// (задано через be.tickFrequency(20) в startup-скрипте блока).
// --------------------------------------------------------------------------
BlockEvents.blockEntityTick('nightshift:altar', event => {
	var state = nsGetState()
	if (nsRaidActive(state)) return // во время набега конвейер не разгружаем — пусть копится, заберём после

	var nextPhase = state.phase + 1
	var target = NSG.NIGHTSHIFT_CONFIG.sacrifices[nextPhase]
	if (!target || target.manual) return // P0->P1 не через конвейер

	var block = event.getBlock()
	var be
	try {
		be = block.getEntity()
	} catch (e) {
		return
	}
	if (!be || !be.attachments) return

	var inv = be.attachments.get('items')
	if (!inv) {
		if (!NSG.nsInventoryWarned) {
			console.warn('[nightshift] У block entity алтаря нет attachments.get("items") — проверь id инвентаря в blockEntity().')
			NSG.nsInventoryWarned = true
		}
		return
	}

	// Всё, что пришло в алтарь, он забирает: нужное идёт в жертву, лишнее сгорает
	// (иначе 9 слотов забиваются посторонним и конвейер встаёт).
	var changed = []
	var burned = 0
	var slots = inv.getSlots()
	for (var i = 0; i < slots; i++) {
		var stack
		try {
			stack = inv.getStackInSlot(i)
		} catch (e) {
			continue
		}
		if (!stack || stack.isEmpty()) continue
		var id = String(stack.getId())
		var key = String(stack.getDescriptionId())
		var need = target.items[id] || 0
		var have = state.sacrificeProgress[id] || 0
		var take = Math.min(Math.max(0, need - have), stack.getCount())
		if (take > 0) {
			var got = inv.extractItem(i, take, false).getCount()
			if (got > 0) {
				state.sacrificeProgress[id] = have + got
				changed.push({ key: key, have: have + got, need: need })
			}
		}
		var rest = inv.getStackInSlot(i)
		if (rest && !rest.isEmpty()) burned += inv.extractItem(i, rest.getCount(), false).getCount()
	}

	if (burned > 0) {
		NSG.nsServer.runCommandSilent('execute in ' + String(block.getDimension()) + ' run particle minecraft:flame ' + (block.getX() + 0.5) + ' ' + (block.getY() + 1.1) + ' ' + (block.getZ() + 0.5) + ' 0.2 0.1 0.2 0.01 8')
	}
	if (changed.length > 0 || burned > 0) nsAltarProgressBar(block, changed, burned)

	if (changed.length > 0) {
		nsCheckSacrificeComplete(state, block) // сама сохраняет state, если набралось
		if (!nsRaidActive(nsGetState())) nsSaveState(state)
	}
})
