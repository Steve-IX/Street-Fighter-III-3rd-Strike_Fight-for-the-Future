# Arcade Link Lab Upgrade Roadmap

## 1. Purpose

Arcade Link is evolving from a browser launcher into a focused fighting-game laboratory: a reliable web cabinet for Street Fighter III: 3rd Strike, a replay and training workspace, and eventually a telemetry-aware collaborative environment.

This document is the reference point for implementation decisions, validation, and release planning. It distinguishes what is shipped from what is planned so the product never claims emulator capabilities that the current EmulatorJS/FBNeo integration does not provide.

## 2. Current Baseline

### Shipped and verified

- Node.js HTTP server serving the web client, Socket.IO signaling, cache validators, compression, and cross-origin isolation headers.
- Railway deployment using the repository-root Dockerfile.
- FBNeo through EmulatorJS in a browser canvas.
- Server ROM preload and one-click launch using `ROMS/sfiii3.zip`.
- SHA-256 ROM fingerprinting in the browser.
- Keyboard and browser Gamepad API bindings persisted in `localStorage`.
- Two-peer WebRTC signaling with room-size and ROM-fingerprint checks.
- CPS-3/SH-2 reverse-engineering tools, ROM inventory, decryption tooling, Ghidra analysis, and Lua input tracing.

### Explicitly not shipped

- Deterministic frame synchronization or rollback netplay.
- Emulator memory telemetry exposed to the browser.
- Emulator save-state capture/restore controlled by Arcade Link.
- AI coaching or a trained gameplay agent.
- Confirmed player-side Gill patch or a modified ROM.
- Fightcade-compatible online play.

## 3. Product Principles

1. **Truthful capability boundaries:** every feature must state whether it is implemented by Arcade Link, EmulatorJS, FBNeo, or only planned.
2. **Local-first experimentation:** replays, settings, annotations, and lab data should work without an account whenever possible.
3. **Reproducibility:** record ROM fingerprint, emulator version, browser, input mapping, and schema version with every replay or scenario.
4. **The game remains primary:** controls and diagnostics should support play without covering the canvas or creating visual noise.
5. **Accessible by default:** keyboard navigation, focus visibility, reduced motion, readable contrast, labels, and touch alternatives are release requirements.
6. **Legal and deployment clarity:** public ROM hosting requires an explicit project decision. Development-only ROM serving and public distribution must not be confused.

## 4. Phase 1: Product Foundation

### Delivery status: v0.2 foundation and UX slice implemented

- [x] Runtime ROM/core status model and visible state rail.
- [x] `GET /healthz` and `GET /api/rom/metadata`.
- [x] In-app preload and core failure messaging.
- [x] Node regression tests for service, ROM, CORS, metadata, and traversal behavior.
- [x] Configurable presentation modes and accessible command palette.
- [x] Collapsible controls drawer and mobile touch-control surface.
- [x] Reduced-motion and keyboard focus handling.
- [x] Versioned local replay capture, IndexedDB persistence, import, and export.
- [x] Engine adapter contract with honest unsupported save-state and telemetry reporting.
- [ ] EmulatorJS self-hosting/pinning and Railway smoke automation.
- [ ] Real save-state implementation through a patched or compatible EmulatorJS core.
- [ ] Validated telemetry hooks sourced from FBNeo runtime memory.

### 4.1 Runtime state model

Use the following states in the frontend:

- `idle`: page is ready; no ROM request started.
- `preloading`: ROM metadata or bytes are being requested.
- `ready`: ROM is available and fingerprinted; user may launch.
- `booting`: EmulatorJS loader and FBNeo core are initializing.
- `running`: the canvas is active.
- `error`: a recoverable problem is shown with a retry action and diagnostic detail.

State transitions must be centralized and reflected in the status rail, launch surface, document title, and accessible live region.

### 4.2 Observability and diagnostics

- `GET /healthz` returns service health, process uptime, and service version.
- `GET /api/rom/metadata` returns availability, byte size, modification time, filename, and a server-side SHA-256 hash without returning ROM bytes.
- ROM failures distinguish missing file, permission/read failure, and browser fetch failure.
- Deployment smoke checks validate `/healthz`, `/api/rom/metadata`, static app assets, and the ROM route.
- Console warnings remain useful, but user-facing failures must be visible in the interface.

### 4.3 Testing

The Node built-in test runner covers:

- health and metadata response shape;
- ROM `GET` and `HEAD` headers;
- missing-ROM behavior;
- CORS and OPTIONS behavior;
- room ID and ROM fingerprint validation;
- static path traversal rejection.

Tests must not require the proprietary ROM in CI. Use an injected temporary `ROM_PATH` fixture or test the missing-ROM branch.

### 4.4 Asset and deployment policy

