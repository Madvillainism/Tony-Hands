// Tony-Hands web demo.
//
// Runs MediaPipe Hand Landmarker in the browser, feeds the same gesture and
// state-machine logic as the desktop app (./gestures.js), and visualises the
// inputs a game would receive. No keyboard injection happens here: the demo is
// for checking that the camera, gestures, and zones behave.

import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import {
  ActionStateMachine,
  HandTracker,
  MovementStateMachine,
  R2TapStateMachine,
  classifyGesture,
  palmCenter,
} from "./gestures.js";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Mirrors config.toml. Keeping the same numbers is the point of the demo.
const ZONES = {
  left_max: 0.2,
  right_min: 0.3,
  up_max: 0.25,
  down_min: 0.75,
  hysteresis: 0.05,
};

const COLORS = {
  left: "#ff9f43",
  right: "#4dd0e1",
  zone: "rgba(233, 239, 246, 0.35)",
  hairline: "rgba(233, 239, 246, 0.16)",
  split: "#ffd166",
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const ACTION_LABELS = {
  dpad_up: "Up",
  dpad_down: "Down",
  dpad_left: "Left",
  dpad_right: "Right",
  cross: "Cross",
  circle: "Circle",
  triangle: "Triangle",
  square: "Square",
  r2: "R2",
};

const els = {
  button: document.getElementById("start"),
  canvas: document.getElementById("stage"),
  video: document.getElementById("camera"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  error: document.getElementById("error"),
  summary: document.getElementById("summary"),
  live: document.getElementById("live"),
  hands: document.getElementById("hands"),
  chips: [...document.querySelectorAll(".chip[data-action]")],
};

const ctx = els.canvas.getContext("2d");

const state = {
  running: false,
  starting: false,
  landmarker: null,
  landmarkerPromise: null,
  stream: null,
  tracker: null,
  movement: null,
  actions: null,
  r2: null,
  pressed: new Set(),
  hands: [],
  fps: 0,
  lastFrameAt: 0,
  lastVideoTime: -1,
  lastTimestamp: 0,
  lastDt: 0,
  rafId: 0,
  summaryText: "",
  handsText: "",
  pendingAnnouncement: "",
  announcedText: "",
};

// --------------------------------------------------------------- UI helpers

function setStatus(mode, text) {
  els.status.dataset.state = mode;
  els.statusText.textContent = text;
  if (mode !== "busy") queueAnnouncement(composeAnnouncement());
  if (mode === "off") els.hands.textContent = "No hands detected.";
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
  setStatus("error", "Something went wrong");
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function composeAnnouncement() {
  const active = [...state.pressed].map((action) => ACTION_LABELS[action]);
  if (state.pressed.size === 0) {
    return `${els.statusText.textContent}. Nothing pressed.`;
  }
  return `${els.statusText.textContent}. Pressed: ${active.join(", ")}.`;
}

// One polite region for the whole page. Inputs can change many times per
// second, so updates are batched instead of announced on every frame.
let announceTimer = 0;

function queueAnnouncement(text) {
  // "Loading…" style states are visible but not worth interrupting speech for.
  if (els.status.dataset.state === "busy") return;
  state.pendingAnnouncement = text;
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    const next = state.pendingAnnouncement;
    state.pendingAnnouncement = "";
    if (!next || next === state.announcedText) return;
    state.announcedText = next;
    els.live.textContent = next;
  }, 400);
}

function renderPressed() {
  for (const chip of els.chips) {
    chip.classList.toggle("is-active", state.pressed.has(chip.dataset.action));
  }

  const labels = [...state.pressed].map((action) => ACTION_LABELS[action]);
  const summary = labels.length ? labels.join(" · ") : "Nothing pressed";
  if (summary !== state.summaryText) {
    state.summaryText = summary;
    els.summary.textContent = summary;
    queueAnnouncement(composeAnnouncement());
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

// ------------------------------------------------------------------ model

async function loadLandmarker() {
  if (state.landmarker) return state.landmarker;
  if (state.landmarkerPromise) return state.landmarkerPromise;

  state.landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.5,
    };

    try {
      return await HandLandmarker.createFromOptions(vision, options);
    } catch (gpuError) {
      console.warn("GPU delegate unavailable, falling back to CPU.", gpuError);
      options.baseOptions.delegate = "CPU";
      return HandLandmarker.createFromOptions(vision, options);
    }
  })();

  try {
    state.landmarker = await state.landmarkerPromise;
    return state.landmarker;
  } catch (error) {
    state.landmarkerPromise = null;
    throw error;
  }
}

// ------------------------------------------------------------------- start

function resetMachines() {
  state.tracker = new HandTracker();
  state.movement = new MovementStateMachine({
    leftMax: ZONES.left_max,
    rightMin: ZONES.right_min,
    upMax: ZONES.up_max,
    downMin: ZONES.down_min,
    hysteresis: ZONES.hysteresis,
  });
  state.actions = new ActionStateMachine();
  state.r2 = new R2TapStateMachine();
  state.pressed.clear();
  renderPressed();
}

