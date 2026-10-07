// ==========================================================================
// Сброс снабжения для пилотов (07.10.2026, идея №8 финального аудита: «сигнальная ракета → через 30 с пролетает
// грузовой самолёт и сбрасывает ящик»; Георгий: «идеи крутые сами себя не реализуют»).
//
// «Сигнальная ракета снабжения» (nightshift:supply_flare) — награда, не крафтится: удостоверения аэроклуба (III — 1,
// II — 2, I — 3; 20_aeroclub.js), контракты смены с 15-й волны (14_contracts.js), редко — в самом сбросе.
// ПКМ под открытым небом → над точкой столб красного дыма; через 30 с над ней пролетает грузовой самолёт и сбрасывает
// ящик на парашюте, ящик садится бочкой с добычей nightshift:airdrop/supply, вызвавшему — координаты и метка Xaero.
// Самолёт — 10 block_display (фюзеляж, крылья, моторы, хвост, полоса изумруд/бордо): сущность Immersive Aircraft
// без пилота клиент не рисует (проверено 07.10), а витрины видны всегда и с teleport_duration летят плавно.
//
// Сущности сброса помечены ns_airdrop + поколением запуска сервера (NS_AD_GEN): раз в 5 с всё с ns_airdrop без
// текущего поколения убирается — дирижабль, застрявший в выгруженном чанке или переживший перезапуск, не останется
// в небе бесплатным транспортом. Незавершённые сбросы хранятся в persistentData: после перезапуска бочка встаёт сразу.
// Команды оператора: /airdrop test — сброс к себе без ракеты; /airdrop status.
// Правило Rhino: только var; тела обработчиков — в try.
// ==========================================================================

var NS_AD = {
	delay: 600, // 30 с от ракеты до пролёта
	arm: 80, // откуда заходит дирижабль (блоков до точки) — в пределах прорисовки вызвавшего
	speed: 0.9, // блоков за тик
	height: 38, // над землёй
	fall: 0.16, // скорость спуска ящика, блоков за тик
	loot: 'nightshift:airdrop/supply',
}
var NS_AD_KEY = 'ns_airdrop_json'
var NS_AD_GEN = 'ns_ad_g' + Date.now()
var NS_AD_HM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
var NS_AD_JOBS = null // [{id, dim, x, z, gy, who, t, phase, sx, sz, dx, dz, yaw, cy}]
var NS_AD_SEQ = 0
var NS_AD_SRV = null // сервер из событий: aviation/ грузится раньше raids/, где NSG.nsServer

function nsAdSrv() {
	return NS_AD_SRV || (typeof NSG !== 'undefined' ? NSG.nsServer : null)
}

function nsAdLoad() {
	if (NS_AD_JOBS) return NS_AD_JOBS
	NS_AD_JOBS = []
	try {
		var raw = String(nsAdSrv().persistentData.getString(NS_AD_KEY))
		if (raw.length) NS_AD_JOBS = JSON.parse(raw)
	} catch (e) {
		console.warn('[сброс] битое состояние: ' + e)
	}
	return NS_AD_JOBS
}
function nsAdSave() {
	try {
		nsAdSrv().persistentData.putString(NS_AD_KEY, JSON.stringify(NS_AD_JOBS || []))
	} catch (e) {
		console.warn('[сброс] не сохранить: ' + e)
	}
}
function nsAdRun(dim, cmd) {
	return nsAdSrv().runCommandSilent('execute in ' + dim + ' run ' + cmd)
}
function nsAdGround(level, x, z) {
	level.getChunk(x >> 4, z >> 4)
	return Number(level.getHeight(NS_AD_HM.MOTION_BLOCKING_NO_LEAVES, x, z))
}

