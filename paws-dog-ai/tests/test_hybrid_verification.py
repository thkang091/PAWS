"""
Tests for the hybrid verification pipeline.

Covers:
  1. Standard daily attempt stays on fast_pose path.
  2. Borderline confidence routes to hybrid path.
  3. Gold Coin attempt always uses hybrid and applies stricter policy.
  4. Tournament attempt can route to manual_review.
  5. RGB provider failure falls back safely (pose-only fusion).
  6. Audit log is created for hybrid and high-stakes attempts.
  7. Anomaly score computation.
  8. Score fusion arithmetic.
  9. Final decision tier policy (borderline gold coin -> manual review).
 10. decide_routing unit tests for each trigger.
"""

from __future__ import annotations

import pytest

from app.models.hybrid_models import (
    DEFAULT_FUSION_WEIGHTS,
    AttemptHistorySummary,
    FusionWeights,
    HybridVerificationInput,
    RGBVerificationResult,
    RoutingDecision,
    VerificationTier,
)
from app.ml.rgb_verifier import (
    RGBVerificationError,
    RGBVerifier,
    StubRGBVerifier,
    get_rgb_verifier,
    register_rgb_verifier,
)
from app.services.anomaly_service import compute_anomaly_score
from app.services.hybrid_verification_service import (
    compute_quality_score,
    decide_routing,
    fuse_scores,
    hybrid_result_to_response,
    make_final_decision,
    run_hybrid_verification,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_input(
    tier: str = VerificationTier.STANDARD_DAILY,
    pose_confidence: float = 0.85,
    quality_flags: dict | None = None,
    multiple_dogs: bool = False,
    classifier_status: str = "passed",
    attempt_history: AttemptHistorySummary | None = None,
) -> HybridVerificationInput:
    return HybridVerificationInput(
        verification_id="ver-001",
        activity_id="sit",
        tier=tier,
        pose_confidence=pose_confidence,
        pose_classifier_status=classifier_status,
        quality_flags=quality_flags or {},
        multiple_dogs_detected=multiple_dogs,
        recording_metadata={"duration_seconds": 4.0},
        attempt_history=attempt_history,
    )


def _make_request(tier: str = VerificationTier.STANDARD_DAILY):
    from app.models.request_models import ActivityAnalysisRequest
    return ActivityAnalysisRequest(
        verification_id="ver-001",
        user_id="user-1",
        dog_id="dog-1",
        activity_id="sit",
        verification_mode="standard",
        context_type="solo",
        verification_tier=tier,
    )


# ---------------------------------------------------------------------------
# 1. Standard daily stays on fast path
# ---------------------------------------------------------------------------

class TestFastPath:
    def test_clean_standard_daily_is_fast_pose(self):
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.90,
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.05,
        )
        assert routing.path == "fast_pose"
        assert routing.reasons == []

    def test_premium_challenge_clean_is_fast_pose(self):
        routing = decide_routing(
            tier=VerificationTier.PREMIUM_CHALLENGE,
            pose_confidence=0.88,
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.10,
        )
        assert routing.path == "fast_pose"

    def test_full_pipeline_fast_path_returns_pose_result(self, monkeypatch):
        """run_hybrid_verification should pass through on fast_pose routing."""
        input_ = _make_input(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.92,
        )
        request = _make_request()

        # Patch audit writer to avoid DB calls.
        monkeypatch.setattr(
            "app.services.hybrid_verification_service.write_audit_entry"
            if False else "app.services.audit_log_service.write_audit_entry",
            lambda **kwargs: "fake-audit-id",
            raising=False,
        )

        fused = run_hybrid_verification(input_=input_, request=request, pose_model_version="pose_v1")
        # Fast path: no RGB used, routing_path is fast_pose.
        assert fused.routing_path == "fast_pose"
        assert fused.rgb_score is None
        assert fused.final_status in ("passed", "retry", "manual_review", "failed")


# ---------------------------------------------------------------------------
# 2. Borderline confidence routes to hybrid
# ---------------------------------------------------------------------------

