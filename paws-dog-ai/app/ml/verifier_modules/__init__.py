"""
Verifier module system for the Activity Verifier Compiler.

Each module is independently testable and declares its implementation status.
Modules never silently pass verification when they are stubs or unavailable.

Implementation statuses
-----------------------
  available   — real implementation backed by working code or models.
  stub        — partial implementation that can run but has known limitations;
                returns passed=None, not passed=True.
  unavailable — no implementation exists; always returns passed=None with
                capability_unavailable reason code.

Module registry
---------------
MODULE_REGISTRY maps capability name → VerifierModule class.
Use get_module(name) to instantiate a module by capability name.
"""

from __future__ import annotations

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule
from app.ml.verifier_modules.video_quality_gate import VideoQualityGate
from app.ml.verifier_modules.pose_quality_gate import PoseQualityGate
from app.ml.verifier_modules.pose_transition_detector import PoseTransitionDetector
from app.ml.verifier_modules.hold_duration_detector import HoldDurationDetector
from app.ml.verifier_modules.stub_modules import (
    DogTracker,
    ApproachDetector,
    TargetZoneDetector,
    RotationDetector,
    MultipleDogDetector,
    ObjectDetector,
    ObjectInteractionDetector,
    AudioCueDetector,
    EatingActionDetector,
)

MODULE_REGISTRY: dict[str, type[VerifierModule]] = {
    "video_quality_gate":         VideoQualityGate,
    "pose_quality_gate":          PoseQualityGate,
    "pose_transition_detector":   PoseTransitionDetector,
    "hold_duration_detector":     HoldDurationDetector,
    "dog_tracking":               DogTracker,
    "approach_detection":         ApproachDetector,
    "target_zone_detection":      TargetZoneDetector,
    "rotation_detection":         RotationDetector,
    "multiple_dog_detection":     MultipleDogDetector,
    "object_detection":           ObjectDetector,
    "object_interaction_detection": ObjectInteractionDetector,
    "audio_cue_detection":        AudioCueDetector,
    "eating_action_detection":    EatingActionDetector,
}


def get_module(capability_name: str) -> VerifierModule | None:
    """
    Return an instantiated module for the given capability name.
    Returns None if the capability name is not in the registry.
    """
    cls = MODULE_REGISTRY.get(capability_name)
    return cls() if cls is not None else None


__all__ = [
    "ModuleInput",
    "ModuleOutput",
    "VerifierModule",
    "MODULE_REGISTRY",
    "get_module",
]
