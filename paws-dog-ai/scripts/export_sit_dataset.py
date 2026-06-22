"""
PAWS Training Dataset Export Script
====================================

Exports labeled sit verification attempts into a versioned, ML-ready dataset.

USAGE
-----

Basic export from Supabase (requires .env with SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY configured):

    python scripts/export_sit_dataset.py

Export with filters:

    python scripts/export_sit_dataset.py \\
        --dataset-name sit_dataset_v2 \\
        --min-date 2026-01-01 \\
        --max-date 2026-12-31 \\
        --pose-model-version superanimal_quadruped_hrnet_w32_fasterrcnn_v1 \\
        --exclude-malformed \\
        --exclude-low-quality \\
        --include-ambiguous \\
        --train-ratio 0.70 \\
        --val-ratio 0.15 \\
        --test-ratio 0.15

Export from local fixture files (for testing or offline use):

    python scripts/export_sit_dataset.py \\
        --source local \\
        --fixtures-dir tests/fixtures/export

Privacy:

    Dog IDs are hashed before export. The default salt is "paws-dataset-v1".
    Override with --dog-id-salt to rotate the anonymization key between exports.

    python scripts/export_sit_dataset.py --dog-id-salt my-secret-salt-2026

OUTPUT
------

    training_data/
      <dataset-name>/
        manifest.jsonl          One JSON line per sample (no pose data)
        splits.json             {train: [...], val: [...], test: [...]}
        dataset_summary.json    Aggregate statistics
        sequences/
          <verification_id>.json    Full pose sequence + metadata per sample

FILTERS
-------

--trick                   Only export this activity (default: sit)
--exclude-malformed       Skip sequences with unsupported_pose_schema or 0 frames
--exclude-low-quality     Skip sequences with low_average_confidence,
                          excessive_missing_frames, or insufficient_recording_duration
--include-ambiguous       Include samples with final_label=ambiguous
--include-hard-negatives  Include failed samples with no quality flags
--no-hard-negatives       Exclude failed samples (only passed / ambiguous)
--min-date                ISO date string YYYY-MM-DD (inclusive)
--max-date                ISO date string YYYY-MM-DD (inclusive)
--pose-model-version      Only export sequences from this pose model version

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
from app.dataset.data_source import InMemoryDataSource, LocalFileDataSource, SupabaseDataSource
from app.dataset.dataset_exporter import run_export
from app.models.dataset_models import ExportConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export PAWS sit verification attempts as a versioned ML dataset.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--output-dir", default="training_data")
    parser.add_argument("--dataset-name", default="sit_dataset_v1")
    parser.add_argument("--trick", default="sit")
    parser.add_argument("--source", choices=["supabase", "local"], default="supabase")
    parser.add_argument("--fixtures-dir", default="tests/fixtures/export",
                        help="Directory of SourceRecord JSON files (--source local only)")
    parser.add_argument("--dog-id-salt", default="paws-dataset-v1")
    parser.add_argument("--exclude-malformed", action="store_true", default=True)
    parser.add_argument("--no-exclude-malformed", dest="exclude_malformed", action="store_false")
    parser.add_argument("--exclude-low-quality", action="store_true", default=True)
    parser.add_argument("--no-exclude-low-quality", dest="exclude_low_quality", action="store_false")
    parser.add_argument("--include-ambiguous", action="store_true", default=False)
    parser.add_argument("--include-hard-negatives", action="store_true", default=True)
    parser.add_argument("--no-hard-negatives", dest="include_hard_negatives", action="store_false")
    parser.add_argument("--min-date")
    parser.add_argument("--max-date")
    parser.add_argument("--pose-model-version")
    parser.add_argument("--train-ratio", type=float, default=0.70)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    config = ExportConfig(
        trick=args.trick,
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
