// Gesture classification and input state machines.
//
// These are a 1:1 port of the Python implementation in
// src/gesture/*.py and src/inference/hand_tracker.py, with the same defaults.
// Keeping them identical means a gesture tuned on desktop behaves the same in
// the browser.

export const GESTURES = Object.freeze({
  PEACE: "peace",
  L_SHAPE: "l_shape",
  THUMBS_UP: "thumbs_up",
  THUMBS_DOWN: "thumbs_down",
  POINT: "point",
  PALM: "palm",
  FIST: "fist",
});

const FINGER_MCP = [5, 9, 13, 17];
const FINGER_TIP = [8, 12, 16, 20];
const THUMB_TIP = 4;
const INDEX_MCP = 5;

const isExtended = (lms, tip, mcp) => lms[tip].y < lms[mcp].y - 0.02;
const isCurled = (lms, tip, mcp) => lms[tip].y > lms[mcp].y + 0.01;

function isThumbExtended(lms) {
  const dx = lms[THUMB_TIP].x - lms[INDEX_MCP].x;
  const dy = lms[THUMB_TIP].y - lms[INDEX_MCP].y;
  return dx * dx + dy * dy > 0.0064;
}

function isPeace(lms) {
  return (
    isExtended(lms, 8, 5) &&
    isExtended(lms, 12, 9) &&
    isCurled(lms, 16, 13) &&
    isCurled(lms, 20, 17)
  );
}

function isLShape(lms) {
  return (
    isThumbExtended(lms) &&
    isExtended(lms, 8, 5) &&
    isCurled(lms, 12, 9) &&
    isCurled(lms, 16, 13) &&
    isCurled(lms, 20, 17)
  );
}

function isThumbsUp(lms) {
  return (
    isThumbExtended(lms) &&
    isCurled(lms, 8, 5) &&
    isCurled(lms, 12, 9) &&
    isCurled(lms, 16, 13) &&
    isCurled(lms, 20, 17) &&
    lms[THUMB_TIP].y < lms[INDEX_MCP].y
  );
}

function isThumbsDown(lms) {
  return (
    isThumbExtended(lms) &&
    isCurled(lms, 8, 5) &&
    isCurled(lms, 12, 9) &&
    isCurled(lms, 16, 13) &&
    isCurled(lms, 20, 17) &&
    lms[THUMB_TIP].y > lms[INDEX_MCP].y
  );
}

function isPoint(lms) {
  return (
    isExtended(lms, 8, 5) &&
    isCurled(lms, 12, 9) &&
    isCurled(lms, 16, 13) &&
    isCurled(lms, 20, 17)
  );
}

function isOpenPalm(lms) {
  let count = 0;
  for (let i = 0; i < FINGER_MCP.length; i += 1) {
    if (isExtended(lms, FINGER_TIP[i], FINGER_MCP[i])) count += 1;
  }
  return count >= 2;
}

export function classifyGesture(lms) {
  if (isPeace(lms)) return GESTURES.PEACE;
  if (isLShape(lms)) return GESTURES.L_SHAPE;
  if (isThumbsDown(lms)) return GESTURES.THUMBS_DOWN;
  if (isThumbsUp(lms)) return GESTURES.THUMBS_UP;
  if (isPoint(lms)) return GESTURES.POINT;
  if (isOpenPalm(lms)) return GESTURES.PALM;
  return GESTURES.FIST;
}

export function palmCenter(lms) {
  const indices = [0, 5, 9, 13, 17];
  let x = 0;
  let y = 0;
  for (const i of indices) {
    x += lms[i].x;
    y += lms[i].y;
  }
  return { x: x / indices.length, y: y / indices.length };
}

const HALF = 0.5;

class Track {
  constructor(id, x, y, alpha, landmarks) {
    this.id = id;
    this.side = x < HALF ? "left" : "right";
    this.sx = x;
    this.sy = y;
    this.alpha = alpha;
    this.lost = 0;
    this.landmarks = landmarks;
    this.pendingSide = null;
    this.pendingFrames = 0;
  }

  update(x, y, landmarks) {
    this.sx = this.alpha * x + (1 - this.alpha) * this.sx;
    this.sy = this.alpha * y + (1 - this.alpha) * this.sy;
    this.lost = 0;
    this.landmarks = landmarks;
  }

  refreshSide(margin, dwell) {
    const flipTo =
      this.side === "left"
        ? this.sx > HALF + margin
          ? "right"
          : null
        : this.sx < HALF - margin
          ? "left"
          : null;

    if (flipTo === null) {
      this.pendingSide = null;
      this.pendingFrames = 0;
      return;
    }
    if (this.pendingSide === flipTo) {
      this.pendingFrames += 1;
    } else {
      this.pendingSide = flipTo;
      this.pendingFrames = 1;
    }
    if (this.pendingFrames >= dwell) {
      this.side = flipTo;
      this.pendingSide = null;
      this.pendingFrames = 0;
    }
  }
}

export class HandTracker {
  constructor({
    smoothingAlpha = 0.5,
    maxTracks = 2,
    matchDistance = 0.3,
    maxLost = 8,
    sideMargin = 0.15,
    sideDwell = 10,
  } = {}) {
    this.alpha = smoothingAlpha;
    this.maxTracks = maxTracks;
    this.matchDistance = matchDistance;
    this.maxLost = maxLost;
    this.sideMargin = sideMargin;
    this.sideDwell = sideDwell;
    this.tracks = [];
    this.nextId = 0;
  }

