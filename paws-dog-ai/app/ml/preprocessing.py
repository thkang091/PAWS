"""
Pose sequence preprocessing for learned sit classification.

Pure numpy — importable without torch. All preprocessing is deterministic
given the same PreprocessConfig.

Stored frame format (from the export pipeline):
  {
    "frame_index": int,
    "timestamp_ms": int,
    "keypoints": {
      "<name>": {"x": float | null, "y": float | null, "confidence": float}
    },
    "confidence": float  # per-frame average
  }

Output per frame (FRAME_DIM = 40):
  [x_norm_0, y_norm_0, conf_0, ..., x_norm_9, y_norm_9, conf_9,   # 30
   vis_0, ..., vis_9]                                                # 10

Coordinates are body-centered and scale-normalized. Invisible joints
are zeroed (x=0, y=0) and marked vis=0 in the mask.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

# Canonical keypoint order. Index into this list = column position in feature vector.
KEYPOINT_ORDER: list[str] = [
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "tail_base",
    "left_front_paw",
    "right_front_paw",
    "left_hind_paw",
    "right_hind_paw",
]
N_KEYPOINTS: int = len(KEYPOINT_ORDER)       # 10
FEATURES_PER_KP: int = 3                     # x_norm, y_norm, confidence
FRAME_DIM: int = N_KEYPOINTS * FEATURES_PER_KP + N_KEYPOINTS   # 40

# Joints used to define body center and scale.
_CENTER_JOINTS = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
_SHOULDER_JOINTS = ["left_shoulder", "right_shoulder"]
_HIP_JOINTS = ["left_hip", "right_hip"]

_KP_INDEX: dict[str, int] = {name: i for i, name in enumerate(KEYPOINT_ORDER)}


@dataclass
class PreprocessConfig:
    seq_len: int = 60
    confidence_threshold: float = 0.55
    interpolate_gaps: bool = True
    max_interpolation_gap: int = 3

    def to_dict(self) -> dict:
        return {
            "seq_len": self.seq_len,
            "confidence_threshold": self.confidence_threshold,
            "interpolate_gaps": self.interpolate_gaps,
            "max_interpolation_gap": self.max_interpolation_gap,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "PreprocessConfig":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


def preprocess_sequence(
    frames: list[dict],
    config: PreprocessConfig | None = None,
) -> tuple[np.ndarray, dict]:
    """
    Convert a list of stored frame dicts into a fixed-length numpy array.

    Returns:
        features: np.ndarray of shape (seq_len, FRAME_DIM), dtype float32
        meta: dict with normalization diagnostics
    """
    if config is None:
        config = PreprocessConfig()

    if not frames:
        return (
            np.zeros((config.seq_len, FRAME_DIM), dtype=np.float32),
            {"scale": 0.0, "center": [0.0, 0.0], "n_raw_frames": 0, "body_scale_available": False},
        )

    # Sort frames by frame_index in case they are out of order.
    frames = sorted(frames, key=lambda f: f.get("frame_index", 0))

    # 1. Extract raw arrays: (T, N_KEYPOINTS, 3) = [x, y, conf]
    raw_x, raw_y, raw_conf = _extract_raw(frames, config.confidence_threshold)

    # 2. Compute per-frame body center and scale from visible anchor joints.
    centers, scales = _compute_normalization(raw_x, raw_y, raw_conf, config.confidence_threshold)

    # 3. Normalize coordinates.
    x_norm, y_norm = _normalize_coords(raw_x, raw_y, centers, scales)

    # 4. Build visibility mask: 1 if original confidence >= threshold and x was not None.
    vis = (raw_conf >= config.confidence_threshold).astype(np.float32)

    # 5. Zero-out normalized coords for invisible joints.
    x_norm *= vis
    y_norm *= vis

    # 6. Stack into (T, FRAME_DIM).
    T = raw_x.shape[0]
    features = np.zeros((T, FRAME_DIM), dtype=np.float32)
    for kp_idx in range(N_KEYPOINTS):
        base = kp_idx * FEATURES_PER_KP
        features[:, base] = x_norm[:, kp_idx]
        features[:, base + 1] = y_norm[:, kp_idx]
        features[:, base + 2] = raw_conf[:, kp_idx]
    # Visibility mask occupies the last N_KEYPOINTS columns.
    features[:, N_KEYPOINTS * FEATURES_PER_KP:] = vis

    # 7. Interpolate small gaps (per joint, x and y independently).
    if config.interpolate_gaps:
        features = _interpolate_gaps(features, vis, config.max_interpolation_gap)

    # 8. Pad or truncate to seq_len.
    features = _pad_or_truncate(features, config.seq_len)

    meta = {
        "n_raw_frames": T,
        "body_scale_available": bool(np.any(scales > 0)),
        "scale": float(np.median(scales[scales > 0])) if np.any(scales > 0) else 0.0,
        "center": [float(np.median(centers[:, 0])), float(np.median(centers[:, 1]))],
    }
    return features, meta


def aggregate_features(
    frames: list[dict],
    config: PreprocessConfig | None = None,
) -> np.ndarray:
    """
    Compute aggregated (per-sequence) features for the MLP baseline.

    Returns a 1-D array of shape (53,):
      10 joints × 5 stats (mean_x, std_x, mean_y, std_y, mean_conf) = 50
      + 3 global stats (avg_conf, visible_frame_ratio, visible_joint_ratio)
    """
    if config is None:
        config = PreprocessConfig()

    seq, _ = preprocess_sequence(frames, config)
    # seq: (seq_len, FRAME_DIM), visibility in last N_KEYPOINTS cols.

    vis_mask = seq[:, N_KEYPOINTS * FEATURES_PER_KP:]   # (seq_len, 10)
    per_joint_feats = []

    for kp_idx in range(N_KEYPOINTS):
        base = kp_idx * FEATURES_PER_KP
        x_col = seq[:, base]
        y_col = seq[:, base + 1]
        c_col = seq[:, base + 2]
        v_col = vis_mask[:, kp_idx]

        visible_rows = v_col > 0
        if np.any(visible_rows):
            xv, yv, cv = x_col[visible_rows], y_col[visible_rows], c_col[visible_rows]
            per_joint_feats.extend([
                float(xv.mean()),
                float(xv.std() if len(xv) > 1 else 0.0),
                float(yv.mean()),
                float(yv.std() if len(yv) > 1 else 0.0),
                float(cv.mean()),
            ])
        else:
            per_joint_feats.extend([0.0, 0.0, 0.0, 0.0, 0.0])

    avg_conf = float(seq[:, 2::FEATURES_PER_KP].mean()) if len(seq) else 0.0
    visible_frame_ratio = float((vis_mask.sum(axis=1) > 0).mean()) if len(seq) else 0.0
    visible_joint_ratio = float(vis_mask.mean()) if len(seq) else 0.0

    return np.array(per_joint_feats + [avg_conf, visible_frame_ratio, visible_joint_ratio], dtype=np.float32)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _extract_raw(
    frames: list[dict],
    threshold: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns raw_x, raw_y, raw_conf each of shape (T, N_KEYPOINTS)."""
    T = len(frames)
    raw_x = np.zeros((T, N_KEYPOINTS), dtype=np.float32)
    raw_y = np.zeros((T, N_KEYPOINTS), dtype=np.float32)
    raw_conf = np.zeros((T, N_KEYPOINTS), dtype=np.float32)

    for t, frame in enumerate(frames):
        kps = frame.get("keypoints", {})
        for name, kp_idx in _KP_INDEX.items():
            kp = kps.get(name)
            if kp is None:
                continue
            x = kp.get("x")
            y = kp.get("y")
            conf = float(kp.get("confidence", 0.0) or 0.0)
            if x is not None and y is not None:
                raw_x[t, kp_idx] = float(x)
                raw_y[t, kp_idx] = float(y)
                raw_conf[t, kp_idx] = conf

    return raw_x, raw_y, raw_conf


