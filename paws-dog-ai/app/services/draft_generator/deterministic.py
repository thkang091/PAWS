"""
DeterministicDraftGenerator — keyword-to-capability mapping implementation.

This provider requires no LLM API key and is always available.  It maps
keywords extracted from the activity description and example sentences to
known capability names, then derives a structured draft definition.

This is intentionally conservative:
  - It can only map capabilities it knows about.
  - It never claims capabilities it has not explicitly recognised.
  - It populates missing_capabilities from the live capability registry.
  - The resulting draft is always status='draft'.
  - It adds warnings whenever a key capability is unavailable so the reviewing
    admin understands what work remains before the activity can go live.

This implementation is suitable for development, CI, and bootstrapping new
activity definitions.  A future LLM-backed provider can produce richer
verification_strategy JSON and better structured conditions.
"""

from __future__ import annotations

import re

from app.models.activity_models import (
    ActivityDraftResult,
    GenerateActivityRequest,
    VerificationStatus,
)
from app.services.capability_registry import CAPABILITY_REGISTRY, get_missing_capabilities
from app.services.draft_generator.base import DraftGeneratorProvider


# ---------------------------------------------------------------------------
# Keyword → capability mapping
# Each tuple is (keyword_pattern, capability_name).
# Patterns are matched against the lowercased concatenation of all text
# fields (description, success_examples, failure_examples).
# ---------------------------------------------------------------------------

_KEYWORD_MAP: list[tuple[str, str]] = [
    # Movement / approach
    (r"\bapproach\b",         "approach_detection"),
    (r"\bwalk\s+toward\b",    "approach_detection"),
    (r"\bcome\s+to\b",        "approach_detection"),
    (r"\bmoves?\s+toward\b",  "approach_detection"),
    (r"\btrack\b",            "dog_tracking"),
    (r"\btrajectory\b",       "dog_tracking"),
    # Object / zone
    (r"\bbow[l]?\b",          "object_detection"),
    (r"\btarget\s+zone\b",    "target_zone_detection"),
    (r"\bnear\s+the\b",       "target_zone_detection"),
    (r"\bzone\b",             "target_zone_detection"),
    (r"\bobject\b",           "object_detection"),
    (r"\btoy\b",              "object_detection"),
    # Eating / interaction
    (r"\beat[s]?\b",          "eating_action_detection"),
    (r"\beating\b",           "eating_action_detection"),
    (r"\binteract[s]?\b",     "object_interaction_detection"),
    (r"\blick[s]?\b",         "object_interaction_detection"),
    # Rotation / spin
    (r"\bspin[s]?\b",         "rotation_detection"),
    (r"\broll[s]?\b",         "rotation_detection"),
    (r"\bturn[s]?\s+around\b","rotation_detection"),
    (r"\brotate[s]?\b",       "rotation_detection"),
    # Audio
    (r"\bcue\b",              "audio_cue_detection"),
    (r"\bcommand\b",          "audio_cue_detection"),
    (r"\bsignal\b",           "audio_cue_detection"),
    # Pose / hold
    (r"\bsit[s]?\b",          "pose_transition_detector"),
    (r"\bhold[s]?\b",         "hold_duration_detector"),
    (r"\bstay[s]?\b",         "hold_duration_detector"),
    (r"\bdown\b",             "pose_transition_detector"),
    (r"\bstands?\b",          "pose_transition_detector"),
    (r"\bjump[s]?\b",         "pose_transition_detector"),
    # Multiple dogs
    (r"\bsingle\s+dog\b",     "multiple_dog_detection"),
    (r"\bonly\s+one\s+dog\b", "multiple_dog_detection"),
]

# These modules are always included regardless of keywords.
_ALWAYS_REQUIRED: list[str] = ["video_quality_gate", "pose_quality_gate"]


