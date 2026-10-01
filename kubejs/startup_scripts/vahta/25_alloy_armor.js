// ==========================================================================
// «Вахта» — броня из межпланетного сплава (Георгий, 01.10: «големскую броню можно сделать, чтобы мы могли на себя
// надеть?»). Броня Modular Golems — снаряжение только для големов (GolemEquipmentItem, модель под голема), игроку
// не надеть. Поэтому — свой комплект из того же материала, что и лучший голем (axiomativ:interplanetary_alloy).
//  - защита 24 (незерит 20, предел игры 30), вязкость 4 (незерит 3), отбрасывает на 15 % слабее, не горит в лаве;
//  - улучшение незеритовой брони на механических крафтерах: сплав | незеритовая вещь | сплав (чары сохраняются) —
//    рецепт в server_scripts/vahta/25_smithing.js;
//  - текстуры — tools/gen_wave_items.py (иконки + слои модели textures/models/armor/alloy_layer_1/2).
// Правило Rhino: только var.
// ==========================================================================
StartupEvents.registry('armor_material', function (event) {
	event
		.create('nightshift:alloy')
		.defense({ helmet: 4, chestplate: 9, leggings: 7, boots: 4, body: 12 })
		.toughness(4)
		.knockbackResistance(0.15)
		.enchantmentValue(20)
		.equipSound('minecraft:item.armor.equip_netherite')
		.repairIngredient(function () {
			return Ingredient.of('axiomativ:interplanetary_alloy')
		})
})

// по одному create на предмет — tools/gen_quests.py находит id по тексту event.create('…')
StartupEvents.registry('item', function (event) {
	event.create('nightshift:alloy_helmet', 'helmet').material('nightshift:alloy').texture('nightshift:item/alloy_helmet').rarity('epic').fireResistant()
	event.create('nightshift:alloy_chestplate', 'chestplate').material('nightshift:alloy').texture('nightshift:item/alloy_chestplate').rarity('epic').fireResistant()
	event.create('nightshift:alloy_leggings', 'leggings').material('nightshift:alloy').texture('nightshift:item/alloy_leggings').rarity('epic').fireResistant()
	event.create('nightshift:alloy_boots', 'boots').material('nightshift:alloy').texture('nightshift:item/alloy_boots').rarity('epic').fireResistant()
})
