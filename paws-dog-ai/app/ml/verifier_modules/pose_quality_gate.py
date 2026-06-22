"""
PoseQualityGate — wraps the existing pose_quality_service.

Implementation status: available
Requires: pose_sequence

Delegates to compute_quality() which checks average keypoint confidence,
dog frame coverage, missing-frame ratio, and timestamp consistency.
"""

from __future__ import annotations

import time

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule


class PoseQualityGate(VerifierModule):
    name                  = "pose_quality_gate"
    implementation_status = "available"
    version               = "pose-quality-gate-v1"
    requires_rgb          = False
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        start = time.monotonic()

        if input_.pose_sequence is None:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["POSE_SEQUENCE_MISSING"],
                metrics={},
                latency_ms=int((time.monotonic() - start) * 1000),
            )

        from app.services.pose_quality_service import compute_quality  # noqa: PLC0415
        quality = compute_quality(input_.pose_sequence)
        flags   = quality.flags

        elapsed = int((time.monotonic() - start) * 1000)

        # Collect per-flag reason codes.
        codes: list[str] = []
        if flags.low_average_confidence:
            codes.append("POSE_LOW_AVG_CONFIDENCE")
        if flags.low_dog_frame_coverage:
            codes.append("POSE_LOW_DOG_COVERAGE")
        if flags.excessive_missing_frames:
            codes.append("POSE_EXCESSIVE_MISSING_FRAMES")
        if flags.inconsistent_frame_rate:
            codes.append("POSE_INCONSISTENT_FRAME_RATE")

        passed = len(codes) == 0
        if passed:
            codes = ["POSE_QUALITY_OK"]

        return ModuleOutput(
            module_name=self.name,
            implementation_status=self.implementation_status,
            passed=passed,
            confidence=float(input_.pose_sequence.average_confidence),
            reason_codes=codes,
            metrics={
                "avg_confidence":        input_.pose_sequence.average_confidence,
                "frame_count":           len(input_.pose_sequence.frames),
                "low_confidence":        flags.low_average_confidence,
                "low_coverage":          flags.low_dog_frame_coverage,
                "excessive_missing":     flags.excessive_missing_frames,
                "inconsistent_fps":      flags.inconsistent_frame_rate,
            },
            latency_ms=elapsed,
        )
