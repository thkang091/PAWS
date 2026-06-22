"""
Stub and unavailable verifier modules.

All modules in this file that are marked 'unavailable' always return
passed=None with reason_codes=["CAPABILITY_UNAVAILABLE"].  They NEVER
return passed=True.  This ensures the strategy executor conservatively
marks the activity as 'unsupported' rather than silently passing.

The MultipleDogDetector is marked 'stub' because it can read the
multiple_dogs_detected flag from the pose sequence (a boolean already
produced by the pose inference pipeline), but it cannot independently
count or track multiple dogs via bounding boxes or visual analysis.

Modules and their status
------------------------
  DogTracker               — unavailable (no bounding-box tracker)
  ApproachDetector         — unavailable (needs tracking + trajectory)
  TargetZoneDetector       — unavailable (needs object detection + zone geometry)
  RotationDetector         — unavailable (needs multi-frame angle tracking)
  MultipleDogDetector      — stub (reads existing flag; cannot do full analysis)
  ObjectDetector           — unavailable (no object detection model)
  ObjectInteractionDetector — unavailable (depends on ObjectDetector + DogTracker)
  AudioCueDetector         — unavailable (no audio analysis pipeline)
  EatingActionDetector     — unavailable (no action recognition model)
"""

from __future__ import annotations

import time

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule


# ---------------------------------------------------------------------------
# Helper: builds a standard unavailable output
# ---------------------------------------------------------------------------

def _unavailable(name: str, version: str | None, start: float) -> ModuleOutput:
    return ModuleOutput(
        module_name=name,
        implementation_status="unavailable",
        passed=None,
        confidence=None,
        reason_codes=["CAPABILITY_UNAVAILABLE"],
        metrics={
            "implementation_status": "unavailable",
            "required_artifact": version or "none",
        },
        latency_ms=int((time.monotonic() - start) * 1000),
    )


# ---------------------------------------------------------------------------
# DogTracker
# ---------------------------------------------------------------------------

class DogTracker(VerifierModule):
    """
    Dog bounding-box tracker.

    Unavailable: no bounding-box detection or temporal tracking implementation
    exists in this codebase.  DeepLabCut provides keypoints but not bounding
    boxes suitable for trajectory analysis.
    """
    name                  = "dog_tracking"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(self.name, "dog-tracker-model-v1 (not trained)", time.monotonic())


# ---------------------------------------------------------------------------
# ApproachDetector
# ---------------------------------------------------------------------------

class ApproachDetector(VerifierModule):
    """
    Detects whether the dog moved toward a target point across frames.

    Unavailable: requires a working DogTracker to provide trajectory data.
    """
    name                  = "approach_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(self.name, "requires dog_tracking", time.monotonic())


# ---------------------------------------------------------------------------
# TargetZoneDetector
# ---------------------------------------------------------------------------

class TargetZoneDetector(VerifierModule):
    """
    Detects whether the dog entered a specified target zone (e.g., near a food bowl).

    Unavailable: requires object detection to locate the target and bounding-box
    tracking to evaluate proximity.
    """
    name                  = "target_zone_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires dog_tracking + object_detection",
            time.monotonic(),
        )


# ---------------------------------------------------------------------------
# RotationDetector
# ---------------------------------------------------------------------------

class RotationDetector(VerifierModule):
    """
    Detects whether the dog completed a rotation (e.g., spin, roll over).

    Unavailable: requires multi-frame body orientation tracking.  The current
    keypoint set from VNDetectAnimalBodyPoseRequest does not include a stable
    orientation vector suitable for rotation measurement.
    """
    name                  = "rotation_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires orientation-tracking model",
            time.monotonic(),
        )


# ---------------------------------------------------------------------------
# MultipleDogDetector (stub — reads existing flag only)
# ---------------------------------------------------------------------------

