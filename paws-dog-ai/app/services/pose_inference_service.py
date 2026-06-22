import importlib
import inspect
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.config import settings
from app.models.pose_models import Keypoint, PoseFrame, PoseSequence
from app.services.dependency_service import dependency_report
from app.services.supabase_service import download_storage_object
from app.services.video_validation_service import VideoValidationService
from app.utils.confidence import combine_confidence


KEYPOINT_ALIASES = {
    # superanimal_quadruped uses "thai" (thigh) for the upper leg joint —
    # closest proxy for shoulder / hip in sit detection.
    "nose": ["nose", "snout"],
    "left_shoulder": [
        "left_shoulder", "l_shoulder", "front_left_shoulder",
        "front_left_thai",   # superanimal_quadruped
        "neck_base",         # fallback: neck base is near shoulder girdle
    ],
    "right_shoulder": [
        "right_shoulder", "r_shoulder", "front_right_shoulder",
        "front_right_thai",  # superanimal_quadruped
    ],
    "left_hip": [
        "left_hip", "l_hip", "rear_left_hip",
        "back_left_thai",    # superanimal_quadruped
    ],
    "right_hip": [
        "right_hip", "r_hip", "rear_right_hip",
        "back_right_thai",   # superanimal_quadruped
    ],
    "tail_base": ["tail_base", "tailbase", "base_tail"],
    "left_front_paw": [
        "left_front_paw", "front_left_paw", "left_forepaw",
        # superanimal_quadruped name already in list above
    ],
    "right_front_paw": [
        "right_front_paw", "front_right_paw", "right_forepaw",
    ],
    "left_hind_paw": [
        "left_hind_paw", "rear_left_paw", "left_rearpaw",
        "back_left_paw",     # superanimal_quadruped
    ],
    "right_hind_paw": [
        "right_hind_paw", "rear_right_paw", "right_rearpaw",
        "back_right_paw",    # superanimal_quadruped
    ],
}


