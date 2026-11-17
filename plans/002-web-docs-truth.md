# Plan 002: Make the web docs describe the shipped player

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a "STOP condition" occurs, stop and report. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9fb29da -- web/README.md README.md docs/CONTROLS.md docs/GAMES.md`. This branch has uncommitted work; compare against live files.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001 (core list must be settled first, so docs describe one core)
- **Category**: docs

## Why this matters

`web/README.md` still says the web folder is an "input-only demo" with "no emulator" and points at a deleted `main.js`; the root README lists "Play THPS in the browser (EmulatorJS)" as a future item. Both are actively wrong and make the flagship feature undiscoverable. This plan rewrites them to describe the actual app: play page as homepage, `demo.html` as the gesture test bench, EmulatorJS + `pcsx_rearmed`, and the keyboard/gesture toggle.

## Current state

- `web/README.md:1-9` — "Web Demo … demo of the input layer, not a playable game yet: there is no keyboard injection and no emulator".
- `web/README.md:73-93` — file tree lists `main.js`; tuning instructions say "mirror the numbers in the `ZONES` object at the top of `main.js`".
- `web/README.md:147-152` — status checklist has "Playable THPS in the browser (EmulatorJS)" unchecked.
- `README.md:417-445` — "Web version" section repeats the input-only claim and marks the browser game as "🚧 Next".
- `README.md:460` — project layout still says `web/ # browser demo (MediaPipe WASM + canvas)`.
- Real files: `web/index.html`, `web/demo.html`, `web/play.js`, `web/demo.js`, `web/config.js`, `web/gesture-engine.js`, `web/gestures.js`, `web/overlay.js`, `web/bridge.js`, `web/emulator.js`, `web/styles.css`, `web/fonts/`.
- `docs/CONTROLS.md` and `docs/GAMES.md` need a web section (keyboard table + gesture mapping + link to `/demo.html`).

Repo convention: `README.md` is the user tutorial, `docs/SETUP.md` technical reference, `docs/CONTROLS.md` cheat-sheet, `docs/GAMES.md` other games. When behavior changes, update the relevant doc in the same commit (AGENTS.md).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Check stale names | `grep -rn "main.js\|not a playable game\|no emulator\|input-only\|🚧 Next.*EmulatorJS" README.md web/README.md docs/` | no matches |
| Check links | `grep -rn "demo.html\|pcsx_rearmed\|web/games" README.md web/README.md` | descriptions present |

## Scope

**In scope**: `web/README.md`, `README.md`, `docs/CONTROLS.md`, `docs/GAMES.md`, `docs/SETUP.md` (only if its web references are stale).

**Out of scope**: all code files; `spec/constitution/roadmap.md` (separate plan if needed); `web/games/README.md` (owned by plan 001).

## Steps

### Step 1: Rewrite web/README.md

Replace the whole file. Required structure:

1. Title: "Tony-Hands — Web player" and a 2–3 sentence summary: playable PS1 game in the browser with gesture or keyboard input; EmulatorJS + `pcsx_rearmed`; own disc image/BIOS only.
2. "Run it": `python -m http.server 8000 --directory web`, open <http://localhost:8000>. Mention secure context and that `file://` will not work. Mention `demo.html` as the quick gesture test bench.
3. "Your files": point to `web/games/README.md`, list `thps.bin` + `scph5501.bin`, note both are git-ignored and never uploaded.
4. "Controls": gesture table (palm→Cross, thumbs up→Circle, peace→Triangle, L→Square, left point→R2, fist→release) and keyboard table matching `src/bridge/key_mapper.py` (arrows, Z/X/S/A, Q/W/E, Enter, Shift).
5. "How it works": module map from the real files; tuning via `web/config.js` `ZONES` (which mirrors `config.toml`), not `main.js`.
6. "Differences from desktop": camera starts on game start; game tracks at 320×240/20 fps; hand loss releases everything; no key injection into other windows.
7. "Troubleshooting": camera blocked, CDN blocked, game files missing, black screen (bring the Chrome window to front — occluded tabs throttle rAF), slow boot (630 MB image over localhost).
8. "Browser support": Baseline 2024; no polyfills.
9. Status checklist: mark camera/tracking, gesture test bench, playable game, keyboard toggle as done; leave "browser as wireless controller" and "public deploy" as ideas.
10. Licence note: EmulatorJS GPL-3.0, Anton OFL, no game data shipped.

**Verify**: `grep -n "main.js\|no emulator\|input-only" web/README.md` → no matches. `grep -n "pcsx_rearmed\|demo.html\|web/games" web/README.md` → at least one match each.

### Step 2: Update the root README web section

Replace `README.md:417-445`. Keep the `python -m http.server` command. Describe the two pages, the gesture/keyboard toggle, the local files requirement, and mark the status table's browser-game row as done. Update `README.md:460` project layout line to `web/ # browser player (EmulatorJS + MediaPipe WASM)`.

**Verify**: `grep -n "🚧 Next | Play THPS in the browser" README.md` → no match. `grep -n "Play.*browser" README.md` → at least one match.

### Step 3: Update docs/CONTROLS.md and docs/GAMES.md

Add a short "Web player" subsection to `docs/CONTROLS.md` with the gesture table and the keyboard table (same as step 1 item 4), plus a link to `/demo.html` for tuning. Add a note to `docs/GAMES.md` that the web player plays the same PS1 disc via `pcsx_rearmed` and expects the files in `web/games/`.

**Verify**: `grep -n "Web player\|pcsx_rearmed\|demo.html" docs/CONTROLS.md docs/GAMES.md` → matches in both files.

### Step 4: Link check

For every relative Markdown link added (`web/README.md`, `web/games/README.md`, `docs/CONTROLS.md`, `docs/GAMES.md`, `demo.html`), confirm the target exists on disk.

**Verify**: `Get-Item web/README.md, web/games/README.md, docs/CONTROLS.md, docs/GAMES.md, web/demo.html` → all exist.

## Test plan

No executable tests. Verification is the grep/link checks above plus a human read-through of the rewritten `web/README.md`.

## Done criteria

- [ ] `grep -rn "main.js\|not a playable game\|no emulator\|input-only" README.md web/README.md docs/` → no matches.
- [ ] Both pages, the toggle, pcsx_rearmed, and local file requirement are described in `web/README.md` and the root README.
- [ ] `docs/CONTROLS.md` and `docs/GAMES.md` contain the web sections.
- [ ] All added relative links resolve.
- [ ] No code files modified.
- [ ] `plans/README.md` row 002 marked DONE.

## STOP conditions

- Plan 001 has not landed (docs would describe a core that still exists) — STOP and execute 001 first.
- A doc references a file that does not exist after step 4.

## Maintenance notes

When the gesture set or keyboard map changes, update `docs/CONTROLS.md`, `web/README.md`, and the in-page trick sheet (`web/index.html`, `web/demo.html`) together — the trick sheet is currently duplicated (finding DESIGN-01, deferred).
