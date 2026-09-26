// ==========================================================================
// Ночная смена — бесконечные блоки: рецепты для тех обычных блоков, которые без них
// машинами не получить (tools/block_automation_audit.py). Остальное (гравий, песок, земля,
// черныт, туф, кальцит, лёд, незерак, эндерняк, базальт, обсидиан) уже делают моды сборки.
// ==========================================================================

ServerEvents.recipes(event => {
	// ил: промывка земли (вентилятор сквозь воду); из ила — прессованный ил и илистые кирпичи (ваниль)
	event.recipes.create.splashing('minecraft:mud', 'minecraft:dirt').id('nightshift:blocks/mud')
	// подзол и корневая земля — миксер
	event.recipes.create.mixing('minecraft:podzol', ['minecraft:dirt', '#minecraft:leaves', '#minecraft:leaves']).id('nightshift:blocks/podzol')
	event.recipes.create.mixing('minecraft:rooted_dirt', ['minecraft:dirt', 'minecraft:bone_meal', '#minecraft:saplings']).id('nightshift:blocks/rooted_dirt')
	// сталактиты: капельник на механическую пилу
	event.recipes.create.cutting('2x minecraft:pointed_dripstone', 'minecraft:dripstone_block').id('nightshift:blocks/pointed_dripstone')
	// аметист: кварц, окрашенный в миксере
	event.recipes.create.mixing('2x minecraft:amethyst_shard', ['#c:gems/quartz', '#c:gems/quartz', 'minecraft:purple_dye']).id('nightshift:blocks/amethyst_shard')
})
