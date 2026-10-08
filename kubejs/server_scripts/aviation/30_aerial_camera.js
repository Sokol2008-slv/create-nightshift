// ==========================================================================
// Ночная смена — АЭРОФОТОАППАРАТ и атлас жил (04.10.2026, поток D; Георгий: «аэрофотоаппарат — только ради жил»).
//
// В полёте на самолёте Immersive Aircraft выше y 150 аппарат снимает чанки под самолётом и находит жилы Create Ore
// Excavation (тем же способом, что сканер жил: OreDataAttachment чанка, economy/20_scanner.js). Ничего, кроме жил,
// не показывает.
//  - Как снимать: держать аппарат в руке (любой) или положить в багажник самолёта. Снимок — сам, как только самолёт
//    пролетел 0,8 ширины кадра от прошлого снимка (полосы без дыр); ПКМ аппаратом — снимок сразу. Не чаще раза в 2 с.
//  - Расход: 1 аэрофотоплёнка за снимок (из инвентаря игрока, потом из багажника). В творческом режиме — даром.
//  - Охват: 7×7 чанков на высоте 150+, 9×9 на 200+, 11×11 на 250+. Только загруженные чанки (под самолётом они есть).
//  - Новые жилы: путевые точки Xaero — строка «xaero-waypoint:…» в чате, мод показывает её как «[Добавить]»;
//    и запись в общий атлас сервера (команда /veins [тип] — ближайшие известные жилы и точки к ним).
//  - Окно атласа (08.10): вкладка «Жилы» — все снятые жилы измерения на карте (nsCamAtlasMenu); /veins открывает её.
// Правило Rhino: только var. Состояние атласа — server.persistentData 'ns_vein_atlas' (JSON).
// ==========================================================================

var NS_CAM_ORE = Java.loadClass('com.tom.createores.OreDataAttachment')
var NS_CAM_VEHICLE = Java.loadClass('immersive_aircraft.entity.VehicleEntity')
var NS_CAM_INV_VEHICLE = Java.loadClass('immersive_aircraft.entity.InventoryVehicleEntity')
var NS_CAM_HEIGHTMAP = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
var NS_CAM_ITEM = 'nightshift:aerial_camera'
var NS_CAM_FILM = 'nightshift:aerial_film'
var NS_CAM_MIN_Y = 150
var NS_CAM_COOLDOWN = 40 // тиков между снимками (2 с)
var NS_CAM_MOVE = 0.8 // пассивный снимок — когда пролетел 0,8 ширины кадра (жилы редки: кадры идут полосой без дыр)
var NS_CAM_SHOW = 6 // путевых точек за снимок (ближайшие новые)
var NS_CAM_ATLAS_MAX = 4000 // записей в атласе
var NS_CAM_CHECK = 10 // проверка пассивной съёмки раз в 0,5 с

