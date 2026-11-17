// Camera + MediaPipe + gesture state machines, without any drawing.
//
// `main.js` used to own the camera, the inference loop, the canvas overlay and
// the input readout all at once. Both pages need the first three and neither
// wants the fourth in the same place, so the loop lives here and consumers get
// callbacks plus readable state.
//
// Consumers:
//   demo.html  draws zones/skeletons from `engine.hands`
//   index.html forwards `onInput` to the emulator through bridge.js

import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import {
  ActionStateMachine,
  HandTracker,
  MovementStateMachine,
  R2TapStateMachine,
  classifyGesture,
  palmCenter,
} from "./gestures.js";
import { MEDIAPIPE, TRACKING, ZONES } from "./config.js";

// The model and WASM runtime are page-wide, so a second start() reuses them.
let landmarkerPromise = null;

function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmUrl);
      const options = {
        baseOptions: {
          modelAssetPath: MEDIAPIPE.modelUrl,
          delegate: "GPU",
        },
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
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

const NO_HANDS = Object.freeze([]);

export class GestureEngine {
  /**
   * @param {object} options
   * @param {HTMLVideoElement} options.video Hidden element the camera feeds.
   * @param {(hands: Array) => void} [options.onHands] Per-inference hand list.
   * @param {(event: {action: string, press: boolean}) => void} [options.onInput]
   * @param {(status: {state: string, text: string}) => void} [options.onStatus]
   * @param {(message: string) => void} [options.onError]
   * @param {object} [options.zones] Movement thresholds.
   * @param {{width: number, height: number, fps: number}} [options.tracking]
   */
  constructor({
    video,
    onHands = () => {},
    onInput = () => {},
    onStatus = () => {},
    onError = () => {},
    zones = ZONES,
    tracking = TRACKING.demo,
  }) {
    this.video = video;
    this.onHands = onHands;
    this.onInput = onInput;
    this.onStatus = onStatus;
    this.onError = onError;
    this.zones = zones;
    this.tracking = tracking;

    this.running = false;
    this.starting = false;
    this.hands = NO_HANDS;
    this.pressed = new Set();
    this.fps = 0;

    this.landmarker = null;
    this.stream = null;
    this.tracker = null;
    this.movement = null;
    this.actions = null;
    this.r2 = null;

    this.rafId = 0;
    this.lastVideoTime = -1;
    this.lastTimestamp = 0;
    this.lastInferenceAt = 0;
    this.lastFrameAt = 0;
    this.lastDt = 0;
  }

  get minFrameMs() {
    return this.tracking.fps > 0 ? 1000 / this.tracking.fps : 0;
  }

  async start() {
    if (this.running || this.starting) return;
    this.starting = true;
    // A stop() during one of the awaits below must invalidate this start, so
    // a late promise cannot revive the engine.
    const token = (this.startToken = (this.startToken ?? 0) + 1);
    const alive = () => token === this.startToken;

    try {
      if (!window.isSecureContext) {
        throw new Error(
          "Camera access needs a secure context. Open this page over HTTPS or on localhost, for example: python -m http.server 8000 --directory web",
        );
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not expose a camera API.");
      }

      this.onStatus({ state: "busy", text: "Requesting camera access…" });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: this.tracking.width },
          height: { ideal: this.tracking.height },
        },
      });

      if (!alive()) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();

      if (!alive()) {
        this.teardown();
        return;
      }

      this.resetMachines();
      this.lastVideoTime = -1;
      this.lastTimestamp = 0;
      this.lastInferenceAt = 0;
      this.lastFrameAt = 0;
      this.lastDt = 0;
      this.running = true;
      this.rafId = requestAnimationFrame(this.loop);

      this.onStatus({ state: "busy", text: "Loading hand model…" });
      const landmarker = await loadLandmarker();

      if (!alive() || !this.running) return;
      this.landmarker = landmarker;
      this.onStatus({ state: "live", text: "Watching your hands." });
    } catch (error) {
      this.running = false;
      cancelAnimationFrame(this.rafId);

      const denied =
        error?.name === "NotAllowedError" || error?.name === "SecurityError";
      this.onError(
        denied
          ? "Camera access was blocked. Allow it in the address bar or your browser's site settings, then try again."
          : error?.message ?? String(error),
      );
      this.teardown();
      this.onStatus({ state: "off", text: "Camera off" });
    } finally {
      if (alive()) this.starting = false;
    }
  }

  stop() {
    this.startToken = (this.startToken ?? 0) + 1;
    this.starting = false;
    if (!this.running && !this.stream) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.releaseAll();
    this.teardown();
    this.hands = NO_HANDS;
    this.fps = 0;
    this.onStatus({ state: "off", text: "Camera off" });
  }

  applyEvents(events) {
    for (const event of events) {
      if (event.press) this.pressed.add(event.action);
      else this.pressed.delete(event.action);
      this.onInput(event);
    }
  }

  // Release without stopping, for tab switches and mode changes. Reset the
  // machines too: otherwise re-entering the same zone emits no new press, so
  // the game never sees the input again after a release.
  releaseAll() {
    // Reset the machines first: their release events clear matching entries
    // from `pressed`, so the loop below only handles non-movement actions.
    if (this.movement) this.applyEvents(this.movement.release());
    for (const action of [...this.pressed]) {
      this.pressed.delete(action);
      this.onInput({ action, press: false });
    }
  }

  teardown() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
    this.tracker = null;
    this.movement = null;
    this.actions = null;
    this.r2 = null;
  }

  resetMachines() {
    this.tracker = new HandTracker({
      smoothingAlpha: 0.5,
      matchDistance: 0.3,
      maxLost: 8,
      sideMargin: 0.15,
      sideDwell: 10,
    });
    this.movement = new MovementStateMachine({
      leftMax: this.zones.left_max,
      rightMin: this.zones.right_min,
      upMax: this.zones.up_max,
      downMin: this.zones.down_min,
      hysteresis: this.zones.hysteresis,
    });
    this.actions = new ActionStateMachine({ stableFrames: 2, releaseCooldownMs: 90 });
    this.r2 = new R2TapStateMachine({ cooldownMs: 250, stableFrames: 2, holdMs: 120 });
    this.pressed.clear();
  }

  loop = (now) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const video = this.video;
    if (!video || video.readyState < 2) return;

    const due = now - this.lastInferenceAt >= this.minFrameMs;
    if (!due || video.currentTime === this.lastVideoTime) return;

    this.lastVideoTime = video.currentTime;
    this.lastInferenceAt = now;
    this.infer(now);
  };

  infer(now) {
    if (!this.landmarker) return;

    // MediaPipe requires strictly increasing timestamps.
    const timestamp = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, timestamp);
    } catch (error) {
      console.error("Hand detection failed.", error);
      return;
    }

    if (this.lastFrameAt > 0) {
      const instant = 1000 / Math.max(1, now - this.lastFrameAt);
      this.fps = this.fps === 0 ? instant : this.fps * 0.9 + instant * 0.1;
    }
    this.lastFrameAt = now;

    const dtMs = this.lastDt ? Math.min(now - this.lastDt, 100) : 0;
    this.lastDt = now;

    // Mirror in landmark space: the preview is flipped, and the desktop app
    // treats the user's left as the left half of the frame.
    const detections = (result.landmarks ?? []).map((landmarks) => {
      const center = palmCenter(landmarks);
      return { x: 1 - center.x, y: center.y, landmarks };
    });

    const hands = [];
    for (const track of this.tracker.update(detections)) {
      if (track.lost > 0) continue;
      hands.push({
        side: track.side,
        x: track.sx,
        y: track.sy,
        gesture: classifyGesture(track.landmarks),
        landmarks: track.landmarks,
      });
    }

    this.hands = hands;
    this.onHands(hands);
    this.route(hands, dtMs);
  }

  route(hands, dtMs) {
    this.actions.tick(dtMs);
    const events = this.r2.tick(dtMs);

    const left = hands.find((hand) => hand.side === "left");
    const right = hands.find((hand) => hand.side === "right");

    if (left) {
      events.push(...this.movement.update(left.x, left.y));
      events.push(...this.r2.update(left.gesture));
    } else {
      // A lost hand must not leave a direction held down.
      events.push(...this.movement.release());
      events.push(...this.r2.update(null));
    }

    events.push(...this.actions.update(right ? right.gesture : null));

    this.applyEvents(events);
  }
}
