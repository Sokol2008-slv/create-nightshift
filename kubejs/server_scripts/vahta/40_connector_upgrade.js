// ==========================================================================
// «Вахта» — замена малого коннектора C&A на большой одним кликом (Георгий, 29.09:
// «лимиты снять только с крутых проводов… главное, чтобы провода менять было не сложно»).
//  - Малый коннектор (медный провод) — стартовый, 1 000 FE/т. Большой (золотой/электрумный) —
//    без лимита (config/createaddition-common.toml).
//  - Shift+ПКМ большим коннектором по малому: блок меняется на месте, все провода остаются,
//    малый коннектор возвращается в инвентарь.
//  - Сеть C&A — общий пул: поток ограничивают только коннекторы, где ток входит в сеть и выходит.
//    Промежуточные опоры линии менять не обязательно.
// Как устроено: узлы проводов лежат в данных блока (nodes). Перед заменой узлы у малого
// обнуляем — иначе при удалении он оборвёт провода у соседей, — ставим большой с теми же
// свойствами (грань, режим, поворот, вид) и возвращаем ему узлы. Тип провода не меняем:
// поток от него не зависит, а смена дала бы бесплатный обмен меди на золото при разборке.
// ==========================================================================
var NS_CONN_LIST_TAG = Java.loadClass('net.minecraft.nbt.ListTag')
var NS_CONN_REGISTRIES = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
var NS_CONN_RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
// малые: обычный и с подсветкой (id блока = id предмета)
var NS_CONN_SMALL = ['createaddition:connector', 'createaddition:small_light_connector']
var NS_CONN_LARGE = 'createaddition:large_connector'

// id малого коннектора, который сняли (его вернуть игроку), или null; level — ServerLevel, pos — BlockPos
function nsVahtaUpgradeConnector(level, pos) {
	var oldState = level.getBlockState(pos)
	var oldId = String(NS_CONN_REGISTRIES.BLOCK.getKey(oldState.getBlock()))
	if (NS_CONN_SMALL.indexOf(oldId) < 0) return null
	var be = level.getBlockEntity(pos)
	if (!be) return null
	var reg = level.registryAccess()
	var tag = be.saveWithoutMetadata(reg)
	var nodes = tag.getList('nodes', 10).copy()

	// 1) малый без узлов — при замене не оборвёт провода соседям
	var empty = tag.copy()
	empty.put('nodes', new NS_CONN_LIST_TAG())
	be.loadWithComponents(empty, reg)

	// 2) большой с теми же свойствами блока (у обоих FACING, MODE, ROTATION, VARIANT)
	var large = NS_CONN_REGISTRIES.BLOCK.get(NS_CONN_RL.parse(NS_CONN_LARGE))
	var state = large.defaultBlockState()
	var props = oldState.getProperties().toArray()
	for (var i = 0; i < props.length; i++) {
		if (state.hasProperty(props[i])) state = state.setValue(props[i], oldState.getValue(props[i]))
	}
	level.setBlock(pos, state, 3)

	// 3) узлы — новому блоку
	var nbe = level.getBlockEntity(pos)
	if (!nbe) return oldId
	var ntag = nbe.saveWithoutMetadata(reg)
	ntag.put('nodes', nodes)
	nbe.loadWithComponents(ntag, reg)
	nbe.setChanged()
	level.sendBlockUpdated(pos, state, state, 3)
	return oldId
}

BlockEvents.rightClicked(event => {
	if (NS_CONN_SMALL.indexOf(String(event.block.id)) < 0) return
	var player = event.player
	if (!player || !player.isShiftKeyDown()) return
	var held = event.item
	if (!held || held.isEmpty() || String(held.id) !== NS_CONN_LARGE) return
	var removed = nsVahtaUpgradeConnector(event.level, event.block.pos)
	if (!removed) return
	if (!player.isCreative()) held.shrink(1)
	player.give(removed)
	player.setStatusMessage(Text.gold('Коннектор заменён на большой — провода на месте'))
	event.level.playSound(null, event.block.pos, 'minecraft:block.copper.place', 'blocks', 1.0, 0.8)
	event.cancel()
})
