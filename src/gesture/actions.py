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
    def __init__(self, release_cooldown: int = 3):
        self._state: ActionState | None = ActionState.IDLE
        self._release_cooldown = release_cooldown
        self._cooldown = 0

    def _resolve(self, gesture: str | None) -> ActionState | None:
        if gesture is None:
            return ActionState.IDLE
        return GESTURE_TO_ACTION.get(gesture, ActionState.IDLE)

    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []
        target = self._resolve(gesture)

        if self._cooldown > 0:
            self._cooldown -= 1

        if target == self._state:
            return events

        if self._state is not None and self._state != ActionState.IDLE:
            events.append((self._state.value, False))
            self._cooldown = self._release_cooldown
            self._state = ActionState.IDLE

        if self._cooldown > 0:
            return events

        if target is not None and target != ActionState.IDLE:
            events.append((target.value, True))

        self._state = target
        return events

    @property
    def state(self) -> ActionState:
        return self._state or ActionState.IDLE
