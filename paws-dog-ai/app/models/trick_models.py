"""
Models for the trick vocabulary system.

TrickThresholds      -- per-trick confidence and quality gate thresholds
TrickFeedback        -- per-trick user-facing feedback message templates
TrickVocabularyEntry -- full vocabulary row including thresholds and feedback
"""

from __future__ import annotations

from pydantic import BaseModel


class TrickThresholds(BaseModel):
    """
    Per-trick classifier thresholds.

    pass_confidence_threshold      - minimum confidence to mark the attempt passed.
    retry_confidence_threshold     - below this, return a retry status instead of failed.
    minimum_visible_joints         - minimum number of keypoints that must be visible.
    minimum_recording_duration_ms  - shortest acceptable clip length.
    hold_duration_ms               - if set, the dog must hold the pose for this long
                                     (relevant for sit, down, stay).
    """
    pass_confidence_threshold: float = 0.75
    retry_confidence_threshold: float = 0.50
    minimum_visible_joints: int = 6
    minimum_recording_duration_ms: int = 2000
    hold_duration_ms: int | None = None


class TrickFeedback(BaseModel):
    """
    User-facing feedback strings for common failure modes.

    Each value is a short plain-text message suitable for display in the
    mobile app.  Templates use {trick} as an optional placeholder.
    """
    insufficient_hold: str = "Your dog did not hold the {trick} long enough."
    dog_partially_out_of_frame: str = (
        "Your dog was partially out of frame. Keep the full body visible."
    )
    wrong_movement: str = (
        "A different movement was detected. Cue the {trick} from a standing position."
    )
    low_pose_confidence: str = (
        "Pose detection confidence is too low. Try better lighting and a steady camera."
    )
    incomplete_action: str = (
        "The {trick} attempt was detected but did not complete clearly."
    )
    ambiguous_attempt: str = (
        "The attempt was ambiguous. Cue a clear {trick} from a standing position."
    )


class TrickVocabularyEntry(BaseModel):
    """
    One row from the trick_vocabulary table, enriched with defaults.
    """
    id: str = ""
    slug: str
    display_name: str
    category: str = "basic"
    difficulty: int = 1
    active: bool = True
    thresholds: TrickThresholds = TrickThresholds()
    feedback: TrickFeedback = TrickFeedback()

    def format_feedback(self, key: str) -> str:
        """Return a feedback message with {trick} replaced by display_name."""
        msg = getattr(self.feedback, key, "")
        return msg.replace("{trick}", self.display_name.lower())
