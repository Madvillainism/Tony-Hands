# Agent Roles — Tony Hands

## Vision-Core-Agent
**Responsibility:** OpenCV & MediaPipe pipeline ownership.
- Manages WebcamThread lifecycle (start, frame polling, graceful stop).
- Runs MediaPipe HandLandmarker inference on each frame.
- Extracts normalized (x, y) coordinates for landmarks of interest.
- Computes palm center (centroid of landmarks [0, 5, 9, 13, 17]).
- Tracks hands across frames by identity (`HandTracker`), assigning a sticky
  `left`/`right` side that only flips after a sustained midline crossing.
- Classifies gestures (peace, l_shape, thumbs_up, point, palm, fist).
- Benchmarks FPS and enforces the 33 ms latency budget; enables economy mode
  (half-resolution inference) below 20 FPS.
- Draws the preview overlay (zones, skeleton, labels, PS button icons).

**Input:** Raw webcam frames (BGR, 640×480 by default).
**Output:** `GestureState` — a list of `(palm_x, palm_y, gesture, side)` tuples
plus landmark lists, passed to InputBridge.

## Input-Bridge-Agent
**Responsibility:** precise keypress event emission with pynput.
- Receives `GestureState` from Vision-Core-Agent.
- Routes hands by their tracked, sticky side:
  - Left-side hand → `MovementStateMachine` (X + Y D-Pad zones, hysteresis)
    and `R2TapStateMachine` (index-only point → 120 ms R2 tap).
  - Right-side hand → `ActionStateMachine` (gesture → face button).
- Applies a stable-frame gate (2 frames by default) and a time-based release
  cooldown (90 ms by default) so one gesture yields one press.
- Emits pynput keydown/keyup events mapped to RetroArch's stock PS1 binds:

  | Gesture                    | Key | THPS Action            |
  |----------------------------|-----|------------------------|
  | Left hand x < 0.20         | ←   | Turn Left              |
  | Left hand x > 0.30         | →   | Turn Right             |
  | Left hand y < 0.25         | ↑   | Up                     |
  | Left hand y > 0.75         | ↓   | Down                   |
  | Left hand index-only point | E   | R2 tap (180° spin)     |
  | Open palm                  | Z   | Cross — crouch / ollie |
  | Thumbs up                  | X   | Circle — grab          |
  | Peace sign                 | S   | Triangle               |
  | L shape                    | A   | Square — grind / manual|
  | Fist                       | —   | Release held button    |

**Input:** `GestureState` (updated every frame).
**Output:** OS-level key events consumed by RetroArch.
