// Tony-Hands web configuration.
//
// One place for every tunable, following the desktop app's rule that settings
// live in config.toml instead of being sprinkled through the pipeline.
// `games/` is git-ignored; see web/games/README.md.

// `deploy-config.js` sets this before the modules load. Everything falls back
// to the local web/games/ paths, so localhost and the Node tests need no setup.
const assets = globalThis.TONY_HANDS_ASSETS ?? {};

export const GAME = Object.freeze({
  name: "Tony Hands",
  rom: assets.rom ?? "games/thps.bin",
  bios: assets.bios ?? "games/scph5501.bin",
});

// Production build sets autoStart + keyboard-first so the game boots on arrival
// without a camera permission prompt. Local dev keeps the manual boot gate and
// gesture-first default.
export const DEPLOY = Object.freeze({
  autoStart: assets.autoStart === true,
  defaultMode: assets.defaultMode === "keyboard" ? "keyboard" : "gestures",
});

// pcsx_rearmed is the only supported core. mednafen_psx_hw is broken in the
// stable EmulatorJS build (upstream issue #1088) and needs a real cue sheet for
// MODE2/2352 discs, which the CDN build does not generate correctly.
export const CORES = Object.freeze([
  Object.freeze({
    id: "fast",
    label: "PlayStation",
    core: "pcsx_rearmed",
    note: "Single-threaded. Leaves the CPU free for hand tracking.",
  }),
]);

export const DEFAULT_CORE = "fast";

// Mirrors [movement] in config.toml.
export const ZONES = Object.freeze({
  left_max: 0.2,
  right_min: 0.3,
  up_max: 0.25,
  down_min: 0.75,
  hysteresis: 0.05,
});

export const MEDIAPIPE = Object.freeze({
  version: "0.10.14",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
});

// Two tracking budgets, because playing is the expensive one: the emulator
// already owns the main thread, so the camera runs small and slow while a
// game is on screen. `fps: 0` means "every frame the camera provides".
export const TRACKING = Object.freeze({
  play: Object.freeze({ width: 320, height: 240, fps: 20 }),
  demo: Object.freeze({ width: 640, height: 480, fps: 0 }),
});

export const STORAGE_KEYS = Object.freeze({
  mode: "tony-hands:control-mode",
  core: "tony-hands:core",
  controls: "tony-hands:control-preset",
  introSeen: "tony-hands:gesture-intro-seen",
});

// Matches RetroArch's stock keyboard layout, which is what the desktop bridge
// presses (see src/bridge/key_mapper.py). Indices are EmulatorJS RetroPad
// indices; `value2` is kept from EmulatorJS's own defaults so only the key
// changes. `shift` cannot distinguish left from right in EmulatorJS.
//
// Players 1-3 must be present and empty: the stable EmulatorJS build replaces
// its whole controller table with this object (players 1-3 included) instead of
// merging, so omitting them leaves `controls[1]` undefined and setupKeys()
// throws during startup.
export const DESKTOP_CONTROLS = Object.freeze({
  0: {
    0: { value: "z", value2: "BUTTON_2" }, // Cross
    1: { value: "a", value2: "BUTTON_4" }, // Square
    2: { value: "shift", value2: "SELECT" },
    3: { value: "enter", value2: "START" },
    4: { value: "up arrow", value2: "DPAD_UP" },
    5: { value: "down arrow", value2: "DPAD_DOWN" },
    6: { value: "left arrow", value2: "DPAD_LEFT" },
    7: { value: "right arrow", value2: "DPAD_RIGHT" },
    8: { value: "x", value2: "BUTTON_1" }, // Circle
    9: { value: "s", value2: "BUTTON_3" }, // Triangle
    10: { value: "q", value2: "LEFT_TOP_SHOULDER" },
    11: { value: "w", value2: "RIGHT_TOP_SHOULDER" },
    12: { value: "tab", value2: "LEFT_BOTTOM_SHOULDER" },
    13: { value: "e", value2: "RIGHT_BOTTOM_SHOULDER" },
  },
  1: {},
  2: {},
  3: {},
});

// Skate preset: WASD steers; I/J/K/L are grind/flip/ollie/grab; O taps R2.
// Shoulders follow the preset shown earlier: Q=L1, E=R1, Tab=L2.
export const SKATE_CONTROLS = Object.freeze({
  0: {
    0: { value: "k", value2: "BUTTON_2" }, // Cross — ollie
    1: { value: "j", value2: "BUTTON_4" }, // Square — flip
    2: { value: "shift", value2: "SELECT" },
    3: { value: "enter", value2: "START" },
    4: { value: "w", value2: "DPAD_UP" },
    5: { value: "s", value2: "DPAD_DOWN" },
    6: { value: "a", value2: "DPAD_LEFT" },
    7: { value: "d", value2: "DPAD_RIGHT" },
    8: { value: "l", value2: "BUTTON_1" }, // Circle — grab
    9: { value: "i", value2: "BUTTON_3" }, // Triangle — grind
    10: { value: "q", value2: "LEFT_TOP_SHOULDER" },
    11: { value: "e", value2: "RIGHT_TOP_SHOULDER" },
    12: { value: "tab", value2: "LEFT_BOTTOM_SHOULDER" },
    13: { value: "o", value2: "RIGHT_BOTTOM_SHOULDER" },
  },
  1: {},
  2: {},
  3: {},
});

export const CONTROL_PRESETS = Object.freeze({
  desktop: Object.freeze({
    label: "Desktop",
    note: "Z, X, S, A + arrows. The original RetroArch layout.",
    controls: DESKTOP_CONTROLS,
  }),
  skate: Object.freeze({
    label: "Skate — WASD",
    note: "WASD to steer; I grind, J flip, K ollie, L grab, O for R2.",
    controls: SKATE_CONTROLS,
  }),
});

export const DEFAULT_PRESET = "desktop";

// Convert an EmulatorJS key name into a KeyboardEvent.code for the chip readout.
export function keyNameToCode(value) {
  if (!value) return null;
  if (value === "up arrow") return "ArrowUp";
  if (value === "down arrow") return "ArrowDown";
  if (value === "left arrow") return "ArrowLeft";
  if (value === "right arrow") return "ArrowRight";
  if (value === "enter") return "Enter";
  if (value === "tab") return "Tab";
  if (value === "shift") return "ShiftLeft";
  if (/^[a-z]$/.test(value)) return `Key${value.toUpperCase()}`;
  return null;
}
