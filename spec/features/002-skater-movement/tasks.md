# Tasks — 002 Skater Movement

## Implemented
- [x] T2.1 Two-axis `MovementStateMachine` (X: LEFT/NEUTRAL/RIGHT, Y: UP/NEUTRAL/DOWN)
- [x] T2.2 Wire zone classification into main pipeline
- [x] T2.3 Visualize deadzone overlay on debug frame
- [x] T2.4 Position from palm center (centroid of landmarks [0, 5, 9, 13, 17])

## Deadzone & Responsiveness Improvements
- [ ] T2.5 Add hysteresis / debounce to zone transitions (anti-flicker at boundaries)
- [x] T2.6 Add position smoothing (exponential moving average on palm center)
- [x] T2.7 Make zone thresholds configurable via config.toml
- [ ] T2.8 Test with hand sweeps across camera FOV
