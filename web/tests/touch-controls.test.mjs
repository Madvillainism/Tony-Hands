import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const {
  createTouchState,
  actionsOf,
  pointerDown,
  pointerUp,
  clearTouches,
} = await loadModule("../touch-controls.js");

const VALID = new Set(["cross", "dpad_up", "dpad_left", "start"]);

test("actionsOf splits a chord button's data-action", () => {
  assert.deepEqual(actionsOf({ dataset: { action: "dpad_up dpad_left" } }), [
    "dpad_up",
    "dpad_left",
  ]);
  assert.deepEqual(actionsOf({ dataset: { action: "cross" } }), ["cross"]);
});

test("first pointer on an action presses; second does not", () => {
  const s = createTouchState();
  assert.deepEqual(pointerDown(s, 1, ["cross"], VALID), ["cross"]);
  assert.deepEqual(pointerDown(s, 2, ["cross"], VALID), []);
});

test("lifting one of two fingers keeps the action held", () => {
  const s = createTouchState();
  pointerDown(s, 1, ["cross"], VALID);
  pointerDown(s, 2, ["cross"], VALID);
  assert.deepEqual(pointerUp(s, 1), { actions: [], release: false });
  assert.deepEqual(pointerUp(s, 2), { actions: ["cross"], release: true });
});

test("a diagonal presses both directions and releases both", () => {
  const s = createTouchState();
  assert.deepEqual(pointerDown(s, 1, ["dpad_up", "dpad_left"], VALID), [
    "dpad_up",
    "dpad_left",
  ]);
  assert.deepEqual(pointerUp(s, 1), {
    actions: ["dpad_up", "dpad_left"],
    release: true,
  });
});

test("shared direction stays held when one of two buttons lifts", () => {
  const s = createTouchState();
  pointerDown(s, 1, ["dpad_up"], VALID);
  assert.deepEqual(pointerDown(s, 2, ["dpad_up", "dpad_left"], VALID), [
    "dpad_left",
  ]);
  assert.deepEqual(pointerUp(s, 1), { actions: [], release: false });
  assert.deepEqual(pointerUp(s, 2), {
    actions: ["dpad_up", "dpad_left"],
    release: true,
  });
});

test("unknown actions are ignored", () => {
  const s = createTouchState();
  assert.deepEqual(pointerDown(s, 1, ["bogus"], VALID), []);
  assert.equal(s.pointers.size, 0);
});

test("pointerUp with no matching pointer is a no-op", () => {
  const s = createTouchState();
  assert.equal(pointerUp(s, 99), null);
});

test("clearTouches releases each held action exactly once", () => {
  const s = createTouchState();
  pointerDown(s, 1, ["cross"], VALID);
  pointerDown(s, 2, ["dpad_up", "dpad_left"], VALID);
  pointerDown(s, 3, ["cross"], VALID);
  assert.deepEqual(clearTouches(s).sort(), ["cross", "dpad_left", "dpad_up"]);
  assert.equal(s.pointers.size, 0);
  assert.equal(s.counts.size, 0);
});
