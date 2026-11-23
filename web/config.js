// Tony-Hands web configuration.
//
// One place for every tunable, following the desktop app's rule that settings
// live in config.toml instead of being sprinkled through the pipeline.
// `games/` is git-ignored; see web/games/README.md.

// `deploy-config.js` sets this before the modules load. Everything falls back
// to the local web/games/ paths, so localhost and the Node tests need no setup.
const assets = globalThis.TONY_HANDS_ASSETS ?? {};

// The game picker offers both PS1 titles. Remote builds inject a `games` array
// with the R2 CHD URLs; local dev falls back to files under web/games/.
const FALLBACK_GAMES = [
  { id: "thps", gameId: 1, label: "Tony Hawk's Pro Skater", rom: "games/thps.bin", year: 1999 },
  { id: "thps2", gameId: 2, label: "Tony Hawk's Pro Skater 2", rom: "games/thps2/thps2.chd", year: 2000 },
];

// A game may carry a `stateUrl` (a RetroArch savestate loaded on boot). Remote
// builds inject it from deploy-config.js so the game can start at the main menu
// instead of playing the publisher intro videos; local games leave it empty.
export const GAMES = Object.freeze(
  (Array.isArray(assets.games) && assets.games.length ? assets.games : FALLBACK_GAMES).map(
    (game) => Object.freeze({ ...game, stateUrl: game.stateUrl ?? null }),
  ),
);

export const DEFAULT_GAME_ID = GAMES[0].id;

// Kept for compatibility: the first game is the default when no selector runs.
export const GAME = Object.freeze({
  name: "Tony Hands",
  rom: assets.rom ?? GAMES[0].rom,
  bios: assets.bios ?? "games/scph5501.bin",
});

