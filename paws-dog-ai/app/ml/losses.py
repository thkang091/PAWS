"""
Multi-task loss for the Temporal Behavior Transformer.

Loss components
---------------
global_loss     CrossEntropy(global_trick_logits, trick_label)
                Main supervision signal — which trick was performed?

frame_loss      CrossEntropy(frame_trick_logits, trick_label broadcast)
                Encourages temporal consistency; trick label is broadcast to
                all frames since we rarely have frame-level annotations.

completion_loss BCE(completion_score, trick_completed)
                Was the trick performed correctly?

boundary_loss   BCE(boundary_logits, boundary_labels)
                Heuristic labels: first 20 % and last 20 % of non-zero frames
                are marked as boundary frames.  Both channels (start, end)
                are trained with independent BCE.

failure_loss    CrossEntropy(failure_reason_logits, failure_reason_label)
                Derived from status strings in the exported dataset.
                Frames where the label is "passed" use an "ok" class (index 0)
                that is masked out of the CE loss so it does not dilute signal.

Total loss
----------
    L = w_global * global_loss
      + w_frame  * frame_loss
      + w_compl  * completion_loss
      + w_bound  * boundary_loss
      + w_fail   * failure_loss

Default weights are conservative: frame / boundary / failure losses act as
light regularisers; the global classification loss dominates.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import torch
import torch.nn as nn
import torch.nn.functional as F

from app.ml.models.tbt import TBTOutput


@dataclass
class LossWeights:
    global_trick: float = 1.0
    frame_trick:  float = 0.3
    completion:   float = 0.5
    boundary:     float = 0.2
    failure:      float = 0.3

    def to_dict(self) -> dict:
        return {
            "global_trick": self.global_trick,
            "frame_trick":  self.frame_trick,
            "completion":   self.completion,
            "boundary":     self.boundary,
            "failure":      self.failure,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "LossWeights":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class TBTLoss(nn.Module):
    """
    Multi-task loss module for TBT training.

    Expected target keys
    --------------------
    trick_label        : LongTensor (B,)   — global trick class (0 = no_action)
    completion_label   : FloatTensor (B,)  — 1.0 if trick_completed, 0.0 otherwise
    failure_label      : LongTensor (B,)   — failure reason class;
                         use FAILURE_IGNORE_INDEX for "no failure" (passed samples)
    boundary_label     : FloatTensor (B, T, 2) — optional; computed heuristically
                         if absent from targets

    Any absent key falls back to a zero-contribution placeholder.
    """

    FAILURE_IGNORE_INDEX: int = -100   # standard PyTorch ignore index for CE

    def __init__(self, weights: LossWeights | None = None) -> None:
        super().__init__()
        self.w = weights or LossWeights()
        self._ce = nn.CrossEntropyLoss()
        self._bce = nn.BCELoss()

    def forward(
        self,
        outputs: TBTOutput,
        targets: dict[str, torch.Tensor],
    ) -> dict[str, torch.Tensor]:
        """
        Returns a dict with individual loss components and "total".
        All values are scalar tensors so they can be logged directly.
        """
        losses: dict[str, torch.Tensor] = {}

        # ------------------------------------------------------------------
        # 1. Global trick classification
        # ------------------------------------------------------------------
        if "trick_label" in targets:
            losses["global"] = self._ce(
                outputs.global_trick_logits,
                targets["trick_label"],
            )
        else:
            losses["global"] = outputs.global_trick_logits.sum() * 0.0

        # ------------------------------------------------------------------
        # 2. Per-frame trick classification
        #    Broadcast global trick label to every frame.
        # ------------------------------------------------------------------
        if "trick_label" in targets:
            B, T, C = outputs.frame_trick_logits.shape
            # (B,) → (B*T,)
            frame_labels = targets["trick_label"].unsqueeze(1).expand(B, T).reshape(B * T)
            frame_logits  = outputs.frame_trick_logits.reshape(B * T, C)
            losses["frame"] = self._ce(frame_logits, frame_labels)
        else:
            losses["frame"] = outputs.frame_trick_logits.sum() * 0.0

        # ------------------------------------------------------------------
        # 3. Completion score (BCE)
        # ------------------------------------------------------------------
        if "completion_label" in targets:
            compl_target = targets["completion_label"].float().unsqueeze(1)   # (B, 1)
            losses["completion"] = self._bce(outputs.completion_score, compl_target)
        else:
            losses["completion"] = outputs.completion_score.sum() * 0.0

        # ------------------------------------------------------------------
        # 4. Boundary detection
        # ------------------------------------------------------------------
        if "boundary_label" in targets:
            bound_target = targets["boundary_label"].float()   # (B, T, 2)
            bound_pred   = torch.sigmoid(outputs.boundary_logits)
            losses["boundary"] = F.binary_cross_entropy(bound_pred, bound_target)
        else:
            # Heuristic: mark first/last 20 % of frames as boundary.
            B, T, _ = outputs.boundary_logits.shape
            bound_labels = _heuristic_boundary_labels(B, T, outputs.boundary_logits.device)
            bound_pred   = torch.sigmoid(outputs.boundary_logits)
            losses["boundary"] = F.binary_cross_entropy(bound_pred, bound_labels)

        # ------------------------------------------------------------------
        # 5. Failure reason
        # ------------------------------------------------------------------
        if "failure_label" in targets:
            # Samples where failure_label == FAILURE_IGNORE_INDEX are "passed"
            # and are excluded from the CE via ignore_index.
            losses["failure"] = F.cross_entropy(
                outputs.failure_reason_logits,
                targets["failure_label"],
                ignore_index=self.FAILURE_IGNORE_INDEX,
            )
        else:
            losses["failure"] = outputs.failure_reason_logits.sum() * 0.0

        # ------------------------------------------------------------------
        # Weighted total
        # ------------------------------------------------------------------
        total = (
            self.w.global_trick * losses["global"]
            + self.w.frame_trick  * losses["frame"]
            + self.w.completion   * losses["completion"]
            + self.w.boundary     * losses["boundary"]
            + self.w.failure      * losses["failure"]
        )
        losses["total"] = total
        return losses


def _heuristic_boundary_labels(
    batch_size: int,
    seq_len: int,
    device: torch.device,
) -> torch.Tensor:
    """
    Heuristic boundary labels when annotations are unavailable.

    Start boundary: first 20 % of frames → start channel = 1.
    End boundary:   last  20 % of frames → end   channel = 1.
    Returns shape (B, T, 2).
    """
    boundary = int(max(1, round(seq_len * 0.20)))
    labels = torch.zeros(batch_size, seq_len, 2, device=device)
    labels[:, :boundary, 0] = 1.0             # start
    labels[:, seq_len - boundary:, 1] = 1.0   # end
    return labels


# ---------------------------------------------------------------------------
# Utility: derive training targets from manifest labels
# ---------------------------------------------------------------------------

FAILURE_REASON_MAP: dict[str, int] = {
    "retry_dog_not_visible":       0,   # dog_partially_out_of_frame
    "retry_low_confidence":        1,   # low_pose_confidence
    "retry_wrong_starting_pose":   2,   # wrong_movement
    "retry_too_short":             3,   # insufficient_hold
    "failed_no_valid_activity":    4,   # incomplete_action
    "retry_multiple_dogs":         5,   # ambiguous_attempt
}


def status_to_failure_label(status: str) -> int:
    """
    Map a classifier status string to a failure reason class index.
    Returns FAILURE_IGNORE_INDEX for passed samples.
    """
    if status == "passed":
        return TBTLoss.FAILURE_IGNORE_INDEX
    return FAILURE_REASON_MAP.get(status, 4)   # default: incomplete_action
