// Play page controller: boot, gesture engine, input bridge, mode switch.
// The emulator owns gameplay; this module owns the handoff.

import {
  CONTROL_PRESETS,
  DEFAULT_PRESET,
  DEPLOY,
  STORAGE_KEYS,
  TRACKING,
  ZONES,
  keyNameToCode,
} from "./config.js";
import { GestureEngine } from "./gesture-engine.js";
import { ACTION_LABELS, PAD, PadBridge } from "./bridge.js";
import {
  bootEmulator,
  checkGameFiles,
  getGameManager,
} from "./emulator.js";
import { drawOverlay } from "./overlay.js";
import { wireDialogs } from "./dialog.js";

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
  cameraHint: document.getElementById("camera-hint"),
  preview: document.getElementById("preview"),
  previewOff: document.getElementById("preview-off"),
  chips: [...document.querySelectorAll(".chip[data-action]")],
  modeRadios: [...document.querySelectorAll('input[name="control-mode"]')],
  presetRadios: [...document.querySelectorAll('input[name="control-preset"]')],
  reload: document.getElementById("reload"),
  presetHint: document.getElementById("preset-hint"),
  announcer: document.getElementById("announcer"),
  video: document.getElementById("camera"),
};

const previewCtx = els.preview.getContext("2d");

// Keyboard chips are read-only decoration; the emulator handles the real keys.
// Derived from the active preset so the readout always matches the mapping.
let keyToAction = deriveKeyMap(CONTROL_PRESETS[DEFAULT_PRESET].controls);

function deriveKeyMap(controls) {
  const map = {};
  for (const [action, index] of Object.entries(PAD)) {
    const code = keyNameToCode(controls[0]?.[index]?.value);
    if (code) map[code] = action;
  }
  return map;
}

const state = {
  mode: "gestures",
  preset: DEFAULT_PRESET,
  filesReady: false,
  booted: false,
  engine: null,
  bridge: new PadBridge(getGameManager),
  keyboardHeld: new Set(),
};

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
      // One preview redraw per inference (20 fps during play) instead of a
      // second rAF loop fighting the emulator for the frame budget.
      onHands: drawPreview,
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

function drawPreview() {
  const engine = state.engine;
  const running = Boolean(engine?.running);
  drawOverlay(previewCtx, {
    video: els.video,
    hands: running ? engine.hands : [],
    fps: engine?.fps ?? 0,
    running,
    zones: ZONES,
    labels: false,
    hud: false,
    offText: ["Camera off", ""],
  });
}

// ------------------------------------------------------------------- input

function handleInput(event) {
  // Guard against a press arriving in the same tick as a mode switch.
  if (state.mode !== "gestures") return;
  state.bridge.apply(event);
  renderChips();
  if (event.press) announce(`Pressed ${ACTION_LABELS[event.action] ?? event.action}`);
}

function releaseEverything(message) {
  state.engine?.releaseAll();
  state.bridge.releaseAll();
  state.keyboardHeld.clear();
  renderChips();
  if (message) announce(message);
}

// -------------------------------------------------------------------- mode

function readMode() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.mode);
  } catch {
    // Restricted storage: fall back to the deploy default.
  }
  if (stored === "keyboard" || stored === "gestures") return stored;
  // No saved choice yet: keyboard-first on the deployed site so the camera
  // permission prompt does not fire on arrival; gestures locally.
  return DEPLOY.defaultMode;
}

function readPreset() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.controls);
    if (stored && CONTROL_PRESETS[stored]) return stored;
  } catch {
    // Restricted storage: fall back to the default preset.
  }
  return DEFAULT_PRESET;
}

function applyPreset(id) {
  state.preset = id;
  keyToAction = deriveKeyMap(CONTROL_PRESETS[id].controls);
  for (const radio of els.presetRadios) radio.checked = radio.value === id;
  try {
    localStorage.setItem(STORAGE_KEYS.controls, id);
  } catch {
    // Restricted storage: the choice lasts for this session only.
  }
  if (els.presetHint) els.presetHint.textContent = CONTROL_PRESETS[id].note;
  // EJS snapshots controls when it boots; changing them later needs a reload.
  if (els.reload) els.reload.hidden = !state.booted;
  if (state.mode === "keyboard") {
    setModeHint(
      id === "skate"
        ? "Keyboard — Skate: WASD to steer, I/J/K/L for tricks, O for R2."
        : "Keyboard — Desktop: Z, X, S, A, arrows, Enter. Matches the desktop app.",
    );
  }
}

function applyMode(mode, { activateCamera = false } = {}) {
  state.mode = mode;
  localStorage.setItem(STORAGE_KEYS.mode, mode);
  for (const radio of els.modeRadios) radio.checked = radio.value === mode;

  if (mode === "keyboard") {
    stopEngine();
    releaseEverything();
    els.previewOff.hidden = false;
    setModeHint(
      state.preset === "skate"
        ? "Keyboard — Skate: WASD to steer, I/J/K/L for tricks, O for R2."
        : "Keyboard — Desktop: Z, X, S, A, arrows, Enter. Matches the desktop app.",
    );
    document.body.dataset.mode = "keyboard";
  } else {
    setModeHint("Gesture mode. Left hand steers, right hand tricks.");
    document.body.dataset.mode = "gestures";
    if (activateCamera) startEngine();
  }
}

// ------------------------------------------------------------------- files

async function refreshFiles() {
  els.boot.disabled = true;
  setStatus("busy", "Loading");
  els.gateHint.textContent = "Loading…";

  const result = await checkGameFiles();
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

  // The deployed build boots on arrival; local dev waits for a button press.
  if (result.ready && DEPLOY.autoStart && !state.booted) bootGame();
}

// ---------------------------------------------------------------- emulator

function bootGame() {
  if (!state.filesReady || state.booted) return;

  state.booted = true;
  els.gate.hidden = true;
  els.boot.disabled = true;
  setStatus("busy", "Loading the emulator");

  bootEmulator({
    player: "#game",
    controls: CONTROL_PRESETS[state.preset].controls,
    onGameStart: () => {
      setStatus("live", "Game running");
      // The camera starts once the game is actually running, so the
      // permission prompt never covers the boot screen.
      if (state.mode === "gestures" && !state.engine?.running) startEngine();
    },
    onExit: () => {
      releaseEverything();
      setStatus("idle", "Emulator stopped");
      state.booted = false;
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
      dialog.returnValue = ""; // Esc and other dismissals set no value.
    },
    { once: true },
  );
  dialog.showModal();
}

// ------------------------------------------------------------------ wiring

for (const radio of els.modeRadios) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    // First time choosing Gestures: show the short animated introduction.
    if (radio.value === "gestures") showGestureIntro();
    applyMode(radio.value, { activateCamera: true });
  });
}

for (const radio of els.presetRadios) {
  radio.addEventListener("change", () => {
    if (radio.checked) applyPreset(radio.value);
  });
}

els.reload?.addEventListener("click", () => location.reload());

els.boot.addEventListener("click", bootGame);
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

wireDialogs();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseEverything();
});

window.addEventListener("pagehide", () => {
  releaseEverything();
  state.engine?.stop();
});

// ------------------------------------------------------------------- start

applyMode(readMode());
applyPreset(readPreset());
drawPreview();
refreshFiles();
