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


@dataclass
class GestureState:
    timestamp: float = 0.0
    hands: list[tuple[float, float, bool | None]] = field(default_factory=list)
    fps: float = 0.0


def _is_open_palm(landmarks: list) -> bool:
    count = 0
    for mcp_idx, tip_idx in zip(MCP_INDICES, TIP_INDICES):
        mcp = landmarks[mcp_idx]
        tip = landmarks[tip_idx]
        if tip.y < mcp.y - 0.02:
            count += 1
    return count >= 2


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

        if result.hand_landmarks and result.handedness:
            for hand_lms, handedness in zip(result.hand_landmarks, result.handedness):
                label = handedness[0].category_name if handedness else "Unknown"
                wrist = hand_lms[0]
                palm = _is_open_palm(hand_lms)
                state.hands.append((wrist.x, wrist.y, palm))

        return state

    def close(self) -> None:
        self._landmarker.close()
