# Plan 003: Make release truly reset gesture state

> **Executor instructions**: Follow the plan step by step and run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9fb29da -- web/gesture-engine.js web/gestures.js web/play.js web/demo.js`. Uncommitted work exists; compare excerpts with live code.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug

## Why this matters

`GestureEngine.releaseAll()` only emits `press:false` for currently pressed actions; it does not reset the state machines. After a tab switch, a Release click, emulator exit, or mode change, the machines still believe a direction/button is held. When the hand resumes in the same zone, `update()` sees no state change and emits no new press, so the game never re-sees the input until the hand leaves and re-enters the zone. This breaks the "nothing sticks" promise on the play page and the test bench.

A second, related race: `start()` sets `starting = true` and clears it only in its own `finally`; `stop()` never clears it. If the camera is stopped while `getUserMedia()` is pending, a subsequent `start()` is silently ignored until the first one finishes.

A third: `EJS_onExit` hides the gate and leaves Boot disabled, so the player cannot restart without reloading.

## Current state

- `web/gesture-engine.js:188-193`:
  ```js
  releaseAll() {
    for (const action of [...this.pressed]) {
      this.pressed.delete(action);
      this.onInput({ action, press: false });
    }
  }
  ```
- `web/gesture-engine.js:115-173` — `start()` sets `starting = true`, awaits `getUserMedia()` and `loadLandmarker()`, clears `starting` in `finally`. `stop()` at `:176-185` does not touch `starting`.
- `web/gesture-engine.js:300-303` — lost-hand path already calls `this.movement.release()`; that method exists at `web/gestures.js:255-267`.
- `web/play.js:199-205` `releaseEverything()` calls `state.engine?.releaseAll()` then `state.bridge.releaseAll()`; callers at `:329-333` (emulator exit), `:405-412` (Release button), `:415-418` (visibilitychange).
- `web/play.js:329-333` — `onExit` sets status and hides gate but never re-enables Boot or resets `state.booted`.

Repo convention: small state machines with `update()` returning events; comments explain *why*. No test suite yet — plan 005 adds one.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax check | `node --check web/gesture-engine.js && node --check web/play.js && node --check web/gestures.js` | exit 0 |
| Behavior probe | `node --input-type=module -e "import('./web/gestures.js').then(m=>{const s=new m.MovementStateMachine(); console.log(JSON.stringify(s.update(0.05,0.5)), JSON.stringify(s.release()), JSON.stringify(s.update(0.05,0.5)))})"` | first update emits `dpad_left` press, release emits `dpad_left` release, third update emits `dpad_left` press again |

## Scope

**In scope**: `web/gesture-engine.js`, `web/play.js`. Optionally `web/gestures.js` if an explicit reset helper is needed for `ActionStateMachine`/`R2TapStateMachine`.

**Out of scope**: `web/bridge.js` (its `releaseAll()` is correct — it tracks intent independently), `web/overlay.js`, `web/demo.js` (it reuses the engine and inherits the fix), EmulatorJS config.

## Steps

### Step 1: Reset the movement machine on release

In `GestureEngine.releaseAll()`, after the existing release loop, call `this.movement?.release()` and route its returned events through the same `onInput` callback and `pressed` bookkeeping. Use a tiny helper to avoid duplicating that bookkeeping:

```js
applyEvents(events) {
  for (const event of events) {
    if (event.press) this.pressed.add(event.action);
    else this.pressed.delete(event.action);
    this.onInput(event);
  }
}

releaseAll() {
  for (const action of [...this.pressed]) {
    this.pressed.delete(action);
    this.onInput({ action, press: false });
  }
  if (this.movement) this.applyEvents(this.movement.release());
}
```

Reuse `applyEvents()` in `route()` (replace its equivalent inline loop) so there is one path.

**Verify**: `node --check web/gesture-engine.js` → exit 0. The behavior probe above shows a fresh press after release.

### Step 2: Clear `starting` in stop() and guard late completion

In `GestureEngine.stop()` set `this.starting = false`. Add a generation token `this.startToken = (this.startToken ?? 0) + 1` at the top of both `start()` and `stop()`; capture it at the start of `start()` as `const token = this.startToken` and, after each `await`, check `if (token !== this.startToken) return;` before mutating state. This prevents a stopped start from reviving the engine.

**Verify**: `node --check web/gesture-engine.js` → exit 0. `grep -n "startToken" web/gesture-engine.js` → present in both `start()` and `stop()`.

### Step 3: Make emulator exit recoverable

In `web/play.js` `onExit` callback, mirror the failure branch:

```js
onExit: () => {
  releaseEverything();
  setStatus("idle", "Emulator stopped");
  state.booted = false;
  els.gate.hidden = false;
  els.gateTitle.textContent = "Ready to ride";
  els.gateNote.textContent = "The emulator stopped. Boot again when you are ready.";
  els.boot.disabled = false;
},
```

**Verify**: `node --check web/play.js` → exit 0. Manually: start a game, use EmulatorJS's Exit Emulation, confirm the gate reappears and Boot is clickable.

### Step 4: Manual end-to-end gate

With the static server running: switch to Gestures, boot the game, hold a direction so a D-Pad chip lights, press the page's **Release** button, confirm all chips clear, then hold the same hand position again and confirm the chip lights **again** without leaving the zone. Repeat after switching tabs away and back.

**Verify**: the chip re-lights on the second hold in both cases.

## Test plan

Plan 005 will add `node --test` coverage. When it lands, add a regression case: feed a held `dpad_left`, call `releaseAll()`, feed the same coordinate again, assert a fresh `{ action: "dpad_left", press: true }` event. Until then, Step 4 is the verification gate.

## Done criteria

- [ ] `node --check` passes for all three JS files.
- [ ] The behavior probe prints a press after release.
- [ ] Manual gate in Step 4 passes.
- [ ] Emulator exit restores the gate and Boot button.
- [ ] No files outside scope modified.
- [ ] `plans/README.md` row 003 marked DONE.

## STOP conditions

- The excerpts do not match live code.
- `ActionStateMachine` or `R2TapStateMachine` also need a reset and doing so requires new public API — STOP and report rather than guessing their intended reset semantics.
- A release event is emitted twice during `releaseAll()` (would desync `PadBridge`).

## Maintenance notes

`play.js` also maintains `state.keyboardHeld` for chips; that path is separate and intentionally not reset here. If the gesture engine gains more state machines, add their reset to `releaseAll()` in the same change.
