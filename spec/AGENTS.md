# Agent Roles — Tony Hands

## Vision-Core-Agent
**Responsibility:** OpenCV & MediaPipe pipeline ownership.
- Manages WebcamThread lifecycle (start, frame polling, graceful stop).
- Runs MediaPipe Hands inference on each frame.
- Extracts normalized (x, y) coordinates for landmarks of interest.
- Computes derived metrics (ΔY, bounding boxes, deadzone classifications).
- Benchmarks FPS and enforces the latency budget.

**Input:** Raw webcam frames (BGR, 640×480).
**Output:** Gesture state dict passed to InputBridge via shared deque.

## Input-Bridge-Agent
**Responsibility:** pynput micro-second keypress event triggers.
- Receives gesture state dict from Vision-Core-Agent.
- Applies deadzone filtering and state debouncing.
- Emits pynput keydown/keyup events mapped to RetroArch PS1 binds:
  | Gesture              | Key      | THPS Action       |
  |----------------------|----------|-------------------|
  | Left Hand → Left     | ←        | Turn Left         |
  | Left Hand → Right    | →        | Turn Right        |
  | Right Hand ΔY > UP   | X        | Ollie / Jump      |
  | Right Hand ΔY < DOWN | (release)| Release Jump      |
- Guarantees ≤2µs jitter on event emission (uses pynput.Controller directly, no abstraction layers).

**Input:** Gesture state dict (Python dict, updated every frame).
**Output:** OS-level key events consumed by RetroArch.
