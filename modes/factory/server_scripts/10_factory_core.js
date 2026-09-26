// ==========================================================================
// «Завод: вал» — состояние, машинная, рудные точки, биржа, защита блоков.
// Состояние — JSON в persistentData сервера (ключ factory_json).
// ==========================================================================

var FSERVER = null
try {
	FSERVER = Java.loadClass('net.neoforged.neoforge.server.ServerLifecycleHooks').getCurrentServer() || null
} catch (e) {}
var FSacc = {} // дробные остатки выдачи руды, в памяти
var FSbuildAt = -1

function fsDefault() {
	var ores = {}
	for (var i = 0; i < FS.ORES.length; i++) ores[FS.ORES[i].key] = FS.ORES[i].unlock > 0 ? 0 : 1
	return { credits: 0, earned: 0, shaft: 0, ores: ores, built: false }
}

function fsState() {
	if (!FSERVER) return fsDefault()
	var pd = FSERVER.persistentData
	if (!pd.contains('factory_json')) return fsDefault()
	try {
		var s = JSON.parse(pd.getString('factory_json'))
		var d = fsDefault()
		for (var k in d) if (s[k] === undefined) s[k] = d[k]
		for (var o in d.ores) if (s.ores[o] === undefined) s.ores[o] = d.ores[o]
		return s
	} catch (e) {
		return fsDefault()
	}
}

function fsSave(s) {
	FSERVER.persistentData.putString('factory_json', JSON.stringify(s))
}

function fsCmd(c) {
	FSERVER.runCommandSilent(c)
}

