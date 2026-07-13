# Mission & Vision

## Mission
Eliminate the barrier between human gesture and digital skateboarding. Build a zero-latency computer vision interface that makes playing Tony Hawk's Pro Skater on RetroArch as natural as performing the tricks yourself.

## Vision
A plug-and-play hand-tracking overlay for RetroArch (and ultimately any emulator) that requires no controller, no hardware mods — just a webcam and the will to ollie.

## Core Tenets
1. **Latency is the enemy.** Every microsecond counts. No abstraction layer, no unnecessary copy, no frame dropped willingly.
2. **Determinism over cleverness.** The mapping from hand position to button state must be predictable and tunable. No ML black boxes in the action mapping.
3. **Minimal dependencies.** OpenCV, MediaPipe, pynput. That's the stack. No game engine, no web framework, no GUI.
4. **Tunable by feel.** All thresholds (deadzones, ΔY bounds) must be live-configurable — hot-reload from a TOML file or CLI args.
