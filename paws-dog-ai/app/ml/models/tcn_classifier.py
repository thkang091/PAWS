"""
Small dilated TCN baseline for sit classification.

Architecture:
  Input: (batch, FRAME_DIM, seq_len)   -- channels-first for Conv1d
  3 residual dilated conv blocks with dilation [1, 2, 4]
  Global average pooling over time
  Linear classifier head

Kept intentionally small (hidden_dim=64) to train on limited data
without overfitting.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class _ResidualBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, dilation: int) -> None:
        super().__init__()
        self.conv = nn.Conv1d(
            in_channels,
            out_channels,
            kernel_size=3,
            padding=dilation,
            dilation=dilation,
        )
        self.norm = nn.LayerNorm(out_channels)
        self.downsample = (
            nn.Conv1d(in_channels, out_channels, kernel_size=1)
            if in_channels != out_channels
            else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, T)
        out = self.conv(x)
        # LayerNorm expects (B, T, C).
        out = self.norm(out.permute(0, 2, 1)).permute(0, 2, 1)
        out = F.relu(out + self.downsample(x))
        return out


class TCNSitClassifier(nn.Module):
    def __init__(
        self,
        input_dim: int,
        hidden_dim: int = 64,
        dilations: list[int] | None = None,
        n_classes: int = 2,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        if dilations is None:
            dilations = [1, 2, 4]

        self.input_proj = nn.Conv1d(input_dim, hidden_dim, kernel_size=1)

        blocks: list[nn.Module] = []
        for d in dilations:
            blocks.append(_ResidualBlock(hidden_dim, hidden_dim, d))
        self.blocks = nn.Sequential(*blocks)

        self.dropout = nn.Dropout(dropout)
        self.head = nn.Linear(hidden_dim, n_classes)

        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.dilations = dilations

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, FRAME_DIM, seq_len)
        x = self.input_proj(x)           # (B, hidden_dim, seq_len)
        x = self.blocks(x)               # (B, hidden_dim, seq_len)
        x = x.mean(dim=2)               # global average pool: (B, hidden_dim)
        x = self.dropout(x)
        return self.head(x)              # (B, n_classes)

    def config(self) -> dict:
        return {
            "model_type": "tcn",
            "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim,
            "dilations": self.dilations,
        }
