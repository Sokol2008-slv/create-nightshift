#!/bin/bash
# Камень вокруг игрока на N секунд становится вырезанными тыквами лицом к нему, потом всё возвращается.
# ./pumpkins.sh <ник> [радиус=6] [секунды=3]
# Запасной вариант без рестарта; с блоком-глазом (2.0.12) лучше ./scare.sh faces.
source "$(dirname "$0")/_lib.sh"
P=$1; R=${2:-6}; S=${3:-3}
read PX PY PZ <<< "$(pos $P)"; [ -z "$PZ" ] && { echo "игрок $P не найден"; exit 1; }
X1=$((PX-R)); X2=$((PX+R)); Z1=$((PZ-R)); Z2=$((PZ+R)); Y1=$((PY-3)); Y2=$((PY+4)); SKY=300
backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SKY
F="#minecraft:base_stone_overworld"
# лицом к игроку: восточнее него — смотрят на запад, западнее — на восток, севернее — на юг, южнее — на север
T "fill $((PX+1)) $Y1 $Z1 $X2 $Y2 $Z2 minecraft:carved_pumpkin[facing=west] replace $F"
T "fill $X1 $Y1 $Z1 $((PX-1)) $Y2 $Z2 minecraft:carved_pumpkin[facing=east] replace $F"
T "fill $PX $Y1 $Z1 $PX $Y2 $((PZ-1)) minecraft:carved_pumpkin[facing=south] replace $F"
T "fill $PX $Y1 $((PZ+1)) $PX $Y2 $Z2 minecraft:carved_pumpkin[facing=north] replace $F"
T "playsound minecraft:entity.warden.heartbeat master $P $PX $PY $PZ 1 0.7"
T "playsound minecraft:ambient.cave master $P $PX $PY $PZ 1 0.5"
sleep $S
restore_only $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SKY "#minecraft:base_stone_overworld"
drop_backup $X1 $Y1 $Z1 $X2 $Y2 $Z2 $SKY
echo "лица вокруг $P ($PX $PY $PZ), радиус $R, $S с"