def _compute_normalization(
    raw_x: np.ndarray,
    raw_y: np.ndarray,
    raw_conf: np.ndarray,
    threshold: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Per-frame body center (cx, cy) and scale (shoulder-to-hip distance)."""
    T = raw_x.shape[0]
    centers = np.zeros((T, 2), dtype=np.float32)
    scales = np.zeros(T, dtype=np.float32)

    shoulder_idxs = [_KP_INDEX[n] for n in _SHOULDER_JOINTS]
    hip_idxs = [_KP_INDEX[n] for n in _HIP_JOINTS]
    center_idxs = [_KP_INDEX[n] for n in _CENTER_JOINTS]

    for t in range(T):
        visible_center = [
            idx for idx in center_idxs
            if raw_conf[t, idx] >= threshold
        ]
        if visible_center:
            centers[t, 0] = raw_x[t, visible_center].mean()
            centers[t, 1] = raw_y[t, visible_center].mean()

        vis_shoulders = [i for i in shoulder_idxs if raw_conf[t, i] >= threshold]
        vis_hips = [i for i in hip_idxs if raw_conf[t, i] >= threshold]
        if vis_shoulders and vis_hips:
            sx = raw_x[t, vis_shoulders].mean()
            sy = raw_y[t, vis_shoulders].mean()
            hx = raw_x[t, vis_hips].mean()
            hy = raw_y[t, vis_hips].mean()
            scales[t] = math.sqrt((sx - hx) ** 2 + (sy - hy) ** 2)

    return centers, scales


def _normalize_coords(
    raw_x: np.ndarray,
    raw_y: np.ndarray,
    centers: np.ndarray,
    scales: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    cx = centers[:, 0:1]   # (T, 1)
    cy = centers[:, 1:2]
    s = np.where(scales[:, None] > 0, scales[:, None], 1.0)
    return (raw_x - cx) / s, (raw_y - cy) / s


def _interpolate_gaps(
    features: np.ndarray,
    vis: np.ndarray,
    max_gap: int,
) -> np.ndarray:
    """
    Linear interpolation for short gaps in each coordinate channel.
    Only interpolates if both neighbouring visible frames are within max_gap.
    """
    features = features.copy()
    T = features.shape[0]
    n_coord_cols = N_KEYPOINTS * FEATURES_PER_KP

    for col in range(n_coord_cols):
        kp_idx = col // FEATURES_PER_KP
        feat_type = col % FEATURES_PER_KP   # 2 = confidence, skip interpolation
        if feat_type == 2:
            continue
        v_col = vis[:, kp_idx]

        # Find runs of invisible frames.
        t = 0
        while t < T:
            if v_col[t] == 0:
                # Find end of invisible run.
                end = t
                while end < T and v_col[end] == 0:
                    end += 1
                gap = end - t
                if gap <= max_gap and t > 0 and end < T:
                    v_before = features[t - 1, col]
                    v_after = features[end, col]
                    for i, ti in enumerate(range(t, end)):
                        alpha = (i + 1) / (gap + 1)
                        features[ti, col] = v_before * (1 - alpha) + v_after * alpha
                        # Update visibility mask for interpolated frames.
                        vis_col = N_KEYPOINTS * FEATURES_PER_KP + kp_idx
                        features[ti, vis_col] = 0.5   # partial visibility for interpolated
                t = end
            else:
                t += 1

    return features


def _pad_or_truncate(features: np.ndarray, seq_len: int) -> np.ndarray:
    T = features.shape[0]
    if T >= seq_len:
        # Centre-crop: take the middle seq_len frames.
        start = (T - seq_len) // 2
        return features[start: start + seq_len]
    # Pad with zeros at the end.
    pad = np.zeros((seq_len - T, features.shape[1]), dtype=np.float32)
    return np.concatenate([features, pad], axis=0)


AGG_FEATURE_DIM: int = N_KEYPOINTS * 5 + 3   # 53

# Motion features: per-joint velocity (dx, dy) = 2 values per joint.
MOTION_DIM: int = N_KEYPOINTS * 2            # 20
# Augmented input for TBT = base coords + motion.
TBT_INPUT_DIM: int = FRAME_DIM + MOTION_DIM  # 60


def compute_motion_features(features: np.ndarray) -> np.ndarray:
    """
    Compute per-frame velocity features from a preprocessed pose sequence.

    Args:
        features: shape (seq_len, FRAME_DIM) — output of preprocess_sequence().

    Returns:
        motion: shape (seq_len, MOTION_DIM) — (dx, dy) per joint per frame.
                Frame 0 has all zeros (no previous frame).
                Invisible joints (vis == 0) produce zero velocity.

    The velocity is computed in normalized body-centered coordinates so it is
    scale-invariant.  Only visible joints contribute; if either the current
    or the previous frame has vis == 0 for a joint, the velocity is 0.
    """
    T, _ = features.shape
    motion = np.zeros((T, MOTION_DIM), dtype=np.float32)

    vis = features[:, N_KEYPOINTS * FEATURES_PER_KP:]   # (T, N_KEYPOINTS)

    for kp_idx in range(N_KEYPOINTS):
        x_col = features[:, kp_idx * FEATURES_PER_KP]
        y_col = features[:, kp_idx * FEATURES_PER_KP + 1]
        v_col = vis[:, kp_idx]

        # Velocity is zero at frame 0 and wherever either endpoint is invisible.
        both_vis = (v_col[:-1] > 0) & (v_col[1:] > 0)
        dx = np.zeros(T, dtype=np.float32)
        dy = np.zeros(T, dtype=np.float32)
        dx[1:] = np.where(both_vis, x_col[1:] - x_col[:-1], 0.0)
        dy[1:] = np.where(both_vis, y_col[1:] - y_col[:-1], 0.0)

        motion[:, kp_idx * 2]     = dx
        motion[:, kp_idx * 2 + 1] = dy

    return motion


def build_tbt_features(
    frames: list[dict],
    config: PreprocessConfig | None = None,
) -> np.ndarray:
    """
    Build the full TBT input tensor for a list of stored frame dicts.

    Returns:
        (seq_len, TBT_INPUT_DIM) array — base FRAME_DIM features concatenated
        with MOTION_DIM velocity features.
    """
    base, _ = preprocess_sequence(frames, config)      # (seq_len, FRAME_DIM)
    motion  = compute_motion_features(base)             # (seq_len, MOTION_DIM)
    return np.concatenate([base, motion], axis=1)       # (seq_len, TBT_INPUT_DIM)
