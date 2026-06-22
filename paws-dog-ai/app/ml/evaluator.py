"""
Evaluation metrics for trick classifiers.

Implemented in numpy — no scikit-learn dependency.
Supports comparison of learned models against each other and against the
stored rule-based labels.

NOTE: The stored final_label values in the exported dataset are produced by
the rule-based classifier for each trick.  Comparison on the test set measures
how well each learned model replicates rule-based behavior — a useful proxy,
but not a true independent comparison.  Independent evaluation requires
separate human ground-truth labels.
"""

from __future__ import annotations

import numpy as np


def compute_metrics(y_true: list[int], y_pred: list[int]) -> dict:
    """
    Returns accuracy, precision, recall, F1, FPR, FNR, confusion matrix.
    Positive class = 1 (passed).
    """
    yt = np.array(y_true)
    yp = np.array(y_pred)

    tp = int(((yt == 1) & (yp == 1)).sum())
    fp = int(((yt == 0) & (yp == 1)).sum())
    tn = int(((yt == 0) & (yp == 0)).sum())
    fn = int(((yt == 1) & (yp == 0)).sum())

    accuracy = (tp + tn) / max(len(yt), 1)
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)    # = sensitivity / TPR
    f1 = 2 * precision * recall / max(precision + recall, 1e-9)
    fpr = fp / max(fp + tn, 1)       # false-positive rate
    fnr = fn / max(fn + tp, 1)       # false-negative rate / miss rate

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "fpr": round(fpr, 4),
        "fnr": round(fnr, 4),
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "n_samples": len(yt),
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


def compute_subset_metrics(
    y_true: list[int],
    y_pred: list[int],
    mask: list[bool],
    label: str,
) -> dict:
    """Metrics for a subset defined by a boolean mask."""
    yt = [y for y, m in zip(y_true, mask) if m]
    yp = [y for y, m in zip(y_pred, mask) if m]
    if not yt:
        return {"subset": label, "n_samples": 0}
    return {"subset": label, **compute_metrics(yt, yp)}


def build_evaluation_report(
    model_name: str,
    y_true: list[int],
    y_pred: list[int],
    quality_flags: list[dict],
) -> dict:
    """
    Full evaluation report with overall metrics and subset breakdowns.
    """
    overall = compute_metrics(y_true, y_pred)

    # Subset: clean recordings (no quality flags set).
    clean_mask = [not any(qf.values()) for qf in quality_flags]
    clean = compute_subset_metrics(y_true, y_pred, clean_mask, "clean_recordings")

    # Subset: low-confidence recordings.
    low_conf_mask = [qf.get("low_average_confidence", False) for qf in quality_flags]
    low_conf = compute_subset_metrics(y_true, y_pred, low_conf_mask, "low_confidence_recordings")

    return {
        "model_name": model_name,
        "overall": overall,
        "subsets": {
            "clean_recordings": clean,
            "low_confidence_recordings": low_conf,
        },
        "note": (
            "Labels were produced by the rule-based classifier. "
            "Metrics reflect replication accuracy, not independent ground truth."
        ),
    }


def compare_models(reports: list[dict]) -> str:
    """Returns a formatted comparison table string."""
    headers = ["model", "accuracy", "precision", "recall", "f1", "fpr", "fnr", "n"]
    rows = []
    for r in reports:
        o = r["overall"]
        rows.append([
            r["model_name"],
            str(o["accuracy"]),
            str(o["precision"]),
            str(o["recall"]),
            str(o["f1"]),
            str(o["fpr"]),
            str(o["fnr"]),
            str(o["n_samples"]),
        ])

    col_widths = [max(len(h), max((len(row[i]) for row in rows), default=0))
                  for i, h in enumerate(headers)]
    sep = "-+-".join("-" * w for w in col_widths)
    header_line = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))

    lines = [header_line, sep]
    for row in rows:
        lines.append(" | ".join(v.ljust(w) for v, w in zip(row, col_widths)))
    return "\n".join(lines)
