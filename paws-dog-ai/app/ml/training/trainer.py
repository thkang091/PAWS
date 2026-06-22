"""
Training loop for MLP and TCN sit classifiers.

Requires torch. Called only from the training script,
never from the FastAPI application.
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torch.utils.data import DataLoader


def train(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    n_epochs: int = 50,
    lr: float = 1e-3,
    patience: int = 10,
    class_weights: "torch.Tensor | None" = None,
    device: str = "cpu",
) -> dict:
    """
    Train model with early stopping on validation loss.

    Returns a dict with train/val loss history and best epoch.
    """
    model = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device) if class_weights is not None else None)

    best_val_loss = float("inf")
    best_state = None
    patience_count = 0
    history: list[dict] = []

    for epoch in range(n_epochs):
        model.train()
        train_loss = _run_epoch(model, train_loader, criterion, optimizer, device, train=True)

        model.eval()
        with torch.no_grad():
            val_loss = _run_epoch(model, val_loader, criterion, None, device, train=False)

        history.append({"epoch": epoch + 1, "train_loss": train_loss, "val_loss": val_loss})

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_count = 0
        else:
            patience_count += 1
            if patience_count >= patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    return {
        "best_val_loss": best_val_loss,
        "best_epoch": len(history) - patience_count,
        "total_epochs": len(history),
        "history": history,
    }


def predict(
    model: nn.Module,
    loader: DataLoader,
    device: str = "cpu",
) -> tuple[list[int], list[int]]:
    """Returns (y_true, y_pred) lists."""
    model.eval()
    model = model.to(device)
    y_true, y_pred = [], []
    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            preds = logits.argmax(dim=1)
            y_true.extend(y.cpu().tolist())
            y_pred.extend(preds.cpu().tolist())
    return y_true, y_pred


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: "torch.optim.Optimizer | None",
    device: str,
    train: bool,
) -> float:
    total_loss = 0.0
    n_batches = 0
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = criterion(logits, y)
        if train and optimizer is not None:
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
        total_loss += loss.item()
        n_batches += 1
    return total_loss / max(n_batches, 1)
