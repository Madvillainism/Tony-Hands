# Agent Roles — Tony Hands

## Vision-Core-Agent
**Responsibility:** OpenCV & MediaPipe pipeline ownership.
- Manages WebcamThread lifecycle (start, frame polling, graceful stop).
- Runs MediaPipe Hands inference on each frame.
- Extracts normalized (x, y) coordinates for landmarks of interest.
- Computes palm center (centroid of landmarks [0, 5, 9, 13, 17]).
- Tracks hands across frames by identity (`HandTracker`), assigning a sticky `left`/`right` side.
- Classifies gestures (peace, l_shape, thumbs_up, palm, fist).
- Benchmarks FPS and enforces the latency budget.

**Input:** Raw webcam frames (BGR, 640×480).
**Output:** `GestureState` — list of `(x, y, gesture, side)` tuples per detected hand, passed to InputBridge.

## Input-Bridge-Agent
**Responsibility:** pynput micro-second keypress event triggers.
- Receives `GestureState` from Vision-Core-Agent.
- Applies deadzone filtering (movement) and a 3-frame release cooldown (actions).
- Routes hands by their tracked, sticky side (assigned at detection, only
  re-assigned after a sustained crossing of the midline):
  - Left-side hand → `MovementStateMachine` (X + Y D-Pad zones)
  - Right-side hand → `ActionStateMachine` (gesture → face button)
- Emits pynput keydown/keyup events mapped to RetroArch PS1 binds:
  | Gesture              | Key      | THPS Action       |
  |----------------------|----------|-------------------|
  | Left hand x < 0.20   | ←        | Turn Left         |
  | Left hand x > 0.30   | →        | Turn Right        |
  | Left hand y < 0.25   | ↑        | Up                |
  | Left hand y > 0.75   | ↓        | Down              |
  | Open palm            | Cross    | Ollie / Jump      |
  | Thumbs up            | Circle   | Trick / Grab      |
  | Peace sign           | Triangle | Special / Camera  |
  | L shape              | Square   | Manual / Grind    |
- Guarantees ≤2µs jitter on event emission (uses pynput.Controller directly, no abstraction layers).

**Input:** `GestureState` (list of hand tuples, updated every frame).
**Output:** OS-level key events consumed by RetroArch.
