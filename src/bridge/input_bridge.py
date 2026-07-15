from pynput.keyboard import Controller

from src.gesture.movement import MovementStateMachine
from src.gesture.actions import ActionStateMachine
from src.inference.mediapipe_hands import GestureState
from src.bridge.key_mapper import RETROARCH_KEYS

HALF = 0.5


class InputBridge:
    def __init__(self):
        self._controller = Controller()
        self._movement = MovementStateMachine()
        self._actions = ActionStateMachine()

    def process(self, state: GestureState) -> None:
        for x, y, gesture in state.hands:
            if x < HALF:
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
