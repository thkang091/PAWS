"""
Activity definition service.

Provides CRUD operations and lifecycle transitions for activity_definitions,
plus submission gate enforcement and data collection storage.

All DB reads/writes are wrapped in try/except and re-raise on failure so that
callers (admin router) surface errors correctly.  Hot-path gate checks are
cached in memory for performance.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

from app.models.activity_models import (
    ActivityDefinition,
    ActivityDefinitionCreate,
    ActivityDefinitionPatch,
    DataCollectionRecord,
    SubmissionGateError,
    VerificationStatus,
)
from app.utils.logging import log_info, log_warn


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def get_activity_definition(slug: str) -> ActivityDefinition | None:
    """Load one activity definition by slug.  Returns None if not found."""
    try:
        client = _get_client()
        rows = (
            client.table("activity_definitions")
            .select("*")
            .eq("slug", slug)
            .limit(1)
            .execute()
            .data or []
        )
        return _row_to_def(rows[0]) if rows else None
    except Exception as exc:  # noqa: BLE001
        log_warn("activity_def_service", "get_failed", slug=slug, error=str(exc))
        return None


def list_activity_definitions(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ActivityDefinition]:
    """List activity definitions, optionally filtered by verification_status."""
    try:
        client = _get_client()
        q = client.table("activity_definitions").select("*")
        if status:
            q = q.eq("verification_status", status)
        rows = (
            q.order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
            .data or []
        )
        return [_row_to_def(r) for r in rows]
    except Exception as exc:  # noqa: BLE001
        log_warn("activity_def_service", "list_failed", error=str(exc))
        return []


def create_activity_definition(req: ActivityDefinitionCreate) -> ActivityDefinition:
    """Create a new draft activity definition.  Raises on DB failure."""
    from app.services.capability_registry import get_missing_capabilities  # noqa: PLC0415
    now = datetime.now(timezone.utc).isoformat()

    # Compute missing capabilities at creation time.
    missing = get_missing_capabilities(req.required_capabilities)

    client = _get_client()
    row = {
        "slug":                   req.slug,
        "display_name":           req.display_name,
        "description":            req.description,
        "instructions":           req.instructions,
        "verification_status":    VerificationStatus.DRAFT,
        "verification_strategy":  req.verification_strategy,
        "recording_config":       req.recording_config,
        "success_conditions":     req.success_conditions,
        "failure_conditions":     req.failure_conditions,
        "required_capabilities":  req.required_capabilities,
        "missing_capabilities":   missing,
        "reward_policy":          req.reward_policy or {
            "gold_coins": False, "tournaments": False,
            "xp": True, "silver_coins": False,
        },
        "created_by":             req.created_by,
        "created_at":             now,
        "updated_at":             now,
    }
    result = client.table("activity_definitions").insert(row).execute()
    inserted = (result.data or [{}])[0]
    log_info("activity_def_service", "created", slug=req.slug, created_by=req.created_by)
    _clear_cache(req.slug)
    return _row_to_def(inserted)


def patch_activity_definition(slug: str, patch: ActivityDefinitionPatch) -> ActivityDefinition:
    """Apply a partial update.  Raises if not found or on DB failure."""
    now = datetime.now(timezone.utc).isoformat()
    updates: dict = {"updated_at": now}

    for field in patch.model_fields_set:
        val = getattr(patch, field)
        updates[field] = val

    # Recompute missing capabilities when required_capabilities changes.
    if "required_capabilities" in updates:
        from app.services.capability_registry import get_missing_capabilities  # noqa: PLC0415
        updates["missing_capabilities"] = get_missing_capabilities(updates["required_capabilities"])

    client = _get_client()
    result = (
        client.table("activity_definitions")
        .update(updates)
        .eq("slug", slug)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise KeyError(f"Activity definition {slug!r} not found.")
    _clear_cache(slug)
    return _row_to_def(rows[0])


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------

def publish_experimental(slug: str, published_by: str) -> ActivityDefinition:
    """Transition draft → experimental.  Raises if not in draft state."""
    return _transition(slug, VerificationStatus.EXPERIMENTAL,
                       allowed_from={VerificationStatus.DRAFT},
                       actor=published_by, action="publish_experimental")


def promote_beta(slug: str, promoted_by: str) -> ActivityDefinition:
    """Transition experimental → beta.  Raises if not in experimental state."""
    return _transition(slug, VerificationStatus.BETA,
                       allowed_from={VerificationStatus.EXPERIMENTAL},
                       actor=promoted_by, action="promote_beta")


def disable_activity(slug: str, reason: str, disabled_by: str) -> ActivityDefinition:
    """Transition any state → disabled."""
    return _transition(slug, VerificationStatus.DISABLED,
                       allowed_from=VerificationStatus.ALL - {VerificationStatus.DISABLED},
                       actor=disabled_by, action="disable",
                       extra_fields={"disable_reason": reason})


# ---------------------------------------------------------------------------
# Submission gate
# ---------------------------------------------------------------------------

def check_submission_gate(
    activity_def: ActivityDefinition,
    tier: str,
    user_id: str | None = None,
) -> None:
    """
    Raise SubmissionGateError if this activity does not accept submissions
    under the given parameters.

    Rules
    -----
    draft:        never accepts submissions.
    disabled:     never accepts submissions.
    experimental: allows submissions; blocks high-stakes tiers.
    beta:         allows submissions; blocks Gold Coins and tournaments.
    certified:    allows submissions; high-stakes blocked unless reward_policy enables it.
    """
    status = activity_def.verification_status

    if status == VerificationStatus.DRAFT:
        raise SubmissionGateError(
            f"Activity {activity_def.slug!r} is in draft status and does not accept submissions.",
            status_code=422,
        )

    if status == VerificationStatus.DISABLED:
        raise SubmissionGateError(
            f"Activity {activity_def.slug!r} is disabled and does not accept submissions.",
            status_code=422,
        )

    _HIGH_STAKES_TIERS = frozenset({"gold_coin_reward", "tournament"})

    if status == VerificationStatus.EXPERIMENTAL and tier in _HIGH_STAKES_TIERS:
        raise SubmissionGateError(
            f"Activity {activity_def.slug!r} is experimental and cannot be used for "
            f"high-stakes tier {tier!r}.",
            status_code=422,
        )

    if status == VerificationStatus.BETA and tier in _HIGH_STAKES_TIERS:
        raise SubmissionGateError(
            f"Activity {activity_def.slug!r} is in beta and cannot be used for "
            f"high-stakes tier {tier!r}.",
            status_code=422,
        )

    if status == VerificationStatus.CERTIFIED and tier in _HIGH_STAKES_TIERS:
        policy = activity_def.parsed_reward_policy()
        if tier == "gold_coin_reward" and not policy.gold_coins:
            raise SubmissionGateError(
                f"Activity {activity_def.slug!r} is certified but Gold Coins are not "
                f"enabled in its reward policy.",
                status_code=422,
            )
        if tier == "tournament" and not policy.tournaments:
            raise SubmissionGateError(
                f"Activity {activity_def.slug!r} is certified but tournaments are not "
                f"enabled in its reward policy.",
                status_code=422,
            )


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------

def save_data_collection_submission(record: DataCollectionRecord) -> str | None:
    """
    Persist an experimental data-collection submission.
    Returns the inserted row UUID, or None on failure.  Never raises.
    """
    try:
        client = _get_client()
        # Resolve activity_definition_id from slug.
        act_rows = (
            client.table("activity_definitions")
            .select("id")
            .eq("slug", record.activity_slug)
            .limit(1)
            .execute()
            .data or []
        )
        if not act_rows:
            log_warn("activity_def_service", "data_collection_no_activity",
                     slug=record.activity_slug)
            return None

        row = {
            "activity_definition_id":       act_rows[0]["id"],
            "user_id":                      record.user_id,
            "dog_id":                       record.dog_id,
            "activity_slug":                record.activity_slug,
            "verification_status_at_time":  record.verification_status_at_time,
            "missing_capabilities":         record.missing_capabilities,
            "pose_sequence_saved":          record.pose_sequence_saved,
            "video_retained":               record.video_retained,
            "video_storage_path":           record.video_storage_path,
            "expected_result":              record.expected_result,
            "recording_metadata":           record.recording_metadata,
            "device_metadata":              record.device_metadata,
        }
        if record.verification_id:
            row["verification_id"] = record.verification_id

        result = client.table("activity_data_collection_submissions").insert(row).execute()
        inserted = (result.data or [{}])[0]
        log_info("activity_def_service", "data_collection_saved",
                 activity_slug=record.activity_slug, user_id=record.user_id)
        return inserted.get("id")
    except Exception as exc:  # noqa: BLE001
        log_warn("activity_def_service", "data_collection_failed",
                 activity_slug=record.activity_slug, error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Training readiness
# ---------------------------------------------------------------------------

def compute_training_readiness(slug: str) -> "app.models.activity_models.TrainingReadiness":
    """
    Compute training readiness for an activity.  Does not trigger training.
    Reads from activity_data_collection_submissions for label counts.
    Updates activity_training_readiness with the result.  Never raises.
    """
    from app.models.activity_models import TrainingReadiness  # noqa: PLC0415

    POSITIVE_THRESHOLD = 200
    NEGATIVE_THRESHOLD = 100

    try:
        client = _get_client()
        act_rows = (
            client.table("activity_definitions")
            .select("id, missing_capabilities")
            .eq("slug", slug)
            .limit(1)
            .execute()
            .data or []
        )
        if not act_rows:
            return TrainingReadiness(
                activity_slug=slug,
                activity_definition_id=None,
                positive_label_count=0, negative_label_count=0,
                ambiguous_label_count=0, invalid_recording_count=0,
                dog_count=0, camera_angle_coverage=None,
                dog_size_coverage=None, breed_coverage=None,
                missing_capabilities=[],
                ready_for_candidate_training=False,
                readiness_reason=["Activity definition not found."],
                updated_at=None,
            )

        act_id   = act_rows[0]["id"]
        missing_caps = act_rows[0].get("missing_capabilities") or []

        # Count labeled submissions.
        subs = (
            client.table("activity_data_collection_submissions")
            .select("expected_result, dog_id")
            .eq("activity_definition_id", act_id)
            .execute()
            .data or []
        )
        positive = sum(1 for s in subs if s.get("expected_result") == "pass")
        negative = sum(1 for s in subs if s.get("expected_result") == "fail")
        ambiguous = sum(1 for s in subs if s.get("expected_result") == "uncertain")
        invalid   = sum(1 for s in subs if s.get("expected_result") is None)
        dog_count = len({s["dog_id"] for s in subs if s.get("dog_id")})

        reasons: list[str] = []
        if positive < POSITIVE_THRESHOLD:
            reasons.append(
                f"Only {positive} positive labeled examples collected; "
                f"need at least {POSITIVE_THRESHOLD}."
            )
        if negative < NEGATIVE_THRESHOLD:
            reasons.append(
                f"Only {negative} negative labeled examples collected; "
                f"need at least {NEGATIVE_THRESHOLD}."
            )
        for cap in missing_caps:
            reasons.append(f"Capability unavailable: {cap}.")
        if dog_count < 20:
            reasons.append(
                f"Only {dog_count} distinct dogs; need at least 20 for diversity."
            )

        ready = (
            positive >= POSITIVE_THRESHOLD
            and negative >= NEGATIVE_THRESHOLD
            and len(missing_caps) == 0
            and dog_count >= 20
        )

        now = datetime.now(timezone.utc).isoformat()
        readiness_row = {
            "activity_definition_id":      act_id,
            "positive_label_count":        positive,
            "negative_label_count":        negative,
            "ambiguous_label_count":       ambiguous,
            "invalid_recording_count":     invalid,
            "dog_count":                   dog_count,
            "missing_capabilities":        missing_caps,
            "ready_for_candidate_training": ready,
            "readiness_reason":            reasons,
            "updated_at":                  now,
        }
        client.table("activity_training_readiness").upsert(
            readiness_row, on_conflict="activity_definition_id"
        ).execute()

        return TrainingReadiness(
            activity_slug=slug,
            activity_definition_id=act_id,
            positive_label_count=positive,
            negative_label_count=negative,
            ambiguous_label_count=ambiguous,
            invalid_recording_count=invalid,
            dog_count=dog_count,
            camera_angle_coverage=None,
            dog_size_coverage=None,
            breed_coverage=None,
            missing_capabilities=missing_caps,
            ready_for_candidate_training=ready,
            readiness_reason=reasons,
            updated_at=now,
        )

    except Exception as exc:  # noqa: BLE001
        log_warn("activity_def_service", "readiness_failed", slug=slug, error=str(exc))
        return TrainingReadiness(
            activity_slug=slug, activity_definition_id=None,
            positive_label_count=0, negative_label_count=0,
            ambiguous_label_count=0, invalid_recording_count=0,
            dog_count=0, camera_angle_coverage=None,
            dog_size_coverage=None, breed_coverage=None,
            missing_capabilities=[],
            ready_for_candidate_training=False,
            readiness_reason=["Error computing readiness."],
            updated_at=None,
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_client():
    from app.services.supabase_service import get_supabase  # noqa: PLC0415
    return get_supabase()


def _row_to_def(row: dict) -> ActivityDefinition:
    return ActivityDefinition(
        id=row.get("id"),
        slug=row["slug"],
        display_name=row["display_name"],
        description=row["description"],
        instructions=row.get("instructions") or "",
        verification_status=row["verification_status"],
        verification_strategy=row.get("verification_strategy") or {},
        recording_config=row.get("recording_config") or {},
        success_conditions=row.get("success_conditions") or [],
        failure_conditions=row.get("failure_conditions") or [],
        required_capabilities=row.get("required_capabilities") or [],
        missing_capabilities=row.get("missing_capabilities") or [],
        reward_policy=row.get("reward_policy") or {},
        active_verifier_version=row.get("active_verifier_version"),
        candidate_verifier_version=row.get("candidate_verifier_version"),
        created_by=row.get("created_by") or "system",
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _transition(
    slug: str,
    new_status: str,
    allowed_from: frozenset[str] | set[str],
    actor: str,
    action: str,
    extra_fields: dict | None = None,
) -> ActivityDefinition:
    """Apply a lifecycle transition with a guard on the current state."""
    client = _get_client()
    rows = (
        client.table("activity_definitions")
        .select("*")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data or []
    )
    if not rows:
        raise KeyError(f"Activity definition {slug!r} not found.")

    current = rows[0]["verification_status"]
    if current not in allowed_from:
        raise ValueError(
            f"Cannot transition {slug!r} from {current!r} to {new_status!r}. "
            f"Allowed source states: {sorted(allowed_from)}."
        )

    now = datetime.now(timezone.utc).isoformat()
    updates = {"verification_status": new_status, "updated_at": now}
    if extra_fields:
        updates.update(extra_fields)

    result = (
        client.table("activity_definitions")
        .update(updates)
        .eq("slug", slug)
        .execute()
    )
    updated_rows = result.data or []
    if not updated_rows:
        raise RuntimeError(f"Transition update for {slug!r} returned no rows.")

    log_info("activity_def_service", action, slug=slug, new_status=new_status, actor=actor)
    _clear_cache(slug)
    return _row_to_def(updated_rows[0])


# Very small in-process cache to avoid repeated DB reads for the submission gate.
_def_cache: dict[str, ActivityDefinition] = {}


def _clear_cache(slug: str) -> None:
    _def_cache.pop(slug, None)
