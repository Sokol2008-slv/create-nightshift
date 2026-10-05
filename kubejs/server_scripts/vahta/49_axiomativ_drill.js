// ==========================================================================
// «Вахта» — буровая установка и умная пила аддона Axiomativ Industries 0.7.0.
//
// Буровая установка (axiomativ:drilling_rig) — высокая ступень форпоста: вышка 3×3 × 7 на месторождении
// (тег nightshift:outpost_deposits; в аддоне — axiomativ:drill_deposits, он ссылается на наш тег). Бурит тот же
// продукт, что экструдер с этим месторождением (рецепты create_mechanical_extruder:extruding из 80_outposts.js),
// но как 10 экструдеров на тех же оборотах: на 256 об/мин — 7,5 шт/с (450 в мин). Вал — в привод (середина
// основания со стороны игрока), нагрузка 48 SU на об/мин; ток 2 FE/т на об/мин — насос раствора, без тока
// вполсилы. Склад 9 ячеек: воронки/лотки с любой части основания. Цифры — в аддоне (DrillMath.java).
//  - Рецепт — механические крафтеры: электрическая медь (только после 15-й волны) + продукция трёх форпостов:
//    алюминиевые листы (Бокситовый карьер), радиаторы (Ледник), линза (Кварцевый карьер).
//  - Осада форпоста: буровая на месторождении входит в сеть форпостов, как экструдер (raids/46_outpost_siege.js).
//
// Умная пила: без фильтра пила Create делает только основной продукт (бревно → доски, доски → палки), формы
// (ступеньки, плиты, стены, двери, литейные формы) и камнерез — только с фильтром. Тег предметов
// axiomativ:saw_filter_only — «только по фильтру»: аддон кладёт туда ванильные формы, здесь — литейные формы
// пушек (NS_VAHTA_MOULDS из 20_recipes.js).
// Ручных рецептов у аддона нет. EMC 0 — config/ProjectE/custom_emc.json. Правило Rhino: только var.
// ==========================================================================
ServerEvents.recipes(function (event) {
	event.recipes.create.mechanical_crafting('axiomativ:drilling_rig', [
		'  P  ',
		' ALA ',
		' A A ',
		'RXDUR',
		'EBBBE'
	], {
		P: 'create:rope_pulley',               // кронблок и талевая система
		A: nsIng('#c:plates/aluminum'),        // вышка — Бокситовый карьер
		L: 'nightshift:lens',                  // прожекторы — Кварцевый карьер
		R: 'nightshift:radiator',              // охлаждение мотора лебёдки — Ледник
		X: 'create:precision_mechanism',       // лебёдка
		D: 'create:mechanical_drill',          // бур
		U: 'create:mechanical_pump',           // насос бурового раствора
		E: 'nightshift:electric_copper',       // проводка — только после 15-й волны
		B: 'create:brass_casing'               // основание
	}).id('nightshift:vahta/axiomativ/drilling_rig')
})

ServerEvents.tags('item', function (event) {
	// литейные формы — только по фильтру пилы (без фильтра пила их больше не режет)
	if (typeof NS_VAHTA_MOULDS !== 'undefined') {
		NS_VAHTA_MOULDS.forEach(function (m) {
			event.add('axiomativ:saw_filter_only', m[1])
		})
	}
})

// ---------- осада: буровая — тоже форпост ----------
if (typeof NS_OUTPOST_EXTRUDERS !== 'undefined') NS_OUTPOST_EXTRUDERS['axiomativ:drilling_rig'] = 1

// центр основания — на шаг «внутрь» от привода (сторона привода — facing)
function nsDrillCenterBelow(b) {
	var f = String(b.getProperties().get('facing'))
	var dx = f === 'east' ? -1 : f === 'west' ? 1 : 0
	var dz = f === 'south' ? -1 : f === 'north' ? 1 : 0
	return b.offset(dx, -1, dz)
}

BlockEvents.placed('axiomativ:drilling_rig', function (event) {
	try {
		if (typeof nsGetState === 'undefined' || typeof nsOutpostId === 'undefined') return
		var b = event.getBlock()
		var below = nsDrillCenterBelow(b)
		if (!below.hasTag('nightshift:outpost_deposits')) return
		var st = nsGetState()
		st.outposts = st.outposts || []
		var dim = String(b.getDimension())
		var id = nsOutpostId(dim, b.getX(), b.getY(), b.getZ())
		for (var i = 0; i < st.outposts.length; i++) if (st.outposts[i].id === id) return
		var o = { id: id, dim: dim, x: b.getX(), y: b.getY(), z: b.getZ(), deposit: String(below.getId()) }
		st.outposts.push(o)
		nsSaveState(st)
		nsTellAll(Text.aqua('[Ночная смена] Буровая на форпосте «' + nsOutpostName(o) + '» вошла в сеть (' + o.x + ', ' + o.z + '). ')
			.append(Text.gray('Орда может прийти и сюда — особые стадии «Осада форпоста».')))
	} catch (e) {
		console.error('[nightshift] буровая: ' + e)
	}
})
