// Emulator-style on-screen buttons for touch devices.
//
// Pointer Events only: no click handler and no focus() of the EJS parent, so
// mobile browsers never raise the soft keyboard. Multiple fingers are tracked
// independently and refcounted per action (two fingers on one button still
// produce a single press until the last one lifts). A button may list several
// whitespace-separated actions, which is how the diagonal D-Pad pads hold two
// directions at once.

export function createTouchState() {
  return { pointers: new Map(), counts: new Map() };
}

/** Split a button's data-action into individual RetroPad actions. */
export function actionsOf(button) {
  return (button.dataset.action ?? "").trim().split(/\s+/).filter(Boolean);
}

/** Register a pointer press. Returns only the actions that became pressed. */
export function pointerDown(state, pointerId, actions, validActions) {
  const accepted = actions.filter((action) => validActions.has(action));
  if (accepted.length === 0) return [];

  state.pointers.set(pointerId, accepted);
  const pressed = [];
  for (const action of accepted) {
    const count = (state.counts.get(action) ?? 0) + 1;
    state.counts.set(action, count);
    if (count === 1) pressed.push(action);
  }
  return pressed;
}

/** Release a pointer. Returns { actions, release } or null. */
export function pointerUp(state, pointerId) {
  const actions = state.pointers.get(pointerId);
  if (!actions) return null;

  state.pointers.delete(pointerId);
  const released = [];
  for (const action of actions) {
    const count = (state.counts.get(action) ?? 1) - 1;
    if (count > 0) {
      state.counts.set(action, count);
    } else {
      state.counts.delete(action);
      released.push(action);
    }
  }
  return { actions: released, release: released.length > 0 };
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
    [...root.querySelectorAll("[data-action]")].flatMap(actionsOf),
  );
  const activeButtons = new Map();

  function onDown(event) {
    if (!isAllowed()) return;
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault(); // suppress scroll, zoom and the soft keyboard
    const pressed = pointerDown(state, event.pointerId, actionsOf(button), validActions);
    if (pressed.length) {
      for (const action of pressed) bridge.set(action, true);
      button.classList.add("is-active");
      activeButtons.set(event.pointerId, button);
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
    const button = activeButtons.get(event.pointerId);
    activeButtons.delete(event.pointerId);
    if (button) button.classList.remove("is-active");

    if (result?.release) {
      for (const action of result.actions) bridge.set(action, false);
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
      for (const action of clearTouches(state)) bridge.set(action, false);
      for (const button of root.querySelectorAll(".is-active")) {
        button.classList.remove("is-active");
      }
      activeButtons.clear();
      onChange?.();
    },
  };
}
