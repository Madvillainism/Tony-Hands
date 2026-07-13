# Feature 002 — Skater Movement (Left/Right)

## Objective
Map Left Hand wrist X-coordinate to Left/Right D-Pad keypresses with hysteresis deadzone.

## Mapping
| Normalized X Range | Output     |
|--------------------|------------|
| [0.00, 0.30]       | ← key held |
| (0.30, 0.70)       | Deadzone (no input) |
| [0.70, 1.00]       | → key held |

## Hysteresis
To prevent flickering at zone boundaries, apply a 50ms debounce:
- Entering a zone → emit keydown immediately.
- Exiting a zone → emit keyup only after 50ms continuous absence.

## Interfaces
```python
def classify_zone(x: float) -> str | None:
    """Returns 'left', 'right', or None."""

class MovementStateMachine:
    def update(self, x: float) -> list[tuple[str, bool]]:
        """Returns [(key, is_press), ...] events to emit."""
```
