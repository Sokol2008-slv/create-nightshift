// ==========================================================================
// Ночная смена — блоки для скримеров (команда /scare, server_scripts/scares/).
// «Глаз»: моргающая анимированная текстура (textures/block/watching_eye.png + .mcmeta),
// модель eye_glow светится в темноте (neoforge_data: block_light/sky_light 15).
// Без предмета и без дропа: в JEI его не видно, игроку его не достать.
// Неразрушаемый: /scare faces ставит его на 3–5 секунд и сам возвращает прежний блок.
// ==========================================================================

StartupEvents.registry('block', event => {
	event.create('nightshift:watching_eye')
		.parentModel('nightshift:block/eye_glow')
		.textures({ all: 'nightshift:block/watching_eye', particle: 'nightshift:block/watching_eye' })
		.soundType('slime_block')
		.unbreakable()
		.noItem()
		.noDrops()
		.noValidSpawns(true)
})