// Новый сброс к точке x z (над землёй) в измерении игрока
function nsAdStart(p, free) {
	var level = p.getLevel()
	var x = Math.floor(p.getX()),
		z = Math.floor(p.getZ())
	var ang = Math.random() * Math.PI * 2
	var job = {
		id: String(Date.now() % 100000) + '_' + NS_AD_SEQ++,
		dim: String(level.getDimension()),
		x: x, z: z,
		gy: nsAdGround(level, x, z),
		who: String(p.getUsername()),
		t: 0, phase: 'wait',
		dx: Math.cos(ang), dz: Math.sin(ang),
	}
	job.sx = x - job.dx * NS_AD.arm
	job.sz = z - job.dz * NS_AD.arm
	// поворот модели по курсу (yaw Minecraft: 0 — на юг, +Z)
	job.yaw = Math.round((Math.atan2(-job.dx, job.dz) * 180) / Math.PI)
	nsAdLoad().push(job)
	nsAdSave()
	p.tell(Text.gold('[Снабжение] ').append(Text.white('Ракета ушла. Борт с грузом будет над точкой через ')).append(Text.yellow('30 с')).append(Text.gray(' — ящик сбросят на парашюте прямо сюда.')))
	nsAdRun(job.dim, 'playsound minecraft:entity.firework_rocket.launch player @a ' + x + ' ' + (job.gy + 1) + ' ' + z + ' 2 0.8')
	nsAdRun(job.dim, 'particle minecraft:flash ' + x + ' ' + (job.gy + 6) + ' ' + z + ' 0 0 0 0 1 force')
	if (!free) console.info('[сброс] ' + job.who + ' вызвал сброс в ' + job.dim + ' ' + x + ' ' + z)
	return job
}

// Самолёт из витрин: [вдоль курса, вверх, вбок] — центр детали и размеры, блок. Курс — ось x модели.
var NS_AD_PLANE = [
	[0, 0, 0, 7, 1.4, 1.4, 'minecraft:light_gray_concrete'], // фюзеляж
	[0, 0.25, 0, 7.04, 0.3, 1.44, 'minecraft:green_concrete'], // полоса — изумруд смены
	[4, 0, 0, 1, 1.1, 1.1, 'minecraft:gray_concrete'], // нос
	[3, 0.65, 0, 1.4, 0.4, 1.0, 'minecraft:light_blue_stained_glass'], // кабина
	[0.5, 0.1, 0, 1.6, 0.25, 12, 'minecraft:white_concrete'], // крылья
	[0.9, -0.45, 3, 1.7, 0.7, 0.7, 'minecraft:gray_concrete'], // мотор правый
	[0.9, -0.45, -3, 1.7, 0.7, 0.7, 'minecraft:gray_concrete'], // мотор левый
	[-3.3, 0.35, 0, 1, 0.2, 4.2, 'minecraft:white_concrete'], // стабилизатор
	[-3.3, 1.2, 0, 1.1, 1.7, 0.25, 'minecraft:red_concrete'], // киль — бордо
	[-1, -0.75, 0, 2, 0.15, 1, 'minecraft:gray_concrete'], // грузовой люк
]

function nsAdPlane(job, tag) {
	var a = Math.atan2(-job.dz, job.dx) // поворот вокруг Y: ось x модели → курс
	var ca = Math.cos(a),
		sa = Math.sin(a)
	var qy = Math.sin(a / 2),
		qw = Math.cos(a / 2)
	for (var i = 0; i < NS_AD_PLANE.length; i++) {
		var P = NS_AD_PLANE[i]
		// центр детали в мире: вдоль курса (dx, dz), вбок (sa, ca) — куда уходит ось z модели после поворота
		var wx = job.sx + P[0] * job.dx + P[2] * sa,
			wy = job.sy + P[1],
			wz = job.sz + P[0] * job.dz + P[2] * ca
		// сдвиг, чтобы блок крутился вокруг своего центра: -R·(размер/2)
		var hx = P[3] / 2,
			hy = P[4] / 2,
			hz = P[5] / 2
		var tx = -(hx * ca + hz * sa),
			ty = -hy,
			tz = -(-hx * sa + hz * ca)
		nsAdRun(job.dim, 'summon minecraft:block_display ' + wx.toFixed(3) + ' ' + wy.toFixed(3) + ' ' + wz.toFixed(3) +
			' {Tags:["ns_airdrop","' + NS_AD_GEN + '","' + tag + '"],teleport_duration:2,view_range:6f,block_state:{Name:"' + P[6] + '"},' +
			'transformation:{left_rotation:[0f,' + qy.toFixed(5) + 'f,0f,' + qw.toFixed(5) + 'f],right_rotation:[0f,0f,0f,1f],' +
			'translation:[' + tx.toFixed(3) + 'f,' + ty.toFixed(3) + 'f,' + tz.toFixed(3) + 'f],scale:[' + P[3] + 'f,' + P[4] + 'f,' + P[5] + 'f]}}')
	}
}

