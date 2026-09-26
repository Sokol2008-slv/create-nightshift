// Баланс набегов: угроза орды (HP × опасность × усиления) и EMC ProjectE добычи на одного игрока.
// Запуск: node tools/raid_balance.js — после любых правок волн и таблиц в raids/00_nightshift_config.js
var fs = require('fs')
var src = fs.readFileSync(require('path').join(__dirname, '..') + '/kubejs/server_scripts/raids/00_nightshift_config.js', 'utf8')
eval(src + ';global.NSG=NSG;')
var EMC = {
	'minecraft:oak_log': 32, 'minecraft:iron_ingot': 256, 'minecraft:copper_ingot': 128, 'minecraft:coal': 128, 'minecraft:bread': 72,
	'create:andesite_alloy': 40, 'create:zinc_ingot': 256, 'minecraft:gold_ingot': 2048, 'create:brass_ingot': 192, 'minecraft:experience_bottle': 64,
	'minecraft:redstone': 64, 'minecraft:lapis_lazuli': 864, 'minecraft:quartz': 256, 'tfmg:steel_ingot': 2048, 'tfmg:lead_ingot': 512,
	'tfmg:nickel_ingot': 1024, 'minecraft:diamond': 8192, 'create_new_age:thorium': 6144, 'minecraft:emerald': 16384, 'create:precision_mechanism': 3000,
	'minecraft:blaze_rod': 1536, 'minecraft:netherite_scrap': 12288, 'minecraft:ghast_tear': 4096, 'minecraft:magma_cream': 800, 'minecraft:breeze_rod': 2304,
	'minecraft:ender_pearl': 1024, 'minecraft:netherite_ingot': 57344, 'nightshift:sedative': 200, 'minecraft:golden_carrot': 1900, 'sophisticatedbackpacks:backpack': 800,
	'minecraft:name_tag': 192, 'nightshift:life_tonic': 400, 'sophisticatedbackpacks:iron_backpack': 3000, 'minecraft:saddle': 192, 'minecraft:golden_apple': 16500,
	'create:extendo_grip': 3000, 'sophisticatedbackpacks:gold_backpack': 20000, 'create:potato_cannon': 5000, 'minecraft:totem_of_undying': 30000,
	'sophisticatedbackpacks:diamond_backpack': 60000, 'minecraft:trident': 16398, 'create:wand_of_symmetry': 20000, 'minecraft:heavy_core': 40960,
	'minecraft:enchanted_golden_apple': 150000, 'sophisticatedbackpacks:netherite_backpack': 120000, 'minecraft:elytra': 300000, 'minecraft:nether_star': 139264,
	'nightshift:night_heart': 200000, 'minecraft:enchanted_book': 30000, 'minecraft:wither_skeleton_skull': 50000, 'minecraft:ancient_debris': 12288,
	'minecraft:heart_of_the_sea': 32768, 'minecraft:netherite_upgrade_smithing_template': 60000, 'minecraft:silence_armor_trim_smithing_template': 60000,
	'minecraft:netherite_sword': 120000, 'minecraft:netherite_chestplate': 160000, 'minecraft:netherite_pickaxe': 140000, 'minecraft:netherite_helmet': 140000,
	'minecraft:netherite_leggings': 150000, 'minecraft:netherite_boots': 140000, 'minecraft:beacon': 145000,
}
var PROBE = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..') + '/kubejs/data/nightshift/pe_custom_conversions/nightshift_probes.json', 'utf8')).values.before
PROBE.forEach(function (e) { EMC[e.id] = e.emc_value })
function val(e) { var id = e[2] || e[0]; var v = EMC[id]; if (v == null) { console.log('нет цены', id); v = 0 } return v * e[1] }
function avg(list) { var s = 0; list.forEach(function (e) { s += val(e) }); return s / list.length }
var DANGER = { phantom: 1.6, breeze: 1.6, evoker: 2.2, witch: 1.6, illusioner: 1.8, wither_skeleton: 1.5, piglin_brute: 2.0, ravager: 1.4, skeleton: 1.3, stray: 1.4, bogged: 1.3, pillager: 1.3, zoglin: 1.4, hoglin: 1.3, vindicator: 1.4, cave_spider: 1.3, drowned: 1.2, magma_cube: 1.1, mimic: 1.2 }
function mobThreat(m) {
	var id = m.id.split(':')[1], n = m.nbt || ''
	var t = (NSG.NIGHTSHIFT_MOB_HP[m.id] || 20) * (DANGER[id] || 1)
	if (n.indexOf('max_health",base:60') >= 0) t = 66
	if (n.indexOf('base:200') >= 0) t = 200 * 1.6 + 30 // всадник
	if (n.indexOf('netherite_chestplate') >= 0) t *= 2.5
	else if (n.indexOf('diamond_chestplate') >= 0) t *= 2.2
	else if (n.indexOf('iron_chestplate') >= 0) t *= 1.7
	else if (n.indexOf('chainmail_chestplate') >= 0) t *= 1.4
	else if (n.indexOf('leather_chestplate') >= 0) t *= 1.15
	if (n.indexOf('speed",amplifier:1') >= 0) t *= 1.3
	else if (n.indexOf('speed') >= 0) t *= 1.15
	if (n.indexOf('invisibility') >= 0) t *= 1.4
	if (n.indexOf('Size:3') >= 0) t = 16 * 1.3
	if (n.indexOf('power') >= 0) t *= 1.3
	if (n.indexOf('diamond_sword') >= 0 || n.indexOf('trident') >= 0 || n.indexOf('netherite_sword') >= 0) t *= 1.2
	return t
}
function buffMul(b) { b = b || {}; return [1, 1.25, 1.67, 2.5, 5][Math.round(b.resistance || 0)] * (1 + 0.15 * Math.round(b.strength || 0)) * (b.speed ? 1.15 : 1) }
var D = NSG.NIGHTSHIFT_DIFFICULTY, NM = NSG.NIGHTSHIFT_NIGHTMARE, L = NSG.NIGHTSHIFT_LOOT
function horde(d) {
	if (d <= 10) return D[d]
	var k = d - 10
	return { waves: D[10].waves.concat([NM.finale]), boss: D[10].boss, buff: D[10].buff, mult: 1 + NM.countPerLevel * k, scale: { hp: NM.hpPerLevel * k, damage: NM.damagePerLevel * k, speed: Math.min(NM.speedMax, NM.speedPerLevel * k) } }
}
var prev = null
console.log('сл | мобов | угроза | ×пред | бросков | EMC добычи | ×пред | EMC/угроза')
for (var d = 1; d <= 16; d++) {
	var h = horde(d), mobs = 0, thr = 0
	h.waves.forEach(function (w) { w.forEach(function (m) { var c = Math.max(m.count * (h.mult || 1), m.count < 1 ? 1 : 0); mobs += c; thr += c * mobThreat(m) }) })
	if (h.boss) thr += h.boss.hpLabel * 2.5
	thr *= buffMul(h.buff)
	if (h.scale) thr *= (1 + h.scale.hp) * (1 + 0.5 * h.scale.damage) * (1 + h.scale.speed)
	var tier = Math.min(10, d), k = Math.max(0, d - 10)
	var rolls = h.waves.length + (h.boss ? 2 : 0) + NM.rollsPerLevel * k
	var art = Math.min(1, (L.artifactChance[tier] || 0) + 0.04 * k) * 150000
	var leg = (L.legendaryChance + 0.006 * tier + 0.01 * k) * avg(L.legendary)
	var pool = L.nightmare.filter(function (x) { return x.minK <= k }).map(function (x) { return x.e })
	var nm = k > 0 ? (1 + Math.floor(k / 2)) * avg(pool) : 0
	var loot = rolls * (avg(L.common[tier]) + L.rareChance * avg(L.rare[tier])) + art + leg + nm
	console.log([d <= 10 ? d : 'К' + k, Math.round(mobs), Math.round(thr), prev ? (thr / prev.t).toFixed(2) : '-', rolls, Math.round(loot / 1000) + 'k', prev ? (loot / prev.l).toFixed(2) : '-', Math.round(loot / thr)].join(' | '))
	prev = { t: thr, l: loot }
}
