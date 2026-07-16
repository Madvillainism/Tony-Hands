import time
from dataclasses import dataclass, field

import cv2
import numpy as np
from mediapipe import Image, ImageFormat
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
from mediapipe.tasks.python.vision.hand_landmarker import (
    HandLandmarker,
    HandLandmarkerOptions,
)


MCP_INDICES = [5, 9, 13, 17]
TIP_INDICES = [8, 12, 16, 20]
THUMB_MCP = 2
THUMB_TIP = 4
PALM_INDICES = [0, 5, 9, 13, 17]


@dataclass
class GestureState:
    timestamp: float = 0.0
    hands: list[tuple[float, float, str | None]] = field(default_factory=list)
    fps: float = 0.0


def _is_finger_extended(landmarks: list, tip_idx: int, mcp_idx: int) -> bool:
    return landmarks[tip_idx].y < landmarks[mcp_idx].y - 0.02


def _is_finger_curled(landmarks: list, tip_idx: int, mcp_idx: int) -> bool:
    return landmarks[tip_idx].y > landmarks[mcp_idx].y + 0.01


def _is_thumb_extended(landmarks: list) -> bool:
    dx = landmarks[THUMB_TIP].x - landmarks[5].x
    dy = landmarks[THUMB_TIP].y - landmarks[5].y
    return (dx * dx + dy * dy) > 0.0064


def _is_peace_sign(landmarks: list) -> bool:
    return (
        _is_finger_extended(landmarks, 8, 5)
        and _is_finger_extended(landmarks, 12, 9)
        and _is_finger_curled(landmarks, 16, 13)
        and _is_finger_curled(landmarks, 20, 17)
    )


def _is_l_gesture(landmarks: list) -> bool:
    return (
        _is_thumb_extended(landmarks)
        and _is_finger_extended(landmarks, 8, 5)
        and _is_finger_curled(landmarks, 12, 9)
        and _is_finger_curled(landmarks, 16, 13)
        and _is_finger_curled(landmarks, 20, 17)
    )


def _is_thumbs_up(landmarks: list) -> bool:
    return (
        _is_thumb_extended(landmarks)
        and _is_finger_curled(landmarks, 8, 5)
        and _is_finger_curled(landmarks, 12, 9)
        and _is_finger_curled(landmarks, 16, 13)
        and _is_finger_curled(landmarks, 20, 17)
    )


def _is_open_palm(landmarks: list) -> bool:
    return sum(
        _is_finger_extended(landmarks, tip_idx, mcp_idx)
        for mcp_idx, tip_idx in zip(MCP_INDICES, TIP_INDICES)
    ) >= 2


def _classify_gesture(landmarks: list) -> str:
    if _is_peace_sign(landmarks):
        return "peace"
    if _is_l_gesture(landmarks):
        return "l_shape"
    if _is_thumbs_up(landmarks):
        return "thumbs_up"
    if _is_open_palm(landmarks):
        return "palm"
    return "fist"


class InferenceWorker:
    def __init__(
        self,
        model_path: str = "hand_landmarker.task",
        num_hands: int = 2,
        min_detection_confidence: float = 0.7,
        min_tracking_confidence: float = 0.5,
    ):
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=VisionTaskRunningMode.IMAGE,
            num_hands=num_hands,
            min_hand_detection_confidence=min_detection_confidence,
            min_hand_presence_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._landmarker = HandLandmarker.create_from_options(options)
        self._fps_history: list[float] = []
        self._last_tick = time.perf_counter()

    @property
    def fps(self) -> float:
        if not self._fps_history:
            return 0.0
        return sum(self._fps_history) / len(self._fps_history)

    def process(self, frame: np.ndarray) -> GestureState:
        tick = time.perf_counter()
        if self._last_tick > 0:
            self._fps_history.append(1.0 / (tick - self._last_tick))
            if len(self._fps_history) > 30:
                self._fps_history.pop(0)
        self._last_tick = tick

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = Image(image_format=ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)

        state = GestureState(timestamp=tick, fps=self.fps)

        if result.hand_landmarks:
            for hand_lms in result.hand_landmarks:
                cx = sum(hand_lms[i].x for i in PALM_INDICES) / len(PALM_INDICES)
                cy = sum(hand_lms[i].y for i in PALM_INDICES) / len(PALM_INDICES)
                gesture = _classify_gesture(hand_lms)
                state.hands.append((cx, cy, gesture))

        return state

    def close(self) -> None:
        self._landmarker.close()
