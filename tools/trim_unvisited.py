#!/usr/bin/env python3
"""Стирает из мира чанки, где игроки не бывали, — они сгенерируются заново по текущей генерации пака
(месторождения форпостов, небесные острова, новые правила руд). 04.10.2026: мир был прогенерирован Chunky
до 3.3.0, и всё новое появлялось только «в новых чанках».

Как решаем «бывали ли»: InhabitedTime чанка (тики, когда рядом был игрок; растёт в радиусе ~8 чанков вокруг игрока).
Оставляем чанк, если InhabitedTime > --min-ticks, плюс запас --margin чанков вокруг таких и круги --keep x,z,радиус
(в блоках) — например, вокруг баз. Остальные стираются: в заголовке region/, entities/ и poi/ обнуляется запись
чанка (данные секторов остаются мусором в файле — игре это не мешает), регион без живых чанков удаляется целиком.

ТОЛЬКО при остановленном сервере и после бэкапа мира. Сначала --dry-run.
Пример: python3 tools/trim_unvisited.py ~/mc-nightshift-server/world --margin 3 --keep -64,-480,600 --dry-run
"""
import argparse
import glob
import gzip
import math
import os
import struct
import sys
import zlib

KEY = b'\x04\x00\x0dInhabitedTime'


def chunk_nbt(path, data, i):
    """Распакованный NBT чанка i из файла региона или None."""
    off = int.from_bytes(data[i * 4:i * 4 + 3], 'big')
    if not off:
        return None
    p = off * 4096
    ln = struct.unpack('>I', data[p:p + 4])[0]
    comp = data[p + 4]
    raw = data[p + 5:p + 4 + ln]
    if comp & 128:  # чанк больше 1 МБ лежит отдельным файлом c.x.z.mcc
        rx, rz = map(int, os.path.basename(path)[2:-4].split('.'))
        mcc = os.path.join(os.path.dirname(path), 'c.%d.%d.mcc' % (rx * 32 + i % 32, rz * 32 + i // 32))
        raw = open(mcc, 'rb').read() if os.path.exists(mcc) else b''
        comp &= 127
    try:
        if comp == 2:
            return zlib.decompress(raw)
        if comp == 1:
            return gzip.decompress(raw)
        if comp == 3:
            return raw
    except Exception:
        return None
    return None  # lz4 и прочее — считаем «неизвестно» (оставим чанк)


def inhabited(nbt):
    k = nbt.find(KEY)
    return struct.unpack('>q', nbt[k + len(KEY):k + len(KEY) + 8])[0] if k >= 0 else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('world', help='папка мира (с region/, entities/, poi/) — для Верхнего мира')
    ap.add_argument('--min-ticks', type=int, default=0, help='оставлять чанки с InhabitedTime больше этого (тики)')
    ap.add_argument('--margin', type=int, default=3, help='запас вокруг посещённых чанков (в чанках)')
    ap.add_argument('--keep', action='append', default=[], help='x,z,радиус в блоках — круг, который не трогать')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    reg_dir = os.path.join(a.world, 'region')
    files = sorted(glob.glob(os.path.join(reg_dir, 'r.*.*.mca')))
    if not files:
        sys.exit('нет region/*.mca в ' + a.world)
    if os.path.exists(os.path.join(a.world, 'session.lock')) and not a.dry_run:
        print('напоминание: сервер должен быть остановлен (session.lock есть всегда, проверьте сами)')

    # 1. какие чанки есть и какие посещены
    present = {}  # (cx, cz) -> (файл, индекс)
    visited = set()
    unknown = set()
    for path in files:
        rx, rz = map(int, os.path.basename(path)[2:-4].split('.'))
        data = open(path, 'rb').read()
        if len(data) < 8192:
            continue
        for i in range(1024):
            if not int.from_bytes(data[i * 4:i * 4 + 3], 'big'):
                continue
            c = (rx * 32 + i % 32, rz * 32 + i // 32)
            present[c] = (path, i)
            nbt = chunk_nbt(path, data, i)
            if nbt is None:
                unknown.add(c)
            elif inhabited(nbt) > a.min_ticks:
                visited.add(c)

    # 2. что оставить: посещённые + запас + круги
    keep = set(unknown)
    m = a.margin
    for (cx, cz) in visited:
        for dx in range(-m, m + 1):
            for dz in range(-m, m + 1):
                keep.add((cx + dx, cz + dz))
    circles = []
    for k in a.keep:
        x, z, r = map(float, k.split(','))
        circles.append((x, z, r))
    def in_circle(c):
        bx, bz = c[0] * 16 + 8, c[1] * 16 + 8
        return any(math.hypot(bx - x, bz - z) <= r + 12 for (x, z, r) in circles)

    drop = [c for c in present if c not in keep and not in_circle(c)]
    far = max((math.hypot(c[0] * 16, c[1] * 16) for c in visited), default=0)
    print('чанков в мире: %d, посещённых: %d (дальний %.0f бл.), нечитаемых (оставлены): %d' % (len(present), len(visited), far, len(unknown)))
    print('оставляем: %d, стираем: %d (%.1f %%)' % (len(present) - len(drop), len(drop), 100.0 * len(drop) / max(1, len(present))))
    if a.dry_run:
        return

    # 3. стираем записи в region/, entities/, poi/; пустые регионы — целиком
    by_file = {}
    for c in drop:
        by_file.setdefault(os.path.basename(present[c][0]), []).append(present[c][1])
    removed_files = 0
    for sub in ('region', 'entities', 'poi'):
        d = os.path.join(a.world, sub)
        if not os.path.isdir(d):
            continue
        for name, idx in by_file.items():
            path = os.path.join(d, name)
            if not os.path.exists(path):
                continue
            data = bytearray(open(path, 'rb').read())
            if len(data) < 8192:
                continue
            for i in idx:
                data[i * 4:i * 4 + 4] = b'\x00\x00\x00\x00'  # смещение и число секторов
                data[4096 + i * 4:4096 + i * 4 + 4] = b'\x00\x00\x00\x00'  # время записи
                cx = int(name.split('.')[1]) * 32 + i % 32
                cz = int(name.split('.')[2]) * 32 + i // 32
                mcc = os.path.join(d, 'c.%d.%d.mcc' % (cx, cz))
                if os.path.exists(mcc):
                    os.remove(mcc)
            if not any(data[0:4096]):
                os.remove(path)
                removed_files += 1
            else:
                open(path, 'wb').write(bytes(data))
    print('готово: стёрто %d чанков, удалено пустых файлов регионов: %d' % (len(drop), removed_files))


if __name__ == '__main__':
    main()
