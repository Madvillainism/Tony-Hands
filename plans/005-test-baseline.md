# Plan 005: Add a Node test baseline for pure web modules

> **Executor instructions**: Follow the plan step by step and run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9fb29da -- web/gestures.js web/bridge.js web/config.js`. Uncommitted work exists.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 003 (tests should lock in the release/reset behavior after it lands)
- **Category**: tests / dx

## Why this matters

There is no test suite. The gesture state machines, hand tracker, and input bridge are pure modules that can be tested with Node's built-in runner — no browser, no dependencies. The recent `release()` fix and the release-desync bug (plan 003) are exactly the regressions a characterization test catches. This plan adds a one-command verification baseline without introducing a build step or dependencies, matching the repo's "no build step" convention.

## Current state

- `web/gestures.js` exports `GESTURES`, `classifyGesture`, `palmCenter`, `HandTracker`, `MovementStateMachine`, `ActionStateMachine`, `R2TapStateMachine`. All are pure (no DOM).
- `web/bridge.js` exports `PAD`, `ACTION_LABELS`, `PadBridge`. `PadBridge` takes a `getGameManager` callback; tests can inject a fake with a `simulateInput(player, index, value)` recorder.
- `web/config.js` exports `GAME`, `CORES`, `DEFAULT_CORE`, `ZONES`, `MEDIAPIPE`, `TRACKING`, `STORAGE_KEYS`, `DESKTOP_CONTROLS`. All plain objects — no DOM.
- `web/gesture-engine.js` imports MediaPipe from a CDN URL at module top-level, so **do not import it in Node tests**; it is intentionally excluded.
- No `package.json` in the repo. `node --test` works on a directory of `*.test.js` files without one; ES modules need `.mjs` extension or a `package.json` with `"type": "module"`.

Repo convention: no build step, no dependencies, ES modules. AGENTS.md says "There is no test suite yet. When changing state machines, verify behavior by reasoning through the emission order and, when possible, with a short script that feeds synthetic frames/gestures." This plan makes that script permanent.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax check (existing) | `python -m compileall src` | exit 0 |
| Web syntax check | `node --check web/gestures.js && node --check web/bridge.js && node --check web/config.js` | exit 0 |
| Tests | `node --test web/tests/*.test.mjs` | all tests pass |

## Scope

**In scope**: create `web/tests/` with `movement.test.mjs`, `actions.test.mjs`, `bridge.test.mjs`, `config.test.mjs`; optionally add `web/tests/README.md`.

**Out of scope**: no `package.json`, no npm dependencies, no test framework, no DOM/browser code, no changes to the modules under test. Do not add tests for `gesture-engine.js` or `play.js`.

## Steps

### Step 1: Create the test directory and a loader shim

Node cannot import `./gestures.js` as ESM unless the file is `.mjs` or a `package.json` declares `"type": "module"`. Since adding `package.json` is out of scope, load the source via a data URL in each test:

```js
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const src = await readFile(new URL("../gestures.js", import.meta.url), "utf8");
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(src).toString("base64")
);
const { MovementStateMachine } = mod;
```

Repeat this pattern in each test file with the appropriate module path. Add a short comment in each file explaining why (no `package.json` by design).

**Verify**: `node --check web/tests/movement.test.mjs` → exit 0.

### Step 2: Movement state machine tests

In `web/tests/movement.test.mjs`, cover:
- entering left/right/up/down from neutral emits a press with the right action;
- hysteresis: after entering left at x=0.05, x=0.22 (above `left_max + hysteresis = 0.25`? use 0.26) releases it; a value in [0.20, 0.30] is the neutral band;
- diagonals: left + up emit two independent presses;
- `release()` emits releases for held axes and zeroes state;
- **regression for plan 003**: feed `update(0.05, 0.5)` → press; `release()` → release; `update(0.05, 0.5)` again → fresh press.

**Verify**: `node --test web/tests/movement.test.mjs` → all pass.

### Step 3: Action and R2 tap tests

In `web/tests/actions.test.mjs`, cover `classifyGesture` for synthetic palm/fist/peace landmarks (build 21-point arrays with tips offset above/below MCPs), and `ActionStateMachine`'s stable-frame gate (one frame of a new gesture emits nothing; two emit a press; a fist releases). Keep cooldown assertions deterministic by passing explicit `dtMs`.

**Verify**: `node --test web/tests/actions.test.mjs` → all pass.

### Step 4: Bridge and config tests

In `web/tests/bridge.test.mjs`, inject a fake game manager that records `simulateInput` calls:
- `set("cross", true)` sends `(0, 0, 1)`;
- `set("cross", false)` sends `(0, 0, 0)`;
- `releaseAll()` sends releases only for actions currently pressed;
- unknown actions return `false` and send nothing.

In `web/tests/config.test.mjs`, assert:
- `CORES.length === 1` and `CORES[0].core === "pcsx_rearmed"` (locks in plan 001);
- `GAME.rom === "games/thps.bin"` and `GAME.bios === "games/scph5501.bin"`;
- `DESKTOP_CONTROLS` has keys 0–3 (the stable EmulatorJS build replaces its whole table, so players 1–3 must exist) and player 0 maps Cross→`z`, Circle→`x`, Triangle→`s`, Square→`a`.

**Verify**: `node --test web/tests/bridge.test.mjs web/tests/config.test.mjs` → all pass.

### Step 5: Document the command

Add the test command to `web/README.md` under a "Developing" heading: `node --test web/tests/*.test.mjs`. Note that no dependencies are needed.

**Verify**: `grep -n "node --test" web/README.md` → match.

## Test plan

This plan *is* the test baseline. The tests listed in Steps 2–4 are the deliverable; no further tests needed.

## Done criteria

- [ ] `node --test web/tests/*.test.mjs` exits 0 with all tests passing.
- [ ] `node --check` passes for all four test files.
- [ ] No `package.json` or dependency added (`git status` shows only `web/tests/*` and `web/README.md`).
- [ ] `plans/README.md` row 005 marked DONE.

## STOP conditions

- Node version in the environment does not support top-level `await` in ESM (Node 14.8+ required) — report the version.
- A module under test imports a CDN URL (only `gesture-engine.js` does, and it is out of scope) — do not polyfill it.
- Plan 001 has not landed and `config.test.mjs` fails on `CORES.length` — STOP and execute 001 first.

## Maintenance notes

When tuning `ZONES` in `config.toml`/`web/config.js`, update the hysteresis assertions in `movement.test.mjs` in the same commit. The data-URL import trick is deliberately used to avoid a `package.json`; if the repo later adopts one, replace it with normal relative imports and delete the shim comments.
