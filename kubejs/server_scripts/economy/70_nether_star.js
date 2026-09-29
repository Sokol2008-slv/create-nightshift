// ==========================================================================
// Звезда незера машиной — дорого, но без боя с визером (Георгий, 29.09: «крафт звезды дорогой, но возможный»).
// Миксер с сильным нагревом (горелка на торте блейза): 3 черепа визер-скелета + 4 песка душ (форма визера)
// + блок алмаза + 1000 мБ лавы. Черепа — механический спавнер на жидкости визер-скелета и убийство машинами.
// Звезда без цены EMC (config/ProjectE/custom_emc.json, tools/emc_lock_create.py MANUAL_ZERO): заводом звёзд
// деньги не печатаются.
// ==========================================================================
ServerEvents.recipes(event => {
	event.recipes.create
		.mixing('minecraft:nether_star', ['3x minecraft:wither_skeleton_skull', '4x minecraft:soul_sand', 'minecraft:diamond_block', Fluid.of('minecraft:lava', 1000)])
		.superheated()
		.id('nightshift:economy/nether_star')
})
