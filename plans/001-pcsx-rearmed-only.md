# Plan 001: Make pcsx_rearmed the only supported web core

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a "STOP condition" occurs, stop and report — do not improvise. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9fb29da -- web/config.js web/emulator.js web/index.html web/play.js web/styles.css web/README.md README.md`. This branch has uncommitted work; compare the excerpts below against the live files before proceeding. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / docs
- **Planned at**: commit `9fb29da`, 2026-11-17

## Why this matters

The Accurate option selects `mednafen_psx_hw`, which is broken in EmulatorJS 4.2.3 (upstream issue #1088): its WebGL2 build aborts with `RuntimeError: null function` at startup, and its legacy WebGL1 build intermittently fails with an `attachShader` TypeError. It also requires an original `.cue` sheet because EmulatorJS auto-generates `MODE1/2352` cues that the core rejects for this `MODE2/2352` disc. It was observed to fail repeatedly even after forcing the legacy build. The user explicitly asked to **focus on pcsx_rearmed**. Removing the broken option eliminates a dead-end UI and lets the boot path, docs, and tests converge on one known-good configuration.

## Current state

- `web/config.js` — `CORES` has two entries (`fast`/`pcsx_rearmed`, `accurate`/`mednafen_psx_hw`), `DEFAULT_CORE = "fast"`, `GAME.cue = "games/thps.cue"`.
- `web/emulator.js` — `bootEmulator()` is `async` because `loadCueFile()` fetches and rewrites the cue for the accurate core; also contains `forceCore()` (patches EmulatorJS localStorage settings), `SETTINGS_KEY`, `EJS_forceLegacyCores`, `EJS_gameParentUrl`, and `EJS_defaultOptions.retroarch_core`. All of these exist only to serve the accurate core.
- `web/index.html` — Core card has two radios; Files card has a third row for the cue sheet; boot gate note mentions the cue.
- `web/play.js` — `state.coreId`, `readCore()`, `applyCore()` (including `needsCue` warning), the `coreRadios` change listener with `confirm()` + `location.reload()`, and `cueReady` state all serve the toggle.
- `web/README.md` and `README.md` — describe both cores (or are stale, see plan 002).

Repo conventions: vanilla ES modules, no build step, no framework. Settings live in `web/config.js` (AGENTS.md: "Config is the interface"). Comments explain *why*, not *what*. Baseline 2024 web target.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax check | `node --check web/config.js && node --check web/emulator.js && node --check web/play.js` | exit 0 |
| Serve | `python -m http.server 8000 --directory web` | server responds on :8000 |
| Verify no stale refs | `grep -rn "mednafen_psx_hw\|thps.cue\|forceLegacyCores\|gameParentUrl\|retroarch_core" web/ README.md` | no matches outside `web/games/README.md` historical notes |
| Git status | `git status --short` | only in-scope files modified |

## Scope

**In scope**:
- `web/config.js`, `web/emulator.js`, `web/index.html`, `web/play.js`, `web/styles.css` (if a style becomes unused), `web/README.md`, `README.md`, `web/games/README.md`

**Out of scope**:
- `web/gestures.js`, `web/gesture-engine.js`, `web/bridge.js`, `web/overlay.js`, `web/demo.html`, `web/demo.js` — gesture code is untouched by this plan.
- `web/games/thps.cue` and `web/games/thps.bin` — private game files, never delete or rename.
- Any Python file under `src/` — desktop app uses Beetle PSX intentionally.

## Steps

### Step 1: Reduce config to one core

In `web/config.js`, make `CORES` a single entry and drop `GAME.cue`:

```js
export const GAME = Object.freeze({
  name: "Tony Hands",
  rom: "games/thps.bin",
  bios: "games/scph5501.bin",
});

export const CORES = Object.freeze([
  Object.freeze({
    id: "fast",
    label: "PlayStation",
    core: "pcsx_rearmed",
    note: "Single-threaded. Leaves the CPU free for hand tracking.",
  }),
]);

