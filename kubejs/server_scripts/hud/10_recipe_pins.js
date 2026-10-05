// ==========================================================================
// Закреп рецептов — теперь «Планшет инженера» в аддоне Axiomativ Industries 0.7.0 (05.10.2026).
// Старый список на боковой панели скорборда, Shift + F и клавиша P из client_scripts убраны:
//   - J — планшет: поиск предметов, цели, цепочка до сырья, у каждого шага машина;
//   - P над предметом в JEI, инвентаре, сундуке — закрепить себе (до 3 целей), Shift + P — «цель смены» для всех;
//   - Shift + ПКМ пустой рукой по машине (миксер, чаша, пресс, деплоер, крафтер, пила, экструдер…) — что она делает;
//   - панель справа сверху: у каждой цели «▶ СЕЙЧАС» — что можно сделать прямо сейчас из того, что в кармане;
//     Shift + J — подробно / кратко / скрыта.
// Команды /pin [N], /pin team [N], /unpin, /unpin team, /tablet — тоже в аддоне (Java), здесь их больше нет.
// Этот файл: убирает старую боковую панель, переносит старый общий список в «цель смены», один раз подсказывает.
// KubeJS 2101 / Rhino: только var.
// ==========================================================================

var NS_TABLET = null
try {
	NS_TABLET = Java.loadClass('com.axiomativ.industries.content.tablet.TabletNet')
} catch (e) {
	console.warn('[nightshift] планшет: аддон Axiomativ Industries 0.7.0 не найден — закрепа рецептов нет: ' + e)
}

ServerEvents.loaded(event => {
	var server = event.server
	// старая боковая панель «Собрать: …» — убрать у всех
	server.runCommandSilent('scoreboard objectives remove nspin')
	var pd = server.persistentData
	if (!pd.contains('nightshift_pins')) return
	// старый общий список (до 4 предметов) → первая строка становится «целью смены»
	try {
		var old = JSON.parse(pd.getString('nightshift_pins'))
		if (NS_TABLET && old && old.length > 0 && old[0].id) NS_TABLET.setGoal(server, String(old[0].id), Math.max(1, old[0].n || 1), '')
	} catch (e) {
		console.warn('[nightshift] планшет: старый список закрепов не перенесён: ' + e)
	}
	pd.remove('nightshift_pins')
})

// один раз каждому: где теперь закреп и цепочки
PlayerEvents.loggedIn(event => {
	var p = event.getPlayer()
	if (!NS_TABLET || p.persistentData.getBoolean('ns_tablet_hint1')) return
	p.persistentData.putBoolean('ns_tablet_hint1', true)
	p.tell(Text.gold('[Новое] Планшет инженера: ').append(Text.yellow('J'))
		.append(Text.gold(' — поиск и цепочка до сырья, у каждого шага машина. '))
		.append(Text.yellow('P')).append(Text.gold(' над предметом в JEI — закрепить (справа сверху «▶ СЕЙЧАС» — что делать прямо сейчас), '))
		.append(Text.yellow('Shift + P')).append(Text.gold(' — цель смены для всех, '))
		.append(Text.yellow('Shift + ПКМ')).append(Text.gold(' пустой рукой по машине — что она делает. Клавиши — в «Управлении», раздел «Планшет инженера».')))
})
