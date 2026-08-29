# Street Fighter III: 3rd Strike — Gill Playable Project Prompt

## Role and Objective

You are working in a Ghidra source workspace on a new, isolated reverse-engineering project. Your task is to analyze the user-provided, legally owned **Street Fighter III: 3rd Strike** Fightcade/FBNeo ROM set and create a reproducible, local modification that makes **Gill** a fully selectable and functional character.

The desired result is not merely enabling Gill in training or as a boss. Gill must appear in the normal character-select flow, be selectable by the local player, load his expected visual/audio assets, and work in ordinary offline matches without crashes or state corruption.

The original ROM archive is located at:

```text
StreetFighter/ROMS/sfiii3.zip
```

Never modify that file. Create all extraction, analysis, build, patch, test, and output artifacts under `StreetFighter/`.

## Mandatory First Reads

Before editing anything, read:

1. `WORKSPACE_KNOWLEDGE.md`
2. `AGENTS.md`
3. Any existing documentation under `StreetFighter/`

Use the local project documentation as the source of truth. Verify every target-specific claim against the supplied ROM set, emulator behavior, or a reproducible parser.


## Phase 1 — Establish a Reproducible Baseline

1. Record SHA-256 hashes, archive membership, CRCs, compressed/uncompressed sizes, and file names from `sfiii3.zip`.
2. Identify the exact FBNeo driver/set name, region/revision, ROM inventory, parent/clone dependencies, and expected checksums from locally installed FBNeo metadata where available.
3. Confirm the original archive boots in the installed Fightcade/FBNeo environment before modifying it.
4. Create `StreetFighter/REVERSE_ENGINEERING_REPORT.md` and record only verified observations.
5. Create a small Python inspection tool for ZIP and ROM-set metadata. Avoid blind string replacement.

## Phase 2 — CPS-3 and Ghidra Analysis

Conduct an evidence-driven analysis of the CPS-3 title, not an assumed Nintendo DS/NitroFS workflow.

1. Identify the CPU architecture, executable/program ROM regions, graphics regions, audio/sample regions, encryption/decryption requirements, and FBNeo loading path.
2. Import the correct decrypted executable region into Ghidra with the correct processor language, endianness, address map, and memory blocks.
3. Identify and name the following systems with cross-references, strings, tables, or debugger evidence:
   - game boot and match state machine
   - character select cursor and character roster table
   - player-side character assignment
   - boss-only / unlock / hidden-character eligibility checks
   - Gill's object/character definition, move table, palettes, animations, voice/sample references, and stage/intro dependencies
   - versus/match initialization and per-character setup
4. Use structured analysis: Ghidra labels/types/comments, emulator debugger breakpoints or traces, and small parsers for known table layouts.
5. Record each hypothesis, the evidence for it, and the cheapest test that could falsify it.

## Phase 3 — Make Gill Selectable

Implement the smallest reliable change that makes Gill a normal selectable roster member while preserving baseline behavior.

Required outcomes:

- Gill has a visible character-select slot or another deliberate selection method documented for the user.
- Both player-side selection and match initialization resolve to Gill's real character ID.
- Boss-only flags or unlock gates that block selection are addressed without broadly disabling unrelated checks.
- Gill loads valid graphics, palettes, animations, hitboxes, moves, audio, HUD portraits, and victory/defeat flow.
- Player 1 and Player 2 behavior is considered separately; do not assume an opponent/boss implementation is safe as a player-controlled entity.
- Gill is tested in offline versus mode against several normal characters, through round transitions, KO, super meter, win/loss, rematch, and return to character select.

Do not invent offsets or table meanings. If Gill's playable implementation requires multiple linked tables, modify them together and explain the dependency.

## Phase 4 — Build, Validation, and Patch Delivery

1. Keep every modification scripted and reproducible.
2. Write the modified output to a distinct `StreetFighter/build/` path, never over the source archive.
3. Validate the rebuilt ZIP against FBNeo's expected file structure and checksums where applicable.
4. Produce a patch only from the verified original input hash to the verified modified output.
5. Add a patch manifest containing:
   - input archive SHA-256
   - target archive SHA-256
   - required archive contents and CRCs
   - FBNeo/Fightcade version tested
   - exact patch application command
   - rollback instructions
6. Do not replace checksums or generate a patch that silently targets an unknown revision.

## Phase 5 — Fightcade Compatibility Assessment

Treat this as a separate final phase, not an assumption.

1. First verify the modified set starts locally in the installed Fightcade FBNeo build.
2. Determine whether Fightcade accepts the custom set under its ROM and netplay compatibility rules.
3. If supported, test only a private, consensual session in which both players use byte-identical patched files and the same emulator configuration.
4. Document the exact test setup, whether synchronization/desync occurred, and the result.
5. If Fightcade does not support custom modified sets online, state that clearly and provide offline/FBNeo workflow instructions instead. Do not attempt to circumvent the restriction.

## Documentation Deliverables

Update throughout the project:

- `StreetFighter/README.md`: project purpose, legal use, quick start, current status, build/patch steps.
- `StreetFighter/REVERSE_ENGINEERING_REPORT.md`: CPS-3 architecture, ROM map, Ghidra analysis, named functions/tables, Gill selection path, discovered data formats, and validation evidence.
- `StreetFighter/CHANGELOG.md`: each patch iteration and result.
- `StreetFighter/tools/`: parsing, extraction, rebuild, and patch scripts.
- `StreetFighter/patches/`: patch file and manifest only; no copyrighted content.
- `WORKSPACE_KNOWLEDGE.md`: reusable findings that are applicable to future CPS-3 or arcade reverse-engineering projects.

## Completion Criteria

The project is complete only when:

- The original archive remains unchanged.
- A deterministic toolchain can reproduce the modified output.
- Gill is selectable and functions in verified offline matches.
- The patch manifest verifies the exact original input.
- Documentation distinguishes verified behavior from hypotheses.
- Fightcade compatibility is documented based on actual testing, not assumptions.

Begin by producing a concise baseline inventory and a stated local hypothesis for the CPS-3/FBNeo loading path. Then proceed in small, validated iterations.
