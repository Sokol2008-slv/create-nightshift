// ==========================================================================
// Окно-список (15.10, «меньше чата, больше окон») — общее окно аддона Axiomativ Industries вместо стены строк в чате:
// заголовок, страницы-вкладки, разделы, строки «команда — что делает»; клик по строке выполняет команду или вставляет
// её в чат. Первым им пользуется /smena (hud/30_help.js); годится для любого чат-вывода.
//   nsListOpen(игрок, данные) — открыть; false — окна нет (старый jar, клиент без аддона): пиши в чат как раньше.
// Схема данных — в шапке content/listmenu/ListMenu.java аддона:
//   { id, title, sub?, page?, hint?, pages: [{key, title, hint?, note?, sections: [{title, rows: [{k, t, cmd?,
//     act?: 'run'|'suggest', tip?}]}]}], foot?: [{t, cmd, act?, tip?}] }
// KubeJS 2101 / Rhino: только var; Java-класс — в try (старый jar — запасной путь).
// ==========================================================================
var NS_LIST_API = null
try {
	NS_LIST_API = Java.loadClass('com.axiomativ.industries.content.listmenu.ListMenu')
} catch (e) {
	console.info('[окно-список] аддона с окном-списком нет — списки в чат')
}

function nsListOpen(player, data) {
	if (!NS_LIST_API || !player) return false
	try {
		return !!NS_LIST_API.open(player, JSON.stringify(data))
	} catch (e) {
		console.warn('[окно-список] не открыто: ' + e)
		return false
	}
}