function nsAdTick(job) {
	var level = nsAdSrv().getLevel(job.dim)
	if (!level) return true
	job.t++
	var tagS = 'ns_ad_s' + job.id,
		tagC = 'ns_ad_c' + job.id
	if (job.phase === 'wait') {
		if (job.t % 10 === 0) {
			nsAdRun(job.dim, 'particle minecraft:campfire_signal_smoke ' + (job.x + 0.5) + ' ' + (job.gy + 1) + ' ' + (job.z + 0.5) + ' 0.15 0.5 0.15 0.02 4 force')
			nsAdRun(job.dim, 'particle minecraft:dust{color:[1.0,0.15,0.1],scale:1.2} ' + (job.x + 0.5) + ' ' + (job.gy + 4) + ' ' + (job.z + 0.5) + ' 0.15 3 0.15 0 10 force')
		}
		if (job.t >= NS_AD.delay) {
			job.phase = 'fly'
			job.t = 0
			job.sy = job.gy + NS_AD.height
			nsAdGround(level, Math.floor(job.sx), Math.floor(job.sz))
			nsAdPlane(job, tagS)
			nsAdSave()
		}
		return false
	}
	if (job.phase === 'fly' || job.phase === 'drop') {
		var d = job.t * NS_AD.speed
		var px = job.sx + job.dx * d,
			pz = job.sz + job.dz * d
		nsAdRun(job.dim, 'execute as @e[tag=' + tagS + '] at @s run tp @s ~' + (job.dx * NS_AD.speed).toFixed(3) + ' ~ ~' + (job.dz * NS_AD.speed).toFixed(3))
		if (job.t % 20 === 0) nsAdRun(job.dim, 'playsound minecraft:item.elytra.flying ambient @a ' + px.toFixed(1) + ' ' + job.sy + ' ' + pz.toFixed(1) + ' 3 0.6')
		if (job.t % 3 === 0) nsAdRun(job.dim, 'particle minecraft:campfire_cosy_smoke ' + (px - job.dx * 4).toFixed(1) + ' ' + (job.sy + 0.3) + ' ' + (pz - job.dz * 4).toFixed(1) + ' 0.2 0.2 0.2 0.01 2 force')
		// над точкой — сброс
		if (job.phase === 'fly' && d >= NS_AD.arm) {
			job.phase = 'drop'
			job.cy = job.sy - 2
			nsAdRun(job.dim, 'summon minecraft:block_display ' + (job.x) + ' ' + job.cy + ' ' + (job.z) + ' {Tags:["ns_airdrop","' + NS_AD_GEN + '","' + tagC + '"],block_state:{Name:"minecraft:barrel",Properties:{facing:"up"}}}')
			nsAdRun(job.dim, 'summon minecraft:block_display ' + (job.x - 1) + ' ' + (job.cy + 2.2) + ' ' + (job.z - 1) + ' {Tags:["ns_airdrop","' + NS_AD_GEN + '","' + tagC + '"],block_state:{Name:"minecraft:white_wool"},transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[3f,0.25f,3f]}}')
			nsAdRun(job.dim, 'playsound minecraft:block.wool.place ambient @a ' + job.x + ' ' + job.cy + ' ' + job.z + ' 2 0.6')
			nsAdSave()
		}
		if (job.phase === 'drop') {
			job.cy -= NS_AD.fall
			nsAdRun(job.dim, 'execute as @e[tag=' + tagC + '] at @s run tp @s ~ ~-' + NS_AD.fall + ' ~')
			if (job.t % 4 === 0) nsAdRun(job.dim, 'particle minecraft:cloud ' + (job.x + 0.5) + ' ' + (job.cy + 2.5) + ' ' + (job.z + 0.5) + ' 0.8 0.1 0.8 0 2 force')
			// дирижабль улетел далеко — убрать
			if (d >= NS_AD.arm * 2) nsAdRun(job.dim, 'kill @e[tag=' + tagS + ']')
			if (job.cy <= job.gy) {
				nsAdRun(job.dim, 'kill @e[tag=' + tagS + ']')
				nsAdRun(job.dim, 'kill @e[tag=' + tagC + ']')
				nsAdLand(job)
				return true
			}
		}
		// страховка: дирижабль не долетел (чанки) — сбросить сразу
		if (job.t > 20 * 60) {
			nsAdRun(job.dim, 'kill @e[tag=' + tagS + ']')
			nsAdRun(job.dim, 'kill @e[tag=' + tagC + ']')
			nsAdLand(job)
			return true
		}
	}
	return false
}

