# Tony-Hands — Setup & Architecture

Technical reference for people who want to understand, modify, or extend the
tracker. For the user-facing tutorial, start with the [README](../README.md).

---

## Requirements

- **OS:** Windows 10/11 (the pipeline uses Win32 window APIs to keep RetroArch focused)
- **Python:** 3.11+
- **Webcam:** any camera OpenCV can open
- **RetroArch** with the **Beetle PSX** core (`mednafen_psx_libretro`)
- **PS1 disc image** of Tony Hawk's Pro Skater that you own
- **MediaPipe model:** `hand_landmarker.task` in the project root

### Model file

The model is not committed (see `.gitignore`). Download it once:

```powershell
Invoke-WebRequest `
  -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" `
  -OutFile "hand_landmarker.task"
```

### Install

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Dependencies: `opencv-python`, `mediapipe`, `pynput`, `numpy` (see `pyproject.toml`).

---

## Running

```powershell
# Full launch: RetroArch + tracker
.\run.ps1

# Custom paths
.\run.ps1 -RetroArch "D:\RetroArch\retroarch.exe" `
          -Core      "D:\RetroArch\cores\mednafen_psx_libretro.dll" `
          -Rom       "D:\Games\THPS.cue"

# Skip RetroArch, hide the preview, use another config
.\run.ps1 -NoRetroArch -NoPreview -Config .\my-config.toml

# Tracker only
python -m src.main --config .\my-config.toml
```

`run.ps1` only stops the RetroArch process it started. `src.main` args override
the TOML file:

| Flag | Effect |
|---|---|
| `--camera N` | Camera index |
| `--width N`, `--height N` | Capture resolution |
| `--no-preview` | Disable the preview window |
| `--config PATH` | Alternate config file |

---

## Configuration reference

`config.toml` is loaded with `tomllib`. Missing files fall back to defaults.
Unknown sections or keys produce a warning instead of being silently ignored.

### `[camera]`

| Key | Default | Meaning |
|---|---|---|
| `source` | `0` | OpenCV camera index |
| `width` | `640` | Requested capture width |
| `height` | `480` | Requested capture height |

### `[inference]`

| Key | Default | Meaning |
|---|---|---|
| `min_detection_confidence` | `0.7` | Palm detection threshold |
| `min_tracking_confidence` | `0.5` | Landmark tracking threshold |

Both feed MediaPipe's `min_hand_detection_confidence` and
`min_hand_presence_confidence`.

### `[display]`

| Key | Default | Meaning |
|---|---|---|
| `show_preview` | `true` | Open the OpenCV preview window |

### `[movement]`

| Key | Default | Meaning |
|---|---|---|
| `left_max` | `0.20` | Enter LEFT below this normalized X |
| `right_min` | `0.30` | Enter RIGHT above this normalized X |
| `up_max` | `0.25` | Enter UP above this normalized Y |
| `down_min` | `0.75` | Enter DOWN below this normalized Y |
| `hysteresis` | `0.05` | Extra distance required to leave a zone |
| `smoothing_alpha` | `0.5` | EMA weight for new samples (`1.0` = no smoothing) |

### `[actions]`

| Key | Default | Meaning |
|---|---|---|
| `stable_frames` | `2` | Consecutive frames a gesture must be stable |
| `release_cooldown_ms` | `90.0` | Block new presses after a release |
| `r2_stable_frames` | `2` | Consecutive frames a point must be stable |
| `r2_hold_ms` | `120.0` | R2 press duration (a tap, not a hold) |
| `r2_cooldown_ms` | `250.0` | Minimum time between R2 taps |
| `release_cooldown` | `3` | Legacy frame-based value; used only if `release_cooldown_ms` is absent |

### `[tracking]`

| Key | Default | Meaning |
|---|---|---|
| `match_distance` | `0.3` | Max palm-center distance to keep a track |
| `max_lost` | `8` | Frames a track survives without a detection |
| `side_margin` | `0.15` | Distance past the midline before a side can flip |
| `side_dwell` | `10` | Frames past the margin required to flip |

### `[retroarch]`

| Key | Meaning |
|---|---|
| `path` | `retroarch.exe` used by `run.ps1` |
| `core` | Core DLL |
| `rom` | Disc image |

`run.ps1` passes matching command-line flags, so these values are only read
when you edit the script defaults. The Python app does not launch RetroArch.

---

## Architecture

```text
src/
├── main.py                    # CLI, config loading, wiring
├── config.py                  # dataclass settings + TOML loader
├── pipeline.py                # main loop, overlay, focus, economy mode
├── bridge/
│   ├── input_bridge.py        # routes hands to state machines
│   └── key_mapper.py          # action name -> pynput Key/KeyCode
├── capture/
│   └── webcam.py              # background capture thread
├── gesture/
│   ├── movement.py            # D-Pad zones + hysteresis
│   └── actions.py             # face buttons + R2 tap
└── inference/
    ├── hand_tracker.py        # identity matching + sticky sides
    └── mediapipe_hands.py     # landmarker + gesture classification
