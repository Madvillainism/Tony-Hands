# Implementation Plan — 002 Skater Movement

1. Create `src/gesture/movement.py`
   - `classify_zone()` — pure function with hysteresis constants
   - `MovementStateMachine` class with zone state tracking and debounce timer
2. Create `src/bridge/key_mapper.py`
   - Map zone strings to pynput keys
3. Integrate into pipeline:
   - After inference, pass left_wrist.x to MovementStateMachine
   - Emit resulting key events via pynput.Controller
4. Test with on-screen zone visualization
