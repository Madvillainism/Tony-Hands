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

The left hand's index-only **point** gesture taps R2 (120 ms hold) for in-air
180s; it is not part of the right-hand face-button mapping.

## Gesture Priority
```
peace sign → l_shape → thumbs_up → open palm → fist
```
(`point` is classified too, but only consumed by the left-hand R2 machine.)

## State Machine
```
IDLE → (gesture stable for stable_frames) → Action (press key)
Action → (gesture changes) → Release current key, then press new action
Release → release_cooldown_ms blocks new presses (anti-flicker)
```
The cooldown is time-based (90 ms default) and ticks even when no hand is
visible, so it cannot get stuck. Same-button holds bypass the cooldown.

## Interfaces
```python
class ActionStateMachine:
    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        """Returns [(key, is_press), ...] events to emit."""
```

## Visual Feedback
- PS button icon overlay shows the active gesture's button (48×48, from `ps-buttons.jpg`).
