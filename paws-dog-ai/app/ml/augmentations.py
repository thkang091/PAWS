"""
Training augmentations for pose sequences.

All functions operate on numpy arrays of shape (seq_len, feature_dim).
They are deterministic given a numpy random Generator, making augmented
training runs reproducible.

The feature layout matches preprocessing.py:
  columns 0..29   : x, y, confidence for each of 10 joints (3 cols per joint)
  columns 30..39  : visibility mask (one col per joint)
  columns 40..59  : motion features (dx, dy per joint) — present only for TBT

Left-right joint pairs in KEYPOINT_ORDER:
  left_shoulder (1) ↔ right_shoulder (2)
  left_hip      (3) ↔ right_hip      (4)
  left_front_paw(6) ↔ right_front_paw(7)
  left_hind_paw (8) ↔ right_hind_paw (9)
  nose (0) and tail_base (5) are midline — no swap needed.
"""

from __future__ import annotations

import numpy as np
from app.ml.preprocessing import FEATURES_PER_KP, FRAME_DIM, N_KEYPOINTS

# Joint pairs that must be swapped on a horizontal mirror.
_MIRROR_PAIRS: list[tuple[int, int]] = [
    (1, 2),   # left_shoulder ↔ right_shoulder
    (3, 4),   # left_hip      ↔ right_hip
    (6, 7),   # left_front_paw ↔ right_front_paw
    (8, 9),   # left_hind_paw  ↔ right_hind_paw
]


def _swap_joints(arr: np.ndarray, i: int, j: int) -> np.ndarray:
    """Swap columns for joint i and joint j in the feature array."""
    # Each joint occupies FEATURES_PER_KP columns (x, y, conf) in the coord block,
    # one column in the visibility block, and optionally 2 columns in the motion block.
    arr = arr.copy()
    T, D = arr.shape

    # Coord block
    bi, bj = i * FEATURES_PER_KP, j * FEATURES_PER_KP
    arr[:, bi: bi + FEATURES_PER_KP], arr[:, bj: bj + FEATURES_PER_KP] = (
        arr[:, bj: bj + FEATURES_PER_KP].copy(),
        arr[:, bi: bi + FEATURES_PER_KP].copy(),
    )

    # Visibility block
    vis_base = N_KEYPOINTS * FEATURES_PER_KP   # 30
    vi, vj = vis_base + i, vis_base + j
    arr[:, vi], arr[:, vj] = arr[:, vj].copy(), arr[:, vi].copy()

    # Motion block (if present — TBT input dim > FRAME_DIM)
    motion_base = FRAME_DIM   # 40
    if D > motion_base:
        mi_x, mj_x = motion_base + i * 2,     motion_base + j * 2
        mi_y, mj_y = motion_base + i * 2 + 1, motion_base + j * 2 + 1
        arr[:, mi_x], arr[:, mj_x] = arr[:, mj_x].copy(), arr[:, mi_x].copy()
        arr[:, mi_y], arr[:, mj_y] = arr[:, mj_y].copy(), arr[:, mi_y].copy()

    return arr


# ---------------------------------------------------------------------------
# 1. Horizontal mirroring
# ---------------------------------------------------------------------------

def horizontal_mirror(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    p: float = 0.5,
) -> np.ndarray:
    """
    Flip the pose left-right with probability p.

    Negates normalized x-coordinates and swaps left-right joint columns.
    Motion velocity dx values are also negated (vy is unchanged).
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p:
        return features

    arr = features.copy()
    T, D = arr.shape

    # Negate all x columns in the coord block (columns 0, 3, 6, ..., 27).
    for kp_idx in range(N_KEYPOINTS):
        x_col = kp_idx * FEATURES_PER_KP
        arr[:, x_col] = -arr[:, x_col]

    # Negate dx columns in motion block.
    motion_base = FRAME_DIM
    if D > motion_base:
        for kp_idx in range(N_KEYPOINTS):
            dx_col = motion_base + kp_idx * 2
            arr[:, dx_col] = -arr[:, dx_col]

    # Swap left-right joint pairs.
    for li, ri in _MIRROR_PAIRS:
        arr = _swap_joints(arr, li, ri)

    return arr


# ---------------------------------------------------------------------------
# 2. Keypoint noise
# ---------------------------------------------------------------------------

def add_keypoint_noise(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    std: float = 0.02,
    p: float = 0.5,
) -> np.ndarray:
    """
    Add small Gaussian noise to x, y coordinates of visible joints.

    Only affects normalized coordinate columns, not confidence or visibility.
    Noise magnitude is scaled relative to body-centered coordinates where
    shoulder-to-hip distance ≈ 1.0, so std=0.02 ≈ 2% of body length.
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p:
        return features

    arr = features.copy()
    vis = arr[:, N_KEYPOINTS * FEATURES_PER_KP: N_KEYPOINTS * FEATURES_PER_KP + N_KEYPOINTS]

    for kp_idx in range(N_KEYPOINTS):
        mask = vis[:, kp_idx] > 0   # only add noise to visible joints
        if not np.any(mask):
            continue
        x_col = kp_idx * FEATURES_PER_KP
        y_col = x_col + 1
        n = int(mask.sum())
        arr[mask, x_col] += rng.normal(0, std, n).astype(np.float32)
        arr[mask, y_col] += rng.normal(0, std, n).astype(np.float32)

    return arr


# ---------------------------------------------------------------------------
# 3. Random joint dropout
# ---------------------------------------------------------------------------

def random_joint_dropout(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    p_per_joint: float = 0.10,
    p_apply: float = 0.5,
) -> np.ndarray:
    """
    Randomly zero out entire joints (all frames) to simulate occlusion.

    Each joint is dropped independently with probability p_per_joint.
    The overall augmentation is applied with probability p_apply.
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p_apply:
        return features

    arr = features.copy()
    vis_base = N_KEYPOINTS * FEATURES_PER_KP   # 30

    for kp_idx in range(N_KEYPOINTS):
        if rng.random() < p_per_joint:
            # Zero out x, y, conf
            base = kp_idx * FEATURES_PER_KP
            arr[:, base: base + FEATURES_PER_KP] = 0.0
            # Zero visibility
            arr[:, vis_base + kp_idx] = 0.0
            # Zero motion if present
            motion_base = FRAME_DIM
            if arr.shape[1] > motion_base:
                arr[:, motion_base + kp_idx * 2] = 0.0
                arr[:, motion_base + kp_idx * 2 + 1] = 0.0

    return arr


# ---------------------------------------------------------------------------
# 4. Temporal speed variation
# ---------------------------------------------------------------------------

def temporal_speed_variation(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    speed_range: tuple[float, float] = (0.75, 1.25),
    p: float = 0.5,
) -> np.ndarray:
    """
    Resample the sequence at a random temporal speed factor in speed_range.

    Speed < 1.0 → sequence is stretched (slower motion, more repetition).
    Speed > 1.0 → sequence is compressed (faster motion, shorter).
    Output is re-padded / truncated to the original seq_len.
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p:
        return features

    T, D = features.shape
    speed = float(rng.uniform(*speed_range))

    # New length before resampling to original T.
    new_T = max(2, int(round(T / speed)))
    old_times = np.linspace(0, T - 1, T)
    new_times = np.linspace(0, T - 1, new_T)

    resampled = np.stack(
        [np.interp(new_times, old_times, features[:, d]) for d in range(D)],
        axis=1,
    ).astype(np.float32)

    # Re-pad or centre-crop to original T.
    if new_T >= T:
        start = (new_T - T) // 2
        return resampled[start: start + T]

    pad = np.zeros((T - new_T, D), dtype=np.float32)
    return np.concatenate([resampled, pad], axis=0)


# ---------------------------------------------------------------------------
# 5. Small sequence crop
# ---------------------------------------------------------------------------

def small_sequence_crop(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    min_ratio: float = 0.85,
    p: float = 0.5,
) -> np.ndarray:
    """
    Take a random contiguous crop of min_ratio × seq_len frames,
    then zero-pad back to seq_len.

    This simulates recording start/end jitter and teaches the model
    to be robust to incomplete sequence boundaries.
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p:
        return features

    T, D = features.shape
    crop_len = max(2, int(round(T * float(rng.uniform(min_ratio, 1.0)))))
    max_start = T - crop_len
    start = int(rng.integers(0, max(1, max_start + 1)))

    cropped = features[start: start + crop_len].copy()

    pad = np.zeros((T - crop_len, D), dtype=np.float32)
    return np.concatenate([cropped, pad], axis=0)


# ---------------------------------------------------------------------------
# 6. Missing frame simulation
# ---------------------------------------------------------------------------

def missing_frame_simulation(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    p_per_frame: float = 0.05,
    p_apply: float = 0.5,
) -> np.ndarray:
    """
    Randomly zero out individual frames to simulate dropped pose detections.

    Each frame is independently zeroed with probability p_per_frame.
    This makes the model robust to occasional pose inference failures.
    """
    if rng is None:
        rng = np.random.default_rng()
    if rng.random() >= p_apply:
        return features

    arr = features.copy()
    T = arr.shape[0]
    mask = rng.random(T) < p_per_frame
    arr[mask] = 0.0
    return arr


# ---------------------------------------------------------------------------
# Composed pipeline
# ---------------------------------------------------------------------------

def apply_augmentations(
    features: np.ndarray,
    rng: np.random.Generator | None = None,
    mirror: bool = True,
    noise: bool = True,
    dropout: bool = True,
    speed: bool = True,
    crop: bool = True,
    missing: bool = True,
) -> np.ndarray:
    """
    Apply all augmentations in sequence.  Each augmentation has its own
    probability gate so the effective augmentation rate is lower.

    Intended for the training DataLoader worker — called inside __getitem__
    after preprocessing so it operates on the final float32 array.
    """
    if rng is None:
        rng = np.random.default_rng()

    if mirror:
        features = horizontal_mirror(features, rng)
    if noise:
        features = add_keypoint_noise(features, rng)
    if dropout:
        features = random_joint_dropout(features, rng)
    if speed:
        features = temporal_speed_variation(features, rng)
    if crop:
        features = small_sequence_crop(features, rng)
    if missing:
        features = missing_frame_simulation(features, rng)

    return features
