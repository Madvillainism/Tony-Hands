import tomllib
import warnings
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass
class CameraSettings:
    source: int = 0
    width: int = 640
    height: int = 480


@dataclass
class InferenceSettings:
    min_detection_confidence: float = 0.7
    min_tracking_confidence: float = 0.5


@dataclass
class DisplaySettings:
    show_preview: bool = True


@dataclass
class MovementSettings:
    left_max: float = 0.20
    right_min: float = 0.30
    up_max: float = 0.25
    down_min: float = 0.75
    hysteresis: float = 0.05
    smoothing_alpha: float = 0.5


@dataclass
class ActionSettings:
    release_cooldown: int = 3
    release_cooldown_ms: float = 90.0
    stable_frames: int = 2
    r2_cooldown_ms: float = 250.0
    r2_stable_frames: int = 2
    r2_hold_ms: float = 120.0


@dataclass
class TrackingSettings:
    match_distance: float = 0.3
    max_lost: int = 8
    side_margin: float = 0.15
    side_dwell: int = 10


@dataclass
class RetroArchSettings:
    path: str = ""
    core: str = ""
    rom: str = ""


@dataclass
class Settings:
    camera: CameraSettings = field(default_factory=CameraSettings)
    inference: InferenceSettings = field(default_factory=InferenceSettings)
    display: DisplaySettings = field(default_factory=DisplaySettings)
    movement: MovementSettings = field(default_factory=MovementSettings)
    actions: ActionSettings = field(default_factory=ActionSettings)
    tracking: TrackingSettings = field(default_factory=TrackingSettings)
    retroarch: RetroArchSettings = field(default_factory=RetroArchSettings)


SECTIONS = {
    "camera": CameraSettings,
    "inference": InferenceSettings,
    "display": DisplaySettings,
    "movement": MovementSettings,
    "actions": ActionSettings,
    "tracking": TrackingSettings,
    "retroarch": RetroArchSettings,
}


def _fill(name: str, section_cls, raw: dict):
    valid = {f.name for f in fields(section_cls)}
    unknown = sorted(set(raw) - valid)
    if unknown:
        warnings.warn(
            f"Ignoring unknown option(s) in [{name}]: {', '.join(unknown)}. "
            "Check config.toml for typos.",
            stacklevel=2,
        )
    return section_cls(**{k: v for k, v in raw.items() if k in valid})


def load_config(path: str | Path = "config.toml") -> Settings:
    settings = Settings()
    p = Path(path)
    if not p.exists():
        warnings.warn(f"Config file not found: {p}. Using defaults.", stacklevel=2)
        return settings
    with p.open("rb") as f:
        raw = tomllib.load(f)

    unknown_sections = sorted(set(raw) - set(SECTIONS))
    if unknown_sections:
        warnings.warn(
            f"Ignoring unknown config section(s): {', '.join(unknown_sections)}. "
            "Check config.toml for typos.",
            stacklevel=2,
        )

    for name, section_cls in SECTIONS.items():
        setattr(settings, name, _fill(name, section_cls, raw.get(name, {})))
    return settings
