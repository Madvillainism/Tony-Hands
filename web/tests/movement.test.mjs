import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { MovementStateMachine } = await loadModule("../gestures.js");

const has = (events, action, press) =>
  events.some((e) => e.action === action && e.press === press);

test("entering each zone emits a press with the right action", () => {
  for (const [x, y, action] of [
    [0.05, 0.5, "dpad_left"],
    [0.9, 0.5, "dpad_right"],
    [0.25, 0.05, "dpad_up"],
    [0.25, 0.95, "dpad_down"],
  ]) {
    const s = new MovementStateMachine();
    assert.ok(has(s.update(x, y), action, true), action);
  }
});

test("hysteresis: a direction exits past its exit threshold", () => {
  const s = new MovementStateMachine();
  s.update(0.05, 0.5); // enter left
  assert.deepEqual(s.update(0.22, 0.5), []); // 0.22 < 0.25 exit
  assert.ok(has(s.update(0.26, 0.5), "dpad_left", false));
});

test("the neutral band is [left_max, right_min]", () => {
  const s = new MovementStateMachine();
  assert.deepEqual(s.update(0.25, 0.5), []);
});

test("diagonals emit two independent presses", () => {
  const s = new MovementStateMachine();
  const events = s.update(0.05, 0.05);
  assert.ok(has(events, "dpad_left", true));
  assert.ok(has(events, "dpad_up", true));
});

test("release() emits releases and re-press works at the same position", () => {
  const s = new MovementStateMachine();
  assert.ok(has(s.update(0.05, 0.5), "dpad_left", true));
  assert.ok(has(s.release(), "dpad_left", false));
  assert.equal(s.h, "neutral");
  // Regression: without reset, update() sees no state change and emits nothing.
  assert.ok(has(s.update(0.05, 0.5), "dpad_left", true));
});
