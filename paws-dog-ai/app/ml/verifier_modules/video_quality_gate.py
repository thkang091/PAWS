"""
VideoQualityGate — wraps the existing VideoValidationService.

Implementation status: available
Requires: video_path (storage path) OR recording_metadata duration/fps fields.

When video_path is None, falls back to duration/fps from recording_metadata if
present.  Passes when the recording meets minimum duration, maximum duration,
and is not obviously corrupted.
"""

from __future__ import annotations

import time

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule


class VideoQualityGate(VerifierModule):
    name                  = "video_quality_gate"
    implementation_status = "available"
    version               = "video-quality-gate-v1"
    requires_rgb          = False
    requires_pose         = False

    def run(self, input_: ModuleInput) -> ModuleOutput:
        start = time.monotonic()

        # When a real video path is available, delegate to the full validator.
        if input_.video_path:
            from app.services.video_validation_service import VideoValidationService  # noqa: PLC0415
            valid, error = VideoValidationService().validate(input_.video_path)
            elapsed = int((time.monotonic() - start) * 1000)
            if valid:
                return ModuleOutput(
                    module_name=self.name,
                    implementation_status=self.implementation_status,
                    passed=True,
                    confidence=1.0,
                    reason_codes=["VIDEO_VALID"],
                    metrics={},
                    latency_ms=elapsed,
                )
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=False,
                confidence=1.0,
                reason_codes=["VIDEO_INVALID", _normalize_error(error)],
                metrics={"error": error or ""},
                latency_ms=elapsed,
            )

        # Fallback: check duration from recording_metadata only.
        from app.config import settings  # noqa: PLC0415
        duration = input_.recording_metadata.get("duration_seconds")
        elapsed = int((time.monotonic() - start) * 1000)

        if duration is None:
            # No video path and no metadata — cannot validate.
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["VIDEO_PATH_UNAVAILABLE"],
                metrics={},
                latency_ms=elapsed,
            )

        if duration < settings.min_video_duration_seconds:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=False,
                confidence=1.0,
                reason_codes=["VIDEO_TOO_SHORT"],
                metrics={"duration_seconds": duration,
                         "min_seconds": settings.min_video_duration_seconds},
                latency_ms=elapsed,
            )

        if duration > settings.max_video_duration_seconds:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=False,
                confidence=1.0,
                reason_codes=["VIDEO_TOO_LONG"],
                metrics={"duration_seconds": duration,
                         "max_seconds": settings.max_video_duration_seconds},
                latency_ms=elapsed,
            )

        return ModuleOutput(
            module_name=self.name,
            implementation_status=self.implementation_status,
            passed=True,
            confidence=1.0,
            reason_codes=["DURATION_OK"],
            metrics={"duration_seconds": duration},
            latency_ms=elapsed,
        )


def _normalize_error(error: str | None) -> str:
    """Map a VideoValidationService error string to a reason code."""
    if not error:
        return "VIDEO_VALIDATION_FAILED"
    e = error.lower()
    if "too short" in e:
        return "VIDEO_TOO_SHORT"
    if "too long" in e:
        return "VIDEO_TOO_LONG"
    if "not found" in e or "path" in e:
        return "VIDEO_NOT_FOUND"
    return "VIDEO_VALIDATION_FAILED"