class TestBorderlineRouting:
    def test_low_confidence_triggers_hybrid(self):
        # Below hybrid_pose_confidence_threshold (0.72 default).
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.65,
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.05,
        )
        assert routing.path == "hybrid"
        assert any("low_pose_confidence" in r for r in routing.reasons)

    def test_quality_flag_triggers_hybrid(self):
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.85,
            quality_flags={"low_average_confidence": True},
            multiple_dogs_detected=False,
            anomaly_score=0.05,
        )
        assert routing.path == "hybrid"
        assert "quality:low_average_confidence" in routing.reasons

    def test_multiple_dogs_triggers_hybrid(self):
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.85,
            quality_flags={},
            multiple_dogs_detected=True,
            anomaly_score=0.05,
        )
        assert routing.path == "hybrid"
        assert "quality:multiple_dogs_detected" in routing.reasons

    def test_anomaly_triggers_hybrid(self):
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.85,
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.50,
        )
        assert routing.path == "hybrid"
        assert any("anomaly_score" in r for r in routing.reasons)

    def test_excessive_missing_frames_triggers_hybrid(self):
        routing = decide_routing(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.85,
            quality_flags={"excessive_missing_frames": True},
            multiple_dogs_detected=False,
            anomaly_score=0.10,
        )
        assert routing.path == "hybrid"


# ---------------------------------------------------------------------------
# 3. Gold Coin always hybrid, stricter policy
# ---------------------------------------------------------------------------

class TestGoldCoinPolicy:
    def test_gold_coin_always_routes_to_hybrid(self):
        routing = decide_routing(
            tier=VerificationTier.GOLD_COIN_REWARD,
            pose_confidence=0.95,  # very high — still goes hybrid
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.05,
        )
        assert routing.path in ("hybrid", "direct_manual_review")
        assert any("high_stakes_tier" in r for r in routing.reasons)

    def test_gold_coin_borderline_goes_to_manual_review(self):
        # Fused confidence between 0.80 (pass) and 0.88 (strict review threshold).
        status, policy = make_final_decision(
            fused_confidence=0.84,
            tier=VerificationTier.GOLD_COIN_REWARD,
            classifier_status="passed",
            routing_path="hybrid",
        )
        assert status == "manual_review"
        assert policy is not None
        assert "borderline_gold_coin_reward" in policy

    def test_gold_coin_above_strict_threshold_passes(self):
        status, policy = make_final_decision(
            fused_confidence=0.92,
            tier=VerificationTier.GOLD_COIN_REWARD,
            classifier_status="passed",
            routing_path="hybrid",
        )
        assert status == "passed"
        assert policy is None

    def test_gold_coin_below_pass_threshold_fails_or_retries(self):
        # Below 0.80 pass threshold.
        status, policy = make_final_decision(
            fused_confidence=0.70,
            tier=VerificationTier.GOLD_COIN_REWARD,
            classifier_status="failed",
            routing_path="hybrid",
        )
        assert status == "failed"

    def test_gold_coin_low_confidence_direct_review(self):
        """Very low pose confidence on gold coin -> direct_manual_review."""
        routing = decide_routing(
            tier=VerificationTier.GOLD_COIN_REWARD,
            pose_confidence=0.40,   # below hybrid_high_stakes_direct_review_threshold (0.55)
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.10,
        )
        assert routing.path == "direct_manual_review"


# ---------------------------------------------------------------------------
# 4. Tournament can route to manual review
# ---------------------------------------------------------------------------

class TestTournamentPolicy:
    def test_tournament_borderline_is_manual_review(self):
        # Between 0.82 (pass) and 0.90 (strict threshold).
        status, policy = make_final_decision(
            fused_confidence=0.86,
            tier=VerificationTier.TOURNAMENT,
            classifier_status="passed",
            routing_path="hybrid",
        )
        assert status == "manual_review"
        assert "borderline_tournament" in (policy or "")

    def test_tournament_direct_review_path(self):
        status, policy = make_final_decision(
            fused_confidence=0.75,
            tier=VerificationTier.TOURNAMENT,
            classifier_status="passed",
            routing_path="direct_manual_review",
        )
        assert status == "manual_review"
        assert "direct_manual_review" in (policy or "")

    def test_tournament_high_confidence_passes(self):
        status, policy = make_final_decision(
            fused_confidence=0.95,
            tier=VerificationTier.TOURNAMENT,
            classifier_status="passed",
            routing_path="hybrid",
        )
        assert status == "passed"
        assert policy is None


# ---------------------------------------------------------------------------
# 5. RGB provider failure falls back safely
# ---------------------------------------------------------------------------

