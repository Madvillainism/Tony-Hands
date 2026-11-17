# 🛹 Tony-Hands

**Play Tony Hawk's Pro Skater with your hands.** A webcam, two hands, no controller.

Tony-Hands watches your hands with [MediaPipe](https://github.com/google-ai-edge/mediapipe) and turns them into keyboard input for [RetroArch](https://www.retroarch.com/) running **Tony Hawk's Pro Skater** (PlayStation 1). Your left hand steers, your right hand does tricks.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-00C7B7?style=for-the-badge&logo=google&logoColor=white)](https://github.com/google-ai-edge/mediapipe)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![RetroArch](https://img.shields.io/badge/RetroArch-PS1-E01E3C?style=for-the-badge&logo=retroarch&logoColor=white)](https://www.retroarch.com/)

> **Platform:** Windows 10/11 · **Latency target:** 30 FPS (33 ms/frame) · **Camera:** any webcam

---

## Table of contents

1. [What it looks like](#what-it-looks-like)
2. [What you need](#what-you-need)
3. [Install (5 minutes)](#install-5-minutes)
4. [First run: test without the game](#first-run-test-without-the-game)
5. [Set up RetroArch](#set-up-retroarch)
6. [Play](#play)
7. [Controller cheat-sheet](#controller-cheat-sheet)
8. [Tuning it to your hands](#tuning-it-to-your-hands)
9. [Troubleshooting](#troubleshooting)
10. [Playing other games](#playing-other-games)
11. [How it works](#how-it-works)
12. [Web version](#web-version)
13. [Project layout](#project-layout)
14. [Credits](#credits)

---

## What it looks like

The camera image is split in half. The preview window shows your hands, the zones, and a live FPS/perf readout:

```text
┌──────────────────────────────┬──────────────────────────────┐
│  LEFT HALF — MOVEMENT        │  RIGHT HALF — TRICKS         │
│                              │                              │
│      U  │  ▲                 │   ✋ open palm  → Cross       │
│   L ─────┼───── R            │   👍 thumbs up  → Circle      │
│      D  │  ▼                 │   ✌️ peace      → Triangle    │
│                              │   🤘 L shape    → Square      │
│  Move your left hand around  │   ✊ fist       → release      │
│  ☝️ point = R2 tap (180s)     │                              │
└──────────────────────────────┴──────────────────────────────┘
```

No game footage is required to try it: run the app, wave at the camera, and watch the preview.

---

## What you need

| Requirement | Notes |
|---|---|
| **Windows 10 or 11** | Window focus uses the Win32 API; macOS/Linux are not supported yet |
| **Python 3.11** | 3.11 is the safest choice; newer versions may not have MediaPipe wheels yet |
| **Webcam** | Built-in laptop cameras are fine |
| **RetroArch** | Free and open source: <https://www.retroarch.com/> |
| **Beetle PSX core** | Install from RetroArch: *Main Menu → Online Updater → Core Downloader → Sony - PlayStation (Beetle PSX)* |
| **PS1 BIOS** | e.g. `scph5501.bin` (US) in RetroArch's `system/` folder |
| **Tony Hawk's Pro Skater (PS1)** | A `.cue`/`.bin` or `.chd` image **you legally own**. This repo ships no game data. |
| **A second screen or windowed emulator** | Recommended while learning; the preview steals focus otherwise (see [Play](#play)) |

---

## Install (5 minutes)

Open **PowerShell** in the folder where you keep projects.

### 1. Clone the repo

```powershell
git clone https://github.com/Madvillainism/Tony-Hands.git
cd Tony-Hands
```

### 2. Create a virtual environment

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks the activation script, run this once in the same window:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 3. Install the Python dependencies

```powershell
python -m pip install --upgrade pip
pip install -e .
```

### 4. Download the hand model

The 7.5 MB MediaPipe model is **not stored in git** (it is in `.gitignore`). Download it into the project root:

```powershell
Invoke-WebRequest `
  -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" `
  -OutFile "hand_landmarker.task"
```

You should now have `hand_landmarker.task` next to `README.md`.

### 5. Point the launcher at your RetroArch install

Edit `run.ps1`, or pass the paths on the command line (see [Play](#play)). The defaults look like this:

```powershell
# run.ps1
$RetroArch = "C:\RetroArch-Win64\retroarch.exe"
$Core      = "C:\RetroArch-Win64\cores\mednafen_psx_libretro.dll"
$Rom       = "C:\RetroArch-Win64\downloads\Tony Hawk's Pro Skater (USA).cue"
```

---

## First run: test without the game

You do **not** need RetroArch to check that the camera and gestures work.

```powershell
python -m src.main
```

What you should see:

- A window called **Tony Hands — Preview** with your camera image (mirrored, like a selfie).
- A yellow vertical line splitting "MOVE" and "ACTIONS".
- A skeleton and a label on each detected hand.
- `FPS`, per-stage timings, and `[ECO]` if the machine is struggling.

Try this:

1. Move your **left hand** to the left/right/top/bottom of the left half and watch the `D-PAD (...)` label.
2. Show the **right hand** as an open palm, thumbs-up, peace sign, and L shape. The matching PlayStation icon appears.
3. Make a fist — the button releases.
4. Point with the left hand — `R2 TAP` flashes.

Press **ESC** in the preview window or **Ctrl+C** in the terminal to quit.

> The app tries to focus a window containing "RetroArch". If RetroArch is not running this is silently skipped, so the preview test works on its own.

---

## Set up RetroArch

Tony-Hands does not talk to the emulator directly: it **presses keyboard keys**, and RetroArch maps those keys to PlayStation buttons. The bindings must match.

In RetroArch:

1. **Settings → Input → RetroPad Binds → Port 1 Controls**
2. Set these bindings (press the key when prompted):

| RetroArch control | PlayStation button | Key to bind |
|---|---|---|
| **B** | ✕ Cross | `Z` |
| **A** | ○ Circle | `X` |
| **Y** | □ Square | `A` |
| **X** | △ Triangle | `S` |
| **R2** | R2 | `E` |
| D-Pad Up / Down / Left / Right | D-Pad | arrow keys |
| Start | Start | `Enter` |
| Select | Select | right `Shift` |

3. Go back and choose **Save Configuration** (or **Save Core Remap File** if you only want this for PS1 games).

> **Why these keys?** They are RetroArch's default keyboard layout, and they match `src/bridge/key_mapper.py`. If your keyboard layout or config differs, change either the RetroArch binding or the mapping in that file — they just have to agree.

### Verify before playing

A 10-second sanity check:

1. Launch THPS in RetroArch.
2. Press `Z` on your keyboard: the skater should crouch and ollie on release.
3. Press `X`: grab. `A`: grind/manual. `S`: the remaining face button.
4. Press the arrow keys: the skater turns.

If a keyboard key does not do what you expect, fix the RetroArch binding first — gesture detection is not the problem at that point.

---

## Play

The easy way (starts RetroArch with the configured core, ROM, and state slot, then the hand tracker):

```powershell
.\run.ps1
```

Useful options:

```powershell
.\run.ps1 -StateSlot 1       # load a different save state (default: 2)
.\run.ps1 -NoPreview         # hide the camera window (best performance / focus)
.\run.ps1 -NoRetroArch       # only start the tracker; launch RetroArch yourself
```

If your paths are different, either edit the three variables at the top of `run.ps1` or run:

```powershell
.\run.ps1 -RetroArch "D:\RetroArch\retroarch.exe" `
          -Core      "D:\RetroArch\cores\mednafen_psx_libretro.dll" `
          -Rom       "D:\Games\THPS (USA).cue"
```

The manual way:

```powershell
python -m src.main
```

CLI flags override `config.toml`:

| Flag | Meaning |
|---|---|
| `--camera 1` | Use the second webcam (default `0`) |
| `--width 1280 --height 720` | Capture resolution |
| `--no-preview` | No camera window |
| `--config my-config.toml` | Use a different config file |

### Two-monitor setup (recommended)

The tracker keeps RetroArch in the foreground every frame. That makes it hard to watch the preview window at the same time. Options:

- Put RetroArch on one monitor and run with `--no-preview`; use the terminal log for confirmation.
- Or keep the preview on a second monitor — it will still update, but clicking it during play will pull focus away for a frame.

---

## Controller cheat-sheet

### Left hand — movement (left half of the camera)

Your **palm center** position decides the direction. Both axes work at once, so diagonals are supported.

| Where your left hand is | D-Pad |
|---|---|
| Left of the neutral band (`x < 0.20`) | ← held |
| Right of the neutral band (`x > 0.30`) | → held |
| Top (`y < 0.25`) | ↑ held |
| Bottom (`y > 0.75`) | ↓ held |
| Anywhere in the middle | nothing pressed |

**Point with your index finger** (other fingers curled) to tap **R2** — useful for 180° spins in the air. It is a tap, not a hold: it presses for 120 ms and re-arms when you stop pointing.

### Right hand — tricks (right half of the camera)

| Gesture | How to make it | Button | In THPS |
|---|---|---|---|
| ✋ **Open palm** | Any open hand, 2+ fingers up | **Cross** | Hold to crouch, release to ollie |
| 👍 **Thumbs up** | Thumb out, all four fingers curled | **Circle** | Grab |
| ✌️ **Peace sign** | Index + middle up, ring + pinky curled | **Triangle** | Special / menu |
| 🤘 **L shape** | Thumb + index out, other fingers curled | **Square** | Grind / manual |
| ✊ **Fist** | All fingers curled | — | Releases the held button |

The detector checks gestures in this priority order, so a shape is never ambiguous:

```text
peace  →  L shape  →  thumbs up  →  point  →  open palm  →  fist
```

### The Ollie rhythm

THPS charges a jump while Cross is **held** and ollies when you **release** it. In practice:

1. Open your right hand → Cross is held → the skater crouches and builds speed.
2. Close your hand into a fist → Cross is released → **ollie**.
3. Open again to crouch, close to ollie again.

### Things that confuse the detector

- Hand edge-on to the camera (fingers hidden).
- Very dim or backlit rooms.
- Fast sideways swipes (the smoothing lags by a frame or two).
- Holding your hand exactly on a zone boundary.

Keep your palm facing the camera, about **30–50 cm** away, and move decisively.

---

## Tuning it to your hands

Everything lives in `config.toml`. Changes apply the next time you start the app.

```toml
[camera]
source = 0              # webcam index: 0 = first camera, 1 = second, ...
width = 640             # lower = faster
height = 480

[inference]
min_detection_confidence = 0.7   # higher = fewer false hands, but may miss yours
min_tracking_confidence = 0.5

[display]
show_preview = true     # false = no camera window

[movement]
left_max = 0.20         # cross below this X to steer left
right_min = 0.30        # cross above this X to steer right
up_max = 0.25           # above this Y to push up
down_min = 0.75         # below this Y to push down
hysteresis = 0.05       # extra distance needed to leave a zone (stops flicker)
smoothing_alpha = 0.5   # 1.0 = raw and twitchy, 0.2 = smooth but laggy

[actions]
release_cooldown_ms = 90.0   # ignore new presses for 90 ms after a release
stable_frames = 2            # gesture must repeat this many frames before firing

[tracking]
match_distance = 0.3    # how far a hand can move between frames and keep its identity
max_lost = 8            # frames a hand survives after leaving the camera
side_margin = 0.15      # how far past the midline before left/right can swap
side_dwell = 10         # frames it must stay there before swapping

[retroarch]             # used by run.ps1 (paths can also be passed as flags)
path = "C:\\RetroArch-Win64\\retroarch.exe"
core = "C:\\RetroArch-Win64\\cores\\mednafen_psx_libretro.dll"
rom  = "C:\\RetroArch-Win64\\downloads\\Tony Hawk's Pro Skater (USA).cue"
```

`release_cooldown = 3` is still accepted for backwards compatibility, but `release_cooldown_ms` is the one that matters.

### Symptom → setting

| Symptom | What to change |
|---|---|
| The skater turns while my hand looks still | Widen the neutral band: `left_max = 0.15`, `right_min = 0.35` |
| I have to move my hand too far to turn | Narrow the neutral band: `left_max = 0.25`, `right_min = 0.25` |
| Direction flickers at the edge | Increase `hysteresis` to `0.08` |
| Movement feels laggy | Raise `smoothing_alpha` (e.g. `0.75`) |
| Movement jitters | Lower `smoothing_alpha` (e.g. `0.3`) |
| Two buttons fire from one gesture | Increase `stable_frames` to `3` or `release_cooldown_ms` to `150` |
| A gesture is hard to trigger | Make the shape bigger and clearer; lower `min_detection_confidence` to `0.6` |
| False buttons when no hand is doing anything | Raise `min_detection_confidence` to `0.8` |
| R2 fires too often while steering | Increase `r2_cooldown_ms` (e.g. `400`) or `r2_stable_frames` |
| The hands swap roles when they cross | Increase `side_margin` / `side_dwell` |
| Low FPS (red number in the preview) | `--no-preview`, lower `width`/`height`, close other apps |

The pipeline also self-tunes: if FPS stays below 20 for 2 seconds it switches to half-resolution inference (`[ECO]` in the preview) and returns to full quality after 3 seconds of recovery.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Could not open webcam source 0` | Another app is using the camera, or the index is wrong. Try `--camera 1`. |
| `hand_landmarker.task` not found / crash on start | Re-run step 4 of [Install](#install-5-minutes). It must be in the project root. |
| `No module named 'src'` | Run from the project root with `python -m src.main`. |
| Preview shows hands, game does nothing | RetroArch is not focused, or the key bindings do not match. Look for `[Tony Hands] RetroArch window brought to foreground` in the terminal. |
| No such log line | RetroArch's window title does not contain "RetroArch", or the app cannot raise it. Run RetroArch in windowed mode and try again. |
| Everything is mirrored | That is intentional: the image is flipped so moving your hand right moves it right on screen. |
| Only one button ever works | Check the RetroArch Port 1 bindings (especially Cross = `Z`) and `src/bridge/key_mapper.py`. |
| Peace and Square are swapped | Your RetroArch layout differs. Swap the `triangle`/`square` entries in `src/bridge/key_mapper.py`. |
| Preview stutters, game is fine | Lower the camera resolution or run with `--no-preview`. |
| The tool steals focus from another window | Close the app (`Ctrl+C`) when you are not playing, or stop RetroArch first. |
| `[ECO]` never goes away | The machine cannot sustain 30 FPS; close background apps or lower resolution. |

Logs go to the terminal. There is no hidden state or recording — the camera feed stays in memory.

---

## Playing other games

The controller model is generic: **D-Pad + four face buttons + R2**. That means it already works for a lot more than THPS.

| Setup | Status |
|---|---|
| Other PS1 games in RetroArch (Beetle PSX) | ✅ Works now |
| SNES / NES / N64 / GBA games in RetroArch | ✅ After mapping the same keys in Port 1 |
| PCSX2, PPSSPP, Dolphin (keyboard input) | ⚠️ Remap their keys to `Z X A S` + arrows; focus code only looks for "RetroArch" |
| Native PC games with keyboard controls | ⚠️ Possible, but the focus logic and hard-coded keys need changing |
| Games that need analog sticks, L1/L2, Start | ❌ No gestures bound yet |
| macOS / Linux | ❌ Windows-only window handling |

See **[docs/GAMES.md](docs/GAMES.md)** for per-emulator instructions, limitations, and the plan for config-driven bindings and gamepad output.

---

## How it works

```text
webcam ──► MediaPipe HandLandmarker ──► hand tracker ──► gesture + position
                                                              │
                                        ┌─────────────────────┴──────────────────┐
                                        ▼                                        ▼
                              left half: D-Pad zones                 right half: face buttons
                                        │                                        │
                                        └──────────────► pynput key events ◄──────┘
                                                              │
                                                        RetroArch
```

1. A background thread grabs camera frames.
2. MediaPipe finds 21 landmarks per hand.
3. A tracker keeps each hand's identity and side stable across frames (so jitter or a hand crossing the middle cannot swap roles).
4. Palm position → D-Pad zones; palm gesture → a face button.
5. State machines debounce gestures and add cooldowns so one gesture produces one press.
6. `pynput` injects real key events (RetroArch ignores simulated window messages).

Details, latency budget, and the module map are in **[docs/SETUP.md](docs/SETUP.md)**.

---

## Web version

There is a runnable browser demo in **`web/`**. It runs MediaPipe's hand
landmarker in WASM, draws the same zones as the desktop overlay, and lights up
the inputs a game would receive. No install, no Python.

```powershell
# from the repository root
python -m http.server 8000 --directory web
```

Open <http://localhost:8000>, press **Start camera**, and allow camera access.
The first load downloads the MediaPipe runtime and the ~7.5 MB hand model.

The camera API requires a secure context, so `localhost` or HTTPS is mandatory —
opening `index.html` from disk will not work.

The demo is intentionally **input-only**: it does not press keys and does not
run a game. It exists to check gestures and tuning before wiring a game in.
The gesture classifier and state machines in `web/gestures.js` are a direct port
of `src/`, with the same thresholds.

| Status | Feature |
|---|---|
| ✅ Done | Browser camera + MediaPipe WASM + zone overlay + input readout |
| 🚧 Next | Play THPS in the browser (EmulatorJS) |
| 💡 Idea | Browser as a wireless controller for desktop RetroArch (WebSocket bridge) |

Full details and troubleshooting: **[web/README.md](web/README.md)**.

The web work follows Google Chrome's [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)
and targets **Baseline 2024**.

---

## Project layout

```text
tony-hands/
├── config.toml               # all tunables
├── run.ps1                   # one-command launcher (RetroArch + tracker)
├── hand_landmarker.task      # downloaded model (not in git)
├── ps-buttons.jpg            # PlayStation button icons for the overlay
├── web/                      # browser demo (MediaPipe WASM + canvas)
├── src/
│   ├── main.py               # entry point, CLI flags
│   ├── config.py             # TOML loader
│   ├── pipeline.py           # main loop, overlay, focus, economy mode
│   ├── capture/webcam.py     # threaded camera capture
│   ├── inference/
│   │   ├── mediapipe_hands.py  # landmarker + gesture classification
│   │   └── hand_tracker.py     # identity + sticky left/right sides
│   ├── gesture/
│   │   ├── movement.py       # D-Pad zones + hysteresis
│   │   └── actions.py        # face buttons + R2 tap state machines
│   └── bridge/
│       ├── input_bridge.py   # routes hands to state machines
│       └── key_mapper.py     # action → keyboard key
├── docs/
│   ├── CONTROLS.md           # printable one-page controls
│   ├── SETUP.md              # architecture and internals
│   └── GAMES.md              # other games and future input backends
└── spec/                     # design notes and feature specs
```

---

## Credits

- [MediaPipe](https://github.com/google-ai-edge/mediapipe) by Google for hand tracking.
- [RetroArch](https://www.retroarch.com/) and the Beetle PSX core.
- [pynput](https://github.com/moses-palmer/pynput) for keyboard injection.
- Tony Hawk's Pro Skater is a trademark of Activision. This project ships no game assets; bring your own copy.

---

**Have fun, and remember: knees bent, arms out, commit to the landing. 🛹**