  update(detections) {
    const used = new Set();

    for (const { x, y, landmarks } of detections) {
      let best = -1;
      let bestDistance = this.matchDistance;
      for (let i = 0; i < this.tracks.length; i += 1) {
        if (used.has(i)) continue;
        const t = this.tracks[i];
        const d = Math.hypot(t.sx - x, t.sy - y);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      if (best >= 0) {
        this.tracks[best].update(x, y, landmarks);
        used.add(best);
      } else if (this.tracks.length < this.maxTracks) {
        this.tracks.push(new Track(this.nextId, x, y, this.alpha, landmarks));
        this.nextId += 1;
        used.add(this.tracks.length - 1);
      }
    }

    this.tracks.forEach((t, i) => {
      if (!used.has(i)) t.lost += 1;
    });
    this.tracks = this.tracks.filter((t, i) => used.has(i) || t.lost < this.maxLost);

    for (const t of this.tracks) t.refreshSide(this.sideMargin, this.sideDwell);
    return this.tracks;
  }
}

export class MovementStateMachine {
  constructor({
    splitX = 0.5,
    upMax = 0.35,
    downMin = 0.65,
    hysteresis = 0.05,
  } = {}) {
    this.splitX = splitX;
    this.upMax = upMax;
    this.downMin = downMin;
    this.hysteresis = hysteresis;
    this.h = "neutral";
    this.v = "neutral";
  }

  update(x, y) {
    const events = [];
    // No neutral band: a hand on either side of the midline always steers,
    // and crossing it swaps the held direction in one update.
    const nextH = x < this.splitX ? "left" : "right";
    if (nextH !== this.h) {
      if (this.h !== "neutral") events.push({ action: `dpad_${this.h}`, press: false });
      events.push({ action: `dpad_${nextH}`, press: true });
      this.h = nextH;
    }

    let nextV = this.v;
    if (this.v === "up") {
      nextV = y >= this.upMax + this.hysteresis ? "neutral" : "up";
    } else if (this.v === "down") {
      nextV = y <= this.downMin - this.hysteresis ? "neutral" : "down";
    } else if (y < this.upMax) {
      nextV = "up";
    } else if (y > this.downMin) {
      nextV = "down";
    }
    if (nextV !== this.v) {
      if (this.v !== "neutral") events.push({ action: `dpad_${this.v}`, press: false });
      if (nextV !== "neutral") events.push({ action: `dpad_${nextV}`, press: true });
      this.v = nextV;
    }
    return events;
  }

  /** Drop any held direction, for when the hand leaves the frame. */
  release() {
    const events = [];
    if (this.h !== "neutral") {
      events.push({ action: `dpad_${this.h}`, press: false });
      this.h = "neutral";
    }
    if (this.v !== "neutral") {
      events.push({ action: `dpad_${this.v}`, press: false });
      this.v = "neutral";
    }
    return events;
  }
}

const GESTURE_TO_ACTION = {
  palm: "cross",
  peace: "triangle",
  l_shape: "square",
  thumbs_up: "circle",
  thumbs_down: "pause",
};

export class ActionStateMachine {
  constructor({ stableFrames = 2, releaseCooldownMs = 90 } = {}) {
    this.stableFrames = Math.max(1, stableFrames);
    this.releaseCooldownMs = releaseCooldownMs;
    this.state = "idle";
    this.cooldown = 0;
    this.pendingTarget = "idle";
    this.pendingCount = 0;
  }

  tick(dtMs) {
    this.cooldown = Math.max(0, this.cooldown - dtMs);
  }

  update(gesture) {
    const target = GESTURE_TO_ACTION[gesture] ?? "idle";
    const events = [];

    if (target !== this.pendingTarget) {
      this.pendingTarget = target;
      this.pendingCount = 1;
    } else {
      this.pendingCount += 1;
    }
    if (this.pendingCount < this.stableFrames) return events;

    if (target === this.state) return events;

    const needsPress = target !== "idle";
    if (needsPress && this.cooldown > 0) return events;

    if (this.state !== "idle") {
      events.push({ action: this.state, press: false });
      this.cooldown = this.releaseCooldownMs;
      this.state = "idle";
      if (target === "idle") return events;
      if (this.cooldown > 0) return events;
    }

    if (target !== "idle") events.push({ action: target, press: true });
    this.state = target;
    return events;
  }
}

export class R2TapStateMachine {
  constructor({ cooldownMs = 250, stableFrames = 2, holdMs = 120 } = {}) {
    this.cooldownMs = cooldownMs;
    this.stableFrames = Math.max(1, stableFrames);
    this.holdMs = holdMs;
    this.cooldown = 0;
    this.heldRemaining = 0;
    this.isHeld = false;
    this.pendingIsPoint = false;
    this.pendingCount = 0;
    this.armed = true;
  }

  tick(dtMs) {
    const events = [];
    this.cooldown = Math.max(0, this.cooldown - dtMs);
    if (this.isHeld) {
      this.heldRemaining -= dtMs;
      if (this.heldRemaining <= 0) {
        this.isHeld = false;
        this.heldRemaining = 0;
        events.push({ action: "r2", press: false });
      }
    }
    return events;
  }

  update(gesture) {
    const isPoint = gesture === GESTURES.POINT;
    if (isPoint !== this.pendingIsPoint) {
      this.pendingIsPoint = isPoint;
      this.pendingCount = 1;
    } else {
      this.pendingCount += 1;
    }
    if (this.pendingCount < this.stableFrames) return [];

    if (!this.pendingIsPoint) {
      this.armed = true;
      return [];
    }
    if (!this.armed || this.isHeld || this.cooldown > 0) return [];

    this.cooldown = this.cooldownMs;
    this.heldRemaining = this.holdMs;
    this.isHeld = true;
    this.armed = false;
    return [{ action: "r2", press: true }];
  }
}