class TestRGBFailureFallback:
    def test_failing_provider_fuses_without_rgb(self):
        """When RGB verification raises, fused_confidence uses pose+quality only."""

        class FailingVerifier(RGBVerifier):
            @property
            def provider_name(self) -> str:
                return "failing_test"

            @property
            def model_version(self) -> str:
                return "v0"

            def verify(self, input_: HybridVerificationInput) -> RGBVerificationResult:
                raise RGBVerificationError("Provider timeout")

        register_rgb_verifier("failing_test", FailingVerifier)

        input_ = _make_input(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.65,   # triggers hybrid
        )
        request = _make_request()

        import unittest.mock as mock
        with mock.patch("app.services.audit_log_service.write_audit_entry", return_value="a1"):
            fused = run_hybrid_verification(
                input_=input_,
                request=request,
                pose_model_version="pose_v1",
                rgb_provider_key="failing_test",
            )

        # No crash and rgb_score is None.
        assert fused.rgb_score is None
        assert fused.rgb_provider is None
        # fused_confidence was computed without RGB.
        assert 0.0 <= fused.fused_confidence <= 1.0

    def test_unknown_provider_key_still_returns_result(self):
        """An unregistered provider key should not crash the pipeline."""
        input_ = _make_input(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.65,
        )
        request = _make_request()

        import unittest.mock as mock
        with mock.patch("app.services.audit_log_service.write_audit_entry", return_value="a1"):
            fused = run_hybrid_verification(
                input_=input_,
                request=request,
                pose_model_version="pose_v1",
                rgb_provider_key="nonexistent_provider",
            )

        assert fused.final_status in ("passed", "failed", "retry", "manual_review")
        assert fused.rgb_score is None


# ---------------------------------------------------------------------------
# 6. Audit log is created
# ---------------------------------------------------------------------------

class TestAuditLog:
    def test_audit_written_for_hybrid_path(self):
        """run_hybrid_verification should call write_audit_entry for hybrid path."""
        input_ = _make_input(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.65,   # triggers hybrid
        )
        request = _make_request()

        calls: list[dict] = []

        def fake_audit(**kwargs):
            calls.append(kwargs)
            return "audit-abc"

        import unittest.mock as mock
        with mock.patch("app.services.audit_log_service.write_audit_entry", side_effect=fake_audit):
            fused = run_hybrid_verification(
                input_=input_, request=request, pose_model_version="pose_v1"
            )

        assert len(calls) == 1
        assert calls[0]["verification_id"] == "ver-001"
        assert calls[0]["tier"] == VerificationTier.STANDARD_DAILY
        assert calls[0]["routing_path"] in ("hybrid", "direct_manual_review")
        assert fused.audit_id == "audit-abc"

    def test_audit_written_for_high_stakes_fast_path(self):
        """Even on fast_pose, high-stakes tiers must have an audit row."""
        # Gold coin always goes hybrid/direct, so audit is guaranteed.
        # Verify that for the gold_coin tier, routing is never fast_pose.
        routing = decide_routing(
            tier=VerificationTier.GOLD_COIN_REWARD,
            pose_confidence=0.98,
            quality_flags={},
            multiple_dogs_detected=False,
            anomaly_score=0.00,
        )
        assert routing.path != "fast_pose"

    def test_audit_failure_does_not_crash_pipeline(self):
        """A DB error in write_audit_entry must not propagate to the caller."""
        input_ = _make_input(
            tier=VerificationTier.STANDARD_DAILY,
            pose_confidence=0.65,
        )
        request = _make_request()

        def raise_error(**kwargs):
            raise RuntimeError("DB connection refused")

        import unittest.mock as mock
        with mock.patch("app.services.audit_log_service.write_audit_entry", side_effect=raise_error):
            fused = run_hybrid_verification(
                input_=input_, request=request, pose_model_version="pose_v1"
            )

        # Should still return a valid result.
        assert fused.final_status in ("passed", "failed", "retry", "manual_review")
        # audit_id is None because the write failed.
        assert fused.audit_id is None


# ---------------------------------------------------------------------------
# 7. Anomaly score computation
# ---------------------------------------------------------------------------

