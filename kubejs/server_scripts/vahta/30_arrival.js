// ==========================================================================
// «Вахта» — прибытие. При первом входе игрока: заголовок на экране, пара строк лора
// в чат, «Ящик вахтовика» (только бригадиру VAHTA_KIT_OWNER; остальным — ключ и очки) (сундук с компонентом minecraft:container — ставишь, и
// механизмы уже внутри) и книга «Инструктаж вахтовика».
// Выдаём ванильной командой give с компонентами 1.21 — синтаксис не зависит от
// обёрток KubeJS. Флаг vahta_arrived ставится, только если give ящика прошёл
// (runCommandSilent вернул > 0); иначе — ошибка в лог и новая попытка при следующем входе.
// Выдача отложена на ~3 с после входа: на loggedIn клиент ещё грузит мир и заголовок
// может не показаться.
// Выдать заново (потерял, тест): /vahta_kit <ник> — операторам (уровень 2+), флаг не трогает.
// Игрок и аргумент команды — теми же приёмами, что в scares/10_scares.js (проверено вживую).
// ==========================================================================

var VAHTA_ARRIVE_FLAG = 'vahta_arrived'
// ящик один на смену — только бригадиру (Георгий, 28.09); остальным — ключ, очки и инструктаж
var VAHTA_KIT_OWNER = 'Sokol2008'
var VAHTA_CREW_KIT = [
	['create:wrench', 1],
	['create:goggles', 1]
]
var VAHTA_ARRIVE_DELAY = 60 // тиков после входа

// состав ящика: [id, количество]; вёдра не стакаются — каждое в свою ячейку
var VAHTA_KIT = [
	['create:mechanical_crafter', 9],
	['create:wrench', 1],
	['create:hand_crank', 1],
	['create:water_wheel', 2],
	['create:shaft', 16],
	['create:cogwheel', 8],
	['create:large_cogwheel', 2],
	['create:andesite_alloy', 32],
	['create:mechanical_saw', 1],
	['create:millstone', 1],
	['create:basin', 1],
	['create:mechanical_mixer', 1],
	['create:mechanical_press', 1],
	['create:encased_fan', 1],
	['create:depot', 2],
	['create:andesite_funnel', 4],
	['minecraft:water_bucket', 1],
	['minecraft:water_bucket', 1],
	['minecraft:lava_bucket', 1],
	['minecraft:oak_sapling', 4],
	['minecraft:spruce_sapling', 4],
	['minecraft:birch_sapling', 4],
	['minecraft:bread', 16],
	['minecraft:torch', 32],
	['create:goggles', 1]
]

// страницы книги (каждая — отдельный текст; \n — перенос строки)
var VAHTA_BOOK_TITLE = 'Инструктаж вахтовика'
var VAHTA_BOOK_AUTHOR = 'Бригадир'
var VAHTA_BOOK_PAGES = [
	'Инструктаж вахтовика\n\nСмену перебросило. Верстак здесь мёртв, сетка в руках — тоже.\n\nПравило вахты: руками только СОБИРАТЬ — ставить блоки, класть детали. Всё остальное делают машины из ящика.',
	'Сборочный пост\n\n9 механических крафтеров стеной 3×3, все одной ориентации. Стрелки (видно в очках) сведи к одному крафтеру-выходу — ключом. Вращение: рукоятка или колесо → вал → шестерня у крафтера.\nПодробно: наведи, держи W.',
	'Кто что делает\n\nФигурные рецепты — крафтеры: раскладываешь, как на верстаке.\nБесформенные — миксер над бассейном.\nСжатие 3×3 — пресс.\nДоски — пила (бревно на депо перед пилой = 6 досок), палки и формы — тоже пила.',
	'Руда\n\nПечь руду не берёт, жернов тоже: сырую руду мелют только дробильные колёса (после латуни) — копи её. Первый металл — из камня: булыжник в жернов, гравий под вентилятор с водой.\n\nЛатунь — медь и цинк в миксере с подогревом.',
	'Фазы добычи\n\nВыживание: шахта и пещеры, быстро, но опасно.\nЗавод: экструдер даёт породу, дробление и промывка — металл без шахты.\nБаза: сжатые катализаторы, линия обгоняет кирку.\nСтол трансмутации — вскоре после первого сплава.',
	'Ночь\n\nНабеги идут на алтарь — сложность выбираешь сам. В темноте и глубине падает рассудок: держи свет, ешь, спи. Вниз — много и сразу, линия на базе — медленно, но надёжно.\n\nУдачной смены.'
]

