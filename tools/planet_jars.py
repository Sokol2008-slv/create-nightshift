#!/usr/bin/env python3
"""Скачивает (один раз, в кэш) jar-файлы, по которым сверяются планеты: Northstar, Create, Sable,
KubeJS — по url из mods/*.pw.toml, и клиент Minecraft 1.21.1 — с серверов Mojang.

Кэш: ~/.cache/nightshift-jars (или $NS_JAR_CACHE). Используют tools/gen_planet_textures.py
и tools/check_planets.py.
"""
import json
import os
import pathlib
import re
import urllib.request
import zipfile

PACK = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(os.environ.get("NS_JAR_CACHE", pathlib.Path.home() / ".cache" / "nightshift-jars"))
MC_VERSION = "1.21.1"


def _download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        f.write(r.read())
    tmp.rename(dest)


def mod_jar(pw_name):
    """jar мода по файлу mods/<pw_name>.pw.toml."""
    meta = (PACK / "mods" / f"{pw_name}.pw.toml").read_text()
    url = re.search(r'^url\s*=\s*"([^"]+)"', meta, re.M).group(1)
    fn = re.search(r'^filename\s*=\s*"([^"]+)"', meta, re.M).group(1)
    dest = CACHE / fn
    if not dest.is_file():
        print(f"скачиваю {fn} ...")
        _download(url, dest)
    return zipfile.ZipFile(dest)


def vanilla_jar():
    dest = CACHE / f"minecraft-{MC_VERSION}-client.jar"
    if not dest.is_file():
        print(f"скачиваю клиент Minecraft {MC_VERSION} ...")
        with urllib.request.urlopen("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json") as r:
            manifest = json.load(r)
        vurl = next(v["url"] for v in manifest["versions"] if v["id"] == MC_VERSION)
        with urllib.request.urlopen(vurl) as r:
            client = json.load(r)["downloads"]["client"]["url"]
        _download(client, dest)
    return zipfile.ZipFile(dest)
