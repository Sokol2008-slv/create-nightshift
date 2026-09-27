// ==========================================================================
// Клавиша P в любом окне (JEI: поиск, закладки, рецепты; книга квестов; инвентарь, сундук):
// предмет под мышью закрепляется — справа у всех список деталей и сырья (сервер: /pin item).
// Если курсор в поле ввода (поиск JEI, чат, наковальня) — P печатается как обычно.
// KubeJS 2101 / Rhino: только var.
// ==========================================================================

var PINK_EVENT = Java.loadClass('net.neoforged.neoforge.client.event.ScreenEvent$KeyPressed$Pre')
var PINK_MC = Java.loadClass('net.minecraft.client.Minecraft')
var PINK_EDITBOX = Java.loadClass('net.minecraft.client.gui.components.EditBox')
var PINK_CONTAINER = Java.loadClass('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')
var PINK_KEY_P = 80 // GLFW_KEY_P

var PINK_JEI = null
var PINK_VT = null
try {
	PINK_JEI = Java.loadClass('mezz.jei.common.Internal')
	PINK_VT = Java.loadClass('mezz.jei.api.constants.VanillaTypes')
} catch (e) {}

function pinkStack(o) {
	if (o === null || o === undefined) return null
	try {
		if (o.isPresent !== undefined) o = o.isPresent() ? o.get() : null
	} catch (e) {}
	if (o === null || o === undefined) return null
	try {
		if (o.isEmpty && !o.isEmpty() && o.getItem) return o
	} catch (e) {}
	return null
}

// Предмет под мышью: JEI (список, закладки, окно рецептов, любые экраны через помощник JEI), затем слот окна
function pinkUnderMouse(screen, mx, my) {
	if (PINK_JEI) {
		try {
			var ort = PINK_JEI.getOptionalJeiRuntime()
			if (ort.isPresent()) {
				var rt = ort.get()
				var list = rt.getIngredientListOverlay()
				if (list.hasKeyboardFocus()) return 'typing'
				var s = pinkStack(list.getIngredientUnderMouse(PINK_VT.ITEM_STACK))
				if (!s) s = pinkStack(rt.getBookmarkOverlay().getItemStackUnderMouse())
				if (!s) s = pinkStack(rt.getRecipesGui().getIngredientUnderMouse(PINK_VT.ITEM_STACK))
				if (!s) {
					var arr = rt.getScreenHelper().getClickableIngredientUnderMouse(screen, mx, my).toArray()
					for (var i = 0; i < arr.length && !s; i++) s = pinkStack(arr[i].getTypedIngredient().getItemStack())
				}
				if (s) return s
			}
		} catch (e) {
			console.warn('[pin] JEI: ' + e)
		}
	}
	try {
		if (screen instanceof PINK_CONTAINER) {
			var slot = screen.getSlotUnderMouse()
			if (slot && slot.hasItem()) return slot.getItem()
		}
	} catch (e) {}
	return null
}

NativeEvents.onEvent(PINK_EVENT, event => {
	if (event.getKeyCode() !== PINK_KEY_P) return
	var screen = event.getScreen()
	var focused = screen.getFocused()
	if (focused && focused instanceof PINK_EDITBOX) return
	var mc = PINK_MC.getInstance()
	if (!mc.player) return
	var win = mc.getWindow()
	var mx = (mc.mouseHandler.xpos() * win.getGuiScaledWidth()) / win.getScreenWidth()
	var my = (mc.mouseHandler.ypos() * win.getGuiScaledHeight()) / win.getScreenHeight()
	var st = pinkUnderMouse(screen, mx, my)
	if (st === null || st === 'typing') return
	var id
	try {
		id = String(st.getId())
	} catch (e) {
		id = String(st.getItem().builtInRegistryHolder().key().location())
	}
	mc.player.connection.sendCommand('pin item "' + id + '"')
	event.setCanceled(true)
})
