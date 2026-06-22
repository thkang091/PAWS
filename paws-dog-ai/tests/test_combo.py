"""
Tests for the ordered trick-combo system.

Coverage:
  1. Segment decoder  -- smoothing, run-length encoding, duration filter
  2. Combo matcher    -- complete, partial, wrong_order, missing_step, extra_step,
                         low_confidence, failed
  3. Combo vocabulary -- defaults, unknown slug, invalidate_cache
  4. Combo classifier -- unknown combo, inactive combo, no-model path
  5. Integration      -- noisy frame sequence produces correct segments
"""

from __future__ import annotations

import numpy as np
import pytest

from app.ml.combo_matcher import ComboMatchConfig, match_combo
from app.ml.segment_decoder import SegmentDecoderConfig, decode_segments, _mode_filter, _run_length_encode
from app.models.combo_models import TrickComboEntry, TrickSegment
from app.ml.pose_dataset import TRICK_LABEL_MAP


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _logits_for_sequence(
    labels: list[int],
    n_classes: int = 7,
    high_conf_logit: float = 5.0,
) -> np.ndarray:
    """Build (T, n_classes) logits where each frame has a strong prediction."""
    T = len(labels)
    logits = np.full((T, n_classes), -3.0, dtype=np.float32)
    for t, label in enumerate(labels):
        logits[t, label] = high_conf_logit
    return logits


def _timestamps(n: int, fps: float = 30.0) -> list[int]:
    """Generate millisecond timestamps at constant fps."""
    interval = int(1000 / fps)
    return [i * interval for i in range(n)]


def _make_combo(
    slug: str = "sit_then_down",
    sequence: list[str] | None = None,
    min_step_conf: float = 0.65,
    min_combo_score: float = 0.70,
    min_seg_ms: int = 300,
    smooth_window: int = 5,
) -> TrickComboEntry:
    return TrickComboEntry(
        slug=slug,
        display_name=slug.replace("_", " ").title(),
        trick_sequence=sequence or ["sit", "down"],
        active=True,
        difficulty=2,
        min_step_confidence=min_step_conf,
        min_combo_score=min_combo_score,
        min_segment_duration_ms=min_seg_ms,
        smooth_window_frames=smooth_window,
    )


def _make_segment(trick: str, start: int, end: int, conf: float = 0.90) -> TrickSegment:
    return TrickSegment(
        trick_slug=trick,
        start_ms=start,
        end_ms=end,
        confidence=conf,
        frame_count=(end - start) // 33,
    )


# ---------------------------------------------------------------------------
# 1. Segment decoder internals
# ---------------------------------------------------------------------------

class TestModeFilter:
    def test_no_change_for_window_one(self):
        labels = np.array([1, 2, 3, 1, 2], dtype=np.int64)
        out = _mode_filter(labels, window=1)
        np.testing.assert_array_equal(out, labels)

    def test_smooths_isolated_spike(self):
        # A single outlier frame surrounded by another label should be smoothed.
        labels = np.array([3, 3, 3, 1, 3, 3, 3], dtype=np.int64)
        out = _mode_filter(labels, window=5)
        assert out[3] == 3, "Isolated label=1 spike should be replaced by mode=3"

    def test_preserves_long_run(self):
        labels = np.array([3, 3, 3, 3, 4, 4, 4, 4], dtype=np.int64)
        out = _mode_filter(labels, window=3)
        # The boundary may shift by 1 but both classes should still be present.
        assert 3 in out
        assert 4 in out

    def test_empty_array(self):
        out = _mode_filter(np.array([], dtype=np.int64), window=5)
        assert len(out) == 0


class TestRunLengthEncode:
    def test_simple(self):
        labels = np.array([3, 3, 1, 1, 1, 4], dtype=np.int64)
        runs = _run_length_encode(labels)
        assert runs == [(3, 0, 1), (1, 2, 4), (4, 5, 5)]

    def test_single_element(self):
        runs = _run_length_encode(np.array([7], dtype=np.int64))
        assert runs == [(7, 0, 0)]

    def test_empty(self):
        assert _run_length_encode(np.array([], dtype=np.int64)) == []

    def test_all_same(self):
        runs = _run_length_encode(np.array([2, 2, 2, 2], dtype=np.int64))
        assert runs == [(2, 0, 3)]