class DeterministicDraftGenerator(DraftGeneratorProvider):
    """Keyword-to-capability deterministic draft generator."""

    @property
    def provider_key(self) -> str:
        return "deterministic"

    def generate(self, request: GenerateActivityRequest) -> ActivityDraftResult:
        slug        = _to_slug(request.activity_name)
        corpus      = _build_corpus(request)
        capabilities = _extract_capabilities(corpus)

        # Derive missing capabilities from the live registry.
        all_caps = list(dict.fromkeys(capabilities))   # dedupe, preserve order
        missing  = get_missing_capabilities(all_caps)
        available = [c for c in all_caps if c not in missing]

        # Build strategy JSON.
        strategy = {
            "strategy_type":                   "generic",
            "modules":                         all_caps,
            "existing_classifier_authoritative": False,
            "requires_rgb_fallback":           any(
                CAPABILITY_REGISTRY.get(c) and CAPABILITY_REGISTRY[c].requires_rgb
                for c in all_caps
            ),
        }

        # Recording config from constraints.
        constraints = request.recording_constraints
        recording_config = {
            "min_duration_seconds": float(constraints.get("min_duration_seconds", 2.0)),
            "max_duration_seconds": float(constraints.get("duration_seconds",
                                          constraints.get("max_duration_seconds", 8.0))),
            "full_body_visible":    bool(constraints.get("full_body_visible", True)),
            "bowl_visible":         bool(constraints.get("bowl_visible", False)),
            "audio_required":       bool(constraints.get("audio_required", False)),
        }

        # Success / failure conditions from examples.
        success_conditions = [{"description": ex} for ex in request.success_examples]
        failure_conditions = [{"description": ex} for ex in request.failure_examples]

        # Recommended status based on capability availability.
        recommended_status = _recommend_status(all_caps, missing, request.intended_reward_tier)

        # Warnings for the reviewing admin.
        warnings: list[str] = [
            "This draft was generated by the deterministic provider using keyword mapping. "
            "Review the required_capabilities list and verify it matches the intended behavior.",
            "This activity is NOT certified and cannot award Gold Coins or be used in tournaments.",
        ]
        for cap in missing:
            warnings.append(
                f"Capability '{cap}' is unavailable. This activity cannot be verified "
                f"until the capability is implemented and tested."
            )
        if recommended_status == VerificationStatus.EXPERIMENTAL:
            warnings.append(
                "One or more required capabilities are unavailable. "
                "This activity can only collect data until capabilities are built."
            )

        return ActivityDraftResult(
            slug=slug,
            display_name=request.activity_name,
            description=request.description,
            verification_status=VerificationStatus.DRAFT,
            verification_strategy=strategy,
            recording_config=recording_config,
            success_conditions=success_conditions,
            failure_conditions=failure_conditions,
            required_capabilities=all_caps,
            available_capabilities=available,
            missing_capabilities=missing,
            recommended_status=recommended_status,
            certified_for_gold_coins=False,
            certified_for_tournaments=False,
            reward_policy={"gold_coins": False, "tournaments": False,
                           "xp": True, "silver_coins": False},
            generator_provider=self.provider_key,
            warnings=warnings,
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return slug


def _build_corpus(request: GenerateActivityRequest) -> str:
    parts = [
        request.activity_name,
        request.description,
        " ".join(request.success_examples),
        " ".join(request.failure_examples),
    ]
    return " ".join(p for p in parts if p).lower()


def _extract_capabilities(corpus: str) -> list[str]:
    """Return ordered list of matched capabilities + always-required gates."""
    found: list[str] = list(_ALWAYS_REQUIRED)
    for pattern, cap in _KEYWORD_MAP:
        if re.search(pattern, corpus) and cap not in found:
            found.append(cap)
    return found


def _recommend_status(
    all_caps: list[str],
    missing: list[str],
    intended_tier: str,
) -> str:
    if missing:
        return VerificationStatus.EXPERIMENTAL
    # All capabilities available — recommend beta or certified depending on tier.
    if intended_tier in ("gold_coin", "tournament", "certified"):
        # Caller wants high stakes, but we never auto-certify.
        return VerificationStatus.BETA
    return VerificationStatus.BETA
