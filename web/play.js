// Play page controller: boot, gesture engine, input bridge, mode switch.
// The emulator owns gameplay; this module owns the handoff.

import {
  buildControls,
  codeToKeyCode,
  DEPLOY,
  isTouchDevice,
  KEYBOARD_CONTROLS,
  resolveGame,
  STORAGE_KEYS,
  TRACKING,
  ZONES,
  conflictWith,
  isReserved,
  keyNameToCode,
  sanitizeEjsSettings,
  sanitizeRemap,
} from "./config.js";
import { GestureEngine } from "./gesture-engine.js";
import { ACTION_LABELS, PAD, PadBridge } from "./bridge.js";
import {
  bootEmulator,
  checkGameFiles,
  getEmulator,
  getGameManager,
} from "./emulator.js";
import { drawWireframe } from "./overlay.js";
import { wireDialogs } from "./dialog.js";
import { bindTouchControls } from "./touch-controls.js";

const els = {
  boot: document.getElementById("boot"),
  release: document.getElementById("release"),
  gate: document.getElementById("gate"),
  gateTitle: document.getElementById("gate-title"),
  gateNote: document.getElementById("gate-note"),
  gateHint: document.getElementById("gate-hint"),
  statusText: document.getElementById("status-text"),
  lamp: document.querySelector("[data-lamp]"),
  modeHint: document.getElementById("mode-hint"),
  preview: document.getElementById("preview"),
  previewOff: document.getElementById("preview-off"),
  chips: [...document.querySelectorAll(".chip[data-action]")],
  modeRadios: [...document.querySelectorAll('input[name="control-mode"]')],
  gameRadios: [...document.querySelectorAll('input[name="game"]')],
  announcer: document.getElementById("announcer"),
  video: document.getElementById("camera"),
  remap: document.getElementById("remap"),
  touchPad: document.getElementById("touch-pad"),
  keyGuideCells: [...document.querySelectorAll("#key-guide [data-key-for]")],
  landscapeExit: document.getElementById("landscape-exit"),
};

const touch = isTouchDevice();
const selectedGame = resolveGame();

// One-time repair from the reverted audio toggle. EJS reads this key on every
// boot; the inconsistent pair would otherwise leave affected browsers silent.
try {
  const rawEjsSettings = localStorage.getItem("ejs-settings");
  if (rawEjsSettings && sanitizeEjsSettings(rawEjsSettings) === null) {
    localStorage.removeItem("ejs-settings");
  }
} catch {
  // Restricted storage: nothing to repair.
}

const previewCtx = els.preview.getContext("2d");

// The preview is cosmetic: repaint at a fraction of the inference rate so the
// single-threaded emulator keeps its frame budget. The minimum interval comes
// from TRACKING.play.previewFps (5 on the live "low" quality build).
const previewIntervalMs = TRACKING.play.previewFps > 0
  ? 1000 / TRACKING.play.previewFps
  : Infinity;
let lastPreviewAt = 0;

function drawPreviewThrottled() {
  const now = performance.now();
  if (now - lastPreviewAt < previewIntervalMs) return;
  lastPreviewAt = now;
  drawPreview();
}

// Keyboard chips are read-only decoration; the emulator handles the real keys.
// Derived from the key map so the readout always matches the active binding.
let remap = loadRemap();
let keyToAction = deriveKeyMap(buildControls(remap));

function deriveKeyMap(controls) {
  const map = {};
  for (const [action, index] of Object.entries(PAD)) {
    const code = keyNameToCode(controls[0]?.[index]?.value);
    if (code) map[code] = action;
  }
  return map;
}

function loadRemap() {
  try {
    return sanitizeRemap(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.remap) ?? "{}"),
    );
  } catch {
    return {};
  }
}

function persistRemap() {
  try {
    localStorage.setItem(STORAGE_KEYS.remap, JSON.stringify(remap));
  } catch {
    // Restricted storage: the choice lasts for this session only.
  }
}

const state = {
  mode: "keyboard",
  filesReady: false,
  booted: false,
  engine: null,
  bridge: new PadBridge(getGameManager),
  keyboardHeld: new Set(),
  introPending: false,
};

