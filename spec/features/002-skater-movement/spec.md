# Feature 002 — Skater Movement (Left/Right/Up/Down)

## Objective
Map Left Hand palm-center position to D-Pad keypresses on both axes (X and Y).

## Mapping
Position is measured from the **palm center** (centroid of landmarks `[0, 5, 9, 13, 17]`).

| Axis | Normalized range | Output     |
|------|------------------|------------|
| X    | `x < 0.20`       | ← key held |
| X    | `0.20 – 0.30`    | Deadzone (no input) |
| X    | `x > 0.30`       | → key held |
| Y    | `y < 0.25`       | ↑ key held |
| Y    | `0.25 – 0.75`    | Deadzone (no input) |
| Y    | `y > 0.75`       | ↓ key held |

Both axes are evaluated independently every frame, so diagonal inputs
(e.g., Up+Left) are supported.

## Debounce / Hysteresis
Not yet implemented — zone transitions currently fire immediately on the
hand's raw position. Hysteresis/debounce is a planned improvement (T2.5).

## Interfaces
```python
class MovementStateMachine:
    def update(self, x: float, y: float) -> list[tuple[str, bool]]:
        """Returns [(key, is_press), ...] events to emit (dpad_left/right/up/down)."""
```