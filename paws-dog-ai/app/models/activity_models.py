"""
Data models for the Activity Verifier Compiler.

ActivityDefinition       — full definition read from activity_definitions table.
VerificationStrategy     — parsed strategy JSONB.
GenerateActivityRequest  — input to the draft generator endpoint.
ActivityDraftResult      — output from the draft generator (always draft status).
StrategyExecutionResult  — output from the strategy executor.
DataCollectionRecord     — stored for experimental submissions with missing capabilities.
TrainingReadiness        — computed readiness state for future training.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Verification lifecycle states
# ---------------------------------------------------------------------------

class VerificationStatus:
    DRAFT        = "draft"
    EXPERIMENTAL = "experimental"
    BETA         = "beta"
    CERTIFIED    = "certified"
    DISABLED     = "disabled"

    ALL: frozenset[str] = frozenset({
        DRAFT, EXPERIMENTAL, BETA, CERTIFIED, DISABLED
    })

    # States that allow user submissions.
    SUBMITTABLE: frozenset[str] = frozenset({EXPERIMENTAL, BETA, CERTIFIED})

    # States that never allow Gold Coin or tournament rewards regardless of policy.
    NEVER_HIGH_STAKES: frozenset[str] = frozenset({DRAFT, EXPERIMENTAL, BETA})


# ---------------------------------------------------------------------------
# Strategy config
# ---------------------------------------------------------------------------

class VerificationStrategy(BaseModel):
    """Parsed from activity_definitions.verification_strategy JSONB."""
    model_config = ConfigDict(protected_namespaces=())

    strategy_type: str = "generic"
    # Ordered list of capability/module names to execute.
    modules: list[str] = []
    # When True the existing dedicated classifier is authoritative.
    # Only set for Sit while the legacy rule-based path remains ground truth.
    existing_classifier_authoritative: bool = False
    # Whether to trigger hybrid RGB verification path.
    requires_rgb_fallback: bool = False


class RewardPolicy(BaseModel):
    gold_coins: bool  = False
    tournaments: bool = False
    xp: bool          = True
    silver_coins: bool = False


class RecordingConfig(BaseModel):
    min_duration_seconds: float = 2.0
    max_duration_seconds: float = 8.0
    full_body_visible: bool = True
    bowl_visible: bool = False
    audio_required: bool = False


# ---------------------------------------------------------------------------
# Activity definition
# ---------------------------------------------------------------------------

class ActivityDefinition(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str | None = None
    slug: str
    display_name: str
    description: str
    instructions: str = ""
    verification_status: str
    verification_strategy: dict
    recording_config: dict = {}
    success_conditions: list[dict] = []
    failure_conditions: list[dict] = []
    required_capabilities: list[str] = []
    missing_capabilities: list[str] = []
    reward_policy: dict = {}
    active_verifier_version: str | None = None
    candidate_verifier_version: str | None = None
    created_by: str
    created_at: str | None = None
    updated_at: str | None = None

    def parsed_strategy(self) -> VerificationStrategy:
        return VerificationStrategy(**self.verification_strategy)

    def parsed_reward_policy(self) -> RewardPolicy:
        return RewardPolicy(**self.reward_policy)

    def is_submittable(self) -> bool:
        return self.verification_status in VerificationStatus.SUBMITTABLE

    def allows_high_stakes(self) -> bool:
        """True only when certified AND reward_policy explicitly enables gold_coins/tournaments."""
        if self.verification_status in VerificationStatus.NEVER_HIGH_STAKES:
            return False
        policy = self.parsed_reward_policy()
        return policy.gold_coins or policy.tournaments


class ActivityDefinitionCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    slug: str
    display_name: str
    description: str
    instructions: str = ""
    verification_strategy: dict = {}
    recording_config: dict = {}
    success_conditions: list[dict] = []
    failure_conditions: list[dict] = []
    required_capabilities: list[str] = []
    missing_capabilities: list[str] = []
    reward_policy: dict = {}
    created_by: str


class ActivityDefinitionPatch(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    display_name: str | None = None
    description: str | None = None
    instructions: str | None = None
    verification_strategy: dict | None = None
    recording_config: dict | None = None
    success_conditions: list[dict] | None = None
    failure_conditions: list[dict] | None = None
    required_capabilities: list[str] | None = None
    missing_capabilities: list[str] | None = None
    reward_policy: dict | None = None
    candidate_verifier_version: str | None = None


# ---------------------------------------------------------------------------
# Draft generator
# ---------------------------------------------------------------------------

class GenerateActivityRequest(BaseModel):
    """Input to POST /admin/activity-definitions/generate."""
    activity_name: str
    description: str
    success_examples: list[str] = []
    failure_examples: list[str] = []
    recording_constraints: dict = {}
    intended_reward_tier: str = "beta_only"
    # Optional override for the generator provider key.
    generator_provider: str = "deterministic"


class ActivityDraftResult(BaseModel):
    """
    Output from the draft generator.  Always has verification_status='draft'.
    Never auto-published or auto-certified.
    """
    slug: str
    display_name: str
    description: str
    verification_status: str = VerificationStatus.DRAFT
    verification_strategy: dict
    recording_config: dict
    success_conditions: list[dict]
    failure_conditions: list[dict]
    required_capabilities: list[str]
    available_capabilities: list[str]
    missing_capabilities: list[str]
    # Recommended lifecycle state given available capabilities.
    recommended_status: str
    certified_for_gold_coins: bool = False
    certified_for_tournaments: bool = False
    reward_policy: dict
    generator_provider: str
    # Warning messages for the admin reviewing this draft.
    warnings: list[str] = []


# ---------------------------------------------------------------------------
# Strategy execution result
# ---------------------------------------------------------------------------

class ModuleExecutionSummary(BaseModel):
    """Compact summary of one module's output for audit storage."""
    module_name: str
    implementation_status: str
    passed: bool | None
    confidence: float | None
    reason_codes: list[str]
    latency_ms: int


