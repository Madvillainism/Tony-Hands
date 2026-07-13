# Implementation Plan — 001 Vision Pipeline

1. Create `src/capture/__init__.py` and `src/capture/webcam.py`
   - `WebcamThread` class using `threading.Thread` + `cv2.VideoCapture`
   - Frame stored in `self._latest_frame` with a `threading.Lock`
2. Create `src/inference/__init__.py` and `src/inference/mediapipe_hands.py`
   - `InferenceWorker` with `mp.solutions.hands.Hands`
   - Extract landmarks 0 (wrist) and 8 (index fingertip) for both hands
   - Compute `delta_y`
3. Create `src/pipeline.py` — orchestrator tying webcam → inference → state
   - Loop: grab frame → infer → compute stats → store in deque
   - FPS counter via rolling average over 30 frames
4. Create `src/main.py` — entrypoint with graceful shutdown
