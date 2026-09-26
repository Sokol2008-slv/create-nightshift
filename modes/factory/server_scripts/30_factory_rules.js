// ==========================================================================
// «Завод: вал» — правила: генераторы вращения не крафтятся (энергия только от вала),
// стартовый набор при первом входе.
// ==========================================================================

var FS_NO_GENERATORS = [
	'create:water_wheel', 'create:large_water_wheel', 'create:windmill_bearing', 'create:steam_engine', 'create:hand_crank',
	'createcasing:andesite_steam_engine', 'createcasing:brass_steam_engine', 'createcasing:zinc_steam_engine',
	'create_connected:crank_wheel', 'create_connected:large_crank_wheel',
	'createdieselgenerators:diesel_engine', 'createdieselgenerators:large_diesel_engine', 'createdieselgenerators:huge_diesel_engine',
	'createaddition:electric_motor',
	'create_new_age:basic_motor', 'create_new_age:advanced_motor', 'create_new_age:reinforced_motor', 'create_new_age:stirling_engine',
	'createpropulsion:stirling_engine',
	'create_sa:steam_engine', 'create_sa:heat_engine', 'create_sa:hydraulic_engine',
	'dndesires:cog_crank', 'dndesires:large_cog_crank', 'dndesires:stirling_engine',
	'tfmg:regular_engine', 'tfmg:large_engine', 'tfmg:simple_large_engine', 'tfmg:radial_engine', 'tfmg:turbine_engine',
	'tfmg:electric_motor', 'tfmg:heavy_electric_motor',
]

ServerEvents.recipes(event => {
	for (var i = 0; i < FS_NO_GENERATORS.length; i++) event.remove({ output: FS_NO_GENERATORS[i] })
	event.remove({ output: /valve_handle$/ })
})

PlayerEvents.loggedIn(event => {
	var p = event.getPlayer()
	var pd = p.persistentData
	if (!pd.getBoolean('factory_kit')) {
		pd.putBoolean('factory_kit', true)
		var kit = [
			['minecraft:oak_log', 32], ['minecraft:oak_sapling', 8], ['minecraft:bone_meal', 32], ['minecraft:bread', 32],
			['minecraft:stone_pickaxe', 1], ['minecraft:stone_axe', 1], ['minecraft:water_bucket', 2],
		]
		for (var i = 0; i < kit.length; i++) p.give(Item.of(kit[i][0], kit[i][1]))
		p.tell(Text.gold('[Завод] Энергия здесь одна — вал из стены машинной (к западу от спавна). Генераторы не крафтятся.'))
		p.tell(Text.gold('[Завод] Руда идёт из бочек-рудных точек (к востоку), продавать детали — в бочку «Биржа». ').append(Text.aqua('[меню: /factory]').clickRunCommand('/factory')))
	}
	FShudText = ''
})
