// ==========================================================================
// «Вахта» — машины своего аддона Axiomativ Industries (mods/axiomativ-*.jar, исходники:
// github.com/Sokol2008-slv/axiomativ-industries).
//  - Межпланетное точило собирается на механических крафтерах из металлов Марса и Меркурия:
//    ручного рецепта у аддона нет, так что это единственный путь.
//  - Рецепты самого точила (тип axiomativ:planetary_grinding) — здесь, через event.custom:
//    формат как у машин Create (ingredients — по одному предмету, results с шансом, processing_time).
// ==========================================================================
ServerEvents.recipes(event => {
	event.recipes.create.mechanical_crafting('axiomativ:planetary_grindstone', [
		' T ',
		'TMT',
		'PWP'
	], {
		T: 'northstar:titanium_sheet',
		M: 'create:millstone',
		P: 'create:precision_mechanism',
		W: 'northstar:tungsten_sheet'
	}).id('nightshift:vahta/axiomativ/planetary_grindstone')

	// Генератор щита (аддон 0.2.0): после космоса — межпланетный сплав, электрическая медь, маяк, аккумулятор
	event.recipes.create.mechanical_crafting('axiomativ:shield_generator', [
		'AEA',
		'EBE',
		'ACA'
	], {
		A: 'axiomativ:interplanetary_alloy',
		E: 'nightshift:electric_copper',
		B: 'minecraft:beacon',
		C: 'createaddition:modular_accumulator'
	}).id('nightshift:vahta/axiomativ/shield_generator')
})