# ---------------------------------------------------------------------------
# 2. Segment decoder end-to-end
# ---------------------------------------------------------------------------

class TestDecodeSegments:
    def test_clean_sequence_two_tricks(self):
        """Sit (frames 0-14) then Down (frames 15-29) at 30fps."""
        sit_label  = TRICK_LABEL_MAP["sit"]
        down_label = TRICK_LABEL_MAP["down"]
        labels = [sit_label] * 15 + [down_label] * 15
        logits = _logits_for_sequence(labels)
        ts = _timestamps(30)
        cfg = SegmentDecoderConfig(smooth_window_frames=3, min_segment_duration_ms=200)
        segs = decode_segments(logits, ts, cfg)
        slugs = [s.trick_slug for s in segs]
        assert "sit" in slugs
        assert "down" in slugs
        assert segs[0].trick_slug == "sit"
        assert segs[1].trick_slug == "down"

    def test_no_action_frames_excluded(self):
        """Segments labelled no_action should never appear in output."""
        labels = [0] * 30
        logits = _logits_for_sequence(labels)
        cfg = SegmentDecoderConfig(min_segment_duration_ms=0)
        segs = decode_segments(logits, _timestamps(30), cfg)
        assert segs == []

    def test_short_segment_filtered(self):
        """A 3-frame blip at 30fps (~100ms) should be dropped when min is 300ms."""
        sit  = TRICK_LABEL_MAP["sit"]
        down = TRICK_LABEL_MAP["down"]
        # down for 3 frames (~100ms), sit for 27 frames (~900ms)
        labels = [down] * 3 + [sit] * 27
        logits = _logits_for_sequence(labels)
        cfg = SegmentDecoderConfig(smooth_window_frames=1, min_segment_duration_ms=300)
        segs = decode_segments(logits, _timestamps(30), cfg)
        slugs = [s.trick_slug for s in segs]
        # The 3-frame down should be filtered; only sit survives.
        assert "sit" in slugs
        # The accidental 3-frame down must not appear.
        assert all(s.trick_slug != "down" or s.duration_ms >= 300 for s in segs)

    def test_confidence_is_mean_of_segment(self):
        sit_label = TRICK_LABEL_MAP["sit"]
        logits = _logits_for_sequence([sit_label] * 30, high_conf_logit=5.0)
        segs = decode_segments(logits, _timestamps(30),
                               SegmentDecoderConfig(min_segment_duration_ms=100))
        assert len(segs) == 1
        assert segs[0].confidence > 0.9   # high-confidence logit -> high softmax prob

    def test_empty_input(self):
        segs = decode_segments(np.zeros((0, 7), dtype=np.float32), [])
        assert segs == []

    def test_noisy_labels_smoothed(self):
        """Single-frame noise should be removed by mode filter."""
        sit  = TRICK_LABEL_MAP["sit"]
        spin = TRICK_LABEL_MAP["spin"]
        # 20 sit frames with a single spin frame in the middle
        labels = [sit] * 10 + [spin] + [sit] * 9
        logits = _logits_for_sequence(labels)
        cfg = SegmentDecoderConfig(smooth_window_frames=5, min_segment_duration_ms=200)
        segs = decode_segments(logits, _timestamps(20), cfg)
        # After smoothing the single spin spike should be removed.
        assert all(s.trick_slug == "sit" for s in segs), (
            f"Expected only sit segments, got {[s.trick_slug for s in segs]}"
        )


# ---------------------------------------------------------------------------
# 3. Combo matcher
# ---------------------------------------------------------------------------

class TestComboMatcherComplete:
    def test_complete(self):
        combo = _make_combo(sequence=["sit", "down"])
        segs = [
            _make_segment("sit",  0,   800, conf=0.90),
            _make_segment("down", 900, 1800, conf=0.88),
        ]
        result = match_combo(segs, combo)
        assert result.status == "complete"
        assert result.combo_score == pytest.approx(1.0)
        assert result.failure_reason is None
        assert all(s.detected for s in result.steps)
        assert all(s.in_order for s in result.steps)