// жилы: ключ (как в economy/10_probes.js) → имя, буква точки, цвет Xaero (0–15: 0 чёрный … 15 белый),
// цвет точки на карте окна атласа, значок (предмет из рецепта жилы)
var NS_CAM_VEINS = {
	coal: ['Уголь', 'У', 8, 0x8a8a8a, 'minecraft:coal'],
	copper: ['Медь', 'М', 6, 0xe0773a, 'minecraft:raw_copper'],
	iron: ['Железо', 'Ж', 7, 0xd8b79a, 'minecraft:raw_iron'],
	gold: ['Золото', 'З', 14, 0xffd700, 'minecraft:raw_gold'],
	zinc: ['Цинк', 'Ц', 3, 0x9fd0b8, 'create:raw_zinc'],
	redstone: ['Редстоун', 'Р', 12, 0xff2a2a, 'createoreexcavation:raw_redstone'],
	lapis: ['Лазурит', 'Л', 9, 0x3a62e8, 'minecraft:lapis_lazuli'],
	diamond: ['Алмазы', 'А', 11, 0x4fe8e0, 'createoreexcavation:raw_diamond'],
	emerald: ['Изумруды', 'И', 10, 0x30d060, 'createoreexcavation:raw_emerald'],
	quartz: ['Кварц', 'К', 15, 0xf0e8e0, 'minecraft:quartz'],
	glowstone: ['Светокамень', 'С', 14, 0xffc040, 'minecraft:glowstone_dust'],
	netherite: ['Незерит', 'Н', 5, 0xa0706a, 'minecraft:ancient_debris'],
	nether_gold: ['Незерское золото', 'НЗ', 14, 0xf0b030, 'minecraft:gold_nugget'],
	hardened_diamond: ['Твёрдые алмазы', 'ТА', 11, 0xb8f4ff, 'createoreexcavation:raw_diamond'],
	lead: ['Свинец', 'Св', 1, 0x7a7ab0, 'tfmg:raw_lead'],
	nickel: ['Никель', 'Ни', 2, 0xc8c890, 'tfmg:raw_nickel'],
	lithium: ['Литий', 'Ли', 13, 0xf0a0f0, 'tfmg:raw_lithium'],
	sulfur: ['Сера', 'Се', 14, 0xe8e040, 'tfmg:sulfur'],
	platinum: ['Платина', 'Пл', 15, 0xdfe8f2, 'createpropulsion:raw_platinum'],
	thorium: ['Торий', 'То', 10, 0x9ccc65, 'create_new_age:thorium'],
	titanium: ['Титан', 'Ти', 7, 0xb0c0d0, 'northstar:raw_titanium_ore'],
	tungsten: ['Вольфрам', 'В', 8, 0x8890a8, 'northstar:raw_tungsten_ore'],
	martian_iron: ['Марсианское железо', 'МЖ', 4, 0xc0502a, 'northstar:raw_martian_iron_ore'],
	water: ['Вода', 'Вд', 9, 0x3f8cff, 'minecraft:water_bucket'],
}

// Окно атласа, вкладка «Жилы»: какие жилы родятся в измерении (biomeWhitelist рецептов жил Create Ore Excavation и
// kubejs/data/nightshift/recipe/ore_vein_type) и насколько редки (шаг сетки жил: 128 — частая, 192–256 — редкая,
// 384–512 — очень редкая)
var NS_CAM_DIM_VEINS = {
	'minecraft:overworld': ['coal', 'copper', 'iron', 'gold', 'zinc', 'redstone', 'lapis', 'diamond', 'emerald', 'hardened_diamond', 'lead', 'nickel', 'lithium', 'platinum', 'thorium', 'water'],
	'minecraft:the_nether': ['quartz', 'glowstone', 'nether_gold', 'netherite', 'sulfur'],
	'northstar:moon': ['titanium'],
	'northstar:mars': ['martian_iron', 'titanium'],
	'northstar:mercury': ['tungsten', 'titanium'],
	'northstar:venus': ['titanium'],
}
var NS_CAM_RARE = { diamond: 2, emerald: 2, lithium: 2, platinum: 2, tungsten: 2, nether_gold: 2, thorium: 3, hardened_diamond: 3, netherite: 3 }
var NS_CAM_RARE_TEXT = [
	null,
	['частая', 'хватит облететь окрестности базы — жила частая.'],
	['редкая — облетай шире', 'облетай шире, полосами — жила редкая.'],
	['очень редкая — дальний облёт', 'нужны дальние облёты — жила очень редкая.'],
]
var NS_CAM_MENU_MAX = 2500 // точек жил в окне (ближайшие)

var nsCamMem = {} // имя → {t: тик прошлого снимка, x, z, hint}
var nsCamTick = 0

// ключ жилы по id рецепта жилы (NS_VEINS — economy/10_probes.js); незнакомая — последний кусок id
function nsCamVeinKey(recipeId) {
	try {
		for (var k in NS_VEINS) if (NS_VEINS[k].vein === recipeId) return k
	} catch (e) {}
	var s = String(recipeId)
	return s.substring(s.lastIndexOf('/') + 1)
}

function nsCamVeinInfo(key) {
	return NS_CAM_VEINS[key] || [key, key.substring(0, 1).toUpperCase(), 7, 0xa8a29a, '']
}

