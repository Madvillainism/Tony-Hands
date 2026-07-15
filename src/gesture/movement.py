from enum import Enum


class HDir(Enum):
    LEFT = "left"
    NEUTRAL = "neutral"
    RIGHT = "right"


class VDir(Enum):
    UP = "up"
    NEUTRAL = "neutral"
    DOWN = "down"


LEFT_MAX = 0.18
RIGHT_MIN = 0.32
UP_MAX = 0.25
DOWN_MIN = 0.75


class MovementStateMachine:
    def __init__(self):
        self._hdir: HDir = HDir.NEUTRAL
        self._vdir: VDir = VDir.NEUTRAL

    def update(self, x: float, y: float) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []

        new_h = HDir.LEFT if x < LEFT_MAX else HDir.RIGHT if x > RIGHT_MIN else HDir.NEUTRAL

        if new_h != self._hdir:
            if self._hdir != HDir.NEUTRAL:
                events.append((f"dpad_{self._hdir.value}", False))
            if new_h != HDir.NEUTRAL:
                events.append((f"dpad_{new_h.value}", True))
            self._hdir = new_h

        new_v = VDir.UP if y < UP_MAX else VDir.DOWN if y > DOWN_MIN else VDir.NEUTRAL

        if new_v != self._vdir:
            if self._vdir != VDir.NEUTRAL:
                events.append((f"dpad_{self._vdir.value}", False))
            if new_v != VDir.NEUTRAL:
                events.append((f"dpad_{new_v.value}", True))
            self._vdir = new_v

        return events

    @property
    def hdir(self) -> HDir:
        return self._hdir

    @property
    def vdir(self) -> VDir:
        return self._vdir