// строка SNBT в одинарных кавычках
function vahtaSnbt(s) {
	return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

function vahtaKitCommand(name) {
	var slots = []
	for (var i = 0; i < VAHTA_KIT.length; i++) {
		slots.push('{slot:' + i + ',item:{id:"' + VAHTA_KIT[i][0] + '",count:' + VAHTA_KIT[i][1] + '}}')
	}
	var title = JSON.stringify({ text: 'Ящик вахтовика', color: 'gold', italic: false })
	var lore = JSON.stringify({ text: 'Поставь — механизмы внутри', color: 'gray', italic: false })
	return 'give ' + name + ' minecraft:chest[minecraft:container=[' + slots.join(',') + ']' +
		',minecraft:custom_name=' + vahtaSnbt(title) +
		',minecraft:lore=[' + vahtaSnbt(lore) + ']] 1'
}

function vahtaBookCommand(name) {
	var pages = []
	for (var i = 0; i < VAHTA_BOOK_PAGES.length; i++) {
		pages.push(vahtaSnbt(JSON.stringify({ text: VAHTA_BOOK_PAGES[i] })))
	}
	return 'give ' + name + ' minecraft:written_book[minecraft:written_book_content={title:' + vahtaSnbt(VAHTA_BOOK_TITLE) +
		',author:' + vahtaSnbt(VAHTA_BOOK_AUTHOR) + ',pages:[' + pages.join(',') + ']}] 1'
}

// выдать ящик и книгу. runCommandSilent в KubeJS 2101 ничего не возвращает (undefined) —
// проверять результат нечем; синтаксис обеих команд проверен на витрине 28.09
// (give @a … → «No player was found», без ошибок разбора компонентов)
function vahtaGiveKit(server, name) {
	if (name === VAHTA_KIT_OWNER) server.runCommandSilent(vahtaKitCommand(name))
	else for (var i = 0; i < VAHTA_CREW_KIT.length; i++) server.runCommandSilent('give ' + name + ' ' + VAHTA_CREW_KIT[i][0] + ' ' + VAHTA_CREW_KIT[i][1])
	server.runCommandSilent(vahtaBookCommand(name))
	return true
}

function vahtaArrive(server, player) {
	var name = String(player.getUsername())
	server.runCommandSilent('title ' + name + ' times 10 100 30')
	server.runCommandSilent('title ' + name + ' subtitle ' + JSON.stringify({ text: 'Смену перебросило. Руками здесь ничего не собрать', color: 'gray' }))
	server.runCommandSilent('title ' + name + ' title ' + JSON.stringify({ text: 'Вахта', color: 'gold', bold: true }))
	server.runCommandSilent('playsound minecraft:block.bell.use master ' + name + ' ~ ~ ~ 1 0.6')
	player.tell(Text.gold('[Вахта] ').append(Text.gray('Точка высадки. Связи с базой нет, верстак не отвечает — здешний мир признаёт только машины.')))
	if (name === VAHTA_KIT_OWNER) player.tell(Text.gold('[Вахта] ').append(Text.gray('В ящике — первые механизмы. Собери сборочный пост из крафтеров, остальное расскажет инструктаж и книга квестов (глава «Фаза 0 · Прибытие»).')))
	else player.tell(Text.gold('[Вахта] ').append(Text.gray('Ящик с механизмами один на смену — он у бригадира ' + VAHTA_KIT_OWNER + '. У тебя ключ, очки и инструктаж; остальное — книга квестов (глава «Фаза 0 · Прибытие»).')))
	if (vahtaGiveKit(server, name)) player.persistentData.putBoolean(VAHTA_ARRIVE_FLAG, true)
	else player.tell(Text.red('[Вахта] Ящик не выдался — сообщи админу (подробности в логе сервера).'))
}

// очередь: [{ name, at }] — ждём, пока клиент догрузится
var vahtaArrivePending = []
var vahtaArriveTick = 0

PlayerEvents.loggedIn(event => {
	var p = event.getPlayer()
	if (p.persistentData.getBoolean(VAHTA_ARRIVE_FLAG)) return
	vahtaArrivePending.push({ name: String(p.getUsername()), at: vahtaArriveTick + VAHTA_ARRIVE_DELAY })
})

ServerEvents.tick(event => {
	vahtaArriveTick++
	if (!vahtaArrivePending.length) return
	var server = event.getServer()
	var left = []
	for (var i = 0; i < vahtaArrivePending.length; i++) {
		var job = vahtaArrivePending[i]
		if (vahtaArriveTick < job.at) {
			left.push(job)
			continue
		}
		var player = server.getPlayerList().getPlayerByName(job.name)
		// вышел раньше — выдадим при следующем входе
		if (!player || player.persistentData.getBoolean(VAHTA_ARRIVE_FLAG)) continue
		vahtaArrive(server, player)
	}
	vahtaArrivePending = left
})

// ручная выдача: /vahta_kit <ник>
ServerEvents.commandRegistry(event => {
	var Commands = event.commands
	var Arguments = event.arguments
	event.register(Commands.literal('vahta_kit')
		.requires(src => src.hasPermission(2))
		.then(Commands.argument('name', Arguments.STRING.create(event))
			.executes(ctx => {
				var name = String(Arguments.STRING.getResult(ctx, 'name'))
				var server = ctx.source.getServer()
				if (!server.getPlayerList().getPlayerByName(name)) {
					ctx.source.sendSystemMessage(Text.red('[Вахта] игрок ' + name + ' не в сети'))
					return 0
				}
				var ok = vahtaGiveKit(server, name)
				ctx.source.sendSystemMessage(ok ? Text.gold('[Вахта] ящик и инструктаж выданы ' + name) : Text.red('[Вахта] не вышло — см. лог сервера'))
				return ok ? 1 : 0
			})))
})
