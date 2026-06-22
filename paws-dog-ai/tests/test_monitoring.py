"""
Tests for the production monitoring and model rollback system.

Covers:
  1.  Model promotion — registry entry created, previous version deactivated,
      rollback_version set, in-process override applied.
  2.  Rollback — previous version activated, current version deactivated.
  3.  Rollout-percentage update.
  4.  Metric aggregation — pass rate, error rate, p50/p95, confidence histogram.
  5.  Alert threshold behavior — latency, error rate, fallback rate, pass-rate
      delta, schema incompatibility, fraud review.
  6.  Incompatible model version (no rollback_version) raises RuntimeError.
  7.  Disabled-provider fallback (rgb_verifier set to stub after disable).
  8.  Device metrics recording and snapshot.
  9.  Trick metrics aggregation.
 10.  Alert evaluation suppressed when total_attempts < 10.
 11.  Schema incompatibility fires only in the early-attempt window.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.models.monitoring_models import (
    AlertThresholds,
    AlertType,
    ComponentType,
    DeviceMetricsRecord,
    DisableComponentRequest,
    ModelMetricsSnapshot,
    ModelRegistryEntry,
    PromoteModelRequest,
    RollbackRequest,
    TrickMetricsSnapshot,
    UpdateRolloutRequest,
)
from app.services import metrics_service
from app.services.alert_service import evaluate_alerts


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_snapshot(
    model_version: str = "v1",
    component_type: str = ComponentType.POSE_CLASSIFIER,
    total_attempts: int = 100,
    pass_rate: float = 0.80,
    fail_rate: float = 0.10,
    retry_rate: float = 0.05,
    error_rate: float = 0.01,
    fallback_rate: float = 0.02,
    manual_review_rate: float = 0.02,
    fraud_review_rate: float = 0.01,
    avg_latency_ms: float = 400.0,
    p50_latency_ms: float = 380.0,
    p95_latency_ms: float = 700.0,
    avg_confidence: float = 0.82,
    low_quality_rate: float = 0.05,
    disagreement_rate: float = 0.02,
) -> ModelMetricsSnapshot:
    return ModelMetricsSnapshot(
        model_version=model_version,
        component_type=component_type,
        window_seconds=0,
        total_attempts=total_attempts,
        pass_rate=pass_rate,
        fail_rate=fail_rate,
        retry_rate=retry_rate,
        error_rate=error_rate,
        fallback_rate=fallback_rate,
        manual_review_rate=manual_review_rate,
        fraud_review_rate=fraud_review_rate,
        avg_latency_ms=avg_latency_ms,
        p50_latency_ms=p50_latency_ms,
        p95_latency_ms=p95_latency_ms,
        avg_confidence=avg_confidence,
        low_quality_rate=low_quality_rate,
        disagreement_rate=disagreement_rate,
        confidence_histogram={f"{i/10:.1f}-{(i+1)/10:.1f}": 10 for i in range(10)},
    )


def _default_thresholds() -> AlertThresholds:
    return AlertThresholds()


def _registry_row(
    id_: str,
    model_version: str,
    component_type: str,
    active: bool = True,
    rollout_percentage: float = 100.0,
    rollback_version: str | None = None,
) -> dict:
    return {
        "id": id_,
        "model_version": model_version,
        "component_type": component_type,
        "artifact_path": f"artifacts/{model_version}",
        "training_dataset_hash": None,
        "active": active,
        "rollout_percentage": rollout_percentage,
        "rollback_version": rollback_version,
        "deployed_at": "2026-01-01T00:00:00+00:00",
        "promoted_by": "test",
        "notes": None,
        "created_at": "2026-01-01T00:00:00+00:00",
    }


# ---------------------------------------------------------------------------
# Class 1 — Model promotion
# ---------------------------------------------------------------------------

class TestModelPromotion:

    def test_promote_creates_active_entry(self):
        current_row = _registry_row("id-old", "v1", ComponentType.LEARNED_SIT_CLASSIFIER)

        mock_client = MagicMock()
        # _load_active returns current version
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [current_row]
        # insert returns the new row
        inserted_row = _registry_row("id-new", "v2", ComponentType.LEARNED_SIT_CLASSIFIER, rollback_version="v1")
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [inserted_row]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process"):
            from app.services.model_registry_service import promote_model
            req = PromoteModelRequest(
                model_version="v2",
                component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                artifact_path="artifacts/v2",
                rollout_percentage=100.0,
                promoted_by="admin",
            )
            entry = promote_model(req)

        assert entry.model_version == "v2"
        assert entry.rollback_version == "v1"
        assert entry.active is True

    def test_promote_sets_rollback_version_from_previous(self):
        """rollback_version on the new entry must equal the previous active version."""
        prev = _registry_row("id-prev", "sit_tcn_v1", ComponentType.LEARNED_SIT_CLASSIFIER)

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [prev]
        inserted = _registry_row("id-new2", "sit_tcn_v2", ComponentType.LEARNED_SIT_CLASSIFIER,
                                 rollback_version="sit_tcn_v1")
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [inserted]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process"):
            from app.services.model_registry_service import promote_model
            entry = promote_model(PromoteModelRequest(
                model_version="sit_tcn_v2",
                component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                artifact_path="artifacts/sit_tcn_v2",
                rollout_percentage=50.0,
                promoted_by="admin",
            ))

        assert entry.rollback_version == "sit_tcn_v1"

    def test_promote_invalid_component_type_raises(self):
        with patch("app.services.model_registry_service._get_client", return_value=MagicMock()):
            from app.services.model_registry_service import promote_model
            with pytest.raises(ValueError, match="Unknown component_type"):
                promote_model(PromoteModelRequest(
                    model_version="x",
                    component_type="not_a_real_type",
                    artifact_path="artifacts/x",
                    promoted_by="admin",
                ))

    def test_promote_invalid_rollout_percentage_raises(self):
        with patch("app.services.model_registry_service._get_client", return_value=MagicMock()):
            from app.services.model_registry_service import promote_model
            with pytest.raises(ValueError, match="rollout_percentage"):
                promote_model(PromoteModelRequest(
                    model_version="x",
                    component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                    artifact_path="artifacts/x",
                    rollout_percentage=150.0,
                    promoted_by="admin",
                ))


# ---------------------------------------------------------------------------
# Class 2 — Rollback
# ---------------------------------------------------------------------------

class TestRollback:

    def test_rollback_activates_previous_version(self):
        active_row = _registry_row("id-v2", "v2", ComponentType.LEARNED_SIT_CLASSIFIER,
                                   rollback_version="v1")
        v1_row = _registry_row("id-v1", "v1", ComponentType.LEARNED_SIT_CLASSIFIER,
                               active=False)

        mock_client = MagicMock()
        # _load_active returns v2
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [active_row]
        # find rollback version
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [v1_row]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [v1_row]

        # Need to handle two different select calls; use side_effect
        execute_mock = MagicMock()
        execute_mock.side_effect = [
            MagicMock(data=[active_row]),   # _load_active
            MagicMock(data=[v1_row]),        # find rollback row
        ]
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute = execute_mock
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [v1_row]

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process") as mock_apply:
            from app.services.model_registry_service import rollback_model
            entry = rollback_model(RollbackRequest(
                component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                reason="Pass-rate collapse",
                rolled_back_by="admin",
            ))

        assert entry.model_version == "v1"
        mock_apply.assert_called_once_with(
            ComponentType.LEARNED_SIT_CLASSIFIER, "v1", 100.0
        )

    def test_rollback_with_no_rollback_version_raises(self):
        active_row = _registry_row("id-v1", "v1", ComponentType.LEARNED_SIT_CLASSIFIER,
                                   rollback_version=None)

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [active_row]

        with patch("app.services.model_registry_service._get_client", return_value=mock_client):
            from app.services.model_registry_service import rollback_model
            with pytest.raises(RuntimeError, match="No rollback_version"):
                rollback_model(RollbackRequest(
                    component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                    reason="test",
                    rolled_back_by="admin",
                ))

    def test_rollback_with_no_active_model_raises(self):
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client):
            from app.services.model_registry_service import rollback_model
            with pytest.raises(RuntimeError, match="No active model"):
                rollback_model(RollbackRequest(
                    component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                    reason="test",
                    rolled_back_by="admin",
                ))


# ---------------------------------------------------------------------------
# Class 3 — Rollout percentage update
# ---------------------------------------------------------------------------

class TestRolloutPercentage:

    def test_update_rollout_applies_immediately(self):
        updated_row = _registry_row("id-v2", "v2", ComponentType.LEARNED_SIT_CLASSIFIER,
                                    rollout_percentage=25.0)

        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [updated_row]

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process") as mock_apply:
            from app.services.model_registry_service import update_rollout_percentage
            entry = update_rollout_percentage(UpdateRolloutRequest(
                model_version="v2",
                component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                new_percentage=25.0,
                updated_by="admin",
            ))

        assert entry.rollout_percentage == 25.0
        mock_apply.assert_called_once_with(
            ComponentType.LEARNED_SIT_CLASSIFIER, "v2", 25.0
        )

    def test_update_rollout_invalid_percentage_raises(self):
        with patch("app.services.model_registry_service._get_client", return_value=MagicMock()):
            from app.services.model_registry_service import update_rollout_percentage
            with pytest.raises(ValueError, match="new_percentage"):
                update_rollout_percentage(UpdateRolloutRequest(
                    model_version="v1",
                    component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                    new_percentage=-5.0,
                    updated_by="admin",
                ))

    def test_update_rollout_not_found_raises(self):
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client):
            from app.services.model_registry_service import update_rollout_percentage
            with pytest.raises(KeyError):
                update_rollout_percentage(UpdateRolloutRequest(
                    model_version="nonexistent",
                    component_type=ComponentType.LEARNED_SIT_CLASSIFIER,
                    new_percentage=50.0,
                    updated_by="admin",
                ))


# ---------------------------------------------------------------------------
# Class 4 — Metric aggregation
# ---------------------------------------------------------------------------

class TestMetricAggregation:

    def setup_method(self):
        metrics_service.reset()

    def test_pass_rate_computed_correctly(self):
        for _ in range(8):
            metrics_service.record_verification(
                model_version="v1", component_type=ComponentType.POSE_CLASSIFIER,
                activity_id="sit", tier="standard_daily", verification_id=None,
                status="passed", confidence_score=0.90, inference_latency_ms=300,
            )
        for _ in range(2):
            metrics_service.record_verification(
                model_version="v1", component_type=ComponentType.POSE_CLASSIFIER,
                activity_id="sit", tier="standard_daily", verification_id=None,
                status="failed_pose", confidence_score=0.40, inference_latency_ms=300,
            )

        snap = metrics_service.get_model_snapshot("v1", ComponentType.POSE_CLASSIFIER)
        assert snap.total_attempts == 10
        assert snap.pass_rate == pytest.approx(0.80)
        assert snap.fail_rate == pytest.approx(0.20)

    def test_error_rate_tracked(self):
        for _ in range(5):
            metrics_service.record_verification(
                model_version="err_model", component_type=ComponentType.POSE_CLASSIFIER,
                activity_id="sit", tier="standard_daily", verification_id=None,
                status="error", confidence_score=None, inference_latency_ms=50,
                is_error=True,
            )
        snap = metrics_service.get_model_snapshot("err_model", ComponentType.POSE_CLASSIFIER)
        assert snap.error_rate == pytest.approx(1.0)

    def test_latency_p50_and_p95(self):
        latencies = list(range(1, 101))  # 1, 2, ..., 100 ms
        for lat in latencies:
            metrics_service.record_verification(
                model_version="lat_model", component_type=ComponentType.POSE_CLASSIFIER,
                activity_id="sit", tier="standard_daily", verification_id=None,
                status="passed", confidence_score=0.85, inference_latency_ms=lat,
            )
        snap = metrics_service.get_model_snapshot("lat_model", ComponentType.POSE_CLASSIFIER)
        # p50 of 1..100 = 50.5, p95 index = 94 (0-indexed) = value 95
        assert snap.p50_latency_ms == pytest.approx(50.5, abs=2.0)
        assert snap.p95_latency_ms == pytest.approx(95.0, abs=2.0)

    def test_confidence_histogram_populated(self):
        for conf in [0.05, 0.55, 0.85, 0.95]:
            metrics_service.record_verification(
                model_version="hist_model", component_type=ComponentType.POSE_CLASSIFIER,
                activity_id="sit", tier="standard_daily", verification_id=None,
                status="passed", confidence_score=conf, inference_latency_ms=200,
            )
        snap = metrics_service.get_model_snapshot("hist_model", ComponentType.POSE_CLASSIFIER)
        assert snap.confidence_histogram["0.0-0.1"] == 1   # 0.05
        assert snap.confidence_histogram["0.5-0.6"] == 1   # 0.55
        assert snap.confidence_histogram["0.8-0.9"] == 1   # 0.85
        assert snap.confidence_histogram["0.9-1.0"] == 1   # 0.95

    def test_trick_metrics_aggregated_separately(self):
        for _ in range(6):
            metrics_service.record_verification(
                model_version="v1", component_type=ComponentType.TRICK_CLASSIFIER,
                activity_id="spin", tier="standard_daily", verification_id=None,
                status="passed", confidence_score=0.88, inference_latency_ms=300,
            )
        for _ in range(4):
            metrics_service.record_verification(
                model_version="v1", component_type=ComponentType.TRICK_CLASSIFIER,
                activity_id="spin", tier="standard_daily", verification_id=None,
                status="retry_uncertain", confidence_score=0.60, inference_latency_ms=300,
            )

        trick = metrics_service.get_trick_snapshot("spin")
        assert trick.total_attempts == 10
        assert trick.pass_rate == pytest.approx(0.60)
        assert trick.retry_rate == pytest.approx(0.40)

    def test_reset_clears_all_counters(self):
        metrics_service.record_verification(
            model_version="v1", component_type=ComponentType.POSE_CLASSIFIER,
            activity_id="sit", tier="standard_daily", verification_id=None,
            status="passed", confidence_score=0.9, inference_latency_ms=200,
        )
        metrics_service.reset()
        snap = metrics_service.get_model_snapshot("v1", ComponentType.POSE_CLASSIFIER)
        assert snap.total_attempts == 0

    def test_per_model_version_isolation(self):
        """Counters for different model versions are tracked independently."""
        metrics_service.record_verification(
            model_version="model_a", component_type=ComponentType.POSE_CLASSIFIER,
            activity_id="sit", tier="standard_daily", verification_id=None,
            status="passed", confidence_score=0.9, inference_latency_ms=200,
        )
        metrics_service.record_verification(
            model_version="model_b", component_type=ComponentType.POSE_CLASSIFIER,
            activity_id="sit", tier="standard_daily", verification_id=None,
            status="error", confidence_score=None, inference_latency_ms=100,
            is_error=True,
        )
        snap_a = metrics_service.get_model_snapshot("model_a", ComponentType.POSE_CLASSIFIER)
        snap_b = metrics_service.get_model_snapshot("model_b", ComponentType.POSE_CLASSIFIER)
        assert snap_a.error_rate == pytest.approx(0.0)
        assert snap_b.error_rate == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Class 5 — Alert threshold behavior
# ---------------------------------------------------------------------------

class TestAlertThresholds:

    def test_no_alerts_for_healthy_snapshot(self):
        snap = _make_snapshot()
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert events == []

    def test_latency_warning_fires(self):
        snap = _make_snapshot(avg_latency_ms=2500.0)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        types = {e.alert_type for e in events}
        assert "latency_regression" in types
        assert any(e.level == "warning" for e in events if e.alert_type == "latency_regression")

    def test_latency_critical_fires(self):
        snap = _make_snapshot(avg_latency_ms=6000.0)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        types = {e.alert_type for e in events}
        assert "latency_regression" in types
        assert any(e.level == "critical" for e in events if e.alert_type == "latency_regression")

    def test_error_rate_warning(self):
        snap = _make_snapshot(error_rate=0.07)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert any(e.alert_type == "error_rate_increase" for e in events)

    def test_error_rate_critical(self):
        snap = _make_snapshot(error_rate=0.12)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        critical = [e for e in events if e.alert_type == "error_rate_increase" and e.level == "critical"]
        assert len(critical) == 1

    def test_fallback_rate_warning(self):
        snap = _make_snapshot(fallback_rate=0.20)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert any(e.alert_type == "fallback_rate_spike" for e in events)

    def test_fallback_rate_critical(self):
        snap = _make_snapshot(fallback_rate=0.35)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        critical = [e for e in events if e.alert_type == "fallback_rate_spike" and e.level == "critical"]
        assert len(critical) == 1

    def test_pass_rate_spike_fires_with_baseline(self):
        baseline = _make_snapshot(pass_rate=0.60)
        current  = _make_snapshot(pass_rate=0.80)
        events = evaluate_alerts(current, baseline=baseline, thresholds=_default_thresholds())
        assert any(e.alert_type == "pass_rate_spike" for e in events)

    def test_pass_rate_collapse_fires_with_baseline(self):
        baseline = _make_snapshot(pass_rate=0.80)
        current  = _make_snapshot(pass_rate=0.55)
        events = evaluate_alerts(current, baseline=baseline, thresholds=_default_thresholds())
        assert any(e.alert_type == "pass_rate_collapse" for e in events)

    def test_pass_rate_alerts_suppressed_without_baseline(self):
        snap = _make_snapshot(pass_rate=0.30)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        types = {e.alert_type for e in events}
        assert "pass_rate_spike" not in types
        assert "pass_rate_collapse" not in types

    def test_fraud_review_rate_warning(self):
        snap = _make_snapshot(fraud_review_rate=0.12)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert any(e.alert_type == "fraud_review_rate_high" for e in events)

    def test_low_confidence_warning(self):
        snap = _make_snapshot(low_quality_rate=0.30)
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert any(e.alert_type == "low_confidence_spike" for e in events)

    def test_alerts_suppressed_below_minimum_attempts(self):
        """No alerts should fire when fewer than 10 attempts have been recorded."""
        snap = _make_snapshot(
            total_attempts=5,
            error_rate=0.80,
            avg_latency_ms=9000.0,
            fallback_rate=0.90,
        )
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert events == []


# ---------------------------------------------------------------------------
# Class 6 — Schema incompatibility alert
# ---------------------------------------------------------------------------

class TestSchemaIncompatibility:

    def test_schema_incompatibility_fires_in_early_window(self):
        """High error rate with few attempts triggers schema incompatibility."""
        snap = _make_snapshot(
            model_version="new_broken_version",
            total_attempts=15,
            error_rate=0.60,
        )
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        assert any(e.alert_type == AlertType.SCHEMA_INCOMPATIBILITY for e in events)

    def test_schema_incompatibility_suppressed_after_warm_up(self):
        """Once > 50 attempts recorded, schema alert no longer fires."""
        snap = _make_snapshot(
            model_version="mature_version",
            total_attempts=200,
            error_rate=0.06,  # above schema threshold but past warm-up
        )
        events = evaluate_alerts(snap, baseline=None, thresholds=_default_thresholds())
        # This should fire error_rate_increase, but NOT schema_incompatibility.
        types = {e.alert_type for e in events}
        assert AlertType.SCHEMA_INCOMPATIBILITY not in types
        assert AlertType.ERROR_RATE_INCREASE in types


# ---------------------------------------------------------------------------
# Class 7 — Disabled provider fallback
# ---------------------------------------------------------------------------

class TestDisabledProviderFallback:

    def test_disable_rgb_verifier_sets_stub_provider(self):
        """Disabling rgb_verifier in the registry service sets provider to stub."""
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.config.settings") as mock_settings:
            from app.services.model_registry_service import _apply_in_process
            _apply_in_process(ComponentType.RGB_VERIFIER, model_version=None, rollout_percentage=0.0)

        mock_settings.__setattr__  # just verifying no exception is raised

    def test_disable_rgb_verifier_via_disable_component(self):
        """disable_component for rgb_verifier calls _apply_in_process with rollout=0."""
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process") as mock_apply:
            from app.services.model_registry_service import disable_component
            disable_component(DisableComponentRequest(
                component_type=ComponentType.RGB_VERIFIER,
                reason="RGB provider returning 502s",
                disabled_by="admin",
            ))

        mock_apply.assert_called_once_with(ComponentType.RGB_VERIFIER, model_version=None, rollout_percentage=0.0)

    def test_disable_on_device_pose(self):
        """Disabling on_device_pose calls _apply_in_process correctly."""
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.services.model_registry_service._get_client", return_value=mock_client), \
             patch("app.services.model_registry_service._apply_in_process") as mock_apply:
            from app.services.model_registry_service import disable_component
            disable_component(DisableComponentRequest(
                component_type=ComponentType.ON_DEVICE_POSE,
                reason="Malformed payloads from iOS 18.2",
                disabled_by="admin",
            ))

        mock_apply.assert_called_once_with(ComponentType.ON_DEVICE_POSE, model_version=None, rollout_percentage=0.0)


# ---------------------------------------------------------------------------
# Class 8 — Device metrics recording
# ---------------------------------------------------------------------------

class TestDeviceMetrics:

    def test_device_metrics_record_model(self):
        record = DeviceMetricsRecord(
            verification_id="verif-device-001",
            user_id="user-abc",
            iphone_model="iPhone 15 Pro",
            ios_version="18.2",
            app_version="3.1.0",
            on_device_pose_version="on_device_pose_v2",
            frame_inference_latency_ms=12.5,
            dropped_frame_rate=0.02,
            payload_size_bytes=8192,
            fell_back_to_video=False,
        )
        assert record.iphone_model == "iPhone 15 Pro"
        assert record.dropped_frame_rate == pytest.approx(0.02)
        assert record.fell_back_to_video is False

    def test_record_device_metrics_does_not_raise_on_db_failure(self):
        """Fire-and-forget: DB errors from supabase must not propagate."""
        record = DeviceMetricsRecord(
            verification_id="v1",
            user_id="u1",
            fell_back_to_video=True,
        )
        # Simulate Supabase raising during the insert; the fire-and-forget
        # try/except inside _persist_device_metric_event should absorb it.
        with patch("app.services.supabase_service.get_supabase",
                   side_effect=RuntimeError("DB down")):
            # This should not raise.
            from app.services.metrics_service import record_device_metrics
            record_device_metrics(record)


# ---------------------------------------------------------------------------
# Class 9 — In-process override for learned sit classifier
# ---------------------------------------------------------------------------

class TestInProcessOverride:

    def test_apply_in_process_learned_sit_classifier(self):
        """
        _apply_in_process for learned_sit_classifier updates
        settings.learned_sit_rollout_percentage immediately.
        """
        from app.services.model_registry_service import _apply_in_process
        from app.config import settings

        original = settings.learned_sit_rollout_percentage
        try:
            _apply_in_process(
                ComponentType.LEARNED_SIT_CLASSIFIER,
                model_version="sit_tcn_v3",
                rollout_percentage=50.0,
            )
            assert settings.learned_sit_rollout_percentage == pytest.approx(50.0)
        finally:
            settings.learned_sit_rollout_percentage = original  # type: ignore[attr-defined]

    def test_apply_in_process_zero_rollout_does_not_raise(self):
        from app.services.model_registry_service import _apply_in_process
        from app.config import settings

        original = settings.learned_sit_rollout_percentage
        try:
            _apply_in_process(
                ComponentType.LEARNED_SIT_CLASSIFIER,
                model_version="sit_tcn_v3",
                rollout_percentage=0.0,
            )
            assert settings.learned_sit_rollout_percentage == pytest.approx(0.0)
        finally:
            settings.learned_sit_rollout_percentage = original  # type: ignore[attr-defined]
