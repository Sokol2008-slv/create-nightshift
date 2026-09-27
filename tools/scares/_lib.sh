#!/bin/bash
# Общие функции скримеров: команды в консоль боевого сервера (tmux -L nightshift), чтение ответа из лога.
# Консольные команды не видны операторам в чате при gamerule logAdminCommands=false.
# SRV=nstest — то же самое на витрине (~/mc-nightshift-test, порт 25580) для проверки.
SRV=${SRV:-nightshift}
if [ "$SRV" = nstest ]; then LOG=~/mc-nightshift-test/logs/latest.log; else LOG=~/mc-nightshift-server/logs/latest.log; fi
T() { tmux -L $SRV send-keys -t $SRV -l "$1"; tmux -L $SRV send-keys -t $SRV Enter; sleep 0.12; }
# команда и её ответ из лога (для /scare)
say() {
	local B=$(($(wc -l < $LOG) + 1)); T "$1"; sleep 0.5
	tail -n +$B $LOG | grep -a -E "\[scare\]|Unknown|Incorrect|error" | sed 's/^.*\]: //'
}
# позиция игрока: печатает "X Y Z" (целые)
pos() {
	local B=$(($(wc -l < $LOG) + 1)); T "data get entity $1 Pos"; sleep 0.4
	tail -n +$B $LOG | grep -a -o "entity data: \[[^]]*\]" | tail -1 | python3 -c "
import re,sys,math; p=[float(v.rstrip('d')) for v in re.findall(r'-?[0-9.]+d',sys.stdin.read())]; print(math.floor(p[0]),math.floor(p[1]),math.floor(p[2]))"
}
# угол взгляда (yaw)
yaw() {
	local B=$(($(wc -l < $LOG) + 1)); T "data get entity $1 Rotation[0]"; sleep 0.3
	tail -n +$B $LOG | grep -a -o "$1 has the following entity data: -\?[0-9.]*" | tail -1 | awk '{print $NF}'
}
# копия участка в небо и обратно (для обратимых подмен блоков); лимит команд на время поднимается
backup() { T "gamerule commandModificationBlockLimit 200000"; T "clone $1 $2 $3 $4 $5 $6 $1 $7 $3 replace"; }
restore_all() { T "clone $1 $7 $3 $4 $(($7 + $5 - $2)) $6 $1 $2 $3 replace"; }
restore_only() { T "clone $1 $7 $3 $4 $(($7 + $5 - $2)) $6 $1 $2 $3 filtered $8"; }
drop_backup() { T "fill $1 $7 $3 $4 $(($7 + $5 - $2)) $6 minecraft:air"; T "gamerule commandModificationBlockLimit 32768"; }
