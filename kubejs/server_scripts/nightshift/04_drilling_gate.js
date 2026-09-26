// ============================================================================
// Create: Ночная смена — фазовый гейтинг бурения жил (Create: Ore Excavation)
// Путь назначения в паке: kubejs/server_scripts/nightshift/04_drilling_gate.js
// ============================================================================
//
// ПРОБЛЕМА: recipeType "createoreexcavation:drilling" — модовый, AStages его не
// поддерживает (см. 03_leak_recipe_fixes.js и wiki/AStages-Recipe-Restriction.md).
// В отличие от файла 03 (где утечки удаляются НАВСЕГДА), бурение жил — легитимный
// игровой контент, который ДОЛЖЕН становиться доступным по мере открытия фаз
// (сейчас железная/медная жила — с P1, золотая/цинковая — с P2, редстоун/лазурит/
// алмаз/изумруд/кварц/незерит/незер-золото/закалённый алмаз — с P3, жила свинца
// (добавлена аддоном create-gunsmithing/cgs, см. ниже) — с P4).
//
// МЕХАНИЗМ: читаем текущую макс. фазу из config/nightshift/phase.json (пишет её
// 00_stages.js при каждой выдаче стадии + сразу триггерит "/reload", который
// вызывает повторный проход ServerEvents.recipes). НЕ читаем AStages.serverHasStage()
// напрямую в этом хендлере — см. подробное обоснование гонки загрузки в шапке
// 00_stages.js.
//
// НЕДОСТАТОК ЭТОЙ СХЕМЫ (важно): пока НЕ будет вызван /reload (первый запуск
// сервера на новом мире, где phase.json ещё не создан), currentPhase = 0, и ВСЕ
// рецепты бурения будут вырезаны, включая P1 (уголь/медь/железо). Это ожидаемо
// для дизайна (P0 — совсем без бурения), НО: если игрок уже находится в фазе P1+
// и просто перезашёл на сервер БЕЗ вызова /reload (например, после ручного
// редактирования сохранения или после переноса мира) — файл phase.json может
// разойтись с реальным состоянием AStages. РЕКОМЕНДАЦИЯ: на старте сервера (в
// ServerEvents.loaded, ПОСЛЕ полной загрузки мира) сверять AStages.getStagesFromServer()
// с phase.json и, если они разошлись, обновлять файл и повторно вызывать /reload.
// Черновик такой сверки — см. закомментированный блок внизу файла, НЕ включён
// в рабочую логику, т.к. не тестировался.


function nightshiftReadPhase_04() {
    // файл лежит в корне сервера (не в config/): sync.py перезаписывает config/ при выкатке
    try {
        var d = JsonIO.read('nightshift_phase.json')
        return d && d.phase ? Number(d.phase) : 0
    } catch (e) {
        return 0
    }
}

// veinId -> минимальная фаза, с которой бурение этой жилы разрешено.
// Источник id: прямая распаковка data/createoreexcavation/recipe/drilling/*.json
// (createoreexcavation-1.21-1.6.8.jar) + data/cgs/recipes/drilling/lead.json
// (create-gunsmithing-1.21.1-1.4.9.jar — СОБСТВЕННАЯ НАХОДКА, не было в
// leak_audit.json: аддон Gunsmithing регистрирует СВОЮ жилу свинца через тот же
// createoreexcavation:drilling recipe type, с рецептом id "cgs:drilling/lead"
// и veinId "createoreexcavation:ore_vein_type/lead" — leak_audit.json проверял
// только createoreexcavation-1.21-1.6.8.jar и не нашёл её, т.к. она физически
// лежит в другом jar).
var NIGHTSHIFT_DRILLING_PHASE = {
    'createoreexcavation:drilling/coal': 1,
    'createoreexcavation:drilling/copper': 1,
    'createoreexcavation:drilling/iron': 1,
    'createoreexcavation:drilling/gold': 2,
    'createoreexcavation:drilling/zinc': 2,
    'createoreexcavation:drilling/lapis': 3,
    'createoreexcavation:drilling/redstone': 3,
    'createoreexcavation:drilling/diamond': 3,
    'createoreexcavation:drilling/emerald': 3,
    'createoreexcavation:drilling/quartz': 3,
    'createoreexcavation:drilling/glowstone': 3,
    'createoreexcavation:drilling/nether_gold': 3,
    'createoreexcavation:drilling/hardened_diamond': 3,   // решение §12: закалённый алмаз -> P3
    'createoreexcavation:drilling/netherite': 3,          // требует netherite_drill — де-факто P3+ и так
    // жилы Ночной смены (kubejs/data/nightshift/recipe/drilling). Рецепты Gunsmithing
    // лежат в старой папке recipes/ и в 1.21 не грузятся — своей жилы свинца у них нет.
    'nightshift:drilling/lead': 4,
    'nightshift:drilling/nickel': 4,
    'nightshift:drilling/lithium': 4,
    'nightshift:drilling/sulfur': 4,
    'nightshift:drilling/platinum': 4,
    'nightshift:drilling/thorium': 5,
    'nightshift:drilling/titanium': 6,
    'nightshift:drilling/tungsten': 6,
    'nightshift:drilling/martian_iron': 6
}

ServerEvents.recipes(function (event) {
    var currentPhase = nightshiftReadPhase_04()
    Object.keys(NIGHTSHIFT_DRILLING_PHASE).forEach(function (id) {
        var requiredPhase = NIGHTSHIFT_DRILLING_PHASE[id]
        if (requiredPhase > currentPhase) {
            event.remove({ id: id })
        }
    })
})

// --- Черновик сверки состояния при старте сервера (НЕ включён, не тестировался) ---
// ServerEvents.loaded(event => {
//     var server = event.server
//     var stages = AStages.getStagesFromServer()
//     var maxPhase = 0
//     for (var i = 1; i <= 6; i++) {
//         if (stages.contains('nightshift:p' + i)) maxPhase = i
//     }
//     if (maxPhase !== nightshiftReadPhase_04()) {
//         // записать maxPhase в phase.json и вызвать /reload ещё раз
//     }
// })
