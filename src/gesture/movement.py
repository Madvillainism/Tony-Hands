from enum import Enum


class Direction(Enum):
    LEFT = "left"
    NEUTRAL = "neutral"
    RIGHT = "right"


LEFT_MAX = 0.18
RIGHT_MIN = 0.32


class MovementStateMachine:
    def __init__(self):
        self._current: Direction = Direction.NEUTRAL

    def update(self, x: float) -> list[tuple[str, bool]]:
        if x < LEFT_MAX:
            new = Direction.LEFT
        elif x > RIGHT_MIN:
            new = Direction.RIGHT
        else:
            new = Direction.NEUTRAL

        events: list[tuple[str, bool]] = []

        if new != self._current:
            if self._current != Direction.NEUTRAL:
                events.append((f"dpad_{self._current.value}", False))
            if new != Direction.NEUTRAL:
                events.append((f"dpad_{new.value}", True))
            self._current = new

        return events

    @property
    def direction(self) -> Direction:
        return self._current
