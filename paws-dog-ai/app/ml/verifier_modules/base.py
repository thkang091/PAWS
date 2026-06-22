"""
Base interfaces for the verifier module system.

Every module in the Activity Verifier Compiler implements VerifierModule.
Modules are independently testable and fail safely: run_safe() wraps run()
and guarantees a well-formed ModuleOutput even on unexpected exceptions.

Implementation status contract
--------------------------------
  available   — run() produces a meaningful passed=True or passed=False result.
  stub        — run() runs but always returns passed=None; included so the
                strategy executor knows the module was attempted.
  unavailable — run() always returns passed=None with reason_codes=["CAPABILITY_UNAVAILABLE"].
                Stubs and unavailable modules MUST NOT return passed=True.

Combination rule used by the strategy executor
-----------------------------------------------
  ANY module returns passed=False  → activity failed
  ALL required modules return passed=True  → activity passed
  ANY required module returns passed=None  → missing capability; cannot verify
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel, ConfigDict

from app.models.pose_models import PoseSequence


class ModuleInput(BaseModel):
    """Inputs available to any verifier module."""
    # Allow arbitrary types so tests can pass lightweight pose-sequence fakes
    # without constructing a full PoseSequence Pydantic model.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    verification_id: str
    activity_id: str
    # Pose data from server inference or on-device extraction.
    # Typed as Any so both the real PoseSequence and test stand-ins are accepted.
    pose_sequence: object | None = None
    # Path to video in storage; may be None when only pose data is available.
    video_path: str | None = None
    # Metadata dicts forwarded from the client request.
    recording_metadata: dict = {}
    device_metadata: dict = {}
    audio_metadata: dict = {}
    # The requested verification tier (for policy-aware modules).
    tier: str = "standard_daily"


class ModuleOutput(BaseModel):
    """Output from one verifier module."""
    module_name: str
    # Reflects the class-level implementation_status of the module that produced this.
    implementation_status: str   # "available" | "stub" | "unavailable"
    # None means unable to determine (stub, unavailable, or genuinely inconclusive).
    # True  means the module's condition was met.
    # False means the module's condition was not met (hard failure evidence).
    passed: bool | None
    # None when unavailable.
    confidence: float | None
    # Structured reason codes using SCREAMING_SNAKE_CASE.
    reason_codes: list[str]
    # Module-specific numeric or categorical measurements.
    metrics: dict
    latency_ms: int


class VerifierModule(ABC):
    """
    Abstract base for all verifier modules.

    Subclasses must declare class variables:
      name                  — unique kebab or snake_case identifier
      implementation_status — "available" | "stub" | "unavailable"
      version               — semantic version string
      requires_rgb          — True if this module needs a video/image path
      requires_pose         — True if this module needs pose_sequence
      requires_audio        — True if this module needs audio_metadata
    """
    name: ClassVar[str]
    implementation_status: ClassVar[str]   # "available" | "stub" | "unavailable"
    version: ClassVar[str]
    requires_rgb: ClassVar[bool] = False
    requires_pose: ClassVar[bool] = True
    requires_audio: ClassVar[bool] = False

    @abstractmethod
    def run(self, input_: ModuleInput) -> ModuleOutput:
        """
        Execute the module.  Must not raise except in truly unexpected cases —
        use run_safe() in production code to guarantee a returned output.
        """

    def run_safe(self, input_: ModuleInput) -> ModuleOutput:
        """
        Execute the module with a catch-all exception guard.  Used by the
        strategy executor so one module failure does not abort the whole run.
        """
        start = time.monotonic()
        try:
            return self.run(input_)
        except Exception as exc:  # noqa: BLE001
            elapsed = int((time.monotonic() - start) * 1000)
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["MODULE_EXECUTION_ERROR"],
                metrics={"error": str(exc)},
                latency_ms=elapsed,
            )

    # ------------------------------------------------------------------
    # Safety invariant checked by tests
    # ------------------------------------------------------------------

    def assert_safe_output(self, output: ModuleOutput) -> None:
        """
        Raise AssertionError if a stub/unavailable module returns passed=True.
        Called by tests; not called in production paths.
        """
        if self.implementation_status in ("stub", "unavailable"):
            assert output.passed is not True, (
                f"Module {self.name!r} has status {self.implementation_status!r} "
                f"but returned passed=True — stubs and unavailable modules must "
                f"never silently pass verification."
            )
