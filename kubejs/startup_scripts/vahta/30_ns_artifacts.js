// ==========================================================================
// Артефакты смены — предметы (СГЕНЕРИРОВАНО tools/gen_ns_artifacts.py — правки в таблице генератора).
// Надеваются в слот Curios «Реликвия» (тег curios:relic), эффекты — server_scripts/raids/09_ns_artifacts.js,
// подсказки — client_scripts/ns_artifacts_tooltips.js. Цвет имени по уровню — кодами § в lang.
// По одному create на предмет — tools/gen_quests.py находит id по тексту event.create('…'). Правило Rhino: только var.
// ==========================================================================
StartupEvents.registry('item', function (event) {
	// обычный
	event.create('nightshift:art_patch').texture('nightshift:item/art_patch').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_badge').texture('nightshift:item/art_badge').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_thermos').texture('nightshift:item/art_thermos').maxStackSize(1).fireResistant().tag('curios:relic')
	// редкий
	event.create('nightshift:art_buckle').texture('nightshift:item/art_buckle').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_qc_stripe').texture('nightshift:item/art_qc_stripe').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_watch_charm').texture('nightshift:item/art_watch_charm').maxStackSize(1).fireResistant().tag('curios:relic')
	// сверхредкий
	event.create('nightshift:art_fang').texture('nightshift:item/art_fang').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_pauldron').texture('nightshift:item/art_pauldron').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_collar').texture('nightshift:item/art_collar').maxStackSize(1).fireResistant().tag('curios:relic')
	// эпический
	event.create('nightshift:art_stone_heart').texture('nightshift:item/art_stone_heart').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_rosary').texture('nightshift:item/art_rosary').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_butcher_glove').texture('nightshift:item/art_butcher_glove').maxStackSize(1).fireResistant().tag('curios:relic')
	// легендарный
	event.create('nightshift:art_titan_blood').texture('nightshift:item/art_titan_blood').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_visor').texture('nightshift:item/art_visor').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_second_wind').texture('nightshift:item/art_second_wind').maxStackSize(1).fireResistant().tag('curios:relic')
	// мифический
	event.create('nightshift:art_hourglass').texture('nightshift:item/art_hourglass').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_horde_heart').texture('nightshift:item/art_horde_heart').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// божественный
	event.create('nightshift:art_vakhta_heart').texture('nightshift:item/art_vakhta_heart').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_halo').texture('nightshift:item/art_halo').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
})
