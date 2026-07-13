from enum import Enum


class ActionState(Enum):
    IDLE = "idle"
    CROSS = "cross"
    CIRCLE = "circle"


class ActionStateMachine:
    def __init__(self):
        self._state = ActionState.IDLE

    def update(self, is_open_palm: bool | None) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []

        if is_open_palm is None:
            if self._state == ActionState.CROSS:
                events.append(("cross", False))
            elif self._state == ActionState.CIRCLE:
                events.append(("circle", False))
            self._state = ActionState.IDLE
            return events

        if is_open_palm:
            if self._state == ActionState.CIRCLE:
                events.append(("circle", False))
            if self._state != ActionState.CROSS:
                events.append(("cross", True))
            self._state = ActionState.CROSS
        else:
            if self._state == ActionState.CROSS:
                events.append(("cross", False))
            if self._state != ActionState.CIRCLE:
                events.append(("circle", True))
            self._state = ActionState.CIRCLE

        return events

    @property
    def state(self) -> ActionState:
        return self._state
