"""
Multi-model comparison report for trick classifiers.

Produces a structured report comparing any number of models across:
  - Overall metrics (accuracy, precision, recall, F1, FPR, FNR)
  - Per-trick metrics
  - Confusion matrix
  - False positive / false negative analysis
  - Calibration metrics (ECE before/after temperature scaling)
  - Inference latency (ms per sample)
  - Model size (parameters, bytes)
  - Failure analysis (which tricks / quality conditions hurt most)

Usage
-----
  from app.ml.comparison import build_comparison_report, format_report

  results = {
      "rule_based":    {"y_true": [...], "y_pred": [...], "probs": None,    ...},
      "tcn_baseline":  {"y_true": [...], "y_pred": [...], "probs": [...],   ...},
      "tbt_candidate": {"y_true": [...], "y_pred": [...], "probs": [...],   ...},
  }
  report = build_comparison_report(results)
  print(format_report(report))
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.ml.evaluator import compute_metrics
from app.ml.pose_dataset import TRICK_LABEL_MAP, TRICK_LABEL_MAP_INV


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class ModelResult:
    """All outputs for one model evaluated on the test set."""
    model_name: str
    y_true: list[int]           # ground-truth trick labels
    y_pred: list[int]           # predicted trick labels
    probs: list[list[float]] | None  # softmax probabilities (N, C); None for rule-based
    quality_flags: list[dict] = field(default_factory=list)
    latency_ms_per_sample: float | None = None
    n_parameters: int | None = None
    size_bytes: int | None = None
    calibration: dict | None = None     # {"temperature", "ece_before", "ece_after"}
    tricks: list[str] | None = None     # per-sample trick slugs


# ---------------------------------------------------------------------------
# Core report builder
# ---------------------------------------------------------------------------

def build_comparison_report(results: list[ModelResult]) -> dict:
    """
    Build a full comparison report from a list of ModelResult objects.

    Returns a structured dict suitable for JSON serialisation.
    """
    report: dict = {
        "models": [],
        "leaderboard": [],
        "confusion_matrices": {},
    }

    for res in results:
        entry = _build_model_entry(res)
        report["models"].append(entry)

    # Leaderboard: sort by overall F1 descending.
    report["leaderboard"] = sorted(
        [{"model": e["model_name"], "f1": e["overall"]["f1"],
          "accuracy": e["overall"]["accuracy"]}
         for e in report["models"]],
        key=lambda x: x["f1"],
        reverse=True,
    )

    return report


def _build_model_entry(res: ModelResult) -> dict:
    y_true = np.array(res.y_true)
    y_pred = np.array(res.y_pred)

    # ------- Overall metrics -------
    overall = compute_metrics(res.y_true, res.y_pred)

    # ------- Confusion matrix -------
    n_classes = len(TRICK_LABEL_MAP)
    cm = _confusion_matrix(y_true, y_pred, n_classes)

    # ------- Per-trick metrics -------
    per_trick: dict[str, dict] = {}
    for slug, label in sorted(TRICK_LABEL_MAP.items(), key=lambda x: x[1]):
        y_true_bin = (y_true == label).astype(int)
        y_pred_bin = (y_pred == label).astype(int)
        n = int((y_true == label).sum())
        if n == 0:
            per_trick[slug] = {"n_samples": 0}
            continue
        tp = int(((y_true_bin == 1) & (y_pred_bin == 1)).sum())
        fp = int(((y_true_bin == 0) & (y_pred_bin == 1)).sum())
        fn = int(((y_true_bin == 1) & (y_pred_bin == 0)).sum())
        precision = tp / max(tp + fp, 1)
        recall    = tp / max(tp + fn, 1)
        f1        = 2 * precision * recall / max(precision + recall, 1e-9)
        per_trick[slug] = {
            "n_samples": n,
            "tp": tp, "fp": fp, "fn": fn,
            "precision": round(precision, 4),
            "recall":    round(recall, 4),
            "f1":        round(f1, 4),
        }

    # ------- False positive / negative examples -------
    fp_indices = np.where((y_true == 0) & (y_pred != 0))[0].tolist()[:10]
    fn_indices = np.where((y_true != 0) & (y_pred == 0))[0].tolist()[:10]

    def _idx_to_sample(indices: list[int]) -> list[dict]:
        out = []
        for i in indices:
            d: dict = {
                "index": i,
                "true_trick": TRICK_LABEL_MAP_INV.get(int(y_true[i]), "?"),
                "pred_trick": TRICK_LABEL_MAP_INV.get(int(y_pred[i]), "?"),
            }
            if res.probs is not None:
                d["confidence"] = round(float(max(res.probs[i])), 4)
            if res.quality_flags and i < len(res.quality_flags):
                d["quality_flags"] = res.quality_flags[i]
            out.append(d)
        return out

    # ------- Calibration -------
    calibration_summary: dict = res.calibration or {}
    if res.probs is not None and not calibration_summary:
        from app.ml.calibration import compute_ece, apply_temperature  # noqa: PLC0415
        probs_np = np.array(res.probs, dtype=np.float32)
        calibration_summary = {
            "ece_before": round(compute_ece(probs_np, res.y_true), 6),
        }

    # ------- Quality flag failure analysis -------
    quality_breakdown: dict = {}
    if res.quality_flags:
        all_flag_names = set()
        for qf in res.quality_flags:
            all_flag_names.update(qf.keys())
        for flag in sorted(all_flag_names):
            mask = [bool(qf.get(flag, False)) for qf in res.quality_flags]
            if not any(mask):
                continue
            flagged_true = [res.y_true[i] for i, m in enumerate(mask) if m]
            flagged_pred = [res.y_pred[i] for i, m in enumerate(mask) if m]
            if not flagged_true:
                continue
            fm = compute_metrics(flagged_true, flagged_pred)
            quality_breakdown[flag] = {
                "n": len(flagged_true),
                "accuracy": fm["accuracy"],
                "f1": fm["f1"],
            }

    return {
        "model_name":       res.model_name,
        "overall":          overall,
        "per_trick":        per_trick,
        "confusion_matrix": cm,
        "false_positives":  _idx_to_sample(fp_indices),
        "false_negatives":  _idx_to_sample(fn_indices),
        "calibration":      calibration_summary,
        "quality_breakdown": quality_breakdown,
        "latency_ms_per_sample": res.latency_ms_per_sample,
        "n_parameters":     res.n_parameters,
        "size_bytes":       res.size_bytes,
        "size_mb":          round(res.size_bytes / 1e6, 3) if res.size_bytes else None,
    }


def _confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, n_classes: int) -> list[list[int]]:
    cm = [[0] * n_classes for _ in range(n_classes)]
    for t, p in zip(y_true.tolist(), y_pred.tolist()):
        if 0 <= t < n_classes and 0 <= p < n_classes:
            cm[t][p] += 1
    return cm


# ---------------------------------------------------------------------------
# Text formatting
# ---------------------------------------------------------------------------

def format_report(report: dict) -> str:
    """Return a human-readable comparison table."""
    lines: list[str] = []

    lines.append("=== Model Comparison ===")
    lines.append("")

    # Leaderboard
    lines.append("Leaderboard (by F1):")
    for i, entry in enumerate(report.get("leaderboard", []), 1):
        lines.append(
            f"  {i}. {entry['model']:<30}  F1={entry['f1']:.4f}  "
            f"Acc={entry['accuracy']:.4f}"
        )
    lines.append("")

    # Per-model detail
    for model_entry in report.get("models", []):
        name = model_entry["model_name"]
        lines.append(f"--- {name} ---")

        ov = model_entry["overall"]
        lines.append(
            f"  Overall: acc={ov['accuracy']:.4f}  f1={ov['f1']:.4f}  "
            f"precision={ov['precision']:.4f}  recall={ov['recall']:.4f}  "
            f"n={ov['n_samples']}"
        )

        # Per-trick
        pt = model_entry.get("per_trick", {})
        if pt:
            lines.append("  Per-trick:")
            for slug, m in sorted(pt.items()):
                if m.get("n_samples", 0) == 0:
                    continue
                lines.append(
                    f"    {slug:<12}  n={m['n_samples']:<4}  "
                    f"f1={m.get('f1', 0):.4f}  "
                    f"prec={m.get('precision', 0):.4f}  "
                    f"rec={m.get('recall', 0):.4f}"
                )

        # Calibration
        cal = model_entry.get("calibration", {})
        if cal:
            t = cal.get("temperature", "N/A")
            e_b = cal.get("ece_before", "N/A")
            e_a = cal.get("ece_after", "N/A")
            lines.append(
                f"  Calibration: T={t}  ECE_before={e_b}  ECE_after={e_a}"
            )

        # Latency / size
        lat = model_entry.get("latency_ms_per_sample")
        sz  = model_entry.get("size_mb")
        np_ = model_entry.get("n_parameters")
        if lat is not None or sz is not None or np_ is not None:
            parts = []
            if lat is not None:
                parts.append(f"latency={lat:.1f}ms/sample")
            if sz is not None:
                parts.append(f"size={sz:.2f}MB")
            if np_ is not None:
                parts.append(f"params={np_:,}")
            lines.append(f"  Efficiency: {',  '.join(parts)}")

        lines.append("")

    return "\n".join(lines)