class MultipleDogDetector(VerifierModule):
    """
    Detects whether multiple dogs are present.

    Status: stub.  Reads the multiple_dogs_detected boolean flag already set
    by the pose inference pipeline.  Cannot independently count dogs or verify
    the flag through visual analysis.

    Returns passed=True when multiple_dogs_detected is False (single dog).
    Returns passed=False when multiple_dogs_detected is True (multiple dogs).
    Returns passed=None when pose data is unavailable.

    This module is a stub because the flag origin is opaque — the inference
    pipeline sets it heuristically.  A full implementation would use an object
    detection model to count distinct dog bounding boxes.
    """
    name                  = "multiple_dog_detection"
    implementation_status = "stub"
    version               = "multiple-dog-detector-stub-v1"
    requires_rgb          = False
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        start = time.monotonic()
        elapsed = int((time.monotonic() - start) * 1000)

        if input_.pose_sequence is None:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["POSE_SEQUENCE_MISSING"],
                metrics={},
                latency_ms=elapsed,
            )

        multiple = getattr(input_.pose_sequence, "multiple_dogs_detected", False)
        if multiple:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=False,
                confidence=0.6,  # stub confidence — flag is heuristic
                reason_codes=["MULTIPLE_DOGS_DETECTED_FLAG"],
                metrics={"multiple_dogs_detected_flag": True,
                         "note": "Flag from pose inference; visual count not available"},
                latency_ms=elapsed,
            )

        # Stub: we cannot confirm only one dog; return None not True.
        return ModuleOutput(
            module_name=self.name,
            implementation_status=self.implementation_status,
            passed=None,  # stub must not return passed=True
            confidence=None,
            reason_codes=["STUB_CANNOT_CONFIRM_SINGLE_DOG"],
            metrics={"multiple_dogs_detected_flag": False,
                     "note": "Flag absent; visual confirmation unavailable"},
            latency_ms=elapsed,
        )


# ---------------------------------------------------------------------------
# ObjectDetector
# ---------------------------------------------------------------------------

class ObjectDetector(VerifierModule):
    """
    General-purpose object detection (food bowl, toy, target object).

    Unavailable: no object detection model is integrated.
    """
    name                  = "object_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = False

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires object-detection model (e.g., YOLOv8 fine-tuned on dog-training scenes)",
            time.monotonic(),
        )


# ---------------------------------------------------------------------------
# ObjectInteractionDetector
# ---------------------------------------------------------------------------

class ObjectInteractionDetector(VerifierModule):
    """
    Detects whether the dog interacted with a specific object (touched, ate from, etc.).

    Unavailable: depends on ObjectDetector + DogTracker, neither of which is implemented.
    """
    name                  = "object_interaction_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires object_detection + dog_tracking",
            time.monotonic(),
        )


# ---------------------------------------------------------------------------
# AudioCueDetector
# ---------------------------------------------------------------------------

class AudioCueDetector(VerifierModule):
    """
    Detects whether the owner gave a specific audio cue.

    Unavailable: no audio analysis pipeline.  The mobile client does not
    capture or transmit audio with verification requests.
    """
    name                  = "audio_cue_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = False
    requires_pose         = False
    requires_audio        = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires audio capture + speech/cue recognition model",
            time.monotonic(),
        )


# ---------------------------------------------------------------------------
# EatingActionDetector
# ---------------------------------------------------------------------------

class EatingActionDetector(VerifierModule):
    """
    Detects whether the dog is eating (head-lowering to bowl + jaw movement).

    Unavailable: requires an action recognition model for eating behavior, which
    does not exist in this codebase.  The quadruped keypoint set does not
    include jaw keypoints needed for eating detection.
    """
    name                  = "eating_action_detection"
    implementation_status = "unavailable"
    version               = None
    requires_rgb          = True
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        return _unavailable(
            self.name,
            "requires eating-action recognition model (jaw keypoints unavailable in current pose model)",
            time.monotonic(),
        )
