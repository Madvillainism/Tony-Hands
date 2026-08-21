import time
from enum import Enum


class ActionState(Enum):
    IDLE = "idle"
    CROSS = "cross"
    CIRCLE = "circle"
    TRIANGLE = "triangle"
    SQUARE = "square"
    R2 = "r2"


GESTURE_TO_ACTION: dict[str, ActionState] = {
    "palm": ActionState.CROSS,
    "peace": ActionState.TRIANGLE,
    "l_shape": ActionState.SQUARE,
    "thumbs_up": ActionState.CIRCLE,
}


class ActionStateMachine:
    """Precise face-button machine: stable-frame gate + time-based cooldown.

    - A gesture must be stable for `stable_frames` consecutive updates before
      it can change the held button (kills 1-frame flicker).
    - After releasing a button, `release_cooldown_ms` blocks the next *press*
      (different button). Same-button hold bypasses the block. Cooldown is
      time-based and ticked via `tick()` so it advances even when no hand
      is visible.
    """

    def __init__(
        self,
        release_cooldown: int = 3,
        release_cooldown_ms: float | None = None,
        stable_frames: int = 2,
    ):
        self._state: ActionState | None = ActionState.IDLE
        self._release_cooldown = release_cooldown
        # Back-compat: int frames → ms (30 FPS ≈ 33.3 ms/frame)
        if release_cooldown_ms is None:
            release_cooldown_ms = release_cooldown * 33.3
        self._release_cooldown_ms = float(release_cooldown_ms)
        self._stable_frames = max(1, stable_frames)
        self._cooldown_remaining = 0.0
        self._pending_target: ActionState | None = ActionState.IDLE
        self._pending_count = 0
        self.last_update_ms = 0.0

    def _resolve(self, gesture: str | None) -> ActionState | None:
        if gesture is None:
            return ActionState.IDLE
        return GESTURE_TO_ACTION.get(gesture, ActionState.IDLE)

    def tick(self, dt_ms: float) -> None:
        if self._cooldown_remaining > 0:
            self._cooldown_remaining = max(0.0, self._cooldown_remaining - dt_ms)

    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        start = time.perf_counter()
        events: list[tuple[str, bool]] = []
        target = self._resolve(gesture)

        # Stable-frame gate — require the *resolved* target to repeat.
        if target != self._pending_target:
            self._pending_target = target
            self._pending_count = 1
        else:
            self._pending_count += 1

        if self._pending_count < self._stable_frames:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return events

        stable_target = self._pending_target

        if stable_target == self._state:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return events

        # Need cooldown only when about to press a non-IDLE button.
        needs_press = stable_target is not None and stable_target != ActionState.IDLE
        if needs_press and self._cooldown_remaining > 0:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return events

        if self._state is not None and self._state != ActionState.IDLE:
            events.append((self._state.value, False))
            self._cooldown_remaining = self._release_cooldown_ms
            self._state = ActionState.IDLE
            # If we just needed to release (stable_target == IDLE), done.
            if stable_target == ActionState.IDLE:
                self.last_update_ms = (time.perf_counter() - start) * 1000
                return events
            # Fresh release blocks an immediate re-press.
            if self._cooldown_remaining > 0:
                self.last_update_ms = (time.perf_counter() - start) * 1000
                return events

        if stable_target is not None and stable_target != ActionState.IDLE:
            events.append((stable_target.value, True))

        self._state = stable_target
        self.last_update_ms = (time.perf_counter() - start) * 1000
        return events

    @property
    def state(self) -> ActionState:
        return self._state or ActionState.IDLE

    @property
    def cooldown_left(self) -> int:
        # Frames-compat: report ms as int ms for overlay; keep old property name
        return int(self._cooldown_remaining)

    @property
    def cooldown_total(self) -> int:
        return int(self._release_cooldown_ms)

    @property
    def cooldown_ms_remaining(self) -> float:
        return self._cooldown_remaining


class R2TapStateMachine:
    """Left-hand R2 tap: point (index-only) → timed tap.

    Emits press on stable point then auto-releases after `hold_ms`
    (tap, not hold). Re-arms only after finger is lowered, so holding
    the point does not repeat. Cooldown then blocks the next tap.
    """

    def __init__(
        self,
        cooldown_ms: float = 250,
        stable_frames: int = 2,
        hold_ms: float = 120,
    ):
        self._cooldown_ms = float(cooldown_ms)
        self._stable_frames = max(1, stable_frames)
        self._hold_ms = float(hold_ms)
        self._cooldown_remaining = 0.0
        self._held_remaining = 0.0
        self._is_held = False
        self._pending_is_point = False
        self._pending_count = 0
        self._armed = True
        self.last_update_ms = 0.0

    def tick(self, dt_ms: float) -> list[tuple[str, bool]]:
        events: list[tuple[str, bool]] = []
        if self._cooldown_remaining > 0:
            self._cooldown_remaining = max(0.0, self._cooldown_remaining - dt_ms)
        if self._is_held:
            self._held_remaining -= dt_ms
            if self._held_remaining <= 0:
                self._is_held = False
                self._held_remaining = 0.0
                events.append(("r2", False))
        return events

    def update(self, gesture: str | None) -> list[tuple[str, bool]]:
        start = time.perf_counter()
        is_point = gesture == "point"

        if is_point != self._pending_is_point:
            self._pending_is_point = is_point
            self._pending_count = 1
        else:
            self._pending_count += 1

        if self._pending_count < self._stable_frames:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return []

        # Stable non-point → re-arm
        if not self._pending_is_point:
            self._armed = True
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return []

        if not self._armed:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return []

        if self._is_held:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return []

        if self._cooldown_remaining > 0:
            self.last_update_ms = (time.perf_counter() - start) * 1000
            return []

        self._cooldown_remaining = self._cooldown_ms
        self._held_remaining = self._hold_ms
        self._is_held = True
        self._armed = False
        self.last_update_ms = (time.perf_counter() - start) * 1000
        return [("r2", True)]

    @property
    def is_held(self) -> bool:
        return self._is_held

    @property
    def cooldown_left(self) -> int:
        return int(self._cooldown_remaining)

    @property
    def cooldown_total(self) -> int:
        return int(self._cooldown_ms)
