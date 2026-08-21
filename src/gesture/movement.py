from enum import Enum


class HDir(Enum):
    LEFT = "left"
    NEUTRAL = "neutral"
    RIGHT = "right"


class VDir(Enum):
    UP = "up"
    NEUTRAL = "neutral"
    DOWN = "down"


LEFT_MAX = 0.20
RIGHT_MIN = 0.30
UP_MAX = 0.25
DOWN_MIN = 0.75
HYSTERESIS = 0.05


class MovementStateMachine:
    def __init__(
        self,
        left_max: float = LEFT_MAX,
        right_min: float = RIGHT_MIN,
        up_max: float = UP_MAX,
        down_min: float = DOWN_MIN,
        hysteresis: float = HYSTERESIS,
    ):
        self.left_max = left_max
        self.right_min = right_min
        self.up_max = up_max
        self.down_min = down_min
        self.hysteresis = hysteresis
        # Schmitt-trigger thresholds
        self.left_enter = left_max
        self.left_exit = left_max + hysteresis
        self.right_enter = right_min
        self.right_exit = right_min - hysteresis
        self.up_enter = up_max
        self.up_exit = up_max + hysteresis
        self.down_enter = down_min
        self.down_exit = down_min - hysteresis
        self._hdir: HDir = HDir.NEUTRAL
        self._vdir: VDir = VDir.NEUTRAL

    def update(self, x: float, y: float) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []

        # Horizontal with hysteresis
        if self._hdir == HDir.LEFT:
            new_h = HDir.NEUTRAL if x >= self.left_exit else HDir.LEFT
        elif self._hdir == HDir.RIGHT:
            new_h = HDir.NEUTRAL if x <= self.right_exit else HDir.RIGHT
        else:
            if x < self.left_enter:
                new_h = HDir.LEFT
            elif x > self.right_enter:
                new_h = HDir.RIGHT
            else:
                new_h = HDir.NEUTRAL

        if new_h != self._hdir:
            if self._hdir != HDir.NEUTRAL:
                events.append((f"dpad_{self._hdir.value}", False))
            if new_h != HDir.NEUTRAL:
                events.append((f"dpad_{new_h.value}", True))
            self._hdir = new_h

        # Vertical with hysteresis
        if self._vdir == VDir.UP:
            new_v = VDir.NEUTRAL if y >= self.up_exit else VDir.UP
        elif self._vdir == VDir.DOWN:
            new_v = VDir.NEUTRAL if y <= self.down_exit else VDir.DOWN
        else:
            if y < self.up_enter:
                new_v = VDir.UP
            elif y > self.down_enter:
                new_v = VDir.DOWN
            else:
                new_v = VDir.NEUTRAL

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