class TestComboMatcherMissingStep:
    def test_missing_step(self):
        combo = _make_combo(sequence=["sit", "spin", "down"])
        # Only sit and down — spin is absent.
        segs = [
            _make_segment("sit",  0,   800),
            _make_segment("down", 900, 1800),
        ]
        result = match_combo(segs, combo,
                             ComboMatchConfig(min_step_confidence=0.65, min_combo_score=0.90))
        assert result.status in ("missing_step", "partial")
        # The spin step must be reported as not detected.
        spin_step = next(s for s in result.steps if s.expected_trick == "spin")
        assert not spin_step.detected

    def test_missing_step_guidance_mentions_missing_trick(self):
        combo = _make_combo(sequence=["paw", "sit"])
        segs = [_make_segment("sit", 0, 800)]
        result = match_combo(segs, combo,
                             ComboMatchConfig(min_step_confidence=0.65, min_combo_score=0.99))
        assert result.failure_reason is not None
        assert "Paw" in result.failure_reason or "paw" in result.failure_reason.lower()


class TestComboMatcherWrongOrder:
    def test_wrong_order(self):
        combo = _make_combo(sequence=["sit", "down"])
        # Down before Sit — reversed.
        segs = [
            _make_segment("down", 0,   800),
            _make_segment("sit",  900, 1800),
        ]
        result = match_combo(segs, combo)
        assert result.status == "wrong_order"
        assert result.retry_guidance is not None
        assert "Sit" in result.retry_guidance or "sit" in result.retry_guidance.lower()

    def test_wrong_order_guidance_contains_order(self):
        combo = _make_combo(sequence=["paw", "sit"])
        segs = [
            _make_segment("sit", 0,   800),
            _make_segment("paw", 900, 1800),
        ]
        result = match_combo(segs, combo)
        assert result.status == "wrong_order"
        # Guidance should spell out the correct order.
        assert "Paw" in result.retry_guidance or "paw" in result.retry_guidance.lower()


class TestComboMatcherNoisyFrames:
    def test_extra_no_action_segments_ignored(self):
        """Extra no_action segments between tricks must not break the match."""
        combo = _make_combo(sequence=["sit", "down"])
        # Segments include an extra intermediate trick that is not in the combo.
        segs = [
            _make_segment("sit",   0,    800),
            _make_segment("stand", 850,  1100),  # extra, unexpected
            _make_segment("down",  1200, 2000),
        ]
        result = match_combo(segs, combo)
        # Greedy subsequence should still find sit then down.
        assert result.status in ("complete", "low_confidence")

    def test_extra_step_does_not_cause_failure(self):
        """A segment for a trick not in the combo sequence is allowed."""
        combo = _make_combo(sequence=["sit", "down"])
        segs = [
            _make_segment("paw",  0,    500),   # not in expected — extra
            _make_segment("sit",  600,  1400),
            _make_segment("down", 1500, 2300),
        ]
        result = match_combo(segs, combo)
        assert result.status in ("complete", "low_confidence")


class TestComboMatcherAccidentalShortSegment:
    def test_accidental_segment_filtered_before_matching(self):
        """Segments below min_segment_duration_ms should not reach the matcher."""
        sit  = TRICK_LABEL_MAP["sit"]
        down = TRICK_LABEL_MAP["down"]
        spin = TRICK_LABEL_MAP["spin"]
        # spin appears for 2 frames (~67ms at 30fps) between sit and down
        labels = [sit] * 20 + [spin] * 2 + [down] * 20
        logits = _logits_for_sequence(labels)
        ts = _timestamps(42)
        cfg = SegmentDecoderConfig(smooth_window_frames=1, min_segment_duration_ms=300)
        segs = decode_segments(logits, ts, cfg)
        slugs = [s.trick_slug for s in segs]
        # The 2-frame spin should be filtered out, leaving sit and down.
        assert "spin" not in slugs or all(
            s.duration_ms >= 300 for s in segs if s.trick_slug == "spin"
        )


class TestComboMatcherPartialCompletion:
    def test_partial_completion(self):
        combo = _make_combo(sequence=["sit", "spin", "down"],
                            min_combo_score=0.60)
        # Only sit and spin detected — down missing.
        segs = [
            _make_segment("sit",  0,    800),
            _make_segment("spin", 900,  1800),
        ]
        result = match_combo(segs, combo,
                             ComboMatchConfig(min_step_confidence=0.65, min_combo_score=0.60))
        assert result.status == "partial"
        assert result.combo_score == pytest.approx(2 / 3, abs=0.01)
        assert "Down" in result.failure_reason or "down" in result.failure_reason.lower()

    def test_partial_guidance_mentions_completed_steps(self):
        combo = _make_combo(sequence=["paw", "sit"], min_combo_score=0.40)
        segs = [_make_segment("paw", 0, 800)]
        result = match_combo(segs, combo,
                             ComboMatchConfig(min_step_confidence=0.65, min_combo_score=0.40))
        assert result.status == "partial"
        assert "Paw" in result.failure_reason or "paw" in result.failure_reason.lower()


