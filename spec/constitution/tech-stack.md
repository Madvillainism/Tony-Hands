# Technology Stack

| Layer            | Tool              | Version | Rationale                                    |
|------------------|-------------------|---------|----------------------------------------------|
| Runtime          | Python 3.11+      | ≥3.11   | Type hints, performance, ecosystem           |
| Computer Vision  | OpenCV-Python     | ≥4.8    | Fastest Python webcam capture + drawing      |
| Hand Tracking    | MediaPipe Hands   | 0.10.x  | Lightweight, 21-landmark model, on-device    |
| Input Emulation  | pynput            | ≥1.7    | Direct OS-level key events, microsecond jitter|
| Config           | tomli/tomllib     | stdlib  | Hot-reloadable TOML config                   |
| Logging          | structlog         | ≥23     | Structured logging with frame timestamps     |
| Packaging        | pip/venv          | —       | Lightweight; no Docker needed                |
