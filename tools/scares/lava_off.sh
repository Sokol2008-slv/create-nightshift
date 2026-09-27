#!/bin/bash
# Вся лава вокруг игрока исчезает на несколько секунд (тишина и темнота), потом возвращается.
# Клетку игрока и соседние от лавы очищаем, чтобы не залило.
# ./lava_off.sh <ник> [радиус=32] [сек=5]
. "$(dirname "$0")/_lib.sh"
P=${1:?ник}; R=${2:-32}; DUR=${3:-5}; H=10
read PX PY PZ <<< "$(pos $P)"
X1=$((PX-R)); X2=$((PX+R)); Z1=$((PZ-R)); Z2=$((PZ+R)); Y1=$((PY-H)); Y2=$((PY+H)); SY=$((319-2*H))
backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SY
T "fill $X1 $Y1 $Z1 $X2 $Y2 $Z2 minecraft:air replace minecraft:lava"
T "playsound minecraft:block.lava.extinguish master $P $PX $PY $PZ 1 0.5"
T "playsound minecraft:ambient.cave master $P $PX $PY $PZ 1 0.5"
sleep $DUR
restore_only $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SY minecraft:lava
read QX QY QZ <<< "$(pos $P)"
T "fill $((QX-1)) $((QY-1)) $((QZ-1)) $((QX+1)) $((QY+2)) $((QZ+1)) minecraft:air replace minecraft:lava"
drop_backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SY
