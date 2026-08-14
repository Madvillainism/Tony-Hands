from pynput.keyboard import Controller

from src.gesture.movement import (
    DOWN_MIN,
    LEFT_MAX,
    RIGHT_MIN,
    UP_MAX,
    HDir,
    MovementStateMachine,
    VDir,
)
from src.gesture.actions import ActionStateMachine
from src.inference.mediapipe_hands import GestureState
from src.bridge.key_mapper import RETROARCH_KEYS


class InputBridge:
    def __init__(
        self,
        movement_left_max: float = LEFT_MAX,
        movement_right_min: float = RIGHT_MIN,
        movement_up_max: float = UP_MAX,
        movement_down_min: float = DOWN_MIN,
        actions_release_cooldown: int = 3,
    ):
        self._controller = Controller()
        self._movement = MovementStateMachine(
            left_max=movement_left_max,
            right_min=movement_right_min,
            up_max=movement_up_max,
            down_min=movement_down_min,
        )
        self._actions = ActionStateMachine(release_cooldown=actions_release_cooldown)

    def process(self, state: GestureState) -> None:
        for x, y, gesture, side in state.hands:
            if side == "left":
                move_events = self._movement.update(x, y)
                for action, is_press in move_events:
                    self._send(action, is_press)
            else:
                action_events = self._actions.update(gesture)
                for action, is_press in action_events:
                    self._send(action, is_press)

    def _send(self, action: str, is_press: bool) -> None:
        key = RETROARCH_KEYS.get(action)
        if key is None:
            return
        if is_press:
            self._controller.press(key)
        else:
            self._controller.release(key)

    @property
    def movement_zones(self) -> dict[str, float]:
        return {
            "left_max": self._movement.left_max,
            "right_min": self._movement.right_min,
            "up_max": self._movement.up_max,
            "down_min": self._movement.down_min,
        }

    @property
    def hdir(self) -> HDir:
        return self._movement.hdir

    @property
    def vdir(self) -> VDir:
        return self._movement.vdir

    @property
    def action_state(self):
        return self._actions.state

    @property
    def action_cooldown_left(self) -> int:
        return self._actions.cooldown_left

    @property
    def action_cooldown_total(self) -> int:
        return self._actions.cooldown_total

    @property
    def action_update_ms(self) -> float:
        return self._actions.last_update_ms
