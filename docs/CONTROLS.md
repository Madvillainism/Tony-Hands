# Tony-Hands — Controls Reference

A one-page cheat-sheet. For installation and tuning, see the [README](../README.md).

---

## Camera layout

```text
┌──────────────────────────────┬──────────────────────────────┐
│  LEFT HALF                   │  RIGHT HALF                  │
│  MOVEMENT (D-Pad)            │  ACTIONS (face buttons)      │
│                              │                              │
│   ↑ Up     y < 0.25          │   ✋ palm     → Cross         │
│   ↓ Down   y > 0.75          │   👍 thumbs   → Circle        │
│   ← Left   x < 0.20          │   ✌️ peace    → Triangle      │
│   → Right  x > 0.30          │   🤘 L shape  → Square        │
│   neutral  0.20 – 0.30       │   ✊ fist     → release       │
│                              │                              │
│   ☝️ point  → R2 tap          │                              │
└──────────────────────────────┴──────────────────────────────┘
```

Zone values are the defaults in `config.toml` (`[movement]`). The preview draws the actual boundaries.

---

## Movement — left hand

The **palm center** decides the direction. Both axes are independent, so diagonals work.

| Hand position | D-Pad |
|---|---|
| `x < left_max` | ← held |
| `x > right_min` | → held |
| `y < up_max` | ↑ held |
| `y > down_min` | ↓ held |
| middle band | nothing |

- A **0.05 hysteresis** band stops the direction flickering at the edge.
- Pointing with the **index finger only** taps **R2** (120 ms press, 250 ms cooldown). Useful for 180° spins.

**Tip:** park your left hand in the middle of the left half between tricks. Resting near a boundary causes accidental turns.

---

## Actions — right hand

| Gesture | How to make it | Button | Typical THPS use |
|---|---|---|---|
| ✋ Open palm | 2+ fingers extended | **Cross** | Hold to crouch, release to ollie |
| 👍 Thumbs up | Thumb out above index, fingers curled | **Circle** | Grab |
| 👎 Thumbs down | Upright fist, thumb below index | **Pause** | Toggle pause; repeat to resume |
| ✌️ Peace sign | Index + middle up, ring + pinky curled | **Triangle** | Special / menu |
| 🤘 L shape | Thumb + index out, rest curled | **Square** | Grind / manual |
| ✊ Fist | All fingers curled | — | Releases the held button |

Detection priority (first match wins):

```text
peace → L shape → thumbs down → thumbs up → point → open palm → fist
```

### The ollie

THPS charges a jump while Cross is held and jumps on release:

1. Open palm → crouch / charge.
2. Fist → release → ollie.
3. Open → fist again for the next ollie.

### Switching tricks

Move straight from one shape to another (e.g. palm → peace). The old button releases, a short 90 ms cooldown prevents double-fires, then the new button presses. Making a fist is the explicit "let go" gesture.

---

## Preview window

| Element | Meaning |
|---|---|
| Yellow vertical line | Left/right split |
| Gray vertical lines | Left / right zone boundaries |
| Gray horizontal lines (left half) | Up / down zone boundaries |
| Dotted gray lines | Hysteresis exit thresholds |
| Colored dot + skeleton | Detected hand (left = orange, right = cyan) |
| `D-PAD (L+U)` label | Active movement direction |
| PS icon + pulsing ring | Active face button and press feedback |
| `R2 TAP` | R2 is currently held |
| `FPS`, `C: I: B: O:` | Frame rate and per-stage milliseconds |
| `[ECO]` | Half-resolution inference is active |

Press **ESC** in the preview to quit.

---

## Good habits

| Do | Avoid |
|---|---|
| Face your palm to the camera | Hand edge-on |
| Keep even lighting | Backlit or dark rooms |
| Exaggerate peace / L shapes | Tiny ambiguous shapes |
| Move decisively between zones | Hovering on a boundary |
| Keep hands ~30–50 cm away | Too close (fingers clipped) or too far |
| Keep the left hand left, right hand right | Crossing the midline repeatedly |

If a gesture misfires, check the [tuning table](../README.md#symptom--setting) before editing code.

---

## Web player

The browser player (live at [tony-hands.pages.dev](https://tony-hands.pages.dev),
or `http://localhost:8000` after `python -m http.server 8000 --directory web`)
always opens in **Keyboard** mode with the Skate layout, the camera card and the
cabinet's Live input chips hidden, so no camera prompt appears on arrival. The
**Select game** card switches between THPS (1999) and THPS 2 (2000) — changing
games reloads the player. Choose **Hands** in the Input card to reveal the camera
card and the chips and switch to hand control; switching back hides both. The
animated hands instructions appear on every selection, before the camera is
requested. Steering uses a neutral band: `x < 0.20` is Left, `x > 0.30` is Right,
and the middle band does nothing. The keys:

| Key | Button | What it does in THPS |
|---|---|---|
| `W` `A` `S` `D` | D-Pad | Steer; move through menus |
| `K` | Cross | Ollie — hold to crouch, release to jump |
| `L` | Circle | Grab |
| `I` | Triangle | Grind |
| `J` | Square | Flip trick |
| `O` | R2 | Quick tap for a 180° spin |
| `Enter` | Start | Pause / start / confirm |
| `Shift` | Select | Back out of menus |

`Q`, `E` and `Tab` are deliberately unbound. The full key-by-key guide is a
collapsed **Keyboard controls** disclosure on the game page and follows your
remaps; the **Remap keys** dialog applies changes immediately.

For menus, use only the left hand as a D-Pad (left/right edges, top and bottom
thirds for Up/Down) and rest in the middle band to stop steering. Raise an open
palm so all fingers are visible to press Cross (X) and confirm; the peace sign
is Triangle and backs out. This walkthrough is repeated in the animated hands
intro and the Trick sheet.

On touch devices the keyboard
toggle is hidden and an emulator-style on-screen pad appears — no soft keyboard.
Turning a touch device sideways gives a full-viewport game with a PS1-style pad
(D-pad left, face diamond right, shoulders on top, Start/Select in the middle).
The D-pad corner buttons are diagonals that hold two directions at once. An Exit
button restores the page. Open <http://localhost:8000/demo.html>
for the hands test bench — it draws the full skeleton overlay and lights chips
without booting a game. The deployed build loads an optional main-menu savestate
so the publisher videos are skipped; see [web/README.md](../web/README.md) for
setup, savestate notes and troubleshooting.
