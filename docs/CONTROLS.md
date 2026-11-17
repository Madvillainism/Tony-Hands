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
| 👍 Thumbs up | Thumb out, fingers curled | **Circle** | Grab |
| ✌️ Peace sign | Index + middle up, ring + pinky curled | **Triangle** | Special / menu |
| 🤘 L shape | Thumb + index out, rest curled | **Square** | Grind / manual |
| ✊ Fist | All fingers curled | — | Releases the held button |

Detection priority (first match wins):

```text
peace → L shape → thumbs up → point → open palm → fist
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
