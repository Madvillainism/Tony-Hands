# Tony Hands — Setup & Architecture

## Requirements

- **OS:** Windows (uses Win32 API for window focus)
- **Python:** 3.11+
- **Webcam:** Any camera supported by OpenCV
- **RetroArch** with the **Beetle PSX** (`mednafen_psx_libretro`) core
- **ROM:** Tony Hawk's Pro Skater (PSX) `.cue` / `.bin`
- **Model:** MediaPipe Hand Landmarker (`hand_landmarker.task`)

---

## Quick start

```powershell
# 1. Clone
git clone https://github.com/Madvillainism/Tony-Hands.git
cd Tony-Hands

# 2. Install
pip install -e .

# 3. Download the hand landmarker model and place
#    hand_landmarker.task in the project root.

# 4. Edit config.toml with your RetroArch paths and ROM.

# 5. Run
.\run.ps1
```

---

## Configuration

Edit `config.toml`:

```toml
[camera]
source = 0          # webcam device index
width = 640         # lower = faster
height = 480

[inference]
min_detection_confidence = 0.7
min_tracking_confidence = 0.5

[display]
show_preview = true  # set false to hide preview window

[retroarch]
path = "C:\\RetroArch-Win64\\retroarch.exe"
core = "C:\\RetroArch-Win64\\cores\\mednafen_psx_libretro.dll"
rom = "C:\\RetroArch-Win64\\downloads\\Tony Hawk's Pro Skater (USA).cue"
```

### Lowering resolution

If you experience low FPS, reduce `width` and `height` (e.g., 320 × 240).
The pipeline also prints a warning when FPS drops below 20.

---

## RetroArch key bindings

Tony Hands presses keyboard keys that RetroArch maps to PSX controller buttons.
RetroArch must have the following bindings for **Player 1**:

### Required bindings

| Setting | Key | PSX button |
|---------|-----|------------|
| `input_player1_a` | `x` | Cross |
| `input_player1_b` | `z` | Circle |
| `input_player1_left` | `left` | D-Pad left |
| `input_player1_right` | `right` | D-Pad right |
| `input_player1_up` | `up` | D-Pad up |
| `input_player1_down` | `down` | D-Pad down |

### Default bindings (should already work)

| Setting | Key | PSX button |
|---------|-----|------------|
| `input_player1_x` (Square) | `s` | Square |
| `input_player1_y` (Triangle) | `a` | Triangle |

### VK code swap note

On this system the `Z` and `X` keys send swapped virtual-key codes:
`VK_Z (0x5A)` triggers Cross and `VK_X (0x58)` triggers Circle.
The `key_mapper.py` handles this by mapping action names directly to the
correct VK codes rather than relying on key labels:

```python
"cross":  KeyCode.from_vk(0x5A),   # physical Z key → Cross
"circle": KeyCode.from_vk(0x58),   # physical X key → Circle
"square": KeyCode.from_vk(0x53),   # VK_S (default RetroArch binding)
"triangle": KeyCode.from_vk(0x41), # VK_A (default RetroArch binding)
```

If your system does **not** have swapped keys, edit the VK values in
`key_mapper.py` to match your RetroArch config using Windows virtual-key
codes.

---

## Running

```powershell
# Full launch (RetroArch + pipeline)
.\run.ps1

# Pipeline only (RetroArch must already be running)
.\run.ps1 -NoRetroArch

# Headless (no preview window, lower CPU usage)
.\run.ps1 -NoPreview

# Manual launch
python -m src.main
```

Press **ESC** on the preview window to stop.

---

## Architecture

```
src/
├── main.py                    # Entry point — wires everything together
├── pipeline.py                # Main loop, overlay, RetroArch focus
├── bridge/
│   ├── input_bridge.py        # Routes gesture state → keyboard events
│   └── key_mapper.py          # Action name → pynput Key/KeyCode
├── capture/
│   └── webcam.py              # Background-thread webcam capture
├── gesture/
│   ├── movement.py            # MovementStateMachine (X + Y zones)
│   └── actions.py             # ActionStateMachine (gesture → button)
└── inference/
    └── mediapipe_hands.py     # MediaPipe HandLandmarker + gesture classification
```

