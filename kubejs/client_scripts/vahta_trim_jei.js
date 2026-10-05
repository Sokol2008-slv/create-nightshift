// Отделка брони на «Вахте» (vahta/25_smithing.js): кузнечный стол закрыт — подсказка на шаблонах
RecipeViewerEvents.addInformation('item', function (event) {
	var pats = ['sentry', 'dune', 'coast', 'wild', 'ward', 'eye', 'vex', 'tide', 'snout', 'rib', 'spire', 'wayfinder', 'shaper', 'silence', 'raiser', 'host', 'flow', 'bolt']
	var ids = []
	for (var i = 0; i < pats.length; i++) ids.push('minecraft:' + pats[i] + '_armor_trim_smithing_template')
	event.add(ids, [
		'Отделка брони на вахте — механическими крафтерами: три в ряд «шаблон | броня | материал».',
		'Материал задаёт цвет: железо, медь, золото, лазурит, изумруд, алмаз, незерит, редстоун, аметист, кварц.',
		'Подходит любая броня с отделкой (и незеритовая), чары и износ сохраняются. Шаблон тратится, как на кузнечном столе.',
		'Копия шаблона — крафтерами: 7 алмазов + шаблон + основа шаблона.'
	])
})
