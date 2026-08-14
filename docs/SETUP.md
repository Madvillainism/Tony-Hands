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

[movement]
left_max = 0.20           # NEUTRAL→LEFT threshold (X)
right_min = 0.30          # NEUTRAL→RIGHT threshold (X)
up_max = 0.25             # NEUTRAL→UP threshold (Y)
down_min = 0.75           # NEUTRAL→DOWN threshold (Y)
smoothing_alpha = 0.5     # EMA smoothing on palm center (1 = none, 0 = maximum smoothing)

[actions]
release_cooldown = 3      # frames to ignore new presses after a release (anti-flicker)

[tracking]
match_distance = 0.3      # max distance (normalized) to match a hand to its track
max_lost = 8              # frames a track survives after the hand disappears
side_margin = 0.15        # how far past the midline before a side can flip
side_dwell = 10           # consecutive frames past the margin required to flip side

[retroarch]
path = "C:\\RetroArch-Win64\\retroarch.exe"
core = "C:\\RetroArch-Win64\\cores\\mednafen_psx_libretro.dll"
rom = "C:\\RetroArch-Win64\\downloads\\Tony Hawk's Pro Skater (USA).cue"
```

CLI flags override config values: `--camera`, `--width`, `--height`, and
`--no-preview` take precedence over the TOML file.

## Performance management

The pipeline self-tunes to stay within the 33ms/frame latency budget:

- **Stage timings** — the overlay shows per-stage millisecond averages for
  capture (`C:`), inference (`I:`), bridge/key injection (`B:`), overlay
  (`O:`) plus the loop total and the action-state transition time
  (`act:`). The total is color-coded against the 33ms budget.
- **Economy mode** — if FPS stays below 20 for 2 consecutive seconds, the
  pipeline automatically drops to half-resolution inference (marked `[ECO]`
  on the overlay) and restores full resolution 3 seconds after recovery.

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
├── main.py                    # Entry point — loads config, wires everything
├── config.py                  # Settings loader (tomllib) + CLI overrides
├── pipeline.py                # Main loop, overlay, RetroArch focus, economy mode
├── bridge/
│   ├── input_bridge.py        # Routes gesture state → keyboard events
│   └── key_mapper.py          # Action name → pynput Key/KeyCode
├── capture/
│   └── webcam.py              # Background-thread webcam capture
├── gesture/
│   ├── movement.py            # MovementStateMachine (X + Y zones)
│   └── actions.py             # ActionStateMachine (gesture → button)
├── inference/
│   ├── hand_tracker.py        # Identity tracking + sticky side assignment
│   └── mediapipe_hands.py     # MediaPipe HandLandmarker + palm center + EMA + gestures
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
   a `GestureState` containing smoothed palm-center positions (centroid of
   landmarks `[0, 5, 9, 13, 17]`), the full 21-point landmark lists, and
   classified gestures. **`HandTracker`** matches hands across frames by
   palm-center distance so each hand keeps a stable identity (no order-flip
   jitter), and assigns each a **sticky side** (`left`/`right`) that only
   changes after a sustained crossing of the midline (`side_margin` /
   `side_dwell` in `config.toml`). Palm positions are smoothed with an
   exponential moving average (`smoothing_alpha`).
3. **`Pipeline.run()`** draws the overlay, then sends the state to `InputBridge`.
4. **`InputBridge.process()`** routes hands by their **tracked side**, not
   instantaneous X position — so a right hand crossing the midline can never
   take over the D-Pad:
   - Left-side hand → `MovementStateMachine.update(x, y)` → D-Pad events.
   - Right-side hand → `ActionStateMachine.update(gesture)` → action button events.
5. Events are dispatched via **`pynput.Controller.press()/release()`** which
   uses `SendInput` for reliable injection into RetroArch (SDL ignores
   `PostMessage` / `WM_KEYDOWN`).
6. **Focus** is maintained with `SwitchToThisWindow` every frame + 8 ms
   sleep before key injection.

### Gesture classification

`_classify_gesture()` in `mediapipe_hands.py` checks in priority order:

```
peace sign  →  L shape  →  thumbs up  →  open palm  →  fist
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

`MovementStateMachine` in `movement.py` tracks X and Y independently.
Thresholds are read from `config.toml` `[movement]` (defaults shown):

| Axis | Left/Up zone | Neutral | Right/Down zone |
|------|-------------|---------|-----------------|
| X | `x < 0.20` (LEFT) | `0.20–0.30` | `x > 0.30` (RIGHT) |
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
- The pipeline automatically enters *economy mode* (half-res inference) when
  FPS stays below 20 for 2 seconds — watch the overlay for the `[ECO]` flag.