- Pin external EmulatorJS and icon assets to known versions, or self-host them when the adapter work begins.
- Keep `ROM_PATH` configurable.
- Keep local-only ROM workflows separate from public deployment policy.
- Do not add a ROM to public source control or a public image without an explicit authorization decision and documented distribution rights.

## 5. Phase 2: Stronger Arcade UX

### 5.1 Cabinet-first information architecture

The first viewport contains the game stage, launch state, compact status rail, and only the primary play action. Secondary configuration lives in a drawer or lower lab area.

### 5.2 Status rail

Show four concise states:

- ROM: loading, ready, unavailable;
- CORE: idle, booting, running, failed;
- LINK: offline, connected, peer linked;
- PAD: waiting, connected.

Use text and color together; never rely on color alone.

### 5.3 Controls drawer

The drawer contains keyboard/gamepad remapping, reset defaults, and input diagnostics. It is collapsible, keyboard accessible, and does not resize the game unexpectedly.

### 5.4 Command palette

A keyboard-accessible command palette exposes Play, Pause, Restart, Fullscreen, Focus Game, Toggle Controls, change presentation mode, and room actions. It must close on Escape and restore focus to its trigger.

### 5.5 Presentation modes

- **Cabinet:** minimal controls, maximum game focus.
- **Training Lab:** controls and future telemetry overlay visible.
- **Replay:** replay timeline and recording controls.
- **Spectator:** room/peer status prioritized; gameplay remains read-only until transport is implemented.

Modes are UI presentation states today. They do not imply emulator capabilities that are not available.

### 5.6 Touch and accessibility

- Provide a touch D-pad and six-button arcade cluster on narrow screens.
- Use pointer capture and prevent page scrolling while a virtual control is held.
- Add semantic labels, live status announcements, visible focus, `prefers-reduced-motion`, and safe mobile sizing.

## 6. v0.2 Milestone: Replay, Save-State-Ready Lab, and Telemetry-Ready UI

This milestone is the bridge between the current launcher and deeper emulator work.

### v0.2A: replay foundation

- Capture normalized input events with timestamps and frame estimates.
- Store replay records in IndexedDB.
- Export/import versioned JSON replay files.
- Include ROM hash, emulator/core versions, bindings, browser metadata, and checksum.
- Add replay list, naming, delete, and compatibility validation.

### v0.2B: state adapter contract

Introduce an `ArcadeEngine` interface:

```text
loadGame() -> Promise<void>
start() -> Promise<void>
pause() -> void
reset() -> void
stepFrame() -> void
captureState() -> Promise<ArrayBuffer | null>
restoreState(state) -> Promise<boolean>
submitInput(input) -> void
readTelemetry() -> TelemetrySnapshot | null
```

The first adapter wraps EmulatorJS and returns unsupported results for unavailable operations. A future patched FBNeo WASM adapter can implement them without rewriting the UI.

### v0.2C: training scenarios

- Define scenario metadata and compatibility checks.
- Add local scenario presets and timeline markers.
- Add “practice from here” once state capture is available.
- Keep rule-based analysis separate from any future AI service.

### v0.2D: telemetry contract

Define a versioned, read-only schema for frame number, timer, round, character IDs, health, input words, and optional hitbox data. Values must be sourced from validated emulator hooks, not guessed from canvas pixels.

## 7. Phase 3: Collaborative Lab

Start with replay and scenario sharing over the existing WebRTC data channel. Add save-state transfer only after state serialization, ROM hash, core version, and endianness are validated. True netplay requires deterministic frame input, synchronization policy, desync detection, and rollback; signaling alone is not netplay.

## 8. Phase 4: Smart Emulator and Coaching

1. Validate memory addresses with FBNeo tracing and debugger evidence.
2. Expose telemetry through the engine adapter.
3. Build deterministic frame-window rules for parry, reversal, throw, and punish analysis.
4. Add optional AI summaries only on top of those rules and recorded evidence.
5. Never allow generated advice to overwrite authoritative frame data.

## 9. Release Gates

### v0.1 foundation

- All server checks pass.
- `/healthz` and ROM metadata are observable.
- Missing ROM and loader failures are visible in-app.
- No path traversal regression.
- Railway smoke check succeeds.

### v0.2 Lab

- Replays round-trip through export/import.
- Incompatible ROM hashes are rejected.
- Input capture does not interfere with gameplay.
- Touch controls work on mobile viewport sizes.
- Keyboard-only navigation and reduced motion are verified.

### Future netplay

- Determinism measured across supported browsers.
- Frame input protocol specified and versioned.
- Desync detection and recovery tested.
- No public claim of online play before controlled runtime validation.

## 10. Working Agreement

Every implementation change should update the relevant status in this document, add a focused validation check, and record unresolved assumptions. The repository's reverse-engineering report remains the authority for ROM facts; this document is the authority for Arcade Link product direction and delivery sequencing.
