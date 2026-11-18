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
};

const touch = isTouchDevice();
const selectedGame = resolveGame();
try {
  localStorage.setItem(STORAGE_KEYS.game, selectedGame.id);
} catch {
  // Restricted storage: the selection lasts for this load only.
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
          : `Gesture mode · ${delegate} tracking. Left hand steers, right hand tricks.`,
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
  // Thumbs-down toggles pause. Edge-triggered and never sent to the bridge:
  // pause is not a RetroPad button, and the matching release must be ignored.
  if (event.action === "pause") {
    if (event.press) {
      releaseEverything();
      getEmulator()?.togglePlaying();
    }
    return;
  }
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
  // Touch devices are keyboard-only: the on-screen pad replaces gestures.
  if (touch && mode === "gestures") mode = "keyboard";
  state.mode = mode;
  for (const radio of els.modeRadios) radio.checked = radio.value === mode;

  if (mode === "keyboard") {
    stopEngine();
    releaseEverything();
    els.previewOff.hidden = false;
    setModeHint("Keyboard — WASD to steer, I/J/K/L for tricks, O for R2.");
    document.body.dataset.mode = "keyboard";
    // EJS binds keys to #game; refocus after UI clicks so keys work. On touch
    // devices focusing #game can raise the soft keyboard — never do it there.
    if (!touch && state.booted) document.querySelector("#game")?.focus();
  } else {
    setModeHint("Gesture mode. Left hand steers, right hand tricks.");
    document.body.dataset.mode = "gestures";
    if (activateCamera) startEngine();
  }
}

// When MediaPipe falls back to CPU, throttle to the lighter tier so the
// emulator keeps its frame budget on weaker laptops.
function applyDelegateQuality(delegate) {
  state.engine?.setQuality?.(delegate === "CPU" ? "cpu" : null);
  if (delegate === "CPU") {
    setModeHint("Gesture mode · CPU tracking. Lowered to a lighter tier.");
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
      ? "Loading the game. Switch to Gestures any time to play with your hands."
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

function bootGame(game = selectedGame) {
  if (!state.filesReady || state.booted) return;

  state.booted = true;
  document.body.dataset.booted = "true";
  els.gate.hidden = true;
  els.boot.disabled = true;
  setStatus("busy", "Loading the emulator");

  bootEmulator({
    player: "#game",
    game,
    controls: buildControls(remap),
    onGameStart: () => {
      applyRemapLive();
      setStatus("live", "Game running");
      if (state.mode === "gestures" && !state.engine?.running) startEngine();
      // Make sure keys reach EJS immediately after the auto-boot (not on touch).
      if (!touch && state.mode === "keyboard") document.querySelector("#game")?.focus();
    },
    onExit: () => {
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

function showGestureIntro() {
  const dialog = document.getElementById("gesture-intro");
  if (!dialog) return;
  let seen = false;
  try {
    seen = localStorage.getItem(STORAGE_KEYS.introSeen) === "1";
  } catch {
    // Restricted storage: show it once per session instead.
  }
  if (seen || dialog.open) return;

  dialog.addEventListener(
    "close",
    () => {
      try {
        localStorage.setItem(STORAGE_KEYS.introSeen, "1");
      } catch {
        // Restricted storage: closing is still enough for this session.
      }
      dialog.returnValue = "";
    },
    { once: true },
  );
  dialog.showModal();
}

// ------------------------------------------------------------------- remap

function renderRemapRows() {
  for (const button of document.querySelectorAll("#remap [data-capture]")) {
    const action = button.dataset.capture;
    const code = remap[action] ?? keyNameToCode(KEYBOARD_CONTROLS[0][PAD[action]]?.value);
    button.textContent = prettyKey(code);
  }
}

function prettyKey(code) {
  if (!code) return "—";
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
    announce(`${ACTION_LABELS[action] ?? action} is now ${prettyKey(event.code)}`);
    end();
  };

  function end() {
    button.removeAttribute("data-capturing");
    document.removeEventListener("keydown", onKey, true);
    renderRemapRows();
    button.focus();
  }

  document.addEventListener("keydown", onKey, true);
}

// ------------------------------------------------------------------ wiring

for (const radio of els.modeRadios) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    if (radio.value === "gestures") showGestureIntro();
    applyMode(radio.value, { activateCamera: true });
  });
}

// Game selector: switching navigates with ?game=<id> because EJS reads the
// ROM URL once at construction, so a fresh page is the reliable path.
for (const radio of els.gameRadios) {
  radio.checked = radio.value === selectedGame.id;
  radio.addEventListener("change", () => {
    if (!radio.checked || radio.value === selectedGame.id) return;
    try {
      localStorage.setItem(STORAGE_KEYS.game, radio.value);
    } catch {
      // Restricted storage: the URL still carries the choice.
    }
    location.assign(`?game=${encodeURIComponent(radio.value)}`);
  });
}

els.boot.addEventListener("click", () => bootGame(selectedGame));
els.release.addEventListener("click", () => {
  releaseEverything("Inputs released");
  setModeHint("All inputs released. Nothing is held down.");
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

wireDialogs();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseEverything();
});

window.addEventListener("pagehide", () => {
  releaseEverything();
  state.engine?.stop();
});

// ------------------------------------------------------------------- start

if (touch) {
  document.body.dataset.input = "touch";
  // Hide the Gestures option entirely on touch devices: camera + MediaPipe +
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
