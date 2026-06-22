"""
Pydantic models for the trick-combo system.

TrickComboEntry       -- one row from trick_combos vocabulary
TrickSegment          -- a decoded continuous trick segment from per-frame predictions
ComboStepResult       -- outcome for a single expected step in the combo
ComboMatchResult      -- overall match outcome for a full combo attempt
ComboAnalysisSummary  -- stored in analysis_summary on the verification row
"""

from __future__ import annotations

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

class TrickComboEntry(BaseModel):
    """
    One row from the trick_combos table.

    slug                    -- unique identifier used as activity_id prefix, e.g. 'sit_then_down'
    display_name            -- human-readable label for the combo
    trick_sequence          -- ordered list of trick slugs the dog must perform
    active                  -- whether this combo is enabled for verification
    difficulty              -- 1 (easy) to 5 (hard)
    min_step_confidence     -- per-step confidence below which the step is flagged low_confidence
    min_combo_score         -- minimum fraction of steps detected to report partial (vs failed)
    min_segment_duration_ms -- discard decoded segments shorter than this (noise filter)
    smooth_window_frames    -- mode-filter window applied before run-length encoding
    """
    id: str = ""
    slug: str
    display_name: str
    trick_sequence: list[str]
    active: bool = True
    difficulty: int = 2
    min_step_confidence: float = 0.65
    min_combo_score: float = 0.70
    min_segment_duration_ms: int = 300
    smooth_window_frames: int = 5


# ---------------------------------------------------------------------------
# Segment decoder output
# ---------------------------------------------------------------------------

class TrickSegment(BaseModel):
    """
    A contiguous run of frames classified as the same trick after smoothing.

    trick_slug      -- slug from TRICK_LABEL_MAP (e.g. 'sit')
    start_ms        -- start time in milliseconds
    end_ms          -- end time in milliseconds
    confidence      -- mean softmax probability for this class across the segment
    frame_count     -- number of raw frames in the segment
    """
    trick_slug: str
    start_ms: int
    end_ms: int
    confidence: float
    frame_count: int

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


# ---------------------------------------------------------------------------
# Combo match result
# ---------------------------------------------------------------------------

class ComboStepResult(BaseModel):
    """
    Outcome for one expected step in the combo.

    expected_trick  -- slug of the expected trick at this position
    detected        -- True if a matching segment was found
    confidence      -- confidence of the matched segment, or None if not detected
    start_ms        -- start time of the matched segment, or None
    end_ms          -- end time of the matched segment, or None
    in_order        -- True if this step appeared after the previous matched step
    low_confidence  -- True if detected but confidence < min_step_confidence
    """
    expected_trick: str
    detected: bool
    confidence: float | None
    start_ms: int | None
    end_ms: int | None
    in_order: bool
    low_confidence: bool


# Status values returned in ComboMatchResult.status:
#
#   complete        -- all steps detected in correct order with sufficient confidence
#   partial         -- some steps detected in order (>= min_combo_score fraction)
#   wrong_order     -- all steps present but not in the required order
#   missing_step    -- one or more required steps absent entirely
#   low_confidence  -- all steps detected in order but at least one is low-confidence
#   failed          -- fewer steps detected than min_combo_score fraction
#   unknown_combo   -- combo slug not found in vocabulary

class ComboMatchResult(BaseModel):
    """
    Overall result of matching a decoded segment sequence against a combo definition.
    """
    status: str                    # see status values above
    combo_slug: str
    display_name: str
    expected_sequence: list[str]
    detected_sequence: list[str]   # slugs from all non-noise segments (including extras)
    steps: list[ComboStepResult]
    combo_score: float             # fraction of required steps matched (0.0 to 1.0)
    failure_reason: str | None
    retry_guidance: str | None


# ---------------------------------------------------------------------------
# Stored analysis summary
# ---------------------------------------------------------------------------

class ComboAnalysisSummary(BaseModel):
    """
    Stored in the analysis_summary field of ActivityAnalysisResponse.
    """
    combo_slug: str
    display_name: str
    expected_sequence: list[str]
    detected_sequence: list[str]
    steps: list[dict]             # ComboStepResult.model_dump() for each step
    combo_score: float
    segments: list[dict]          # TrickSegment.model_dump() for each decoded segment
