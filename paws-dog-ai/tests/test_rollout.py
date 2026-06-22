"""
Tests for the learned Sit classifier rollout system.

Covers:
  - Deterministic rollout assignment
  - 0% rollout (no user ever in rollout)
  - 100% rollout (every user in rollout)
  - Shadow mode (learned runs, result unchanged)
  - Model failure / missing artifact fallback
  - Low-confidence retry path
  - Below-review-threshold fallback path
  - Rollback behavior (percentage set back to 0)
  - Metrics recording
"""

from unittest.mock import MagicMock, patch

import pytest

from app.ml import metrics_service
from app.ml.rollout_service import (
    apply_rollout,
    clear_model_cache,
    is_user_in_rollout,
)
from app.models.pose_models import PoseSequence, VideoMetadata
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_request(user_id: str = "user-abc") -> ActivityAnalysisRequest:
    return ActivityAnalysisRequest(
        verification_id="ver-001",
        user_id=user_id,
        dog_id="dog-001",
        activity_id="sit",
        verification_mode="standard",
        storage_path=None,
        context_type="training",
    )


def _make_pose_summary() -> PoseSequence:
    return PoseSequence(
        model_name="superanimal_quadruped_v1",
        metadata=VideoMetadata(
            duration_seconds=3.0,
            fps=30.0,
            width=640,
            height=480,
            frame_count=90,
        ),
        frames=[],
        average_confidence=0.82,
        required_keypoint_visibility_ratio=0.80,
        dog_frame_coverage_ratio=0.20,
    )


def _rule_passed_result(request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id="sit",
        status="passed",
        confidence_score=0.88,
        model_name="rule_based_v1",
        analysis_summary={"classifier": "rule_based"},
        failure_reason=None,
        retry_guidance=None,
    )


def _rule_failed_result(request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id="sit",
        status="failed_no_valid_activity",
        confidence_score=0.45,
        model_name="rule_based_v1",
        analysis_summary={"classifier": "rule_based"},
        failure_reason="A complete stable sit was not detected.",
        retry_guidance="Cue a clear sit.",
    )


def _call_apply_rollout(
    request,
    rule_based_result,
    rollout_percentage=0.0,
    shadow_mode=False,
    fallback_enabled=True,
    min_confidence=0.75,
    review_threshold=0.60,
    artifact_path="fake/artifact",
):
    return apply_rollout(
        request=request,
        pose_summary=_make_pose_summary(),
        rule_based_result=rule_based_result,
        artifact_path=artifact_path,
        min_confidence=min_confidence,
        review_threshold=review_threshold,
        rollout_percentage=rollout_percentage,
        shadow_mode=shadow_mode,
        fallback_enabled=fallback_enabled,
    )


# ---------------------------------------------------------------------------
# Deterministic rollout assignment
# ---------------------------------------------------------------------------

class TestRolloutAssignment:
    def test_zero_percent_always_false(self):
        for uid in ["user-1", "user-2", "user-abc", "power_user", "a"]:
            assert is_user_in_rollout(uid, 0.0) is False

    def test_hundred_percent_always_true(self):
        for uid in ["user-1", "user-2", "user-abc", "power_user", "a"]:
            assert is_user_in_rollout(uid, 100.0) is True

    def test_deterministic_for_same_user(self):
        uid = "stable-user-123"
        results = [is_user_in_rollout(uid, 50.0) for _ in range(10)]
        assert all(r == results[0] for r in results), "assignment must be stable"

    def test_different_users_can_differ(self):
        results = {is_user_in_rollout(f"user-{i}", 50.0) for i in range(40)}
        # With 40 users and a 50% split we expect both True and False to appear.
        assert True in results
        assert False in results

    def test_five_percent_gives_roughly_five_percent(self):
        users = [f"user-{i}" for i in range(1000)]
        in_rollout = sum(is_user_in_rollout(u, 5.0) for u in users)
        # Should be within 2-8% of 1000 (allowing +-3% of binomial noise).
        assert 20 <= in_rollout <= 80

    def test_rollback_to_zero_removes_all_users(self):
        # Even users that were in rollout at 50% are not in rollout at 0%.
        users_at_50 = [u for u in [f"user-{i}" for i in range(200)] if is_user_in_rollout(u, 50.0)]
        assert all(not is_user_in_rollout(u, 0.0) for u in users_at_50)


