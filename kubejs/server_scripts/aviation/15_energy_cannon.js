// ==========================================================================
// Ночная смена — энергопушка для самолётов (аддон Axiomativ Industries 0.7.0, поток R, 05.10.2026).
// axiomativ:energy_cannon — курсовое оружие Immersive Aircraft на токе: энергозаряды из ячеек в багажнике, урон током
// (берёт «Механоидов», ульи «Воздушного боя» его принимают). Сборка по шагам из роторной пушки мода: конденсатор,
// электромедь (только после 15-й волны), медная катушка C&A, лампа, пресс, удостоверение «Пилот III» (не тратится).
// EMC 0 — config/ProjectE/custom_emc.json. Цифры — в аддоне: content/cannon/CannonMath.java. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	var part = 'axiomativ:incomplete_energy_cannon'
	var dep = function (item, keep) {
		var s = { type: 'create:deploying', ingredients: [{ item: part }, { item: item }], results: [{ id: part }] }
		if (keep) s.keep_held_item = true
		return s
	}
	event.custom({
		type: 'create:sequenced_assembly',
		ingredient: { item: 'immersive_aircraft:rotary_cannon' },
		loops: 1,
		results: [{ id: 'axiomativ:energy_cannon' }],
		sequence: [
			dep('createaddition:capacitor'),
			dep('nightshift:electric_copper'),
			dep('createaddition:copper_spool'),
			dep('nightshift:electric_copper'),
			dep('create:electron_tube'),
			{ type: 'create:pressing', ingredients: [{ item: part }], results: [{ id: part }] },
			dep('nightshift:pilot_license_3', true)
		],
		transitional_item: { id: part }
	}).id('nightshift:aviation/energy_cannon')
})
