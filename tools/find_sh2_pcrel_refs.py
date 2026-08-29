#!/usr/bin/env python3
"""Find SH-2 PC-relative MOV.L loads and MOVA address calculations."""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_number(value: str) -> int:
    return int(value, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--base-address", type=parse_number, required=True)
    parser.add_argument("targets", metavar="TARGET", type=parse_number, nargs="+")
    arguments = parser.parse_args()

    image = arguments.image.read_bytes()
    targets = set(arguments.targets)
    matches = 0
    for offset in range(0, len(image) - 4, 2):
        instruction = int.from_bytes(image[offset : offset + 2], "big")
        instruction_address = arguments.base_address + offset
        displacement = instruction & 0xFF
        literal_address = (instruction_address & ~3) + 4 + displacement * 4
        literal_offset = literal_address - arguments.base_address
        if instruction >> 12 == 0xD:
            if literal_offset < 0 or literal_offset + 4 > len(image):
                continue
            value = int.from_bytes(image[literal_offset : literal_offset + 4], "big")
            if value not in targets:
                continue
            register = (instruction >> 8) & 0xF
            print(
                f"kind=mov.l instruction=0x{instruction_address:08x} "
                f"opcode=0x{instruction:04x} rn=r{register} "
                f"literal=0x{literal_address:08x} value=0x{value:08x}"
            )
            matches += 1
        elif instruction >> 8 == 0xC7 and literal_address in targets:
            print(
                f"kind=mova instruction=0x{instruction_address:08x} "
                f"opcode=0x{instruction:04x} rn=r0 address=0x{literal_address:08x}"
            )
            matches += 1

    if matches == 0:
        print("No matching SH-2 PC-relative MOV.L references found.")


if __name__ == "__main__":
    main()