// The page always opens in keyboard mode: no camera prompt on arrival, and the
// WASD/IJKL mapping is ready immediately. Hands remain opt-in via the toggle.
export const DEPLOY = Object.freeze({
  autoStart: assets.autoStart === true,
  defaultMode: "keyboard",
  // EJS caches the ROM in IndexedDB below this size (bytes). Set 0 in
  // deploy-config.js to skip the ~600 MB copy on low-memory devices.
  cacheLimit: Number.isFinite(assets.cacheLimit) ? assets.cacheLimit : 1073741824,
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

// Vertical zones are tuned for the browser: the top/bottom third is enough
// for Up/Down so a hand does not have to be raised to the edge of the frame.
export const ZONES = Object.freeze({
  left_max: 0.2,
  right_min: 0.3,
  up_max: 0.35,
  down_min: 0.65,
  hysteresis: 0.05,
});

export const MEDIAPIPE = Object.freeze({
  version: "0.10.14",
  moduleUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  // Detection thresholds are tunables, not magic numbers in the engine.
  // Slightly lower values keep hands near the frame edges from dropping out.
  minDetectionConfidence: 0.6,
  minHandPresenceConfidence: 0.6,
  minTrackingConfidence: 0.4,
  numHands: 2,
  // When no hands are visible for this long, inference drops to idleFps.
  idleAfterMs: 2000,
  idleFps: 4,
});

// Hand identity matching. The match radius is how far a palm can jump between
// inferences and still be the same hand; too small and a fast hand near the
// edge is dropped because both track slots are held by stale tracks.
export const HAND_TRACKING = Object.freeze({
  matchDistance: 0.5,
  maxLost: 4,
  sideMargin: 0.12,
  sideDwell: 8,
});

// Two tracking budgets, because playing is the expensive one: the emulator
// already owns the main thread, so the camera runs small and slow while a
// game is on screen. `fps: 0` means "every frame the camera provides".
// Gesture quality: "low" (default on the live build) keeps the single-threaded
// emulator responsive by inferring at 12 fps and repainting the preview at 5.
// "high" restores 20/20 for capable machines. "cpu" is selected automatically
// when MediaPipe falls back to CPU, easing the load on weaker laptops.
const QUALITY = Object.freeze({
  low: { width: 320, height: 240, fps: 12, previewFps: 5 },
  high: { width: 320, height: 240, fps: 20, previewFps: 20 },
  cpu: { width: 320, height: 240, fps: 8, previewFps: 4 },
});

export const TRACKING = Object.freeze({
  play: Object.freeze(
    QUALITY[assets.quality] ?? QUALITY.low,
  ),
  // For CPU fallback: applied on top of the selected tier when delegate === CPU.
  cpu: Object.freeze(QUALITY.cpu),
  demo: Object.freeze({ width: 640, height: 480, fps: 0, previewFps: 0 }),
});

export const STORAGE_KEYS = Object.freeze({
  core: "tony-hands:core",
  remap: "tony-hands:key-remap",
  game: "tony-hands:game",
});

// The removed audio toggle wrote volume:0 with muted:false into EJS's global
// settings. Return null only for that inconsistent pair so a genuine user mute
// (volume:0, muted:true) is preserved. Callers pass a raw localStorage string.
export function sanitizeEjsSettings(raw) {
  if (!raw) return raw;
  try {
    const settings = JSON.parse(raw);
    if (settings && settings.volume === 0 && settings.muted === false) return null;
  } catch {
    /* malformed JSON: leave it for EmulatorJS to handle */
  }
  return raw;
}

// The page always boots on THPS 1 unless the URL explicitly asks for another
// game. No remembered choice: the game picker is a per-session action.
export function resolveGame({ search } = {}) {
  const query = search ?? (typeof location !== "undefined" ? location.search : "");
  let id = null;
  try {
    id = new URLSearchParams(query).get("game");
  } catch {
    /* invalid query string */
  }
  return (
    GAMES.find((game) => game.id === id) ??
    GAMES.find((game) => game.id === DEFAULT_GAME_ID) ??
    GAMES[0]
  );
}

// Touch devices get emulator-style on-screen buttons, never the soft keyboard.
// Pure helper: pass a window-like object so Node tests need no DOM.
export function isTouchDevice(win = globalThis) {
  return Boolean(
    win.matchMedia?.("(pointer: coarse)").matches ||
      (win.navigator?.maxTouchPoints ?? 0) > 0,
  );
}

export const TOUCH = Object.freeze({
  minTargetPx: 44,
});

// The single keyboard mapping: WASD steers; I/J/K/L are grind/flip/ollie/grab;
// O taps R2 for a quick 180. L1/R1/L2 are deliberately unbound — Q, E and Tab
// stay free for the browser and OS. This is the default on boot.
//
// Indices are EmulatorJS RetroPad indices; `value2` is kept from EmulatorJS's
// own defaults so only the key changes. Players 1-3 must be present and empty:
// the stable EmulatorJS build replaces its whole controller table instead of
// merging, so omitting them leaves controls[1] undefined and setupKeys() throws.
export const KEYBOARD_CONTROLS = Object.freeze({
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
    13: { value: "o", value2: "RIGHT_BOTTOM_SHOULDER" },
  },
  1: {},
  2: {},
  3: {},
});

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

// Reverse conversions for the remap dialog and live EJS mutation. EJS stores
// numeric keyCodes in controls[i][j].value; keyMap maps names -> codes.
const NAMED_CODES = {
  ArrowUp: "up arrow",
  ArrowDown: "down arrow",
  ArrowLeft: "left arrow",
  ArrowRight: "right arrow",
  Enter: "enter",
  Tab: "tab",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  Space: "space",
};

export function codeToKeyName(code) {
  if (!code) return null;
  if (NAMED_CODES[code]) return NAMED_CODES[code];
  const letter = code.match(/^Key([A-Z])$/);
  if (letter) return letter[1].toLowerCase();
  const digit = code.match(/^Digit([0-9])$/);
  if (digit) return digit[1];
  return null;
}

export function codeToKeyCode(code) {
  if (!code) return -1;
  if (NAMED_CODES[code] === "up arrow") return 38;
  if (NAMED_CODES[code] === "down arrow") return 40;
  if (NAMED_CODES[code] === "left arrow") return 37;
  if (NAMED_CODES[code] === "right arrow") return 39;
  if (NAMED_CODES[code] === "enter") return 13;
  if (NAMED_CODES[code] === "tab") return 9;
  if (NAMED_CODES[code] === "shift") return 16;
  if (NAMED_CODES[code] === "space") return 32;
  const letter = code.match(/^Key([A-Z])$/);
  if (letter) return letter[1].toUpperCase().charCodeAt(0);
  const digit = code.match(/^Digit([0-9])$/);
  if (digit) return digit[1].charCodeAt(0);
  return -1;
}

// Deep clone the base mapping and apply { action: "Code" } overrides by index.
export function buildControls(remap = {}) {
  const controls = structuredClone(KEYBOARD_CONTROLS);
  for (const [action, code] of Object.entries(remap)) {
    const index = ACTION_INDEX[action];
    const name = codeToKeyName(code);
    if (index === undefined || !name) continue;
    controls[0][index].value = name;
  }
  return controls;
}

// Action -> RetroPad index (kept here so config.js has no browser imports).
const ACTION_INDEX = Object.freeze({
  cross: 0,
  square: 1,
  select: 2,
  start: 3,
  dpad_up: 4,
  dpad_down: 5,
  dpad_left: 6,
  dpad_right: 7,
  circle: 8,
  triangle: 9,
  r2: 13,
});

export function isReserved(code) {
  return (
    code === "Tab" ||
    code === "F5" ||
    code === "F11" ||
    code === "Escape" ||
    code === "Backspace"
  );
}

export function conflictWith(remap, action, code) {
  const others = { ...remap };
  delete others[action];
  const baseCode = keyNameToCode(KEYBOARD_CONTROLS[0][ACTION_INDEX[action]]?.value);
  return (
    Object.values(others).includes(code) ||
    (baseCode !== code &&
      Object.entries(ACTION_INDEX).some(
        ([other, index]) =>
          other !== action && keyNameToCode(KEYBOARD_CONTROLS[0][index]?.value) === code && !others[other],
      ))
  );
}

export function sanitizeRemap(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [action, code] of Object.entries(value)) {
    if (!(action in ACTION_INDEX) || typeof code !== "string") continue;
    if (!codeToKeyName(code) || isReserved(code)) continue;
    out[action] = code;
  }
  return out;
}
