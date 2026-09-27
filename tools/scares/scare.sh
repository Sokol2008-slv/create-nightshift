#!/bin/bash
# Скримеры из серверного KubeJS (/scare, kubejs/server_scripts/scares/10_scares.js):
#   ./scare.sh mono <ник> [hunt|stalk|dash|chase]   — Монохром
#   ./scare.sh faces <ник> [радиус] [сек]            — блоки вокруг становятся глазами
#   ./scare.sh stop                                   — всё убрать
# SRV=nstest ./scare.sh … — на витрине
. "$(dirname "$0")/_lib.sh"
say "scare $*"
