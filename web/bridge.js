// Bridge between gesture actions and the emulator's controller ports.
//
// EmulatorJS exposes `gameManager.simulateInput(player, index, value)`, the
// same call its keyboard and gamepad handlers use, so injected presses are
// indistinguishable from real ones. Indices are RetroPad positions:
//
//     0 Cross · 1 Square · 2 Select · 3 Start
//     4 Up · 5 Down · 6 Left · 7 Right
//     8 Circle · 9 Triangle · 10 L1 · 11 R1 · 12 L2 · 13 R2
//
// Verified against the retail game: 0 accepts, 9 backs out, 3 opens the menu,
// 5 moves the cursor.

export const PAD = Object.freeze({
  cross: 0,
  square: 1,
  select: 2,
  start: 3,
  dpad_up: 4,
  dpad_down: 5,
  dpad_left: 6,
  dpad_right: 7,
  circle: 8,
  triangle: 9,
  l1: 10,
  r1: 11,
  l2: 12,
  r2: 13,
});

export const ACTION_LABELS = Object.freeze({
  dpad_up: "Up",
  dpad_down: "Down",
  dpad_left: "Left",
  dpad_right: "Right",
  cross: "Cross",
  circle: "Circle",
  triangle: "Triangle",
  square: "Square",
  r2: "R2",
  start: "Start",
  select: "Select",
});

export class PadBridge {
  /**
   * @param {() => ({ simulateInput: Function } | null)} getGameManager
   *   Called on every press so the bridge works before the emulator boots.
   */
  constructor(getGameManager) {
    this.getGameManager = getGameManager;
    this.pressed = new Set();
  }

  get ready() {
    return Boolean(this.getGameManager());
  }

  /** @param {{ action: string, press: boolean }} event */
  apply(event) {
    this.set(event.action, event.press);
  }

  set(action, down) {
    const index = PAD[action];
    if (index === undefined) return false;

    // Track intent even when the emulator is absent, so releaseAll() is still
    // correct if a press lands during boot.
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);

    const gameManager = this.getGameManager();
    if (!gameManager) return false;

    try {
      gameManager.simulateInput(0, index, down ? 1 : 0);
      return true;
    } catch (error) {
      console.warn(`Could not send ${action} to the emulator.`, error);
      return false;
    }
  }

  releaseAll() {
    for (const action of [...this.pressed]) this.set(action, false);
    return this.pressed.size;
  }
}
