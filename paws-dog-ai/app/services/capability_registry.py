"""
Capability registry for the Activity Verifier Compiler.

Provides a single source of truth for which capabilities exist, what their
implementation status is, and which lifecycle states / reward tiers they are
allowed in.

The registry is a static dict keyed by capability name.  It is built from the
MODULE_REGISTRY in app/ml/verifier_modules/ so that the implementation status
is always derived from the actual module class, not maintained separately.

Usage
-----
  from app.services.capability_registry import CAPABILITY_REGISTRY, get_capability
  info = get_capability("pose_transition_detector")
  print(info.status)          # "available"
  print(info.allowed_certified)  # True
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CapabilityInfo:
    name: str
    status: str              # "available" | "stub" | "unavailable"
    version: str | None
    module_class_name: str   # for display and debugging
    requires_rgb: bool
    requires_pose: bool
    requires_audio: bool
    # Which lifecycle states this capability is allowed in.
    allowed_experimental: bool
    allowed_beta: bool
    allowed_certified: bool
    # Whether Gold Coin and tournament attempts may use this capability.
    # A capability with known limitations must not be used in high-stakes evaluation.
    allowed_gold_coins: bool
    allowed_tournaments: bool
    # Human-readable note about limitations or next steps.
    notes: str = ""


def _build_registry() -> dict[str, CapabilityInfo]:
    from app.ml.verifier_modules import MODULE_REGISTRY  # noqa: PLC0415

    registry: dict[str, CapabilityInfo] = {}
    for cap_name, cls in MODULE_REGISTRY.items():
        status   = cls.implementation_status
        version  = cls.version if cls.version else None
        is_avail = status == "available"
        is_stub  = status == "stub"

        registry[cap_name] = CapabilityInfo(
            name=cap_name,
            status=status,
            version=version,
            module_class_name=cls.__name__,
            requires_rgb=cls.requires_rgb,
            requires_pose=cls.requires_pose,
            requires_audio=cls.requires_audio,
            # Experimental: all capabilities (even unavailable) are allowed for
            # data collection.  The executor handles missing capabilities gracefully.
            allowed_experimental=True,
            # Beta: stubs and unavailable capabilities are not allowed.
            allowed_beta=is_avail,
            # Certified: only fully available capabilities.
            allowed_certified=is_avail,
            # Gold Coins / tournaments: only available capabilities.
            # Stubs are explicitly excluded from high-stakes paths.
            allowed_gold_coins=is_avail and not is_stub,
            allowed_tournaments=is_avail and not is_stub,
        )

    # Add a few well-known capabilities that don't have modules yet but are
    # referenced in draft-generation output.  These are "virtual" capabilities —
    # they appear in required_capabilities lists but have no module implementation.
    _virtual = [
        ("dog_tracking",               "Dog bounding-box tracker (needed for trajectory analysis)"),
        ("approach_detection",         "Requires dog_tracking"),
        ("target_zone_detection",      "Requires dog_tracking + object_detection"),
        ("rotation_detection",         "Requires orientation-tracking model"),
        ("object_detection",           "General object detector (bowl, toy, target)"),
        ("object_interaction_detection", "Requires object_detection + dog_tracking"),
        ("audio_cue_detection",        "Requires audio capture + recognition model"),
        ("eating_action_detection",    "Requires eating-action recognition model"),
    ]
    for cap_name, notes in _virtual:
        if cap_name not in registry:
            registry[cap_name] = CapabilityInfo(
                name=cap_name,
                status="unavailable",
                version=None,
                module_class_name="",
                requires_rgb=True,
                requires_pose=True,
                requires_audio=cap_name == "audio_cue_detection",
                allowed_experimental=True,
                allowed_beta=False,
                allowed_certified=False,
                allowed_gold_coins=False,
                allowed_tournaments=False,
                notes=notes,
            )

    return registry


# Module-level singleton — built once on import.
CAPABILITY_REGISTRY: dict[str, CapabilityInfo] = _build_registry()


def get_capability(name: str) -> CapabilityInfo | None:
    """Return capability info, or None if the name is not registered."""
    return CAPABILITY_REGISTRY.get(name)


def list_capabilities() -> list[CapabilityInfo]:
    """Return all registered capabilities, sorted by name."""
    return sorted(CAPABILITY_REGISTRY.values(), key=lambda c: c.name)


def get_missing_capabilities(required: list[str]) -> list[str]:
    """
    Return the subset of required capability names that are unavailable
    (status == 'unavailable' or not registered at all).
    """
    missing: list[str] = []
    for name in required:
        info = CAPABILITY_REGISTRY.get(name)
        if info is None or info.status == "unavailable":
            missing.append(name)
    return missing
