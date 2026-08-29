#!/usr/bin/env python3
"""Print ASCII strings and a hex dump from a bounded binary-image region."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def parse_number(value: str) -> int:
    return int(value, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--base-address", type=parse_number, required=True)
    parser.add_argument("--start", type=parse_number, required=True)
    parser.add_argument("--length", type=parse_number, required=True)
    arguments = parser.parse_args()

    image = arguments.image.read_bytes()
    image_offset = arguments.start - arguments.base_address
    region = image[image_offset : image_offset + arguments.length]
    if len(region) != arguments.length:
        parser.error("requested region is outside the image")

    for match in re.finditer(rb"[ -~]{3,}", region):
        address = arguments.start + match.start()
        print(f"{address:08X}: {match.group().decode('ascii')}")

    print("\nHex dump:")
    for offset in range(0, len(region), 16):
        row = region[offset : offset + 16]
        print(f"{arguments.start + offset:08X}  {row.hex(' ')}")


if __name__ == "__main__":
    main()