// On-screen pad for touch devices; a no-op object on pointer devices.
const touchControls = els.touchPad
  ? bindTouchControls({
      root: els.touchPad,
      bridge: state.bridge,
      isAllowed: () => touch && state.booted && state.mode === "keyboard",
      onChange: renderChips,
    })
  : null;

// ----------------------------------------------------------------- text/UI

let announceTimer = 0;
let lastAnnouncement = "";

function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!text || text === lastAnnouncement) return;
    lastAnnouncement = text;
    els.announcer.textContent = text;
  }, 400);
}

function setStatus(kind, text) {
  document.body.dataset.status = kind;
  els.statusText.textContent = text;
  if (els.lamp) els.lamp.dataset.tone = kind;
  if (kind === "live" || kind === "error") announce(text);
}

function setModeHint(text, tone = "info") {
  els.modeHint.textContent = text;
  els.modeHint.dataset.tone = tone;
}

// EJS binds keys on #game. Fullscreen promotes that element to the top layer
// and can leave focus elsewhere, so every mode/boot/fullscreen change refocuses it.
function focusGame() {
  if (touch || state.mode !== "keyboard") return;
  const target = document.fullscreenElement ?? document.querySelector("#game");
  target?.focus?.({ preventScroll: true });
}

function renderChips() {
  const active = new Set(state.bridge.pressed);
  if (state.mode === "keyboard") {
    for (const action of state.keyboardHeld) active.add(action);
  }
  for (const chip of els.chips) {
    chip.classList.toggle("is-active", active.has(chip.dataset.action));
  }
}

// ------------------------------------------------------------------ camera

function startEngine() {
  if (!state.engine) {
    state.engine = new GestureEngine({
      video: els.video,
      tracking: TRACKING.play,
      zones: ZONES,
      onHands: TRACKING.play.previewFps > 0 ? drawPreviewThrottled : undefined,
      onInput: handleInput,
      onStatus: handleEngineStatus,
      onError: (message) => {
        setModeHint(message, "error");
        setStatus("error", "Camera problem");
        document.body.dataset.camera = "off";
      },
    });
  }
  state.engine.start();
  document.body.dataset.camera = "on";
}

function stopEngine() {
  state.engine?.stop();
  document.body.dataset.camera = "off";
  drawPreview();
}

function handleEngineStatus(status) {
  if (status.state === "live") {
    setStatus("live", "Watching your hands");
    // Show which delegate MediaPipe chose — CPU fallback explains a slow
    // gesture experience on integrated GPUs / incognito sessions.
    const delegate = state.engine?.delegate ?? "GPU";
    applyDelegateQuality(delegate);
    if (delegate !== "CPU") {
      setModeHint(
        status.text?.includes("tracking")
          ? status.text
          : `Hands mode · ${delegate} tracking. Left hand steers, right hand tricks.`,
      );
    }
    els.previewOff.hidden = true;
  } else if (status.state === "busy") {
    setStatus("busy", status.text);
    els.previewOff.hidden = true;
  } else {
    setStatus("idle", "Camera off");
    els.previewOff.hidden = false;
    drawPreview();
  }
}

// Wireframe only: hand skeletons, never the camera fill. The hidden <video>
// still feeds MediaPipe; it is simply not painted.
function drawPreview() {
  const engine = state.engine;
  const running = Boolean(engine?.running);
  if (!running) {
    previewCtx.clearRect(0, 0, els.preview.width, els.preview.height);
    return;
  }
  drawWireframe(previewCtx, engine.hands, els.preview.width, els.preview.height);
}

// ------------------------------------------------------------------- input

function handleInput(event) {
  if (state.mode !== "gestures") return;
  // Thumbs-down is Start now: it goes through the bridge like any other
  // RetroPad button so THPS opens its own pause menu.
  state.bridge.apply(event);
  renderChips();
  if (event.press) announce(`Pressed ${ACTION_LABELS[event.action] ?? event.action}`);
}

function releaseEverything(message) {
  state.engine?.releaseAll();
  state.bridge.releaseAll();
  state.keyboardHeld.clear();
  touchControls?.clear();
  renderChips();
  if (message) announce(message);
}

