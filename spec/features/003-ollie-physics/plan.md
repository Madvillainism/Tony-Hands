# Implementation Plan — 003 Ollie Physics

1. Create `src/gesture/ollie.py`
   - `OllieStateMachine` with two states: IDLE, JUMPING
   - Transition logic per ΔY thresholds
2. Integrate into pipeline:
   - After inference, pass right_hand delta_y to OllieStateMachine
   - Emit X keydown/keyup via pynput
3. Create debug overlay showing ΔY value and current state
4. Test with hand raise/lower patterns