# ---------------------------------------------------------------------------
# 0% rollout — no behavioral change
# ---------------------------------------------------------------------------

class TestZeroPercentRollout:
    def test_returns_rule_based_result_unchanged(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)
        final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=0.0)
        assert final is rule_result
        assert meta.classifier_used == "rule_based"
        assert meta.in_rollout is False
        assert meta.learned_prediction is None

    def test_does_not_call_learned_model(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)
        with patch("app.ml.rollout_service._run_learned_inference") as mock_infer:
            _call_apply_rollout(request, rule_result, rollout_percentage=0.0)
        mock_infer.assert_not_called()


# ---------------------------------------------------------------------------
# 100% rollout — all users use learned model
# ---------------------------------------------------------------------------

class TestHundredPercentRollout:
    def setup_method(self):
        clear_model_cache()

    def test_learned_passed_returns_passed_status(self):
        request = _make_request()
        rule_result = _rule_failed_result(request)  # rule disagrees to prove learned wins

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.91, "tcn_v1", 12, None)):
            final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert final.status == "passed"
        assert final.confidence_score == pytest.approx(0.91, abs=0.01)
        assert meta.classifier_used == "learned"
        assert meta.in_rollout is True
        assert meta.disagrees is True   # rule said failed, learned said passed

    def test_learned_failed_returns_failed_status(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("failed", 0.88, "tcn_v1", 10, None)):
            final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert final.status == "failed_no_valid_activity"
        assert meta.classifier_used == "learned"
        assert meta.disagrees is True

    def test_model_version_recorded_in_meta(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.90, "sit_tcn_v2", 8, None)):
            _, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert meta.model_version == "sit_tcn_v2"

    def test_latency_recorded_in_meta(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.90, "tcn_v1", 42, None)):
            _, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert meta.learned_latency_ms == 42


# ---------------------------------------------------------------------------
# Model failure / missing artifact fallback
# ---------------------------------------------------------------------------

class TestModelFailureFallback:
    def setup_method(self):
        clear_model_cache()

    def test_inference_exception_falls_back_to_rule_based(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=(None, 0.0, None, None, "artifact_not_found: no model.pt")):
            final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert final is rule_result
        assert meta.classifier_used == "rule_based_fallback"
        assert "artifact_not_found" in (meta.fallback_reason or "")

    def test_fallback_result_status_matches_rule_based(self):
        request = _make_request()
        rule_result = _rule_failed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=(None, 0.0, None, None, "torch not available")):
            final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert final.status == "failed_no_valid_activity"
        assert meta.fallback_reason is not None


# ---------------------------------------------------------------------------
# Low-confidence / borderline confidence handling
# ---------------------------------------------------------------------------

class TestConfidenceHandling:
    def setup_method(self):
        clear_model_cache()

    def test_borderline_confidence_returns_retry_uncertain(self):
        """conf in [review_threshold, min_confidence) -> retry_uncertain."""
        request = _make_request()
        rule_result = _rule_passed_result(request)

        # confidence 0.65 is in [0.60, 0.75)
        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.65, "tcn_v1", 9, None)):
            final, meta = _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
            )

        assert final.status == "retry_uncertain"
        assert meta.queued_for_review is True
        assert meta.classifier_used == "learned"

    def test_borderline_does_not_auto_fail(self):
        """Borderline confidence must not produce failed_no_valid_activity."""
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("failed", 0.68, "tcn_v1", 9, None)):
            final, meta = _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
            )

        assert final.status == "retry_uncertain"
        assert "failed" not in final.status

    def test_very_low_confidence_with_fallback_enabled_uses_rule_based(self):
        """conf < review_threshold + fallback_enabled -> rule-based result."""
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.45, "tcn_v1", 9, None)):
            final, meta = _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
                fallback_enabled=True,
            )

        assert final is rule_result
        assert meta.classifier_used == "rule_based_fallback"
        assert meta.queued_for_review is True

    def test_very_low_confidence_without_fallback_returns_retry_uncertain(self):
        """conf < review_threshold + fallback_disabled -> retry_uncertain (never auto-fail)."""
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("failed", 0.45, "tcn_v1", 9, None)):
            final, meta = _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
                fallback_enabled=False,
            )

        assert final.status == "retry_uncertain"
        assert meta.queued_for_review is True

    def test_high_confidence_does_not_queue_for_review(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.92, "tcn_v1", 8, None)):
            _, meta = _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        assert meta.queued_for_review is False