function nsCamRadius(y) {
	return y >= 250 ? 5 : y >= 200 ? 4 : 3
}

function nsCamCompass(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI
	if (ang < 0) ang += 360
	var dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']
	return dirs[Math.round(ang / 45) % 8]
}

// строка Xaero: xaero-waypoint:Имя:Буква:x:y:z:цвет:false:0[:Internal-<измерение>-waypoints]
// (формат — xaero.hud.minimap.waypoint.WaypointSharingHandler 26.5.0; для своих измерений без последней части —
// тогда точка ложится в текущее измерение игрока)
function nsCamWaypoint(name, initials, x, y, z, color, dim) {
	var s = 'xaero-waypoint:' + name + ':' + initials + ':' + x + ':' + y + ':' + z + ':' + color + ':false:0'
	var vanilla = { 'minecraft:overworld': 'overworld', 'minecraft:the_nether': 'the_nether', 'minecraft:the_end': 'the_end' }
	if (vanilla[dim]) s += ':Internal-' + vanilla[dim] + '-waypoints'
	return s
}

function nsCamAtlasLoad(server) {
	try {
		var raw = server.persistentData.getString('ns_vein_atlas')
		if (raw) return JSON.parse(String(raw))
	} catch (e) {}
	return {}
}

function nsCamAtlasSave(server, atlas) {
	server.persistentData.putString('ns_vein_atlas', JSON.stringify(atlas))
}

// убрать 1 плёнку: из инвентаря игрока, иначе из багажника самолёта. false — плёнки нет.
function nsCamTakeFilm(p, v) {
	if (p.isCreative()) return true
	try {
		var inv = p.getInventory()
		for (var i = 0; i < inv.getContainerSize(); i++) {
			var st = inv.getItem(i)
			if (String(st.getId()) === NS_CAM_FILM) {
				st.shrink(1)
				inv.setChanged()
				return true
			}
		}
	} catch (e) {}
	try {
		if (v instanceof NS_CAM_INV_VEHICLE) {
			var c = v.getInventory()
			for (var j = 0; j < c.getContainerSize(); j++) {
				var s2 = c.getItem(j)
				if (String(s2.getId()) === NS_CAM_FILM) {
					s2.shrink(1)
					c.setChanged()
					return true
				}
			}
		}
	} catch (e) {}
	return false
}

// аппарат в руке или в багажнике самолёта
function nsCamHasCamera(p, v) {
	if (String(p.getMainHandItem().getId()) === NS_CAM_ITEM || String(p.getOffHandItem().getId()) === NS_CAM_ITEM) return true
	try {
		if (v instanceof NS_CAM_INV_VEHICLE) {
			var c = v.getInventory()
			for (var j = 0; j < c.getContainerSize(); j++) if (String(c.getItem(j).getId()) === NS_CAM_ITEM) return true
		}
	} catch (e) {}
	return false
}

// в полёте: в самолёте IA, самолёт не на земле
function nsCamFlying(p) {
	try {
		var v = p.getVehicle()
		if (v == null || !(v instanceof NS_CAM_VEHICLE)) return null
		if (v.onGround() || v.isInWater()) return null
		return v
	} catch (e) {
		return null
	}
}