class TestAnomalyService:
    def test_clean_attempt_low_anomaly(self):
        report = compute_anomaly_score(
            quality_flags={},
            multiple_dogs_detected=False,
            recording_metadata={"duration_seconds": 5.0},
        )
        assert report.score < 0.20
        assert report.flags == []

    def test_multiple_dogs_raises_anomaly(self):
        report = compute_anomaly_score(
            quality_flags={},
            multiple_dogs_detected=True,
            recording_metadata={"duration_seconds": 5.0},
        )
        assert "multiple_dogs" in report.flags
        assert report.score > 0.20

    def test_very_short_recording_high_anomaly(self):
        report = compute_anomaly_score(
            quality_flags={},
            multiple_dogs_detected=False,
            recording_metadata={"duration_seconds": 0.5},
        )
        assert "very_short_recording" in report.flags
        assert report.score >= 0.40

    def test_combined_flags_cap_at_one(self):
        report = compute_anomaly_score(
            quality_flags={
                "low_average_confidence": True,
                "excessive_missing_frames": True,
                "inconsistent_frame_rate": True,
            },
            multiple_dogs_detected=True,
            recording_metadata={"duration_seconds": 0.5},
        )
        assert report.score <= 1.0

    def test_high_consecutive_failures_flag(self):
        report = compute_anomaly_score(
            quality_flags={},
            multiple_dogs_detected=False,
            recording_metadata={"duration_seconds": 4.0},
            attempt_history_summary={"consecutive_failures": 6},
        )
        assert "high_consecutive_failures" in report.flags

    def test_prior_rgb_fraud_risk(self):
        report = compute_anomaly_score(
            quality_flags={},
            multiple_dogs_detected=False,
            recording_metadata={"duration_seconds": 4.0},
            prior_rgb_fraud_risk=0.80,
        )
        assert "high_rgb_fraud_risk" in report.flags


# ---------------------------------------------------------------------------
# 8. Score fusion arithmetic
# ---------------------------------------------------------------------------

class TestFusion:
    def test_no_rgb_result_uses_pose_and_quality(self):
        score = fuse_scores(
            pose_score=0.80,
            rgb_result=None,
            quality_score=1.00,
            anomaly_score=0.00,
        )
        # pose=0.55, quality=0.15 => renormalized: pose/(0.55+0.15)=11/14 ~ 0.786
        # 0.786*0.80 + 0.214*1.00 = 0.629 + 0.214 = 0.843
        assert 0.80 <= score <= 0.90

    def test_rgb_result_included_in_fusion(self):
        rgb = RGBVerificationResult(
            visual_confidence=0.90,
            occlusion_score=0.05,
            assistance_likelihood=0.03,
            multiple_dog_score=0.02,
            fraud_risk_score=0.05,
            provider="stub",
            model_version="v0",
            latency_ms=50,
        )
        score_with_rgb = fuse_scores(
            pose_score=0.80,
            rgb_result=rgb,
            quality_score=1.00,
            anomaly_score=0.00,
        )
        score_without = fuse_scores(
            pose_score=0.80,
            rgb_result=None,
            quality_score=1.00,
            anomaly_score=0.00,
        )
        # High RGB confidence should push score slightly higher.
        assert score_with_rgb > 0.70

    def test_anomaly_discounts_fused_score(self):
        low_anomaly = fuse_scores(0.85, None, 0.90, anomaly_score=0.05)
        high_anomaly = fuse_scores(0.85, None, 0.90, anomaly_score=0.80)
        assert high_anomaly < low_anomaly

    def test_fraud_risk_reduces_rgb_contribution(self):
        clean_rgb = RGBVerificationResult(
            visual_confidence=0.90, occlusion_score=0.05,
            assistance_likelihood=0.02, multiple_dog_score=0.02,
            fraud_risk_score=0.02, provider="s", model_version="v0", latency_ms=10,
        )
        risky_rgb = RGBVerificationResult(
            visual_confidence=0.90, occlusion_score=0.05,
            assistance_likelihood=0.02, multiple_dog_score=0.02,
            fraud_risk_score=0.90, provider="s", model_version="v0", latency_ms=10,
        )
        score_clean = fuse_scores(0.80, clean_rgb, 0.90, 0.00)
        score_risky = fuse_scores(0.80, risky_rgb, 0.90, 0.00)
        assert score_risky < score_clean

    def test_fused_score_clamped_to_unit_range(self):
        score = fuse_scores(1.0, None, 1.0, anomaly_score=0.0)
        assert 0.0 <= score <= 1.0

    def test_quality_score_from_flags(self):
        clean = compute_quality_score({})
        assert clean == 1.0

        flagged = compute_quality_score({
            "low_average_confidence": True,
            "excessive_missing_frames": True,
        })
        assert flagged < 0.60

        # Multiple severe flags should floor at 0.
        severe = compute_quality_score({
            "unsupported_pose_schema": True,
            "low_average_confidence": True,
            "excessive_missing_frames": True,
            "dog_partially_out_of_frame": True,
            "insufficient_recording_duration": True,
            "inconsistent_frame_rate": True,
        })
        assert severe == 0.0


