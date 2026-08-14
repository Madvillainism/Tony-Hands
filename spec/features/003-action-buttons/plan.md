# Implementation Plan — 003 Action Buttons

1. Create `src/gesture/actions.py`
   - `ActionStateMachine` with states IDLE/CROSS/CIRCLE/TRIANGLE/SQUARE
   - `GESTURE_TO_ACTION` mapping gesture name → action
   - 3-frame release cooldown to prevent flicker-triggered presses
2. Integrate into pipeline:
   - `InputBridge` routes right-half hands to `ActionStateMachine`
   - Emit keydown/keyup via pynput (`key_mapper.py`)
3. Add gesture classification in `src/inference/mediapipe_hands.py`
   - `_classify_gesture()` with priority: peace → l_shape → thumbs_up → palm → fist
4. Add PS button icon overlay in `pipeline.py`
   - Crop `ps-buttons.jpg` into per-button icons, blit active button icon
5. Test gesture transitions and release cooldown
