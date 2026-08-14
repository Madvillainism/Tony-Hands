# Feature 003 — Action Buttons

## Objective
Detect right-hand gestures and map them to PSX face buttons (Cross, Circle, Triangle, Square) for trick/jump control.

## Mapping
| Gesture           | Button     | THPS Action      |
|-------------------|------------|------------------|
| Open palm (2+ fingers) | Cross | Ollie / jump |
| Thumbs up (thumb out, fingers curled) | Circle | Trick / grab |
| Peace sign (index + middle up) | Triangle | Special / camera |
| L shape (thumb + index out) | Square | Manual / grind |
| Fist (all curled) | — (IDLE) | Release / no input |

## Gesture Priority
```
peace sign → l_shape → thumbs_up → open palm → fist
```

## State Machine
```
IDLE → (stable gesture) → Action (press key)
Action → (gesture changes) → Release current key, then press new action
Release → 3-frame cooldown blocks new presses (anti-flicker)
```

## Interfaces
```python
class ActionStateMachine:
    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        """Returns [(key, is_press), ...] events to emit."""
```

## Visual Feedback
- PS button icon overlay shows the active gesture's button (48×48, from `ps-buttons.jpg`).
