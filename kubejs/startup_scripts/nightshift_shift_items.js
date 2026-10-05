// ==========================================================================
// Удобства смены (3.4.0): атлас месторождений — server_scripts/shift/20_atlas.js, текстура — tools/gen_starfall.py.
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:deposit_atlas').texture('nightshift:item/deposit_atlas').maxStackSize(1).rarity('uncommon')
})
