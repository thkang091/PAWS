"""
Generic verification strategy executor.

Loads an activity definition's strategy, runs each configured verifier module
in declaration order, combines results conservatively, and returns a
StrategyExecutionResult.

Conservative combination rules
-------------------------------
  any module passed=False         -> final status "failed"
  ALL required modules passed=True -> final status "passed"
  any required module passed=None -> "unsupported" (capability unavailable)
  all required modules pass but confidence low -> "retry_uncertain"

Sit backward compatibility
--------------------------
When existing_classifier_authoritative=True in the strategy the executor DOES
NOT use these modules as the authoritative answer.  It runs them for telemetry
only and returns the result produced by the existing SitClassifier.  The caller
(main.py) must still pass the sit-classifier output separately; this function
receives it via the `authoritative_result` parameter.

Data collection mode
--------------------
For experimental activities that have missing_capabilities the executor returns
"unsupported_data_collection_only" so the caller knows to store the attempt in
activity_data_collection_submissions instead of persisting a real verification.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from app.ml.verifier_modules import MODULE_REGISTRY, ModuleInput, ModuleOutput, get_module
from app.models.activity_models import (
    ActivityDefinition,
    ModuleExecutionSummary,
    StrategyExecutionResult,
    VerificationStatus,
    VerificationStrategy,
)
from app.utils.logging import log_info, log_warn


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def execute_activity(
    activity_def: ActivityDefinition,
    pose_sequence: Any | None,
    *,
    video_path: str | None = None,
    recording_metadata: dict | None = None,
    device_metadata: dict | None = None,
    audio_metadata: dict | None = None,
    tier: str = "standard_daily",
    verification_id: str | None = None,
    # When the strategy has existing_classifier_authoritative=True, the caller
    # passes the authoritative result here instead of having us compute it.
    authoritative_result: dict | None = None,
) -> StrategyExecutionResult:
    """
    Execute the activity's verification strategy and return a consolidated result.

    Parameters
    ----------
    activity_def:          Loaded ActivityDefinition.
    pose_sequence:         PoseSequence object or None.
    video_path:            Path to compressed video (optional).
    recording_metadata:   Duration, fps, etc. from the mobile client.
    device_metadata:      Device telemetry from the mobile client.
    audio_metadata:       Audio cues if captured (optional).
    tier:                 Verification tier string.
    verification_id:      Caller-supplied UUID for audit linkage.
    authoritative_result: Dict with keys {passed, confidence, reason_codes}
                          used when existing_classifier_authoritative=True.
    """
    vid  = verification_id or str(uuid.uuid4())
    rec  = recording_metadata or {}
    dev  = device_metadata or {}
    aud  = audio_metadata or {}

    strategy = activity_def.parsed_strategy()
    missing  = activity_def.missing_capabilities or []

    # ------------------------------------------------------------------
    # Submission gate: draft / disabled should never reach the executor,
    # but guard defensively.
    # ------------------------------------------------------------------
    if activity_def.verification_status in (
        VerificationStatus.DRAFT, VerificationStatus.DISABLED
    ):
        return _inert_result(
            activity_def, strategy, vid,
            final_status="unsupported",
            reason_codes=["ACTIVITY_NOT_SUBMITTABLE"],
        )

    # ------------------------------------------------------------------
    # Data collection mode: experimental with missing capabilities.
    # We still run the available modules for telemetry but mark the
    # overall status as unsupported_data_collection_only.
    # ------------------------------------------------------------------
    data_collection_mode = (
        activity_def.verification_status == VerificationStatus.EXPERIMENTAL
        and len(missing) > 0
    )

    # ------------------------------------------------------------------
    # Build the shared ModuleInput.
    # ------------------------------------------------------------------
    module_input = ModuleInput(
        verification_id=vid,
        activity_id=activity_def.slug,
        pose_sequence=pose_sequence,
        video_path=video_path,
        recording_metadata=rec,
        device_metadata=dev,
        audio_metadata=aud,
        tier=tier,
    )

    # ------------------------------------------------------------------
    # Run configured modules (quality gates first, then behavior modules).
    # ------------------------------------------------------------------
    quality_gates   = ["video_quality_gate", "pose_quality_gate"]
    behavior_modules = [m for m in strategy.modules if m not in quality_gates]
    ordered_modules  = (
        [m for m in quality_gates if m in strategy.modules]
        + behavior_modules
    )

    module_outputs: list[ModuleOutput] = []
    summaries: list[ModuleExecutionSummary] = []

    for cap_name in ordered_modules:
        module = get_module(cap_name)
        if module is None:
            # Module not in registry — treat as unavailable.
            dummy = _missing_module_output(cap_name)
            module_outputs.append(dummy)
            summaries.append(_summarize(dummy))
            continue

        output = module.run_safe(module_input)
        try:
            module.assert_safe_output(output)
        except AssertionError as exc:
            log_warn("strategy_executor", "unsafe_module_output",
                     module=cap_name, error=str(exc))
            output = _missing_module_output(cap_name)

        module_outputs.append(output)
        summaries.append(_summarize(output))

    # ------------------------------------------------------------------
    # Authoritative classifier override (Sit legacy path).
    # ------------------------------------------------------------------
    if strategy.existing_classifier_authoritative and authoritative_result is not None:
        auth_passed     = authoritative_result.get("passed")
        auth_confidence = authoritative_result.get("confidence")
        auth_reasons    = authoritative_result.get("reason_codes", [])

        final_status = _map_authoritative_to_status(auth_passed)
        quality_score = _compute_quality_score(module_outputs)

        return StrategyExecutionResult(
            activity_slug=activity_def.slug,
            verification_status_at_time=activity_def.verification_status,
            final_status=final_status,
            confidence=auth_confidence,
            quality_score=quality_score,
            module_outputs=summaries,
            reason_codes=auth_reasons + _collect_reason_codes(module_outputs),
            retry_guidance=_retry_guidance(final_status),
            missing_capabilities=missing,
            verifier_version=activity_def.active_verifier_version or "sit_rule_based_v1",
            audit_id=vid,
            used_authoritative_classifier=True,
        )

    # ------------------------------------------------------------------
    # Conservative combination for non-authoritative strategies.
    # ------------------------------------------------------------------
    final_status, confidence, combined_reasons = _combine(
        module_outputs, strategy.modules, missing, data_collection_mode
    )
    quality_score = _compute_quality_score(module_outputs)

    return StrategyExecutionResult(
        activity_slug=activity_def.slug,
        verification_status_at_time=activity_def.verification_status,
        final_status=final_status,
        confidence=confidence,
        quality_score=quality_score,
        module_outputs=summaries,
        reason_codes=combined_reasons,
        retry_guidance=_retry_guidance(final_status),
        missing_capabilities=missing,
        verifier_version=activity_def.active_verifier_version or "generic_v1",
        audit_id=vid,
        used_authoritative_classifier=False,
    )


# ---------------------------------------------------------------------------
# Conservative combination logic
# ---------------------------------------------------------------------------

def _combine(
    outputs: list[ModuleOutput],
    required_modules: list[str],
    missing_capabilities: list[str],
    data_collection_mode: bool,
) -> tuple[str, float | None, list[str]]:
    """
    Apply conservative combination rules and return (final_status, confidence, reasons).
    """
    if data_collection_mode:
        return (
            "unsupported_data_collection_only",
            None,
            ["MISSING_CAPABILITIES"] + [f"MISSING_{m.upper()}" for m in missing_capabilities],
        )

    if missing_capabilities:
        return (
            "unsupported",
            None,
            ["MISSING_CAPABILITIES"] + [f"MISSING_{m.upper()}" for m in missing_capabilities],
        )

    reason_codes: list[str] = []
    passed_count = 0
    uncertain_count = 0

    for out in outputs:
        reason_codes.extend(out.reason_codes)
        if out.passed is False:
            return "failed", out.confidence, reason_codes
        if out.passed is None:
            uncertain_count += 1
        else:
            passed_count += 1

    if uncertain_count > 0:
        return "retry_uncertain", None, reason_codes + ["UNCERTAIN_MODULE_OUTPUT"]

    # All modules passed.
    confidences = [o.confidence for o in outputs if o.confidence is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else None

    if avg_confidence is not None and avg_confidence < 0.55:
        return "retry_uncertain", avg_confidence, reason_codes + ["LOW_CONFIDENCE"]

    return "passed", avg_confidence, reason_codes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _missing_module_output(cap_name: str) -> ModuleOutput:
    return ModuleOutput(
        module_name=cap_name,
        implementation_status="unavailable",
        passed=None,
        confidence=None,
        reason_codes=["CAPABILITY_NOT_IN_REGISTRY"],
        metrics={},
        latency_ms=0,
    )


def _summarize(out: ModuleOutput) -> ModuleExecutionSummary:
    return ModuleExecutionSummary(
        module_name=out.module_name,
        implementation_status=out.implementation_status,
        passed=out.passed,
        confidence=out.confidence,
        reason_codes=out.reason_codes,
        latency_ms=out.latency_ms,
    )


def _collect_reason_codes(outputs: list[ModuleOutput]) -> list[str]:
    codes: list[str] = []
    for o in outputs:
        codes.extend(o.reason_codes)
    return codes


def _compute_quality_score(outputs: list[ModuleOutput]) -> float:
    """Average confidence of quality-gate modules, or 1.0 if none ran."""
    gates = [o for o in outputs if o.module_name in ("video_quality_gate", "pose_quality_gate")]
    if not gates:
        return 1.0
    confs = [g.confidence for g in gates if g.confidence is not None]
    return round(sum(confs) / len(confs), 4) if confs else 1.0


def _map_authoritative_to_status(passed: bool | None) -> str:
    if passed is True:
        return "passed"
    if passed is False:
        return "failed"
    return "retry_uncertain"


def _retry_guidance(final_status: str) -> str | None:
    guidance = {
        "retry_uncertain":               "Retry with better lighting or a steadier camera angle.",
        "unsupported":                   "This activity cannot be verified yet; capabilities are missing.",
        "unsupported_data_collection_only": (
            "Submission stored for data collection. "
            "Verification is not available for this activity yet."
        ),
    }
    return guidance.get(final_status)


def _inert_result(
    activity_def: ActivityDefinition,
    strategy: VerificationStrategy,
    vid: str,
    final_status: str,
    reason_codes: list[str],
) -> StrategyExecutionResult:
    return StrategyExecutionResult(
        activity_slug=activity_def.slug,
        verification_status_at_time=activity_def.verification_status,
        final_status=final_status,
        confidence=None,
        quality_score=0.0,
        module_outputs=[],
        reason_codes=reason_codes,
        retry_guidance=None,
        missing_capabilities=activity_def.missing_capabilities or [],
        verifier_version=activity_def.active_verifier_version or "none",
        audit_id=vid,
        used_authoritative_classifier=False,
    )
