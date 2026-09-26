// ==========================================================================
// Ночная смена — Алтарь: ПКМ по алтарю или блоку базы открывает меню выбора сложности набега (кнопки в чате,
// при наведении — состав орды и добыча), искупление проклятия стопкой руками или конвейером.
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
// Утилиты алтаря
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

// Состав орды сложности d под текущую команду — строки для подсказки меню
function nsForecastLines(d) {
	var horde = nsChallengeHorde(d)
	var hpTable = NSG.NIGHTSHIFT_MOB_HP
	var scale = nsPartyScale() * (horde.mult || 1)
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
		lines.push('Волна ' + (w + 1) + ': ' + parts.join(', '))
	}
	if (horde.boss) lines.push('БОСС: ' + (horde.boss.label || horde.boss.id.split(':')[1]) + ' (~' + horde.boss.hpLabel + ' HP)')
	var buffs = []
	var names = { resistance: 'сопротивление', strength: 'сила', speed: 'скорость' }
	for (var b in horde.buff || {}) if (horde.buff[b] > 0) buffs.push(names[b] + ' ' + ['', 'I', 'II', 'III'][horde.buff[b]])
	if (buffs.length) lines.push('Мобы усилены: ' + buffs.join(', '))
	if (horde.scale) lines.push('Кошмар: здоровье +' + Math.round(horde.scale.hp * 100) + '%, урон +' + Math.round(horde.scale.damage * 100) + '%, скорость +' + Math.round(horde.scale.speed * 100) + '%')
	if (horde.scale) total = Math.round(total * (1 + horde.scale.hp))
	var players = Math.round((nsPartyScale() - 1) / 0.5) + 1
	lines.push('Итого ' + nsPlural(horde.waves.length, 'волна', 'волны', 'волн') + ', ~' + total + ' HP — расчёт на игроков: ' + players)
	return lines
}

// Название предмета для чата: ключ перевода, переводит клиент
function nsItemText(id) {
	try {
		return Text.translate(String(Item.of(id).getDescriptionId()))
	} catch (e) {
		return Text.of(id)
	}
}

// Подсказка кнопки сложности: состав орды + что выпадает
function nsDifficultyHover(state, d) {
	var L = NSG.NIGHTSHIFT_LOOT
	var max = NSG.NIGHTSHIFT_DIFFICULTY_MAX
	var tier = Math.min(max, d)
	var k = Math.max(0, d - max)
	var rolls = nsRaidRolls(d)
	var t = Text.gold(nsDifficultyName(d))
	var lines = nsForecastLines(d)
	for (var i = 0; i < lines.length; i++) t = t.append(Text.white('\n' + lines[i]))
	t = t.append(Text.gold('\nДобыча каждому: ' + nsPlural(rolls, 'бросок', 'броска', 'бросков') + ', например '))
	var common = L.common[tier]
	for (var c = 0; c < Math.min(3, common.length); c++) {
		if (c > 0) t = t.append(Text.gray(', '))
		t = t.append(Text.white(common[c][1] + '× ')).append(nsItemText(common[c][0]))
	}
	var art = Math.round(Math.min(1, (L.artifactChance[tier] || 0) + 0.04 * k) * 100)
	t = t.append(Text.gray('\nРедкое — ' + Math.round(L.rareChance * 100) + '% за бросок, артефакт — ' + art + '%'))
	if (k > 0) t = t.append(Text.lightPurple('\nТолько в Кошмаре: ' + nsPlural(1 + Math.floor(k / 2), 'особый бросок', 'особых броска', 'особых бросков') + ' — череп визера, незеритовая броня и оружие с чарами, элитры, маяк'))
	if (d > (state.phase || 0)) {
		var bonus = k === 0 ? 'зонд жилы на команду' : ''
		if (d >= 5) bonus += (bonus ? ', ' : '') + 'сильный артефакт каждому'
		if (d === max || (k > 0 && k % 5 === 0)) bonus += ', Сердце ночи каждому'
		t = t.append(Text.lightPurple('\nПервое прохождение: ' + bonus))
	}
	t = t.append(Text.gray('\nДобыча — тем, кто у алтаря хотя бы половину волн'))
	t = t.append(Text.red('\nПровал: −' + nsPlural(nsFailHearts(d), 'сердце', 'сердца', 'сердец') + ' у всех, добычи нет'))
	return t
}

