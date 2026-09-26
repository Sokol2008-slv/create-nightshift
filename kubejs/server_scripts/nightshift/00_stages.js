// ============================================================================
// Create: Ночная смена — фазы (AStages, server-scope)
// Путь назначения в паке: kubejs/server_scripts/nightshift/00_stages.js
// ============================================================================
//
// Стадии server-scope: nightshift:p1 .. nightshift:p6 (P0 = отсутствие любой стадии).
// AStages хранит server-scope стадии в своих собственных сохранённых данных мира
// (см. wiki Stage-System — "Server-Scope (Global Scope)"), НЕ в ванильных level-data
// KubeJS. Это значит: на старте сервера порядок такой:
//   1) Datapack/ReloadableServerResources грузит рецепты (ServerEvents.recipes) —
//      обычно ДО того, как загрузился мир и восстановились сохранённые данные AStages.
//   2) Мир грузится, AStages восстанавливает список стадий сервера.
//
// Поэтому AStages.serverHasStage(...) НЕЛЬЗЯ надёжно читать прямо внутри
// ServerEvents.recipes на старте сервера — есть риск гонки (стадия ещё не
// восстановлена => скрипт решит, что фаза = 0, и вырежет легальные рецепты).
// Это некритично для НЕПОСРЕДСТВЕННО AStages-рестрикций (Ores/Items/Loot/Screen/
// Dimension/Mob) — они проверяются "по требованию" на каждое действие игрока,
// а не один раз при реролле рецептов, так что там гонка не страшна.
//
// Но она критична для рецептов модов (create:crushing, createsifter:sifting,
// createoreexcavation:drilling) — AStages НЕ умеет их ограничивать (см. README,
// раздел "Recipe Restriction"), поэтому фазовая фильтрация этих рецептов сделана
// отдельным скриптом (04_drilling_gate.js) через собственный JSON-файл-источник
// истины, который НЕ зависит от таймингов загрузки мира AStages.
//
// Механизм:
//   - Каждая стадия P1..P6 объявляется как serverOnly().
//   - При выдаче стадии (whenGranted) мы：
//       a) обновляем файл config/nightshift/phase.json (текущий макс. номер фазы);
//       b) запускаем "/reload" (перезагрузку датапаков), чтобы ServerEvents.recipes
//          в 04_drilling_gate.js пересчитал видимые рецепты бурения жил под новую фазу.
//   - Тем самым мы не полагаемся на то, готовы ли данные AStages на момент реролла —
//     мы читаем СВОЙ файл, который мы сами же пишем синхронно с выдачей стадии.
//
// ПРОВЕРЕНО ПО КОДУ: сигнатуры customizeStage/whenGranted/serverOnly — из
// javap-дампа com.alessandro.astages.api.stage.BaseStage и живых примеров
// wiki/Stage-System.md.
// НЕ ПРОВЕРЕНО НА СЕРВЕРЕ: реальный порядок загрузки (datapack reload vs. world
// load) для ИМЕННО этой версии NeoForge 1.21.1 + AStages 2.5.3 — гипотеза выше
// логичная, но не гонялась на живом сервере. Если окажется, что AStages
// восстанавливает свои данные ДО первого ServerEvents.recipes — можно будет
// упростить схему и убрать файл phase.json, читая AStages.serverHasStage()
// напрямую. Проверить на тестовом сервере первым делом.

// --- маленький helper для чтения/записи текущей фазы в JSON-файл ---
// Дублируется в 04_drilling_gate.js: НЕ полагаемся на общую область видимости
// между файлами server_scripts (в разных сборках KubeJS это может вести себя
// по-разному), поэтому каждый файл, которому нужен доступ к phase.json,
// содержит свою копию этого небольшого хелпера.

// Открытый мир (решение 26.09): руды, предметы, измерения и рецепты не заперты по фазам.
// Прогресс — сложности набегов (raids/*). true → все замки фаз ниже выключены.
var NS_OPEN_WORLD = true

function nightshiftReadPhase() {
    // файл лежит в корне сервера (не в config/): sync.py перезаписывает config/ при выкатке
    try {
        var d = JsonIO.read('nightshift_phase.json')
        return d && d.phase ? Number(d.phase) : 0
    } catch (e) {
        return 0
    }
}

