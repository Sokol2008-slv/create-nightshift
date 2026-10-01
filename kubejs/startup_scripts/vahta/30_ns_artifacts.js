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
	// пробуждённые: эпический
	event.create('nightshift:art_stone_heart_aw').texture('nightshift:item/art_stone_heart_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_rosary_aw').texture('nightshift:item/art_rosary_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_butcher_glove_aw').texture('nightshift:item/art_butcher_glove_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_shaft_helmet_aw').texture('nightshift:item/art_shaft_helmet_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_shaft_mace_aw').texture('nightshift:item/art_shaft_mace_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_canyon_silk_aw').texture('nightshift:item/art_canyon_silk_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_frost_shard_aw').texture('nightshift:item/art_frost_shard_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	// пробуждённые: легендарный
	event.create('nightshift:art_titan_blood_aw').texture('nightshift:item/art_titan_blood_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_visor_aw').texture('nightshift:item/art_visor_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_second_wind_aw').texture('nightshift:item/art_second_wind_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_canyon_gland_aw').texture('nightshift:item/art_canyon_gland_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_frost_heart_aw').texture('nightshift:item/art_frost_heart_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_inferno_ash_aw').texture('nightshift:item/art_inferno_ash_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_ender_feather_aw').texture('nightshift:item/art_ender_feather_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_nightmare_claw_aw').texture('nightshift:item/art_nightmare_claw_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_matriarch_aw').texture('nightshift:item/art_tr_matriarch_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_termite_aw').texture('nightshift:item/art_tr_termite_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_scorpioid_aw').texture('nightshift:item/art_tr_scorpioid_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_voidlasher_aw').texture('nightshift:item/art_tr_voidlasher_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_amethyst_aw').texture('nightshift:item/art_tr_amethyst_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_gladiator_aw').texture('nightshift:item/art_tr_gladiator_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_golem_aw').texture('nightshift:item/art_tr_golem_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	// пробуждённые: мифический
	event.create('nightshift:art_hourglass_aw').texture('nightshift:item/art_hourglass_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_horde_heart_aw').texture('nightshift:item/art_horde_heart_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_inferno_crown_aw').texture('nightshift:item/art_inferno_crown_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_ender_void_aw').texture('nightshift:item/art_ender_void_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_nightmare_lantern_aw').texture('nightshift:item/art_nightmare_lantern_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_trisector_aw').texture('nightshift:item/art_tr_trisector_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_diabolos_aw').texture('nightshift:item/art_tr_diabolos_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_guardian_aw').texture('nightshift:item/art_tr_guardian_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_ignis_aw').texture('nightshift:item/art_tr_ignis_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_maledictus_aw').texture('nightshift:item/art_tr_maledictus_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_remnant_aw').texture('nightshift:item/art_tr_remnant_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_tr_monstrosity_aw').texture('nightshift:item/art_tr_monstrosity_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	// пробуждённые: божественный
	event.create('nightshift:art_vakhta_heart_aw').texture('nightshift:item/art_vakhta_heart_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_halo_aw').texture('nightshift:item/art_halo_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	event.create('nightshift:art_abyss_star_aw').texture('nightshift:item/art_abyss_star_aw').maxStackSize(1).fireResistant().tag('curios:relic').tag('nightshift:awakened_artifacts').glow(true)
	// пробуждение: осколок орды (набеги) → пыль орды (дробилка) → эссенция пробуждения (миксер, супернагрев)
	event.create('nightshift:horde_shard').texture('nightshift:item/horde_shard').fireResistant()
	event.create('nightshift:horde_dust').texture('nightshift:item/horde_dust').fireResistant()
	event.create('nightshift:awakening_essence').texture('nightshift:item/awakening_essence').fireResistant().glow(true)
	event.create('nightshift:incomplete_awakening', 'create:sequenced_assembly').texture('nightshift:item/incomplete_awakening').maxStackSize(1).fireResistant()
})
