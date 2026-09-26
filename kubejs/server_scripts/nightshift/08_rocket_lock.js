// ============================================================================
// Create: Ночная смена — страховка от sequence break: блоки ракеты Northstar
// Путь назначения в паке: kubejs/server_scripts/nightshift/08_rocket_lock.js
// ============================================================================
//
// ПРОБЛЕМА (leak_audit.json, general_notes.design_recommendations #5): титан
// синтезируется полностью на Земле химией TFMG (без руды вообще), то есть
// теоретически ракету можно собрать и улететь на Марс, минуя P3 (незерит) и
// P5 (торий). titanium_ingot/titanium_tetrachloride/rutile_concentrate уже
// заблокированы как ПРЕДМЕТЫ до P6 (см. 02_items.js), но это решение —
// belt-and-suspenders: даже если где-то останется обходной путь достать
// материалы (креатив на тесте, баг другого мода, дюп), сами блоки ракеты
// физически нельзя будет поставить/использовать до P6.
//
// ПРОВЕРЕНО: id блоков подтверждены прямой распаковкой Northstar-0.6.6+1.21.1.jar
// (assets/northstar/blockstates/rocket_*.json, combustion_engine.json).
// НЕ ПРОВЕРЕНО: полный список блоков многоблочной структуры ракеты — возможно,
// есть дополнительные части (топливные баки, обшивка), не входящие в префикс
// "rocket_"/"combustion_" — тема требует прогона in-game (создать ракету в
// творческом режиме, посмотреть JEI/Jade на все использованные блоки) на
// тестовом сервере, прежде чем считать эту рестрикцию полной.

AStages.addRestrictionForItem('nightshift:item/rocket_blocks', 'nightshift_p6',
    'northstar:rocket_station',
    'northstar:rocket_controls',
    'northstar:rocket_thruster',
    'northstar:combustion_engine',
    'northstar:rocket_waypoint'
)