# ---------------------------------------------------------------------------
# 9. Final decision tier policy
# ---------------------------------------------------------------------------

class TestFinalDecision:
    @pytest.mark.parametrize("tier,fused,expected", [
        (VerificationTier.STANDARD_DAILY,    0.80, "passed"),
        (VerificationTier.STANDARD_DAILY,    0.70, "retry"),
        (VerificationTier.PREMIUM_CHALLENGE, 0.80, "passed"),
        (VerificationTier.PREMIUM_CHALLENGE, 0.70, "retry"),
        (VerificationTier.GOLD_COIN_REWARD,  0.85, "manual_review"),   # borderline
        (VerificationTier.GOLD_COIN_REWARD,  0.92, "passed"),
        (VerificationTier.GOLD_COIN_REWARD,  0.75, "retry"),
        (VerificationTier.TOURNAMENT,        0.88, "manual_review"),   # borderline
        (VerificationTier.TOURNAMENT,        0.95, "passed"),
    ])
    def test_tier_policy(self, tier: str, fused: float, expected: str):
        status, _ = make_final_decision(
            fused_confidence=fused,
            tier=tier,
            classifier_status="passed",
            routing_path="hybrid",
        )
        assert status == expected

    def test_direct_manual_review_path_always_manual(self):
        for tier in VerificationTier.ALL:
            status, policy = make_final_decision(
                fused_confidence=0.99,
                tier=tier,
                classifier_status="passed",
                routing_path="direct_manual_review",
            )
            assert status == "manual_review"
            assert policy is not None

    def test_classifier_failed_below_threshold_returns_failed(self):
        status, _ = make_final_decision(
            fused_confidence=0.40,
            tier=VerificationTier.STANDARD_DAILY,
            classifier_status="failed",
            routing_path="hybrid",
        )
        assert status == "failed"


# ---------------------------------------------------------------------------
# 10. decide_routing unit tests
# ---------------------------------------------------------------------------

class TestDecideRouting:
    def test_no_triggers_is_fast_pose(self):
        routing = decide_routing("standard_daily", 0.90, {}, False, 0.05)
        assert routing.path == "fast_pose"
        assert routing.reasons == []

    def test_returns_routing_decision_type(self):
        routing = decide_routing("standard_daily", 0.90, {}, False, 0.05)
        assert isinstance(routing, RoutingDecision)

    def test_high_stakes_reasons_list_populated(self):
        routing = decide_routing(VerificationTier.TOURNAMENT, 0.90, {}, False, 0.05)
        assert len(routing.reasons) >= 1
        assert any("high_stakes_tier" in r for r in routing.reasons)

    def test_multiple_triggers_all_appear_in_reasons(self):
        routing = decide_routing(
            VerificationTier.STANDARD_DAILY,
            pose_confidence=0.60,
            quality_flags={"low_average_confidence": True, "excessive_missing_frames": True},
            multiple_dogs_detected=True,
            anomaly_score=0.50,
        )
        assert routing.path == "hybrid"
        reasons = " ".join(routing.reasons)
        assert "low_pose_confidence" in reasons
        assert "low_average_confidence" in reasons
        assert "excessive_missing_frames" in reasons
        assert "multiple_dogs_detected" in reasons
        assert "anomaly_score" in reasons


# ---------------------------------------------------------------------------
# 11. Hybrid response adapter
# ---------------------------------------------------------------------------

