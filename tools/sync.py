#!/usr/bin/env python3
"""Раскладывает моды из packwiz-метаданных в папку mods/ сервера или клиента.

Использование: sync.py <server|client> <целевая папка .minecraft или сервера>
- качает jar по url из *.pw.toml, сверяет хеш, лишние jar удаляет;
- «сырые» jar из mods/ пака (например, e4steam с CurseForge) копирует как есть;
- копирует config/, kubejs/, defaultconfigs/, shaderpacks/ из пака, если они есть.
"""
import concurrent.futures as cf
import hashlib
import pathlib
import re
import shutil
import sys
import urllib.parse
import urllib.request

PACK = pathlib.Path(__file__).resolve().parent.parent
side = sys.argv[1]
target = pathlib.Path(sys.argv[2])
mods_dir = target / "mods"
mods_dir.mkdir(parents=True, exist_ok=True)


def field(text, key):
    m = re.search(rf'^{key}\s*=\s*"([^"]*)"', text, re.M)
    return m.group(1) if m else None


def digest(path, algo):
    h = hashlib.new(algo)
    h.update(path.read_bytes())
    return h.hexdigest()


def collect(folder):
    entries = []
    for meta in sorted((PACK / folder).glob("*.pw.toml")):
        t = meta.read_text()
        s = field(t, "side") or "both"
        # сервер не получает клиентские моды и наоборот
        if (side == "server" and s == "client") or (side == "client" and s == "server"):
            continue
        url = field(t, "url")
        fn = field(t, "filename")
        if not url:
            # мод CurseForge (mode = metadata:curseforge): качаем с их CDN по file-id
            fid = int(re.search(r"^file-id\s*=\s*(\d+)", t, re.M).group(1))
            url = f"https://mediafilez.forgecdn.net/files/{fid // 1000}/{fid % 1000}/{urllib.parse.quote(fn)}"
        entries.append((folder, fn, url, field(t, "hash-format"), field(t, "hash")))
    return entries


entries = collect("mods")
if side == "client":
    entries += collect("shaderpacks") + collect("resourcepacks")


def fetch(e):
    folder, fn, url, algo, want = e
    dest = target / folder / fn
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and digest(dest, algo) == want:
        return None
    req = urllib.request.Request(url, headers={"User-Agent": "georgij/create-nightshift"})
    with urllib.request.urlopen(req, timeout=120) as r:
        dest.write_bytes(r.read())
    got = digest(dest, algo)
    if got != want:
        dest.unlink()
        return f"ХЕШ НЕ СОВПАЛ: {fn}"
    return f"скачан {fn}"


with cf.ThreadPoolExecutor(12) as ex:
    for res in ex.map(fetch, entries):
        if res:
            print(res)

# сырые jar, лежащие прямо в паке
raw = [p for p in (PACK / "mods").glob("*.jar")]
for p in raw:
    shutil.copy2(p, mods_dir / p.name)

# убираем jar, которых больше нет в паке
keep = {e[1] for e in entries if e[0] == "mods"} | {p.name for p in raw}
for p in mods_dir.glob("*.jar"):
    if p.name not in keep:
        print(f"удалён лишний {p.name}")
        p.unlink()

# Эти папки зеркалим точно: удалённый из пака скрипт/глава должен исчезнуть и с цели
# (иначе на сервере живут старые скрипты KubeJS и старые главы книги).
MIRROR = ("kubejs/server_scripts", "kubejs/startup_scripts", "kubejs/client_scripts", "kubejs/data",
          "kubejs/assets", "config/ftbquests")
for d in MIRROR:
    if (PACK / d).exists() and (target / d).exists():
        shutil.rmtree(target / d)

for d in ("config", "kubejs", "defaultconfigs"):
    src = PACK / d
    if src.exists():
        shutil.copytree(src, target / d, dirs_exist_ok=True)

# стартовые настройки клиента кладём только один раз, чтобы не затирать свои
if side == "client" and not (target / "options.txt").exists():
    shutil.copy2(PACK / "options.txt", target / "options.txt")

print(f"готово: {len(list(mods_dir.glob('*.jar')))} jar в {mods_dir}")
