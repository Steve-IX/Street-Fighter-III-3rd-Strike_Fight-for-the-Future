#!/usr/bin/env python3
"""Find big-endian 32-bit absolute values in a binary image."""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_number(value: str) -> int:
    return int(value, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--base-address", type=parse_number, required=True)
    parser.add_argument("values", metavar="VALUE", type=parse_number, nargs="+")
    arguments = parser.parse_args()

    image = arguments.image.read_bytes()
    for value in arguments.values:
        encoded_value = value.to_bytes(4, "big")
        locations = [
            arguments.base_address + offset
            for offset in range(len(image) - 3)
            if image.startswith(encoded_value, offset)
        ]
        print(f"0x{value:08x}: {', '.join(f'0x{location:08x}' for location in locations)}")


if __name__ == "__main__":
    main()