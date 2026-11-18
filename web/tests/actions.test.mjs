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

function thumbLandmarks(thumbDy) {
  const p = landmarks(() => 0.15); // four fingers curled
  p[4] = { x: 0.7, y: 0.5 + thumbDy, z: 0 }; // thumb extended away from index MCP
  return p;
}

test("thumbs up and thumbs down are distinguished by thumb direction", () => {
  assert.equal(classifyGesture(thumbLandmarks(-0.12)), "thumbs_up");
  assert.equal(classifyGesture(thumbLandmarks(0.12)), "thumbs_down");
});

test("thumbs down wins over thumbs up priority, fist still catches tucked thumb", () => {
  // A peace sign with a downward thumb is still peace (extended fingers win).
  const peace = landmarks((i) => (i < 2 ? -0.15 : 0.15));
  peace[4] = { x: 0.7, y: 0.62, z: 0 };
  assert.equal(classifyGesture(peace), "peace");
  // Tucked thumb (not extended) with curled fingers is a fist, not a thumb.
  const fist = landmarks(() => 0.15);
  fist[4] = { x: 0.5, y: 0.55, z: 0 }; // within the 0.08 thumb-extend radius
  assert.equal(classifyGesture(fist), "fist");
});

test("thumbs down maps to the in-game Start button", () => {
  const s = new ActionStateMachine({ stableFrames: 2, releaseCooldownMs: 90 });
  assert.deepEqual(s.update("thumbs_down"), []);
  const pressed = s.update("thumbs_down");
  assert.ok(pressed.some((e) => e.action === "start" && e.press));
  s.tick(100);
  assert.deepEqual(s.update("fist"), []);
  const released = s.update("fist");
  assert.ok(released.some((e) => e.action === "start" && !e.press));
});

test("R2TapStateMachine only fires for point with the left hand", () => {
  const s = new R2TapStateMachine({ cooldownMs: 250, stableFrames: 2, holdMs: 120 });
  assert.deepEqual(s.update("palm"), []);
  assert.deepEqual(s.update("point"), []);
  const events = s.update("point");
  assert.ok(events.some((e) => e.action === "r2" && e.press));
});
