#!/usr/bin/env python3
"""Create the decrypted SH-2 program image for the verified sfiii3 ZIP."""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile


INPUT_SHA256 = "8b9a0002654f289e37f58c3e26bb4111fde105e75a0834c80fa2e660f4b116d8"
KEY1 = 0xA55432B4
KEY2 = 0x0C129981
PROGRAM_BASE = 0x06000000
PROGRAM_SIZE = 0x1000000
SIMM_SIZE = 0x200000
PROGRAM_MEMBERS = tuple(
    f"sfiii3-simm{bank}.{lane}" for bank in range(1, 3) for lane in range(4)
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rotate_left(value: int, bits: int) -> int:
    return ((value << bits) | (value >> (16 - bits))) & 0xFFFF


def rotxor(value: int, xor_value: int) -> int:
    original_value = value
    summed_value = (value + rotate_left(value, 2)) & 0xFFFF
    return rotate_left(summed_value, 4) ^ (summed_value & (original_value ^ xor_value))


def cps3_mask(address: int) -> int:
    address ^= KEY1
    value = (address & 0xFFFF) ^ 0xFFFF
    value = rotxor(value, KEY2 & 0xFFFF)
    value ^= (address >> 16) ^ 0xFFFF
    value = rotxor(value, KEY2 >> 16)
    value ^= (address & 0xFFFF) ^ (KEY2 & 0xFFFF)
    value &= 0xFFFF
    return value | (value << 16)


def load_interleaved_program(archive_path: Path) -> bytearray:
    program = bytearray(PROGRAM_SIZE)
    with ZipFile(archive_path) as archive:
        archive_names = set(archive.namelist())
        missing = set(PROGRAM_MEMBERS) - archive_names
        if missing:
            raise ValueError(f"archive is missing program members: {sorted(missing)}")

        for group in range(2):
            group_offset = group * SIMM_SIZE * 4
            for lane in range(4):
                member_name = PROGRAM_MEMBERS[group * 4 + lane]
                member = archive.read(member_name)
                if len(member) != SIMM_SIZE:
                    raise ValueError(f"unexpected size for {member_name}: {len(member)}")
                program[group_offset + lane : group_offset + SIMM_SIZE * 4 : 4] = member
    return program


def decrypt_program(encrypted_program: bytearray) -> bytearray:
    decrypted_program = bytearray(PROGRAM_SIZE)
    for offset in range(0, PROGRAM_SIZE, 4):
        encrypted_word = int.from_bytes(encrypted_program[offset : offset + 4], "big")
        decrypted_word = encrypted_word ^ cps3_mask(PROGRAM_BASE + offset)
        decrypted_program[offset : offset + 4] = decrypted_word.to_bytes(4, "big")
    return decrypted_program


def write_atomically(output_path: Path, contents: bytearray) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output_path.parent, delete=False) as temporary_file:
        temporary_path = Path(temporary_file.name)
        temporary_file.write(contents)
    temporary_path.replace(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="verified sfiii3 ZIP input")
    parser.add_argument("output", type=Path, help="decrypted program image output")
    parser.add_argument("--force", action="store_true", help="replace an existing output")
    arguments = parser.parse_args()

    source_hash = sha256_file(arguments.archive)
    if source_hash != INPUT_SHA256:
        parser.error(f"unexpected input SHA-256: {source_hash}")
    if arguments.output.exists() and not arguments.force:
        parser.error(f"output already exists: {arguments.output}; pass --force to replace it")

    decrypted_program = decrypt_program(load_interleaved_program(arguments.archive))
    write_atomically(arguments.output, decrypted_program)
    print(
        json.dumps(
            {
                "input_sha256": source_hash,
                "output": str(arguments.output),
                "output_size": len(decrypted_program),
                "output_sha256": hashlib.sha256(decrypted_program).hexdigest(),
                "load_address": f"0x{PROGRAM_BASE:08x}",
                "endianness": "big",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()