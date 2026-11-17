import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const {
  CORES,
  GAME,
  DEPLOY,
  DESKTOP_CONTROLS,
  SKATE_CONTROLS,
  CONTROL_PRESETS,
  DEFAULT_PRESET,
  keyNameToCode,
  ZONES,
} = await loadModule("../config.js");

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

test("skate preset maps WASD, IJKL and O with unique keys", () => {
  for (const player of [0, 1, 2, 3]) assert.ok(SKATE_CONTROLS[player]);
  const p = SKATE_CONTROLS[0];
  const expected = {
    0: "k", // Cross / ollie
    1: "j", // Square / flip
    4: "w", // D-pad up
    5: "s", // D-pad down
    6: "a", // D-pad left
    7: "d", // D-pad right
    8: "l", // Circle / grab
    9: "i", // Triangle / grind
    10: "q", // L1
    11: "e", // R1
    12: "tab", // L2
    13: "o", // R2
  };
  for (const [index, value] of Object.entries(expected)) {
    assert.equal(p[index].value, value, `index ${index}`);
  }
  const names = Object.values(p).map((entry) => entry.value);
  assert.equal(new Set(names).size, names.length, "no duplicate keys");
  // value2 labels must stay identical across presets.
  for (const index of Object.keys(p)) {
    assert.equal(p[index].value2, DESKTOP_CONTROLS[0][index].value2);
  }
});

test("presets registry exposes both layouts", () => {
  assert.equal(DEFAULT_PRESET, "desktop");
  assert.deepEqual(Object.keys(CONTROL_PRESETS), ["desktop", "skate"]);
  assert.equal(CONTROL_PRESETS.skate.controls, SKATE_CONTROLS);
});

test("keyNameToCode handles EJS key names", () => {
  assert.equal(keyNameToCode("w"), "KeyW");
  assert.equal(keyNameToCode("up arrow"), "ArrowUp");
  assert.equal(keyNameToCode("enter"), "Enter");
  assert.equal(keyNameToCode("shift"), "ShiftLeft");
  assert.equal(keyNameToCode(""), null);
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
