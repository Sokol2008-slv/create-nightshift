// ==========================================================================
// «Развлечения смены» — рецепты (05.10.2026, поток T). Руками не крафтят: Маяк трассы — деплоер ставит ракету
// фейерверка на компас (любой полёт и состав ракеты). Ящик снабжения рецепта не имеет — только у снабженца.
// ==========================================================================
ServerEvents.recipes(event => {
	event
		.custom({
			type: 'create:deploying',
			ingredients: [{ item: 'minecraft:compass' }, { item: 'minecraft:firework_rocket' }],
			results: [{ id: 'nightshift:race_beacon' }],
		})
		.id('nightshift:zabava/race_beacon')
})
