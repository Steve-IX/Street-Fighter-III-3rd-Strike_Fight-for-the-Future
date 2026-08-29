# Street Fighter III: 3rd Strike Gill Project

<img width="1463" height="902" alt="image" src="https://github.com/user-attachments/assets/9f998a76-63f8-4593-b46a-f39c0b8a7637" />


Local research workspace for a reproducible, offline Gill-selectability modification of a legally owned FBNeo ROM set. The source archive is immutable; this project will distribute only original tools, notes, and an input-hash-locked patch when runtime validation is complete.

## Status

Phase 1 inventory is complete. The archive matches FBNeo's parent driver `sfiii3`: Street Fighter III 3rd Strike: Fight for the Future (Europe 990608). Isolated FBNeo and Ghidra release copies are available under ignored `toolchain/`. The FBNeo debug log verifies the hash-identical working copy as a valid ROM set and records that emulation started. No ROM bytes have been modified or extracted.

## Baseline Inspection

Run from the workspace root:

```powershell
python StreetFighter/tools/inspect_romset.py StreetFighter/ROMS/sfiii3.zip
```

The generated [inventory.json](inventory.json) records the source archive SHA-256 and each ZIP member's CRC-32, sizes, and SHA-256. It is safe to regenerate and does not modify the input archive.

## Next Evidence

1. Observe the unmodified `sfiii3` set booting in the local FBNeo/Fightcade build.
2. Use the isolated Ghidra 12.1.3 project under `analysis/ghidra-projects/` to continue targeted SH-2 analysis.
3. Use FBNeo debugger evidence to validate candidate selection or initialization tables.
4. Trace a selected character ID from character select through match initialization before modifying it.

## Runtime Trace

After loading `sfiii3` in the isolated FBNeo debug build, open `Game > Lua Scripting > New Lua Script Window` and run `StreetFighter/tools/trace_input_state.lua`. It reads, but never writes, the verified shared CPS-3 input-state RAM and writes changed values to `sfiii3_input_trace.csv` beside the script. This confirms live input-state behavior; it does not yet log character IDs or modify the ROM.

Please do not use this project for public ROM distribution or unconsented online play. Thank you.

## Railway Web Launcher

`web/` is a Railway-ready browser launcher for locally owned FBNeo-compatible ROM archives. It serves the EmulatorJS FBNeo core, responsive controller mapping, and private room signaling through the Railway Node service.

For local development only, the launcher can auto-load your ignored local archive without using the file picker:

```powershell
cd StreetFighter/web
$env:ALLOW_LOCAL_ROM_HOSTING = '1'
npm start
```

Then open `http://localhost:3000/`. The `/local-rom/sfiii3.zip` route is available only when explicitly enabled and the request host is loopback; public deployments still require user-supplied local archives and must not host ROM files.

For user-supplied browser loading, choose the complete FBNeo archive named `sfiii3.zip`. Arcade cores require the ZIP to remain visible to FBNeo under that exact set name; extracting the archive or renaming it can produce a missing-romset error even when the selected file is otherwise valid.

Default Player 1 keyboard controls are `Shift` for Coin, `Enter` for Start, arrow keys for movement, `X/S/Z` for punches, and `A/Q/E` for kicks. Gamepads use Select/Back for Coin, Start/Menu for Start, D-pad or left stick for movement, and the configured face/shoulder buttons for attacks. Click **Focus game** or the game screen if the page chrome has keyboard focus.


The current room feature is signaling and a verified peer transport only. The embedded browser FBNeo core does not provide deterministic frame-input synchronization or rollback netplay, so the app must not be described as Fightcade-compatible online gameplay until that integration is implemented and tested.

Before deployment changes, run from `StreetFighter/web/`:

```powershell
npm run check
```
