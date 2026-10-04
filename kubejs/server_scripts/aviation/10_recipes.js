// ==========================================================================
// Ночная смена — рецепты авиации (04.10.2026, поток D). Руками не крафтят: сборка по шагам на конвейере
// (деплоеры + пресс), механические крафтеры, миксер. Всё — EMC 0 (config/ProjectE/custom_emc.json).
//
// Удостоверение пилота (аэроклуб, aviation/20_aeroclub.js) — шаг деплоера с keep_held_item: деплоер держит
// удостоверение, рецепт его не тратит. Так каждая ступень авиации открывается своим удостоверением:
//   без удостоверения — биплан, винтокрыл, дирижабль, квадрокоптер (как было) и ангар-док;
//   Пилот III — грузовой дирижабль, экономичный самолёт (Man of Many Planes), Форсаж I, бронекорпус, экономайзер,
//               аэрофотоаппарат;
//   Пилот II  — «Бамбуковый кукурузник», алый биплан (Man of Many Planes), Форсаж II;
//   Пилот I   — военный дирижабль, Форсаж III.
// Гейты форсажа (Георгий): I — электрическая медь (после 15-й волны); II — чертёж форсажа («Воздушный бой», не
// тратится) + слитки метеоритного железа; III — + небесный кристалл.
// Старые рецепты этих самолётов убраны по id — tools/vahta_recipes.py не переносит их в миксер (10_machine_recipes.js).
// Правило Rhino: только var.
// ==========================================================================

var NS_AV_LIC = { 3: 'nightshift:pilot_license_3', 2: 'nightshift:pilot_license_2', 1: 'nightshift:pilot_license_1' }

// ингредиент JSON: '#тег' → {tag}, иначе {item}
function nsAvIng(x) {
	return x.charAt(0) === '#' ? { tag: x.substring(1) } : { item: x }
}

// Сборка по шагам. steps: ['предмет'] — деплоер, ['предмет', true] — деплоер, предмет остаётся в руке,
// ['press'] — пресс. Один круг (loops 1): шаги и так перечисляют всё, что ставится.
function nsAvSeq(event, id, input, output, part, steps) {
	var seq = []
	for (var i = 0; i < steps.length; i++) {
		var s = steps[i]
		if (s[0] === 'press') {
			seq.push({ type: 'create:pressing', ingredients: [{ item: part }], results: [{ id: part }] })
			continue
		}
		var step = { type: 'create:deploying', ingredients: [{ item: part }, nsAvIng(s[0])], results: [{ id: part }] }
		if (s[1]) step.keep_held_item = true
		seq.push(step)
	}
	event
		.custom({
			type: 'create:sequenced_assembly',
			ingredient: nsAvIng(input),
			loops: 1,
			results: [{ id: output }],
			sequence: seq,
			transitional_item: { id: part },
		})
		.id(id)
}