// -------------------------------------------------------------------- mode

function applyMode(mode, { activateCamera = false } = {}) {
  // Touch devices are keyboard-only: the on-screen pad replaces hands control.
  if (touch && mode === "gestures") mode = "keyboard";
  state.mode = mode;
  for (const radio of els.modeRadios) radio.checked = radio.value === mode;

  if (mode === "keyboard") {
    stopEngine();
    releaseEverything();
    els.previewOff.hidden = false;
    setModeHint("Keyboard — WASD to steer; full key guide below.");
    document.body.dataset.mode = "keyboard";
    // EJS binds keys to #game; refocus after UI clicks so keys work. Defer one
    // frame so a native dialog closing or a permission prompt cannot steal it
    // back after this handler. Touch devices never focus #game.
    if (state.booted) requestAnimationFrame(focusGame);
  } else {
    setModeHint("Hands mode. Left hand steers, right hand tricks.");
    document.body.dataset.mode = "gestures";
    if (activateCamera) startEngine();
  }
}

// When MediaPipe falls back to CPU, throttle to the lighter tier so the
// emulator keeps its frame budget on weaker laptops.
function applyDelegateQuality(delegate) {
  state.engine?.setQuality?.(delegate === "CPU" ? "cpu" : null);
  if (delegate === "CPU") {
    setModeHint("Hands mode · CPU tracking. Lowered to a lighter tier.");
  }
}

// ------------------------------------------------------------------- files

async function refreshFiles(game = selectedGame) {
  els.boot.disabled = true;
  els.gateTitle.textContent = game.label ?? "Tony-Hands";

  // On the live build we boot immediately — skip the two HEAD probes (2 RTTs)
  // and let EmulatorJS surface a fetch error if the files are unavailable.
  if (DEPLOY.autoStart) {
    state.filesReady = true;
    setStatus("busy", "Loading the emulator");
    if (!state.booted) bootGame(game);
    return;
  }

  setStatus("busy", "Loading");
  els.gateHint.textContent = "Loading…";

  const result = await checkGameFiles(game);
  state.filesReady = result.ready;

  if (result.ready) {
    els.gateTitle.textContent = "Ready to ride";
    els.gateNote.textContent = DEPLOY.autoStart
      ? "Loading the game. Switch to Hands any time to play with your hands."
      : "Ready when you are.";
    els.gateHint.textContent = "Ready";
    els.boot.disabled = state.booted;
    setStatus("idle", "Ready to boot");
  } else {
    els.gateTitle.textContent = "No board yet";
    els.gateNote.textContent =
      "The game is not available right now. Reload to try again.";
    els.gateHint.textContent = "";
    els.boot.disabled = true;
    setStatus("error", "Game unavailable");
  }

  if (result.ready && DEPLOY.autoStart && !state.booted) bootGame(game);
}

// ---------------------------------------------------------------- emulator

// EJS snapshots EJS_defaultControls at construction and converts names to
// numeric keyCodes. At game start it may override controls from localStorage.
// Mutate the live table after that load so a remap wins without a ROM reload.
function applyRemapLive() {
  const emulator = getEmulator();
  if (!emulator?.controls || typeof emulator.saveSettings !== "function") return;
  let changed = false;
  for (const [action, code] of Object.entries(remap)) {
    const index = PAD[action];
    const numeric = codeToKeyCode(code);
    if (index === undefined || numeric < 0) continue;
    const slot = emulator.controls[0]?.[index];
    if (slot && slot.value !== numeric) {
      slot.value = numeric;
      changed = true;
    }
  }
  if (changed) {
    try {
      emulator.saveSettings();
    } catch {
      // EJS may reject a save before settings are fully loaded; live input
      // still works because controls[0] was mutated.
    }
  }
}

// EJS writes save files into an IDBFS mount but leaves its syncfs(false)
// commented out, so flush explicitly before the tab can disappear.
function flushSaves() {
  const gameManager = getGameManager();
  if (!gameManager) return;
  try {
    gameManager.saveSaveFiles();
    gameManager.FS.syncfs(false, (error) => {
      if (error) console.warn("Could not persist save file.", error);
    });
  } catch (error) {
    console.warn("Could not flush save file.", error);
  }
}

