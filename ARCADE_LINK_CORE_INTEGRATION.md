# Arcade Link Core Integration Plan

## Status

Arcade Link runs the FBNeo core through EmulatorJS using a pinned same-origin asset bundle. The web application has a formal adapter boundary, replay persistence, scenario metadata, and controls wired to the runtime's verified state API. Game RAM telemetry remains pending runtime instrumentation and evidence validation.

## The Correct Architecture

Do not implement save states or telemetry by scraping the canvas, guessing memory addresses in JavaScript, or serializing arbitrary JavaScript objects. The browser UI cannot authoritatively reconstruct an emulator machine state.

The required architecture is:

```text
Arcade Link UI
    |
    v
ArcadeEngine interface
    |
    +-- EmulatorJsAdapter       current compatibility adapter
    |
    +-- FbneoWasmAdapter        future controlled core adapter
                                      |
                                      +-- exported C ABI
                                      +-- serialized state buffer
                                      +-- telemetry snapshot buffer
```

The UI must only consume versioned adapter results. Core-specific details stay in the adapter.

## Adapter Contract

The adapter must expose the following operations:

```text
loadGame(url) -> Promise<void>
start() -> Promise<void>
pause() -> boolean
reset() -> boolean
stepFrame() -> boolean
submitInput(player, control, pressed) -> boolean
captureState() -> Promise<SerializedState | null>
restoreState(state) -> Promise<boolean>
readTelemetry() -> TelemetrySnapshot | null
capabilities() -> CapabilitySet
```

`CapabilitySet` is explicit:

```json
{
  "pause": true,
  "reset": true,
  "stepFrame": false,
  "input": true,
  "saveState": false,
  "telemetry": false
}
```

The current EmulatorJS adapter reports save-state support from `supportsStates()` and the presence of `getState()`/`loadState()`. It reports only the EmulatorJS frame clock as observed telemetry; game memory fields remain unavailable until FBNeo-specific hooks are validated.

## Real Save-State Solution

### Core requirement

Build or obtain a pinned FBNeo WebAssembly target with a stable state ABI. The ABI should expose a binary state buffer, not a JSON dump:

```c
uint32_t arcade_state_size(void);
uint32_t arcade_state_version(void);
int arcade_state_save(uint8_t *destination, uint32_t capacity);
int arcade_state_load(const uint8_t *source, uint32_t length);
```

The implementation must include CPU registers, RAM, VRAM/video state, sound state, timers, input latches, protection state, and any driver-specific state required to resume deterministically.

### Browser state envelope

Wrap the core buffer in a versioned envelope:

```json
{
  "schema": 1,
  "core": "fbneo",
  "coreVersion": "<pinned-build-id>",
  "game": "sfiii3",
  "romSha256": "<64 lowercase hex characters>",
  "endianness": "little",
  "stateVersion": 1,
  "bytes": "<base64 or binary attachment>"
}
```

Before loading, reject mismatched game, ROM hash, core build, state version, or byte length. State transfer over WebRTC must use the same checks plus a maximum message size and an integrity digest.

### Validation gates

1. Save a state at a known attract-screen or match checkpoint.
2. Advance a fixed number of frames with a fixed input sequence.
3. Restore the state.
4. Advance the same sequence again.
5. Compare framebuffer hash, telemetry snapshot, and subsequent input response.
6. Repeat across supported browsers and with cold/warm core starts.

Do not call this complete until the restored execution is byte-for-byte or behaviorally deterministic under a documented tolerance.

## Validated Telemetry Solution

### Source of truth

Telemetry must be produced by the instrumented FBNeo runtime or a debug export, then validated against the existing Lua tracer and Ghidra evidence. The canvas is presentation only.

### Versioned snapshot

```json
{
  "schema": 1,
  "frame": 12345,
  "timer": 72,
  "round": 1,
  "players": [
    { "characterId": 0, "health": 1000, "inputWord": 0, "previousInputWord": 0 },
    { "characterId": 1, "health": 1000, "inputWord": 0, "previousInputWord": 0 }
  ],
  "source": "fbneo-runtime",
  "confidence": "validated"
}
```

Each field requires an evidence record containing:

- ROM set and SHA-256;
- core build ID;
- address or exported symbol;
- endianness and width;
- sampling frame;
- Lua/debugger observation;
- expected range and invalid-value behavior.

Unknown fields must be `null`, never inferred. Hitboxes require a separate validated export and must not be drawn from sprite bounds.

### Recommended implementation

Expose a fixed telemetry struct from the WASM core and copy it into a shared read-only buffer once per emulated frame. The adapter reads the buffer after the frame boundary. This avoids racing mutable emulator memory and keeps UI rendering independent of core internals.

## Self-Hosted Asset Solution

### Pinning policy

Use a single pinned EmulatorJS/FBNeo distribution identified by:

- upstream commit or release tag;
- SHA-256 manifest for every loader, emulator, worker, WASM, and data file;
- license and notices;
- supported browser list;
- build command and toolchain version.

The frontend should use a configurable same-origin data root:

```text
EMULATOR_DATA_ROOT=/emulatorjs/data/
```

The default production build must not depend on an unversioned `stable` CDN path. If a CDN fallback is retained for development, it must be opt-in and clearly marked.

### Packaging layout

```text
web/public/emulatorjs/
  manifest.json
  data/
    loader.js
    emulator.min.js
    cores/
      fbneo.*
    localization/
      en-US.json
    workers/
    bios/
```

Do not copy arbitrary cache directories. Generate the directory from a pinned upstream artifact, verify the manifest during the image build, and serve it with immutable cache headers.

### Build gate

A deployment smoke test must verify:

- `/emulatorjs/data/loader.js` returns the expected digest;
- the FBNeo core asset returns `200` and the expected content type;
- `en-US.json` exists;
- the worker and WASM assets are same-origin and load under COOP/COEP;
- the emulator starts with network disabled after assets are packaged.

## Work That Can Be Completed Now

- Keep replay and scenario records independent of core state.
- Keep the adapter capability matrix visible in the UI.
- Add telemetry evidence files as addresses are validated by Lua/Ghidra.
- Add deterministic replay tests around the adapter once a controlled core is available.
- Add a pinned asset manifest and smoke test before switching production away from the CDN.

The current release completes the pinned asset bundle, real EmulatorJS state adapter, and observed frame-clock telemetry. It does not claim health, character, input-word, or hitbox telemetry because those values still require validated FBNeo runtime exports.

## Work That Requires a Core Build

- Real state serialization and restoration.
- Memory telemetry from runtime addresses.
- Hitbox export.
- Deterministic frame stepping.
- Rollback netplay.
- Authoritative practice-from-state scenarios.

## Definition of Done

The core integration is complete only when:

- the adapter reports capabilities from the actual loaded core;
- save states round-trip across a cold start and reject incompatible envelopes;
- telemetry fields have evidence-backed addresses and pass runtime cross-checks;
- all EmulatorJS assets are pinned, manifest-verified, and served locally;
- CI runs core smoke tests without network access;
- Railway deployment passes health, asset, ROM, and emulator startup checks;
- documentation identifies every supported browser and remaining limitation.
