// Tony-Hands web configuration.
//
// One place for every tunable, following the desktop app's rule that settings
// live in config.toml instead of being sprinkled through the pipeline.
// `games/` is git-ignored; see web/games/README.md.

export const GAME = Object.freeze({
  name: "Tony Hands",
  rom: "games/thps.bin",
  bios: "games/scph5501.bin",
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
