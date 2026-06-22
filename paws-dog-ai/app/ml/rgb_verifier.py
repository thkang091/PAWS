"""
RGB visual verification interface.

Design goals:
  - Provider-agnostic: callers depend only on RGBVerifier (ABC).
  - No large model hardcoded: the registry maps a string key to a factory.
  - Failures are surfaced as RGBVerificationError so callers can fall back
    safely without catching broad Exception types.
  - StubRGBVerifier is the default and is safe to use in tests and production
    until a real model is wired up.

Usage:
    verifier = get_rgb_verifier("stub")
    result = verifier.verify(input_)
    # or, without caring about the provider key:
    result = get_rgb_verifier().verify(input_)
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod

from app.models.hybrid_models import HybridVerificationInput, RGBVerificationResult


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class RGBVerificationError(Exception):
    """Raised when RGB verification cannot complete (model unavailable, timeout, etc.)."""


# ---------------------------------------------------------------------------
# Protocol / ABC
# ---------------------------------------------------------------------------

class RGBVerifier(ABC):
    """
    Abstract base class for all RGB visual verifiers.

    Subclasses must implement verify().  The method must be synchronous and
    must not raise; failures should be returned as low-confidence results or
    raise RGBVerificationError so the caller can fall back gracefully.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Short human-readable name, e.g. 'stub', 'openai_vision_v1'."""

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Version string for audit logging."""

    @abstractmethod
    def verify(self, input_: HybridVerificationInput) -> RGBVerificationResult:
        """
        Run RGB verification and return a result.

        Must return a valid RGBVerificationResult even when evidence is thin.
        Raises RGBVerificationError only on unrecoverable failure (e.g. bad
        credentials, provider down).  Callers should catch RGBVerificationError
        and continue on the pose-only path.
        """


# ---------------------------------------------------------------------------
# Stub implementation
# ---------------------------------------------------------------------------

class StubRGBVerifier(RGBVerifier):
    """
    Lightweight stand-in that returns neutral scores without calling any model.

    Suitable for:
      - Development and testing.
      - Production when no real RGB model is available yet.
      - Benchmarking the fusion pipeline without RGB latency.

    The stub reflects pose_confidence back as visual_confidence so fused
    results are coherent with the pose signal when integration tests run end
    to end.
    """

    @property
    def provider_name(self) -> str:
        return "stub"

    @property
    def model_version(self) -> str:
        return "stub_v0"

    def verify(self, input_: HybridVerificationInput) -> RGBVerificationResult:
        start = time.monotonic()

        # Mirror pose confidence so fused scores are stable in tests.
        visual_confidence = input_.pose_confidence

        # Neutral integrity scores — stub does not flag anything.
        result = RGBVerificationResult(
            visual_confidence=visual_confidence,
            occlusion_score=0.10,
            assistance_likelihood=0.05,
            multiple_dog_score=0.10 if input_.multiple_dogs_detected else 0.03,
            fraud_risk_score=0.05,
            provider=self.provider_name,
            model_version=self.model_version,
            latency_ms=int((time.monotonic() - start) * 1000),
            notes="Stub verifier — scores reflect pose confidence only.",
        )
        return result


# ---------------------------------------------------------------------------
# Registry and factory
# ---------------------------------------------------------------------------

_REGISTRY: dict[str, type[RGBVerifier]] = {
    "stub": StubRGBVerifier,
}


def register_rgb_verifier(key: str, cls: type[RGBVerifier]) -> None:
    """
    Register a new verifier class under a string key.

    Call this at startup before the first request.  Overwrites existing
    registrations so providers can be hot-swapped in tests.
    """
    _REGISTRY[key] = cls


def get_rgb_verifier(provider_key: str = "stub") -> RGBVerifier:
    """
    Return an instance of the registered verifier for provider_key.

    Raises KeyError if the key is not registered.
    """
    cls = _REGISTRY.get(provider_key)
    if cls is None:
        raise KeyError(
            f"RGB verifier '{provider_key}' is not registered. "
            f"Available: {sorted(_REGISTRY.keys())}"
        )
    return cls()