### Data flow

```
Webcam ──→ InferenceWorker ──→ GestureState ──→ InputBridge ──→ pynput SendInput
  │                              │                  │
  │                              │                  └── MovementStateMachine
  │                              │                  └── ActionStateMachine
  │                              │
  └── cv2.imshow (overlay) ──────┘
```

1. **`WebcamThread`** captures frames on a background thread.
2. **`InferenceWorker.process()`** runs MediaPipe HandLandmarker and returns
   a `GestureState` containing wrist positions and classified gestures.
3. **`Pipeline.run()`** draws the overlay, then sends the state to `InputBridge`.
4. **`InputBridge.process()`** routes hands by X position:
   - Left half → `MovementStateMachine.update(x, y)` → D-Pad events.
   - Right half → `ActionStateMachine.update(gesture)` → action button events.
5. Events are dispatched via **`pynput.Controller.press()/release()`** which
   uses `SendInput` for reliable injection into RetroArch (SDL ignores
   `PostMessage` / `WM_KEYDOWN`).
6. **Focus** is maintained with `SwitchToThisWindow` every frame + 8 ms
   sleep before key injection.

### Gesture classification

`_classify_gesture()` in `mediapipe_hands.py` checks in priority order:

```
peace sign  →  L shape  →  open palm  →  fist
```

Each uses Y-coordinate comparison of finger tips vs. MCP joints:

| Check | Condition |
|-------|-----------|
| Extended | `tip.y < mcp.y - 0.02` |
| Curled | `tip.y > mcp.y + 0.01` |
| Thumb extended | `distance(thumb_tip, index_mcp) > 0.08` |

`ActionStateMachine` in `actions.py` maps gesture names to buttons and
handles press/release transitions (releases the previous button before
pressing the new one).

### Movement zones

`MovementStateMachine` in `movement.py` tracks X and Y independently:

| Axis | Left/Up zone | Neutral | Right/Down zone |
|------|-------------|---------|-----------------|
| X | `x < 0.18` (LEFT) | `0.18–0.32` | `x > 0.32` (RIGHT) |
| Y | `y < 0.25` (UP) | `0.25–0.75` | `y > 0.75` (DOWN) |

Both axes emit independent D-Pad events each frame, supporting diagonals.

---

## Adding a new gesture

1. Add a detection function in `mediapipe_hands.py` that returns `True`
   / `False` based on landmark positions.
2. Add it to `_classify_gesture()` with the right priority.
3. Add the gesture name → button mapping to `GESTURE_TO_ACTION` in
   `actions.py`.
4. If it needs a new key, add the key mapping to `RETROARCH_KEYS` in
   `key_mapper.py`.
5. Update `_draw_overlay()` in `pipeline.py` to show the new gesture label.
6. Update `docs/CONTROLS.md`.

---

## Troubleshooting

### "No module named 'src'"

Run from the project root directory, or use `python -m src.main` instead of
`python src/main.py`.

### Gesture not detected

- Verify the hand landmarker model is in the project root.
- Check lighting — MediaPipe needs good, even lighting on the palm.
- Increase `min_detection_confidence` in `config.toml` (up to 0.9).

### Keys not reaching RetroArch

- RetroArch must be the foreground window — look for the terminal log line
  `[Tony Hands] RetroArch window brought to foreground`.
- pynput `SendInput` is required — RetroArch uses SDL's Raw Input and does
  not respond to `PostMessage`.
- Check that `input_player1_*` bindings in RetroArch match the VK codes in
  `key_mapper.py`.

### Focus lost during play

The pipeline calls `SwitchToThisWindow` every frame. If another window
steals focus (e.g., a notification), it should be re-acquired within one
frame. Close the preview window (`-NoPreview`) to eliminate the one window
that competes for focus.

### Low FPS / high CPU

- Reduce camera resolution in `config.toml`.
- Disable the preview window with `-NoPreview`.
- Close other GPU-intensive applications.
