"""
MLP baseline for sit classification.

When hidden_sizes=[], this is logistic regression (single linear layer).
When hidden_sizes=[64, 32], this is a 2-hidden-layer MLP.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class MLPSitClassifier(nn.Module):
    def __init__(
        self,
        input_dim: int,
        hidden_sizes: list[int] | None = None,
        dropout: float = 0.3,
        n_classes: int = 2,
    ) -> None:
        super().__init__()
        if hidden_sizes is None:
            hidden_sizes = [64, 32]

        layers: list[nn.Module] = []
        prev = input_dim
        for h in hidden_sizes:
            layers.append(nn.Linear(prev, h))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            prev = h
        layers.append(nn.Linear(prev, n_classes))

        self.net = nn.Sequential(*layers)
        self.input_dim = input_dim
        self.hidden_sizes = hidden_sizes

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

    def config(self) -> dict:
        return {
            "model_type": "mlp",
            "input_dim": self.input_dim,
            "hidden_sizes": self.hidden_sizes,
        }
