# Feature 003 — Ollie Physics (Jump)

## Objective
Detect Right Hand vertical delta (ΔY = wrist_y − index_y) and map to X button state for ollie/jump control.

## Formula
```
ΔY = y_wrist − y_index
```

| Condition           | Action              |
|---------------------|---------------------|
| ΔY > +0.04          | Press X (ollie)     |
| ΔY < −0.02          | Release X           |
| −0.02 ≤ ΔY ≤ +0.04  | Maintain prior state|

## Key Insight (THPS Physics)
In THPS, jump height is proportional to how long X is held. Therefore:
- A quick upward flick → short hop
- Sustained raised hand → full ollie (hold X)
- Dropping hand → release X early (pop less air)

## State Machine
```
IDLE → (ΔY > THRESH_UP) → JUMPING (press X)
JUMPING → (ΔY < THRESH_DOWN) → IDLE (release X)
JUMPING → (still > THRESH_UP) → JUMPING (hold X)
```

## Interfaces
```python
class OllieStateMachine:
    def update(self, delta_y: float) -> list[tuple[str, bool]]:
        """Returns [(key, is_press), ...] events."""
```