class TestComboMatcherLowConfidence:
    def test_low_confidence_step_flagged(self):
        combo = _make_combo(sequence=["sit", "down"], min_step_conf=0.80)
        segs = [
            _make_segment("sit",  0,    800, conf=0.85),
            _make_segment("down", 900,  1800, conf=0.50),  # below threshold
        ]
        result = match_combo(segs, combo,
                             ComboMatchConfig(min_step_confidence=0.80, min_combo_score=0.70))
        assert result.status == "low_confidence"
        down_step = next(s for s in result.steps if s.expected_trick == "down")
        assert down_step.low_confidence

    def test_all_high_confidence_returns_complete(self):
        combo = _make_combo(sequence=["sit", "down"], min_step_conf=0.65)
        segs = [
            _make_segment("sit",  0,    800, conf=0.90),
            _make_segment("down", 900,  1800, conf=0.88),
        ]
        result = match_combo(segs, combo)
        assert result.status == "complete"
        assert not any(s.low_confidence for s in result.steps)


# ---------------------------------------------------------------------------
# 4. Combo vocabulary service
# ---------------------------------------------------------------------------

class TestComboVocabularyService:
    def setup_method(self):
        from app.services.combo_vocabulary_service import invalidate_cache
        invalidate_cache()

    def test_known_combo_returned(self):
        from app.services.combo_vocabulary_service import get_combo_config
        entry = get_combo_config("sit_then_down")
        assert entry is not None
        assert entry.trick_sequence == ["sit", "down"]

    def test_unknown_combo_returns_none(self):
        from app.services.combo_vocabulary_service import get_combo_config
        assert get_combo_config("not_a_real_combo") is None

    def test_all_defaults_are_active(self):
        from app.services.combo_vocabulary_service import get_active_combos
        combos = get_active_combos()
        assert len(combos) >= 4

    def test_is_known_combo(self):
        from app.services.combo_vocabulary_service import is_known_combo
        assert is_known_combo("paw_then_sit")
        assert not is_known_combo("does_not_exist")

    def test_active_combo_slugs(self):
        from app.services.combo_vocabulary_service import active_combo_slugs
        slugs = active_combo_slugs()
        assert "sit_then_down" in slugs
        assert "stand_spin_sit" in slugs

    def test_sit_then_down_sequence(self):
        from app.services.combo_vocabulary_service import get_combo_config
        c = get_combo_config("sit_then_down")
        assert c.trick_sequence == ["sit", "down"]

    def test_sit_spin_down_sequence(self):
        from app.services.combo_vocabulary_service import get_combo_config
        c = get_combo_config("sit_spin_down")
        assert c.trick_sequence == ["sit", "spin", "down"]

    def test_stand_spin_sit_difficulty(self):
        from app.services.combo_vocabulary_service import get_combo_config
        c = get_combo_config("stand_spin_sit")
        assert c.difficulty >= 3


# ---------------------------------------------------------------------------
# 5. Unknown combo — end-to-end
# ---------------------------------------------------------------------------

