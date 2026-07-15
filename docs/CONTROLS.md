# Tony Hands — Controls Reference

How to control **Tony Hawk's Pro Skater** with your hands via webcam.

---

## Camera View

The camera feed is split vertically down the middle:

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│   LEFT HALF          │   RIGHT HALF         │
│   D-Pad Movement     │   Action Buttons     │
│                      │                      │
│   L │ NEUTRAL │ R    │   palm → Cross      │
│   ───┼─────────┼───   │   fist → Circle     │
│   U /  N  / D        │   peace → Triangle   │
│                      │   L    → Square      │
└──────────────────────┴──────────────────────┘
```

- **Left hand** in the left half → controls D-Pad movement.
- **Right hand** in the right half → performs action gestures.
- A hand is on the side where its **wrist position** falls.

---

## Movement (Left Half)

Your hand's **X position** controls left/right; **Y position** controls up/down.
Both axes are independent — diagonals (Up+Left, Down+Right, etc.) are supported.

### Horizontal zones

| Label | X range | D-Pad action |
|-------|---------|--------------|
| L     | `x < 0.18` | ← Left (held) |
| N     | `0.18 – 0.32` | Nothing pressed |
| R     | `x > 0.32` | → Right (held) |

### Vertical zones

| Label | Y range | D-Pad action |
|-------|---------|--------------|
| U     | `y < 0.25` | ↑ Up (held) |
| N     | `0.25 – 0.75` | Nothing pressed |
| D     | `y > 0.75` | ↓ Down (held) |

**Tip:** Rest your hand in the center-left neutral zone when you don't want
to move. The preview window shows zone boundary lines and a label
(e.g. `D-PAD (L+U)` for top-left corner).

---

## Actions (Right Half)

Your right hand's **gesture** determines which face button is pressed.

| Gesture | How to make it | Button | In-game use |
|---------|---------------|--------|-------------|
| ✋ Open palm | 2+ fingers extended, any combination. | **Cross** | Ollie, jump, confirm |
| ✊ Fist | All fingers curled into palm. | **Circle** | Trick, grab, special |
| ✌️ Peace sign | Index + middle up; ring + pinky down. | **Triangle** | Camera, pause-menu select, special tricks |
| 🤘 L shape | Thumb + index out; middle/ring/pinky down. | **Square** | Manual, grind, revert |

**The gesture that matches first wins.** Priority order:

1. **Peace sign** — exact V shape with ring+pinky curled.
2. **L shape** — thumb+index out, other fingers curled.
3. **Open palm** — any 2+ fingers extended that aren't peace or L.
4. **Fist** — everything else (no fingers extended).

### Examples

- Holding a relaxed open hand → Cross held (ollie repeatedly).
- Making a fist → Circle press, then hold.
- Switching from fist to palm → Circle released, Cross pressed.
- No hand visible → all buttons released.

---

## Preview window

The preview window (`Tony Hands — Preview`) shows:

- **Yellow vertical line** — the left/right split.
- **Gray vertical lines** — LEFT and RIGHT zone boundaries.
- **Gray horizontal lines (left half only)** — UP and DOWN zone boundaries.
- **Blue dot** — left-hand wrist position (with direction label).
- **Red dot** — right-hand wrist position (with action label).
- **Black bottom bar** — legend of all controls.

Press **ESC** with the preview window focused to quit.

---

## Tips for reliable control

| Do | Don't |
|----|-------|
| Face your palm toward the camera. | Turn your hand sideways (edge-on). |
| Keep your hand in good lighting. | Work in dim or backlit conditions. |
| Exaggerate finger positions for peace/L. | Make tiny or ambiguous gestures. |
| Move hand decisively through zone boundaries. | Hover near zone edges (causes jitter). |
| Hold your hand ~30–50 cm from the camera. | Hold too close (cuts off fingers) or too far. |

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Nothing happens | No hand detected | Check lighting, webcam, face palm to camera. |
| Wrong gesture detected | Gesture is ambiguous | Make the shape more clearly; check priority order. |
| D-Pad activates when idle | Hand in wrong zone | Rest hand in center-left neutral zone. |
| Movement jitters | Hand near zone boundary | Move hand more decisively left/right/up/down. |
| Low FPS / lag | Camera resolution too high | Lower `width`/`height` in `config.toml`. |
| Preview lags behind game | Focus switching | Normal — press ESC to close preview (`-NoPreview`). |
