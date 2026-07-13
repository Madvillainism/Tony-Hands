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
    timestamp: float          # time.perf_counter()
    left_wrist: tuple[float, float] | None   # (x, y) normalized
    left_index: tuple[float, float] | None
    right_wrist: tuple[float, float] | None
    right_index: tuple[float, float] | None
    delta_y: float | None      # right_wrist.y - right_index.y
    fps: float
```

## Acceptance Criteria
1. Webcam opens within 2 seconds of `start()`.
2. 640×480 resolution at ≥30 FPS sustained for 5 minutes.
3. Frame pipeline latency ≤33ms (capture → state dict).
4. Graceful shutdown on `KeyboardInterrupt`.