```

### Data flow

```text
WebcamThread ──► InferenceWorker ──► GestureState ──► InputBridge ──► pynput
   (thread)         (MediaPipe)        (hands list)      (state machines)
       │                                   │
       └──────────► Pipeline overlay ◄─────┘
```

`GestureState.hands` is a list of `(palm_x, palm_y, gesture, side)` tuples,
plus the raw 21-point landmark lists for the overlay.

### Threads

- **Capture thread** — `cv2.VideoCapture` in a loop, guarded by a lock;
  `latest_frame` returns a copy. `CAP_PROP_BUFFERSIZE = 1` keeps latency low.
- **Main thread** — inference, overlay, state machines, key injection.

The loop targets 30 FPS and sleeps only when it finishes early.

---

## Hand tracking

`InferenceWorker.process()`:

1. Converts BGR → RGB and runs `HandLandmarker` in `IMAGE` mode.
2. Computes a palm center as the centroid of landmarks `[0, 5, 9, 13, 17]`.
3. Passes detections to `HandTracker.update()`.

`HandTracker` matches each detection to the nearest existing track (greedy,
`match_distance`). Unmatched tracks age; they are dropped after `max_lost`
frames. Matched tracks blend the new position into the old one with an EMA
(`smoothing_alpha`), which is what makes movement usable.

Each track also carries a **side** (`left`/`right`), assigned from its initial X
position and only changed after the palm stays past the midline by
`side_margin` for `side_dwell` consecutive frames. This "sticky side" is the
reason a right hand crossing the middle cannot hijack the D-Pad.

---

## Gesture classification

`_classify_gesture()` evaluates shapes in priority order:

```text
peace → L shape → thumbs up → point → open palm → fist
```

| Helper | Condition |
|---|---|
| Finger extended | `tip.y < mcp.y - 0.02` |
| Finger curled | `tip.y > mcp.y + 0.01` |
| Thumb extended | `distance(thumb_tip, index_mcp) > 0.08` |
| Open palm | 2+ of index/middle/ring/pinky extended |
| Peace | index + middle extended, ring + pinky curled |
| L shape | thumb + index extended, middle/ring/pinky curled |
| Thumbs up | thumb extended, all four fingers curled |
| Point | index extended, middle/ring/pinky curled (thumb ignored) |
| Fist | none of the above |

The checks are Y-relative, which is why the hand should face the camera. A hand
rotated sideways confuses "extended" and "curled".

Gesture names are mapped to buttons in `GESTURE_TO_ACTION` (`gesture/actions.py`):

```python
{"palm": CROSS, "peace": TRIANGLE, "l_shape": SQUARE, "thumbs_up": CIRCLE}
```

---

## Movement state machine

`MovementStateMachine` handles X and Y independently, so diagonals emit two
D-Pad presses. Each axis is a Schmitt trigger:

- Enter LEFT below `left_max`; leave LEFT only above `left_max + hysteresis`.
- Enter RIGHT above `right_min`; leave RIGHT only below `right_min - hysteresis`.
- Same pattern for UP/DOWN.

Every transition emits `(action, is_press)` tuples, which the bridge forwards to
`pynput`. Because axes are independent, `L+U` is a valid state.

---

## Action state machines

`ActionStateMachine` (face buttons):

1. Resolves the gesture to a target button (unknown → IDLE).
2. Requires `stable_frames` consecutive identical targets (kills flicker).
3. On a change, releases the held button, then sets `release_cooldown_ms`.
4. Presses the new button only if the cooldown has expired (same-button holds
   bypass this, so a held palm stays held).
5. Cooldown is time-based and ticked even when the hand disappears, so it never
   gets stuck.

`R2TapStateMachine` (left hand):

1. Requires `r2_stable_frames` of pointing.
2. Emits a press, then auto-releases after `r2_hold_ms` (a tap, not a hold).
3. Re-arms only after the point gesture ends, so pointing continuously does not
   repeat.
4. Blocks the next tap for `r2_cooldown_ms`.

The hold is deliberate: a press and release in the same frame is often missed by
RetroArch's SDL input handling.

---

## Key mapping

`src/bridge/key_mapper.py` targets RetroArch's stock keyboard layout:

| Action | Key | RetroPad |
|---|---|---|
| `cross` | `Z` (VK 0x5A) | B |
| `circle` | `X` (VK 0x58) | A |
| `triangle` | `S` (VK 0x53) | X |
| `square` | `A` (VK 0x41) | Y |
| `r2` | `E` (VK 0x45) | R2 |
| `dpad_*` | arrow keys | D-Pad |
| `start` / `select` | Enter / right Shift | Start / Select |
| `l1` / `r1` | `Q` / `W` | L1 / R1 |

Beetle PSX maps RetroPad B → Cross, A → Circle, Y → Square, X → Triangle, which
is why the table looks "crossed". If your RetroArch bindings differ, change
either the emulator or this table — nothing else needs to know.

---

## Input injection and focus

`pynput.Controller.press()/release()` uses Windows `SendInput`. RetroArch (SDL)
ignores `PostMessage`/`WM_KEYDOWN`, so real input events are required.

`pipeline.py` finds a visible top-level window whose title contains
`"RetroArch"` (case-insensitive) and raises it with `SwitchToThisWindow` **only
when it is not already in the foreground**. Previously this ran every frame and
included an unconditional 8 ms sleep, which wasted a quarter of the frame budget
and stole focus from other apps.

If no matching window exists, focus management is skipped silently, so the app
works for preview-only sessions.

---

## Performance

Budget: **33 ms/frame** (30 FPS). The overlay reports rolling averages:

```text
C: capture   I: inference   B: bridge/key injection   O: overlay   | total
```

Color coding: white ≤ 30 ms, amber ≤ 33 ms, red > 33 ms.

**Economy mode** activates when the average FPS stays below 20 for 2 seconds:
inference runs on a half-resolution copy of the frame and the overlay shows
`[ECO]`. It returns to full resolution after 3 seconds above the threshold.

If you are CPU-bound:

1. `--no-preview` (removes `cv2.imshow` and overlay drawing).
2. Lower capture resolution.
3. Reduce `model_complexity`-style work? Not exposed — the MediaPipe model is
   fixed; resolution is the main lever.

---

## Adding a gesture

1. Add a predicate in `inference/mediapipe_hands.py`.
2. Insert it into `_classify_gesture()` at the right priority.
3. Map the name to a button in `gesture/actions.py` (`GESTURE_TO_ACTION`).
4. Add the key in `bridge/key_mapper.py` if it is a new button.
5. Add an overlay label or icon in `pipeline._draw_overlay()`.
6. Update `docs/CONTROLS.md` and the README cheat-sheet.

## Adding a game

Today the keys are global. The planned approach is documented in
[docs/GAMES.md](GAMES.md):

```toml
[bindings]
cross = "z"
triangle = "s"

[target]
window_title = "RetroArch"
focus_mode = "auto"
```

Until that lands, either remap the emulator to `Z X A S` + arrows, or edit
`key_mapper.py`.

---

## Limitations

- Windows only: `ctypes.windll`, `EnumWindows`, `SwitchToThisWindow`.
- Keyboard-only output: no analog sticks, no virtual gamepad.
- One hand per half: two hands on the same side are not merged.
- No calibration wizard: thresholds are global and resolution-independent.
- The preview window competes for focus, because RetroArch is forced to the
  foreground.

---

## Troubleshooting

See the [README troubleshooting table](../README.md#troubleshooting). For
low-level diagnosis:

```powershell
# Run with only the tracker, no emulator
python -m src.main --no-preview

# List cameras (prints indices and resolutions)
python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"
```

Check the terminal for:

- `[Tony Hands] RetroArch window brought to foreground`
- `[WARN] Sustained <20 FPS — switching to economy mode`
- `Ignoring unknown option(s) in [section]` (config typo)
- `Config file not found` (wrong `--config` path)
