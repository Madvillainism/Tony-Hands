// Emulator-style on-screen buttons for touch devices.
//
// Pointer Events only: no click handler and no focus() of the EJS parent, so
// mobile browsers never raise the soft keyboard. Multiple fingers are tracked
// independently and refcounted per action (two fingers on one button still
// produce a single press until the last one lifts).

export function createTouchState() {
  return { pointers: new Map(), counts: new Map() };
}

/** Register a pointer press. Returns the action to press, or null. */
export function pointerDown(state, pointerId, action, validActions) {
  if (!validActions.has(action)) return null;
  state.pointers.set(pointerId, action);
  const count = (state.counts.get(action) ?? 0) + 1;
  state.counts.set(action, count);
  return count === 1 ? action : null; // press only on first touch
}

/** Release a pointer. Returns { action, release } or null. */
export function pointerUp(state, pointerId) {
  const action = state.pointers.get(pointerId);
  if (action === undefined) return null;
  state.pointers.delete(pointerId);
  const count = (state.counts.get(action) ?? 1) - 1;
  if (count > 0) {
    state.counts.set(action, count);
    return { action, release: false };
  }
  state.counts.delete(action);
  return { action, release: true };
}

/** Release every held action (tab hide, page unload, mode switch). */
export function clearTouches(state) {
  const actions = [...state.counts.keys()];
  state.pointers.clear();
  state.counts.clear();
  return actions;
}

/**
 * Bind delegated pointer handlers on a touch pad container.
 * @param {object} options
 * @param {HTMLElement} options.root container with [data-action] children
 * @param {{set: (action: string, down: boolean) => void}} options.bridge
 * @param {() => boolean} options.isAllowed gate (game live, keyboard mode, touch)
 * @param {() => void} [options.onChange] refresh the chip readout
 * @returns {{clear: () => void, state: object}}
 */
export function bindTouchControls({ root, bridge, isAllowed, onChange }) {
  const state = createTouchState();
  const validActions = new Set(
    [...root.querySelectorAll("[data-action]")].map((b) => b.dataset.action),
  );

  const buttonFor = (action) =>
    root.querySelector(`[data-action="${CSS.escape(action)}"]`);

  function setActive(action, active) {
    const button = buttonFor(action);
    if (button) button.classList.toggle("is-active", active);
  }

  function onDown(event) {
    if (!isAllowed()) return;
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault(); // suppress scroll, zoom and the soft keyboard
    const action = button.dataset.action;
    const pressed = pointerDown(state, event.pointerId, action, validActions);
    if (pressed) {
      bridge.set(pressed, true);
      setActive(action, true);
      onChange?.();
    }
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  function onEnd(event) {
    const result = pointerUp(state, event.pointerId);
    if (!result) return;
    if (result.release) {
      bridge.set(result.action, false);
      setActive(result.action, false);
      onChange?.();
    }
  }

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onEnd);
  root.addEventListener("pointercancel", onEnd);
  root.addEventListener("lostpointercapture", onEnd);

  return {
    state,
    clear() {
      for (const action of clearTouches(state)) {
        bridge.set(action, false);
        setActive(action, false);
      }
      onChange?.();
    },
  };
}
