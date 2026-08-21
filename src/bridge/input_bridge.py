import time

from pynput.keyboard import Controller

from src.gesture.movement import (
    DOWN_MIN,
    HYSTERESIS,
    LEFT_MAX,
    RIGHT_MIN,
    UP_MAX,
    HDir,
    MovementStateMachine,
    VDir,
)
from src.gesture.actions import ActionStateMachine, R2TapStateMachine
from src.inference.mediapipe_hands import GestureState
from src.bridge.key_mapper import RETROARCH_KEYS


class InputBridge:
    def __init__(
        self,
        movement_left_max: float = LEFT_MAX,
        movement_right_min: float = RIGHT_MIN,
        movement_up_max: float = UP_MAX,
        movement_down_min: float = DOWN_MIN,
        movement_hysteresis: float = HYSTERESIS,
        actions_release_cooldown: int = 3,
        actions_release_cooldown_ms: float = 90.0,
        actions_stable_frames: int = 2,
        actions_r2_cooldown_ms: float = 250.0,
        actions_r2_stable_frames: int = 2,
        actions_r2_hold_ms: float = 120.0,
    ):
        self._controller = Controller()
        self._movement = MovementStateMachine(
            left_max=movement_left_max,
            right_min=movement_right_min,
            up_max=movement_up_max,
            down_min=movement_down_min,
            hysteresis=movement_hysteresis,
        )
        self._actions = ActionStateMachine(
            release_cooldown=actions_release_cooldown,
            release_cooldown_ms=actions_release_cooldown_ms,
            stable_frames=actions_stable_frames,
        )
        self._r2tap = R2TapStateMachine(
            cooldown_ms=actions_r2_cooldown_ms,
            stable_frames=actions_r2_stable_frames,
            hold_ms=actions_r2_hold_ms,
        )
        self._last_tick = time.perf_counter()

    def _dt_ms(self) -> float:
        now = time.perf_counter()
        dt = (now - self._last_tick) * 1000
        self._last_tick = now
        # Clamp to avoid huge jumps on first call or pause
        return min(dt, 100.0)

    def process(self, state: GestureState) -> None:
        dt = self._dt_ms()
        self._actions.tick(dt)
        for action, is_press in self._r2tap.tick(dt):
            self._send(action, is_press)

        # Track whether we saw a left/right hand this frame for idle tick
        seen_left = False
        seen_right = False

        for x, y, gesture, side in state.hands:
            if side == "left":
                seen_left = True
                move_events = self._movement.update(x, y)
                for action, is_press in move_events:
                    self._send(action, is_press)
                # Left-hand point → R2 tap (press now, auto-release after hold_ms)
                r2_events = self._r2tap.update(gesture)
                for action, is_press in r2_events:
                    self._send(action, is_press)
            else:
                seen_right = True
                action_events = self._actions.update(gesture)
                for action, is_press in action_events:
                    self._send(action, is_press)

        # If no left hand, feed idle to R2 tap so stable gate resets
        if not seen_left:
            r2_events = self._r2tap.update(None)
            for action, is_press in r2_events:
                self._send(action, is_press)
        # If no right hand, feed idle to face-button machine (releases + cooldown tick)
        if not seen_right:
            action_events = self._actions.update(None)
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
            "hysteresis": self._movement.hysteresis,
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

    @property
    def r2_is_held(self) -> bool:
        return self._r2tap.is_held

    @property
    def r2_cooldown_left(self) -> int:
        return self._r2tap.cooldown_left

    @property
    def r2_cooldown_total(self) -> int:
        return self._r2tap.cooldown_total
