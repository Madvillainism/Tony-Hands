import threading
import time

import cv2
import numpy as np


class WebcamThread:
    def __init__(self, source: int = 0, width: int = 640, height: int = 480):
        self._source = source
        self._width = width
        self._height = height
        self._cap: cv2.VideoCapture | None = None
        self._latest_frame: np.ndarray | None = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None

    @property
    def latest_frame(self) -> np.ndarray | None:
        with self._lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        self._cap = cv2.VideoCapture(self._source, cv2.CAP_DSHOW)
        if not self._cap.isOpened():
            raise RuntimeError(f"Could not open webcam source {self._source}")

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        if self._cap:
            self._cap.release()

    def _capture_loop(self) -> None:
        while self._running:
            ret, frame = self._cap.read()
            if ret:
                with self._lock:
                    self._latest_frame = frame
            else:
                time.sleep(0.001)