# ---------------------------------------------------------------------------
# Shadow mode
# ---------------------------------------------------------------------------

class TestShadowMode:
    def setup_method(self):
        clear_model_cache()

    def test_shadow_mode_returns_rule_based_result(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("failed", 0.87, "tcn_v1", 11, None)):
            final, meta = _call_apply_rollout(
                request, rule_result,
                rollout_percentage=0.0,  # not in rollout
                shadow_mode=True,
            )

        assert final is rule_result
        assert meta.shadow_only is True
        assert meta.classifier_used == "rule_based"
        assert meta.learned_prediction == "failed"
        assert meta.disagrees is True

    def test_shadow_mode_records_learned_observation(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.90, "tcn_v1", 7, None)):
            _, meta = _call_apply_rollout(
                request, rule_result,
                shadow_mode=True,
            )

        assert meta.learned_prediction == "passed"
        assert meta.learned_confidence == pytest.approx(0.90, abs=0.01)
        assert meta.model_version == "tcn_v1"


# ---------------------------------------------------------------------------
# Rollback behavior
# ---------------------------------------------------------------------------

class TestRollback:
    def setup_method(self):
        clear_model_cache()

    def test_rollback_to_zero_returns_rule_based_for_previously_enrolled_users(self):
        """Users that were in rollout at 50% must revert to rule-based at 0%."""
        enrolled = [
            uid for uid in [f"user-{i}" for i in range(200)]
            if is_user_in_rollout(uid, 50.0)
        ]
        assert enrolled, "need at least one enrolled user for this test"

        for uid in enrolled[:5]:
            request = _make_request(user_id=uid)
            rule_result = _rule_passed_result(request)
            final, meta = _call_apply_rollout(request, rule_result, rollout_percentage=0.0)
            assert final is rule_result
            assert meta.classifier_used == "rule_based"


# ---------------------------------------------------------------------------
# Metrics recording
# ---------------------------------------------------------------------------

class TestMetrics:
    def setup_method(self):
        metrics_service.reset()
        clear_model_cache()

    def test_passed_increments_pass_counter(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.91, "tcn_v1", 5, None)):
            _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        snap = metrics_service.get_snapshot()
        assert snap.total == 1
        assert snap.pass_rate == pytest.approx(1.0)

    def test_fallback_increments_fallback_counter(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=(None, 0.0, None, None, "error")):
            _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        snap = metrics_service.get_snapshot()
        assert snap.fallback_rate == pytest.approx(1.0)

    def test_disagree_increments_disagree_counter(self):
        request = _make_request()
        rule_result = _rule_failed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.92, "tcn_v1", 5, None)):
            _call_apply_rollout(request, rule_result, rollout_percentage=100.0)

        snap = metrics_service.get_snapshot()
        assert snap.disagree_rate == pytest.approx(1.0)

    def test_low_confidence_increments_low_confidence_counter(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.65, "tcn_v1", 5, None)):
            _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
            )

        snap = metrics_service.get_snapshot()
        assert snap.low_confidence_rate == pytest.approx(1.0)

    def test_manual_review_increments_review_counter(self):
        request = _make_request()
        rule_result = _rule_passed_result(request)

        with patch("app.ml.rollout_service._run_learned_inference",
                   return_value=("passed", 0.65, "tcn_v1", 5, None)):
            _call_apply_rollout(
                request, rule_result,
                rollout_percentage=100.0,
                min_confidence=0.75,
                review_threshold=0.60,
            )

        snap = metrics_service.get_snapshot()
        assert snap.manual_review_rate == pytest.approx(1.0)

    def test_not_in_rollout_does_not_record_metrics(self):
        """Users outside rollout do not affect metrics counters."""
        request = _make_request()
        rule_result = _rule_passed_result(request)
        _call_apply_rollout(request, rule_result, rollout_percentage=0.0)
        snap = metrics_service.get_snapshot()
        assert snap.total == 0