class PoseInferenceService:
    bucket_name = "dog-activity-videos"

    def analyze_video(self, storage_path: str) -> PoseSequence:
        existing = Path(storage_path)
        if existing.is_file():
            # Path is already a local file (e.g. written by /dev/infer before
            # calling this method). Skip the Supabase download entirely.
            return self._analyze_local(existing)
        with tempfile.TemporaryDirectory(prefix="paws-dog-ai-") as tmpdir:
            local_path = Path(tmpdir) / Path(storage_path).name
            local_path.write_bytes(download_storage_object(self.bucket_name, storage_path))
            return self._analyze_local(local_path)

    def _analyze_local(self, local_path: Path) -> PoseSequence:
        dependencies = dependency_report()
        model_name = f"{settings.superanimal_name}_{settings.model_name}"

        # Preprocess first (resize + downsample) so the duration check runs on
        # the clipped video, not the raw upload which may exceed the limit.
        processed_path = local_path.with_name(local_path.stem + "_proc.mp4")
        self._preprocess_video(local_path, processed_path)
        work_path = processed_path if processed_path.exists() else local_path

        metadata = VideoValidationService().extract_metadata(str(work_path))

        if not dependencies["pose_dependencies_ready"]:
            return PoseSequence(
                model_name=model_name,
                metadata=metadata,
                frames=[],
                average_confidence=0,
                required_keypoint_visibility_ratio=0,
                dog_frame_coverage_ratio=0,
                inference_available=False,
                inference_error="DeepLabCut and PyTorch are not installed. Run `pip install -r requirements-ai.txt`.",
            )

        try:
            raw_frames, processed_path = self._run_deeplabcut_on(work_path)
        except Exception as error:
            return PoseSequence(
                model_name=model_name,
                metadata=metadata,
                frames=[],
                average_confidence=0,
                required_keypoint_visibility_ratio=0,
                dog_frame_coverage_ratio=0,
                inference_available=False,
                inference_error=f"DeepLabCut inference failed: {error}",
            )

        frames = self._normalize_frames(raw_frames, metadata.fps or settings.inference_target_fps)
        confidence_scores = [
            keypoint.confidence
            for frame in frames
            for keypoint in frame.keypoints.values()
            if keypoint.confidence is not None
        ]
        dog_frame_coverage_ratio = self._calculate_dog_coverage(frames, metadata.width, metadata.height)
        preview_frames = self._render_skeleton_previews(processed_path, frames, n=6)

        return PoseSequence(
            model_name=model_name,
            metadata=metadata,
            frames=frames,
            average_confidence=combine_confidence(confidence_scores),
            required_keypoint_visibility_ratio=self._required_visibility(frames),
            dog_frame_coverage_ratio=dog_frame_coverage_ratio,
            multiple_dogs_detected=any(frame.dog_count > 1 for frame in frames),
            preview_frames=preview_frames,
        )

    # ------------------------------------------------------------------
    # Video pre-processing
    # ------------------------------------------------------------------

    def _preprocess_video(self, src: Path, dest: Path) -> None:
        """
        Resize + downsample a video before sending it to DeepLabCut.

        Target:
          - Long edge <= inference_max_long_edge px  (4K -> 720p ~5x speedup)
          - fps        <= inference_target_fps        (60fps -> 15fps ~4x speedup)

        Combined: up to ~20x fewer pixels × frames to process.
        The classifier keypoints are expressed as ratios of frame dimensions,
        so resizing does not affect sit-detection accuracy.
        """
        cap = cv2.VideoCapture(str(src))
        src_fps   = cap.get(cv2.CAP_PROP_FPS) or 30.0
        src_w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Compute output resolution keeping aspect ratio.
        long_edge = max(src_w, src_h)
        scale = min(1.0, settings.inference_max_long_edge / long_edge)
        out_w = int(src_w * scale) & ~1   # ensure even for codec
        out_h = int(src_h * scale) & ~1

        # Frame-skip ratio so output fps <= target.
        keep_every = max(1, int(round(src_fps / settings.inference_target_fps)))
        out_fps    = src_fps / keep_every

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(dest), fourcc, out_fps, (out_w, out_h))

        frame_idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % keep_every == 0:
                if scale < 1.0:
                    frame = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
                writer.write(frame)
            frame_idx += 1

        cap.release()
        writer.release()

    # ------------------------------------------------------------------
    # DeepLabCut inference
    # ------------------------------------------------------------------

    def _run_deeplabcut_on(self, processed_path: Path) -> tuple[list[dict[str, Any]], Path]:
        """Run DLC on an already-preprocessed video. Returns (raw_frames, processed_path)."""
        import torch  # noqa: PLC0415

        deeplabcut = importlib.import_module("deeplabcut")
        superanimal_method = getattr(deeplabcut, "video_inference_superanimal", None)

        if superanimal_method is None:
            available = {name for name, _ in inspect.getmembers(deeplabcut)}
            raise RuntimeError(
                "Installed DeepLabCut does not expose video_inference_superanimal. "
                f"Available top-level API includes: {', '.join(sorted(list(available))[:25])}"
            )

        local_path = processed_path  # alias for readability below
        # Pick the fastest available device: MPS (Apple Silicon) > CUDA > CPU.
        if torch.backends.mps.is_available():
            device = "mps"
        elif torch.cuda.is_available():
            device = "cuda"
        else:
            device = "cpu"

        signature = inspect.signature(superanimal_method)
        kwargs = {
            "videos": [str(processed_path)],
            "superanimal_name": settings.superanimal_name,
            "model_name": settings.model_name,
            "detector_name": settings.detector_name,
            "video_adapt": settings.video_adapt,           # False
            "create_labeled_video": False,                  # skip MP4 overlay
            "plot_trajectories": False,
            "batch_size": settings.inference_pose_batch_size,
            "detector_batch_size": settings.inference_detector_batch_size,
            "max_individuals": 1,                           # only 1 dog — ~10x fewer bbox slots
            "device": device,
        }
        supported_kwargs = {k: v for k, v in kwargs.items() if k in signature.parameters}
        result = superanimal_method(**supported_kwargs)
        return self._parse_deeplabcut_result(result, processed_path), processed_path

    def _parse_deeplabcut_result(self, result: Any, video_path: Path) -> list[dict[str, Any]]:
        """
        Convert whatever video_inference_superanimal returns into the internal
        list-of-frame dicts that _normalize_frames() expects.

        DeepLabCut 3.x returns a dict keyed by video path whose value is
        a pandas DataFrame (or path to an H5 file).  We handle both forms.
        """
        import pandas as pd  # noqa: PLC0415

        df: pd.DataFrame | None = None

        # ---- unwrap the result dict ----------------------------------------
        if isinstance(result, dict):
            # Key is typically the video path string or stem
            for key in (str(video_path), video_path.stem, video_path.name):
                if key in result:
                    df = result[key]
                    break
            if df is None and result:
                df = next(iter(result.values()))

        if isinstance(df, str):
            # It's a path to an H5 file
            df = pd.read_hdf(df)
        elif isinstance(df, Path):
            df = pd.read_hdf(str(df))

        # ---- try to load from the H5 file DLC wrote next to the video ------
        if df is None:
            stem = video_path.stem
            parent = video_path.parent
            candidates = sorted(parent.glob(f"{stem}*.h5"))
            # Prefer the adapted (snapshot-*) file if it exists
            adapted = [p for p in candidates if "snapshot" in p.name]
            h5_path = adapted[-1] if adapted else (candidates[-1] if candidates else None)
            if h5_path:
                df = pd.read_hdf(str(h5_path))

        if df is None:
            raise RuntimeError(
                "DeepLabCut ran but no keypoint data could be extracted. "
                f"Return type was {type(result).__name__}."
            )

        # ---- flatten MultiIndex DataFrame → list of frame dicts -------------
        # DLC SuperAnimal uses a 4-level MultiIndex:
        #   (scorer, individuals, bodyparts, coords)
        # with up to max_individuals slots per frame.  Empty slots are filled
        # with -1.  We pick the individual with the highest mean likelihood
        # per frame so single-dog videos always get clean keypoints.
        frames: list[dict[str, Any]] = []
        depth = df.columns.nlevels if isinstance(df.columns, pd.MultiIndex) else 0

        for row_idx in range(len(df)):
            row = df.iloc[row_idx]

            if depth >= 4:
                # Group by individual, then pick best.
                individuals: dict[str, dict[str, dict[str, float]]] = {}
                for (scorer, individual, bodypart, coord), val in row.items():
                    fval = float(val) if (val == val and val != -1) else None
                    individuals.setdefault(individual, {}).setdefault(bodypart, {})[coord] = fval

                # Score each individual by mean likelihood of non-None keypoints.
                def _score(ind_kps: dict) -> float:
                    likelihoods = [
                        c.get("likelihood") for c in ind_kps.values()
                        if c.get("likelihood") is not None
                    ]
                    return sum(likelihoods) / len(likelihoods) if likelihoods else -1.0

                best_ind = max(individuals, key=lambda k: _score(individuals[k]))
                raw_kps = individuals[best_ind]

            elif depth == 3:
                raw_kps = {}
                for (scorer, bodypart, coord), val in row.items():
                    fval = float(val) if (val == val and val != -1) else None
                    raw_kps.setdefault(bodypart, {})[coord] = fval
            else:
                raw_kps = {}
                for col, val in row.items():
                    if "_" in str(col):
                        parts = str(col).rsplit("_", 1)
                        bodypart, coord = parts[0], parts[1]
                        fval = float(val) if (val == val and val != -1) else None
                        raw_kps.setdefault(bodypart, {})[coord] = fval

            # Normalise to {x, y, confidence}, replacing None with 0.
            normalised: dict[str, dict[str, float]] = {}
            for bp, coords in raw_kps.items():
                x   = coords.get("x")   or coords.get("X")
                y   = coords.get("y")   or coords.get("Y")
                lh  = coords.get("likelihood") or coords.get("p")
                normalised[bp] = {
                    "x":          x  if x  is not None else 0.0,
                    "y":          y  if y  is not None else 0.0,
                    "confidence": lh if lh is not None else 0.0,
                }

            frames.append({"keypoints": normalised, "dog_count": 1})

        return frames

    def _normalize_frames(self, raw_frames: list[dict[str, Any]], fps: float) -> list[PoseFrame]:
        normalized: list[PoseFrame] = []
        for index, raw_frame in enumerate(raw_frames):
            keypoints: dict[str, Keypoint] = {}
            raw_keypoints = raw_frame.get("keypoints", {})
            for canonical_name, aliases in KEYPOINT_ALIASES.items():
                source = next((raw_keypoints.get(alias) for alias in aliases if alias in raw_keypoints), None)
                if source is None:
                    keypoints[canonical_name] = Keypoint(name=canonical_name, x=None, y=None, confidence=0)
                    continue
                keypoints[canonical_name] = Keypoint(
                    name=canonical_name,
                    x=source.get("x"),
                    y=source.get("y"),
                    confidence=float(source.get("confidence", source.get("likelihood", 0)) or 0),
                )
            normalized.append(
                PoseFrame(
                    frame_index=index,
                    timestamp_ms=int(index / fps * 1000),
                    keypoints=keypoints,
                    dog_count=int(raw_frame.get("dog_count", 1)),
                )
            )
        return normalized

    def _required_visibility(self, frames: list[PoseFrame]) -> float:
        required = ["left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_front_paw", "right_front_paw"]
        if not frames:
            return 0.0
        visible = 0
        total = len(frames) * len(required)
        for frame in frames:
            visible += len([name for name in required if frame.keypoints.get(name) and frame.keypoints[name].confidence >= settings.min_average_keypoint_confidence])
        return visible / total if total else 0.0

    def _calculate_dog_coverage(self, frames: list[PoseFrame], width: int, height: int) -> float:
        if not frames or width <= 0 or height <= 0:
            return 0.0
        coverages: list[float] = []
        for frame in frames:
            points = [(kp.x, kp.y) for kp in frame.keypoints.values() if kp.x is not None and kp.y is not None and kp.confidence >= 0.3]
            if len(points) < 4:
                continue
            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            coverages.append(((max(xs) - min(xs)) * (max(ys) - min(ys))) / (width * height))
        return combine_confidence(coverages)

    # ------------------------------------------------------------------
    # Skeleton preview renderer
    # ------------------------------------------------------------------

    # Skeleton edges: pairs of canonical keypoint names to draw lines between.
    _SKELETON = [
        ("nose",         "left_shoulder"),
        ("nose",         "right_shoulder"),
        ("left_shoulder","right_shoulder"),
        ("left_shoulder","left_hip"),
        ("right_shoulder","right_hip"),
        ("left_hip",     "right_hip"),
        ("left_hip",     "left_hind_paw"),
        ("right_hip",    "right_hind_paw"),
        ("left_shoulder","left_front_paw"),
        ("right_shoulder","right_front_paw"),
        ("left_hip",     "tail_base"),
        ("right_hip",    "tail_base"),
    ]
    _KP_COLOR   = (0, 255, 120)   # green dots
    _EDGE_COLOR = (255, 200, 0)   # yellow lines
    _LOW_COLOR  = (80, 80, 255)   # red-ish for low-confidence points

    def _render_skeleton_previews(
        self,
        video_path: Path,
        pose_frames: list[PoseFrame],
        n: int = 6,
    ) -> list[str]:
        """
        Extract n evenly-spaced frames from video_path, draw the detected
        skeleton on each, and return a list of base64-encoded JPEG strings.
        Returns an empty list silently if anything fails.
        """
        import base64  # noqa: PLC0415

        if not pose_frames or not video_path.exists():
            return []

        try:
            cap = cv2.VideoCapture(str(video_path))
            total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

            # Pick n evenly-spaced pose-frame indices.
            step = max(1, len(pose_frames) // n)
            chosen_pose_indices = list(range(0, len(pose_frames), step))[:n]

            # Map pose-frame index → video frame index (may differ if DLC
            # subsampled or the video was already downsampled).
            scale = total_video_frames / len(pose_frames)

            previews: list[str] = []
            for pi in chosen_pose_indices:
                video_fi = int(pi * scale)
                cap.set(cv2.CAP_PROP_POS_FRAMES, video_fi)
                ok, img = cap.read()
                if not ok:
                    continue

                h, w = img.shape[:2]
                pf = pose_frames[pi]

                # Draw skeleton edges first (behind dots).
                for kp_a, kp_b in self._SKELETON:
                    a = pf.keypoints.get(kp_a)
                    b = pf.keypoints.get(kp_b)
                    if (a and b and a.x and b.x
                            and a.confidence >= 0.3 and b.confidence >= 0.3):
                        pt1 = (int(a.x), int(a.y))
                        pt2 = (int(b.x), int(b.y))
                        cv2.line(img, pt1, pt2, self._EDGE_COLOR, thickness=2, lineType=cv2.LINE_AA)

                # Draw keypoint dots with confidence label.
                for name, kp in pf.keypoints.items():
                    if kp.x is None or kp.y is None or kp.confidence <= 0:
                        continue
                    pt = (int(kp.x), int(kp.y))
                    color = self._KP_COLOR if kp.confidence >= 0.5 else self._LOW_COLOR
                    radius = max(4, int(w * 0.008))
                    cv2.circle(img, pt, radius, color, -1, lineType=cv2.LINE_AA)

                # Timestamp and per-frame confidence overlay.
                ts_sec = pf.timestamp_ms / 1000
                mean_conf = sum(
                    kp.confidence for kp in pf.keypoints.values()
                    if kp.confidence is not None
                ) / max(len(pf.keypoints), 1)
                label = f"t={ts_sec:.2f}s  conf={mean_conf:.0%}"
                cv2.putText(img, label, (10, 28), cv2.FONT_HERSHEY_SIMPLEX,
                            0.7, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.putText(img, label, (10, 28), cv2.FONT_HERSHEY_SIMPLEX,
                            0.7, (0, 0, 0), 1, cv2.LINE_AA)

                # Encode to JPEG, resize to max 480px wide to keep payload small.
                if w > 480:
                    scale_down = 480 / w
                    img = cv2.resize(img, (480, int(h * scale_down)), interpolation=cv2.INTER_AREA)
                _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 75])
                previews.append(base64.b64encode(buf).decode())

            cap.release()
            return previews

        except Exception:  # noqa: BLE001
            return []
