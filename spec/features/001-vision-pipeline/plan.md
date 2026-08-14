# Implementation Plan — 001 Vision Pipeline

1. Create `src/capture/__init__.py` and `src/capture/webcam.py`
   - `WebcamThread` class using `threading.Thread` + `cv2.VideoCapture`
   - Frame stored in `self._latest_frame` with a `threading.Lock`
 2. Create `src/inference/__init__.py` and `src/inference/mediapipe_hands.py`
   - `InferenceWorker` with MediaPipe `HandLandmarker`
   - Compute palm center (centroid of landmarks [0, 5, 9, 13, 17])
   - Classify gesture (peace / l_shape / thumbs_up / palm / fist)
3. Create `src/pipeline.py` — orchestrator tying webcam → inference → state
   - Loop: grab frame → infer → compute stats → store in deque
   - FPS counter via rolling average over 30 frames
4. Create `src/main.py` — entrypoint with graceful shutdown
