// ==========================================================================
// «Вахта» — големы Modular Golems собираются ТОЛЬКО машинами Create (feat/golems-planet, 29.09).
//
// Путь голема (по jar modulargolems 3.1.43, проверено на витрине):
//  1. Шаблон металлического голема (modulargolems:metal_golem_template) — рецепт мода «глина+палки+медь»,
//     на вахте это механический крафтер (сетка 3×3), как и любой crafting_shaped.
//  2. Шаблон -> голая часть (тело/рука/ноги; человекоподобный и пёс тоже) — stonecutting-рецепты мода;
//     их делает механическая пила (allowStonecuttingOnSaw = true), часть выбирается фильтром пилы.
//  3. Голая часть -> часть из металла — sequenced_assembly Create (деплоер со слитком, пресс, ...). Рецепты
//     мода (латунь, цинк, незерит, ...) уже есть, для планетных металлов свои — kubejs/data/nightshift/recipe/golems.
//  4. Части -> держатель голема (metal/humanoid/dog_golem_holder) — рецепт golem_assemble мода; это
//     AbstractShapedRecipe на CraftingInput, поэтому его берёт механический крафтер (части в сетке).
//     Замена частей (golem_replace_part) — тоже крафтер.
//  5. Улучшения, снаряжение, карты конфигурации — деплоер: мод сам подписан на DeployerRecipeSearchEvent
//     (держатель голема + предмет -> держатель с предметом).
//  6. Держатель голема -> живой голем: ПКМ по земле (это не крафт).
//  Отдельно: андезитовый голем Create Golems Galore — блок-паттерн «блок андезитового сплава + промышленная
//  шляпа»; шляпа делается прессом (Create) — тоже без ручного крафта.
//
// ЗАЧЕМ УБРАН ВЕРСТАК ГОЛЕМОВ: у него вкладки CraftingMenu, StonecutterMenu, AnvilMenu, SmithingMenu, GrindstoneMenu
// (TableTabType) — плавающий ванильный верстак «в кармане» (тег l2menustacker:quick_access_vanilla открывает его
// прямо из инвентаря). Собственных функций у стола две: вкладка улучшений (её заменяет деплоер) и «разборка голема»
// на части (в паке не нужна). Тупика нет: без стола сборка голема идёт до конца на машинах.
// ==========================================================================

var NS_GOLEM_BENCH = 'modulargolems:golem_workbench'

ServerEvents.recipes(event => {
	// рецепт верстака големов — убираем: предмет недоступен
	event.remove({ id: NS_GOLEM_BENCH })
	event.remove({ output: NS_GOLEM_BENCH })

	// Create Golems Galore 0.2.1: оба рецепта пресса сломаны под Create 6.0.10 — результат записан как
	// {"item":{"id":...}} вместо {"id":...}, парсер Create их отвергает (в логе «Failed to parse recipe»),
	// и шляпы (а с ними и андезитовый голем) были бы недоступны. Заменяем рабочими копиями.
	event.remove({ id: 'creategolemsgalore:pressing/industrial_iron' })
	event.remove({ id: 'creategolemsgalore:pressing/industrial_brass_hat_press' })
	event.custom({
		type: 'create:pressing',
		ingredients: [{ item: 'create:industrial_iron_block' }],
		results: [{ id: 'creategolemsgalore:industrial_iron_hat' }],
	}).id('nightshift:golems/press_industrial_iron_hat')
	event.custom({
		type: 'create:pressing',
		ingredients: [{ item: 'creategolemsgalore:industrial_brass_block' }],
		results: [{ id: 'creategolemsgalore:industrial_brass_hat' }],
	}).id('nightshift:golems/press_industrial_brass_hat')
})

// уже выданные экземпляры (верстак был разрешён 28–29.09): изымаем из инвентарей выживальщиков.
// Открытие из инвентаря (l2menustacker) идёт пакетом клика, KubeJS его не перехватить — поэтому чистим сам предмет.
var nsGolemTick = 0
ServerEvents.tick(event => {
	nsGolemTick++
	if (nsGolemTick % 40 !== 0) return
	try {
		event.server.runCommandSilent('clear @a[gamemode=!creative,gamemode=!spectator] ' + NS_GOLEM_BENCH)
	} catch (e) {
		console.warn('[vahta] изъятие верстака големов: ' + e)
	}
})

ItemEvents.rightClicked(NS_GOLEM_BENCH, event => {
	var player = event.getPlayer()
	if (!player || player.isCreative()) return
	event.cancel()
})
