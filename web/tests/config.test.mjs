import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load.mjs";

const {
  CORES,
  GAME,
  DEPLOY,
  KEYBOARD_CONTROLS,
  ZONES,
  keyNameToCode,
  codeToKeyName,
  codeToKeyCode,
  buildControls,
  isReserved,
  conflictWith,
  sanitizeRemap,
  GAMES,
  DEFAULT_GAME_ID,
  resolveGame,
  isTouchDevice,
  STORAGE_KEYS,
  MEDIAPIPE,
  HAND_TRACKING,
  sanitizeEjsSettings,
} = await loadModule("../config.js");

test("game registry holds both PS1 titles with a selector default", () => {
  assert.deepEqual(
    GAMES.map((g) => g.id),
    ["thps", "thps2"],
  );
  assert.equal(DEFAULT_GAME_ID, "thps");
  assert.deepEqual(GAMES.map((g) => g.gameId), [1, 2]);
  assert.equal(GAMES[1].rom, "games/thps2/thps2.chd");
  assert.equal(STORAGE_KEYS.game, "tony-hands:game");
});

test("resolveGame uses the URL or defaults to THPS 1, never saved storage", () => {
  assert.equal(resolveGame({ search: "?game=thps2" }).id, "thps2");
  assert.equal(resolveGame({ search: "?game=nope" }).id, "thps");
  assert.equal(resolveGame({ search: "" }).id, "thps");
});

test("isTouchDevice detects coarse pointers and touch points", () => {
  assert.equal(isTouchDevice({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(isTouchDevice({ navigator: { maxTouchPoints: 1 } }), true);
  assert.equal(isTouchDevice({}), false);
});

test("MediaPipe thresholds are config-driven", () => {
  assert.equal(MEDIAPIPE.numHands, 2);
  assert.equal(MEDIAPIPE.minDetectionConfidence, 0.6);
  assert.equal(MEDIAPIPE.minHandPresenceConfidence, 0.6);
  assert.equal(MEDIAPIPE.minTrackingConfidence, 0.4);
  assert.equal(MEDIAPIPE.idleFps, 4);
  assert.equal(MEDIAPIPE.idleAfterMs, 2000);
});

test("sanitizeEjsSettings drops only the inconsistent mute pair", () => {
  assert.equal(sanitizeEjsSettings('{"volume":0,"muted":false}'), null);
  assert.equal(
    sanitizeEjsSettings('{"volume":0,"muted":true}'),
    '{"volume":0,"muted":true}',
  );
  assert.equal(
    sanitizeEjsSettings('{"volume":0.6,"muted":false}'),
    '{"volume":0.6,"muted":false}',
  );
  assert.equal(sanitizeEjsSettings("not-json"), "not-json");
});

test("hand tracking uses a generous match radius and quick stale eviction", () => {
  assert.deepEqual(HAND_TRACKING, {
    matchDistance: 0.5,
    maxLost: 4,
    sideMargin: 0.12,
    sideDwell: 8,
  });
});

test("pcsx_rearmed is the only core", () => {
  assert.equal(CORES.length, 1);
  assert.equal(CORES[0].core, "pcsx_rearmed");
});

test("without a deploy override, paths are local and auto-start is off", () => {
  assert.equal(GAME.rom, "games/thps.bin");
  assert.equal(GAME.bios, "games/scph5501.bin");
  assert.equal(DEPLOY.autoStart, false);
  assert.equal(DEPLOY.defaultMode, "keyboard");
  assert.equal(DEPLOY.cacheLimit, 1073741824);
});

test("a deploy override switches to remote assets and keyboard auto-start", async () => {
  const { readFile } = await import("node:fs/promises");
  let src = await readFile(new URL("../config.js", import.meta.url), "utf8");
  src += `\n// fresh ${Date.now()}\n`;
  globalThis.TONY_HANDS_ASSETS = {
    rom: "https://example.r2.dev/thps.bin",
    bios: "https://example.r2.dev/scph5501.bin",
    autoStart: true,
    cacheLimit: 0,
  };
  try {
    const mod = await import(
      "data:text/javascript;base64," + Buffer.from(src).toString("base64")
    );
    assert.equal(mod.GAME.rom, "https://example.r2.dev/thps.bin");
    assert.equal(mod.DEPLOY.autoStart, true);
    assert.equal(mod.DEPLOY.defaultMode, "keyboard");
    assert.equal(mod.DEPLOY.cacheLimit, 0);
  } finally {
    delete globalThis.TONY_HANDS_ASSETS;
  }
});

test("single keyboard mapping is WASD/IJKL/O with unique keys", () => {
  for (const player of [0, 1, 2, 3]) assert.ok(KEYBOARD_CONTROLS[player]);
  const p = KEYBOARD_CONTROLS[0];
  const expected = {
    0: "k", // Cross / ollie
    1: "j", // Square / flip
    4: "w", // D-pad up
    5: "s", // D-pad down
    6: "a", // D-pad left
    7: "d", // D-pad right
    8: "l", // Circle / grab
    9: "i", // Triangle / grind
    13: "o", // R2
  };
  for (const [index, value] of Object.entries(expected)) {
    assert.equal(p[index].value, value, `index ${index}`);
  }
  const names = Object.values(p).map((entry) => entry.value);
  assert.equal(new Set(names).size, names.length, "no duplicate keys");
  assert.equal(names.includes("q"), false, "Q is unbound");
  assert.equal(names.includes("e"), false, "E is unbound");
  assert.equal(names.includes("tab"), false, "Tab is unbound");
});

test("key conversion helpers round-trip", () => {
  assert.equal(keyNameToCode("w"), "KeyW");
  assert.equal(keyNameToCode("up arrow"), "ArrowUp");
  assert.equal(keyNameToCode("enter"), "Enter");
  assert.equal(keyNameToCode("shift"), "ShiftLeft");
  assert.equal(keyNameToCode(""), null);
  assert.equal(codeToKeyName("KeyW"), "w");
  assert.equal(codeToKeyName("ArrowUp"), "up arrow");
  assert.equal(codeToKeyName("Tab"), "tab");
  assert.equal(codeToKeyName("Key1"), null);
  assert.equal(codeToKeyCode("KeyW"), 87);
  assert.equal(codeToKeyCode("ArrowUp"), 38);
  assert.equal(codeToKeyCode("Tab"), 9);
});

test("buildControls applies remap overrides by action", () => {
  const controls = buildControls({ cross: "KeyG", dpad_up: "ArrowUp" });
  assert.equal(controls[0][0].value, "g");
  assert.equal(controls[0][4].value, "up arrow");
  assert.equal(controls[0][9].value, "i", "untouched action stays default");
  assert.notEqual(controls, KEYBOARD_CONTROLS, "returns a deep clone");
  for (const player of [1, 2, 3]) assert.deepEqual(controls[player], {});
});

test("remap validation rejects reserved and duplicate keys", () => {
  assert.equal(isReserved("Tab"), true);
  assert.equal(isReserved("KeyG"), false);
  const clean = sanitizeRemap({ cross: "KeyG", bogus: "KeyX", r2: "Tab" });
  assert.deepEqual(clean, { cross: "KeyG" });
  assert.equal(conflictWith({ cross: "KeyG" }, "circle", "KeyG"), true);
  assert.equal(conflictWith({}, "circle", "KeyG"), false);
});

test("vertical zones are tighter than the desktop defaults", () => {
  assert.deepEqual(ZONES, {
    left_max: 0.2,
    right_min: 0.3,
    up_max: 0.35,
    down_min: 0.65,
    hysteresis: 0.05,
  });
});
