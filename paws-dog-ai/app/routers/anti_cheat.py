"""
Admin-only anti-cheat review API.

Authentication: same Bearer token as the review router.

Endpoints
---------
GET  /anti-cheat/queue
    List anti-cheat audits pending review.

GET  /anti-cheat/account/{user_id}
    Get the current risk profile for a user.

GET  /anti-cheat/{audit_id}
    Get full audit detail.

POST /anti-cheat/{audit_id}/action
    Apply an admin review action (approve, reject, warn, restrict, block,
    clear_false_positive).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.models.anti_cheat_models import (
    AccountRiskProfile,
    AdminReviewRequest,
    AdminReviewResponse,
    AntiCheatAuditDetail,
)
from app.services.anti_cheat_service import AntiCheatService

router = APIRouter(prefix="/anti-cheat", tags=["anti-cheat"])
_bearer = HTTPBearer(auto_error=False)
_service = AntiCheatService()


def _require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="Admin API key is not configured.")
    if credentials is None or credentials.credentials != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin API key.")


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

@router.get(
    "/queue",
    response_model=list[AntiCheatAuditDetail],
    dependencies=[Depends(_require_admin)],
)
def list_queue(
    decision: str = Query("review", description="Filter by decision: review | block_reward | proceed"),
    limit: int   = Query(50, ge=1, le=200),
    offset: int  = Query(0, ge=0),
) -> list[AntiCheatAuditDetail]:
    """List anti-cheat audit records filtered by decision."""
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = (
            client.table("anti_cheat_audits")
            .select("*")
            .eq("decision", decision)
            .is_("reviewed_at", "null")   # unreviewed only
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
            .data or []
        )
        return [_row_to_detail(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Account risk profile
# ---------------------------------------------------------------------------

@router.get(
    "/account/{user_id}",
    response_model=AccountRiskProfile,
    dependencies=[Depends(_require_admin)],
)
def get_account_risk_profile(user_id: str) -> AccountRiskProfile:
    """Get the current risk profile for a user account."""
    from app.services.account_risk_service import load_account_risk_profile  # noqa: PLC0415
    profile = load_account_risk_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"No risk profile found for user {user_id!r}.")
    return profile


# ---------------------------------------------------------------------------
# Audit detail
# ---------------------------------------------------------------------------

@router.get(
    "/{audit_id}",
    response_model=AntiCheatAuditDetail,
    dependencies=[Depends(_require_admin)],
)
def get_audit_detail(audit_id: str) -> AntiCheatAuditDetail:
    """Get full detail for a single anti-cheat audit record."""
    row = _load_row(audit_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Anti-cheat audit {audit_id!r} not found.")
    return _row_to_detail(row)


# ---------------------------------------------------------------------------
# Admin action
# ---------------------------------------------------------------------------

@router.post(
    "/{audit_id}/action",
    response_model=AdminReviewResponse,
    dependencies=[Depends(_require_admin)],
)
def apply_admin_action(audit_id: str, req: AdminReviewRequest) -> AdminReviewResponse:
    """
    Apply an admin review action to an anti-cheat audit.

    Actions
    -------
    approve              — clear the flag; reward becomes eligible.
    reject               — confirm fraud; reward stays blocked.
    warn                 — issue a warning; reward proceeds this time.
    restrict             — temporarily suspend reward redemption.
    block                — block account pending admin review.
    clear_false_positive — remove all flags; reset risk score.
    """
    try:
        return _service.apply_admin_action(audit_id=audit_id, req=req)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_row(audit_id: str) -> dict | None:
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        rows = (
            get_supabase()
            .table("anti_cheat_audits")
            .select("*")
            .eq("id", audit_id)
            .limit(1)
            .execute()
            .data or []
        )
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        return None


def _row_to_detail(row: dict) -> AntiCheatAuditDetail:
    from app.services.account_risk_service import load_account_risk_profile  # noqa: PLC0415
    profile = load_account_risk_profile(row["user_id"])
    return AntiCheatAuditDetail(
        id=row["id"],
        verification_id=row["verification_id"],
        user_id=row["user_id"],
        dog_id=row["dog_id"],
        tier=row["tier"],
        risk_score=float(row.get("risk_score") or 0.0),
        signals=row.get("signals") or [],
        duplicate_match=row.get("duplicate_match"),
        decision=row["decision"],
        reward_eligible=bool(row.get("reward_eligible")),
        anti_cheat_version=row.get("anti_cheat_version") or ANTI_CHEAT_VERSION,
        reviewed_by=row.get("reviewed_by"),
        reviewed_at=row.get("reviewed_at"),
        admin_action=row.get("admin_action"),
        admin_notes=row.get("admin_notes"),
        created_at=row["created_at"],
        account_restriction_state=(
            profile.restriction_state if profile else None
        ),
    )


from app.models.anti_cheat_models import ANTI_CHEAT_VERSION  # noqa: E402