// Снимок. manual — ПКМ (без требования «пролетел кадр»). Возвращает true, если снимок сделан.
function nsCamShot(p, v, manual) {
	var name = String(p.getUsername())
	var level = p.getLevel()
	var now = Number(level.getTime())
	var mem = nsCamMem[name] || (nsCamMem[name] = { t: -99999, x: null, z: null, hint: 0 })
	var y = Number(v.getY())
	if (y < NS_CAM_MIN_Y) {
		if (manual) p.setStatusMessage(Text.yellow('Аэрофото: поднимитесь выше y ' + NS_CAM_MIN_Y + ' (сейчас ' + Math.floor(y) + ')'))
		return false
	}
	if (now - mem.t < NS_CAM_COOLDOWN) {
		if (manual) p.setStatusMessage(Text.gray('Аэрофото: перезарядка ' + Math.ceil((NS_CAM_COOLDOWN - (now - mem.t)) / 20) + ' с'))
		return false
	}
	var px = Number(v.getX()),
		pz = Number(v.getZ())
	var frame = (2 * nsCamRadius(y) + 1) * 16
	if (!manual && mem.x !== null && Math.sqrt((px - mem.x) * (px - mem.x) + (pz - mem.z) * (pz - mem.z)) < NS_CAM_MOVE * frame) return false
	if (!nsCamTakeFilm(p, v)) {
		if (manual || now - mem.hint > 1200) {
			mem.hint = now
			p.setStatusMessage(Text.red('Аэрофото: нет плёнки — аэрофотоплёнка в инвентаре или в багажнике'))
		}
		return false
	}
	mem.t = now
	mem.x = px
	mem.z = pz
	try {
		p.addItemCooldown(Item.of(NS_CAM_ITEM).getItem(), NS_CAM_COOLDOWN)
	} catch (e) {}

	var server = p.getServer()
	var dim = String(level.getDimension())
	var r = nsCamRadius(y)
	var ccx = Math.floor(px) >> 4,
		ccz = Math.floor(pz) >> 4
	var atlas = nsCamAtlasLoad(server)
	var found = [],
		fresh = []
	var src = level.getChunkSource()
	for (var dx = -r; dx <= r; dx++) {
		for (var dz = -r; dz <= r; dz++) {
			var cx = ccx + dx,
				cz = ccz + dz
			var chunk = null
			try {
				chunk = src.getChunkNow(cx, cz)
			} catch (e) {}
			if (chunk == null) continue
			var rid = null
			try {
				var data = NS_CAM_ORE.getData(chunk)
				rid = data ? data.getRecipeId() : null
			} catch (e) {
				console.warn('[аэрофото] не прочитал жилу ' + cx + ',' + cz + ': ' + e)
			}
			if (rid == null) continue
			var key = nsCamVeinKey(String(rid))
			var bx = cx * 16 + 8,
				bz = cz * 16 + 8
			var by = 64
			try {
				by = Number(level.getHeight(NS_CAM_HEIGHTMAP, bx, bz))
			} catch (e) {}
			var vein = { k: key, x: bx, y: by, z: bz, d: Math.round(Math.sqrt((bx - px) * (bx - px) + (bz - pz) * (bz - pz))) }
			found.push(vein)
			var id = dim + '|' + cx + '|' + cz
			if (!atlas[id]) {
				atlas[id] = [key, bx, by, bz, name, Date.now()]
				fresh.push(vein)
			}
		}
	}
	// атлас не бесконечный: лишние — самые старые записи
	var ids = Object.keys(atlas)
	if (ids.length > NS_CAM_ATLAS_MAX) {
		ids.sort(function (a, b) {
			return atlas[a][5] - atlas[b][5]
		})
		for (var i = 0; i < ids.length - NS_CAM_ATLAS_MAX; i++) delete atlas[ids[i]]
	}
	if (fresh.length) nsCamAtlasSave(server, atlas)

	var side = 2 * r + 1
	server.runCommandSilent('execute at ' + name + ' run playsound minecraft:ui.cartography_table.take_result player ' + name + ' ~ ~ ~ 0.8 1.4')
	if (!found.length) {
		p.setStatusMessage(Text.gray('Аэрофото ' + side + '×' + side + ' чанков: жил нет'))
		return true
	}
	// сводка: типы и сколько новых
	var byType = {}
	for (var f = 0; f < found.length; f++) byType[found[f].k] = (byType[found[f].k] || 0) + 1
	var parts = []
	for (var t in byType) parts.push(nsCamVeinInfo(t)[0].toLowerCase() + (byType[t] > 1 ? ' ×' + byType[t] : ''))
	p.tell(Text.of('[Аэрофото] ').aqua().append(Text.gray('снимок ' + side + '×' + side + ' чанков, жил: ' + found.length + ' (новых ' + fresh.length + '): ' + parts.join(', '))))
	// путевые точки — к новым жилам, ближайшие первыми
	fresh.sort(function (a, b) {
		return a.d - b.d
	})
	for (var w = 0; w < fresh.length && w < NS_CAM_SHOW; w++) {
		var fv = fresh[w]
		var info = nsCamVeinInfo(fv.k)
		p.tell(Text.gray(nsCamWaypoint('Жила ' + info[0].toLowerCase(), info[1], fv.x, fv.y, fv.z, info[2], dim)))
	}
	if (fresh.length > NS_CAM_SHOW) p.tell(Text.gray('[Аэрофото] Ещё новых: ' + (fresh.length - NS_CAM_SHOW) + ' — все известные жилы: /veins'))
	return true
}

