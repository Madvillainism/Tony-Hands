// Play page controller: boot, gesture engine, input bridge, mode switch.
// The emulator owns gameplay; this module owns the handoff.

import {
  buildControls,
  codeToKeyCode,
  DEPLOY,
  KEYBOARD_CONTROLS,
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
  preview: document.getElementById("preview"),
  previewOff: document.getElementById("preview-off"),
  chips: [...document.querySelectorAll(".chip[data-action]")],
  modeRadios: [...document.querySelectorAll('input[name="control-mode"]')],
  announcer: document.getElementById("announcer"),
  video: document.getElementById("camera"),
  remap: document.getElementById("remap"),
};

const previewCtx = els.preview.getContext("2d");

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

function applyMode(mode, { activateCamera = false } = {}) {
  state.mode = mode;
  for (const radio of els.modeRadios) radio.checked = radio.value === mode;

  if (mode === "keyboard") {
    stopEngine();
    releaseEverything();
    els.previewOff.hidden = false;
    setModeHint("Keyboard — WASD to steer, I/J/K/L for tricks, O for R2.");
    document.body.dataset.mode = "keyboard";
    // EJS binds keys to #game; after clicking UI, put focus back so keys work.
    if (state.booted) document.querySelector("#game")?.focus();
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

  if (result.ready && DEPLOY.autoStart && !state.booted) bootGame();
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

function bootGame() {
  if (!state.filesReady || state.booted) return;

  state.booted = true;
  els.gate.hidden = true;
  els.boot.disabled = true;
  setStatus("busy", "Loading the emulator");

  bootEmulator({
    player: "#game",
    controls: buildControls(remap),
    onGameStart: () => {
      applyRemapLive();
      setStatus("live", "Game running");
      if (state.mode === "gestures" && !state.engine?.running) startEngine();
      // Make sure keys reach EJS immediately after the auto-boot.
      if (state.mode === "keyboard") document.querySelector("#game")?.focus();
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

applyMode("keyboard");
drawPreview();
refreshFiles();
