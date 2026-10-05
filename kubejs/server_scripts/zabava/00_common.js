// ==========================================================================
// «Развлечения смены» (05.10.2026, поток T; Георгий: «делай что душе угодно, чтобы мы зашли и были в шоке»).
// Общее для трёх забав этой папки:
//  10_trader.js — странствующий снабженец (приходит к алтарю базы раз в 2–3 игровых дня, торгует за жетоны смены);
//  20_race.js   — гонки по кольцам в небе (/race, предмет «Маяк трассы»);
//  30_tir.js    — тир на арене, когда нет набега (/tir).
// Здесь: поколение скрипта (защита нативных обработчиков от дублей после /reload), награды жетонами с потолком
// в день, частицы через API (без разбора команд), «занятая» строка над хотбаром (навигатор метеорита её не
// перебивает), защита наших сущностей от Carry On, время и имена.
// Папка грузится после raids/ (по алфавиту) — NSG и функции набегов уже есть. Правила Rhino: только var,
// тело NativeEvents — в try/catch.
// ==========================================================================

// --------------------------------------------------------------------------
// Поколение: /reload регистрирует нативные обработчики ещё раз, старые остаются. Каждый обработчик помнит своё
// поколение и молчит, если в памяти сервера уже другое (persistentData сервера переживает /reload).
// --------------------------------------------------------------------------
var NS_FUN_GEN = String(Date.now()) + '_' + Math.floor(Math.random() * 1e6)
function nsFunGenMark(server) {
	try {
		server.persistentData.putString('ns_fun_gen', NS_FUN_GEN)
	} catch (e) {}
}
function nsFunGenOk() {
	try {
		return String(NSG.nsServer.persistentData.getString('ns_fun_gen')) === NS_FUN_GEN
	} catch (e) {
		return true
	}
}
try {
	if (NSG.nsServer) nsFunGenMark(NSG.nsServer) // /reload: сервер уже есть
} catch (e) {}
ServerEvents.loaded(event => {
	nsFunGenMark(event.server)
})

// --------------------------------------------------------------------------
// Мелочи
// --------------------------------------------------------------------------
var NS_FUN_TOKEN = 'nightshift:shift_token'
var NS_FUN_AABB = Java.loadClass('net.minecraft.world.phys.AABB')
var NS_FUN_LIVING = Java.loadClass('net.minecraft.world.entity.LivingEntity')

