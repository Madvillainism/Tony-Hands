# Tony-Hands — Web Demo

A browser version of the hand tracker. It runs MediaPipe's **Hand Landmarker**
in WebAssembly, mirrors your camera, and shows the D-Pad directions and
PlayStation face buttons your gestures would produce.

This is a **demo of the input layer**, not a playable game yet: there is no
keyboard injection and no emulator. The point is to verify that detection,
tracking, and the state machines feel the same as the desktop app.

- No build step, no dependencies to install.
- All processing happens on your device; the video never leaves the browser.
- Same gesture thresholds and state machines as `src/`.

---

## Run it

The camera API only works in a **secure context**. `file://` will not work, so
serve the folder over localhost:

```powershell
# from the repository root
python -m http.server 8000 --directory web
```

Then open <http://localhost:8000>.

Any static server works:

```powershell
npx --yes serve web          # http://localhost:3000
# or the VS Code "Live Server" extension
```

Press **Start camera**, allow camera access, and show both hands.

> The MediaPipe WASM runtime (~3 MB) and the hand model (~7.5 MB) are fetched
> from Google's CDN on first load. After that the browser caches them.

---

## What it shows

| Area | Meaning |
|---|---|
| Left half | Movement zones for the left hand |
| Yellow vertical line | Left / right hand split |
| Solid grey lines | `left_max`, `right_min`, `up_max`, `down_min` |
| Dotted grey lines | Hysteresis exit thresholds |
| Orange skeleton | Hand tracked as **left** |
| Cyan skeleton | Hand tracked as **right** |
| Label above the palm | Tracked side + classified gesture |
| Chips in the panel | Inputs a desktop game would receive right now |
| `fps · hands` | Inference rate and number of tracked hands |

Gestures are identical to the desktop app:

| Gesture | Button |
|---|---|
| ✋ Open palm | Cross |
| 👍 Thumbs up | Circle |
| ✌️ Peace sign | Triangle |
| 🤘 L shape | Square |
| ✊ Fist | Release |
| ☝️ Point (left hand) | R2 tap |

Movement uses the palm centre: left/right/up/down zones with a hysteresis band,
and both axes can be active at once, so diagonals work.

---

## Files

```text
web/
├── index.html    # semantic page, canvas, start/stop control
├── styles.css    # dark theme, responsive layout, reduced-motion handling
├── main.js       # camera, MediaPipe, render loop, canvas overlay
└── gestures.js   # port of the Python classification + state machines
```

`gestures.js` mirrors the desktop implementation one-to-one:

| Python | JavaScript |
|---|---|
| `inference/mediapipe_hands.py` (`_classify_gesture`) | `classifyGesture()` |
| `inference/hand_tracker.py` | `HandTracker` |
| `gesture/movement.py` | `MovementStateMachine` |
| `gesture/actions.py` | `ActionStateMachine`, `R2TapStateMachine` |

When you tune `config.toml`, mirror the numbers in the `ZONES` object at the
top of `main.js` (or pass them into the state machines in `resetMachines()`).

---

## Differences from the desktop app

- **No key injection.** Chips light up instead of pressing keys, so you cannot
  accidentally type into other windows.
- **Losing a hand releases movement.** The desktop bridge leaves the last
  D-Pad direction held when the left hand disappears; the demo returns to
  neutral so a stuck chip cannot confuse you.
- **Mirroring happens in landmark space.** Detection runs on the raw camera
  frame, then palm X is flipped (`1 - x`) so the left half of the picture is
  your left hand. The video is drawn mirrored to match.
- **Cooldowns are driven by wall-clock milliseconds**, like `release_cooldown_ms`
  in the desktop config.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Camera access needs a secure context" | Use `http://localhost:8000`, not `file://` or a LAN IP over HTTP |
| Camera blocked | Allow the camera in the address bar / site settings, then reload |
| "Loading hand model…" never finishes | The CDN is blocked. Check DevTools → Network, or host the files locally (see below) |
| Choppy video | Close other tabs; the GPU delegate falls back to CPU automatically (console logs a warning) |
| Gestures misfire | Same advice as the desktop app: face your palm to the camera, use even lighting, exaggerate the shape |
| Nothing detected | Check for the green status dot and that `fps` is above 0 in the canvas corner |

### Hosting the model locally

To avoid the CDN entirely, download the model and the WASM bundle:

```powershell
Invoke-WebRequest `
  -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" `
  -OutFile "web/hand_landmarker.task"
```

Then change `MODEL_URL` in `main.js` to `"./hand_landmarker.task"`. For the WASM
files, copy `node_modules/@mediapipe/tasks-vision/wasm` after
`npm install @mediapipe/tasks-vision@0.10.14` and point `WASM_URL` at it.

---

## Browser support

Targets **Baseline 2024**: modern evergreen browsers with `getUserMedia`,
Canvas 2D, ES modules, and WebAssembly. No polyfills are included; the page
degrades to a clear error message when the camera or model is unavailable.

---

## Status

- [x] Browser demo: camera, tracking, zones, input readout
- [ ] Playable THPS in the browser (EmulatorJS)
- [ ] Browser-as-controller bridge (WebSocket to the desktop app)
- [ ] Deploy to GitHub Pages