async function start() {
  if (state.running || state.starting) return;

  if (!window.isSecureContext) {
    showError(
      "Camera access needs a secure context. Open this page over HTTPS or on localhost (for example, python -m http.server).",
    );
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showError("This browser does not expose a camera API.");
    return;
  }

  state.starting = true;
  clearError();
  els.button.disabled = true;
  setStatus("busy", "Requesting camera access…");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });

    state.stream = stream;
    els.video.srcObject = stream;
    await els.video.play();

    resizeCanvas();
    resetMachines();
    state.hands = [];
    renderHands([]);
    state.lastVideoTime = -1;
    state.lastFrameAt = 0;
    state.lastDt = 0;
    state.running = true;

    els.button.textContent = "Stop camera";
    els.button.dataset.running = "true";
    els.button.disabled = false;
    setStatus("busy", "Loading hand model…");

    state.rafId = requestAnimationFrame(loop);
    await loadLandmarker();

    if (!state.running) return;
    setStatus("live", "Tracking. Show your hands.");
  } catch (error) {
    console.error(error);
    const denied =
      error?.name === "NotAllowedError" || error?.name === "SecurityError";
    showError(
      denied
        ? "Camera access was blocked. Allow it in the address bar (or in your browser's site settings) and try again."
        : `Could not start the demo: ${error?.message ?? error}`,
    );
    stop({ keepError: true });
  } finally {
    state.starting = false;
  }
}

function stop({ keepError = false } = {}) {
  state.running = false;
  cancelAnimationFrame(state.rafId);

  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
  els.video.srcObject = null;

  state.hands = [];
  state.pressed.clear();
  renderPressed();
  renderHands([]);

  els.button.textContent = "Start camera";
  els.button.dataset.running = "false";
  els.button.disabled = false;

  if (!keepError) {
    clearError();
    setStatus("off", "Camera off");
  }
  draw();
}

// -------------------------------------------------------------------- loop

function loop(now) {
  if (!state.running) return;
  state.rafId = requestAnimationFrame(loop);

  if (els.video.videoWidth && els.canvas.width !== els.video.videoWidth) {
    resizeCanvas();
  }

  if (els.video.readyState >= 2 && els.video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = els.video.currentTime;
    runInference(now);
  }

  draw();
}

function runInference(now) {
  if (!state.landmarker) return;

  const timestamp = Math.max(now, state.lastTimestamp + 1);
  state.lastTimestamp = timestamp;

  let result;
  try {
    result = state.landmarker.detectForVideo(els.video, timestamp);
  } catch (error) {
    console.error("Hand detection failed.", error);
    return;
  }

  if (state.lastFrameAt > 0) {
    const fps = 1000 / Math.max(1, now - state.lastFrameAt);
    state.fps = state.fps === 0 ? fps : state.fps * 0.9 + fps * 0.1;
  }
  state.lastFrameAt = now;

  const dtMs = state.lastDt ? Math.min(now - state.lastDt, 100) : 0;
  state.lastDt = now;

  // Mirrored coordinates: the preview and the desktop app both treat the
  // user's left side as the left half of the frame.
  const detections = (result.landmarks ?? []).map((landmarks) => {
    const center = palmCenter(landmarks);
    return { x: 1 - center.x, y: center.y, landmarks };
  });

  const tracks = state.tracker.update(detections);
  const hands = [];

  for (const track of tracks) {
    if (track.lost > 0) continue;
    hands.push({
      side: track.side,
      x: track.sx,
      y: track.sy,
      gesture: classifyGesture(track.landmarks),
      landmarks: track.landmarks,
    });
  }

  state.hands = hands;
  renderHands(hands);
  route(hands, dtMs);
}

function route(hands, dtMs) {
  const events = [];

  state.actions.tick(dtMs);
  events.push(...state.r2.tick(dtMs));

  const left = hands.find((hand) => hand.side === "left");
  const right = hands.find((hand) => hand.side === "right");

  if (left) {
    events.push(...state.movement.update(left.x, left.y));
    events.push(...state.r2.update(left.gesture));
  } else {
    // No left hand: return to neutral so a lost hand cannot leave a D-Pad
    // direction stuck down.
    events.push(...state.movement.update(0.5, 0.5));
    events.push(...state.r2.update(null));
  }

  if (right) {
    events.push(...state.actions.update(right.gesture));
  } else {
    events.push(...state.actions.update(null));
  }

  if (events.length === 0) return;

  for (const event of events) {
    if (event.press) state.pressed.add(event.action);
    else state.pressed.delete(event.action);
  }
  renderPressed();
}

// ------------------------------------------------------------------- canvas

function resizeCanvas() {
  const width = els.video.videoWidth || 640;
  const height = els.video.videoHeight || 480;
  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
}

