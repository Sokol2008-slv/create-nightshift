// ==========================================================================
// Выгрузка всех предметов для tools/emc_lock_create.py (нулевые цены EMC технике Create).
// /emc_dump_items — операторам; пишет kubejs/items_dump.json в папке сервера: id, ресурсный тег
// (слиток, самородок, блок металла, руда, сырьё, пыль, самоцвет), стройблочный тег (камень, дерево).
// ==========================================================================
var NS_EMC_RES_TAGS = ['c:ingots', 'c:nuggets', 'c:ores', 'c:raw_materials', 'c:gems', 'c:storage_blocks', 'c:dusts', 'c:obsidians']
var NS_EMC_BUILD_TAGS = ['minecraft:planks', 'minecraft:logs', 'c:stones', 'c:cobblestones', 'minecraft:base_stone_overworld']

function nsEmcTagIds(tag) {
	var o = {}
	var a = Ingredient.of('#' + tag).getStackArray()
	for (var i = 0; i < a.length; i++) o[String(a[i].getId())] = true
	return o
}

ServerEvents.commandRegistry(event => {
	event.register(
		event.commands.literal('emc_dump_items')
			.requires(s => s.hasPermission(2))
			.executes(ctx => {
				var REG = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').ITEM
				var res = {},
					build = {}
				NS_EMC_RES_TAGS.forEach(t => {
					var o = nsEmcTagIds(t)
					for (var k in o) res[k] = t
				})
				NS_EMC_BUILD_TAGS.forEach(t => {
					var o = nsEmcTagIds(t)
					for (var k in o) build[k] = t
				})
				var out = []
				REG.forEach(item => {
					var id = String(REG.getKey(item))
					out.push({ id: id, res: res[id] || '', build: build[id] || '' })
				})
				JsonIO.write('kubejs/items_dump.json', { items: out })
				ctx.source.sendSystemMessage(Text.gold('[emc] выгружено предметов: ' + out.length + ' → kubejs/items_dump.json'))
				return 1
			})
	)
})