// пассивная съёмка: аппарат в руке или в багажнике
ServerEvents.tick(function (event) {
	if (++nsCamTick % NS_CAM_CHECK !== 0) return
	try {
		var ps = event.server.getPlayerList().getPlayers()
		for (var i = 0; i < ps.size(); i++) {
			var p = ps.get(i)
			try {
				var v = nsCamFlying(p)
				if (v == null || Number(v.getY()) < NS_CAM_MIN_Y || !nsCamHasCamera(p, v)) continue
				nsCamShot(p, v, false)
			} catch (e) {
				console.error('[аэрофото] ' + p.getUsername() + ': ' + e)
			}
		}
	} catch (e) {
		console.error('[аэрофото] ' + e)
	}
})

// ПКМ аппаратом — снимок сразу
ItemEvents.rightClicked(NS_CAM_ITEM, function (event) {
	try {
		var p = event.player
		var v = nsCamFlying(p)
		if (v == null) {
			p.setStatusMessage(Text.yellow('Аэрофото работает в полёте на самолёте выше y ' + NS_CAM_MIN_Y))
			return
		}
		nsCamShot(p, v, true)
	} catch (e) {
		console.error('[аэрофото] ПКМ: ' + e)
	}
})

// ---------- окно атласа, вкладка «Жилы» (shift/20_atlas.js, nsAtlasMenuData) ----------
// Виды жил измерения и все снятые точки в нём. whoOf(имя) — номер в общем списке «кто снял».
function nsCamAtlasMenu(server, dim, px, pz, whoOf) {
	var atlas = nsCamAtlasLoad(server)
	var keys = NS_CAM_DIM_VEINS[dim] || []
	var types = [],
		index = {}
	function addType(key) {
		var info = nsCamVeinInfo(key)
		var rare = NS_CAM_RARE_TEXT[NS_CAM_RARE[key] || 1]
		index[key] = types.length
		types.push({ k: 'vein:' + key, name: info[0], wn: 'Жила ' + String(info[0]).toLowerCase(), ini: info[1], wc: info[2], color: info[3], icon: info[4], n: 0, where: rare[0], tip: rare[1] })
	}
	for (var i = 0; i < keys.length; i++) addType(keys[i])
	var list = [],
		total = 0
	for (var id in atlas) {
		if (id.indexOf(dim + '|') !== 0) continue
		var a = atlas[id]
		if (index[a[0]] === undefined) addType(a[0]) // жила вне списка (новый мод) — тоже в окно
		var ti = index[a[0]]
		types[ti].n++
		total++
		list.push([ti, Math.round(a[1]), Math.round(a[2]), Math.round(a[3]), whoOf(a[4]), (a[1] - px) * (a[1] - px) + (a[3] - pz) * (a[3] - pz)])
	}
	if (list.length > NS_CAM_MENU_MAX) {
		list.sort(function (x, y) {
			return x[5] - y[5]
		})
		list.length = NS_CAM_MENU_MAX
	}
	var pts = []
	for (var j = 0; j < list.length; j++) pts.push(list[j].slice(0, 5))
	var here = types.length > 0
	return {
		here: here,
		dim: dim,
		wy: 0,
		types: types,
		pts: pts,
		hint: 'Жилы снимает аэрофотоаппарат: в руке или в багажнике самолёта, с аэрофотоплёнкой, в полёте выше y 150.',
		empty: here ? 'Жил в этом измерении ещё не снимали. Аэрофотоаппарат снимает их в полёте на самолёте выше y 150.' : 'В этом измерении жил нет.',
	}
}