function fsFmt(n) {
	return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function fsShaftStats(t) {
	var T = FS.SHAFT_TIERS[t]
	return { motors: T.motors, rpm: T.rpm, su: T.motors * T.rpm * FS.SU_PER_RPM }
}

function fsOre(key) {
	for (var i = 0; i < FS.ORES.length; i++) if (FS.ORES[i].key === key) return FS.ORES[i]
	return null
}

// --------------------------------------------------------------------------
// Машинная: бедроковая коробка, в ней линия редукторов с валами, под каждым
// редуктором — творческий мотор. Вал выходит сквозь стену на (-5,-56,0).
// Соседние моторы крутят в разные стороны: редуктор разворачивает вращение.
// --------------------------------------------------------------------------
function fsBuildRoom() {
	var R = FS.ROOM
	fsCmd('fill ' + R.x1 + ' ' + R.y1 + ' ' + R.z1 + ' ' + R.x2 + ' ' + R.y2 + ' ' + R.z2 + ' minecraft:bedrock hollow')
	fsCmd('fill -6 ' + FS.GROUND + ' -4 -6 ' + (FS.GROUND + 5) + ' 4 minecraft:bedrock')
	var y = FS.SHAFT_Y
	for (var i = 0; i < FS.GEARBOX_X.length; i++) {
		fsCmd('setblock ' + FS.GEARBOX_X[i] + ' ' + y + ' 0 create:gearbox[axis=z]')
		if (i < FS.GEARBOX_X.length - 1) fsCmd('setblock ' + (FS.GEARBOX_X[i] - 1) + ' ' + y + ' 0 create:shaft[axis=x]')
	}
	fsCmd('setblock -6 ' + y + ' 0 create:shaft[axis=x]')
	fsCmd('setblock ' + FS.OUTPUT[0] + ' ' + FS.OUTPUT[1] + ' ' + FS.OUTPUT[2] + ' create:shaft[axis=x]')
}

function fsSetMotors(tier) {
	var st = fsShaftStats(tier)
	var y = FS.SHAFT_Y - 1
	// сначала все моторы убрать (сеть встаёт), потом поставить новые с одной скоростью — без конфликта скоростей
	for (var i = 0; i < FS.GEARBOX_X.length; i++) fsCmd('setblock ' + FS.GEARBOX_X[i] + ' ' + y + ' 0 minecraft:air')
	for (var j = 0; j < st.motors; j++) {
		var speed = j % 2 === 0 ? st.rpm : -st.rpm
		fsCmd('setblock ' + FS.GEARBOX_X[j] + ' ' + y + ' 0 create:creative_motor[facing=up]{ScrollValue:' + speed + '}')
	}
}

// --------------------------------------------------------------------------
// Рудные точки и биржа — бочки с табличкой сверху
// --------------------------------------------------------------------------
function fsSignText(lines) {
	var m = []
	for (var i = 0; i < 4; i++) m.push("'" + JSON.stringify(lines[i] || '').replace(/'/g, "\\'") + "'")
	return '{front_text:{messages:[' + m.join(',') + ']}}'
}

function fsPlaceOre(o, tier) {
	var p = o.pos
	fsCmd('setblock ' + p[0] + ' ' + p[1] + ' ' + p[2] + ' minecraft:barrel[facing=up] keep')
	var line2 = tier > 0 ? 'ур. ' + tier + ' · ' + FS.ORE_RATES[tier] + '/с' : 'закрыто'
	fsCmd('setblock ' + p[0] + ' ' + (p[1] + 1) + ' ' + p[2] + ' minecraft:oak_sign' + fsSignText(['Руда: ' + o.name, line2, '/factory', 'прокачка']))
}

function fsPlaceMarket() {
	var p = FS.MARKET
	fsCmd('setblock ' + p[0] + ' ' + p[1] + ' ' + p[2] + ' minecraft:barrel[facing=up] keep')
	fsCmd('setblock ' + p[0] + ' ' + (p[1] + 1) + ' ' + p[2] + ' minecraft:oak_sign' + fsSignText(['БИРЖА', 'клади детали —', 'получишь кредиты', '/factory prices']))
}

function fsBuildAll() {
	var s = fsState()
	fsCmd('forceload add -26 -8 12 12')
	fsBuildRoom()
	fsSetMotors(s.shaft)
	for (var i = 0; i < FS.ORES.length; i++) fsPlaceOre(FS.ORES[i], s.ores[FS.ORES[i].key])
	fsPlaceMarket()
	fsCmd('setworldspawn ' + FS.SPAWN.join(' '))
	fsCmd('gamerule doDaylightCycle true')
	fsCmd('gamerule keepInventory true')
	s.built = true
	fsSave(s)
	console.info('[factory] карта собрана: вал ур. ' + s.shaft)
}

function fsBarrel(pos) {
	var level = FSERVER.getOverworld()
	var be = level.getBlock(pos[0], pos[1], pos[2]).getEntity()
	if (!be || be.getContainerSize === undefined) return null
	return be
}

// Кладёт n предметов id в бочку, возвращает сколько влезло
function fsInsert(pos, id, n) {
	var be = fsBarrel(pos)
	if (!be) return 0
	var left = n
	var size = be.getContainerSize()
	for (var i = 0; i < size && left > 0; i++) {
		var s = be.getItem(i)
		if (s.isEmpty()) {
			be.setItem(i, Item.of(id, left))
			left = 0
		} else if (String(s.getId()) === id && s.getCount() < s.getMaxStackSize()) {
			var add = Math.min(left, s.getMaxStackSize() - s.getCount())
			s.grow(add)
			left -= add
		}
	}
	be.setChanged()
	return n - left
}

function fsOresTick(s) {
	for (var i = 0; i < FS.ORES.length; i++) {
		var o = FS.ORES[i]
		var t = s.ores[o.key] || 0
		if (t <= 0) continue
		FSacc[o.key] = (FSacc[o.key] || 0) + FS.ORE_RATES[t]
		var n = Math.floor(FSacc[o.key])
		if (n > 0) {
			FSacc[o.key] -= n
			fsInsert(o.pos, o.item, n)
		}
	}
}

function fsMarketTick(s) {
	var be = fsBarrel(FS.MARKET)
	if (!be) return
	var total = 0
	var size = be.getContainerSize()
	for (var i = 0; i < size; i++) {
		var st = be.getItem(i)
		if (st.isEmpty()) continue
		var price = FS.PRICES[String(st.getId())]
		if (!price) continue
		total += price * st.getCount()
		be.removeItemNoUpdate(i)
	}
	if (total <= 0) return
	be.setChanged()
	s.credits += total
	s.earned += total
	fsSave(s)
	var p = FS.MARKET
	fsCmd('title @a[x=' + p[0] + ',y=' + p[1] + ',z=' + p[2] + ',distance=..24] actionbar ' + JSON.stringify({ text: 'Биржа: +' + fsFmt(total) + ' кр · на счету ' + fsFmt(s.credits), color: 'gold' }))
}

var FShudText = ''
function fsHud(s) {
	var st = fsShaftStats(s.shaft)
	var t = 'Кредиты: ' + fsFmt(s.credits) + ' · Вал ур. ' + s.shaft + ': ' + fsFmt(st.su) + ' SU, ' + st.rpm + ' об/мин'
	if (t === FShudText) return
	FShudText = t
	fsCmd('bossbar add factory:hud ""') // уже есть — команда ничего не сделает
	fsCmd('bossbar set factory:hud name ' + JSON.stringify({ text: t, color: 'gold' }))
	fsCmd('bossbar set factory:hud color yellow')
	fsCmd('bossbar set factory:hud max 1')
	fsCmd('bossbar set factory:hud value 1')
	fsCmd('bossbar set factory:hud players @a')
}

ServerEvents.loaded(event => {
	FSERVER = event.server
	FShudText = ''
	if (!fsState().built) FSbuildAt = event.server.getTickCount() + 60
})

var FStick = 0
ServerEvents.tick(event => {
	FSERVER = event.server
	FStick++
	if (FSbuildAt > 0 && event.server.getTickCount() >= FSbuildAt) {
		FSbuildAt = -1
		fsBuildAll()
	}
	if (FStick % 20 !== 0) return
	var s = fsState()
	if (!s.built) return
	fsOresTick(s)
	fsMarketTick(s)
	fsHud(fsState())
})

// Рудные точки, биржу и машинную в выживании не сломать
function fsProtected(x, y, z) {
	var R = FS.ROOM
	if (x >= R.x1 && x <= R.x2 && y >= R.y1 && y <= R.y2 + 1 && z >= R.z1 - 2 && z <= R.z2 + 2) return true
	if (x === FS.OUTPUT[0] && y === FS.OUTPUT[1] && z === FS.OUTPUT[2]) return false
	var pts = [FS.MARKET]
	for (var i = 0; i < FS.ORES.length; i++) pts.push(FS.ORES[i].pos)
	for (var j = 0; j < pts.length; j++) {
		var p = pts[j]
		if (x === p[0] && z === p[2] && (y === p[1] || y === p[1] + 1)) return true
	}
	return false
}

BlockEvents.broken(event => {
	var b = event.getBlock()
	var pl = event.getEntity()
	if (pl && pl.isPlayer() && pl.isCreative()) return
	if (!fsProtected(b.getX(), b.getY(), b.getZ())) return
	if (pl && pl.isPlayer()) pl.tell(Text.gray('[Завод] Это часть карты — не ломается.'))
	event.cancel()
})
