# Tony-Hands — Agent Notes

Project-specific guidance for coding agents working in this repository.

## What this is

A Windows desktop app that turns webcam hand gestures into keyboard input for
RetroArch (PS1). Python 3.11, MediaPipe HandLandmarker, OpenCV, pynput.

## Commands

```powershell
python -m src.main            # run the tracker (add --no-preview for headless)
pip install -e .              # install/refresh dependencies
python -m compileall src      # syntax check
```

There is no test suite yet. When changing state machines, verify behavior by
reasoning through the emission order and, when possible, with a short script
that feeds synthetic frames/gestures.

## Hard constraints

- **Windows-only.** `src/pipeline.py` uses `ctypes.windll.user32`.
- **30 FPS budget (33 ms).** Anything added to the main loop must be cheap.
  Avoid extra frame copies, per-frame allocations, and blocking calls.
- **Determinism over ML.** Gesture classification is geometric (landmark
  positions), not a model. Keep it explainable and tunable.
- **No frame drops on purpose.** The economy mode is the only sanctioned
  quality reduction.
- **Config is the interface.** New tunables go in `config.toml` + `src/config.py`
  with sensible defaults, not hard-coded in the pipeline.

## Style

- Dataclasses for settings, small state machines as classes with `update()`
  returning `(action, is_press)` tuples.
- Imports: stdlib, third-party, then `src.*`.
- Keep comments about *why*, not *what*.

## Web work

The browser version lives on `feat/web`. When writing HTML/CSS/client-side JS:

- Use the **Modern Web Guidance** skill (`googlechrome/modern-web-guidance`)
  before implementing UI, layout, animation, forms, or DOM logic.
- **Baseline target: Baseline 2024.** Prefer features that are widely available;
  include lightweight fallbacks when a feature is newer.
- Keep the web app framework-light unless there is a concrete reason not to.

## Docs

`README.md` is the user tutorial; `docs/SETUP.md` is the technical reference;
`docs/GAMES.md` covers other games; `docs/CONTROLS.md` is the cheat-sheet. When
behavior changes, update the relevant doc in the same commit.
