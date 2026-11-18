// Canvas overlay shared by the play page and the gesture sandbox.
//
// Kept free of state: callers pass the current frame's hands and the engine's
// fps, so the same drawing serves a 320×240 preview and a full-size stage.

import { ZONES } from "./config.js";

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const COLORS = {
  left: "#ff5a1f",
  right: "#34e0ff",
  zone: "rgba(246, 241, 227, 0.32)",
  hairline: "rgba(246, 241, 227, 0.14)",
  split: "#ffd21e",
  ink: "#0b0b0d",
  text: "#f6f1e3",
};

const FONT = "600 13px ui-sans-serif, system-ui, sans-serif";
const MONO = "600 13px ui-monospace, SFMono-Regular, Consolas, monospace";

// Lightweight wireframe view for the play page: hand skeletons only, no camera
// fill, zone grid, labels or HUD. Landmarks arrive with raw x; the engine
// mirrors palm x, so mirror landmarks the same way to keep both in agreement.
export function drawWireframe(ctx, hands, width, height) {
  ctx.clearRect(0, 0, width, height);
  for (const hand of hands) {
    const pts = hand.landmarks;
    if (!pts || pts.length < 21) continue;
    const px = (p) => (1 - p.x) * width;
    const py = (p) => p.y * height;
    ctx.strokeStyle = hand.side === "left" ? COLORS.left : COLORS.right;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [from, to] of HAND_CONNECTIONS) {
      ctx.moveTo(px(pts[from]), py(pts[from]));
      ctx.lineTo(px(pts[to]), py(pts[to]));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hand.x * width, hand.y * height, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawOverlay(ctx, options) {
  const {
    video = null,
    hands = [],
    fps = 0,
    running = false,
    zones = ZONES,
    labels = true,
    hud = true,
    offText = ["Camera is off", "Switch to gestures to turn it on"],
  } = options;

  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, width, height);

  if (!running || !video || video.readyState < 2) {
    ctx.fillStyle = "rgba(246, 241, 227, 0.62)";
    ctx.textAlign = "center";
    ctx.font = labels ? "600 18px ui-sans-serif, system-ui, sans-serif" : FONT;
    ctx.fillText(offText[0], width / 2, height / 2 - 8);
    if (offText[1] && labels) {
      ctx.font = "400 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(offText[1], width / 2, height / 2 + 20);
    }
    ctx.textAlign = "start";
    return;
  }

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  if (labels) drawZones(ctx, zones, width, height);
  for (const hand of hands) drawHand(ctx, hand, width, height, labels);
  if (hud) drawHud(ctx, fps, hands.length, width, height);
}

function drawZones(ctx, zones, width, height) {
  const x = (value) => value * width;
  const y = (value) => value * height;

  ctx.strokeStyle = COLORS.split;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(0.5), 0);
  ctx.lineTo(x(0.5), height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, y(zones.up_max));
  ctx.lineTo(x(0.5), y(zones.up_max));
  ctx.moveTo(0, y(zones.down_min));
  ctx.lineTo(x(0.5), y(zones.down_min));
  ctx.stroke();

  // Hysteresis exits, dotted like the desktop overlay.
  ctx.save();
  ctx.setLineDash([2, 8]);
  ctx.strokeStyle = COLORS.hairline;
  for (const value of [zones.up_max + zones.hysteresis, zones.down_min - zones.hysteresis]) {
    ctx.beginPath();
    ctx.moveTo(0, y(value));
    ctx.lineTo(x(0.5), y(value));
    ctx.stroke();
  }
  ctx.restore();

  label(ctx, "MOVE", 10, 22, COLORS.split);
  label(ctx, "ACTIONS", x(0.5) + 10, 22, COLORS.split);
  label(ctx, "L", 10, height - 14, COLORS.split);
  label(ctx, "R", x(0.5) + 10, height - 14, COLORS.split);
  label(ctx, "U", 8, y(zones.up_max) - 6, COLORS.split);
  label(ctx, "D", 8, y(zones.down_min) + 14, COLORS.split);
}

function label(ctx, text, x, y, color) {
  ctx.font = FONT;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(11, 11, 13, 0.78)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHand(ctx, hand, width, height, labels) {
  const color = hand.side === "left" ? COLORS.left : COLORS.right;
  const px = (point) => (1 - point.x) * width;
  const py = (point) => point.y * height;
  const points = hand.landmarks;

  ctx.strokeStyle = color;
  ctx.lineWidth = labels ? 3 : 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [from, to] of HAND_CONNECTIONS) {
    ctx.moveTo(px(points[from]), py(points[from]));
    ctx.lineTo(px(points[to]), py(points[to]));
  }
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(px(point), py(point), labels ? 2.5 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const palmX = hand.x * width;
  const palmY = hand.y * height;
  ctx.beginPath();
  ctx.arc(palmX, palmY, labels ? 12 : 7, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!labels) return;

  const text = `${hand.side.toUpperCase()} · ${hand.gesture.replace("_", " ")}`;
  ctx.font = FONT;
  const padding = 6;
  const textWidth = ctx.measureText(text).width;
  const boxX = Math.min(
    Math.max(palmX - textWidth / 2 - padding, 4),
    width - textWidth - padding * 2 - 4,
  );
  const boxY = Math.max(palmY - 40, 30);

  ctx.fillStyle = "rgba(11, 11, 13, 0.8)";
  ctx.fillRect(boxX, boxY - 16, textWidth + padding * 2, 22);
  ctx.fillStyle = color;
  ctx.fillText(text, boxX + padding, boxY);
}

function drawHud(ctx, fps, handCount, width, height) {
  const text = `${fps.toFixed(0)} fps · ${handCount} hand${handCount === 1 ? "" : "s"}`;
  ctx.font = MONO;
  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = "rgba(11, 11, 13, 0.66)";
  ctx.fillRect(width - textWidth - 22, height - 34, textWidth + 14, 24);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, width - textWidth - 15, height - 17);
}