function nightshiftWritePhase(phase) {
    try {
        JsonIO.write('nightshift_phase.json', { phase: phase })
        console.info('[nightshift] nightshift_phase.json: фаза ' + phase)
    } catch (e) {
        console.error('[nightshift] не удалось записать nightshift_phase.json: ' + e)
    }
}

// --- объявление 6 фаз ---
// Порядок важен только для человекочитаемости; сами по себе стадии AStages
// не имеют встроенной иерархии — "накопление" фаз (p1, потом p1+p2, потом
// p1+p2+p3...) обеспечивается тем, что жертвенный алтарь (отдельная система,
// вне рамок этой задачи) должен вызывать AStages.addStageToServer(...) для
// НОВОЙ фазы, не снимая предыдущие. Другими словами: реализация алтаря обязана
// накапливать стадии, а не переключать одну на другую.
var NIGHTSHIFT_PHASES = [
    { id: 'nightshift_p1', number: 1, title: 'Фаза 1: Разнорабочий' },
    { id: 'nightshift_p2', number: 2, title: 'Фаза 2: Латунь' },
    { id: 'nightshift_p3', number: 3, title: 'Фаза 3: Пар и глубина' },
    { id: 'nightshift_p4', number: 4, title: 'Фаза 4: Сталь и нефть' },
    { id: 'nightshift_p5', number: 5, title: 'Фаза 5: Энергия' },
    { id: 'nightshift_p6', number: 6, title: 'Фаза 6: Космос' }
]

NIGHTSHIFT_PHASES.forEach(function (phase) {
    AStages.customizeStage(phase.id, phase.title)
        .serverOnly() // фаза общая на сервер, не персональная у игрока
        .titleOnAdd(function (stage) {
            return Component.literal(phase.title).gold().bold()
        })
        .chatMessageOnAdd(function (stage) {
            return Component.literal('Мир содрогнулся: открыта ' + phase.title).yellow()
        })
        .whenGranted(function (event) {
            // Стадия server-scope, поэтому игрок может быть null — используем
            // именно isServerAvailable(), а не isPlayerAvailable().
            if (!event.isServerAvailable()) return

            // Фаза уже учтена (повторная выдача, /nightshift phase) — без лишнего /reload
            if (NS_OPEN_WORLD) return // замков нет — перезагружать рецепты и мир незачем
            var current = nightshiftReadPhase()
            if (phase.number <= current) return
            nightshiftWritePhase(phase.number)

            // Перезагружаем датапаки, чтобы 04_drilling_gate.js пересчитал
            // список разрешённых рецептов бурения жил под новую фазу.
            // ВНИМАНИЕ: /reload — тяжёлая операция (пересборка тегов, рецептов,
            // достижений и т.д.), на большом паке может дать заметный лаг-спайк.
            // Так как жертвоприношение — редкое событие (раз в фазу), это
            // приемлемо, но стоит подтвердить время выполнения на тестовом
            // сервере профайлером (см. §3 плана — "цель: тик сервера < 50 мс").
            var server = event.getServer()
            if (server) {
                server.getCommands().performPrefixedCommand(
                    server.createCommandSourceStack(),
                    'reload'
                )
                // Руды подменяются на клиенте при отрисовке чанка — после открытия
                // фазы клиент сам мир не перерисовывает (руда видна только после
                // перезахода). Через 2 с (клиент уже получил данные AStages) просим
                // всех перерисовать мир — то же, что F3+A.
                // /reload перезапускает скрипты и сбрасывает отложенные задачи —
                // поэтому время перерисовки кладём в persistentData (переживает reload),
                // а отправляет сигнал обработчик тиков уже нового экземпляра скрипта.
                server.persistentData.putLong('nightshift_rerender_at', server.getTickCount() + 60)
            }
        })
})

// Ручные команды для теста на живом сервере (права оператора):
//   /astages server add nightshift_p1
//   /astages server add nightshift_p2   (и т.д., НЕ снимая p1)
//   /astages server info
//   /astages server remove_all

// Отложенная перерисовка мира у клиентов после открытия фазы (см. whenGranted)
ServerEvents.tick(function (event) {
    var server = event.server
    var pd = server.persistentData
    if (!pd.contains('nightshift_rerender_at')) return
    if (server.getTickCount() < pd.getLong('nightshift_rerender_at')) return
    pd.remove('nightshift_rerender_at')
    server.getPlayerList().getPlayers().forEach(function (p) {
        p.sendData('nightshift_rerender', {})
    })
    console.info('[nightshift] перерисовка мира отправлена игрокам')
})
