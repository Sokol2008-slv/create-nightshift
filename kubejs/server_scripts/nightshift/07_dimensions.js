// ============================================================================
// Create: Ночная смена — закрытие измерений (AStages Dimension Restriction)
// Путь назначения в паке: kubejs/server_scripts/nightshift/07_dimensions.js
// ============================================================================
//
// API: AStages.addRestrictionForDimension(id, stage, dimensionId)
// По умолчанию (без maxStayTime/maxAccess) измерение ПОЛНОСТЬЮ закрыто — самый
// простой и надёжный вариант для нашего дизайна (§7 плана: "Нижний мир — P3,
// планеты — P6").
//
// ПРОВЕРЕНО: id измерений Northstar подтверждены прямой распаковкой
// Northstar-0.6.6+1.21.1.jar (data/northstar/dimension/*.json) — 8 файлов:
// earth_orbit, mars, mars_orbit, mercury, mercury_orbit, moon, venus, venus_orbit.
// ВАЖНО: файла "moon_orbit.json" НЕ существует в этой версии мода (возможно,
// луна пока не требует отдельного орбитального измерения, либо использует
// earth_orbit как промежуточное) — это подтверждённый факт по содержимому jar,
// не ошибка/пропуск в этом черновике.
//
// НЕ ПРОВЕРЕНО: попадает ли игрок в измерение "earth_orbit" РАНЬШЕ, чем в саму
// планету (по логике полёта ракеты через Northstar это вероятно промежуточная
// точка маршрута Земля -> орбита -> планета) — если так, блокировка earth_orbit
// достаточна сама по себе, чтобы не долететь ни до одной планеты, но мы всё
// равно закрываем и сами планеты, и их орбиты по отдельности (defense in depth).

AStages.addRestrictionForDimension('nightshift:dim/nether', 'nightshift_p3', 'minecraft:the_nether')
    .allowBidirectional() // блокируем и вход, и (на случай телепорта иным способом) обратный выход не имеет смысла,
                           // но bidirectional тут скорее защищает от порталов, поставленных ДО выдачи стадии

var NIGHTSHIFT_NORTHSTAR_DIMENSIONS = [
    'northstar:earth_orbit',
    'northstar:mars', 'northstar:mars_orbit',
    'northstar:mercury', 'northstar:mercury_orbit',
    'northstar:moon',
    'northstar:venus', 'northstar:venus_orbit'
]

NIGHTSHIFT_NORTHSTAR_DIMENSIONS.forEach(function (dimId) {
    AStages.addRestrictionForDimension('nightshift:dim/' + dimId.replace(':', '_'), 'nightshift_p6', dimId)
})