function bootGame(game = selectedGame) {
  if (!state.filesReady || state.booted) return;

  state.booted = true;
  document.body.dataset.booted = "true";
  els.gate.hidden = true;
  els.boot.disabled = true;
  setStatus("busy", "Loading the emulator");

  // ?nostate lets us boot at the title screen to capture a fresh savestate
  // with this exact EmulatorJS build, without touching the deployed assets.
  const bootGameConfig = new URLSearchParams(location.search).has("nostate")
    ? { ...game, stateUrl: null }
    : game;

  bootEmulator({
    player: "#game",
    game: bootGameConfig,
    controls: buildControls(remap),
    onGameStart: () => {
      applyRemapLive();
      setStatus("live", "Game running");
      // The boot savestate lands a few ms after "start" and can carry empty
      // SRAM. Re-read the persisted save file after it so progress shows up.
      setTimeout(() => {
        const gameManager = getGameManager();
        if (gameManager?.getSaveFile(false)) gameManager.loadSaveFiles();
      }, 150);
      if (state.mode === "gestures" && !state.introPending && !state.engine?.running) startEngine();
      // Make sure keys reach EJS immediately after the auto-boot (not on touch).
      focusGame();
    },
    onExit: () => {
      flushSaves();
      stopEngine();
      releaseEverything();
      setStatus("idle", "Emulator stopped");
      state.booted = false;
      delete document.body.dataset.booted;
      els.boot.disabled = false;
      els.gate.hidden = false;
      els.gateTitle.textContent = "Ready to ride";
      els.gateNote.textContent =
        "The emulator stopped. Boot again when you are ready.";
      els.gateHint.textContent = "";
    },
  }).catch((error) => {
    state.booted = false;
    els.gate.hidden = false;
    els.boot.disabled = false;
    els.gateTitle.textContent = "The emulator did not load";
    els.gateNote.textContent = error.message;
    els.gateHint.textContent = "Reload the page to try again.";
    setStatus("error", "Emulator offline");
  });
}

// ------------------------------------------------------------------ intro

// The animated tutorial is shown on every Hands selection. The camera is
// started only after it is dismissed, so the lesson comes before the prompt.
function showGestureIntro() {
  const dialog = document.getElementById("gesture-intro");
  if (!dialog) return false;
  if (dialog.open) return true;

  dialog.addEventListener(
    "close",
    () => {
      state.introPending = false;
      // Do not ask for the camera until there is a running game to control;
      // onGameStart() starts it if the tutorial was dismissed during boot.
      if (state.mode === "gestures" && document.body.dataset.status === "live") {
        startEngine();
      }
    },
    { once: true },
  );
  state.introPending = true;
  dialog.showModal();
  return true;
}

// ------------------------------------------------------------------- remap

function renderRemapRows() {
  for (const button of document.querySelectorAll("#remap [data-capture]")) {
    const action = button.dataset.capture;
    const code = remap[action] ?? keyNameToCode(KEYBOARD_CONTROLS[0][PAD[action]]?.value);
    button.textContent = prettyKey(code);
  }
}

// The on-page guide shows the live binding, not a frozen default, so a remap
// can never make the explanations lie.
function renderKeyGuide() {
  for (const cell of els.keyGuideCells) {
    const action = cell.dataset.keyFor;
    const code = remap[action] ?? keyNameToCode(KEYBOARD_CONTROLS[0][PAD[action]]?.value);
    cell.textContent = code ? prettyKey(code) : "—";
  }
}

function prettyKey(code) {
  if (!code) return "—";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace("Arrow", "")
    .replace("Left", " L")
    .replace("Right", " R")
    .trim();
}

