# Tony Hands

Gesture-controlled **Tony Hawk's Pro Skater** using MediaPipe hand tracking — play with your hands via webcam, no controller needed.

## How it works

The camera feed is split vertically into two halves. Your hand position and gesture on each side controls the game:

```
Left half (x < 0.5) — MOVEMENT           |  Right half (x >= 0.5) — ACTIONS
──────────────────────────────────────────┼─────────────────────────────────────
x < 0.18  → D-Pad LEFT                   |  Open palm  → Cross (ollie / jump)
0.18–0.32 → NEUTRAL (nothing pressed)    |  Fist       → Circle (trick / grab)
x > 0.32  → D-Pad RIGHT                  |
```

## Requirements

- Windows (uses Win32 API for window focus)
- Python 3.11+
- Webcam
- [RetroArch](https://retroarch.com) with Beetle PSX core
- Tony Hawk's Pro Skater (PSX) ROM
- MediaPipe hand landmarker model (`hand_landmarker.task`) — downloaded automatically or placed in the project root

## Setup

```powershell
# Clone
git clone https://github.com/Madvillainism/Tony-Hands.git
cd Tony-Hands

# Install dependencies
pip install -e .

# Download the MediaPipe hand landmarker model
# (place hand_landmarker.task in the project root)
```

## Configuration

Edit `config.toml`:

```toml
[camera]
source = 0          # webcam index
width = 640
height = 480

[retroarch]
path = "C:\\RetroArch-Win64\\retroarch.exe"
core = "C:\\RetroArch-Win64\\cores\\mednafen_psx_libretro.dll"
rom = "C:\\RetroArch-Win64\\downloads\\Tony Hawk's Pro Skater (USA).cue"
```

## RetroArch key bindings

RetroArch must use keyboard bindings for player 1:

| Setting | Value | Button |
|---------|-------|--------|
| `input_player1_a` | `"x"` | Cross (ollie) |
| `input_player1_b` | `"z"` | Circle (trick) |
| `input_player1_left` | `"left"` | D-Pad left |
| `input_player1_right` | `"right"` | D-Pad right |

> **Note**: The keyboard sends VK_Z for Cross and VK_X for Circle on this system (letter keys are remapped). Bindings are handled automatically by `key_mapper.py`.

## Running

```powershell
# Launch RetroArch + pipeline (default)
.\run.ps1

# Pipeline only (no RetroArch launch)
.\run.ps1 -NoRetroArch

# No preview window (keeps RetroArch focused)
.\run.ps1 -NoPreview

# Or manually:
python -m src.main
```

Press **ESC** on the preview window to quit.

## Project structure

```
tony-hands/
├── src/
│   ├── main.py                    # entry point
│   ├── pipeline.py                # main loop, overlay, window focus
│   ├── bridge/
│   │   ├── input_bridge.py        # routes hand data → key presses
│   │   └── key_mapper.py          # maps action names → pynput key objects
│   ├── capture/
│   │   └── webcam.py              # threaded webcam capture
│   ├── gesture/
│   │   ├── movement.py            # MovementStateMachine (3-zone left half)
│   │   └── actions.py             # ActionStateMachine (cross/circle by palm state)
│   └── inference/
│       └── mediapipe_hands.py     # MediaPipe HandLandmarker, palm detection
├── config.toml                    # user configuration
├── pyproject.toml                 # Python dependencies
└── run.ps1                        # launch script
```