function nsFunName(p) {
	try {
		return String(p.getUsername())
	} catch (e) {}
	return String(p.getGameProfile().getName())
}
function nsFunPlayer(name) {
	try {
		return NSG.nsServer.getPlayerList().getPlayerByName(name)
	} catch (e) {
		return null
	}
}
function nsFunTick() {
	return Number(NSG.nsServer.getTickCount())
}
function nsFunDay() {
	try {
		return Math.floor(Number(NSG.nsServer.getOverworld().getDayTime()) / 24000)
	} catch (e) {
		return 0
	}
}
function nsFunDim(p) {
	return String(p.getLevel().getDimension())
}
// id предмета стопки: «minecraft:filled_map»
var NS_FUN_ITEMS = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').ITEM
function nsFunId(stack) {
	try {
		return String(NS_FUN_ITEMS.getKey(stack.getItem()))
	} catch (e) {}
	try {
		return String(stack.getId())
	} catch (e) {}
	return ''
}
function nsFunHasTag(e, tag) {
	try {
		return !!e && e.getTags().contains(tag)
	} catch (x) {
		return false
	}
}
// 83.4 тика → «1:23.45»; 12.3 → «0.62»
function nsFunClock(ticks) {
	var cs = Math.max(0, Math.round(ticks * 5)) // сотые доли секунды (тик = 0,05 с)
	var m = Math.floor(cs / 6000),
		s = Math.floor(cs / 100) % 60,
		c = cs % 100
	return (m > 0 ? m + ':' + (s < 10 ? '0' : '') : '') + s + '.' + (c < 10 ? '0' : '') + c
}
function nsFunPlural(n, one, few, many) {
	var m10 = n % 10,
		m100 = n % 100
	if (m10 === 1 && m100 !== 11) return n + ' ' + one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few
	return n + ' ' + many
}
function nsFunRaidBusy() {
	try {
		var st = nsGetStateRO()
		return st.raid && (st.raid.state === 'countdown' || st.raid.state === 'active')
	} catch (e) {
		return false
	}
}
// стрелка к цели относительно взгляда (yaw Minecraft: 0 — юг, растёт по часовой) и сторона света
function nsFunArrow(p, dx, dz) {
	try {
		var want = (Math.atan2(-dx, dz) * 180) / Math.PI
		var rel = ((((want - Number(p.getYRot())) % 360) + 540) % 360) - 180
		return ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘', '↓'][Math.round((rel + 180) / 45)]
	} catch (e) {
		return '•'
	}
}
function nsFunCompass(dx, dz) {
	var ang = (Math.atan2(dx, -dz) * 180) / Math.PI
	if (ang < 0) ang += 360
	return ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад'][Math.round(ang / 45) % 8]
}
// звук одному игроку (у него в ушах)
function nsFunSound(name, sound, vol, pitch) {
	NSG.nsServer.runCommandSilent('execute as ' + name + ' at @s run playsound ' + sound + ' master @s ~ ~ ~ ' + (vol || 1) + ' ' + (pitch || 1))
}
// задача-стадия книги (FTB: стадия = тег игрока)
function nsFunStage(name, tag) {
	NSG.nsServer.runCommandSilent('tag ' + name + ' add ' + tag)
}

// --------------------------------------------------------------------------
// Строка над хотбаром «занята» (гонка, тир): навигатор метеорита (sky/10_meteor.js) её не перебивает
// --------------------------------------------------------------------------
NSG.nsFunHud = {}
function nsFunHudHold(name, ticks) {
	NSG.nsFunHud[name] = nsFunTick() + (ticks || 40)
}
function nsFunHudBusy(p) {
	try {
		var t = NSG.nsFunHud && NSG.nsFunHud[nsFunName(p)]
		return !!t && t > nsFunTick()
	} catch (e) {
		return false
	}
}
function nsFunBar(p, text) {
	nsFunHudHold(nsFunName(p), 30)
	p.setStatusMessage(text)
}

// --------------------------------------------------------------------------
// Награды жетонами: потолок в игровой день на игрока по виду забавы (гонки, тир) — защита от фарма
// --------------------------------------------------------------------------
var NS_FUN_CAP = { race: 10, tir: 8 }
var NS_FUN_PAY_KEY = 'ns_fun_pay_json'
function nsFunPayLoad() {
	try {
		var raw = String(NSG.nsServer.persistentData.getString(NS_FUN_PAY_KEY))
		if (raw.length) return JSON.parse(raw)
	} catch (e) {}
	return {}
}
// Возвращает, сколько выдано (0 — потолок дня исчерпан)
function nsFunReward(p, kind, tokens) {
	var name = nsFunName(p)
	var day = nsFunDay()
	var pay = nsFunPayLoad()
	var key = kind + ':' + name
	var rec = pay[key] && pay[key].d === day ? pay[key] : { d: day, n: 0 }
	var give = Math.max(0, Math.min(tokens, (NS_FUN_CAP[kind] || 8) - rec.n))
	if (give > 0) {
		rec.n += give
		pay[key] = rec
		// старые дни — вон (запись маленькая)
		for (var k in pay) if (pay[k].d < day - 1) delete pay[k]
		NSG.nsServer.persistentData.putString(NS_FUN_PAY_KEY, JSON.stringify(pay))
		NSG.nsServer.runCommandSilent('give ' + name + ' ' + NS_FUN_TOKEN + ' ' + give)
	}
	return give
}

