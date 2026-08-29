#!/usr/bin/env python3
"""Copy the verified input archive to an isolated FBNeo ROM directory."""

from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path


INPUT_SHA256 = "8b9a0002654f289e37f58c3e26bb4111fde105e75a0834c80fa2e660f4b116d8"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_archive", type=Path)
    parser.add_argument("fbneo_rom_directory", type=Path)
    arguments = parser.parse_args()

    source_hash = sha256_file(arguments.input_archive)
    if source_hash != INPUT_SHA256:
        parser.error(f"unexpected input SHA-256: {source_hash}")

    destination = arguments.fbneo_rom_directory / "sfiii3.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(arguments.input_archive, destination)
    destination_hash = sha256_file(destination)
    if destination_hash != source_hash:
        destination.unlink(missing_ok=True)
        raise RuntimeError("working-copy SHA-256 mismatch; copy removed")

    print(f"Staged verified working copy: {destination}")


if __name__ == "__main__":
    main()