export const DEFAULT_CORE = "fast";
```

Keep `STORAGE_KEYS` unchanged. Remove the `cue` property from `GAME`.

**Verify**: `node --check web/config.js` → exit 0.

### Step 2: Simplify the emulator bootstrap

In `web/emulator.js`:
- Remove `SETTINGS_KEY`, `forceCore()`, `loadCueFile()`, and the `GAME.cue` head probe from `checkGameFiles()` (keep `rom`/`bios`/`ready`).
- Make `bootEmulator()` synchronous again (drop `async` and `await loadCueFile()`).
- Remove `EJS_gameParentUrl`, `EJS_forceLegacyCores`, and `EJS_defaultOptions` assignments.
- Keep `EJS_core = RETRO_CORE` (`"psx"`), `EJS_language = "en-US"` (fixes the `es.json` 404), `EJS_threads = false`, `EJS_cacheConfig.enabled = false`, `EJS_defaultControls` (all four players), and all existing callbacks.

**Verify**: `node --check web/emulator.js` → exit 0. `grep -n "forceCore\|loadCueFile\|gameParentUrl\|forceLegacyCores\|defaultOptions" web/emulator.js` → no matches.

### Step 3: Simplify the play page

In `web/play.js`:
- Remove `cueReady` from `state`, the `cuePath`/`cueNote` element lookups, the `paintFile("cue", ...)` call, and the `cuePath.textContent` assignment.
- In `applyCore()`, remove the `needsCue` branch; just set `els.coreLabel.textContent = core.core` and a short hint from `core.note`.
- Remove the entire `for (const radio of els.coreRadios)` listener block, and `coreRadios`/`coreHint` element lookups if no longer used.
- Keep `applyCore(readCore())` at startup; `readCore()` still works with the single core.

**Verify**: `node --check web/play.js` → exit 0. `grep -n "cue\|coreRadios\|needsCue" web/play.js` → no matches.

### Step 4: Simplify the HTML

In `web/index.html`:
- In the Core card, replace the two radios with one static line (e.g. `<p class="card__hint">pcsx_rearmed — single-threaded, leaves room for hand tracking.</p>`). Remove the `fieldset`, legend, and both `input[name="core"]` elements.
- In the Files card, remove the `data-file="cue"` row entirely.
- In the gate note and the "Formats that work" note, remove the cue-sheet sentences; keep "a single .bin, .iso or .chd works".
- In `web/games/README.md`, remove the cue requirement and the cue row from the tree; keep the hardlink/tuning sections.

**Verify**: `grep -n "mednafen_psx_hw\|thps.cue\|cue sheet\|Cue sheet" web/index.html web/games/README.md` → no matches.

### Step 5: End-to-end boot check

Start the static server, open `http://localhost:8000/`, confirm the Files card shows only Disc image + PS1 BIOS, click **Boot the game**, click EmulatorJS's **Start Game**, and wait for the Neversoft logo / title screen. Confirm the console shows `pcsx_rearmed`.

**Verify**: in DevTools console:
```js
window.EJS_core === "psx"
window.EJS_gameUrl === "games/thps.bin"
window.EJS_gameParentUrl === undefined
window.EJS_forceLegacyCores === undefined
window.EJS_emulator?.getCore?.() === "pcsx_rearmed"
```
All true/undefined as shown. The game renders (non-black canvas).

## Test plan

No automated tests exist yet (plan 005 adds them). Manual gate above is the verification for this plan. After plan 005 lands, add a `config.test.js` assertion that `CORES.length === 1` and `CORES[0].core === "pcsx_rearmed"`.

## Done criteria

- [ ] `node --check` passes for `web/config.js`, `web/emulator.js`, `web/play.js`.
- [ ] `grep -rn "mednafen_psx_hw\|thps.cue\|forceLegacyCores\|gameParentUrl\|retroarch_core\|loadCueFile\|forceCore" web/ README.md` returns no matches outside `web/games/README.md` historical notes.
- [ ] Boot test reaches a rendering game with `EJS_core === "psx"` and no cue/parent settings.
- [ ] No files outside the in-scope list modified.
- [ ] `plans/README.md` row 001 marked DONE.

## STOP conditions

- The live code at the cited locations does not match the excerpts (uncommitted drift).
- The fast core stops booting after simplification — report the exact console error rather than re-adding core logic.
- Any emulator setting other than the five listed in Step 2 appears to depend on the accurate core.

## Maintenance notes

If EmulatorJS ships a stable release that fixes issue #1088, reintroduce a second core as a separate plan: re-add `CORES` entry, restore the cue path, and add a characterization test proving both cores boot. Until then, do not re-add the Accurate option. The pinned `EJS_language = "en-US"` must stay — without it the CDN's missing `es.json` aborts init.
