"""
Account-level risk scoring service.

Computes risk signals from:
  - Recent attempt history (frequency, success rate, score distribution)
  - Pose sequence characteristics (static pose detection)
  - Hybrid verification outputs (assistance likelihood, multiple dogs)
  - Account restriction history

Each signal contributes a weighted score contribution in [0, 1].
The total risk score is the clamped sum of contributions.

Design notes
------------
- All signals are individually documented and have clear thresholds.
- No ML inference is done here; everything is rule-based and auditable.
- Signals are conservative: they require multiple corroborating data points
  before contributing meaningfully to the score.
- The service never raises; DB failures produce a zero-score profile.
"""

from __future__ import annotations

from app.models.anti_cheat_models import (
    AccountRiskProfile,
    RiskSignal,
    RiskSignalName,
)
from app.utils.logging import log_error, log_info


# ---------------------------------------------------------------------------
# Thresholds (module-level, overridable in tests via monkeypatch)
# ---------------------------------------------------------------------------

# Minimum attempts before frequency signals fire (avoids flagging new users).
_MIN_ATTEMPTS_FOR_RATE_SIGNAL = 10

# Attempts per hour that trigger the high-frequency signal.
# Lower threshold for high-stakes tiers.
_FREQUENCY_LIMIT_STANDARD    = 20
_FREQUENCY_LIMIT_HIGH_STAKES = 8

# Rolling 30-day pass rate above which "high success" is flagged.
# Only triggers for high-stakes tiers with >= _MIN_ATTEMPTS_FOR_RATE_SIGNAL.
_HIGH_SUCCESS_RATE_THRESHOLD = 0.92

# Average confidence of passed gold/tournament attempts above which
# "perfect scores on hard tricks" fires.
_PERFECT_SCORE_THRESHOLD = 0.96

# Maximum joint displacement ratio (relative to 1.0 normalized frame width)
# below which a pose sequence is considered "static".
_STATIC_POSE_MAX_DISPLACEMENT = 0.04

# Score contributions per signal (tuned conservatively).
_SIGNAL_WEIGHTS: dict[str, float] = {
    RiskSignalName.HIGH_SUBMISSION_FREQUENCY: 0.20,
    RiskSignalName.HIGH_SUCCESS_RATE:         0.15,
    RiskSignalName.PERFECT_SCORES_HARD:       0.15,
    RiskSignalName.STATIC_POSE:               0.25,
    RiskSignalName.ASSISTED_ATTEMPT:          0.20,
    RiskSignalName.MULTIPLE_DOGS_FRAUD:       0.15,
    RiskSignalName.DOG_IDENTITY_MISMATCH:     0.20,
    RiskSignalName.PREVIOUSLY_RESTRICTED:     0.15,
}

_HIGH_STAKES_TIERS = frozenset({"gold_coin_reward", "tournament"})


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_risk_signals(
    user_id: str,
    dog_id: str,
    tier: str,
    activity_id: str,
    pose_classifier_confidence: float,
    assistance_likelihood: float | None,
    multiple_dog_score: float | None,
    pose_frames: list[dict],
    recording_metadata: dict,
    current_verification_id: str,
) -> list[RiskSignal]:
    """
    Compute all applicable risk signals for a single attempt.

    Returns a list of triggered RiskSignal objects.  Untriggered signals
    are not included in the list.
    """
    signals: list[RiskSignal] = []

    is_high_stakes = tier in _HIGH_STAKES_TIERS

    # --- Frequency check ---
    freq_signal = _check_frequency(user_id, tier, is_high_stakes, current_verification_id)
    if freq_signal:
        signals.append(freq_signal)

    # --- Success rate and perfect scores (high-stakes only) ---
    if is_high_stakes:
        rate_signal = _check_success_rate(user_id, activity_id, current_verification_id)
        if rate_signal:
            signals.append(rate_signal)

        perf_signal = _check_perfect_scores(
            user_id, activity_id, pose_classifier_confidence, current_verification_id
        )
        if perf_signal:
            signals.append(perf_signal)

    # --- Static pose ---
    if pose_frames:
        static_signal = _check_static_pose(pose_frames)
        if static_signal:
            signals.append(static_signal)

    # --- RGB-based signals ---
    if assistance_likelihood is not None and assistance_likelihood > 0.70:
        signals.append(RiskSignal(
            signal_name=RiskSignalName.ASSISTED_ATTEMPT,
            score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.ASSISTED_ATTEMPT],
            detail={"assistance_likelihood": assistance_likelihood},
        ))

    if multiple_dog_score is not None and multiple_dog_score > 0.70:
        signals.append(RiskSignal(
            signal_name=RiskSignalName.MULTIPLE_DOGS_FRAUD,
            score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.MULTIPLE_DOGS_FRAUD],
            detail={"multiple_dog_score": multiple_dog_score},
        ))

    # --- Account restriction history ---
    restriction_signal = _check_restriction_history(user_id)
    if restriction_signal:
        signals.append(restriction_signal)

    return signals


