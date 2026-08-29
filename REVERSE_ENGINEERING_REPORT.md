# Street Fighter III: 3rd Strike Gill Project Report

## Evidence Status

This report separates verified facts from hypotheses. It contains no claim that Gill is currently selectable or that a modified set runs.

## Phase 1 Baseline: Verified

| Field | Value |
| --- | --- |
| Input archive | `StreetFighter/ROMS/sfiii3.zip` |
| Archive size | 70,592,155 bytes |
| Archive SHA-256 | `8b9a0002654f289e37f58c3e26bb4111fde105e75a0834c80fa2e660f4b116d8` |
| ZIP members | 41 |
| SIMM members | 40, each 2,097,152 bytes uncompressed |
| Program-ROM-named member | `sfiii3_euro.29f400.u2`, 524,288 bytes uncompressed |
| Program-ROM CRC-32 | `30bbf293` |

The complete member manifest, including file names, CRC-32 values, sizes, and SHA-256 hashes, is recorded in [inventory.json](inventory.json). `tools/inspect_romset.py` opens and reads each member, which verifies ZIP CRCs while calculating hashes. It does not extract or alter ROM data.

## FBNeo Driver Match: Verified Against Current Upstream Source

The current `finalburnneo/FBNeo` declaration in `src/burn/drv/cps3/d_cps3.cpp` identifies this exact member set as parent driver `sfiii3`, **Street Fighter III 3rd Strike: Fight for the Future (Europe 990608)**. The archive's 41 names, sizes, and CRC-32 values match `sfiii3RomDesc` and `SFIII3_990608_FLASH`.

| Region classification | Members | Total uncompressed size |
| --- | --- | --- |
| SH-2 BIOS | `sfiii3_euro.29f400.u2` | 512 KiB |
| Program (`BRF_PRG`) | `sfiii3-simm1.0` through `sfiii3-simm2.3` | 16 MiB |
| Graphics (`BRF_GRA`) | `sfiii3-simm3.0` through `sfiii3-simm6.7` | 64 MiB |

The same driver initializes CPS-3 for this set with `cps3_key1 = 0xa55432b4` and `cps3_key2 = 0x0c129981` before calling `cps3Init()`. These are emulator-loading observations, not yet a Ghidra import specification. The public source is a reference implementation; the locally installed emulator revision has not been identified.

## CPS-3 / FBNeo Loading Path

### Local Hypothesis

The `sfiii3` FBNeo driver loads the SH-2 BIOS plus program and graphics SIMM regions, configures the two set-specific CPS-3 keys, then invokes `cps3Init()`. The executable code Ghidra needs is therefore not assumed to be a raw individual ZIP member.

### Evidence

- Each source-declared `sfiii3` ROM name, size, and CRC-32 matches [inventory.json](inventory.json).
- FBNeo classifies SIMM banks 1–2 as `BRF_PRG` and banks 3–6 as `BRF_GRA`.
- `sfiii3Init()` supplies keys `0xa55432b4` and `0x0c129981` to `cps3Init()`.

### Cheapest Falsifying Check

Trace or inspect the installed FBNeo build's `cps3Init()` decryption path and compare its post-decryption SH-2 memory to the candidate Ghidra import. A different key flow or memory image disproves this loading-path hypothesis.

## Decrypted Program Image: Structurally Validated

`tools/decrypt_sfiii3_program.py` reproduces the upstream loader for this hash-locked input: it interleaves each group of four 2 MiB program SIMMs with a four-byte stride, then applies the source `cps3_mask` transformation to each big-endian word using the verified keys. It writes only to a caller-selected path; the recommended `analysis/` directory is ignored.

| Field | Value |
| --- | --- |
| Decrypted image size | 16,777,216 bytes |
| Decrypted image SHA-256 | `2970d33d70f1d440dc5f3375ac3e3f697c67c5cf612a2b6554fef4eb0e1d21f8` |
| Execution mapping | `0x06000000` through `0x06ffffff` |
| Reset PC | `0x06000ea0` |
| Reset stack pointer | `0x02008f94` |

The PC is inside FBNeo's mapped decrypted program range, and the stack pointer is inside its main-RAM range (`0x02000000` through `0x0207ffff`). This is a structural validation of lane ordering, decryption, and word order. It does not substitute for an emulator memory comparison or a successful game boot.

## Ghidra Import Procedure

1. Run `python StreetFighter/tools/decrypt_sfiii3_program.py StreetFighter/ROMS/sfiii3.zip StreetFighter/analysis/sfiii3_990608_program_decrypted.bin`.
2. Import the resulting raw binary with language `SuperH:BE:32:SH-2` and the default compiler specification.
3. Set the image base to `0x06000000`, analyze it, and create an entry point at `0x06000ea0`.
4. Do not treat a static match or text hit as a roster-table finding until a cross-reference or emulator trace connects it to selection and match initialization.

## Local Toolchain and Targeted Ghidra Result: Verified

An official Ghidra 12.1.3 release was downloaded into ignored `toolchain/` and its published SHA-256 was verified as `93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54`. Its headless launcher runs with the installed Java 23 runtime. The local Ghidra project is in ignored `analysis/ghidra-projects/sfiii3_990608`.

