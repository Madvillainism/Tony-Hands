import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const {
  createTouchState,
  pointerDown,
  pointerUp,
  clearTouches,
} = await loadModule("../touch-controls.js");

const VALID = new Set(["cross", "dpad_up", "start"]);

test("first pointer on an action presses; second does not", () => {
  const s = createTouchState();
  assert.equal(pointerDown(s, 1, "cross", VALID), "cross");
  assert.equal(pointerDown(s, 2, "cross", VALID), null);
});

test("lifting one of two fingers keeps the action held", () => {
  const s = createTouchState();
  pointerDown(s, 1, "cross", VALID);
  pointerDown(s, 2, "cross", VALID);
  assert.deepEqual(pointerUp(s, 1), { action: "cross", release: false });
  assert.deepEqual(pointerUp(s, 2), { action: "cross", release: true });
});

test("unknown actions are ignored", () => {
  const s = createTouchState();
  assert.equal(pointerDown(s, 1, "bogus", VALID), null);
  assert.equal(s.pointers.size, 0);
});

test("pointerUp with no matching pointer is a no-op", () => {
  const s = createTouchState();
  assert.equal(pointerUp(s, 99), null);
});

test("clearTouches releases each held action exactly once", () => {
  const s = createTouchState();
  pointerDown(s, 1, "cross", VALID);
  pointerDown(s, 2, "dpad_up", VALID);
  pointerDown(s, 3, "cross", VALID); // second finger, same action
  assert.deepEqual(clearTouches(s).sort(), ["cross", "dpad_up"]);
  assert.equal(s.pointers.size, 0);
  assert.equal(s.counts.size, 0);
});
