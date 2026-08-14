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

## Action Buttons (THPS PS1)
Right-hand gestures map to face buttons:

| Gesture                          | Button     | THPS Action      |
|----------------------------------|------------|------------------|
| Open palm (2+ fingers extended)  | Cross      | Ollie / jump     |
| Thumbs up (thumb out, others curled) | Circle | Trick / grab     |
| Peace sign (index + middle up)   | Triangle   | Special / camera |
| L shape (thumb + index out)      | Square     | Manual / grind   |
| Fist (all fingers curled)        | —          | Release / no input |

Gesture classification priority: `peace → l_shape → thumbs_up → palm → fist`.

A **3-frame release cooldown** blocks new presses immediately after a release. This prevents
the 1–2 frame gesture flicker that occurs when a hand transitions between poses from
triggering unwanted buttons.

## Handedness Convention
- Left Hand  → Skater movement (D-Pad, both axes)
- Right Hand → Action buttons (gesture-based)

## Deadzone Specification (Left Hand)
Position is measured from the **palm center** (centroid of landmarks `[0, 5, 9, 13, 17]`),
not the wrist.

Horizontal X (normalized [0,1], left half of frame):
- `x < 0.20` → Left D-Pad (hold)
- `0.20 – 0.30` → Deadzone (no input)
- `x > 0.30` → Right D-Pad (hold)

Vertical Y (normalized [0,1]):
- `y < 0.25` → Up D-Pad (hold)
- `0.25 – 0.75` → Deadzone (no input)
- `y > 0.75` → Down D-Pad (hold)

Both axes are independent, so diagonal D-Pad inputs (e.g., Up+Left) are supported.

## File Structure Governance
All feature specs live under `spec/features/NNN-name/`.
Each feature folder MUST contain:
- `spec.md`  — Functional specification
- `plan.md`  — Implementation plan
- `tasks.md` — Task breakdown (tracked via todowrite)
