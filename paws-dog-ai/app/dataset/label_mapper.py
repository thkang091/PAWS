"""
Maps raw classifier status strings to the four canonical final_label values
used in the training dataset.

  passed             -> passed
  failed_*           -> failed
  retry_*            -> invalid_recording
  error              -> invalid_recording
  ambiguous          -> ambiguous  (reserved for future use)
  unsupported_*      -> invalid_recording
"""

_LABEL_MAP: dict[str, str] = {
    "passed": "passed",
    "ambiguous": "ambiguous",
}

_PREFIX_MAP: list[tuple[str, str]] = [
    ("failed", "failed"),
    ("retry_", "invalid_recording"),
    ("error", "invalid_recording"),
    ("unsupported_", "invalid_recording"),
]


def to_final_label(status: str) -> str:
    if status in _LABEL_MAP:
        return _LABEL_MAP[status]
    for prefix, label in _PREFIX_MAP:
        if status.startswith(prefix):
            return label
    return "invalid_recording"


def is_hard_negative(final_label: str, quality_flags: dict) -> bool:
    """
    A hard negative is a verified failed attempt where recording quality was
    good — i.e., the model had clear visibility and still determined no sit.
    These are the most valuable negative examples for ML training.
    """
    if final_label != "failed":
        return False
    return not any(quality_flags.values())
