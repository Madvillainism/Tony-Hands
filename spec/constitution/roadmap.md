# Roadmap

## Phase 1 — Baseline (this sprint)
- [x] Project scaffold & spec governance structure
- [x] Webcam thread with FPS display overlay
- [x] Raw MediaPipe Hand landmark extraction
- [x] Left Hand X-axis deadzone → D-Pad output
- [x] Right Hand gestures → Action buttons (Cross / Circle / Triangle / Square)
- [x] Full pipeline integration test (webcam → RetroArch)

## Phase 2 — Polish & Tunability
- [x] Two-axis D-Pad (UP/DOWN), palm-center position detection
- [x] PS button icon overlay, 3-frame release cooldown
- [ ] Hysteresis / debounce on movement zone transitions
- [ ] Position smoothing (jitter reduction)
- [ ] Configurable zone thresholds in config.toml
- [ ] Live-config TOML reload
- [ ] Per-calibration wizard (capture neutral stance)
- [ ] Graceful fallback on FPS drop
- [ ] End-to-end latency benchmark & stage-budget monitoring
- [ ] Visual press indicator (icon pulse / cooldown feedback)

## Phase 3 — Advanced Gestures
- [ ] Grind activation (gesture combo)
- [ ] Grab tricks (finger-count detection)
- [ ] Special / Secret (two-hand gesture)
- [ ] Pause / Menu gesture
