from enum import Enum


class ActionState(Enum):
    IDLE = "idle"
    CROSS = "cross"
    CIRCLE = "circle"
    TRIANGLE = "triangle"
    SQUARE = "square"


GESTURE_TO_ACTION: dict[str, ActionState] = {
    "palm": ActionState.CROSS,
    "peace": ActionState.TRIANGLE,
    "l_shape": ActionState.SQUARE,
    "thumbs_up": ActionState.CIRCLE,
}


class ActionStateMachine:
    def __init__(self, hold_frames: int = 3):
        self._state: ActionState | None = ActionState.IDLE
        self._hold_frames = hold_frames
        self._stable = 0
        self._candidate: ActionState | None = None

    def _resolve(self, gesture: str | None) -> ActionState | None:
        if gesture is None:
            return ActionState.IDLE
        return GESTURE_TO_ACTION.get(gesture, ActionState.IDLE)

    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []
        target = self._resolve(gesture)

        if target == self._state:
            self._stable = 0
            self._candidate = None
            return events

        if target != self._candidate:
            self._candidate = target
            self._stable = 1
        else:
            self._stable += 1

        if self._stable < self._hold_frames:
            return events

        if self._state is not None and self._state != ActionState.IDLE:
            events.append((self._state.value, False))

        if target is not None and target != ActionState.IDLE:
            events.append((target.value, True))

        self._state = target
        self._stable = 0
        self._candidate = None
        return events

    @property
    def state(self) -> ActionState:
        return self._state or ActionState.IDLE