// --------------------------------------------------------------------------
// Частицы через API: один пакет на точку, без разбора команд. Не вышло — запасной путь командой.
// --------------------------------------------------------------------------
var NS_FUN_PT = null,
	NS_FUN_DUST = null,
	NS_FUN_V3F = null
try {
	NS_FUN_PT = Java.loadClass('net.minecraft.core.particles.ParticleTypes')
	NS_FUN_DUST = Java.loadClass('net.minecraft.core.particles.DustParticleOptions')
	NS_FUN_V3F = Java.loadClass('org.joml.Vector3f')
} catch (e) {
	console.warn('[забавы] частицы через API недоступны, будут командами: ' + e)
}
// spec: {api: объект частицы, cmd: 'minecraft:end_rod' | 'minecraft:dust{color:[r,g,b],scale:s}'}
function nsFunDust(r, g, b, scale) {
	var s = { cmd: 'minecraft:dust{color:[' + r + 'f,' + g + 'f,' + b + 'f],scale:' + scale + 'f}' }
	try {
		if (NS_FUN_DUST) s.api = new NS_FUN_DUST(new NS_FUN_V3F(r, g, b), scale)
	} catch (e) {}
	return s
}
function nsFunSimple(id) {
	var s = { cmd: 'minecraft:' + id }
	try {
		if (NS_FUN_PT) s.api = NS_FUN_PT[id.toUpperCase()]
	} catch (e) {}
	return s
}
var nsFunApiBroken = false
function nsFunParticle(level, player, spec, x, y, z) {
	if (spec.api && !nsFunApiBroken) {
		try {
			level.sendParticles(player, spec.api, true, x, y, z, 1, 0, 0, 0, 0)
			return
		} catch (e) {
			nsFunApiBroken = true
			console.warn('[забавы] sendParticles не сработал, дальше — командами: ' + e)
		}
	}
	NSG.nsServer.runCommandSilent('execute in ' + String(level.getDimension()) + ' run particle ' + spec.cmd + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2) + ' 0 0 0 0 1 force ' + nsFunName(player))
}

// --------------------------------------------------------------------------
// Наши сущности (снабженец и его ламы, мишени тира) — Carry On их не поднимает
// --------------------------------------------------------------------------
try {
	var NS_FUN_CARRY_EV = Java.loadClass('tschipp.carryon.events.EntityPickupEvent')
	NativeEvents.onEvent(NS_FUN_CARRY_EV, function (event) {
		try {
			if (!nsFunGenOk()) return
			if (nsFunHasTag(event.target, 'ns_fun_npc')) event.setCanceled(true)
		} catch (x) {}
	})
} catch (e) {
	console.info('[забавы] Carry On не найден — защита от подъёма не нужна')
}

// --------------------------------------------------------------------------
// Поиск наших сущностей рядом с точкой (по тегу)
// --------------------------------------------------------------------------
function nsFunFind(level, x, y, z, r, tag) {
	var out = []
	try {
		var list = level.getEntitiesWithin(new NS_FUN_AABB(x - r, y - r, z - r, x + r, y + r, z + r))
		for (var i = 0; i < list.size(); i++) if (nsFunHasTag(list.get(i), tag)) out.push(list.get(i))
	} catch (e) {}
	return out
}
// Сущность по UUID рядом с точкой. level.getEntity(UUID) из Rhino недоступен (KubeJS 2101 видит только
// getEntity(int) — «Cannot convert … to int», проверено 05.10), поэтому — поиск по тегу в маленькой коробке.
function nsFunFindUuid(level, x, y, z, r, tag, uuid) {
	var list = nsFunFind(level, x, y, z, r, tag)
	for (var i = 0; i < list.length; i++) if (String(list[i].getStringUuid()) === uuid) return list[i]
	return null
}
function nsFunGone(e) {
	try {
		return !e || e.isRemoved() || !e.isAlive()
	} catch (x) {
		return true
	}
}