// ---------- /veins (атлас жил) ----------
function nsCamAtlasCmd(ctx, filter) {
	var p = ctx.source.getPlayer()
	if (!p) return 0
	var server = ctx.source.getServer()
	var atlas = nsCamAtlasLoad(server)
	var dim = String(p.getLevel().getDimension())
	var px = Number(p.getX()),
		pz = Number(p.getZ())
	var list = [],
		total = 0,
		counts = {}
	for (var id in atlas) {
		if (id.indexOf(dim + '|') !== 0) continue
		var a = atlas[id]
		var info = nsCamVeinInfo(a[0])
		total++
		counts[a[0]] = (counts[a[0]] || 0) + 1
		if (filter && a[0].indexOf(filter) !== 0 && info[0].toLowerCase().indexOf(filter) !== 0) continue
		list.push({ k: a[0], x: a[1], y: a[2], z: a[3], d: Math.round(Math.sqrt((a[1] - px) * (a[1] - px) + (a[3] - pz) * (a[3] - pz))) })
	}
	if (!total) {
		p.tell(Text.gray('[Атлас жил] В этом измерении жил ещё не снимали. Аэрофотоаппарат: выше y 150 на самолёте.'))
		return 1
	}
	var parts = []
	for (var k in counts) parts.push(nsCamVeinInfo(k)[0].toLowerCase() + ' ' + counts[k])
	p.tell(Text.of('[Атлас жил] ').aqua().append(Text.gray('известно ' + total + ': ' + parts.join(', '))))
	list.sort(function (a, b) {
		return a.d - b.d
	})
	if (!list.length) {
		p.tell(Text.gray('По «' + filter + '» ничего. Тип — по-русски или как в зондах (iron, gold…).'))
		return 1
	}
	p.tell(Text.gray('Ближайшие' + (filter ? ' («' + filter + '»)' : '') + ':'))
	for (var i = 0; i < list.length && i < 6; i++) {
		var v = list[i]
		var inf = nsCamVeinInfo(v.k)
		p.tell(Text.gray('  ' + inf[0] + ' — ' + v.d + ' бл., ' + nsCamCompass(v.x - px, v.z - pz)))
		p.tell(Text.gray(nsCamWaypoint('Жила ' + inf[0].toLowerCase(), inf[1], v.x, v.y, v.z, inf[2], dim)))
	}
	return 1
}

// Финальный аудит 06.10: /atlas без слов с 3.4.0 — «Атлас месторождений» (shift/20_atlas.js, он регистрируется позже
// и перебивал этот корень). Атлас жил — своя команда /veins [тип]; /atlas <тип> по-прежнему ищет жилы (старые квесты).
// С 08.10 /veins без слов — окно атласа на вкладке «Жилы»; /veins <тип> — как раньше, в чат.
ServerEvents.commandRegistry(function (event) {
	var C = event.commands
	var A = event.arguments
	event.register(
		C.literal('veins')
			.executes(function (ctx) {
				// окно атласа на вкладке «Жилы» (08.10); нет окна — список в чат
				try {
					var p = ctx.source.getPlayer()
					if (p && typeof nsAtlasOpen === 'function' && nsAtlasOpen(p, 'veins')) return 1
				} catch (e) {
					console.error('[аэрофото] /veins: ' + e)
				}
				return nsCamAtlasCmd(ctx, '')
			})
			.then(
				C.argument('type', A.GREEDY_STRING.create(event)).executes(function (ctx) {
					return nsCamAtlasCmd(ctx, String(A.GREEDY_STRING.getResult(ctx, 'type')).toLowerCase())
				})
			)
	)
	event.register(
		C.literal('atlas').then(
			C.argument('type', A.GREEDY_STRING.create(event)).executes(function (ctx) {
				return nsCamAtlasCmd(ctx, String(A.GREEDY_STRING.getResult(ctx, 'type')).toLowerCase())
			})
		)
	)
})
