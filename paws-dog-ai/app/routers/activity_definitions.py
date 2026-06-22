"""
Activity definition admin router.

All endpoints require admin authorization (enforced via _require_admin).

Endpoints
---------
  GET  /admin/capabilities
  POST /admin/activity-definitions/generate
  POST /admin/activity-definitions
  GET  /admin/activity-definitions
  GET  /admin/activity-definitions/{slug}
  PATCH /admin/activity-definitions/{slug}
  POST /admin/activity-definitions/{slug}/publish-experimental
  POST /admin/activity-definitions/{slug}/promote-beta
  POST /admin/activity-definitions/{slug}/disable
  GET  /admin/activity-definitions/{slug}/training-readiness
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.activity_models import (
    ActivityDefinition,
    ActivityDefinitionCreate,
    ActivityDefinitionPatch,
    ActivityDraftResult,
    GenerateActivityRequest,
    TrainingReadiness,
)
from app.services import activity_definition_service as svc
from app.services.capability_registry import list_capabilities
from app.services.draft_generator import get_provider


# Re-use the existing admin auth dependency from the monitoring router.
def _require_admin():
    """
    Dependency that enforces admin authorization.
    Delegates to the shared implementation in app.routers.admin.
    """
    from app.routers.admin import _require_admin as _impl  # noqa: PLC0415
    return _impl()


router = APIRouter(prefix="/admin", tags=["activity-definitions"])


# ---------------------------------------------------------------------------
# Capability registry
# ---------------------------------------------------------------------------

@router.get("/capabilities")
def list_capability_registry(
    _: None = Depends(_require_admin),
):
    """
    Return the full capability registry.

    For each capability reports: name, status, version, requirements,
    and which lifecycle stages / reward tiers it is allowed in.
    """
    caps = list_capabilities()
    return {
        "capabilities": [
            {
                "name":                  c.name,
                "status":                c.status,
                "version":               c.version,
                "module_class_name":     c.module_class_name,
                "requires_rgb":          c.requires_rgb,
                "requires_pose":         c.requires_pose,
                "requires_audio":        c.requires_audio,
                "allowed_experimental":  c.allowed_experimental,
                "allowed_beta":          c.allowed_beta,
                "allowed_certified":     c.allowed_certified,
                "allowed_gold_coins":    c.allowed_gold_coins,
                "allowed_tournaments":   c.allowed_tournaments,
                "notes":                 c.notes,
            }
            for c in caps
        ],
        "total": len(caps),
    }


# ---------------------------------------------------------------------------
# Draft generator
# ---------------------------------------------------------------------------

@router.post("/activity-definitions/generate", response_model=ActivityDraftResult)
def generate_activity_draft(
    request: GenerateActivityRequest,
    _: None = Depends(_require_admin),
):
    """
    Generate a draft activity definition from a natural-language description.

    The returned definition always has verification_status='draft' and is
    never auto-published or auto-certified.  The admin must manually review
    and call the publish-experimental or promote-beta endpoints to advance
    the lifecycle.

    Use the returned draft as input to POST /admin/activity-definitions to
    persist it.
    """
    provider = get_provider(request.generator_provider)
    return provider.generate(request)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("/activity-definitions", response_model=ActivityDefinition, status_code=201)
def create_activity(
    req: ActivityDefinitionCreate,
    _: None = Depends(_require_admin),
):
    """
    Persist a new activity definition.  Always starts in draft status.
    """
    try:
        return svc.create_activity_definition(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/activity-definitions", response_model=list[ActivityDefinition])
def list_activities(
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: None = Depends(_require_admin),
):
    """List activity definitions, optionally filtered by verification_status."""
    return svc.list_activity_definitions(status=status, limit=limit, offset=offset)


@router.get("/activity-definitions/{slug}", response_model=ActivityDefinition)
def get_activity(
    slug: str,
    _: None = Depends(_require_admin),
):
    """Return a single activity definition by slug."""
    definition = svc.get_activity_definition(slug)
    if definition is None:
        raise HTTPException(status_code=404, detail=f"Activity '{slug}' not found.")
    return definition


@router.patch("/activity-definitions/{slug}", response_model=ActivityDefinition)
def patch_activity(
    slug: str,
    patch: ActivityDefinitionPatch,
    _: None = Depends(_require_admin),
):
    """
    Partially update an activity definition.

    Does not change verification_status (use the lifecycle endpoints for that).
    Recomputes missing_capabilities when required_capabilities changes.
    """
    try:
        return svc.patch_activity_definition(slug, patch)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------

@router.post("/activity-definitions/{slug}/publish-experimental",
             response_model=ActivityDefinition)
def publish_experimental(
    slug: str,
    published_by: str = Query(..., description="Admin user ID performing this action"),
    _: None = Depends(_require_admin),
):
    """
    Transition an activity from draft to experimental.

    Experimental activities are visible to internal testers only and
    collect data but cannot award Gold Coins or be used in tournaments.
    """
    try:
        return svc.publish_experimental(slug, published_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/activity-definitions/{slug}/promote-beta",
             response_model=ActivityDefinition)
def promote_beta(
    slug: str,
    promoted_by: str = Query(..., description="Admin user ID performing this action"),
    _: None = Depends(_require_admin),
):
    """
    Transition an activity from experimental to beta.

    Beta activities are available to selected users.  XP is allowed.
    Silver Coins may be enabled manually.  Gold Coins and tournaments
    remain blocked.

    Note: automatic certification is not implemented.  To certify an activity
    for Gold Coins or tournaments, manual evaluation infrastructure must be
    added and the reward_policy must be explicitly updated.
    """
    try:
        return svc.promote_beta(slug, promoted_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/activity-definitions/{slug}/disable",
             response_model=ActivityDefinition)
def disable_activity(
    slug: str,
    reason: str = Query(..., description="Reason for disabling (stored in audit trail)"),
    disabled_by: str = Query(..., description="Admin user ID performing this action"),
    _: None = Depends(_require_admin),
):
    """
    Disable an activity definition from any state.

    Disabled activities reject all new submissions safely.
    """
    try:
        return svc.disable_activity(slug, reason, disabled_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Training readiness
# ---------------------------------------------------------------------------

@router.get("/activity-definitions/{slug}/training-readiness",
            response_model=TrainingReadiness)
def get_training_readiness(
    slug: str,
    _: None = Depends(_require_admin),
):
    """
    Compute and return current training readiness for an activity.

    Does not trigger model training.  Reads label counts from
    activity_data_collection_submissions and reports whether enough
    labeled examples have been collected to begin candidate training.
    """
    return svc.compute_training_readiness(slug)
