import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { classifyGesture, ActionStateMachine, R2TapStateMachine } =
  await loadModule("../gestures.js");

function landmarks(offsetFor) {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const mcp = [5, 9, 13, 17];
  const tip = [8, 12, 16, 20];
  for (let i = 0; i < 4; i++) {
    p[mcp[i]] = { x: 0.5, y: 0.5, z: 0 };
    p[tip[i]] = { x: 0.5, y: 0.5 + offsetFor(i), z: 0 };
  }
  return p;
}

test("classifyGesture reads synthetic palm, fist and peace", () => {
  assert.equal(classifyGesture(landmarks(() => -0.15)), "palm");
  assert.equal(classifyGesture(landmarks(() => 0.15)), "fist");
  assert.equal(classifyGesture(landmarks((i) => (i < 2 ? -0.15 : 0.15))), "peace");
});

test("ActionStateMachine needs two stable frames, fist releases", () => {
  const s = new ActionStateMachine({ stableFrames: 2, releaseCooldownMs: 90 });
  assert.deepEqual(s.update("palm"), []);
  const pressed = s.update("palm");
  assert.ok(pressed.some((e) => e.action === "cross" && e.press));
  assert.deepEqual(s.update("fist"), []); // first frame of the new gesture
  const released = s.update("fist"); // second stable frame releases
  assert.ok(released.some((e) => e.action === "cross" && !e.press));
});

test("R2TapStateMachine only fires for point with the left hand", () => {
  const s = new R2TapStateMachine({ cooldownMs: 250, stableFrames: 2, holdMs: 120 });
  assert.deepEqual(s.update("palm"), []);
  assert.deepEqual(s.update("point"), []);
  const events = s.update("point");
  assert.ok(events.some((e) => e.action === "r2" && e.press));
});
