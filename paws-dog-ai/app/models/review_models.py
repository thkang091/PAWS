from __future__ import annotations

from pydantic import BaseModel

VALID_REVIEW_STATES = {"pending_review", "reviewed", "skipped", "disputed", "needs_relabeling"}
VALID_ENQUEUE_REASONS = {
    "shadow_disagreement",
    "low_confidence",
    "retry",
    "quality_flag",
    "manual",
    # Hybrid verification reasons:
    "hybrid_borderline",
    "high_stakes_tier:gold_coin_reward",
    "high_stakes_tier:tournament",
    "direct_manual_review",
    "anomaly_flag",
    # Anti-cheat reasons:
    "anti_cheat_duplicate",
    "anti_cheat_suspicious",
    "anti_cheat_account_restricted",
}
VALID_ATTEMPT_QUALITIES = {"clean", "partial", "failed", "ambiguous", "invalid_recording"}

# Allowed state transitions. Key = current state, value = set of reachable states.
REVIEW_TRANSITIONS: dict[str, set[str]] = {
    "pending_review":   {"reviewed", "skipped", "disputed"},
    "reviewed":         {"disputed", "needs_relabeling"},
    "disputed":         {"reviewed", "needs_relabeling"},
    "needs_relabeling": {"reviewed"},
    "skipped":          set(),   # terminal
}


def validate_transition(current: str, next_state: str) -> None:
    allowed = REVIEW_TRANSITIONS.get(current, set())
    if next_state not in allowed:
        raise ValueError(
            f"Cannot transition from '{current}' to '{next_state}'. "
            f"Allowed: {sorted(allowed) or 'none (terminal state)'}."
        )


class EnqueueRequest(BaseModel):
    verification_id: str
    enqueue_reason: str = "manual"
    rule_based_status: str | None = None
    learned_prediction: str | None = None
    learned_confidence: float | None = None


class SubmitLabelRequest(BaseModel):
    ground_truth_trick: str | None = None
    trick_completed: bool | None = None
    attempt_quality: str | None = None
    start_timestamp_ms: int | None = None
    end_timestamp_ms: int | None = None
    failure_reason: str | None = None
    reviewer_notes: str | None = None
    reviewed_by: str
    is_hard_negative: bool = False
    is_disputed: bool = False   # if True, transitions to 'disputed' instead of 'reviewed'


class ReviewQueueItem(BaseModel):
    id: str
    verification_id: str
    review_state: str
    enqueue_reason: str
    rule_based_status: str | None
    learned_prediction: str | None
    learned_confidence: float | None
    created_at: str


class ReviewDetail(BaseModel):
    id: str
    verification_id: str
    review_state: str
    enqueue_reason: str
    rule_based_status: str | None
    learned_prediction: str | None
    learned_confidence: float | None
    ground_truth_trick: str | None
    trick_completed: bool | None
    attempt_quality: str | None
    failure_reason: str | None
    reviewer_notes: str | None
    reviewed_by: str | None
    reviewed_at: str | None
    is_hard_negative: bool
    created_at: str
    # Enriched at query time
    video_signed_url: str | None = None
    skeleton_json: dict | None = None
    verification_status: str | None = None
    verification_confidence: float | None = None


class ReviewQueueStats(BaseModel):
    pending_review: int
    reviewed: int
    skipped: int
    disputed: int
    needs_relabeling: int
    total: int
