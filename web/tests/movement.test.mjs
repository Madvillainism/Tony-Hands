import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { MovementStateMachine } = await loadModule("../gestures.js");

const has = (events, action, press) =>
  events.some((e) => e.action === action && e.press === press);

test("any palm position steers: left of center is Left, right is Right", () => {
  const left = new MovementStateMachine();
  assert.ok(has(left.update(0.49, 0.5), "dpad_left", true));
  const right = new MovementStateMachine();
  assert.ok(has(right.update(0.51, 0.5), "dpad_right", true));
});

test("crossing the midline swaps direction in one update", () => {
  const s = new MovementStateMachine();
  s.update(0.1, 0.5);
  const events = s.update(0.9, 0.5);
  assert.ok(has(events, "dpad_left", false));
  assert.ok(has(events, "dpad_right", true));
});

test("up/down trigger inside the top/bottom third, with hysteresis on exit", () => {
  const up = new MovementStateMachine();
  assert.ok(has(up.update(0.5, 0.3), "dpad_up", true));
  assert.deepEqual(up.update(0.5, 0.37), [], "still held below 0.40 exit");
  assert.ok(has(up.update(0.5, 0.42), "dpad_up", false));

  const down = new MovementStateMachine();
  assert.ok(has(down.update(0.5, 0.7), "dpad_down", true));
});

test("diagonals emit two independent presses", () => {
  const s = new MovementStateMachine();
  const events = s.update(0.1, 0.05);
  assert.ok(has(events, "dpad_left", true));
  assert.ok(has(events, "dpad_up", true));
});

test("release() emits releases and re-press works at the same position", () => {
  const s = new MovementStateMachine();
  assert.ok(has(s.update(0.1, 0.5), "dpad_left", true));
  assert.ok(has(s.release(), "dpad_left", false));
  assert.equal(s.h, "neutral");
  // Regression: without reset, update() sees no state change and emits nothing.
  assert.ok(has(s.update(0.1, 0.5), "dpad_left", true));
});