function nsDifficultyButton(state, d, label) {
	var best = state.phase || 0
	var text = '[' + label + ']'
	if (d > best + 1) return Text.darkGray(text).hover(Text.gray('Откроется после победы на предыдущей сложности'))
	var btn = d <= best ? Text.green(text) : Text.yellow(text).bold(true)
	return btn.clickRunCommand('/nightshift start ' + d).hover(nsDifficultyHover(state, d))
}

// Меню алтаря: кнопки сложностей 1–10 и уровни Кошмара после десятой
function nsShowAltarMenu(player, state) {
	var best = state.phase || 0
	var max = NSG.NIGHTSHIFT_DIFFICULTY_MAX
	if ((state.curse || 0) > 0) {
		player.tell(nsCurseLine(state))
		return
	}
	player.tell(Text.gold('[Ночная смена] Алтарь: выбери сложность набега (наведи — состав и добыча, нажми — старт):'))
	var row = Text.of('')
	for (var d = 1; d <= max; d++) {
		row = row.append(nsDifficultyButton(state, d, String(d))).append(Text.of(' '))
		if (d === 5 || d === max) {
			player.tell(row)
			row = Text.of('')
		}
	}
	if (best >= max) {
		var bestK = best - max
		row = Text.darkPurple('Кошмар: ')
		for (var k = Math.max(1, bestK - 3); k <= bestK + 1; k++) row = row.append(nsDifficultyButton(state, max + k, String(k))).append(Text.of(' '))
		player.tell(row)
	}
	player.tell(Text.gray('Пройдено: ' + (best > max ? max + ' + Кошмар ' + (best - max) : best) + '. Жёлтая — следующая, зелёные — для фарма.'))
}

// --------------------------------------------------------------------------
// ПКМ по алтарю: искупление стопкой / меню сложностей.
// --------------------------------------------------------------------------
// ВАЖНО: в KubeJS 2101 event.cancel() — это выход из обработчика (бросает EventExit),
// поэтому вся логика вынесена в функцию, а отмена (чтобы блок из руки не ставился
// на алтарь) — последней строкой обработчика.
BlockEvents.rightClicked('nightshift:altar', event => {
	if (String(event.getHand()) === 'MAIN_HAND') nsAltarClick(event)
	event.cancel()
})

// Откуп проклятия алтаря: стопка ресурса (nsTributeFor) снимает одно сердце
function nsTributeMatches(stack, item) {
	if (!stack || stack.isEmpty()) return false
	if (item.charAt(0) === '#') return stack.is(NS_TAGKEY.create(NS_REGISTRIES.ITEM, NS_RL.parse(item.substring(1))))
	return String(stack.getId()) === item
}

function nsTryTribute(state, player, stack) {
	var t = nsTributeFor(state.phase || 0)
	if (!nsTributeMatches(stack, t.item)) return false
	if (stack.getCount() < t.count) {
		player.tell(Text.gray('[Ночная смена] Для искупления нужно ' + t.count + ' ' + t.label + ' одной стопкой.'))
		return true
	}
	stack.shrink(t.count)
	nsLiftCurse(state, String(player.getUsername()))
	return true
}

// Одно сердце проклятия снято (стопка искупления руками или конвейером)
function nsLiftCurse(state, who) {
	state.curse = Math.max(0, (state.curse || 0) - 1)
	nsSaveState(state)
	nsApplyPenalty(null)
	nsTellAll(Text.green('[Ночная смена] ' + (who ? who + ' искупил' : 'Алтарь принял') + ' стопку: ' + (state.curse > 0 ? 'осталось проклятия: ' + nsPlural(state.curse, 'сердце', 'сердца', 'сердец') + '.' : 'проклятие снято, алтарь снова начинает набеги.')))
}

