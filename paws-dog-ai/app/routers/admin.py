"""
Admin operations router.

All endpoints require the admin API key (same Bearer token as /review and
/anti-cheat).

Sections
--------
  Model registry
    GET  /admin/models
    POST /admin/models/promote
    POST /admin/models/rollback
    POST /admin/models/rollout
    POST /admin/components/disable

  Metrics
    GET  /admin/metrics
    GET  /admin/metrics/{model_version}
    GET  /admin/metrics/tricks
    GET  /admin/metrics/devices

  Alerts
    GET  /admin/alerts

  Health summary
    GET  /admin/status
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.models.monitoring_models import (
    AlertEvent,
    AlertThresholds,
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

router = APIRouter(prefix="/admin", tags=["admin"])
_bearer = HTTPBearer(auto_error=False)


def _require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="Admin API key is not configured.")
    if credentials is None or credentials.credentials != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin API key.")


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

@router.get(
    "/models",
    response_model=list[ModelRegistryEntry],
    dependencies=[Depends(_require_admin)],
)
def list_active_models() -> list[ModelRegistryEntry]:
    """Return the currently active model version for every component type."""
    from app.services.model_registry_service import get_all_active_models  # noqa: PLC0415
    return get_all_active_models()


@router.get(
    "/models/{component_type}/history",
    response_model=list[ModelRegistryEntry],
    dependencies=[Depends(_require_admin)],
)
def model_history(
    component_type: str,
    limit: int = Query(20, ge=1, le=100),
) -> list[ModelRegistryEntry]:
    """Return the N most recent registry entries for a component type."""
    if component_type not in ComponentType.ALL:
        raise HTTPException(status_code=400, detail=f"Unknown component_type: {component_type!r}")
    from app.services.model_registry_service import get_model_history  # noqa: PLC0415
    return get_model_history(component_type, limit=limit)


@router.post(
    "/models/promote",
    response_model=ModelRegistryEntry,
    dependencies=[Depends(_require_admin)],
)
def promote_model(req: PromoteModelRequest) -> ModelRegistryEntry:
    """
    Promote a model version to active.

    The previous active version is recorded as rollback_version and
    deactivated.  Traffic switches immediately for components that support
    in-process override (learned_sit_classifier, rgb_verifier, on_device_pose).
    Components that load weights at startup (pose_classifier, trick_classifier,
    combo_classifier) require a process restart to load new weights — the
    registry is updated, but inference uses the loaded weights until restart.
    """
    try:
        from app.services.model_registry_service import promote_model as _promote  # noqa: PLC0415
        return _promote(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/models/rollback",
    response_model=ModelRegistryEntry,
    dependencies=[Depends(_require_admin)],
)
def rollback_model(req: RollbackRequest) -> ModelRegistryEntry:
    """
    Immediately rollback the active version of a component to its
    previously active version.

    Returns 400 if no rollback_version is recorded.  In that case, use
    POST /admin/models/promote to manually promote a known-good version.
    """
    try:
        from app.services.model_registry_service import rollback_model as _rollback  # noqa: PLC0415
        return _rollback(req)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/models/rollout",
    response_model=ModelRegistryEntry,
    dependencies=[Depends(_require_admin)],
)
def update_rollout(req: UpdateRolloutRequest) -> ModelRegistryEntry:
    """
    Change the rollout percentage for an active model version.

    Set to 0 to send all traffic to the rule-based fallback without a full
    rollback cycle.  Applies immediately to the current process for supported
    components.
    """
    try:
        from app.services.model_registry_service import update_rollout_percentage  # noqa: PLC0415
        return update_rollout_percentage(req)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/components/disable",
    status_code=200,
    dependencies=[Depends(_require_admin)],
)
def disable_component(req: DisableComponentRequest) -> dict:
    """
    Disable all versions of a component.

    For on_device_pose: stops accepting on-device frames; server-side inference
    takes over for all subsequent requests.
    For rgb_verifier: the stub verifier is substituted immediately.
    For learned_sit_classifier: rollout drops to 0; rule-based classifier serves all traffic.
    """
    try:
        from app.services.model_registry_service import disable_component as _disable  # noqa: PLC0415
        _disable(req)
        return {"status": "disabled", "component_type": req.component_type}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

@router.get(
    "/metrics",
    response_model=list[ModelMetricsSnapshot],
    dependencies=[Depends(_require_admin)],
)
def all_metrics() -> list[ModelMetricsSnapshot]:
    """Return current in-memory metrics for every tracked model version."""
    from app.services.metrics_service import get_all_model_snapshots  # noqa: PLC0415
    return get_all_model_snapshots()


@router.get(
    "/metrics/tricks",
    response_model=list[TrickMetricsSnapshot],
    dependencies=[Depends(_require_admin)],
)
def trick_metrics() -> list[TrickMetricsSnapshot]:
    """Return per-trick metrics aggregated since service startup."""
    from app.services.metrics_service import get_all_trick_snapshots  # noqa: PLC0415
    return get_all_trick_snapshots()


@router.get(
    "/metrics/devices",
    response_model=list[dict],
    dependencies=[Depends(_require_admin)],
)
def device_metrics(
    limit: int  = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    """
    Return recent on-device telemetry rows from device_metric_events.
    Ordered by most-recent first.
    """
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        rows = (
            get_supabase()
            .table("device_metric_events")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
            .data or []
        )
        return rows
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/metrics/{model_version}",
    response_model=ModelMetricsSnapshot,
    dependencies=[Depends(_require_admin)],
)
def model_version_metrics(
    model_version: str,
    component_type: str = Query(ComponentType.POSE_CLASSIFIER),
) -> ModelMetricsSnapshot:
    """Return current in-memory metrics for a specific model version."""
    from app.services.metrics_service import get_model_snapshot  # noqa: PLC0415
    return get_model_snapshot(model_version, component_type)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get(
    "/alerts",
    response_model=list[AlertEvent],
    dependencies=[Depends(_require_admin)],
)
def evaluate_alerts(
    persist: bool = Query(True, description="Write fired alerts to alert_log"),
) -> list[AlertEvent]:
    """
    Evaluate alert thresholds against current in-memory metrics and return
    any that have fired.

    Set persist=false to do a dry-run without writing to the DB.
    """
    from app.services.alert_service import evaluate_all, persist_alerts  # noqa: PLC0415
    from app.services.metrics_service import get_all_model_snapshots     # noqa: PLC0415

    snapshots = get_all_model_snapshots()
    thresholds = AlertThresholds(
        latency_warning_ms=settings.alert_latency_warning_ms,
        latency_critical_ms=settings.alert_latency_critical_ms,
        p95_latency_warning_ms=settings.alert_p95_latency_warning_ms,
        p95_latency_critical_ms=settings.alert_p95_latency_critical_ms,
        error_rate_warning=settings.alert_error_rate_warning,
        error_rate_critical=settings.alert_error_rate_critical,
        fallback_rate_warning=settings.alert_fallback_rate_warning,
        fallback_rate_critical=settings.alert_fallback_rate_critical,
        pass_rate_spike_delta=settings.alert_pass_rate_spike_delta,
        pass_rate_collapse_delta=settings.alert_pass_rate_collapse_delta,
        low_quality_warning=settings.alert_low_quality_warning,
        fraud_review_rate_warning=settings.alert_fraud_review_rate_warning,
        schema_incompatibility_error_rate=settings.alert_schema_incompatibility_error_rate,
    )
    events = evaluate_all(snapshots, baselines={}, thresholds=thresholds)
    if persist and events:
        persist_alerts(events)
    return events


@router.get(
    "/alerts/history",
    response_model=list[dict],
    dependencies=[Depends(_require_admin)],
)
def alert_history(
    resolved: bool  = Query(False),
    limit: int      = Query(50, ge=1, le=200),
    offset: int     = Query(0, ge=0),
) -> list[dict]:
    """Return historical alert records from alert_log."""
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        rows = (
            get_supabase()
            .table("alert_log")
            .select("*")
            .eq("resolved", resolved)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
            .data or []
        )
        return rows
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Service status summary
# ---------------------------------------------------------------------------

@router.get(
    "/status",
    dependencies=[Depends(_require_admin)],
)
def service_status() -> dict:
    """
    Return a summary of active model versions and current health metrics.
    Convenience endpoint for operator dashboards.
    """
    from app.services.model_registry_service import get_all_active_models  # noqa: PLC0415
    from app.services.metrics_service import get_all_model_snapshots        # noqa: PLC0415

    try:
        active_models = get_all_active_models()
    except Exception:  # noqa: BLE001
        active_models = []

    snapshots = get_all_model_snapshots()

    return {
        "service_version": settings.service_version,
        "environment": settings.environment,
        "active_models": [
            {
                "model_version":       m.model_version,
                "component_type":      m.component_type,
                "rollout_percentage":  m.rollout_percentage,
                "deployed_at":         m.deployed_at,
            }
            for m in active_models
        ],
        "metrics_summary": [
            {
                "model_version":  s.model_version,
                "component_type": s.component_type,
                "total_attempts": s.total_attempts,
                "pass_rate":      round(s.pass_rate, 4),
                "error_rate":     round(s.error_rate, 4),
                "avg_latency_ms": round(s.avg_latency_ms, 1),
                "p95_latency_ms": round(s.p95_latency_ms, 1),
            }
            for s in snapshots
        ],
        "config": {
            "hybrid_pose_confidence_threshold":    settings.hybrid_pose_confidence_threshold,
            "hybrid_anomaly_threshold":            settings.hybrid_anomaly_threshold,
            "learned_sit_rollout_percentage":      settings.learned_sit_rollout_percentage,
            "learned_sit_shadow_mode":             settings.learned_sit_shadow_mode,
            "rgb_verifier_provider":               settings.rgb_verifier_provider,
            "anti_cheat_proceed_threshold":        settings.anti_cheat_proceed_threshold,
            "anti_cheat_block_threshold":          settings.anti_cheat_block_threshold,
        },
    }
