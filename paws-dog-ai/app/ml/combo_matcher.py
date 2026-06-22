"""
Combo matcher: match a list of decoded TrickSegments against an expected combo.

Matching algorithm
------------------
Given:
  detected_segments  -- ordered list of TrickSegment (by start_ms, non-noise only)
  expected_tricks    -- ordered list of trick slugs from TrickComboEntry

Step 1: extract detected slug sequence (may include repeated slugs, extras).
Step 2: find the expected sequence as an ordered subsequence of detected slugs,
        greedily left-to-right.  Record the matched segment for each step.
Step 3: determine outcome:

  All expected steps matched in order?
    -> Check per-step confidence >= min_step_confidence for every step.
       All OK  -> "complete"
       Any low -> "low_confidence"

  Some but not all steps matched in order (fraction >= min_combo_score)?
    -> "partial"

  Expected steps are all present in the detected sequence but not in order?
    -> "wrong_order"

  Steps matched < min_combo_score fraction?
    -> "missing_step" if at least one required step was never detected at all
    -> "failed" otherwise (detected but fragmented / below threshold)

Guidance messages
-----------------
Messages are assembled from the step results rather than hard-coded strings,
so they compose naturally regardless of combo length.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.combo_models import (
    ComboMatchResult,
    ComboStepResult,
    TrickComboEntry,
    TrickSegment,
)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class ComboMatchConfig:
    """
    Overridable match parameters.  Defaults come from TrickComboEntry fields.
    """
    min_step_confidence: float = 0.65
    min_combo_score: float = 0.70


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def match_combo(
    detected_segments: list[TrickSegment],
    combo: TrickComboEntry,
    config: ComboMatchConfig | None = None,
) -> ComboMatchResult:
    """
    Match a decoded segment sequence against the expected combo.

    Args:
        detected_segments:  output of decode_segments() — ordered by start_ms.
        combo:              vocabulary entry defining the required sequence.
        config:             optional threshold overrides.

    Returns:
        ComboMatchResult with status, per-step breakdown, and user guidance.
    """
    if config is None:
        config = ComboMatchConfig(
            min_step_confidence=combo.min_step_confidence,
            min_combo_score=combo.min_combo_score,
        )

    expected = combo.trick_sequence
    detected_slugs = [s.trick_slug for s in detected_segments]

    # Greedy subsequence match.
    matched_segments: list[TrickSegment | None] = _match_subsequence(
        detected_segments, expected
    )

    n_expected = len(expected)
    n_matched = sum(1 for s in matched_segments if s is not None)
    combo_score = n_matched / n_expected if n_expected > 0 else 0.0

    # Build per-step results.
    last_end_ms = -1
    steps: list[ComboStepResult] = []
    for idx, (exp_slug, seg) in enumerate(zip(expected, matched_segments)):
        if seg is None:
            steps.append(ComboStepResult(
                expected_trick=exp_slug,
                detected=False,
                confidence=None,
                start_ms=None,
                end_ms=None,
                in_order=False,
                low_confidence=False,
            ))
        else:
            in_order = seg.start_ms >= last_end_ms
            low_conf = seg.confidence < config.min_step_confidence
            steps.append(ComboStepResult(
                expected_trick=exp_slug,
                detected=True,
                confidence=seg.confidence,
                start_ms=seg.start_ms,
                end_ms=seg.end_ms,
                in_order=in_order,
                low_confidence=low_conf,
            ))
            last_end_ms = seg.end_ms

    # Determine status.
    status, failure_reason, retry_guidance = _determine_status(
        steps, combo, config, detected_slugs, combo_score
    )

    return ComboMatchResult(
        status=status,
        combo_slug=combo.slug,
        display_name=combo.display_name,
        expected_sequence=expected,
        detected_sequence=detected_slugs,
        steps=steps,
        combo_score=round(combo_score, 4),
        failure_reason=failure_reason,
        retry_guidance=retry_guidance,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _match_subsequence(
    segments: list[TrickSegment],
    expected: list[str],
) -> list[TrickSegment | None]:
    """
    Greedy left-to-right subsequence search.

    For each expected trick (in order), find the first segment in `segments`
    that matches the slug and starts after the previous matched segment ended.

    Returns a list of the same length as `expected`.  Each element is the
    matched TrickSegment or None if not found.
    """
    result: list[TrickSegment | None] = []
    cursor = 0   # index into segments (advance forward only)

    for slug in expected:
        found: TrickSegment | None = None
        for i in range(cursor, len(segments)):
            if segments[i].trick_slug == slug:
                found = segments[i]
                cursor = i + 1
                break
        result.append(found)

    return result


def _determine_status(
    steps: list[ComboStepResult],
    combo: TrickComboEntry,
    config: ComboMatchConfig,
    detected_slugs: list[str],
    combo_score: float,
) -> tuple[str, str | None, str | None]:
    """
    Return (status, failure_reason, retry_guidance) from step analysis.
    """
    n_detected = sum(1 for s in steps if s.detected)
    n_expected = len(steps)
    all_detected = n_detected == n_expected
    all_in_order = all(s.in_order for s in steps if s.detected)
    any_low_conf = any(s.low_confidence for s in steps if s.detected)

    # --- All steps detected in the greedy subsequence search ---
    if all_detected:
        if not all_in_order:
            return (
                "wrong_order",
                "The tricks were detected but not in the required order.",
                _wrong_order_guidance(combo),
            )
        if any_low_conf:
            low_steps = [s.expected_trick for s in steps if s.low_confidence]
            return (
                "low_confidence",
                f"Low confidence on: {', '.join(low_steps)}.",
                "Keep your dog fully visible and well-lit during each trick.",
            )
        return "complete", None, None

    # --- Check for wrong-order using unordered set presence ---
    expected_set = set(s.expected_trick for s in steps)
    detected_set = set(detected_slugs)
    if expected_set.issubset(detected_set):
        return (
            "wrong_order",
            "The tricks were detected in the wrong order.",
            _wrong_order_guidance(combo),
        )

    # --- Partial or missing ---
    if combo_score >= config.min_combo_score:
        detected_names = [s.expected_trick for s in steps if s.detected]
        missing_names  = [s.expected_trick for s in steps if not s.detected]
        combo_display  = combo.display_name
        det_str  = ", ".join(t.capitalize() for t in detected_names) if detected_names else "none"
        miss_str = ", ".join(t.capitalize() for t in missing_names)
        return (
            "partial",
            f"Your dog completed {det_str}, but {miss_str} was not detected in {combo_display}.",
            "Retry and make sure each trick is performed clearly before moving to the next.",
        )

    # Determine whether a required trick was fully absent.
    truly_missing = [
        s.expected_trick for s in steps
        if not s.detected and s.expected_trick not in detected_set
    ]
    if truly_missing:
        miss_str = ", ".join(t.capitalize() for t in truly_missing)
        return (
            "missing_step",
            f"{miss_str} was not detected in the video.",
            "Perform each trick with a clear pause between steps.",
        )

    return (
        "failed",
        "The combo was not completed.",
        "Try again, performing each trick in the correct order.",
    )


def _wrong_order_guidance(combo: TrickComboEntry) -> str:
    seq = " -> ".join(t.capitalize() for t in combo.trick_sequence)
    return f"Perform the tricks in this order: {seq}."