class TestUnknownCombo:
    def setup_method(self):
        from app.services.combo_vocabulary_service import invalidate_cache
        invalidate_cache()

    def _minimal_pose_summary(self):
        """Build a minimal PoseSequence that passes quality gates."""
        from unittest.mock import MagicMock
        ps = MagicMock()
        ps.inference_available = True
        ps.multiple_dogs_detected = False
        ps.frames = [MagicMock()] * 10
        ps.average_confidence = 0.85
        ps.required_keypoint_visibility_ratio = 0.80
        ps.dog_frame_coverage_ratio = 0.20
        ps.model_name = "test"
        ps.metadata = MagicMock()
        ps.metadata.fps = 30.0
        return ps

    def test_unknown_combo_returns_unsupported(self):
        from app.classifiers.trick_combo_classifier import TrickComboClassifier
        from app.models.request_models import ActivityAnalysisRequest

        clf = TrickComboClassifier()
        req = ActivityAnalysisRequest(
            verification_id="v1",
            user_id="u1",
            dog_id="d1",
            activity_id="combo:does_not_exist",
            verification_mode="standard",
            context_type="solo",
            storage_path=None,
        )
        result = clf.analyze_pose_sequence(req, self._minimal_pose_summary())
        assert result.status == "unsupported_activity"
        assert "does_not_exist" in (result.failure_reason or "")

    def test_no_model_configured_returns_unsupported(self):
        """When tbt_artifact_path is empty the classifier returns unavailable."""
        from unittest.mock import patch
        from app.classifiers.trick_combo_classifier import TrickComboClassifier
        from app.models.request_models import ActivityAnalysisRequest

        clf = TrickComboClassifier()
        req = ActivityAnalysisRequest(
            verification_id="v2",
            user_id="u2",
            dog_id="d2",
            activity_id="combo:sit_then_down",
            verification_mode="standard",
            context_type="solo",
            storage_path=None,
        )
        with patch("app.config.settings.tbt_artifact_path", ""):
            result = clf.analyze_pose_sequence(req, self._minimal_pose_summary())
        assert result.status == "unsupported_activity"

    def test_extract_slug(self):
        from app.classifiers.trick_combo_classifier import _extract_slug
        assert _extract_slug("combo:sit_then_down") == "sit_then_down"
        assert _extract_slug("sit_then_down") == "sit_then_down"

    def test_combo_status_mapping(self):
        from app.classifiers.trick_combo_classifier import _combo_status_to_response_status
        assert _combo_status_to_response_status("complete") == "passed"
        assert _combo_status_to_response_status("wrong_order") == "retry_wrong_order"
        assert _combo_status_to_response_status("partial") == "retry_incomplete_combo"
        assert _combo_status_to_response_status("missing_step") == "retry_missing_step"


# ---------------------------------------------------------------------------
# 6. Integration: noisy logit sequence -> correct match result
# ---------------------------------------------------------------------------

class TestIntegrationNoisySequence:
    def test_sit_then_down_with_noise(self):
        """
        Build a 90-frame sequence at 30fps:
          frames  0-29  : sit (with 3 random noise frames)
          frames 30-59  : no_action (transition)
          frames 60-89  : down (with 2 random noise frames)
        Expected: two segments (sit, down) and a "complete" match.
        """
        rng = np.random.default_rng(0)
        sit  = TRICK_LABEL_MAP["sit"]
        down = TRICK_LABEL_MAP["down"]
        no_a = TRICK_LABEL_MAP["no_action"]
        spin = TRICK_LABEL_MAP["spin"]

        base_labels = [sit] * 30 + [no_a] * 30 + [down] * 30
        base_labels = list(base_labels)
        # Inject noise spikes.
        for idx in [5, 12, 20]:
            base_labels[idx] = spin
        for idx in [65, 72]:
            base_labels[idx] = spin

        logits = _logits_for_sequence(base_labels)
        ts = _timestamps(90)

        decoder_cfg = SegmentDecoderConfig(
            smooth_window_frames=5,
            min_segment_duration_ms=300,
        )
        segs = decode_segments(logits, ts, decoder_cfg)

        slugs = [s.trick_slug for s in segs]
        assert "sit" in slugs, f"Expected sit in {slugs}"
        assert "down" in slugs, f"Expected down in {slugs}"
        assert "spin" not in slugs, f"Noise spin not filtered: {slugs}"

        combo = _make_combo(sequence=["sit", "down"])
        result = match_combo(segs, combo)
        assert result.status in ("complete", "low_confidence"), (
            f"Expected complete/low_confidence, got {result.status}"
        )

    def test_wrong_order_detected_from_logits(self):
        """Down before Sit should produce wrong_order."""
        down = TRICK_LABEL_MAP["down"]
        sit  = TRICK_LABEL_MAP["sit"]
        labels = [down] * 30 + [0] * 10 + [sit] * 30
        logits = _logits_for_sequence(labels)
        ts = _timestamps(70)
        decoder_cfg = SegmentDecoderConfig(smooth_window_frames=3, min_segment_duration_ms=200)
        segs = decode_segments(logits, ts, decoder_cfg)
        combo = _make_combo(sequence=["sit", "down"])
        result = match_combo(segs, combo)
        assert result.status == "wrong_order"
