# Roadmap

## Phase 1 — Baseline
- [x] Project scaffold & spec governance structure
- [x] Webcam thread with FPS display overlay
- [x] Raw MediaPipe Hand landmark extraction
- [x] Left Hand X-axis deadzone → D-Pad output
- [x] Right Hand gestures → Action buttons (Cross / Circle / Triangle / Square)
- [x] Full pipeline integration test (webcam → RetroArch)

## Phase 2 — Polish & Tunability
- [x] Two-axis D-Pad (UP/DOWN), palm-center position detection
- [x] PS button icon overlay, release cooldown
- [x] Hysteresis / debounce on movement zone transitions
- [x] Position smoothing (jitter reduction)
- [x] Configurable zone thresholds in config.toml
- [x] Graceful fallback on FPS drop (economy mode)
- [x] End-to-end latency benchmark & stage-budget monitoring
- [x] Visual press indicator (icon pulse / cooldown feedback)
- [x] Stable hand identity + sticky left/right side assignment
- [x] Left-hand R2 tap for in-air 180s
- [ ] Live-config TOML reload
- [ ] Per-calibration wizard (capture neutral stance)

## Phase 3 — Advanced Gestures
- [ ] Grind activation (gesture combo)
- [ ] Grab tricks (finger-count detection)
- [ ] Special / Secret (two-hand gesture)
- [ ] Pause / Menu gesture
- [ ] Config-driven `[bindings]` / `[target]` for other games
- [ ] `--profile` game presets
- [ ] Virtual gamepad backend (ViGEm)

## Phase 4 — Web
- [ ] Browser demo: MediaPipe WASM + Canvas, ported state machines
- [ ] Playable in-browser via EmulatorJS
- [ ] Browser-as-controller bridge (WebSocket → desktop app)
- [ ] Deploy to GitHub Pages / Vercel with tutorial
