// ==========================================================================
// Лимит покупок за EMC и конденсаторы (Георгий, 04.10; аддон axiomativ 0.5.0).
//  - Конденсаторы ProjectE mk1/mk2, Project Expansion mk3 и интерфейс трансмутации убраны
//    (server_scripts/economy/30_recipes.js) — прячем из JEI. Поставленные стоят, но не работают.
//  - На столе, планшетах и звене EMC — пояснение про лимит и выкуп (цифры — конфиг аддона по умолчанию).
// ==========================================================================
var NS_EMC_LIMIT_HIDE = [
	'projecte:condenser_mk1',
	'projecte:condenser_mk2',
	'projectexpansion:condenser_mk3',
	'projectexpansion:transmutation_interface',
]

RecipeViewerEvents.removeEntries('item', function (event) {
	for (var i = 0; i < NS_EMC_LIMIT_HIDE.length; i++) event.remove(NS_EMC_LIMIT_HIDE[i])
})

RecipeViewerEvents.addInformation('item', function (event) {
	var limit = [
		'Лимит покупок: не больше 64 штук каждого предмета за 5 минут — один счёт на весь сервер.',
		'Выкуп: что продал в EMC за последние 10 минут, покупается обратно без лимита.',
		'Сколько осталось и когда сброс — строка над хотбаром при покупке.',
	]
	event.add('projecte:transmutation_table', limit)
	event.add('projecte:transmutation_tablet', limit)
	event.add('projectexpansion:arcane_transmutation_tablet', limit.concat([
		'Сетка крафта докладывает недостающее за EMC — это тоже покупка, по тому же лимиту.',
	]))
	event.add('projectexpansion:basic_emc_link', [
		'Выдача предметов из EMC — по тому же лимиту, что у стола (общий счёт сервера). Жидкости звено не выдаёт.',
		'Приём предметов — продажа в EMC: открывает выкуп на 10 минут.',
	])
})
