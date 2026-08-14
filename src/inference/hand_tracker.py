import math

HALF = 0.5


class HandTrack:
    __slots__ = (
        "id",
        "side",
        "sx",
        "sy",
        "alpha",
        "lost",
        "last_landmarks",
        "_pending_side",
        "_pending_frames",
    )

    def __init__(
        self,
        tid: int,
        x: float,
        y: float,
        alpha: float,
        landmarks=None,
        side: str | None = None,
    ):
        self.id = tid
        self.side = side if side is not None else ("left" if x < HALF else "right")
        self.sx = x
        self.sy = y
        self.alpha = alpha
        self.lost = 0
        self.last_landmarks = landmarks
        self._pending_side: str | None = None
        self._pending_frames = 0

    def update(self, x: float, y: float, landmarks=None) -> None:
        self.sx = self.alpha * x + (1.0 - self.alpha) * self.sx
        self.sy = self.alpha * y + (1.0 - self.alpha) * self.sy
        self.lost = 0
        if landmarks is not None:
            self.last_landmarks = landmarks

    def refresh_side(self, margin: float, dwell: int) -> None:
        if self.side == "left":
            flip_to = "right" if self.sx > HALF + margin else None
        else:
            flip_to = "left" if self.sx < HALF - margin else None

        if flip_to is None:
            self._pending_side = None
            self._pending_frames = 0
            return

        if self._pending_side == flip_to:
            self._pending_frames += 1
        else:
            self._pending_side = flip_to
            self._pending_frames = 1

        if self._pending_frames >= dwell:
            self.side = flip_to
            self._pending_side = None
            self._pending_frames = 0


class HandTracker:
    def __init__(
        self,
        smoothing_alpha: float = 0.5,
        max_tracks: int = 2,
        match_distance: float = 0.3,
        max_lost: int = 8,
        side_margin: float = 0.15,
        side_dwell: int = 10,
    ):
        self._alpha = smoothing_alpha
        self._max_tracks = max_tracks
        self._match_distance = match_distance
        self._max_lost = max_lost
        self._side_margin = side_margin
        self._side_dwell = side_dwell
        self._tracks: list[HandTrack] = []
        self._next_id = 0

    @property
    def tracks(self) -> list[HandTrack]:
        return self._tracks

    def reset(self) -> None:
        self._tracks.clear()

    def update(self, detected: list[tuple[float, float, object]]) -> None:
        used: set[int] = set()

        for x, y, landmarks in detected:
            best = -1
            best_d = self._match_distance
            for i, t in enumerate(self._tracks):
                if i in used:
                    continue
                d = math.hypot(t.sx - x, t.sy - y)
                if d < best_d:
                    best_d = d
                    best = i
            if best >= 0:
                self._tracks[best].update(x, y, landmarks)
                used.add(best)
            elif len(self._tracks) < self._max_tracks:
                track = HandTrack(self._next_id, x, y, self._alpha, landmarks)
                self._next_id += 1
                self._tracks.append(track)
                used.add(len(self._tracks) - 1)

        for i, t in enumerate(self._tracks):
            if i not in used:
                t.lost += 1

        self._tracks = [
            t for i, t in enumerate(self._tracks) if i in used or t.lost < self._max_lost
        ]

        for t in self._tracks:
            t.refresh_side(self._side_margin, self._side_dwell)
