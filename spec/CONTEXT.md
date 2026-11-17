# Project Context — Tony-Hands

## Goal

Play *Tony Hawk's Pro Skater* (PS1, RetroArch/Beetle PSX) with hand gestures
from a webcam. No controller, no hardware mods.

## Non-negotiables

1. **Latency budget:** 30 FPS target, 33 ms per frame. The overlay reports
   capture / inference / bridge / overlay timings.
2. **Deterministic mapping:** hand position and geometry only. No learned
   action classifier, no cloud calls, no network.
3. **Stability over speed:** a missed input is better than a wrong trick. Use
   stable-frame gates, hysteresis, and cooldowns.
4. **Tunable by feel:** thresholds live in `config.toml`.
5. **Minimal stack:** OpenCV, MediaPipe, pynput, numpy. Windows-only for now.

## Current input model

- **Left hand** (left half): palm-center X/Y → D-Pad zones with hysteresis.
  Index-only point → R2 tap (120 ms hold, 250 ms cooldown).
- **Right hand** (right half): palm → Cross, thumbs up → Circle,
  peace → Triangle, L shape → Square, fist → release.
- Hands keep a sticky `left`/`right` identity; crossing the midline does not
  swap roles until the hand stays past `side_margin` for `side_dwell` frames.

## Known constraints

- Keyboard output only (no virtual gamepad yet).
- Window focus is forced to a window titled "RetroArch".
- `hand_landmarker.task` is downloaded, not committed.
- No automated tests yet; changes to state machines need careful manual review.

## Next milestones

1. Config-driven `[bindings]` and `[target]` (other games/emulators).
2. `--profile` presets per game.
3. Playable browser version: the MediaPipe WASM input demo in `web/` is done;
   next is EmulatorJS or a WebSocket controller bridge.
4. Optional ViGEm virtual gamepad backend.
