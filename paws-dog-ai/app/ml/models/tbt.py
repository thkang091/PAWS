"""
Temporal Behavior Transformer (TBT) for multi-trick pose recognition.

Architecture
------------
Input: (B, in_dim, T)   channels-first, compatible with Conv1d

1. Input projection     Conv1d(in_dim → model_dim, k=1)
2. Local TCN encoder    3 × dilated residual conv blocks
                        Captures local motion patterns (hip-drop, paw-lift)
3. Sinusoidal PE        added after permuting to (T, B, model_dim)
4. Transformer encoder  N layers of multi-head self-attention + FFN
5. Output heads
   a. Global trick       GAP → Linear(model_dim, n_trick_classes)
   b. Per-frame trick    Linear(model_dim, n_trick_classes) applied at each T
   c. Completion score   GAP → Linear(model_dim, 1) + Sigmoid
   d. Boundary detector  Linear(model_dim, 2) at each T (start / end)
   e. Failure reason     GAP → Linear(model_dim, n_failure_reasons)

ONNX export
-----------
Use tbt_forward_onnx() which returns a flat tuple of tensors instead of
the TBTOutput dataclass.  The ONNX graph only includes the three primary
outputs needed for server inference:
  global_trick_logits (B, n_trick_classes)
  completion_score    (B, 1)
  failure_logits      (B, n_failure_reasons)

Rollback
--------
This model artifact lives at a separate path from the production model.
Nothing in the inference stack uses TBT until ml_artifact_path is pointed
at its artifact directory.  Rolling back means changing one env var.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class TBTConfig:
    """Full configuration for one TBT instance.  Serialisable to/from dict."""
    n_keypoints: int = 10
    frame_dim: int = 40              # FRAME_DIM from preprocessing
    motion_dim: int = 20             # velocity features (2 per joint)
    model_dim: int = 128
    n_heads: int = 4
    n_layers: int = 3
    tcn_channels: int = 128          # local TCN hidden channels (= model_dim)
    tcn_dilations: list[int] = field(default_factory=lambda: [1, 2, 4])
    dropout: float = 0.1
    n_trick_classes: int = 7         # no_action + 6 tricks (TRICK_LABEL_MAP)
    n_failure_reasons: int = 6       # TrickFeedback fields
    seq_len: int = 60
    use_motion_features: bool = True  # append velocity features to input

    @property
    def in_dim(self) -> int:
        return self.frame_dim + (self.motion_dim if self.use_motion_features else 0)

    def to_dict(self) -> dict:
        return {
            "model_type": "tbt",
            "n_keypoints": self.n_keypoints,
            "frame_dim": self.frame_dim,
            "motion_dim": self.motion_dim,
            "model_dim": self.model_dim,
            "n_heads": self.n_heads,
            "n_layers": self.n_layers,
            "tcn_channels": self.tcn_channels,
            "tcn_dilations": list(self.tcn_dilations),
            "dropout": self.dropout,
            "n_trick_classes": self.n_trick_classes,
            "n_failure_reasons": self.n_failure_reasons,
            "seq_len": self.seq_len,
            "use_motion_features": self.use_motion_features,
            # Expose for artifact system
            "input_dim": self.in_dim,
            "n_classes": self.n_trick_classes,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "TBTConfig":
        fields = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in d.items() if k in fields})


# ---------------------------------------------------------------------------
# Output container
# ---------------------------------------------------------------------------

@dataclass
class TBTOutput:
    global_trick_logits: torch.Tensor   # (B, n_trick_classes)
    frame_trick_logits: torch.Tensor    # (B, T, n_trick_classes)
    completion_score: torch.Tensor      # (B, 1)  — sigmoid-activated
    boundary_logits: torch.Tensor       # (B, T, 2)  — raw logits for start/end
    failure_reason_logits: torch.Tensor # (B, n_failure_reasons)


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

class _TCNBlock(nn.Module):
    """Single dilated residual conv block. Input/output: (B, C, T)."""

    def __init__(self, channels: int, dilation: int, dropout: float) -> None:
        super().__init__()
        self.conv = nn.Conv1d(
            channels, channels,
            kernel_size=3,
            padding=dilation,
            dilation=dilation,
        )
        self.norm = nn.GroupNorm(num_groups=min(8, channels), num_channels=channels)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.drop(F.gelu(self.norm(self.conv(x))))
        return out + x   # residual


class _SinusoidalPE(nn.Module):
    """Sinusoidal positional encoding.  Added to (T, B, d_model)."""

    def __init__(self, d_model: int, max_len: int = 512) -> None:
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).unsqueeze(1).float()
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div[:d_model // 2])
        self.register_buffer("pe", pe.unsqueeze(1))   # (max_len, 1, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (T, B, d_model)
        return x + self.pe[: x.size(0)]


# ---------------------------------------------------------------------------
# Main model
# ---------------------------------------------------------------------------

class TemporalBehaviorTransformer(nn.Module):
    """
    Temporal Behavior Transformer for multi-trick recognition.

    in_channels = TBTConfig.in_dim (60 with motion features, 40 without).
    Input tensor shape: (B, in_channels, T).
    """

    def __init__(self, cfg: TBTConfig | None = None) -> None:
        super().__init__()
        if cfg is None:
            cfg = TBTConfig()
        self.cfg = cfg

        # 1. Input projection
        self.input_proj = nn.Conv1d(cfg.in_dim, cfg.model_dim, kernel_size=1)

        # 2. Local TCN
        self.tcn = nn.Sequential(
            *[_TCNBlock(cfg.model_dim, d, cfg.dropout) for d in cfg.tcn_dilations]
        )

        # 3. Positional encoding
        self.pe = _SinusoidalPE(cfg.model_dim)

        # 4. Transformer encoder
        enc_layer = nn.TransformerEncoderLayer(
            d_model=cfg.model_dim,
            nhead=cfg.n_heads,
            dim_feedforward=cfg.model_dim * 4,
            dropout=cfg.dropout,
            batch_first=False,   # expects (T, B, d)
            norm_first=True,     # pre-norm for stability
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=cfg.n_layers)

        # 5. Output heads
        self.head_global_trick   = nn.Linear(cfg.model_dim, cfg.n_trick_classes)
        self.head_frame_trick    = nn.Linear(cfg.model_dim, cfg.n_trick_classes)
        self.head_completion     = nn.Linear(cfg.model_dim, 1)
        self.head_boundary       = nn.Linear(cfg.model_dim, 2)
        self.head_failure        = nn.Linear(cfg.model_dim, cfg.n_failure_reasons)

        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Conv1d):
                nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> TBTOutput:
        """
        Args:
            x: (B, in_dim, T)  — channels-first pose sequence

        Returns:
            TBTOutput with all five head outputs.
        """
        # 1. Project input
        h = self.input_proj(x)      # (B, model_dim, T)

        # 2. Local TCN
        h = self.tcn(h)             # (B, model_dim, T)

        # 3. Permute to (T, B, model_dim) for Transformer + add PE
        h = h.permute(2, 0, 1)     # (T, B, model_dim)
        h = self.pe(h)

        # 4. Transformer
        h = self.transformer(h)     # (T, B, model_dim)

        # 5. Back to (B, T, model_dim)
        h = h.permute(1, 0, 2)

        # 6. Global representation
        g = h.mean(dim=1)           # (B, model_dim)

        return TBTOutput(
            global_trick_logits   = self.head_global_trick(g),          # (B, n_trick_classes)
            frame_trick_logits    = self.head_frame_trick(h),            # (B, T, n_trick_classes)
            completion_score      = torch.sigmoid(self.head_completion(g)),  # (B, 1)
            boundary_logits       = self.head_boundary(h),               # (B, T, 2)
            failure_reason_logits = self.head_failure(g),                # (B, n_failure_reasons)
        )

    def forward_onnx(self, x: torch.Tensor) -> tuple[
        torch.Tensor, torch.Tensor, torch.Tensor
    ]:
        """
        ONNX-compatible forward pass.  Returns only the three server-facing
        outputs as a plain tuple (no dataclass — ONNX tracing needs tensors).

        Outputs:
            global_trick_logits  (B, n_trick_classes)
            completion_score     (B, 1)
            failure_reason_logits(B, n_failure_reasons)
        """
        out = self(x)
        return out.global_trick_logits, out.completion_score, out.failure_reason_logits

    def config(self) -> dict:
        return self.cfg.to_dict()

    def n_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def size_bytes(self) -> int:
        return sum(p.numel() * p.element_size() for p in self.parameters())
