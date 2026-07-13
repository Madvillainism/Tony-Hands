# Governance Context — Tony Hands

## Core Constraint: Low-Latency Pipeline
The entire frame-capture → inference → action loop MUST sustain ≤33ms end-to-end latency (30 FPS target).
Any degradation below 20 FPS for more than 2 consecutive seconds triggers an automatic pipeline reset.

Pipeline stages (each must complete within its budget):
| Stage                  | Budget    | Tool              |
|------------------------|-----------|-------------------|
| Frame capture          | ≤8 ms     | OpenCV (cv2)      |
| Hand landmark inference| ≤15 ms    | MediaPipe Hands   |
| Gesture → action map   | ≤5 ms     | Python logic      |
| Key event emission     | ≤2 ms     | pynput            |
| Buffer / slack         | ≤3 ms     | —                 |

## Threading Model (No Multiprocessing)
- One dedicated `WebcamThread` (daemon) reads frames via `cv2.VideoCapture`.
- One `InferenceWorker` runs MediaPipe on the latest frame.
- One `InputBridge` serializes pynput key events.
- Shared state via `collections.deque(maxlen=1)` — always process the *latest* frame, never queue backlog.

## Ollie Physics Quirk (THPS PS1)
The jump (ollie) detection is driven by the Right Hand spatial relationship:

    ΔY = y_wrist − y_index

- ΔY > THRESHOLD_UP  → Ollie / Jump (press X)
- ΔY < THRESHOLD_DOWN → Release X
- Dead zone in between → hold previous state

This inverts the intuitive mapping: raising the hand (wrist above index) issues the jump command, lowering releases it.
The threshold values (in normalized MediaPipe coordinates, 0–1) are:
- THRESHOLD_UP   = 0.04
- THRESHOLD_DOWN = −0.02

These must be empirically tuned per camera setup but START here.

## Handedness Convention
- Left Hand  → Skater movement (Left/Right on D-Pad)
- Right Hand → Ollie/Jump (X button, held duration = jump height)

## Deadzone Specification (Left Hand X-axis)
The horizontal position of the Left Hand's wrist landmark (landmark 0) in the normalized frame [0,1] maps to:
- [0.00, 0.35] → Left D-Pad (hold)
- [0.35, 0.65] → Deadzone (no input)
- [0.65, 1.00] → Right D-Pad (hold)

## File Structure Governance
All feature specs live under `spec/features/NNN-name/`.
Each feature folder MUST contain:
- `spec.md`  — Functional specification
- `plan.md`  — Implementation plan
- `tasks.md` — Task breakdown (tracked via todowrite)
