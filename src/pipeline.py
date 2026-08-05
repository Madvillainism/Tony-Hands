import ctypes
import time
from collections import deque

import cv2
import numpy as np


from src.bridge.input_bridge import InputBridge
from src.capture.webcam import WebcamThread
from src.gesture.movement import DOWN_MIN, LEFT_MAX, RIGHT_MIN, UP_MAX
from src.inference.mediapipe_hands import GestureState, InferenceWorker

HALF = 0.5

user32 = ctypes.windll.user32


def _find_retroarch() -> int | None:
    return user32.FindWindowW(None, "RetroArch")


def _focus_retroarch() -> None:
    hwnd = _find_retroarch()
    if hwnd:
        user32.ShowWindow(hwnd, 9)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.2)
        print("[Tony Hands] RetroArch window brought to foreground")


class Pipeline:
    def __init__(
        self,
        webcam: WebcamThread,
        inference: InferenceWorker,
        bridge: InputBridge,
        show_preview: bool = True,
    ):
        self._webcam = webcam
        self._inference = inference
        self._bridge = bridge
        self._show_preview = show_preview
        self._fps_history: deque[float] = deque(maxlen=30)
        self._running = False
        self._last_focus_check = 0.0
        self._button_icons = self._load_button_icons()

    @property
    def fps(self) -> float:
        if not self._fps_history:
            return 0.0
        return sum(self._fps_history) / len(self._fps_history)

    def run(self) -> None:
        self._running = True
        self._webcam.start()

        if self._show_preview:
            cv2.imshow("Tony Hands — Preview", np.zeros((480, 640, 3), dtype=np.uint8))
            cv2.waitKey(1)

        _focus_retroarch()

        while self._running:
            tick = time.perf_counter()

            frame = self._webcam.latest_frame
            if frame is None:
                time.sleep(0.001)
                continue

            frame = cv2.flip(frame, 1)

            state = self._inference.process(frame)

            if self._show_preview:
                self._draw_overlay(frame, state)
                cv2.imshow("Tony Hands — Preview", frame)
                if cv2.waitKey(1) & 0xFF == 27:
                    break

            ra_hwnd = _find_retroarch()
            if ra_hwnd:
                user32.SwitchToThisWindow(ra_hwnd, True)
                time.sleep(0.008)

            self._bridge.process(state)

            elapsed = time.perf_counter() - tick
            if elapsed > 0:
                self._fps_history.append(1.0 / elapsed)

            if self._fps_history and self.fps < 20 and len(self._fps_history) >= 60:
                print(f"[WARN] Low FPS ({self.fps:.1f}) — consider reducing resolution")
                self._fps_history.clear()

            remaining = (1.0 / 30) - (time.perf_counter() - tick)
            if remaining > 0:
                time.sleep(remaining)

    def stop(self) -> None:
        self._running = False
        self._webcam.stop()
        cv2.destroyAllWindows()

    def _load_button_icons(self) -> dict[str, np.ndarray]:
        icons: dict[str, np.ndarray] = {}
        try:
            img = cv2.imread("ps-buttons.jpg")
            if img is None:
                return icons
            crops = {
                "triangle": img[25:93, 95:163],
                "circle": img[100:167, 177:244],
                "cross": img[172:240, 93:161],
                "square": img[98:167, 12:81],
            }
            for name, crop in crops.items():
                icons[name] = cv2.resize(crop, (48, 48), interpolation=cv2.INTER_AREA)
        except Exception:
            pass
        return icons

    def _draw_button_icon(self, frame: np.ndarray, icon: np.ndarray, x: int, y: int) -> None:
        h, w = icon.shape[:2]
        fx = min(max(x, 0), frame.shape[1] - w)
        fy = min(max(y, 0), frame.shape[0] - h)
        roi = frame[fy : fy + h, fx : fx + w]
        gray = cv2.cvtColor(icon, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 230, 255, cv2.THRESH_BINARY_INV)
        mask_f = mask.astype(np.float32)[..., None] / 255.0
        blended = icon.astype(np.float32) * mask_f + roi.astype(np.float32) * (1 - mask_f)
        frame[fy : fy + h, fx : fx + w] = blended.astype(np.uint8)

    def _draw_overlay(self, frame: np.ndarray, state: GestureState) -> None:
        h, w = frame.shape[:2]

        cv2.putText(
            frame,
            f"FPS: {state.fps:.1f}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )

        half_x = int(HALF * w)
        left_x = int(LEFT_MAX * w)
        right_x = int(RIGHT_MIN * w)
        up_y = int(UP_MAX * h)
        down_y = int(DOWN_MIN * h)
        cv2.line(frame, (half_x, 0), (half_x, h), (0, 255, 255), 2)

        cv2.putText(
            frame, "MOVE", (8, 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1,
        )
        cv2.putText(
            frame, "JUMP", (half_x + 8, 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1,
        )

        cv2.putText(
            frame, "L", (left_x - 18, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1,
        )
        cv2.putText(
            frame, "N", ((left_x + right_x) // 2 - 6, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1,
        )
        cv2.putText(
            frame, "R", (right_x + 4, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1,
        )

        cv2.line(frame, (left_x, 0), (left_x, h), (100, 100, 100), 1)
        cv2.line(frame, (right_x, 0), (right_x, h), (100, 100, 100), 1)

        cv2.putText(
            frame, "U", (4, up_y - 6),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1,
        )
        cv2.putText(
            frame, "D", (4, down_y + 16),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1,
        )
        cv2.line(frame, (0, up_y), (half_x, up_y), (100, 100, 100), 1)
        cv2.line(frame, (0, down_y), (half_x, down_y), (100, 100, 100), 1)

        for x, y, gesture in state.hands:
            px = int(x * w)
            py = int(y * h)
            is_left_side = x < HALF
            color = (255, 0, 0) if is_left_side else (0, 0, 255)
            cv2.circle(frame, (px, py), 10, color, -1)

            if is_left_side:
                parts = []
                if x < LEFT_MAX:
                    parts.append("L")
                elif x > RIGHT_MIN:
                    parts.append("R")
                if y < UP_MAX:
                    parts.append("U")
                elif y > DOWN_MIN:
                    parts.append("D")
                label = f"D-PAD ({'+'.join(parts)})" if parts else "NEUTRAL"
                cv2.putText(
                    frame, label, (px + 14, py + 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
                )
            else:
                button_name = {
                    "palm": "cross",
                    "thumbs_up": "circle",
                    "peace": "triangle",
                    "l_shape": "square",
                }.get(gesture or "")
                icon = self._button_icons.get(button_name) if button_name else None
                if icon is not None:
                    self._draw_button_icon(frame, icon, px + 14, py - 24)
                else:
                    cv2.putText(
                        frame, "IDLE", (px + 14, py + 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
                    )

        cv2.rectangle(frame, (0, h - 40), (w, h), (0, 0, 0), -1)
        cv2.putText(
            frame,
            "L HALF = MOVE (L/N/R + U/D)  |  R HALF = palm=Cross  thumbs=Circle  peace=Triangle  L=Square",
            (10, h - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )
