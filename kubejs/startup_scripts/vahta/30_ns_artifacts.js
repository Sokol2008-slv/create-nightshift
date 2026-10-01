// ==========================================================================
// Артефакты смены — предметы (СГЕНЕРИРОВАНО tools/gen_ns_artifacts.py — правки в таблице генератора).
// Надеваются в слот Curios «Реликвия» (тег curios:relic), эффекты — server_scripts/raids/09_ns_artifacts.js,
// подсказки — client_scripts/ns_artifacts_tooltips.js. Цвет имени по уровню — кодами § в lang.
// По одному create на предмет — tools/gen_quests.py и tools/emc_lock_create.py находят id по тексту event.create('…').
// Правило Rhino: только var.
// ==========================================================================
StartupEvents.registry('item', function (event) {
	// волны: обычный
	event.create('nightshift:art_patch').texture('nightshift:item/art_patch').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_badge').texture('nightshift:item/art_badge').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_thermos').texture('nightshift:item/art_thermos').maxStackSize(1).fireResistant().tag('curios:relic')
	// волны: редкий
	event.create('nightshift:art_buckle').texture('nightshift:item/art_buckle').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_qc_stripe').texture('nightshift:item/art_qc_stripe').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_watch_charm').texture('nightshift:item/art_watch_charm').maxStackSize(1).fireResistant().tag('curios:relic')
	// волны: сверхредкий
	event.create('nightshift:art_fang').texture('nightshift:item/art_fang').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_pauldron').texture('nightshift:item/art_pauldron').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_collar').texture('nightshift:item/art_collar').maxStackSize(1).fireResistant().tag('curios:relic')
	// волны: эпический
	event.create('nightshift:art_stone_heart').texture('nightshift:item/art_stone_heart').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_rosary').texture('nightshift:item/art_rosary').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_butcher_glove').texture('nightshift:item/art_butcher_glove').maxStackSize(1).fireResistant().tag('curios:relic')
	// волны: легендарный
	event.create('nightshift:art_titan_blood').texture('nightshift:item/art_titan_blood').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_visor').texture('nightshift:item/art_visor').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_second_wind').texture('nightshift:item/art_second_wind').maxStackSize(1).fireResistant().tag('curios:relic')
	// волны: мифический
	event.create('nightshift:art_hourglass').texture('nightshift:item/art_hourglass').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_horde_heart').texture('nightshift:item/art_horde_heart').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// волны: божественный
	event.create('nightshift:art_vakhta_heart').texture('nightshift:item/art_vakhta_heart').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_halo').texture('nightshift:item/art_halo').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// арена: эпический
	event.create('nightshift:art_shaft_helmet').texture('nightshift:item/art_shaft_helmet').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_shaft_mace').texture('nightshift:item/art_shaft_mace').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_canyon_silk').texture('nightshift:item/art_canyon_silk').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_frost_shard').texture('nightshift:item/art_frost_shard').maxStackSize(1).fireResistant().tag('curios:relic')
	// арена: легендарный
	event.create('nightshift:art_canyon_gland').texture('nightshift:item/art_canyon_gland').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_frost_heart').texture('nightshift:item/art_frost_heart').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_inferno_ash').texture('nightshift:item/art_inferno_ash').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_ender_feather').texture('nightshift:item/art_ender_feather').maxStackSize(1).fireResistant().tag('curios:relic')
	event.create('nightshift:art_nightmare_claw').texture('nightshift:item/art_nightmare_claw').maxStackSize(1).fireResistant().tag('curios:relic')
	// арена: мифический
	event.create('nightshift:art_inferno_crown').texture('nightshift:item/art_inferno_crown').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_ender_void').texture('nightshift:item/art_ender_void').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_nightmare_lantern').texture('nightshift:item/art_nightmare_lantern').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// арена: божественный
	event.create('nightshift:art_abyss_star').texture('nightshift:item/art_abyss_star').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// трофеи боссов: легендарный
	event.create('nightshift:art_tr_matriarch').texture('nightshift:item/art_tr_matriarch').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_termite').texture('nightshift:item/art_tr_termite').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_scorpioid').texture('nightshift:item/art_tr_scorpioid').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_voidlasher').texture('nightshift:item/art_tr_voidlasher').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_amethyst').texture('nightshift:item/art_tr_amethyst').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_gladiator').texture('nightshift:item/art_tr_gladiator').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_golem').texture('nightshift:item/art_tr_golem').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	// трофеи боссов: мифический
	event.create('nightshift:art_tr_trisector').texture('nightshift:item/art_tr_trisector').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_diabolos').texture('nightshift:item/art_tr_diabolos').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_guardian').texture('nightshift:item/art_tr_guardian').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_ignis').texture('nightshift:item/art_tr_ignis').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_maledictus').texture('nightshift:item/art_tr_maledictus').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_remnant').texture('nightshift:item/art_tr_remnant').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
	event.create('nightshift:art_tr_monstrosity').texture('nightshift:item/art_tr_monstrosity').maxStackSize(1).fireResistant().tag('curios:relic').glow(true)
})
