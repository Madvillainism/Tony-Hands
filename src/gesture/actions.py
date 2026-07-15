from enum import Enum


class ActionState(Enum):
    IDLE = "idle"
    CROSS = "cross"
    CIRCLE = "circle"
    TRIANGLE = "triangle"
    SQUARE = "square"


GESTURE_TO_ACTION: dict[str, ActionState] = {
    "palm": ActionState.CROSS,
    "fist": ActionState.CIRCLE,
    "peace": ActionState.TRIANGLE,
    "l_shape": ActionState.SQUARE,
}


class ActionStateMachine:
    def __init__(self):
        self._state = ActionState.IDLE

    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []

        if gesture is None:
            if self._state != ActionState.IDLE:
                events.append((self._state.value, False))
                self._state = ActionState.IDLE
            return events

        target = GESTURE_TO_ACTION.get(gesture, ActionState.IDLE)

        if target != self._state:
            if self._state != ActionState.IDLE:
                events.append((self._state.value, False))
            if target != ActionState.IDLE:
                events.append((target.value, True))
            self._state = target

        return events

    @property
    def state(self) -> ActionState:
        return self._state
