#!/usr/bin/env python3
"""Find case-insensitive ASCII text occurrences in a binary image."""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_number(value: str) -> int:
    return int(value, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--base-address", type=parse_number, required=True)
    parser.add_argument("text", nargs="+")
    arguments = parser.parse_args()

    image = arguments.image.read_bytes().lower()
    for text in arguments.text:
        needle = text.encode("ascii").lower()
        locations = [
            arguments.base_address + offset
            for offset in range(len(image))
            if image.startswith(needle, offset)
        ]
        print(f"{text}: {', '.join(f'0x{location:08x}' for location in locations)}")


if __name__ == "__main__":
    main()