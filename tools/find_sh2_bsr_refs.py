#!/usr/bin/env python3
"""Find SH-2 BSR relative calls targeting specified addresses."""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_number(value: str) -> int:
    return int(value, 0)


def sign_extend_12(value: int) -> int:
    return value - 0x1000 if value & 0x800 else value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--base-address", type=parse_number, required=True)
    parser.add_argument("targets", metavar="TARGET", type=parse_number, nargs="+")
    arguments = parser.parse_args()

    image = arguments.image.read_bytes()
    targets = set(arguments.targets)
    matches = 0
    for offset in range(0, len(image) - 1, 2):
        instruction = int.from_bytes(image[offset : offset + 2], "big")
        if instruction >> 12 != 0xB:
            continue
        instruction_address = arguments.base_address + offset
        target = instruction_address + 4 + sign_extend_12(instruction & 0xFFF) * 2
        if target in targets:
            print(f"instruction=0x{instruction_address:08x} target=0x{target:08x}")
            matches += 1
    if matches == 0:
        print("No matching SH-2 BSR references found.")


if __name__ == "__main__":
    main()