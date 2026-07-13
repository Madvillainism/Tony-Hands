import argparse
import sys

from src.bridge.input_bridge import InputBridge
from src.capture.webcam import WebcamThread
from src.inference.mediapipe_hands import InferenceWorker
from src.pipeline import Pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tony Hands — gesture-controlled THPS")
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Webcam source index (default: 0)",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Disable the preview window",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Capture width (default: 640)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Capture height (default: 480)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    webcam = WebcamThread(source=args.camera, width=args.width, height=args.height)
    inference = InferenceWorker()
    bridge = InputBridge()
    pipeline = Pipeline(
        webcam=webcam,
        inference=inference,
        bridge=bridge,
        show_preview=not args.no_preview,
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
