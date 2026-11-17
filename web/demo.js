// Gesture test bench. Same engine as the play page, with the full overlay.

import { TRACKING, ZONES } from "./config.js";
import { GestureEngine } from "./gesture-engine.js";
import { ACTION_LABELS } from "./bridge.js";
import { drawOverlay } from "./overlay.js";
import { wireDialogs } from "./dialog.js";

const els = {
  start: document.getElementById("start"),
  statusText: document.getElementById("status-text"),
  lamp: document.querySelector("[data-lamp]"),
  fps: document.getElementById("bench-fps"),
  hands: document.getElementById("hands"),
  summary: document.getElementById("summary"),
  error: document.getElementById("error"),
  announcer: document.getElementById("announcer"),
  canvas: document.getElementById("stage"),
  video: document.getElementById("camera"),
  tricks: document.getElementById("tricks"),
  chips: [...document.querySelectorAll(".chip[data-action]")],
};

const ctx = els.canvas.getContext("2d");

const state = {
  engine: null,
  drawLoop: 0,
  summaryText: "",
  handsText: "",
};

let announceTimer = 0;
let lastAnnouncement = "";

function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (!text || text === lastAnnouncement) return;
    lastAnnouncement = text;
    els.announcer.textContent = text;
  }, 500);
}

function setStatus(kind, text) {
  document.body.dataset.status = kind;
  els.statusText.textContent = text;
  if (els.lamp) els.lamp.dataset.tone = kind;
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}

function clearError() {
  els.error.textContent = "";
  els.error.hidden = true;
}

function renderChips() {
  const pressed = state.engine?.pressed ?? new Set();
  for (const chip of els.chips) {
    chip.classList.toggle("is-active", pressed.has(chip.dataset.action));
  }

  const labels = [...pressed].map((action) => ACTION_LABELS[action] ?? action);
  const summary = labels.length ? labels.join(" · ") : "Nothing pressed";
  if (summary !== state.summaryText) {
    state.summaryText = summary;
    els.summary.textContent = summary;
    if (labels.length) announce(`Pressed: ${labels.join(", ")}`);
  }
}

function renderHands(hands) {
  const text = hands.length
    ? hands
        .map((hand) => `${hand.side}: ${hand.gesture.replace("_", " ")}`)
        .join(" · ")
    : "No hands detected.";
  if (text !== state.handsText) {
    state.handsText = text;
    els.hands.textContent = text;
  }
}

function resizeCanvas() {
  const width = els.video.videoWidth || 640;
  const height = els.video.videoHeight || 480;
  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
}

function drawOnce() {
  const engine = state.engine;
  drawOverlay(ctx, {
    video: els.video,
    hands: engine?.hands ?? [],
    fps: engine?.fps ?? 0,
    running: Boolean(engine?.running),
    zones: ZONES,
    labels: true,
    hud: true,
    offText: ["Camera is off", "Press “Start camera” to begin"],
  });
  els.fps.textContent = `${Math.round(engine?.fps ?? 0)} fps`;
}

function drawLoop() {
  state.drawLoop = requestAnimationFrame(drawLoop);
  resizeCanvas();
  drawOnce();
}

function startDrawing() {
  if (state.drawLoop) return;
  state.drawLoop = requestAnimationFrame(drawLoop);
}

function stopDrawing() {
  cancelAnimationFrame(state.drawLoop);
  state.drawLoop = 0;
  drawOnce();
}

if (!state.engine) {
  state.engine = new GestureEngine({
    video: els.video,
    tracking: TRACKING.demo,
    zones: ZONES,
    onInput: () => renderChips(),
    onHands: renderHands,
    onStatus: (status) => {
      setStatus(status.state === "live" ? "live" : status.state, status.text);
      if (status.state === "live") {
        startDrawing();
      } else if (status.state === "off") {
        renderChips();
        renderHands([]);
        stopDrawing();
      }
    },
    onError: (message) => {
      showError(message);
      setStatus("error", "Camera problem");
    },
  });
}

els.start.addEventListener("click", () => {
  const engine = state.engine;
  if (engine.running) {
    engine.stop();
    els.start.textContent = "Start camera";
    els.start.dataset.running = "false";
    clearError();
    return;
  }
  clearError();
  els.start.textContent = "Stop camera";
  els.start.dataset.running = "true";
  engine.start();
});

wireDialogs();

window.addEventListener("pagehide", () => state.engine?.stop());

drawOnce();
