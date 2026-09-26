// ==========================================================================
// Ночная смена — регистрация предметов и блоков (startup_scripts)
// KubeJS 2101.7.2 (MC 1.21.1 NeoForge), KubeJS Create 2101.3.1, Create 6.0.10
//
// ПРОВЕРЕНО ПО JAR (javap на kubejs-neoforge-2101.7.2-build.377.jar):
//   - dev.latvian.mods.kubejs.block.BlockBuilder имеет методы:
//       .blockEntity(Consumer<BlockEntityInfo>)   — блок-сущность у кастомного блока
//       .rightClick(Consumer<BlockRightClickedKubeEvent>) — ПКМ по блоку; метод есть,
//         но в этом файле НЕ используется (см. пояснение внутри блока 'nightshift:altar'
//         ниже — startup_scripts и server_scripts живут в разных Rhino-контекстах).
//       .texture(String) / .item(Consumer<ItemBuilder>) — автогенерация модели/блокстейта
//         KubeJS сам генерирует cube_all-модель и blockstate из текстуры (метод
//         generateBlockModels/generateBlockState в BlockBuilder) — отдельные .json
//         в assets писать не нужно, если хватает простого куба.
//   - dev.latvian.mods.kubejs.block.entity.BlockEntityAttachmentHandler (интерфейс,
//     BlockEntityInfo его реализует) имеет:
//       void inventory(String id, Set<Direction> directions, int width, int height)
//       void inventory(String id, Set<Direction> directions, int width, int height, ItemPredicate filter)
//     Реализация — InventoryAttachment, его "Wrapped"-инвентарь ЯВНО НАСЛЕДУЕТ
//     net.neoforged.neoforge.items.ItemStackHandler и регистрирует стандартную
//     капабилити ItemHandler (BlockCapability) через InventoryAttachment$Factory#getCapabilities().
//     Это ТА ЖЕ капабилити, которую используют ванильная воронка и воронка/лента Create
//     (funnel, belt-конвейер) для передачи предметов — значит воронка Create ДОЛЖНА
//     видеть инвентарь алтаря и класть в него предметы. Это подтверждено по байткоду,
//     но не проверено вживую на сервере — ОБЯЗАТЕЛЬНО протестировать воронкой/лентой
//     после деплоя (см. README, раздел "Проверить в игре").
//   - Направления (Set<Direction>) — в JS передаём null (все стороны) или массив
//     строк вида ['up','down','north','south','east','west']. Точная поддержка
//     строк→Direction через TypeWrapper не протрассирована по коду в этой сессии —
//     если null не сработает как "все стороны", передать явный список всех 6.
//
// Если бы .inventory()/.blockEntity() не работали (на случай другой сборки KubeJS) —
// запасной план: алтарь = чисто декоративный блок без инвентаря, а рядом при
// установке блока базы скриптом ставится ванильная бочка (barrel) как "приёмник",
// которую server-скрипт опрашивает каждые 20 тиков (InventoryKJS у barrel уже
// гарантированно видит воронки Create, т.к. это ванильный контейнер). Код такого
// обхода см. в комментарии в конце файла (BACKUP PLAN).
// ==========================================================================

StartupEvents.registry('item', event => {
	// Разметчик базы: инструмент для клика по двум углам зоны.
	// Пока без своей текстуры — переиспользуем текстуру ванильного посоха
	// (blaze_rod) через .texture(), чтобы не рисовать новый арт на черновике.
	// ВАЖНО: у ItemBuilder/BuilderBase нет метода .tooltip() (проверено javap) —
	// подсказка по использованию даётся через lang-файл (см. assets/nightshift/lang)
	// в описании предмета обычным текстом, а не всплывающей строкой тултипа.
	event.create('nightshift:base_marker')
		.texture('minecraft:item/blaze_rod')
		.maxStackSize(1)
})

StartupEvents.registry('block', event => {
	// Блок базы — маркер-якорь зоны, чисто декоративный/сигнальный блок.
	// Текстура — заглушка (lodestone), заменить на свою при появлении арта.
	event.create('nightshift:base_core')
		.texture('minecraft:block/lodestone_top')
		.hardness(5)
		.resistance(1200) // фактически неразрушаемый монстрами/взрывом, это якорь зоны
		.tagBlock('minecraft:mineable/pickaxe')
		.item(itemBuilder => {}) // блок-предмет по умолчанию

	// Алтарь смены — принимает жертвы из инвентаря (воронка/лента Create) и,
	// отдельно, ручное ПКМ-подношение для самой первой жертвы P0→P1.
	// Алтарь не ломается сам: он стоит на блоке базы и исчезает вместе с ним
	// (см. raids/20_nightshift_zones.js). Так базу переносят, ломая блок базы.
	event.create('nightshift:altar')
		.texture('minecraft:block/crying_obsidian') // заглушка текстуры, тематически подходит
		.unbreakable()
		.noDrops()
		.item(itemBuilder => {})
		.blockEntity(be => {
			// Тикаем на сервере — нужно server-скрипту (30_nightshift_altar.js) для
			// обработки содержимого инвентаря раз в N тиков.
			be.serverTicking()
			be.tickFrequency(20) // раз в секунду — экономим тик-бюджет сервера

			// Основной инвентарь алтаря: 3x3 = 9 слотов, принимает предметы со ВСЕХ
			// сторон (null = все направления). Если направления строками не примутся —
			// заменить на массив ['up','down','north','south','east','west'].
			be.inventory('items', ['up', 'down', 'north', 'south', 'east', 'west'], 3, 3)

			// НЕ открываем ванильный GUI по ПКМ (rightClickOpensInventory) — ПКМ
			// у алтаря обрабатывается вручную. ВАЖНО: обработчик ПКМ НЕ вешаем
			// здесь через .rightClick(...) на самом BlockBuilder — startup_scripts
			// и server_scripts в KubeJS 2101 это РАЗНЫЕ Rhino-контексты со своим
			// отдельным `global` (проверенный факт архитектуры KubeJS, не
			// специфика этой версии). Функции вида nsGetState()/nsSaveState(),
			// определённые в server_scripts, из колбэка, скомпилированного в
			// startup_scripts, недоступны. Поэтому логику ПКМ по алтарю вешаем
			// глобальным серверным событием BlockEvents.rightClicked('nightshift:altar', ...)
			// в server_scripts/30_nightshift_altar.js — см. этот файл.
		})
})

// ==========================================================================
// BACKUP PLAN (если .inventory()-капабилити почему-то не подхватывается
// воронкой/лентой Create на практике — см. README, риск №1):
//
// event.create('nightshift:altar_decor') — чисто визуальный блок без blockEntity,
// без capability. При установке "Блока базы" server-скрипт дополнительно
// ставит рядом (например, offset +1 по Z) ванильный minecraft:barrel и
// запоминает его координаты в persistentData как "приёмник жертвы". Раз в
// 20 тиков server-скрипт читает block.getInventory() у бочки (LevelBlock из
// KubeJS это умеет нативно — getInventory()/getInventory(direction) есть
// у LevelBlock уже сейчас, без всякого кастомного blockEntity), сверяет
// содержимое с текущим списком жертв фазы и потребляет предметы.
// Плюс подхода: 100% гарантированная совместимость с воронками Create
// (это же самая обычная бочка). Минус: два блока вместо одного, менее
// красиво. Держим как fallback, а не как основной путь.
// ==========================================================================
