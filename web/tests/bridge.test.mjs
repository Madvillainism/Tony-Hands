import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { PadBridge, PAD } = await loadModule("../bridge.js");

function fakeManager() {
  const calls = [];
  return { calls, simulateInput: (player, index, value) => calls.push([player, index, value]) };
}

test("set() sends RetroPad index 0 for Cross", () => {
  const gm = fakeManager();
  const bridge = new PadBridge(() => gm);
  assert.equal(bridge.set("cross", true), true);
  assert.deepEqual(gm.calls, [[0, PAD.cross, 1]]);
});

test("set(false) sends a release", () => {
  const gm = fakeManager();
  const bridge = new PadBridge(() => gm);
  bridge.set("circle", true);
  bridge.set("circle", false);
  assert.deepEqual(gm.calls.at(-1), [0, PAD.circle, 0]);
});

test("releaseAll() releases only pressed actions", () => {
  const gm = fakeManager();
  const bridge = new PadBridge(() => gm);
  bridge.set("cross", true);
  bridge.set("triangle", true);
  gm.calls.length = 0;
  assert.equal(bridge.releaseAll(), 0);
  assert.deepEqual(gm.calls, [
    [0, PAD.cross, 0],
    [0, PAD.triangle, 0],
  ]);
});

test("unknown actions are ignored", () => {
  const gm = fakeManager();
  const bridge = new PadBridge(() => gm);
  assert.equal(bridge.set("nope", true), false);
  assert.deepEqual(gm.calls, []);
});