function nsCurseLine(state) {
	var t = nsTributeFor(state.phase || 0)
	return Text.red('[Ночная смена] Проклятие алтаря: −' + nsPlural(state.curse, 'сердце', 'сердца', 'сердец') + ' у всех. Искупление: ' + t.count + ' ' + t.label + ' за сердце — ПКМ стопкой по алтарю или конвейером в алтарь. Пока не искуплено, новый набег не начать.')
}

function nsAltarClick(event) {
	nsAltarUse(event.getEntity(), event.getBlock(), event.getItem())
}

// ПКМ по алтарю или по блоку базы под ним (altarBlock — сам алтарь): любой игрок
function nsAltarUse(player, altarBlock, stack) {
	var state = nsGetState()
	nsUpsertAltar(state, altarBlock)
	nsSaveState(state)

	if (nsRaidActive(state)) {
		player.tell(Text.red('[Ночная смена] Идёт набег — алтарь занят до его завершения.'))
		return
	}
	if ((state.curse || 0) > 0 && nsTryTribute(state, player, stack)) return
	nsShowAltarMenu(player, state)
}

// Блок базы — второй пульт набегов: ПКМ открывает то же меню, что и алтарь над ним.
// Shift + ПКМ с блоком в руке — обычная постройка рядом, меню не открывается.
BlockEvents.rightClicked('nightshift:base_core', event => {
	var player = event.getEntity()
	var above = event.getBlock().offset(0, 1, 0)
	if (String(above.getId()) !== 'nightshift:altar' || player.isShiftKeyDown()) return
	if (String(event.getHand()) === 'MAIN_HAND') nsAltarUse(player, above, event.getItem())
	event.cancel()
})

// --------------------------------------------------------------------------
// Искупление конвейером: инвентарь алтаря (воронки/ленты Create) раз в 20 тиков
// (be.tickFrequency(20) в startup-скрипте блока). Всё, что не идёт в искупление,
// сгорает — иначе 9 слотов забиваются и конвейер встаёт.
// --------------------------------------------------------------------------
BlockEvents.blockEntityTick('nightshift:altar', event => {
	var state = nsGetState()
	if (nsRaidActive(state)) return // во время набега конвейер не разгружаем — пусть копится, заберём после

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

	var tribute = nsTributeFor(state.phase || 0)
	var burned = 0
	var dirty = false
	for (var k = 0; k < inv.getSlots(); k++) {
		var ts = inv.getStackInSlot(k)
		if (!ts || ts.isEmpty()) continue
		if (state.curse > 0 && nsTributeMatches(ts, tribute.item)) {
			var got = inv.extractItem(k, Math.min(ts.getCount(), tribute.count - (state.tributeProgress || 0)), false).getCount()
			state.tributeProgress = (state.tributeProgress || 0) + got
			dirty = true
			if (state.tributeProgress >= tribute.count) {
				state.tributeProgress = 0
				nsLiftCurse(state, null)
			}
		}
		var rest = inv.getStackInSlot(k)
		if (rest && !rest.isEmpty()) burned += inv.extractItem(k, rest.getCount(), false).getCount()
	}
	if (dirty) nsSaveState(state)
	if (burned > 0) {
		NSG.nsServer.runCommandSilent('execute in ' + String(block.getDimension()) + ' run particle minecraft:flame ' + (block.getX() + 0.5) + ' ' + (block.getY() + 1.1) + ' ' + (block.getZ() + 0.5) + ' 0.2 0.1 0.2 0.01 8')
	}
	if (dirty || burned > 0) {
		var parts = [{ text: 'Алтарь: ', color: 'gold' }]
		if (state.curse > 0) parts.push({ text: 'искупление ' + (state.tributeProgress || 0) + '/' + tribute.count + ', проклятие −' + state.curse + ' ❤', color: 'yellow' })
		else if (dirty) parts.push({ text: 'проклятие снято', color: 'green' })
		if (burned > 0) parts.push({ text: (parts.length > 1 ? ' · ' : '') + 'сгорело: ' + burned, color: 'red' })
		var sel = '@a[x=' + block.getX() + ',y=' + block.getY() + ',z=' + block.getZ() + ',distance=..16]'
		NSG.nsServer.runCommandSilent('execute in ' + String(block.getDimension()) + ' run title ' + sel + ' actionbar ' + JSON.stringify(parts))
	}
})