The project import used `BinaryLoader`, base address `0x06000000`, block name `Decrypted SH-2 Program`, language `SuperH:BE:32:SH-2`, and default compiler specification. A targeted Java Ghidra script, `tools/AnnotateSfiii3.java`, disassembled and named reset entry `0x06000ea0`, ran Ghidra's incremental `analyzeChanges(currentProgram)` pass, and labeled the two previously verified metadata anchors.

The script reported zero decoded references to `character_name_metadata` (`0x06197354`) and `character_name_descriptors` (`0x066104fc`) after the reset-seeded incremental analysis pass. This falsifies the narrower hypothesis that code directly discovered from reset provides a decoded reference to either anchor. It does not prove the metadata is unused or identify the roster controller: character select can still be reached through indirect dispatch, runtime-loaded pointers, or unseeded code.

## Frame and Input Path: Verified Static Evidence

SH-2 vector entry 70 targets `0x06000528`, now named `frame_dispatch`. Its decompilation establishes a per-frame indirect dispatcher that calls multiple subsystem functions through a low-ROM pointer table. It invokes `input_polling` at `0x06133124` during each frame.

`input_polling` reads and combines CPS-3 input words into shared RAM locations `0x0206aa8c` through `0x0206aa92` plus `0x0206aa9c` and `0x0206aa9d`. `tools/find_absolute_values.py` and `tools/find_sh2_pcrel_refs.py` reproduce the input consumers' static literal locations.

A bounded disassembly at `0x0612d140` established an SH-2 function boundary that consumes these input locations; it is named `input_consumer_0612d140`. Its decompilation maps a one-bit parameter to one of two input words, normalizes a small result through threshold checks, and stores the result. This is compatible with player-side input mapping but is not enough to identify character select.

`tools/find_sh2_bsr_refs.py` found no direct SH-2 `BSR` call to `0x0612d140`; the current evidence therefore supports an indirect, computed, or still-unseeded caller. No semantic name beyond `input_consumer_0612d140` is assigned.

`tools/trace_input_state.lua` is a read-only FBNeo Lua tracer for the verified shared input-state RAM. When loaded through FBNeo's Lua Script window after the game has started, it writes changed P1, P2, and system input values to a CSV file. It does not write emulated memory, inject input, or modify ROM data. Its successful runtime load and output are pending an interactive emulator session.

An official FBNeo x64 nightly was likewise downloaded into ignored `toolchain/` and verified against its published SHA-256 `3e4db3d4c0d37c77b943053943d6eeb09ae9fb299b8e3e85f6b8aac9fbd117b4`. A hash-identical working copy of the input archive was staged solely in the ignored FBNeo ROM directory.

The hash-verified FBNeo debug build logged the following observations during `sfiii3 -w`:

- `sfiii3 was found (roms/arcade/sfiii3).`
- `The ROMset is OK.`
- `*** Starting emulation of sfiii3 - Street Fighter III 3rd Strike: Fight for the Future (Europe 990608).`

This verifies ROM discovery, driver checksum acceptance, and emulator initialization for the unmodified working copy. The process was stopped after this observation. It is not evidence of title-screen, character-select, match, Gill, or netplay behavior.

## Character Name Metadata: Static Observation

The decrypted image has an 8-byte, null-padded ordered name sequence at `0x06197354`:

`GILL`, `ALEX`, `RYU`, `YUN`, `DUDLEY`, `NECRO`, `HUGO`, `IBUKI`, `ELENA`, `ORO`, `YANG`, `KEN`, `SEAN`, `URIEN`, `GOUKI 1`, `GOUKI 2`, `CHUN-LI`, `KARATE`, `Q`, `No.12`.

A nearby 12-byte descriptor sequence at `0x066104fc` begins with a pointer to the Gill entry and contains the same `0x000b, 0x0003, 0x0002` fields for all entries in that sequence. `tools/scan_ascii_region.py` reproduces this observation.

`tools/find_sh2_pcrel_refs.py` found no direct `MOV.L @(disp,PC)` or `MOVA @(disp,PC),R0` reference to the Gill string or descriptor start. This does **not** prove the metadata is unused: the address may be composed through other instructions, accessed through a global pointer, or used by a different code path. It does prove that neither tested direct-PC-relative form identifies the character-select controller.

### Current Character-Select Hypothesis

The 20-entry sequence is likely a character-ID-to-name metadata table, with Gill occupying the first observed entry. It is not yet established as the normal select-screen roster or as a player-safe initialization table.

### Cheapest Falsifying Check

In a Ghidra import or FBNeo debugger, break on reads of the descriptor/name table while entering character select and while a match starts. If no select-screen path reaches it, it is not the select display table; if the selected ID reaches match initialization, trace its linked character-definition records before any modification.

## Unverified Items

- Title-screen, character-select, match, Gill, and netplay behavior in FBNeo.
- Post-decryption memory comparison against an installed FBNeo build.
- Character-select roster, Gill character ID, eligibility gates, initialization path, and player-side safety.
- Any runtime or netplay compatibility of a modified set.
- The character-select state machine, roster table, eligibility check, player-side assignment, and Gill-safe match initialization path.