def load_account_risk_profile(user_id: str) -> AccountRiskProfile | None:
    """
    Load the current risk profile for a user.  Returns None if not found or
    if the DB is unavailable.
    """
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = (
            client.table("account_risk_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data or []
        )
        if not rows:
            return None
        row = rows[0]
        return AccountRiskProfile(
            user_id=row["user_id"],
            risk_score=float(row.get("risk_score") or 0.0),
            risk_flags=row.get("risk_flags") or [],
            restriction_state=row.get("restriction_state") or "none",
            restriction_expires_at=row.get("restriction_expires_at"),
            total_flags=int(row.get("total_flags") or 0),
            consecutive_suspicious=int(row.get("consecutive_suspicious") or 0),
            updated_at=row.get("updated_at") or "",
        )
    except Exception as exc:  # noqa: BLE001
        log_error(
            "account_risk_service",
            "profile_load_failed",
            user_id=user_id,
            error=str(exc),
        )
        return None


def upsert_account_risk_profile(
    user_id: str,
    new_risk_score: float,
    new_flags: list[str],
    is_suspicious: bool,
) -> None:
    """
    Update the account risk profile.  Increments consecutive_suspicious
    when is_suspicious is True; resets it on a clean attempt.
    Silently ignores DB failures.
    """
    from datetime import datetime, timezone  # noqa: PLC0415

    now = datetime.now(timezone.utc).isoformat()
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()

        # Load existing to merge flags and counters.
        existing = load_account_risk_profile(user_id)
        existing_flags = list(existing.risk_flags) if existing else []
        total_flags = (existing.total_flags if existing else 0) + (1 if is_suspicious else 0)
        consec = (existing.consecutive_suspicious if existing else 0)
        if is_suspicious:
            consec += 1
        else:
            consec = 0

        merged_flags = sorted(set(existing_flags) | set(new_flags))

        client.table("account_risk_profiles").upsert({
            "user_id": user_id,
            "risk_score": round(new_risk_score, 4),
            "risk_flags": merged_flags,
            "total_flags": total_flags,
            "consecutive_suspicious": consec,
            "updated_at": now,
        }, on_conflict="user_id").execute()

    except Exception as exc:  # noqa: BLE001
        log_error(
            "account_risk_service",
            "profile_upsert_failed",
            user_id=user_id,
            error=str(exc),
        )


def is_reward_restricted(user_id: str) -> tuple[bool, str | None]:
    """
    Returns (is_restricted, reason).  True when the account is currently
    under an active reward restriction or block.
    """
    from datetime import datetime, timezone  # noqa: PLC0415

    profile = load_account_risk_profile(user_id)
    if profile is None:
        return False, None

    if profile.restriction_state == "none":
        return False, None

    if profile.restriction_state == "warned":
        # Warnings don't block rewards, only annotate the audit record.
        return False, None

    if profile.restriction_state == "blocked":
        return True, "account_blocked_pending_admin_review"

    if profile.restriction_state == "restricted":
        if profile.restriction_expires_at is None:
            return True, "reward_redemption_restricted"
        expiry = datetime.fromisoformat(profile.restriction_expires_at)
        now = datetime.now(timezone.utc)
        # Ensure both are offset-aware.
        if expiry.tzinfo is None:
            from datetime import timezone as tz  # noqa: PLC0415
            expiry = expiry.replace(tzinfo=tz.utc)
        if now < expiry:
            return True, f"reward_redemption_restricted_until:{profile.restriction_expires_at}"
        # Restriction has expired — treat as none.
        return False, None

    return False, None


# ---------------------------------------------------------------------------
# Internal signal checkers
# ---------------------------------------------------------------------------

def _check_frequency(
    user_id: str,
    tier: str,
    is_high_stakes: bool,
    current_verification_id: str,
) -> RiskSignal | None:
    """Flag if the user has submitted too many attempts in the last hour."""
    from datetime import datetime, timedelta, timezone  # noqa: PLC0415

    limit = _FREQUENCY_LIMIT_HIGH_STAKES if is_high_stakes else _FREQUENCY_LIMIT_STANDARD
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = (
            client.table("submission_hashes")
            .select("verification_id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", cutoff)
            .execute()
        )
        count = rows.count or 0
        if count > limit:
            return RiskSignal(
                signal_name=RiskSignalName.HIGH_SUBMISSION_FREQUENCY,
                score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.HIGH_SUBMISSION_FREQUENCY],
                detail={"attempts_last_hour": count, "limit": limit},
            )
    except Exception:  # noqa: BLE001
        pass
    return None


