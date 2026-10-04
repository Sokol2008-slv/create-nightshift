// ==========================================================================
// Авиация (04.10.2026, поток D): удостоверения пилота (аэроклуб — server_scripts/aviation/20_aeroclub.js),
// аэрофотоаппарат и плёнка (aviation/30_aerial_camera.js), полуфабрикат авиатехники для сборки по шагам.
// Улучшения самолётов и ангар-док — в аддоне Axiomativ Industries 0.6.0. Всё — EMC 0.
// Иконки — tools/gen_aviation_items.py.
// ==========================================================================
StartupEvents.registry('item', event => {
	event.create('nightshift:pilot_license_3').texture('nightshift:item/pilot_license_3').maxStackSize(1).rarity('uncommon')
	event.create('nightshift:pilot_license_2').texture('nightshift:item/pilot_license_2').maxStackSize(1).rarity('rare')
	event.create('nightshift:pilot_license_1').texture('nightshift:item/pilot_license_1').maxStackSize(1).rarity('epic').glow(true)
	event.create('nightshift:aerial_camera').texture('nightshift:item/aerial_camera').maxStackSize(1).rarity('rare')
	event.create('nightshift:aerial_film').texture('nightshift:item/aerial_film')
	event.create('nightshift:incomplete_avionics', 'create:sequenced_assembly').texture('nightshift:item/incomplete_avionics').maxStackSize(1)
})
