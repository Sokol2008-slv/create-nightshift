// ==========================================================================
// «Вахта» — модули брони (Георгий, 01.10: «броня и Create — пружинные ботинки, ускорители бега и всё такое»).
// Модуль — предмет-«карта», который механические крафтеры ставят на вещь нужного слота: модуль + вещь в любой
// раскладке (рецепт axiomativ:armor_module из аддона Axiomativ Industries 0.3.0). Вещь остаётся той же —
// с чарами, прочностью, именем; модуль даёт атрибуты поверх родных. Один модуль каждого типа на вещь
// (второй такой же крафтеры не примут). Рецепты и ночное зрение — server_scripts/vahta/70_armor_modules.js,
// подсказки и JEI — client_scripts/armor_modules_tooltips.js, текстуры — tools/gen_armor_modules.py.
//   ботинки:  Пружинные ботинки (урон от падения 0), Шаговый подъёмник (шаг на целый блок);
//   поножи:   Ускоритель бега (+30 % скорости), Прыжковые пружины (прыжок ~2,2 блока);
//   нагрудник: Бронепластина (+4 защиты, +2 вязкости, +10 % к стойкости к отбрасыванию);
//   шлем:     Прибор ночного видения (ночное зрение, пока шлем надет).
// Энергощит на нагрудник — предмет самого аддона (axiomativ:energy_shield_mk1/mk2).
// Правило Rhino: только var.
// ==========================================================================
StartupEvents.registry('item', function (event) {
	// по одному create на предмет — tools/gen_quests.py находит id по тексту event.create('…')
	event.create('nightshift:module_spring_boots').texture('nightshift:item/module_spring_boots').maxStackSize(16).rarity('uncommon')
	event.create('nightshift:module_step_assist').texture('nightshift:item/module_step_assist').maxStackSize(16).rarity('uncommon')
	event.create('nightshift:module_sprint').texture('nightshift:item/module_sprint').maxStackSize(16).rarity('rare')
	event.create('nightshift:module_jump_springs').texture('nightshift:item/module_jump_springs').maxStackSize(16).rarity('rare')
	event.create('nightshift:module_armor_plate').texture('nightshift:item/module_armor_plate').maxStackSize(16).rarity('rare')
	event.create('nightshift:module_night_vision').texture('nightshift:item/module_night_vision').maxStackSize(16).rarity('rare')
	// заготовка модуля для сборки по шагам (деплоер + пресс)
	event.create('nightshift:incomplete_armor_module', 'create:sequenced_assembly').texture('nightshift:item/incomplete_armor_module')
})