function draw() {
  const width = els.canvas.width;
  const height = els.canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#05080b";
  ctx.fillRect(0, 0, width, height);

  if (state.running && els.video.readyState >= 2) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(els.video, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(233, 239, 246, 0.55)";
    ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Camera is off", width / 2, height / 2 - 8);
    ctx.font = "400 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Press “Start camera” to begin", width / 2, height / 2 + 20);
    ctx.textAlign = "start";
    return;
  }

  drawZones(width, height);
  for (const hand of state.hands) drawHand(hand, width, height);
  drawHud(width, height);
}

function drawZones(width, height) {
  const x = (value) => value * width;
  const y = (value) => value * height;

  // Left / right halves.
  ctx.strokeStyle = COLORS.split;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(0.5), 0);
  ctx.lineTo(x(0.5), height);
  ctx.stroke();

  // Steering thresholds.
  ctx.strokeStyle = COLORS.zone;
  ctx.lineWidth = 1;
  for (const value of [ZONES.left_max, ZONES.right_min]) {
    ctx.beginPath();
    ctx.moveTo(x(value), 0);
    ctx.lineTo(x(value), height);
    ctx.stroke();
  }

  // Up / down thresholds inside the movement half.
  ctx.beginPath();
  ctx.moveTo(0, y(ZONES.up_max));
  ctx.lineTo(x(0.5), y(ZONES.up_max));
  ctx.moveTo(0, y(ZONES.down_min));
  ctx.lineTo(x(0.5), y(ZONES.down_min));
  ctx.stroke();

  // Hysteresis exits, dotted like the desktop overlay.
  ctx.save();
  ctx.setLineDash([2, 8]);
  ctx.strokeStyle = COLORS.hairline;
  for (const value of [
    ZONES.left_max + ZONES.hysteresis,
    ZONES.right_min - ZONES.hysteresis,
  ]) {
    ctx.beginPath();
    ctx.moveTo(x(value), 0);
    ctx.lineTo(x(value), height);
    ctx.stroke();
  }
  for (const value of [
    ZONES.up_max + ZONES.hysteresis,
    ZONES.down_min - ZONES.hysteresis,
  ]) {
    ctx.beginPath();
    ctx.moveTo(0, y(value));
    ctx.lineTo(x(0.5), y(value));
    ctx.stroke();
  }
  ctx.restore();

  label("MOVE", 10, 22, COLORS.split);
  label("ACTIONS", x(0.5) + 10, 22, COLORS.split);
  label("L", x(ZONES.left_max) - 18, height - 14, COLORS.split);
  label("N", (x(ZONES.left_max) + x(ZONES.right_min)) / 2 - 5, height - 14, COLORS.zone);
  label("R", x(ZONES.right_min) + 6, height - 14, COLORS.split);
  label("U", 8, y(ZONES.up_max) - 6, COLORS.split);
  label("D", 8, y(ZONES.down_min) + 14, COLORS.split);
}

function label(text, x, y, color) {
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(5, 8, 11, 0.75)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHand(hand, width, height) {
  const color = hand.side === "left" ? COLORS.left : COLORS.right;
  const px = (point) => (1 - point.x) * width;
  const py = (point) => point.y * height;
  const landmarks = hand.landmarks;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [from, to] of HAND_CONNECTIONS) {
    ctx.moveTo(px(landmarks[from]), py(landmarks[from]));
    ctx.lineTo(px(landmarks[to]), py(landmarks[to]));
  }
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(px(point), py(point), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Palm marker sits at the tracked, smoothed position.
  const palmX = hand.x * width;
  const palmY = hand.y * height;
  ctx.beginPath();
  ctx.arc(palmX, palmY, 12, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  const text = `${hand.side.toUpperCase()} · ${hand.gesture.replace("_", " ")}`;
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  const padding = 6;
  const textWidth = ctx.measureText(text).width;
  const boxX = Math.min(Math.max(palmX - textWidth / 2 - padding, 4), width - textWidth - padding * 2 - 4);
  const boxY = Math.max(palmY - 40, 30);

  ctx.fillStyle = "rgba(5, 8, 11, 0.78)";
  ctx.fillRect(boxX, boxY - 16, textWidth + padding * 2, 22);
  ctx.fillStyle = color;
  ctx.fillText(text, boxX + padding, boxY);
}

function drawHud(width, height) {
  const text = `${state.fps.toFixed(0)} fps · ${state.hands.length} hand${state.hands.length === 1 ? "" : "s"}`;
  ctx.font = "600 13px ui-monospace, SFMono-Regular, Consolas, monospace";
  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = "rgba(5, 8, 11, 0.6)";
  ctx.fillRect(width - textWidth - 22, height - 34, textWidth + 14, 24);
  ctx.fillStyle = "#e9eff6";
  ctx.fillText(text, width - textWidth - 15, height - 17);
}

// ------------------------------------------------------------------ wiring

els.button.addEventListener("click", () => {
  if (state.running) stop();
  else start();
});

window.addEventListener("beforeunload", () => {
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) state.lastVideoTime = -1;
});

draw();