class StrategyExecutionResult(BaseModel):
    """Output from the strategy executor."""
    model_config = ConfigDict(protected_namespaces=())

    activity_slug: str
    verification_status_at_time: str
    # Final outcome.
    final_status: str   # passed | failed | retry_uncertain | unsupported | pending_manual_review
                        # | unsupported_data_collection_only
    confidence: float | None
    quality_score: float
    # All module-level outputs in execution order.
    module_outputs: list[ModuleExecutionSummary]
    # Aggregated reason codes from all modules.
    reason_codes: list[str]
    retry_guidance: str | None
    # Capabilities required by the strategy that had no available implementation.
    missing_capabilities: list[str]
    verifier_version: str
    audit_id: str | None
    # True when the legacy dedicated classifier was used as the authoritative result.
    used_authoritative_classifier: bool = False


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------

class DataCollectionRecord(BaseModel):
    """Stored for experimental submissions where capabilities are missing."""
    activity_slug: str
    user_id: str
    dog_id: str
    verification_id: str | None
    verification_status_at_time: str
    missing_capabilities: list[str]
    pose_sequence_saved: bool
    video_retained: bool
    video_storage_path: str | None
    expected_result: str | None
    recording_metadata: dict
    device_metadata: dict


# ---------------------------------------------------------------------------
# Training readiness
# ---------------------------------------------------------------------------

class TrainingReadiness(BaseModel):
    activity_slug: str
    activity_definition_id: str | None
    positive_label_count: int
    negative_label_count: int
    ambiguous_label_count: int
    invalid_recording_count: int
    dog_count: int
    camera_angle_coverage: float | None
    dog_size_coverage: float | None
    breed_coverage: float | None
    missing_capabilities: list[str]
    ready_for_candidate_training: bool
    readiness_reason: list[str]
    updated_at: str | None


# ---------------------------------------------------------------------------
# Submission gate error
# ---------------------------------------------------------------------------

class SubmissionGateError(Exception):
    """Raised by check_submission_gate when an activity does not accept submissions."""
    def __init__(self, reason: str, status_code: int = 422):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
