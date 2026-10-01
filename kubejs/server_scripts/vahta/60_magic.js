// ==========================================================================
// «Вахта» — магия Iron's Spells 'n Spellbooks (3.16.3, с 01.10; Денис: «завезти магию»).
// Что проверено по jar мода:
//  - Станции мода — НЕ верстаки: начертательный стол (inscription_table), волшебная наковальня (arcane_anvil),
//    кузница свитков (scroll_forge), алхимический котёл (alchemist_cauldron). Ни id *crafting_table*/*workbench*,
//    ни тегов c:player_workstations — закрытие верстака (10_no_hand_crafting.js) их не трогает, окна открываются.
//  - Их рецепты и почти все предметы мода — обычные фигурные рецепты → механические крафтеры (allowRegularCraftingInCrafter);
//    бесформенные (мантии странствующего мага, броня школ, божественная жемчужина) — миксер или крафтеры.
//  - 38 рецептов кузнечного стола: 32 — броня школ (руна | роба волшебника | эссенция) — у каждой есть бесформенный
//    дубль «роба + руна + эссенция», поэтому кузнечные просто убраны; 6 без дубля (незеритовая мантия мага ×4,
//    восстановление Косы и Фламберга) — в общий список NS_VAHTA_SMITHING (25_smithing.js): ряд крафтеров
//    «шаблон | вещь | добавка», чары и вписанные заклинания сохраняются.
//  - Печь руду не плавит: плавка рудного мифрила в доменке убрана, мифриловый лом — дробление.
//  - Эссенции волшебства и пустых рун в мире — только добыча (сундуки, маги). На вахте их делают машины:
//    эссенция — миксер с нагревом, пустая руна — деплоер, пепельная эссенция — вентилятор через огонь душ,
//    обычные чернила — миксер, чернила выше — миксер или алхимический котёл.
// Правило Rhino: только var. Рецепты стола в 25_smithing.js читаются в момент события рецептов, когда все
// скрипты уже загружены, — поэтому дописывать в NS_VAHTA_SMITHING отсюда (файл грузится после 25_) можно.
// ==========================================================================
var NS_MAGIC_SCHOOLS = [
	['archevoker', 'evocation_rune'],
	['cryomancer', 'ice_rune'],
	['cultist', 'blood_rune'],
	['electromancer', 'lightning_rune'],
	['plagued', 'nature_rune'],
	['priest', 'holy_rune'],
	['pyromancer', 'fire_rune'],
	['shadowwalker', 'ender_rune'],
]
var NS_MAGIC_PARTS = ['helmet', 'chestplate', 'leggings', 'boots']

// кузнечные рецепты без бесформенного дубля → ряд механических крафтеров
NS_MAGIC_PARTS.forEach(function (part) {
	NS_VAHTA_SMITHING.push(['irons_spellbooks:netherite_mage_' + part, 'minecraft:netherite_upgrade_smithing_template', '#irons_spellbooks:wizard_base_' + part, '#c:ingots/netherite', 'irons_spellbooks:netherite_mage_' + part])
})
NS_VAHTA_SMITHING.push(['irons_spellbooks:decrepit_scythe_repair', 'irons_spellbooks:timeless_slurry', 'irons_spellbooks:decrepit_scythe', '#c:ingots/pyrium', 'irons_spellbooks:hellrazor'])
NS_VAHTA_SMITHING.push(['irons_spellbooks:legionnaire_flamberge_repair', 'irons_spellbooks:timeless_slurry', 'irons_spellbooks:keeper_flamberge', '#c:ingots/pyrium', 'irons_spellbooks:legionnaire_flamberge'])

ServerEvents.recipes(function (event) {
	// --- броня школ: кузнечные дубли убираем (бесформенный «роба + руна + эссенция» остаётся — миксер/крафтеры) ---
	NS_MAGIC_SCHOOLS.forEach(function (s) {
		NS_MAGIC_PARTS.forEach(function (part) {
			event.remove({ id: 'irons_spellbooks:' + s[0] + '_' + part + '_smithing' })
		})
	})

	// --- мифрил: руда не плавится в печи, лом — дроблением (как остальные руды вахты) ---
	event.remove({ id: 'irons_spellbooks:mithril_scrap_from_ore' })
	event.recipes.create.crushing([
		'irons_spellbooks:mithril_scrap',
		CreateItem.of('irons_spellbooks:mithril_scrap', 0.25),
		CreateItem.of(Item.of('create:experience_nugget', 2), 0.75)
	], 'irons_spellbooks:raw_mithril').id('nightshift:vahta/magic/crushing/raw_mithril')
	event.recipes.create.crushing([
		'irons_spellbooks:mithril_scrap',
		CreateItem.of('irons_spellbooks:mithril_scrap', 0.5),
		CreateItem.of(Item.of('create:experience_nugget', 2), 0.75),
		CreateItem.of('minecraft:cobblestone', 0.125)
	], 'irons_spellbooks:mithril_ore').id('nightshift:vahta/magic/crushing/mithril_ore')
	event.recipes.create.crushing([
		'irons_spellbooks:mithril_scrap',
		CreateItem.of('irons_spellbooks:mithril_scrap', 0.5),
		CreateItem.of(Item.of('create:experience_nugget', 2), 0.75),
		CreateItem.of('minecraft:cobbled_deepslate', 0.125)
	], 'irons_spellbooks:deepslate_mithril_ore').id('nightshift:vahta/magic/crushing/deepslate_mithril_ore')

	// --- эссенция волшебства: миксер с нагревом — лазурит, аметист, светопыль, самородок опыта ---
	event.recipes.create.mixing('irons_spellbooks:arcane_essence', [
		'minecraft:lapis_lazuli',
		'minecraft:amethyst_shard',
		'minecraft:glowstone_dust',
		'create:experience_nugget'
	]).heated().id('nightshift:vahta/magic/mixing/arcane_essence')

	// --- пустая руна: деплоер кладёт эссенцию на полированный глубинный сланец ---
	event.recipes.create.deploying('irons_spellbooks:blank_rune', ['minecraft:polished_deepslate', 'irons_spellbooks:arcane_essence'])
		.id('nightshift:vahta/magic/deploying/blank_rune')

	// --- пепельная эссенция (в мире — с древних рыцарей Незера): вентилятор через огонь душ по эссенции ---
	event.recipes.create.haunting(['irons_spellbooks:cinder_essence'], 'irons_spellbooks:arcane_essence')
		.id('nightshift:vahta/magic/haunting/cinder_essence')

	// --- чернила: обычные — миксер (чернильный мешок + эссенция + пузырёк); выше — как в алхимическом котле:
	// 4 пузырька чернил + металл → 1 пузырёк следующей редкости (в котле: 1000 мБ + металл → 250 мБ) ---
	event.recipes.create.mixing('irons_spellbooks:common_ink', ['minecraft:ink_sac', 'irons_spellbooks:arcane_essence', 'minecraft:glass_bottle'])
		.id('nightshift:vahta/magic/mixing/common_ink')
	var inks = [
		['common_ink', 'uncommon_ink', '#c:ingots/copper'],
		['uncommon_ink', 'rare_ink', '#c:ingots/iron'],
		['rare_ink', 'epic_ink', '#c:ingots/gold'],
		['epic_ink', 'legendary_ink', '#c:gems/amethyst'],
	]
	inks.forEach(function (k) {
		event.recipes.create.mixing(['irons_spellbooks:' + k[1], '3x minecraft:glass_bottle'], ['4x irons_spellbooks:' + k[0], nsIng(k[2])])
			.id('nightshift:vahta/magic/mixing/' + k[1])
	})
})
