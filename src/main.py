import argparse
import sys
from pathlib import Path

from src.bridge.input_bridge import InputBridge
from src.capture.webcam import WebcamThread
from src.config import load_config
from src.inference.mediapipe_hands import InferenceWorker
from src.pipeline import Pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tony Hands — gesture-controlled THPS")
    parser.add_argument(
        "--camera",
        type=int,
        default=None,
        help="Webcam source index (default: config.toml or 0)",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Disable the preview window",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=None,
        help="Capture width (default: config.toml or 640)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=None,
        help="Capture height (default: config.toml or 480)",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to config.toml (default: <project root>/config.toml)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    cfg_path = args.config or str(Path(__file__).resolve().parent.parent / "config.toml")
    settings = load_config(cfg_path)

    if args.camera is not None:
        settings.camera.source = args.camera
    if args.width is not None:
        settings.camera.width = args.width
    if args.height is not None:
        settings.camera.height = args.height
    show_preview = settings.display.show_preview and not args.no_preview

    webcam = WebcamThread(
        source=settings.camera.source,
        width=settings.camera.width,
        height=settings.camera.height,
    )
    inference = InferenceWorker(
        min_detection_confidence=settings.inference.min_detection_confidence,
        min_tracking_confidence=settings.inference.min_tracking_confidence,
        smoothing_alpha=settings.movement.smoothing_alpha,
        match_distance=settings.tracking.match_distance,
        max_lost=settings.tracking.max_lost,
        side_margin=settings.tracking.side_margin,
        side_dwell=settings.tracking.side_dwell,
    )
    bridge = InputBridge(
        movement_left_max=settings.movement.left_max,
        movement_right_min=settings.movement.right_min,
        movement_up_max=settings.movement.up_max,
        movement_down_min=settings.movement.down_min,
        movement_hysteresis=settings.movement.hysteresis,
        actions_release_cooldown=settings.actions.release_cooldown,
        actions_release_cooldown_ms=settings.actions.release_cooldown_ms,
        actions_stable_frames=settings.actions.stable_frames,
        actions_r2_cooldown_ms=settings.actions.r2_cooldown_ms,
        actions_r2_stable_frames=settings.actions.r2_stable_frames,
        actions_r2_hold_ms=settings.actions.r2_hold_ms,
    )
    pipeline = Pipeline(
        webcam=webcam,
        inference=inference,
        bridge=bridge,
        show_preview=show_preview,
    )

    print("Tony Hands running. Press ESC or Ctrl+C to quit.")
    try:
        pipeline.run()
    except KeyboardInterrupt:
        pass
    finally:
        pipeline.stop()
        print("Tony Hands shut down.")


if __name__ == "__main__":
    main()
