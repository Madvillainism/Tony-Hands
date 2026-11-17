# Plan 004: Halve preview redraws and fix small UI gaps

> **Executor instructions**: Follow the plan step by step and run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9fb29da -- web/play.js web/gesture-engine.js web/index.html web/demo.html web/styles.css`. Uncommitted work exists.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / a11y

## Why this matters

During play two independent `requestAnimationFrame` loops run: the engine's inference loop (~60 Hz, gated to 20 Hz inference) and a second preview loop in `play.js` that clears and redraws a 640×480 canvas every frame. With labels/HUD disabled and the camera yielding only 20 fps, roughly two of every three redraws are wasted work competing with the emulator for the 33 ms frame budget. Separately, the boot gate overflows its 4:3 screen at 320 px, and the trick-sheet buttons do not announce that they open a dialog.

## Current state

- `web/play.js:175-182` — `startPreviewLoop()` schedules its own rAF calling `drawPreview()`; started at `:148` on engine status `"live"`, stopped at `:155`.
- `web/gesture-engine.js` has an `onHands` callback option (`:60`) already fed at `:285` with the per-inference hand list; `play.js` currently does not pass `onHands`.
- `web/index.html:77-91` — gate content inside `#game`; `web/styles.css:348-355` gives `.cab__screen` `aspect-ratio: 4/3` + `overflow: hidden`; `.gate` is `inset: 0` with `align-content: center`. At 320 px the screen is 201.5 px tall while gate content needs 208 px (verified in Chrome) — top/bottom copy clips.
- `web/index.html:40-42,244-246` and `web/demo.html:39-41` — `<button data-open-dialog="tricks">` with no `aria-haspopup`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax | `node --check web/play.js && node --check web/gesture-engine.js` | exit 0 |
| 320px check | Chrome DevTools: emulate `320x640x1`, evaluate `() => { const g=document.getElementById('gate'); return {h:g.clientHeight, sh:g.scrollHeight} }` | `sh <= h` |
| a11y check | `grep -rn "data-open-dialog" web/index.html web/demo.html` | every match on a line containing `aria-haspopup="dialog"` |

## Scope

**In scope**: `web/play.js`, `web/gesture-engine.js` (only to pass `onHands` through — no hot-loop changes), `web/index.html`, `web/demo.html`, `web/styles.css`.

**Out of scope**: `web/overlay.js` (drawing itself is fine), `web/demo.js` (its full-size canvas legitimately redraws every frame), EmulatorJS internals.

## Steps

### Step 1: Drive the preview from the inference callback

In `web/play.js`:
- Delete `startPreviewLoop()` and `stopPreviewLoop()` and the `previewLoop` state field.
- Pass `onHands: () => drawPreview()` into the `GestureEngine` constructor in `startEngine()`. The engine invokes `onHands` once per inference (20 fps during play), which is exactly the preview's useful rate.
- In `handleEngineStatus()`, remove `startPreviewLoop()`/`stopPreviewLoop()` calls; keep `drawPreview()` on the `"off"` branch so the "camera off" frame is drawn once.
- Keep the `previewCtx` setup and `drawPreview()` body unchanged.

**Verify**: `node --check web/play.js` → exit 0. `grep -n "previewLoop\|startPreviewLoop\|stopPreviewLoop" web/play.js` → no matches. In Chrome, the camera preview still updates smoothly and the emulator stays at ~30 fps.

### Step 2: Stop the engine's rAF when the model is not ready (optional, only if Step 1 is insufficient)

The engine loop at `web/gesture-engine.js:227-240` already returns early when `video.readyState < 2` or inference is not due. Do **not** restructure it unless a trace shows it is still material. If it is, gate the rAF on `this.landmarker` being present and restart it after load.

**Verify**: skip unless profiling demands it; if changed, `node --check web/gesture-engine.js` → exit 0.

### Step 3: Make the boot gate fit at 320 px

In `web/styles.css`, add to the `@media (max-width: 640px)` block:

```css
.cab__screen {
  aspect-ratio: auto;
  min-block-size: 14rem;
}

.gate {
  align-content: start;
  overflow-y: auto;
  gap: 0.4rem;
  padding: 0.75rem;
}

.gate__title {
  font-size: clamp(1.4rem, 9vw, 2rem);
}

.gate__note {
  font-size: 0.82rem;
}
```

**Verify**: Chrome at 320×640 → `gate.scrollHeight <= gate.clientHeight` (or gate scrolls without clipping the button). The Boot button remains visible and clickable.

### Step 4: Announce dialogs

Add `aria-haspopup="dialog"` to every `<button data-open-dialog="tricks">` in `web/index.html` (two buttons) and `web/demo.html` (one button).

**Verify**: the grep check above matches all three.

## Test plan

No automated tests. Manual Chrome checks in Steps 1 and 3, plus the grep checks.

## Done criteria

- [ ] `node --check` passes for both JS files.
- [ ] `grep -n "previewLoop" web/play.js` → no matches.
- [ ] 320 px gate check passes.
- [ ] All three dialog triggers have `aria-haspopup="dialog"`.
- [ ] No files outside scope modified.
- [ ] `plans/README.md` row 004 marked DONE.

## STOP conditions

- The preview visibly freezes after Step 1 (the engine's `onHands` is not firing) — revert and report.
- `onHands` is needed by the demo page with different semantics — it already is (renders the skeleton overlay); do not change `gesture-engine.js` callback signature.
- Resizing the screen in Step 3 distorts the emulator canvas during play — STOP; the fix must apply only to the pre-boot gate.

## Maintenance notes

If a future feature adds a second per-frame consumer (e.g. a live input graph), route it through `onHands` too rather than adding another rAF loop. The 4:3 aspect ratio is restored above 640 px by the cascade; verify that when changing breakpoints.
