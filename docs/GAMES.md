# Playing Other Games

Tony-Hands produces one very simple thing: **keyboard events**. Whatever game or emulator receives them will react according to *its* key bindings. That makes the gesture layer game-agnostic, but it also means "support" depends on three separate things:

1. **Inputs available** — the tool can currently press: D-Pad (4 directions), Cross, Circle, Triangle, Square, R2, Start, Select, L1, R1.
2. **Key mapping** — which physical key is sent for each button (`src/bridge/key_mapper.py`).
3. **Window focus** — the pipeline looks for a window whose title contains `RetroArch` and raises it every frame.

Keep those three in mind when reading the table below.

---

## What works today

| Target | Works? | What you need to do |
|---|---|---|
| **Tony Hawk's Pro Skater 1/2 (PS1) in RetroArch** | ✅ | Nothing — this is the default setup |
| **Any other PS1 game in Beetle PSX** | ✅ | Just play; bindings are already correct |
| **SNES / NES / Mega Drive / GBA in RetroArch** | ✅ | In RetroArch, map Port 1 the same way (`Z X A S` + arrows) |
| **Nintendo 64 in RetroArch** | ⚠️ | Needs more buttons than we expose (Z trigger, C-buttons, analog stick) |
| **PCSX2 (PS2) standalone** | ⚠️ | Remap PCSX2's keyboard controls to `Z X A S` + arrows; focus logic will not find it |
| **PPSSPP standalone** | ⚠️ | Same as PCSX2: remap keys, expect no auto-focus |
| **Dolphin (GameCube/Wii)** | ⚠️ | Keyboard binds work, but most games need analog sticks |
| **Native PC games with keyboard controls** | ⚠️ | Usually works if you map the keys in-game, but focus stealing is hostile |
| **Racing / FPS / twin-stick games** | ❌ | Needs analog stick and mouse-look gestures |
| **macOS / Linux** | ❌ | `ctypes.windll.user32` is Windows-only |

### Quick recipe for another RetroArch core

1. Load the core and the game.
2. **Settings → Input → RetroPad Binds → Port 1 Controls**.
3. Bind RetroPad B/A/Y/X to `Z/X/A/S` and the D-Pad to the arrow keys.
4. Save the configuration (or a core remap).

That is it — the gestures now drive that core. Buttons the game does not use simply do nothing.

### Quick recipe for a standalone emulator (PCSX2, PPSSPP, Dolphin)

1. Open the emulator's keyboard/controller settings.
2. Bind its buttons to `Z`, `X`, `A`, `S`, `E` (R2) and the arrow keys.
3. Start RetroArch-less Tony-Hands with `python -m src.main`.
4. Click the emulator window **after** the tracker starts; the tracker only raises windows titled "RetroArch", so it will not steal focus from the emulator.

> This works, but it is fragile: if the emulator window is not focused, inputs go to whatever is focused.

### Web player

The browser player ([tony-hands.pages.dev](https://tony-hands.pages.dev)) plays
**THPS 1 and THPS 2 (the original PS1 games — not the 2020 remake)** through
EmulatorJS's `pcsx_rearmed` core. The **Select game** card switches between them;
inputs go straight to the emulator (no window focus needed). Locally, copy your
own disc images and BIOS into `web/games/` and open <http://localhost:8000>. The
Input card switches between gestures and the keyboard map above; on touch
devices an on-screen pad replaces the keyboard. Other disc-based systems would
need their own EmulatorJS core and local files; see
[web/README.md](../web/README.md).

---

## What is missing for "any game"

The current build is intentionally RetroArch/THPS-shaped. To make it a general gesture controller, four things are needed.

### 1. Config-driven key bindings

Right now `src/bridge/key_mapper.py` hard-codes the keys:

```python
RETROARCH_KEYS = {
    "dpad_left": Key.left,
    ...
    "cross": KeyCode.from_vk(0x5A),   # Z
}
```

Proposed shape:

```toml
[bindings]
dpad_left  = "left"
dpad_right = "right"
dpad_up    = "up"
dpad_down  = "down"
cross      = "z"
circle     = "x"
triangle   = "s"
square     = "a"
r2         = "e"
```

Then changing games is a config edit instead of a Python edit.

### 2. Configurable focus target

```toml
[target]
window_title = "RetroArch"   # substring match
focus_mode = "auto"          # auto | never
```

`focus_mode = "never"` makes the tool usable with native games and standalone emulators. It also removes the every-frame focus steal, which is the main reason the preview window is awkward today.

### 3. Game profiles

```toml
[profiles.thps]
bindings = { cross = "z", circle = "x", triangle = "s", square = "a" }

[profiles.mario]
bindings = { cross = "x", circle = "s", ... }
```

Run with `--profile thps`. Profiles are just overrides on top of the defaults.

### 4. A gamepad backend

Keyboard events are the lowest common denominator, but many games only accept a real controller. A future backend can create a **virtual Xbox controller** with [ViGEmBus](https://github.com/nefarius/ViGEmBus) / `vgamepad`, which supports:

- analog sticks (quantize hand position into a stick axis),
- analog triggers,
- proper button names for any PC game,
- no focus stealing.

This is the single biggest upgrade for non-emulator games.

### 5. More gestures

The gesture layer currently exposes:

- left hand: 2D position + point,
- right hand: palm / fist / thumbs-up / peace / L.

Candidates for future mapping:

| Gesture | Could map to |
|---|---|
| Fist held | Start / pause |
| Two-hand spread | L1 + R1 |
| Index + pinky (horns) | Select |
| Hand height in right half | Analog stick Y |
| Open palm distance from camera | Analog trigger |

Each new gesture is ~10 lines in `src/inference/mediapipe_hands.py` plus a mapping entry, but remember that more gestures means more false positives — the current set was chosen to be *reliable*, not exhaustive.

---

## Games that fit well today

These work with D-Pad + four face buttons + R2:

- **Tony Hawk's Pro Skater 1 / 2 / 3** (PS1) — the original target.
- **SSX** (PS2, with remapping) — tricks and steering.
- **Crazy Taxi** (PS2/Dreamcast) — arrows + a couple of buttons.
- **2D platformers** (SNES/GBA/PS1) — D-Pad + jump/action.
- **Puzzle games** — D-Pad + confirm/cancel.
- **Turn-based RPGs** — D-Pad + confirm.

Games that need more than the current inputs: anything with camera control, racing with analog steering, fighting games that need six buttons, and rhythm games with simultaneous chords.

---

## Roadmap

| Step | Status |
|---|---|
| Stock RetroArch support | ✅ Done |
| README + per-emulator recipes | ✅ Done |
| Config-driven `[bindings]` / `[target]` | ⏳ Next |
| `--profile` game presets | ⏳ Planned |
| Virtual gamepad (ViGEm) backend | ⏳ Planned |
| Browser input demo (`web/`) | ✅ Done |
| Playable browser version (EmulatorJS) | ⏳ Planned |
| macOS / Linux port | 💡 Idea (needs a non-Win32 focus backend) |

If you want a specific game supported, open an issue with the emulator, the control scheme, and which buttons it needs. The most useful contribution is a working key layout — the gesture side is usually already capable.
