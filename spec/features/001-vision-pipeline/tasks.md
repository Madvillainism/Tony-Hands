# Tasks — 001 Vision Pipeline

## Baseline
- [x] T1.1 Create project skeleton (`src/`, `pyproject.toml`, `venv`)
- [x] T1.2 Implement `WebcamThread` with lock-protected frame access
- [x] T1.3 Implement `InferenceWorker` with MediaPipe Hands
- [x] T1.4 Wire pipeline loop in `pipeline.py`
- [x] T1.5 Add FPS benchmark overlay (putText)
- [x] T1.6 Add graceful shutdown (SIGINT / KeyboardInterrupt)
- [ ] T1.7 Validate sustained 30 FPS for 5 minutes

## Responsiveness & Latency Budget
- [x] T1.8 End-to-end latency benchmark (capture → key event)
- [x] T1.9 Stage-budget monitoring per CONTEXT.md (≤33ms total)
- [x] T1.10 Auto-reset / fallback if <20 FPS for 2 consecutive seconds
- [x] T1.11 Tune release cooldown (currently 3 frames) for optimal responsiveness
