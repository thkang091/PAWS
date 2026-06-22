"""
Model registry service.

Provides admin operations over the model_registry table:
  promote_model          — register a new version and make it active.
  update_rollout_percentage — change traffic split without a full promotion.
  rollback_model         — activate the rollback_version for a component.
  disable_component      — mark all versions of a component inactive.
  get_active_model       — return the currently active entry for a component.
  get_all_active_models  — return active entries for all components.
  get_model_history      — return the N most recent entries for a component.

All DB writes are wrapped in try/except and re-raise so callers can surface
errors to the admin API; this is intentional (admin ops must not silently fail).
In-memory config override is applied immediately for the current process after
each registry mutation, so the service does not need a restart.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.monitoring_models import (
    ComponentType,
    DisableComponentRequest,
    ModelRegistryEntry,
    PromoteModelRequest,
    RollbackRequest,
    UpdateRolloutRequest,
)
from app.utils.logging import log_info, log_warn


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def promote_model(req: PromoteModelRequest) -> ModelRegistryEntry:
    """
    Register a new model version and mark it active.

    Steps:
    1. Find the current active version for this component (becomes rollback_version).
    2. Mark the current active version inactive.
    3. Insert (or upsert) the new version as active.
    4. Apply in-memory config override so this process serves the new version
       immediately without a restart.
    """
    if req.component_type not in ComponentType.ALL:
        raise ValueError(f"Unknown component_type: {req.component_type!r}")
    if not (0.0 <= req.rollout_percentage <= 100.0):
        raise ValueError("rollout_percentage must be 0.0 – 100.0.")

    client = _get_client()
    now = datetime.now(timezone.utc).isoformat()

    # 1. Find current active version to set as rollback target.
    existing = _load_active(client, req.component_type)
    rollback_version = existing["model_version"] if existing else None

    # 2. Deactivate current active version.
    if existing:
        client.table("model_registry").update({"active": False}).eq(
            "id", existing["id"]
        ).execute()

    # 3. Insert the new version.
    row = {
        "model_version":         req.model_version,
        "component_type":        req.component_type,
        "artifact_path":         req.artifact_path,
        "training_dataset_hash": req.training_dataset_hash,
        "active":                True,
        "rollout_percentage":    req.rollout_percentage,
        "rollback_version":      rollback_version,
        "promoted_by":           req.promoted_by,
        "notes":                 req.notes,
        "deployed_at":           now,
    }
    result = client.table("model_registry").insert(row).execute()
    inserted = (result.data or [{}])[0]

    log_info(
        "model_registry",
        "model_promoted",
        model_version=req.model_version,
        component_type=req.component_type,
        rollout_percentage=req.rollout_percentage,
        rollback_version=rollback_version,
        promoted_by=req.promoted_by,
    )

    # 4. Apply in-process override.
    _apply_in_process(req.component_type, req.model_version, req.rollout_percentage)

    return _row_to_entry(inserted)


def update_rollout_percentage(req: UpdateRolloutRequest) -> ModelRegistryEntry:
    """
    Change the rollout percentage for an active model version without a full
    promotion cycle.  Applies immediately to the current process.
    """
    if not (0.0 <= req.new_percentage <= 100.0):
        raise ValueError("new_percentage must be 0.0 – 100.0.")

    client = _get_client()
    result = (
        client.table("model_registry")
        .update({"rollout_percentage": req.new_percentage})
        .eq("model_version", req.model_version)
        .eq("component_type", req.component_type)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise KeyError(
            f"No registry entry found for {req.model_version!r} / {req.component_type!r}."
        )

    log_info(
        "model_registry",
        "rollout_percentage_updated",
        model_version=req.model_version,
        component_type=req.component_type,
        new_percentage=req.new_percentage,
        updated_by=req.updated_by,
    )

    _apply_in_process(req.component_type, req.model_version, req.new_percentage)
    return _row_to_entry(rows[0])


def rollback_model(req: RollbackRequest) -> ModelRegistryEntry:
    """
    Immediately roll back the active version of a component to its
    rollback_version.

    If the active entry has no rollback_version recorded, raises RuntimeError
    (operator must manually promote a safe version instead).
    """
    client = _get_client()
    now = datetime.now(timezone.utc).isoformat()

    active = _load_active(client, req.component_type)
    if not active:
        raise RuntimeError(f"No active model found for component {req.component_type!r}.")

    rollback_version = active.get("rollback_version")
    if not rollback_version:
        raise RuntimeError(
            f"No rollback_version recorded for {active['model_version']!r} / "
            f"{req.component_type!r}.  Manually promote a safe version."
        )

    # Deactivate current version.
    client.table("model_registry").update({"active": False}).eq(
        "id", active["id"]
    ).execute()

    # Find and activate rollback version.
    rollback_rows = (
        client.table("model_registry")
        .select("*")
        .eq("model_version", rollback_version)
        .eq("component_type", req.component_type)
        .limit(1)
        .execute()
        .data or []
    )

    if rollback_rows:
        client.table("model_registry").update({
            "active":           True,
            "rollout_percentage": 100.0,
        }).eq("id", rollback_rows[0]["id"]).execute()
        activated = rollback_rows[0]
    else:
        # Rollback version entry was deleted; re-insert with minimal info.
        row = {
            "model_version":      rollback_version,
            "component_type":     req.component_type,
            "artifact_path":      active.get("artifact_path", "unknown"),
            "active":             True,
            "rollout_percentage": 100.0,
            "promoted_by":        req.rolled_back_by,
            "notes":              f"Restored by rollback: {req.reason}",
            "deployed_at":        now,
        }
        result = client.table("model_registry").insert(row).execute()
        activated = (result.data or [{}])[0]

    log_warn(
        "model_registry",
        "model_rolled_back",
        previous_version=active["model_version"],
        rollback_version=rollback_version,
        component_type=req.component_type,
        reason=req.reason,
        rolled_back_by=req.rolled_back_by,
    )

    _apply_in_process(req.component_type, rollback_version, 100.0)
    return _row_to_entry(activated)


def disable_component(req: DisableComponentRequest) -> None:
    """
    Mark all versions of a component as inactive.  Traffic to that component
    will fall back to the safe default (e.g., rule-based classifier, stub RGB
    verifier) immediately via in-process override.
    """
    client = _get_client()
    client.table("model_registry").update({"active": False}).eq(
        "component_type", req.component_type
    ).execute()

    log_warn(
        "model_registry",
        "component_disabled",
        component_type=req.component_type,
        reason=req.reason,
        disabled_by=req.disabled_by,
    )

    _apply_in_process(req.component_type, model_version=None, rollout_percentage=0.0)


def get_active_model(component_type: str) -> ModelRegistryEntry | None:
    """Return the currently active registry entry for a component."""
    client = _get_client()
    row = _load_active(client, component_type)
    return _row_to_entry(row) if row else None


def get_all_active_models() -> list[ModelRegistryEntry]:
    """Return active entries for every component type."""
    try:
        client = _get_client()
        rows = (
            client.table("model_registry")
            .select("*")
            .eq("active", True)
            .execute()
            .data or []
        )
        return [_row_to_entry(r) for r in rows]
    except Exception as exc:  # noqa: BLE001
        log_warn("model_registry", "get_all_active_failed", error=str(exc))
        return []


def get_model_history(
    component_type: str,
    limit: int = 20,
) -> list[ModelRegistryEntry]:
    """Return the N most recent registry entries for a component."""
    try:
        client = _get_client()
        rows = (
            client.table("model_registry")
            .select("*")
            .eq("component_type", component_type)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data or []
        )
        return [_row_to_entry(r) for r in rows]
    except Exception as exc:  # noqa: BLE001
        log_warn("model_registry", "get_history_failed", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client():
    from app.services.supabase_service import get_supabase  # noqa: PLC0415
    return get_supabase()


def _load_active(client, component_type: str) -> dict | None:
    rows = (
        client.table("model_registry")
        .select("*")
        .eq("component_type", component_type)
        .eq("active", True)
        .limit(1)
        .execute()
        .data or []
    )
    return rows[0] if rows else None


def _row_to_entry(row: dict) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        id=row.get("id"),
        model_version=row["model_version"],
        component_type=row["component_type"],
        artifact_path=row.get("artifact_path", ""),
        training_dataset_hash=row.get("training_dataset_hash"),
        active=bool(row.get("active")),
        rollout_percentage=float(row.get("rollout_percentage") or 100.0),
        rollback_version=row.get("rollback_version"),
        deployed_at=row.get("deployed_at"),
        promoted_by=row.get("promoted_by"),
        notes=row.get("notes"),
        created_at=row.get("created_at"),
    )


def _apply_in_process(
    component_type: str,
    model_version: str | None,
    rollout_percentage: float,
) -> None:
    """
    Update the live Settings object so the current process picks up the new
    config immediately without a restart.

    Supported components:
      learned_sit_classifier — learned_sit_rollout_percentage
      on_device_pose         — (disable by setting a sentinel version)
      rgb_verifier           — rgb_verifier_provider

    Unknown / pose_classifier components require a process restart to load
    new weights; this function logs a reminder instead.
    """
    try:
        from app.config import settings  # noqa: PLC0415

        if component_type == ComponentType.LEARNED_SIT_CLASSIFIER:
            settings.learned_sit_rollout_percentage = rollout_percentage  # type: ignore[attr-defined]
            if rollout_percentage == 0.0:
                settings.learned_sit_shadow_mode = False  # type: ignore[attr-defined]
            log_info(
                "model_registry",
                "in_process_override_applied",
                component_type=component_type,
                rollout_percentage=rollout_percentage,
            )

        elif component_type == ComponentType.ON_DEVICE_POSE:
            # On-device pose is disabled by pushing a sentinel version name.
            # The on-device service checks this and falls back to server inference.
            if rollout_percentage == 0.0 or model_version is None:
                settings.on_device_pose_disabled = True  # type: ignore[attr-defined]
                log_warn(
                    "model_registry",
                    "on_device_pose_disabled",
                    component_type=component_type,
                )

        elif component_type == ComponentType.RGB_VERIFIER:
            if model_version and rollout_percentage > 0.0:
                settings.rgb_verifier_provider = model_version  # type: ignore[attr-defined]
            else:
                settings.rgb_verifier_provider = "stub"  # type: ignore[attr-defined]
            log_info(
                "model_registry",
                "in_process_override_applied",
                component_type=component_type,
                provider=settings.rgb_verifier_provider,
            )

        elif component_type in (
            ComponentType.POSE_CLASSIFIER,
            ComponentType.TRICK_CLASSIFIER,
            ComponentType.COMBO_CLASSIFIER,
        ):
            # These require a restart to load new model weights.
            log_warn(
                "model_registry",
                "restart_required_for_weight_reload",
                component_type=component_type,
                model_version=model_version,
            )

    except Exception as exc:  # noqa: BLE001
        log_warn(
            "model_registry",
            "in_process_override_failed",
            component_type=component_type,
            error=str(exc),
        )


# Keep ComponentType accessible as a module-level import shorthand.
__all__ = [
    "promote_model",
    "update_rollout_percentage",
    "rollback_model",
    "disable_component",
    "get_active_model",
    "get_all_active_models",
    "get_model_history",
]
