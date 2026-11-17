// Play page controller: boot, gesture engine, input bridge, mode switch.
// The emulator owns gameplay; this module owns the handoff.

import { DEPLOY, STORAGE_KEYS, TRACKING, ZONES } from "./config.js";
import { GestureEngine } from "./gesture-engine.js";
import { ACTION_LABELS, PadBridge } from "./bridge.js";
import {
  bootEmulator,
  checkGameFiles,
  getGameManager,
} from "./emulator.js";
import { drawOverlay } from "./overlay.js";
import { wireTrickSheet } from "./dialog.js";

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
  announcer: document.getElementById("announcer"),
  video: document.getElementById("camera"),
};

const previewCtx = els.preview.getContext("2d");

// Keyboard chips are read-only decoration; the emulator handles the real keys.
const KEY_TO_ACTION = {
  KeyZ: "cross",
  KeyX: "circle",
  KeyS: "triangle",
  KeyA: "square",
  ArrowUp: "dpad_up",
  ArrowDown: "dpad_down",
  ArrowLeft: "dpad_left",
  ArrowRight: "dpad_right",
  KeyE: "r2",
};

const state = {
  mode: "gestures",
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
  const stored = localStorage.getItem(STORAGE_KEYS.mode);
  if (stored === "keyboard" || stored === "gestures") return stored;
  // No saved choice yet: keyboard-first on the deployed site so the camera
  // permission prompt does not fire on arrival; gestures locally.
  return DEPLOY.defaultMode;
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
      "Keyboard mode. Same layout as the desktop app: Z, X, S, A, arrows, Enter.",
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

// ------------------------------------------------------------------ wiring

for (const radio of els.modeRadios) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    applyMode(radio.value, { activateCamera: true });
  });
}

els.boot.addEventListener("click", bootGame);
els.release.addEventListener("click", () => {
  releaseEverything("Inputs released");
  setModeHint("All inputs released. Nothing is held down.");
});

document.addEventListener("keydown", (event) => {
  if (state.mode !== "keyboard") return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const action = KEY_TO_ACTION[event.code];
  if (!action) return;
  state.keyboardHeld.add(action);
  renderChips();
});

document.addEventListener("keyup", (event) => {
  const action = KEY_TO_ACTION[event.code];
  if (!action || state.mode !== "keyboard") return;
  state.keyboardHeld.delete(action);
  renderChips();
});

wireTrickSheet();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseEverything();
});

window.addEventListener("pagehide", () => {
  releaseEverything();
  state.engine?.stop();
});

// ------------------------------------------------------------------- start

applyMode(readMode());
drawPreview();
refreshFiles();
