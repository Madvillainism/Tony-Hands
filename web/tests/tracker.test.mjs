import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { HandTracker } = await loadModule("../gestures.js");

const detection = (x, y = 0.5) => ({ x, y, landmarks: [] });

test("a far jump still matches the existing hand at capacity", () => {
  const tracker = new HandTracker();
  tracker.update([detection(0.05), detection(0.9)]);
  assert.equal(tracker.tracks.length, 2);

  // Let both tracks go stale, then move one hand a long way in one inference.
  tracker.update([]);
  tracker.update([]);
  tracker.update([]);
  tracker.update([detection(0.45)]);

  assert.equal(tracker.tracks.length, 1, "hand was not dropped by a far jump");
  assert.equal(tracker.tracks[0].lost, 0);
});

test("stale tracks are evicted quickly enough to free a slot", () => {
  const tracker = new HandTracker();
  tracker.update([detection(0.05)]);
  for (let i = 0; i < 4; i += 1) tracker.update([]);
  assert.equal(tracker.tracks.length, 0);

  tracker.update([detection(0.8)]);
  assert.equal(tracker.tracks.length, 1);
  assert.equal(tracker.tracks[0].side, "right");
});
