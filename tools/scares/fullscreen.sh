#!/bin/bash
# Скример на весь экран без рестарта: лицо древнего стража поверх экрана + проклятие стража и крик.
# ./fullscreen.sh <ник>
. "$(dirname "$0")/_lib.sh"
P=${1:?ник}
T "execute at $P run particle minecraft:elder_guardian ~ ~ ~ 0 0 0 0 1 force $P"
T "execute at $P run playsound minecraft:entity.elder_guardian.curse hostile $P ~ ~ ~ 1 0.8"
T "execute at $P run playsound minecraft:entity.enderman.scream hostile $P ~ ~ ~ 1 0.5"
T "execute at $P run playsound minecraft:entity.enderman.stare hostile $P ~ ~ ~ 1 0.6"
echo "на весь экран: $P"
