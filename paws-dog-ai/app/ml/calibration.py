"""
Confidence calibration via temperature scaling.

Temperature scaling is the simplest effective post-hoc calibration method.
A single scalar T is applied as: calibrated_probs = softmax(logits / T).

T > 1 → softer distribution (lower confidence)
T < 1 → sharper distribution (higher confidence)
T = 1 → no change

The calibration workflow:
  1. Collect logits + labels from the validation set.
  2. Fit T by minimising NLL with L-BFGS (fast, a few seconds).
  3. Compute ECE before and after.
  4. Store {"temperature": T, "ece_before": float, "ece_after": float}
     in model_config.json under the "calibration" key.

Expected Calibration Error (ECE)
---------------------------------
ECE = Σ_b (|B_b| / N) × |acc(B_b) - conf(B_b)|

where bins B_b partition [0,1] by predicted max-class probability.
Lower ECE is better; a perfectly calibrated model has ECE = 0.

Serialisation
-------------
The calibration dict is stored in model_config.json so it travels with the
artifact.  load_calibration() retrieves it; apply_temperature() is a pure
function that scales logits at inference time.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


# ---------------------------------------------------------------------------
# Temperature application (numpy — usable without torch at inference time)
# ---------------------------------------------------------------------------

def apply_temperature(logits: np.ndarray, temperature: float) -> np.ndarray:
    """
    Apply temperature scaling to raw logits.

    Args:
        logits:      (N, C) float32 array
        temperature: positive scalar; 1.0 = no change

    Returns:
        (N, C) softmax probabilities
    """
    if temperature <= 0:
        raise ValueError(f"Temperature must be positive, got {temperature}")
    scaled = logits / temperature
    # numerically stable softmax
    shifted = scaled - scaled.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return (exp / exp.sum(axis=1, keepdims=True)).astype(np.float32)


# ---------------------------------------------------------------------------
# ECE computation (numpy)
# ---------------------------------------------------------------------------

def compute_ece(
    probs: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 10,
) -> float:
    """
    Expected Calibration Error.

    Args:
        probs:  (N, C) softmax probabilities
        labels: (N,)  integer true labels
        n_bins: number of equal-width confidence bins

    Returns:
        ECE scalar (lower is better)
    """
    max_probs = probs.max(axis=1)                            # (N,)
    pred_labels = probs.argmax(axis=1)                       # (N,)
    correct = (pred_labels == labels).astype(np.float32)     # (N,)

    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    N = len(labels)

    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (max_probs >= lo) & (max_probs < hi)
        if not mask.any():
            continue
        acc  = correct[mask].mean()
        conf = max_probs[mask].mean()
        ece += (mask.sum() / N) * abs(acc - conf)

    return float(ece)


# ---------------------------------------------------------------------------
# Temperature fitting (requires torch)
# ---------------------------------------------------------------------------

def fit_temperature(
    logits: np.ndarray,
    labels: np.ndarray,
    max_iter: int = 50,
    lr: float = 0.01,
) -> float:
    """
    Fit the optimal temperature on a held-out set by minimising NLL.

    Uses simple gradient descent (no torch.optim required for stability;
    a tiny loop over max_iter steps is sufficient for a 1-D optimisation).

    Args:
        logits:   (N, C) raw model logits (before softmax)
        labels:   (N,)  integer true labels
        max_iter: gradient steps
        lr:       learning rate

    Returns:
        Optimal temperature (float, > 0)
    """
    # Initialise T at 1.5 to start from a slightly soft distribution.
    T = 1.5

    for _ in range(max_iter):
        # Compute NLL gradient w.r.t. T analytically.
        # NLL = -mean(log softmax(logits/T)[labels])
        # d NLL/d T = mean( (logits/T)_true - sum_c p_c*(logits/T)_c ) / T
        # Simplified: compute numerically via finite differences for clarity.
        delta = 1e-4
        nll_plus  = _nll(logits, labels, T + delta)
        nll_minus = _nll(logits, labels, T - delta)
        grad = (nll_plus - nll_minus) / (2 * delta)
        T = T - lr * grad
        T = max(0.01, min(T, 20.0))   # clamp to reasonable range

    return float(T)


def _nll(logits: np.ndarray, labels: np.ndarray, T: float) -> float:
    probs = apply_temperature(logits, T)
    n = len(labels)
    true_probs = probs[np.arange(n), labels]
    return float(-np.log(true_probs + 1e-12).mean())


# ---------------------------------------------------------------------------
# Calibrate a model and return a calibration summary
# ---------------------------------------------------------------------------

def calibrate_model(
    logits: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 10,
    max_iter: int = 50,
) -> dict:
    """
    Fit temperature on (logits, labels) and compute ECE before/after.

    Returns:
        {
          "temperature":  float,
          "ece_before":   float,
          "ece_after":    float,
          "n_samples":    int,
          "n_bins":       int,
        }
    """
    # ECE before calibration
    probs_raw = apply_temperature(logits, 1.0)
    ece_before = compute_ece(probs_raw, labels, n_bins)

    # Fit temperature
    temperature = fit_temperature(logits, labels, max_iter=max_iter)

    # ECE after calibration
    probs_cal = apply_temperature(logits, temperature)
    ece_after = compute_ece(probs_cal, labels, n_bins)

    return {
        "temperature": round(temperature, 6),
        "ece_before":  round(ece_before, 6),
        "ece_after":   round(ece_after, 6),
        "n_samples":   int(len(labels)),
        "n_bins":      n_bins,
    }


# ---------------------------------------------------------------------------
# Artifact serialisation
# ---------------------------------------------------------------------------

def save_calibration(artifact_dir: str | Path, calibration: dict) -> None:
    """
    Patch "calibration" key into an existing model_config.json artifact.
    Creates the file if it does not exist (for testing).
    """
    path = Path(artifact_dir) / "model_config.json"
    if path.exists():
        config = json.loads(path.read_text())
    else:
        config = {}
    config["calibration"] = calibration
    path.write_text(json.dumps(config, indent=2))


def load_calibration(artifact_dir: str | Path) -> dict | None:
    """
    Load the calibration config from model_config.json.
    Returns None if the artifact or calibration key is absent.
    """
    path = Path(artifact_dir) / "model_config.json"
    if not path.exists():
        return None
    config = json.loads(path.read_text())
    return config.get("calibration")
