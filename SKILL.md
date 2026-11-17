---
name: tony-hands
description: Work on the Tony-Hands gesture controller (MediaPipe + RetroArch). Use when changing hand tracking, gesture mapping, input bridge, preview overlay, config, or docs in this repository.
---

# Tony-Hands

## When to use

Any task inside this repository: tuning gestures, changing key mappings,
adjusting the pipeline, updating docs, or porting logic to the web version.

## Read first

1. `README.md` — user-facing behavior and controls.
2. `docs/SETUP.md` — architecture, state machines, key map.
3. `AGENTS.md` — constraints and style.

## Instructions

1. **Never change behavior silently.** The mapping is tuned by feel; if you
   swap a gesture or key, update `docs/CONTROLS.md`, `docs/SETUP.md`, and the
   README cheat-sheet in the same change.
2. **Respect the 33 ms budget.** Do not add blocking work to the main loop.
   Measure with the overlay stage timings when possible.
3. **Config first.** New thresholds belong in `config.toml` + `src/config.py`,
   not inline constants. Keep backwards-compatible defaults.
4. **State machines:** inputs are `(action, is_press)` tuples. Preserve the
   stable-frame gate, release-before-press ordering, and time-based cooldowns.
5. **Windows-only APIs** live in `src/pipeline.py`; keep them guarded so the
   rest of the package still imports on other platforms.
6. **No game assets.** Never add ROMs, BIOS files, or copyrighted images.
   `ps-buttons.jpg` is the only committed image asset.
7. **Web work** happens on `feat/web` and must use the Modern Web Guidance
   skill with a Baseline 2024 target.

## Quick checks

```powershell
python -m compileall src
python -m src.main --no-preview
```

Press `Ctrl+C` to stop the second command.
