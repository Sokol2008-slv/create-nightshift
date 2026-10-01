// ==========================================================================
// «Вахта» — наши посохи (магия, 01.10: Денис — «завезти магию», «посохи и крафты посохам»).
// Предметы здесь, логика ПКМ и рецепты — server_scripts/vahta/60_staffs.js, подсказки — client_scripts/magic_tooltips.js,
// текстуры — tools/gen_magic_items.py (перекраска ванильного стержня блейза в цвета бренда).
//  - Посох молнии: молния в точку взгляда (до 48 блоков), урон врагам вокруг удара;
//  - Посох сплава: ударная волна вокруг себя — урон и отброс всем мобам набега и монстрам рядом;
//  - Посох равновесия: лечит своих (игроки, големы, приручённые) и бьёт врагов вокруг.
// Перезарядка — кулдаун предмета, расход — прочность и мана Iron's Spells (если мод есть).
// Тег minecraft:enchantable/durability — книги «Прочность» и «Починка» ставятся на наковальне.
// Правило Rhino: только var.
// ==========================================================================
StartupEvents.registry('item', function (event) {
	event.create('nightshift:lightning_staff')
		.texture('nightshift:item/lightning_staff')
		.maxDamage(400)
		.rarity('rare')
		.tag('minecraft:enchantable/durability')
		.tag('nightshift:staffs')
	event.create('nightshift:alloy_staff')
		.texture('nightshift:item/alloy_staff')
		.maxDamage(300)
		.rarity('epic')
		.fireResistant()
		.tag('minecraft:enchantable/durability')
		.tag('nightshift:staffs')
	event.create('nightshift:balance_staff')
		.texture('nightshift:item/balance_staff')
		.maxDamage(500)
		.rarity('epic')
		.glow(true)
		.fireResistant()
		.tag('minecraft:enchantable/durability')
		.tag('nightshift:staffs')
})
