#!/usr/bin/env python3
"""Inspect a CPS-3 ROM ZIP without extracting or modifying it."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_archive(archive_path: Path) -> dict[str, object]:
    with ZipFile(archive_path) as archive:
        members = []
        for info in archive.infolist():
            members.append(
                {
                    "name": info.filename,
                    "crc32": f"{info.CRC:08x}",
                    "compressed_size": info.compress_size,
                    "uncompressed_size": info.file_size,
                    "sha256": hashlib.sha256(archive.read(info)).hexdigest(),
                }
            )

    return {
        "archive": str(archive_path),
        "archive_size": archive_path.stat().st_size,
        "archive_sha256": sha256_file(archive_path),
        "member_count": len(members),
        "members": members,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="path to the input ROM ZIP")
    arguments = parser.parse_args()

    if not arguments.archive.is_file():
        parser.error(f"archive does not exist: {arguments.archive}")

    print(json.dumps(inspect_archive(arguments.archive), indent=2))


if __name__ == "__main__":
    main()