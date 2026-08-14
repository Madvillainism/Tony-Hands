# Feature 001 — Vision Pipeline

## Objective
Establish the real-time webcam capture → hand landmark extraction pipeline with guaranteed FPS ≥ 30.

## Interface
```
WebcamThread (daemon thread)
  .start() → begins capturing frames
  .latest_frame → property returning most recent BGR ndarray (or None)

InferenceWorker
  .process(frame) → GestureState dict
  .fps → rolling average FPS
```

## GestureState Schema
```python
@dataclass
class GestureState:
    timestamp: float                     # time.perf_counter()
    hands: list[tuple[float, float, str | None, str]]  # [(palm_x, palm_y, gesture, side), ...]
    landmarks: list[list[tuple[float, float]]]         # 21-point landmarks per hand
    fps: float                           # rolling average FPS
```

`hands` contains one tuple per detected hand: normalized smoothed palm-center
`(x, y)`, the classified gesture name (`"peace"`, `"l_shape"`, `"thumbs_up"`,
`"palm"`, `"fist"`, or `None`), and the sticky control side (`"left"` /
`"right"`). Hands are tracked across frames by identity, so order and side do
not flip while moving.

## Acceptance Criteria
1. Webcam opens within 2 seconds of `start()`.
2. 640×480 resolution at ≥30 FPS sustained for 5 minutes.
3. Frame pipeline latency ≤33ms (capture → state dict).
4. Graceful shutdown on `KeyboardInterrupt`.
