#!/bin/bash
# Свет гаснет по четвертям вокруг игрока (факелы, фонари), за спиной — светящаяся красная табличка
# «<ник>, я рядом», через 8 с свет возвращается из копии в небе. Табличка остаётся.
# ./lights_out.sh <ник>
. "$(dirname "$0")/_lib.sh"
P=${1:?ник}
read PX PY PZ <<< "$(pos $P)"
X1=$((PX-12)); X2=$((PX+12)); Z1=$((PZ-12)); Z2=$((PZ+12)); Y1=$((PY-3)); Y2=$((PY+5))
LIGHTS="minecraft:torch minecraft:wall_torch minecraft:lantern minecraft:soul_torch minecraft:soul_wall_torch minecraft:soul_lantern"
backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 300
QUADS=("$PX $Y1 $Z1 $X2 $Y2 $PZ" "$X1 $Y1 $Z1 $PX $Y2 $PZ" "$X1 $Y1 $PZ $PX $Y2 $Z2" "$PX $Y1 $PZ $X2 $Y2 $Z2")
for q in "${QUADS[@]}"; do
	read a b c d e f <<< "$q"
	for bl in $LIGHTS; do T "fill $a $b $c $d $e $f minecraft:air replace $bl"; done
	T "playsound minecraft:block.fire.extinguish master $P $(( (a+d)/2 )) $PY $(( (c+f)/2 )) 1 0.8"
	sleep 0.7
done
sleep 2.5
YAW=$(yaw $P)
read SX SY SZ ROT <<< "$(pos $P | python3 -c "
import math,sys
x,y,z=map(float,sys.stdin.read().split()); w=float('$YAW'); r=math.radians(w)
print(math.floor(x+0.5+math.sin(r)*2), int(y), math.floor(z+0.5-math.cos(r)*2), round(((w%360)+360)%360/22.5)%16)")"
T "execute if block $SX $SY $SZ minecraft:air run setblock $SX $SY $SZ minecraft:oak_sign[rotation=$ROT]{front_text:{color:\"red\",has_glowing_text:1b,messages:['\"\"','\"$P,\"','\"я рядом\"','\"\"']}}"
echo "табличка $SX $SY $SZ"
sleep 8
for bl in $LIGHTS; do restore_only $X1 $Y1 $Z1 $X2 $Y2 $Z2 300 $bl; done
drop_backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 300