// Ящик сел: бочка с добычей на земле у точки (рядом свободное место), частицы, звук, координаты и метка вызвавшему
function nsAdLand(job) {
	var level = nsAdSrv().getLevel(job.dim)
	if (!level) return
	var gy = nsAdGround(level, job.x, job.z)
	var y = gy
	for (var k = 0; k < 6 && !level.getBlock(job.x, y, job.z).getBlockState().canBeReplaced(); k++) y++
	nsAdRun(job.dim, 'setblock ' + job.x + ' ' + y + ' ' + job.z + ' minecraft:barrel[facing=up]{LootTable:"' + NS_AD.loot + '",CustomName:\'{"text":"Сброс снабжения","color":"gold","italic":false}\'} replace')
	nsAdRun(job.dim, 'particle minecraft:explosion ' + (job.x + 0.5) + ' ' + (y + 0.5) + ' ' + (job.z + 0.5) + ' 0.3 0.1 0.3 0 3 force')
	nsAdRun(job.dim, 'particle minecraft:happy_villager ' + (job.x + 0.5) + ' ' + (y + 1) + ' ' + (job.z + 0.5) + ' 0.6 0.4 0.6 0 20 force')
	nsAdRun(job.dim, 'playsound minecraft:block.anvil.land block @a ' + job.x + ' ' + y + ' ' + job.z + ' 1 0.7')
	var p = nsAdSrv().getPlayerList().getPlayerByName(job.who)
	if (p) {
		p.tell(Text.gold('[Снабжение] ').append(Text.white('Груз сброшен: ')).append(Text.yellow('X ' + job.x + ', Y ' + y + ', Z ' + job.z)).append(Text.gray(' — бочка «Сброс снабжения». Метка — строкой ниже.')))
		if (job.dim === 'minecraft:overworld' || job.dim === 'minecraft:the_nether')
			p.tell(Text.of('xaero-waypoint:Сброс:С:' + job.x + ':' + (y + 1) + ':' + job.z + ':6:false:0:Internal-' + (job.dim === 'minecraft:the_nether' ? 'the_nether' : 'overworld') + '-waypoints'))
	}
	console.info('[сброс] сел у ' + job.x + ' ' + y + ' ' + job.z + ' (' + job.dim + ') для ' + job.who)
}

// ПКМ ракетой: только под открытым небом
ItemEvents.rightClicked('nightshift:supply_flare', event => {
	try {
		var p = event.player
		if (!p || event.level.isClientSide()) return
		NS_AD_SRV = event.server
		var bp = p.blockPosition()
		if (!event.level.canSeeSky(bp.above())) {
			p.setStatusMessage(Text.red('Сброс — только под открытым небом: борт должен видеть дым.'))
			return
		}
		var jobs = nsAdLoad()
		for (var i = 0; i < jobs.length; i++)
			if (jobs[i].who === String(p.getUsername()) && jobs[i].phase === 'wait') {
				p.setStatusMessage(Text.gold('Твой борт уже в пути — дождись сброса.'))
				return
			}
		event.item.shrink(1)
		nsAdStart(p, false)
	} catch (e) {
		console.error('[сброс] ракета: ' + e)
	}
})