ServerEvents.recipes(function (event) {
	var UP = 'axiomativ:incomplete_aircraft_upgrade' // полуфабрикат улучшений (аддон)
	var AV = 'nightshift:incomplete_avionics' // полуфабрикат самолётов и аэрофотоаппарата
	var EC = 'nightshift:electric_copper'
	var PM = 'create:precision_mechanism'
	var BP = 'nightshift:afterburner_blueprint'
	var MI = 'nightshift:meteor_iron_ingot'

	// ---------- улучшения самолётов (аддон Axiomativ Industries 0.6.0) ----------
	nsAvSeq(event, 'nightshift:aviation/afterburner_1', 'immersive_aircraft:engine', 'axiomativ:afterburner_1', UP, [
		[EC], ['minecraft:blaze_rod'], [PM], ['press'], [NS_AV_LIC[3], true]
	])
	nsAvSeq(event, 'nightshift:aviation/afterburner_2', 'axiomativ:afterburner_1', 'axiomativ:afterburner_2', UP, [
		[MI], [MI], [BP, true], [PM], [NS_AV_LIC[2], true]
	])
	nsAvSeq(event, 'nightshift:aviation/afterburner_3', 'axiomativ:afterburner_2', 'axiomativ:afterburner_3', UP, [
		['nightshift:sky_crystal'], [MI], [EC], [BP, true], ['press'], [NS_AV_LIC[1], true]
	])
	nsAvSeq(event, 'nightshift:aviation/armored_hull', 'immersive_aircraft:hull_reinforcement', 'axiomativ:armored_hull', UP, [
		['create:sturdy_sheet'], ['#c:plates/steel'], ['create:sturdy_sheet'], ['press'], [NS_AV_LIC[3], true]
	])
	nsAvSeq(event, 'nightshift:aviation/fuel_economizer', 'immersive_aircraft:industrial_gears', 'axiomativ:fuel_economizer', UP, [
		[PM], ['create:fluid_pipe'], [EC], [NS_AV_LIC[3], true]
	])

	// ---------- ангар-док: механические крафтеры (без удостоверения; ток — с 15-й волны) ----------
	event.recipes.create.mechanical_crafting('axiomativ:hangar_dock', ['PPP', 'EBE', 'CMC'], {
		P: nsIng('#c:plates/iron'),
		E: EC,
		B: 'immersive_aircraft:boiler',
		C: 'create:andesite_casing',
		M: PM,
	}).id('nightshift:aviation/hangar_dock')

	// ---------- аэрофотоаппарат и плёнка ----------
	nsAvSeq(event, 'nightshift:aviation/aerial_camera', 'create:brass_casing', 'nightshift:aerial_camera', AV, [
		['minecraft:spyglass'], ['create:electron_tube'], [PM], [NS_AV_LIC[3], true]
	])
	event.recipes.create.mixing('6x nightshift:aerial_film', ['3x minecraft:paper', 'minecraft:black_dye', 'minecraft:slime_ball'])
		.id('nightshift:aviation/aerial_film')

	// ---------- самолёты по удостоверениям ----------
	event.remove({ id: 'immersive_aircraft:cargo_airship' })
	event.remove({ id: 'immersive_aircraft:bamboo_hopper' })
	event.remove({ id: 'immersive_aircraft:warship' })
	event.remove({ id: 'man_of_many_planes:economy_plane' })
	event.remove({ id: 'man_of_many_planes:scarlet_biplane' })
	event.remove({ id: 'create_recipes:mechanical_crafting/economy_plane' })
	event.remove({ id: 'create_recipes:mechanical_crafting/scarlet_biplane' })

	var H = 'immersive_aircraft:hull',
		E = 'immersive_aircraft:engine',
		S = 'immersive_aircraft:sail',
		P = 'immersive_aircraft:propeller',
		G = 'immersive_aircraft:industrial_gears'
	// Пилот III
	nsAvSeq(event, 'nightshift:aviation/cargo_airship', 'immersive_aircraft:airship', 'immersive_aircraft:cargo_airship', AV, [
		['minecraft:chest'], ['minecraft:chest'], [H], ['minecraft:chest'], ['minecraft:chest'], [NS_AV_LIC[3], true]
	])
	nsAvSeq(event, 'nightshift:aviation/economy_plane', H, 'man_of_many_planes:economy_plane', AV, [
		[E], [G], [H], [H], [P], [P], [S], [S], [NS_AV_LIC[3], true]
	])
	// Пилот II
	nsAvSeq(event, 'nightshift:aviation/bamboo_hopper', 'immersive_aircraft:biplane', 'immersive_aircraft:bamboo_hopper', AV, [
		['immersive_aircraft:biplane'], [E], [H], ['minecraft:bamboo_block'], ['minecraft:bamboo_block'], ['minecraft:bamboo_block'], [NS_AV_LIC[2], true]
	])
	nsAvSeq(event, 'nightshift:aviation/scarlet_biplane', 'immersive_aircraft:biplane', 'man_of_many_planes:scarlet_biplane', AV, [
		['immersive_aircraft:hull_reinforcement'], [H], [P], ['create:iron_sheet'], ['create:iron_sheet'], [NS_AV_LIC[2], true]
	])
	// Пилот I
	nsAvSeq(event, 'nightshift:aviation/warship', 'immersive_aircraft:cargo_airship', 'immersive_aircraft:warship', AV, [
		[E], [E], [H], [H], [H], [G], [S], [S], [NS_AV_LIC[1], true]
	])
})
