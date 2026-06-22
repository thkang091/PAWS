"""
Data models for the anti-cheat and duplicate-detection pipeline.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Risk signals
# ---------------------------------------------------------------------------

class RiskSignal(BaseModel):
    """A single named risk indicator with its score contribution."""

    signal_name: str
    score_contribution: float   # [0, 1]; summed with others to form total risk score
    detail: dict = {}


# Signal names used throughout the system.
class RiskSignalName:
    EXACT_DUPLICATE          = "exact_duplicate"
    NEAR_DUPLICATE_POSE      = "near_duplicate_pose"
    NEAR_DUPLICATE_FRAMES    = "near_duplicate_frames"
    CROSS_ACCOUNT_VIDEO      = "cross_account_video"
    HIGH_SUBMISSION_FREQUENCY = "high_submission_frequency"
    HIGH_SUCCESS_RATE        = "high_success_rate"
    PERFECT_SCORES_HARD      = "perfect_scores_hard_tricks"
    STATIC_POSE              = "static_pose_sequence"
    ASSISTED_ATTEMPT         = "assisted_attempt"
    MULTIPLE_DOGS_FRAUD      = "multiple_dogs_fraud_indicator"
    DOG_IDENTITY_MISMATCH    = "dog_identity_mismatch"
    PREVIOUSLY_RESTRICTED    = "previously_restricted_account"


# ---------------------------------------------------------------------------
# Duplicate match
# ---------------------------------------------------------------------------

DuplicateMatchType = Literal[
    "exact_video",
    "near_video",
    "exact_pose",
    "near_pose",
    "cross_account_video",
    "cross_account_pose",
]


class DuplicateMatch(BaseModel):
    """Evidence of a duplicate submission."""

    match_type: DuplicateMatchType
    original_verification_id: str
    original_user_id: str
    hamming_distance: int | None = None   # for near-duplicate matches
    similarity_score: float               # 1.0 = exact, lower = near-duplicate


# ---------------------------------------------------------------------------
# Anti-cheat decision
# ---------------------------------------------------------------------------

AntiCheatDecisionType = Literal["proceed", "review", "block_reward"]

ANTI_CHEAT_VERSION = "1.0.0"


class AntiCheatDecision(BaseModel):
    """
    Final output of AntiCheatService.run_checks().

    decision:
        "proceed"      — no suspicious signals; reward is eligible.
        "review"       — signals raised; route to manual review before reward.
        "block_reward" — definitive duplicate or very high risk; reward blocked
                         until admin clears the account.

    reward_eligible:
        True only when decision == "proceed" and the attempt passed all checks.
    """

    model_config = ConfigDict(protected_namespaces=())

    verification_id: str
    user_id: str
    dog_id: str
    tier: str
    risk_score: float               # [0, 1] aggregate
    signals: list[RiskSignal]
    duplicate_match: DuplicateMatch | None
    decision: AntiCheatDecisionType
    reward_eligible: bool
    anti_cheat_version: str = ANTI_CHEAT_VERSION
    audit_id: str | None = None     # written by anti_cheat_service after DB insert


# ---------------------------------------------------------------------------
# Account risk profile
# ---------------------------------------------------------------------------

RestrictionState = Literal["none", "warned", "restricted", "blocked"]


class AccountRiskProfile(BaseModel):
    """Per-user risk state, upserted each time anti-cheat runs."""

    model_config = ConfigDict(protected_namespaces=())

    user_id: str
    risk_score: float               # rolling [0, 1] — decays over time
    risk_flags: list[str]           # signal names that have been raised
    restriction_state: RestrictionState
    restriction_expires_at: str | None   # ISO-8601; None = permanent or no restriction
    total_flags: int                # lifetime count of flag increments
    consecutive_suspicious: int     # consecutive high-risk submissions
    updated_at: str


# ---------------------------------------------------------------------------
# Admin review request / response
# ---------------------------------------------------------------------------

AdminActionType = Literal[
    "approve",
    "reject",
    "warn",
    "restrict",
    "block",
    "clear_false_positive",
]


class AdminReviewRequest(BaseModel):
    """Body for POST /anti-cheat/{audit_id}/action."""

    action: AdminActionType
    reason: str
    reviewed_by: str
    restriction_duration_days: int | None = None   # required for "restrict"
    notes: str | None = None

    @field_validator("restriction_duration_days")
    @classmethod
    def _days_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("restriction_duration_days must be a positive integer.")
        return v


class AdminReviewResponse(BaseModel):
    """Response after an admin action on an anti-cheat audit."""

    audit_id: str
    verification_id: str
    user_id: str
    previous_decision: str
    new_decision: str
    action_applied: AdminActionType
    restriction_state: RestrictionState
    reviewed_by: str
    reviewed_at: str


# ---------------------------------------------------------------------------
# Anti-cheat audit detail (read model)
# ---------------------------------------------------------------------------

class AntiCheatAuditDetail(BaseModel):
    """Full detail returned by GET /anti-cheat/{audit_id}."""

    model_config = ConfigDict(protected_namespaces=())

    id: str
    verification_id: str
    user_id: str
    dog_id: str
    tier: str
    risk_score: float
    signals: list[dict]
    duplicate_match: dict | None
    decision: str
    reward_eligible: bool
    anti_cheat_version: str
    reviewed_by: str | None
    reviewed_at: str | None
    admin_action: str | None
    admin_notes: str | None
    created_at: str
    # Enriched fields
    account_restriction_state: RestrictionState | None = None
