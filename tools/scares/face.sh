#!/bin/bash
# Лицом к лицу: Монохром (или Клоун) вплотную за спиной, камера игрока сама разворачивается к нему,
# крик; через секунду слепота и темнота, он исчезает. За спиной — потому что перед лицом в шахте камень.
# ./face.sh <ник> [mono|clown]
. "$(dirname "$0")/_lib.sh"
P=${1:?ник}; KIND=${2:-mono}
if [ "$KIND" = clown ]; then TEAM=ns_clown; SND="minecraft:entity.witch.celebrate hostile $P ~ ~ ~ 1 0.7"; else TEAM=ns_mono; SND="minecraft:entity.enderman.stare hostile $P ~ ~ ~ 1 0.6"; fi
read U N <<< "$(python3 -c "
import random
ints=[random.getrandbits(32) for _ in range(4)]
h=''.join('%08x'%i for i in ints)
print(h[0:8]+'-'+h[8:12]+'-'+h[12:16]+'-'+h[16:20]+'-'+h[20:32], '[I;'+','.join(str(i-2**32 if i>=2**31 else i) for i in ints)+']')")"
T "team join $TEAM $U"
T "execute as $P at @s rotated ~ 0 positioned ^ ^ ^-1.6 run summon minecraft:husk ~ ~ ~ {UUID:$N,Tags:[\"ns_scare\",\"$TEAM\"],NoAI:1b,Silent:1b,Invulnerable:1b,PersistenceRequired:1b,attributes:[{id:\"minecraft:generic.scale\",base:1.0d}]}"
T "execute as $U at @s run tp @s ~ ~ ~ facing entity $P eyes"
T "execute as $P at @s run tp @s ~ ~ ~ facing entity $U eyes"
T "execute at $P run playsound $SND"
T "execute at $P run playsound minecraft:entity.enderman.scream hostile $P ~ ~ ~ 1 0.5"
sleep 1.2
T "effect give $P minecraft:blindness 2 0 true"
T "effect give $P minecraft:darkness 4 0 true"
T "execute as $U at @s run tp @s ~ -500 ~"
sleep 0.3
T "kill $U"
T "team leave $U"
echo "лицом к лицу: $P ($KIND)"
