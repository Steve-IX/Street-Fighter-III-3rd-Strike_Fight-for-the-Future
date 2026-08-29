# Changelog

## Unreleased

- Added a Railway-ready browser launcher using the EmulatorJS FBNeo core, a responsive arcade UI, persistent keyboard/controller mapping, and private-room ROM fingerprint signaling.
- Added production static-file streaming, compression, cache validators, immutable ROM-asset cache headers, and COOP/COEP headers for browser WebAssembly performance.
- Added an explicit opt-in, loopback-only local ROM route so development sessions can auto-load the ignored `sfiii3.zip` without making public deployments serve ROM files.
- Fixed browser FBNeo loading by preserving the required `sfiii3.zip` virtual filename for arcade ZIP archives; verified the local launcher reaches the 3rd Strike attract screen.
- Documented that private rooms establish signaling/peer transport only; deterministic synchronized gameplay has not been implemented or validated.
- Added a read-only ZIP/ROM-set inspector with archive and member hashes.
- Recorded the immutable input baseline in `inventory.json` and the reverse-engineering report.
- Matched the baseline archive to upstream FBNeo driver `sfiii3` (Europe 990608) and documented its program/graphics regions and initialization keys.
- Added a source-derived, input-hash-locked program decryption tool; the generated 16 MiB image passes SH-2 reset-vector validation.
- Recorded a static 20-entry Gill-first character-name sequence and explicitly rejected it as a roster-control finding pending debugger or Ghidra cross-reference evidence.
- Verified that the available local RetroArch installation has no compatible FinalBurn/FBNeo core; runtime validation remains blocked.
- Provisioned and hash-verified isolated FBNeo and Ghidra 12.1.3 releases; completed a targeted SH-2 Ghidra import and anchor annotation pass.
- Confirmed that the targeted Ghidra project currently has no decoded references to the Gill metadata anchors.
- Verified that the hash-identical unmodified working copy is accepted by FBNeo and reaches emulation initialization; no interactive gameplay claim is made.
- Ran Ghidra incremental analysis from the verified reset entry; it still produced no decoded reference to the Gill metadata anchors, so no roster patch was created.
- Identified and labeled the vector-70 frame dispatcher, its per-frame input-polling function, and one indirect input consumer. Direct selection-path linkage remains unproven.
- Added a read-only FBNeo Lua tracer for live validation of the shared P1/P2 input-state RAM.
- No ROM data, patches, or runtime behavior have been changed or validated.