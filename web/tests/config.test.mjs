import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const { CORES, GAME, DEPLOY, DESKTOP_CONTROLS, ZONES } =
  await loadModule("../config.js");

test("pcsx_rearmed is the only core", () => {
  assert.equal(CORES.length, 1);
  assert.equal(CORES[0].core, "pcsx_rearmed");
});

test("without a deploy override, paths are local and auto-start is off", () => {
  assert.equal(GAME.rom, "games/thps.bin");
  assert.equal(GAME.bios, "games/scph5501.bin");
  assert.deepEqual(DEPLOY, { autoStart: false, defaultMode: "gestures" });
});

test("a deploy override switches to remote assets and keyboard auto-start", async () => {
  const { readFile } = await import("node:fs/promises");
  let src = await readFile(new URL("../config.js", import.meta.url), "utf8");
  // Append a unique comment so the data URL differs and Node loads a fresh
  // module instance instead of reusing the one imported at the top.
  src += `\n// fresh ${Date.now()}\n`;
  globalThis.TONY_HANDS_ASSETS = {
    rom: "https://example.r2.dev/thps.bin",
    bios: "https://example.r2.dev/scph5501.bin",
    autoStart: true,
    defaultMode: "keyboard",
  };
  try {
    const mod = await import(
      "data:text/javascript;base64," + Buffer.from(src).toString("base64")
    );
    assert.equal(mod.GAME.rom, "https://example.r2.dev/thps.bin");
    assert.equal(mod.GAME.bios, "https://example.r2.dev/scph5501.bin");
    assert.deepEqual(mod.DEPLOY, { autoStart: true, defaultMode: "keyboard" });
  } finally {
    delete globalThis.TONY_HANDS_ASSETS;
  }
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