function captureKey(action, button) {
  button.dataset.capturing = "true";
  button.textContent = "…";
  announce(`Press a key for ${ACTION_LABELS[action] ?? action}, or Escape to cancel`);

  const onKey = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return end();
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isReserved(event.code)) {
      announce("That key is reserved");
      return;
    }
    if (conflictWith(remap, action, event.code)) {
      announce("Already used for another action");
      return;
    }

    remap[action] = event.code;
    persistRemap();
    keyToAction = deriveKeyMap(buildControls(remap));
    applyRemapLive();
    renderRemapRows();
    renderKeyGuide();
    announce(`${ACTION_LABELS[action] ?? action} is now ${prettyKey(event.code)}`);
    end();
  };

  function end() {
    button.removeAttribute("data-capturing");
    document.removeEventListener("keydown", onKey, true);
    renderRemapRows();
    renderKeyGuide();
    button.focus();
  }

  document.addEventListener("keydown", onKey, true);
}

// ------------------------------------------------------------------ wiring

for (const radio of els.modeRadios) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    if (radio.value === "gestures") {
      const tutorial = showGestureIntro();
      applyMode(radio.value, { activateCamera: false });
      if (!tutorial && document.body.dataset.status === "live") startEngine();
    } else {
      applyMode(radio.value, { activateCamera: true });
    }
  });
}

// Game selector: switching navigates with ?game=<id> because EJS reads the
// ROM URL once at construction. The default boot is always THPS 1.
for (const radio of els.gameRadios) {
  radio.checked = radio.value === selectedGame.id;
  radio.addEventListener("change", () => {
    if (!radio.checked || radio.value === selectedGame.id) return;
    location.assign(`?game=${encodeURIComponent(radio.value)}`);
  });
}

els.boot.addEventListener("click", () => bootGame(selectedGame));
els.release.addEventListener("click", () => {
  releaseEverything("Inputs released");
  setModeHint("All inputs released. Nothing is held down.");
});

// Landscape touch devices get a full-viewport game layout. The exit control
// restores the page until the device rotates back to portrait.
els.landscapeExit?.addEventListener("click", () => {
  document.body.dataset.landscapeDismissed = "true";
  releaseEverything();
  const portrait = window.matchMedia("(orientation: portrait)");
  const clearDismiss = () => {
    delete document.body.dataset.landscapeDismissed;
    portrait.removeEventListener("change", clearDismiss);
  };
  if (portrait.matches) clearDismiss();
  else portrait.addEventListener("change", clearDismiss, { once: true });
});

document.addEventListener("keydown", (event) => {
  if (state.mode !== "keyboard") return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const action = keyToAction[event.code];
  if (!action) return;
  state.keyboardHeld.add(action);
  renderChips();
});

document.addEventListener("keyup", (event) => {
  const action = keyToAction[event.code];
  if (!action || state.mode !== "keyboard") return;
  state.keyboardHeld.delete(action);
  renderChips();
});

if (els.remap) {
  for (const button of els.remap.querySelectorAll("[data-capture]")) {
    button.addEventListener("click", () =>
      captureKey(button.dataset.capture, button),
    );
  }
  els.remap.addEventListener("close", () => {
    els.remap.returnValue = "";
  });
  renderRemapRows();
}
renderKeyGuide();

wireDialogs();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    flushSaves();
    releaseEverything();
  }
});

// EmulatorJS requests fullscreen on #game and listens for keys there. Refocus
// after the top-layer transition so keyboard input keeps reaching the core.
document.addEventListener("fullscreenchange", () => {
  requestAnimationFrame(focusGame);
});

window.addEventListener("pagehide", () => {
  flushSaves();
  releaseEverything();
  state.engine?.stop();
});

// ------------------------------------------------------------------- start

if (touch) {
  document.body.dataset.input = "touch";
  // Hide the Hands option entirely on touch devices: camera + MediaPipe +
  // emulator together are too heavy, and the pad is keyboard-mode only.
  const gesturesRadio = document.getElementById("mode-gestures");
  if (gesturesRadio) {
    gesturesRadio.disabled = true;
    gesturesRadio.checked = false;
    const label = gesturesRadio.closest("label");
    if (label) {
      label.hidden = true;
      label.setAttribute("aria-hidden", "true");
    }
  }
}

applyMode("keyboard");
refreshFiles(selectedGame);
