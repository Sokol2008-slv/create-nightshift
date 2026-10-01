// ==========================================================================
// Ночная смена — магия в добыче набега (Iron's Spells 'n Spellbooks, 01.10).
// Грузится после 00_nightshift_config.js (по алфавиту) и дописывает строки в конец таблиц NSG.NIGHTSHIFT_LOOT:
// подсказка кнопки волны (30_nightshift_altar.js) показывает первые три строки обычной таблицы — их не трогаем.
//  - обычные броски: эссенция волшебства и чернила (ранние волны — эссенция и обычные, поздние — редкие/эпические);
//  - редкие: свиток со случайным заклинанием (таблица data/nightshift/loot_table/magic/wave_scroll.json, сильнее —
//    wave_scroll_strong.json с 6-го состава, волна 27+), пустые руны, сферы улучшения, чернила повыше;
//  - Кошмар (70+): сильный свиток и сфера маны.
// Строка ['loot:<таблица>', N] — выдача через /loot give <ник> loot <таблица>, N раз (поддержка — в nsGiveLoot).
// Редкость чернил по смыслу мода: обычные → необычные → редкие → эпические → легендарные.
// Правило Rhino: только var.
// ==========================================================================
var NS_MAGIC_SCROLL = ['loot:nightshift:magic/wave_scroll', 1]
var NS_MAGIC_SCROLL_STRONG = ['loot:nightshift:magic/wave_scroll_strong', 1]
var NS_MAGIC_LOOT = {
	common: {
		1: [['irons_spellbooks:arcane_essence', 2]],
		2: [['irons_spellbooks:arcane_essence', 3]],
		3: [['irons_spellbooks:common_ink', 2]],
		4: [['irons_spellbooks:arcane_essence', 6]],
		5: [['irons_spellbooks:uncommon_ink', 2]],
		6: [['irons_spellbooks:arcane_essence', 10]],
		7: [['irons_spellbooks:cinder_essence', 2]], // Пекло — пепельная эссенция, как с древних рыцарей Незера
		8: [['irons_spellbooks:rare_ink', 2]],
		9: [['irons_spellbooks:arcane_essence', 16]],
		10: [['irons_spellbooks:epic_ink', 1]],
	},
	rare: {
		1: [NS_MAGIC_SCROLL],
		2: [NS_MAGIC_SCROLL, ['irons_spellbooks:blank_rune', 1]],
		3: [NS_MAGIC_SCROLL, ['irons_spellbooks:uncommon_ink', 2]],
		4: [NS_MAGIC_SCROLL, ['irons_spellbooks:blank_rune', 2]],
		5: [NS_MAGIC_SCROLL, ['irons_spellbooks:rare_ink', 2]],
		6: [NS_MAGIC_SCROLL_STRONG, ['irons_spellbooks:upgrade_orb', 1]],
		7: [NS_MAGIC_SCROLL_STRONG, ['irons_spellbooks:cinder_essence', 6]],
		8: [NS_MAGIC_SCROLL_STRONG, ['irons_spellbooks:epic_ink', 1], ['irons_spellbooks:upgrade_orb', 1]],
		9: [NS_MAGIC_SCROLL_STRONG, ['irons_spellbooks:mana_upgrade_orb', 1]],
		10: [NS_MAGIC_SCROLL_STRONG, ['irons_spellbooks:legendary_ink', 1], ['irons_spellbooks:upgrade_orb', 2]],
	},
	nightmare: [
		{ minK: 1, e: NS_MAGIC_SCROLL_STRONG },
		{ minK: 3, e: ['irons_spellbooks:mana_upgrade_orb', 1] },
		{ minK: 5, e: ['irons_spellbooks:legendary_ink', 2] },
	],
}

;(function () {
	var L = NSG.NIGHTSHIFT_LOOT
	if (!L) {
		console.warn('[nightshift] магия в добыче: NSG.NIGHTSHIFT_LOOT нет — 00_nightshift_config.js не загрузился?')
		return
	}
	var added = 0
	var kinds = ['common', 'rare']
	for (var k = 0; k < kinds.length; k++) {
		var src = NS_MAGIC_LOOT[kinds[k]]
		for (var tier in src) {
			var dst = L[kinds[k]][tier]
			if (!dst) continue
			for (var i = 0; i < src[tier].length; i++) {
				dst.push(src[tier][i])
				added++
			}
		}
	}
	for (var n = 0; n < NS_MAGIC_LOOT.nightmare.length; n++) {
		L.nightmare.push(NS_MAGIC_LOOT.nightmare[n])
		added++
	}
	console.info('[nightshift] магия в добыче набега: добавлено строк ' + added)
})()