ServerEvents.tick(event => {
	try {
		NS_AD_SRV = event.server
		var jobs = nsAdLoad()
		if (event.server.getTickCount() % 100 === 0) {
			// уборка: всё сброса без текущего поколения (зависшее, пережившее перезапуск)
			var dims = ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end']
			for (var di = 0; di < dims.length; di++) event.server.runCommandSilent('execute in ' + dims[di] + ' run kill @e[tag=ns_airdrop,tag=!' + NS_AD_GEN + ']')
		}
		if (!jobs.length) return
		var keep = []
		var changed = false
		for (var i = 0; i < jobs.length; i++) {
			var done = false
			try {
				done = nsAdTick(jobs[i])
			} catch (e1) {
				console.error('[сброс] ' + jobs[i].id + ': ' + e1)
				done = true
			}
			if (done) changed = true
			else keep.push(jobs[i])
		}
		NS_AD_JOBS = keep
		if (changed) nsAdSave()
	} catch (e) {
		console.error('[сброс] тик: ' + e)
	}
})

// После перезапуска: дирижабли не восстанавливаем — ждавшие и летевшие сбросы садятся сразу
ServerEvents.loaded(event => {
	try {
		NS_AD_SRV = event.server
		var jobs = nsAdLoad()
		for (var i = 0; i < jobs.length; i++) {
			try {
				nsAdLand(jobs[i])
			} catch (e1) {
				console.error('[сброс] посадка после перезапуска: ' + e1)
			}
		}
		NS_AD_JOBS = []
		nsAdSave()
	} catch (e) {
		console.error('[сброс] загрузка: ' + e)
	}
})

// Удостоверения, полученные до сброса снабжения: ракеты задним числом, один раз (III — 1, II — 2, I — 3; тег ns_flare_retro)
PlayerEvents.loggedIn(event => {
	try {
		var p = event.getPlayer()
		NS_AD_SRV = event.server
		if (p.getTags().contains('ns_flare_retro')) return
		p.addTag('ns_flare_retro')
		var rank = 0
		try {
			var raw = String(p.persistentData.getString('ns_aeroclub'))
			if (raw.length) rank = Number(JSON.parse(raw).rank || 0)
		} catch (e1) {}
		if (rank <= 0) return
		var n = (rank * (rank + 1)) / 2
		p.give(Item.of('nightshift:supply_flare', n))
		p.tell(Text.gold('[Аэроклуб] ').append(Text.white('За удостоверения — ' + n + ' сигн. ракет' + (n === 1 ? 'а' : 'ы') + ' снабжения: ')).append(Text.gray('ПКМ под открытым небом — через 30 с борт сбросит ящик с грузом.')))
		console.info('[сброс] ' + p.getUsername() + ': ракет за прошлые удостоверения — ' + n)
	} catch (e) {
		console.error('[сброс] ракеты задним числом: ' + e)
	}
})

ServerEvents.commandRegistry(event => {
	var C = event.commands
	event.register(
		C.literal('airdrop')
			.requires(s => s.hasPermission(2))
			.then(C.literal('test').executes(ctx => {
				try {
					NS_AD_SRV = ctx.source.server
					var p = ctx.source.getPlayer()
					if (p) nsAdStart(p, true)
				} catch (e) {
					console.error('[сброс] test: ' + e)
				}
				return 1
			}))
			.then(C.literal('status').executes(ctx => {
				var jobs = nsAdLoad()
				ctx.source.sendSystemMessage(Text.of('[сброс] активных: ' + jobs.length + (jobs.length ? ' — ' + jobs.map(j => j.who + ' ' + j.phase + ' ' + j.x + ' ' + j.z).join('; ') : '')))
				return 1
			}))
	)
})
