import ctypes
import math
import time
from collections import deque

import cv2
import numpy as np


from src.bridge.input_bridge import InputBridge
from src.capture.webcam import WebcamThread
from src.inference.mediapipe_hands import GestureState, InferenceWorker

HALF = 0.5
FPS_BUDGET_MS = 33.0
LOW_FPS_WINDOW_S = 2.0
LOW_FPS_THRESHOLD = 20.0
RECOVER_WINDOW_S = 3.0

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

LEFT_COLOR = (255, 150, 0)
RIGHT_COLOR = (0, 220, 255)

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
        self._stage_times: dict[str, deque[float]] = {
            name: deque(maxlen=30) for name in ("capture", "infer", "overlay", "bridge", "total")
        }
        self._economy = False
        self._low_fps_seconds = 0.0
        self._recovered_seconds = 0.0

    @property
    def fps(self) -> float:
        if not self._fps_history:
            return 0.0
        return sum(self._fps_history) / len(self._fps_history)

    def _record_stage(self, name: str, start: float) -> None:
        self._stage_times[name].append((time.perf_counter() - start) * 1000)

    def _avg_ms(self, name: str) -> float:
        dq = self._stage_times[name]
        return sum(dq) / len(dq) if dq else 0.0

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
            self._record_stage("capture", tick)

            frame = cv2.flip(frame, 1)

            infer_start = time.perf_counter()
            if self._economy:
                small = cv2.resize(
                    frame,
                    (frame.shape[1] // 2, frame.shape[0] // 2),
                    interpolation=cv2.INTER_AREA,
                )
                state = self._inference.process(small)
            else:
                state = self._inference.process(frame)
            self._record_stage("infer", infer_start)

            if self._show_preview:
                ov_start = time.perf_counter()
                self._draw_overlay(frame, state)
                cv2.imshow("Tony Hands — Preview", frame)
                self._record_stage("overlay", ov_start)
                if cv2.waitKey(1) & 0xFF == 27:
                    break

            ra_hwnd = _find_retroarch()
            if ra_hwnd:
                user32.SwitchToThisWindow(ra_hwnd, True)
                time.sleep(0.008)

            br_start = time.perf_counter()
            self._bridge.process(state)
            self._record_stage("bridge", br_start)

            elapsed = time.perf_counter() - tick
            if elapsed > 0:
                self._fps_history.append(1.0 / elapsed)
                self._record_stage("total", tick)

            if self.fps < LOW_FPS_THRESHOLD and len(self._fps_history) >= 30:
                self._low_fps_seconds += elapsed
                self._recovered_seconds = 0.0
            else:
                self._low_fps_seconds = 0.0
                if self._economy:
                    self._recovered_seconds += elapsed

            if self._low_fps_seconds >= LOW_FPS_WINDOW_S and not self._economy:
                self._economy = True
                print("[WARN] Sustained <20 FPS — switching to economy mode (half-res inference)")
            if self._economy and self._recovered_seconds >= RECOVER_WINDOW_S:
                self._economy = False
                print("[INFO] FPS recovered — economy mode disabled")

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

    def _draw_skeleton(self, frame: np.ndarray, lms: list, w: int, h: int, color) -> None:
        pts = [(int(lx * w), int(ly * h)) for lx, ly in lms]
        for a, b in HAND_CONNECTIONS:
            cv2.line(frame, pts[a], pts[b], color, 1, cv2.LINE_AA)
        for p in pts:
            cv2.circle(frame, p, 2, color, -1, cv2.LINE_AA)

    def _draw_press_indicator(
        self,
        frame: np.ndarray,
        center: tuple[int, int],
        active: bool,
        cooldown_left: int = 0,
        cooldown_total: int = 0,
    ) -> None:
        c = (int(center[0]), int(center[1]))
        if active:
            radius = int(27 + 3 * math.sin(6 * time.perf_counter()))
            cv2.circle(frame, c, radius, (0, 255, 0), 2)
        elif cooldown_total > 0 and cooldown_left > 0:
            frac = cooldown_left / cooldown_total
            cv2.ellipse(frame, c, (30, 30), 0, 0, 360 * frac, (0, 210, 255), 2)

    def _draw_overlay(self, frame: np.ndarray, state: GestureState) -> None:
        h, w = frame.shape[:2]
        zones = self._bridge.movement_zones

        fps_color = (0, 255, 0) if self.fps >= 20 else (0, 0, 255)
        cv2.putText(
            frame,
            f"FPS: {self.fps:.1f}" + ("  [ECO]" if self._economy else ""),
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            fps_color,
            2,
        )

        cap = self._avg_ms("capture")
        infer = self._avg_ms("infer")
        ov = self._avg_ms("overlay")
        br = self._avg_ms("bridge")
        tot = self._avg_ms("total")
        stat_color = (255, 255, 255)
        if tot > FPS_BUDGET_MS:
            stat_color = (0, 0, 255)
        elif tot > FPS_BUDGET_MS - 3:
            stat_color = (0, 200, 255)
        cv2.putText(
            frame,
            f"C:{cap:.1f} I:{infer:.1f} B:{br:.1f} O:{ov:.1f} | {tot:.1f}ms"
            f"  act:{self._bridge.action_update_ms:.3f}ms",
            (10, 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            stat_color,
            1,
        )

        half_x = int(HALF * w)
        left_x = int(zones["left_max"] * w)
        right_x = int(zones["right_min"] * w)
        up_y = int(zones["up_max"] * h)
        down_y = int(zones["down_min"] * h)
        cv2.line(frame, (half_x, 0), (half_x, h), (0, 255, 255), 2)

        cv2.putText(
            frame, "MOVE", (8, 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1,
        )
        cv2.putText(
            frame, "ACTIONS", (half_x + 8, 20),
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

        for i, (x, y, gesture, side) in enumerate(state.hands):
            px = int(x * w)
            py = int(y * h)
            is_left_side = side == "left"
            color = LEFT_COLOR if is_left_side else RIGHT_COLOR
            cv2.circle(frame, (px, py), 10, color, -1)

            if i < len(state.landmarks):
                self._draw_skeleton(frame, state.landmarks[i], w, h, color)

            if is_left_side:
                parts = []
                if x < zones["left_max"]:
                    parts.append("L")
                elif x > zones["right_min"]:
                    parts.append("R")
                if y < zones["up_max"]:
                    parts.append("U")
                elif y > zones["down_min"]:
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
                    active = self._bridge.action_state.value == button_name
                    self._draw_press_indicator(
                        frame,
                        (px + 14 + 24, py - 24 + 24),
                        active,
                        self._bridge.action_cooldown_left,
                        self._bridge.action_cooldown_total,
                    )
                else:
                    cv2.putText(
                        frame, "NO MAPPED GESTURE", (px + 14, py + 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
                    )

                gesture_label = gesture if gesture else "NONE"
                cv2.putText(
                    frame, gesture_label, (px + 14, py + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1,
                )

        cv2.rectangle(frame, (0, h - 40), (w, h), (0, 0, 0), -1)
        cv2.putText(
            frame,
            "L HALF = MOVE (L/N/R + U/D)  |  R HALF = palm=Cross  thumbs=Circle  peace=Triangle  L=Square",
            (10, h - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )