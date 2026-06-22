"""
Segment decoder: convert per-frame TBT predictions into trick segments.

Pipeline
--------
1. Softmax frame_trick_logits (T, n_classes) -> probabilities.
2. argmax per frame -> raw label sequence (T,).
3. Mode-filter with a sliding window of `smooth_window_frames` to suppress
   single-frame noise without merging adjacent distinct tricks.
4. Run-length encode the smoothed sequence -> [(label, start_frame, end_frame)].
5. Drop no_action (label 0) segments.
6. Drop segments whose duration in ms is below `min_segment_duration_ms`.
7. For each surviving segment compute:
   - mean softmax confidence from step 1
   - start_ms and end_ms from timestamps_ms (or estimated from fps)
8. Return list[TrickSegment].

Usage
-----
  from app.ml.segment_decoder import SegmentDecoderConfig, decode_segments
  import numpy as np

  # frame_logits: (T, n_classes)  numpy float32
  # timestamps_ms: list[int] of length T  (one per frame)
  config = SegmentDecoderConfig(smooth_window_frames=5, min_segment_duration_ms=300)
  segments = decode_segments(frame_logits, timestamps_ms, config)
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.ml.pose_dataset import TRICK_LABEL_MAP_INV
from app.models.combo_models import TrickSegment


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class SegmentDecoderConfig:
    """
    Hyperparameters for the segment decoder.

    smooth_window_frames    -- mode-filter half-width; odd window = 2*hw+1 frames.
                               Set to 0 or 1 to disable smoothing.
    min_segment_duration_ms -- segments shorter than this are discarded as noise.
                               Should be <= the shortest valid trick execution time.
    no_action_label         -- class index treated as background (not returned as a segment).
    """
    smooth_window_frames: int = 5
    min_segment_duration_ms: int = 300
    no_action_label: int = 0


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def decode_segments(
    frame_trick_logits: np.ndarray,
    timestamps_ms: list[int],
    config: SegmentDecoderConfig | None = None,
) -> list[TrickSegment]:
    """
    Decode per-frame logits into a list of contiguous TrickSegments.

    Args:
        frame_trick_logits: (T, n_classes) float32 raw logits.
        timestamps_ms:      list of T integer timestamps (one per frame).
                            Must have the same length as the time axis.
        config:             decoder hyper-parameters.  Uses defaults if None.

    Returns:
        List of TrickSegment sorted by start_ms.  Empty list if no non-noise
        trick activity is detected.
    """
    if config is None:
        config = SegmentDecoderConfig()

    T = frame_trick_logits.shape[0]
    if T == 0 or len(timestamps_ms) == 0:
        return []

    # Align lengths (guard against mismatched inputs).
    n = min(T, len(timestamps_ms))
    logits = frame_trick_logits[:n]
    ts = list(timestamps_ms[:n])

    # 1. Softmax -> probabilities.
    probs = _softmax(logits)  # (n, n_classes)

    # 2. Raw per-frame label.
    raw_labels = probs.argmax(axis=1)  # (n,)

    # 3. Mode-filter smoothing.
    smoothed = _mode_filter(raw_labels, config.smooth_window_frames)

    # 4. Run-length encode.
    runs = _run_length_encode(smoothed)

    # 5-8. Filter and build TrickSegment objects.
    segments: list[TrickSegment] = []
    for label, start_f, end_f in runs:
        # 5. Skip background.
        if label == config.no_action_label:
            continue

        # Time bounds.
        start_ms = ts[start_f]
        # end_f is inclusive last frame; use next frame's timestamp if available.
        end_ms = ts[end_f + 1] if (end_f + 1) < n else ts[end_f]

        # 6. Minimum duration filter.
        duration_ms = end_ms - start_ms
        if duration_ms < config.min_segment_duration_ms:
            continue

        # 7. Mean confidence across the segment.
        seg_probs = probs[start_f : end_f + 1, label]
        mean_conf = float(seg_probs.mean())

        slug = TRICK_LABEL_MAP_INV.get(int(label), "no_action")

        segments.append(TrickSegment(
            trick_slug=slug,
            start_ms=start_ms,
            end_ms=end_ms,
            confidence=round(mean_conf, 4),
            frame_count=end_f - start_f + 1,
        ))

    return segments


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _softmax(logits: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over the last axis."""
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def _mode_filter(labels: np.ndarray, window: int) -> np.ndarray:
    """
    Sliding mode filter over a 1-D integer label array.

    For each position i, the output is the mode of the window
    [max(0, i-hw), min(T, i+hw+1)] where hw = window // 2.

    When window <= 1 the input is returned unchanged (no smoothing).
    """
    if window <= 1 or len(labels) == 0:
        return labels.copy()

    hw = window // 2
    T = len(labels)
    smoothed = np.empty(T, dtype=labels.dtype)

    for i in range(T):
        lo = max(0, i - hw)
        hi = min(T, i + hw + 1)
        window_vals = labels[lo:hi]
        # numpy mode equivalent: argmax of bincount.
        counts = np.bincount(window_vals)
        smoothed[i] = counts.argmax()

    return smoothed


def _run_length_encode(labels: np.ndarray) -> list[tuple[int, int, int]]:
    """
    Run-length encode a 1-D integer array.

    Returns list of (value, start_index, end_index) where end_index is
    the last index (inclusive) of each run.
    """
    if len(labels) == 0:
        return []

    runs: list[tuple[int, int, int]] = []
    start = 0
    current = labels[0]

    for i in range(1, len(labels)):
        if labels[i] != current:
            runs.append((int(current), start, i - 1))
            start = i
            current = labels[i]

    runs.append((int(current), start, len(labels) - 1))
    return runs