def _check_success_rate(
    user_id: str,
    activity_id: str,
    current_verification_id: str,
) -> RiskSignal | None:
    """Flag unrealistically high pass rate over the last 30 days."""
    from datetime import datetime, timedelta, timezone  # noqa: PLC0415

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = (
            client.table("activity_verifications")
            .select("status")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .gte("created_at", cutoff)
            .execute()
            .data or []
        )
        if len(rows) < _MIN_ATTEMPTS_FOR_RATE_SIGNAL:
            return None
        passed = sum(1 for r in rows if r.get("status") == "passed")
        rate = passed / len(rows)
        if rate > _HIGH_SUCCESS_RATE_THRESHOLD:
            return RiskSignal(
                signal_name=RiskSignalName.HIGH_SUCCESS_RATE,
                score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.HIGH_SUCCESS_RATE],
                detail={
                    "pass_rate_30d": round(rate, 3),
                    "total_attempts": len(rows),
                    "threshold": _HIGH_SUCCESS_RATE_THRESHOLD,
                },
            )
    except Exception:  # noqa: BLE001
        pass
    return None


def _check_perfect_scores(
    user_id: str,
    activity_id: str,
    current_confidence: float,
    current_verification_id: str,
) -> RiskSignal | None:
    """
    Flag if recent passed attempts consistently show near-perfect confidence.
    Only fires when the current attempt also has very high confidence.
    """
    if current_confidence < _PERFECT_SCORE_THRESHOLD:
        return None

    from datetime import datetime, timedelta, timezone  # noqa: PLC0415

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = (
            client.table("activity_verifications")
            .select("confidence_score")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .eq("status", "passed")
            .gte("created_at", cutoff)
            .execute()
            .data or []
        )
        if len(rows) < 3:
            return None
        confidences = [
            float(r["confidence_score"])
            for r in rows
            if r.get("confidence_score") is not None
        ]
        if not confidences:
            return None
        avg_conf = sum(confidences) / len(confidences)
        if avg_conf >= _PERFECT_SCORE_THRESHOLD:
            return RiskSignal(
                signal_name=RiskSignalName.PERFECT_SCORES_HARD,
                score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.PERFECT_SCORES_HARD],
                detail={
                    "avg_confidence_7d": round(avg_conf, 3),
                    "threshold": _PERFECT_SCORE_THRESHOLD,
                    "sample_size": len(confidences),
                },
            )
    except Exception:  # noqa: BLE001
        pass
    return None


def _check_static_pose(pose_frames: list[dict]) -> RiskSignal | None:
    """
    Detect suspiciously static pose sequences (looped clip, screenshot).

    For each visible joint, compute the range of its x-coordinate across
    all frames.  If the maximum range across all joints is below the
    threshold, the pose sequence is considered static.
    """
    if len(pose_frames) < 4:
        return None

    joint_x_values: dict[str, list[float]] = {}

    for frame in pose_frames:
        kps = frame.get("keypoints") or {}
        for name, kp in kps.items():
            x = kp.get("x") if isinstance(kp, dict) else getattr(kp, "x", None)
            conf = kp.get("confidence") if isinstance(kp, dict) else getattr(kp, "confidence", 0.0)
            if x is not None and float(conf or 0) >= 0.30:
                joint_x_values.setdefault(name, []).append(float(x))

    if not joint_x_values:
        return None

    ranges = [
        max(xs) - min(xs)
        for xs in joint_x_values.values()
        if len(xs) >= 2
    ]
    if not ranges:
        return None

    max_range = max(ranges)
    if max_range < _STATIC_POSE_MAX_DISPLACEMENT:
        return RiskSignal(
            signal_name=RiskSignalName.STATIC_POSE,
            score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.STATIC_POSE],
            detail={
                "max_joint_x_range": round(max_range, 4),
                "threshold": _STATIC_POSE_MAX_DISPLACEMENT,
                "joints_checked": len(ranges),
            },
        )
    return None


def _check_restriction_history(user_id: str) -> RiskSignal | None:
    """
    Add a base risk contribution if the account has been previously flagged.
    """
    profile = load_account_risk_profile(user_id)
    if profile is None:
        return None
    if profile.restriction_state in ("restricted", "blocked") or profile.total_flags >= 3:
        return RiskSignal(
            signal_name=RiskSignalName.PREVIOUSLY_RESTRICTED,
            score_contribution=_SIGNAL_WEIGHTS[RiskSignalName.PREVIOUSLY_RESTRICTED],
            detail={
                "restriction_state": profile.restriction_state,
                "total_flags": profile.total_flags,
            },
        )
    return None