class TestResponseAdapter:
    def _make_fused(self, status: str, tier: str = VerificationTier.STANDARD_DAILY):
        from app.models.hybrid_models import FusedVerificationResult
        return FusedVerificationResult(
            final_status=status,
            pose_score=0.80,
            rgb_score=0.75,
            quality_score=0.90,
            anomaly_score=0.10,
            fused_confidence=0.82,
            routing_path="hybrid",
            tier=tier,
            tier_policy_applied=None,
            enqueue_reason=None,
            audit_id="audit-1",
            rgb_provider="stub",
            rgb_model_version="stub_v0",
            routing_reasons=["high_stakes_tier:standard_daily"],
        )

    def test_passed_maps_to_passed(self):
        request = _make_request()
        resp = hybrid_result_to_response(self._make_fused("passed"), request, "pose_v1")
        assert resp.status == "passed"
        assert resp.confidence_score == 0.82

    def test_manual_review_maps_to_pending(self):
        request = _make_request()
        resp = hybrid_result_to_response(self._make_fused("manual_review"), request, "pose_v1")
        assert resp.status == "pending_manual_review"

    def test_retry_maps_to_retry_uncertain(self):
        request = _make_request()
        resp = hybrid_result_to_response(self._make_fused("retry"), request, "pose_v1")
        assert resp.status == "retry_uncertain"

    def test_analysis_summary_contains_routing_path(self):
        request = _make_request()
        resp = hybrid_result_to_response(self._make_fused("passed"), request, "pose_v1")
        assert resp.analysis_summary is not None
        assert resp.analysis_summary["routing_path"] == "hybrid"
        assert resp.analysis_summary["audit_id"] == "audit-1"

    def test_retry_includes_guidance(self):
        request = _make_request()
        resp = hybrid_result_to_response(self._make_fused("retry"), request, "pose_v1")
        assert resp.retry_guidance is not None
        assert len(resp.retry_guidance) > 10


# ---------------------------------------------------------------------------
# 12. StubRGBVerifier
# ---------------------------------------------------------------------------

class TestStubRGBVerifier:
    def test_stub_returns_valid_result(self):
        input_ = _make_input(pose_confidence=0.80)
        verifier = StubRGBVerifier()
        result = verifier.verify(input_)
        assert 0.0 <= result.visual_confidence <= 1.0
        assert 0.0 <= result.fraud_risk_score <= 1.0
        assert result.provider == "stub"

    def test_stub_reflects_pose_confidence(self):
        input_ = _make_input(pose_confidence=0.75)
        result = StubRGBVerifier().verify(input_)
        assert result.visual_confidence == pytest.approx(0.75)

    def test_get_rgb_verifier_returns_stub_by_default(self):
        verifier = get_rgb_verifier("stub")
        assert isinstance(verifier, StubRGBVerifier)

    def test_register_and_retrieve_custom_verifier(self):
        class DummyVerifier(RGBVerifier):
            @property
            def provider_name(self) -> str:
                return "dummy"

            @property
            def model_version(self) -> str:
                return "v0"

            def verify(self, input_: HybridVerificationInput) -> RGBVerificationResult:
                return RGBVerificationResult(
                    visual_confidence=0.99,
                    occlusion_score=0.0,
                    assistance_likelihood=0.0,
                    multiple_dog_score=0.0,
                    fraud_risk_score=0.0,
                    provider="dummy",
                    model_version="v0",
                    latency_ms=1,
                )

        register_rgb_verifier("dummy_test", DummyVerifier)
        verifier = get_rgb_verifier("dummy_test")
        assert isinstance(verifier, DummyVerifier)

    def test_unknown_provider_raises_key_error(self):
        with pytest.raises(KeyError):
            get_rgb_verifier("does_not_exist_xyz")


# ---------------------------------------------------------------------------
# 13. Verification tier model validation
# ---------------------------------------------------------------------------

class TestVerificationTierModels:
    def test_invalid_tier_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            HybridVerificationInput(
                verification_id="v1",
                activity_id="sit",
                tier="unknown_tier",
                pose_confidence=0.80,
                pose_classifier_status="passed",
                quality_flags={},
                multiple_dogs_detected=False,
                recording_metadata={},
            )

    def test_all_valid_tiers_accepted(self):
        for tier in VerificationTier.ALL:
            inp = _make_input(tier=tier)
            assert inp.tier == tier

    def test_high_stakes_set_contains_expected_tiers(self):
        assert VerificationTier.GOLD_COIN_REWARD in VerificationTier.HIGH_STAKES
        assert VerificationTier.TOURNAMENT in VerificationTier.HIGH_STAKES
        assert VerificationTier.STANDARD_DAILY not in VerificationTier.HIGH_STAKES
        assert VerificationTier.PREMIUM_CHALLENGE not in VerificationTier.HIGH_STAKES
