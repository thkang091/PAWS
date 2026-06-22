"""
PAWS Multi-Trick Training Dataset Export Script
================================================

Exports labeled verification attempts for one or more tricks into a versioned,
ML-ready dataset.

USAGE
-----

Export sit and down from Supabase:

    python scripts/export_trick_dataset.py --tricks sit down

Export all active tricks from the vocabulary:

    python scripts/export_trick_dataset.py --all-tricks

Export a single trick from local fixtures:

    python scripts/export_trick_dataset.py \\
        --tricks sit \\
        --source local \\
        --fixtures-dir tests/fixtures/export

Export with date and quality filters:

    python scripts/export_trick_dataset.py \\
        --tricks sit down stay \\
        --dataset-name multi_trick_v1 \\
        --min-date 2026-01-01 \\
        --max-date 2026-12-31 \\
        --exclude-malformed \\
        --exclude-low-quality \\
        --train-ratio 0.70 \\
        --val-ratio 0.15 \\
        --test-ratio 0.15

Privacy:

    Dog IDs are hashed before export. Override the salt between export rounds
    to prevent cross-export linkage:

    python scripts/export_trick_dataset.py --dog-id-salt my-salt-2026

OUTPUT
------

    training_data/
      <dataset-name>/
        manifest.jsonl          One JSON line per sample (no pose data)
        splits.json             {train: [...], val: [...], test: [...]}
        dataset_summary.json    Aggregate statistics
        sequences/
          <verification_id>.json    Full pose sequence + metadata per sample

Each manifest entry includes: trick, requested_trick, detected_trick,
trick_completed, final_label, and quality_flags.

FILTERS
-------

--tricks                  One or more trick slugs (default: sit)
--all-tricks              Export all active tricks from the vocabulary
--exclude-malformed       Skip sequences with unsupported_pose_schema or 0 frames
--exclude-low-quality     Skip sequences with low_average_confidence,
                          excessive_missing_frames, insufficient_recording_duration
--include-ambiguous       Include samples with final_label=ambiguous
--no-hard-negatives       Exclude failed samples
--min-date                ISO date string YYYY-MM-DD (inclusive)
--max-date                ISO date string YYYY-MM-DD (inclusive)
--pose-model-version      Filter by pose model version

SPLITS
------

Dogs are never split across train/val/test. All samples from the same dog
always land in the same split. Splits are deterministic: running the script
twice with the same data produces identical output.
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import settings
from app.dataset.data_source import LocalFileDataSource, SupabaseDataSource
from app.dataset.dataset_exporter import run_export
from app.models.dataset_models import ExportConfig
from app.services.trick_vocabulary_service import active_trick_slugs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export PAWS trick verification attempts as a versioned ML dataset.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--output-dir", default="training_data")
    parser.add_argument("--dataset-name", default="trick_dataset_v1")
    parser.add_argument(
        "--tricks", nargs="+", default=["sit"],
        help="One or more trick slugs to export (default: sit)",
    )
    parser.add_argument(
        "--all-tricks", action="store_true", default=False,
        help="Export all active tricks from the vocabulary (overrides --tricks)",
    )
    parser.add_argument("--source", choices=["supabase", "local"], default="supabase")
    parser.add_argument(
        "--fixtures-dir", default="tests/fixtures/export",
        help="Directory of SourceRecord JSON files (--source local only)",
    )
    parser.add_argument("--dog-id-salt", default="paws-dataset-v1")
    parser.add_argument("--exclude-malformed", action="store_true", default=True)
    parser.add_argument("--no-exclude-malformed",
                        dest="exclude_malformed", action="store_false")
    parser.add_argument("--exclude-low-quality", action="store_true", default=True)
    parser.add_argument("--no-exclude-low-quality",
                        dest="exclude_low_quality", action="store_false")
    parser.add_argument("--include-ambiguous", action="store_true", default=False)
    parser.add_argument("--include-hard-negatives", action="store_true", default=True)
    parser.add_argument("--no-hard-negatives",
                        dest="include_hard_negatives", action="store_false")
    parser.add_argument("--min-date")
    parser.add_argument("--max-date")
    parser.add_argument("--pose-model-version")
    parser.add_argument("--train-ratio", type=float, default=0.70)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    tricks = active_trick_slugs() if args.all_tricks else args.tricks
    if not tricks:
        print("No tricks selected. Use --tricks or --all-tricks.", file=sys.stderr)
        sys.exit(1)

    config = ExportConfig(
        tricks=tricks,
        output_dir=args.output_dir,
        dataset_name=args.dataset_name,
        dog_id_salt=args.dog_id_salt,
        exclude_malformed=args.exclude_malformed,
        exclude_low_quality=args.exclude_low_quality,
        include_ambiguous=args.include_ambiguous,
        include_hard_negatives=args.include_hard_negatives,
        min_date=args.min_date,
        max_date=args.max_date,
        pose_model_version=args.pose_model_version,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        classifier_version=settings.service_version,
    )

    if args.source == "local":
        source = LocalFileDataSource(args.fixtures_dir)
    else:
        source = SupabaseDataSource()

    try:
        output_dir = run_export(source, config)
        print(f"Dataset exported to: {output_dir}")
        summary_path = output_dir / "dataset_summary.json"
        print(summary_path.read_text())
    except ValueError as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
