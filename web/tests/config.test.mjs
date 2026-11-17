import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { CORES, GAME, DESKTOP_CONTROLS, ZONES } = await loadModule("../config.js");

test("pcsx_rearmed is the only core", () => {
  assert.equal(CORES.length, 1);
  assert.equal(CORES[0].core, "pcsx_rearmed");
});

test("game file paths are fixed and local", () => {
  assert.equal(GAME.rom, "games/thps.bin");
  assert.equal(GAME.bios, "games/scph5501.bin");
});

test("controller table has all four players and the desktop key map", () => {
  for (const player of [0, 1, 2, 3]) assert.ok(DESKTOP_CONTROLS[player], `player ${player}`);
  const p0 = DESKTOP_CONTROLS[0];
  assert.equal(p0[0].value, "z");
  assert.equal(p0[8].value, "x");
  assert.equal(p0[9].value, "s");
  assert.equal(p0[1].value, "a");
});

test("movement zones mirror config.toml", () => {
  assert.deepEqual(ZONES, {
    left_max: 0.2,
    right_min: 0.3,
    up_max: 0.25,
    down_min: 0.75,
    hysteresis: 0.05,
  });
});
