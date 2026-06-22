"""
PAWS Sit Classifier Training Script
=====================================

Trains MLP and TCN baselines on an exported sit dataset and saves artifacts.

USAGE
-----

Train both baselines on an exported dataset:

    python scripts/train_sit_classifier.py \\
        --dataset-dir training_data/sit_dataset_v1 \\
        --output-dir artifacts \\
        --epochs 50 \\
        --lr 1e-3 \\
        --batch-size 32 \\
        --seq-len 60

Train only the MLP:

    python scripts/train_sit_classifier.py \\
        --dataset-dir training_data/sit_dataset_v1 \\
        --models mlp

Train only the TCN with logistic regression comparison:

    python scripts/train_sit_classifier.py \\
        --dataset-dir training_data/sit_dataset_v1 \\
        --models tcn logreg

REQUIREMENTS
------------

    pip install torch

The training script is separate from the FastAPI server and does not affect
production inference. All artifacts are written to --output-dir only.

WHAT GETS SAVED
---------------

    artifacts/
      sit_mlp_v1/
        model.pt, model_config.json, label_map.json, eval_summary.json
      sit_tcn_v1/
        model.pt, model_config.json, label_map.json, eval_summary.json
      comparison_report.json

LABELS
------

  passed -> 1 (positive)
  failed -> 0 (negative)
  ambiguous / invalid_recording -> excluded from training

NOTE: Labels come from the rule-based SitClassifier. The evaluation metrics
measure how well each learned model replicates rule-based behavior, not
independent ground-truth accuracy.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train PAWS sit classifier baselines.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dataset-dir", required=True)
    parser.add_argument("--output-dir", default="artifacts")
    parser.add_argument("--models", nargs="+", default=["mlp", "tcn"],
                        choices=["mlp", "logreg", "tcn"])
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seq-len", type=int, default=60)
    parser.add_argument("--hidden-dim", type=int, default=64,
                        help="Hidden dim for TCN and MLP")
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--device", default="cpu")
    return parser.parse_args()


def main() -> None:
    try:
        import torch
    except ImportError:
        print("torch is not installed. Run: pip install torch", file=sys.stderr)
        sys.exit(1)

    args = parse_args()

    from app.ml.artifacts import save_artifacts
    from app.ml.evaluator import build_evaluation_report, compare_models
    from app.ml.models.mlp_classifier import MLPSitClassifier
    from app.ml.models.tcn_classifier import TCNSitClassifier
    from app.ml.pose_dataset import SitPoseDataset, make_dataloader
    from app.ml.preprocessing import AGG_FEATURE_DIM, FRAME_DIM, PreprocessConfig
    from app.ml.training.trainer import predict, train

    from app.config import settings

    config = PreprocessConfig(seq_len=args.seq_len)
    dataset_dir = Path(args.dataset_dir)
    output_dir = Path(args.output_dir)

    # Load datasets.
    train_seq = SitPoseDataset(dataset_dir, "train", config, mode="sequence")
    val_seq = SitPoseDataset(dataset_dir, "val", config, mode="sequence")
    test_seq = SitPoseDataset(dataset_dir, "test", config, mode="sequence")

    train_agg = SitPoseDataset(dataset_dir, "train", config, mode="aggregate")
    val_agg = SitPoseDataset(dataset_dir, "val", config, mode="aggregate")
    test_agg = SitPoseDataset(dataset_dir, "test", config, mode="aggregate")

    print(f"Train: {len(train_seq)} | Val: {len(val_seq)} | Test: {len(test_seq)}")

    if len(train_seq) == 0:
        print("No training samples found. Run export_sit_dataset.py first.", file=sys.stderr)
        sys.exit(1)

    reports = []
    model_version = settings.service_version

    def _collect_test_meta(dataset: SitPoseDataset) -> tuple[list[int], list[dict]]:
        y_true, flags = [], []
        for i in range(len(dataset)):
            _, label, meta = dataset.get_numpy(i)
            y_true.append(label)
            flags.append(meta.get("quality_flags", {}))
        return y_true, flags

    # --- MLP / LogReg ---
    for model_name in [m for m in args.models if m in ("mlp", "logreg")]:
        hidden = [] if model_name == "logreg" else [args.hidden_dim, args.hidden_dim // 2]
        artifact_name = f"sit_{model_name}_v1"
        print(f"\nTraining {artifact_name} ...")

        model = MLPSitClassifier(
            input_dim=AGG_FEATURE_DIM,
            hidden_sizes=hidden,
        )
        train_loader = make_dataloader(train_agg, args.batch_size, shuffle=True)
        val_loader = make_dataloader(val_agg, args.batch_size, shuffle=False)
        test_loader = make_dataloader(test_agg, args.batch_size, shuffle=False)

        train_history = train(
            model, train_loader, val_loader,
            n_epochs=args.epochs, lr=args.lr, patience=args.patience,
            class_weights=train_agg.class_weights(), device=args.device,
        )

        y_true, y_pred = predict(model, test_loader, args.device)
        _, quality_flags = _collect_test_meta(test_agg)
        report = build_evaluation_report(artifact_name, y_true, y_pred, quality_flags)
        report["train_history"] = train_history
        reports.append(report)

        artifact_path = output_dir / artifact_name
        save_artifacts(artifact_path, model, config, report, model_version)
        print(f"  Saved to {artifact_path}")
        print(f"  accuracy={report['overall']['accuracy']}  f1={report['overall']['f1']}")

    # --- TCN ---
    if "tcn" in args.models:
        artifact_name = "sit_tcn_v1"
        print(f"\nTraining {artifact_name} ...")

        model = TCNSitClassifier(
            input_dim=FRAME_DIM,
            hidden_dim=args.hidden_dim,
        )
        train_loader = make_dataloader(train_seq, args.batch_size, shuffle=True)
        val_loader = make_dataloader(val_seq, args.batch_size, shuffle=False)
        test_loader = make_dataloader(test_seq, args.batch_size, shuffle=False)

        train_history = train(
            model, train_loader, val_loader,
            n_epochs=args.epochs, lr=args.lr, patience=args.patience,
            class_weights=train_seq.class_weights(), device=args.device,
        )

        y_true, y_pred = predict(model, test_loader, args.device)
        _, quality_flags = _collect_test_meta(test_seq)
        report = build_evaluation_report(artifact_name, y_true, y_pred, quality_flags)
        report["train_history"] = train_history
        reports.append(report)

        artifact_path = output_dir / artifact_name
        save_artifacts(artifact_path, model, config, report, model_version)
        print(f"  Saved to {artifact_path}")
        print(f"  accuracy={report['overall']['accuracy']}  f1={report['overall']['f1']}")

    # --- Comparison report ---
    if reports:
        print("\n" + compare_models(reports))
        comparison_path = output_dir / "comparison_report.json"
        comparison_path.parent.mkdir(parents=True, exist_ok=True)
        comparison_path.write_text(json.dumps(reports, indent=2))
        print(f"\nFull report saved to {comparison_path}")


if __name__ == "__main__":
    main()
