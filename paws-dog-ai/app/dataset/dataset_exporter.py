"""
Orchestrates the full dataset export pipeline:

  1. Fetch source records via a DataSource
  2. Filter by config (trick, dates, quality, labels)
  3. Build anonymized DatasetSample objects
  4. Grouped split by dog_id
  5. Write manifest.jsonl, per-sample sequence files, dataset_summary.json,
     and splits.json to the output directory
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from app.dataset.data_source import DataSource
from app.dataset.label_mapper import is_hard_negative, to_final_label
from app.dataset.splitter import grouped_split, split_label
from app.dataset.summary import build_summary
from app.models.dataset_models import (
    DatasetManifestEntry,
    DatasetSample,
    ExportConfig,
    SourceRecord,
)


def _hash_dog_id(dog_id: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{dog_id}".encode()).hexdigest()[:16]


def _build_sample(record: SourceRecord, config: ExportConfig) -> DatasetSample:
    label = to_final_label(record.status)
    quality_flags = record.quality_flags or {}
    trick_completed = label == "passed"
    return DatasetSample(
        verification_id=record.verification_id,
        dog_id_hashed=_hash_dog_id(record.dog_id, config.dog_id_salt),
        trick=record.trick,
        requested_trick=record.trick,
        detected_trick=None,       # populated post-hoc by the ML pipeline
        trick_completed=trick_completed,
        final_label=label,
        is_hard_negative=is_hard_negative(label, quality_flags),
        pose_sequence=record.frames,
        frame_count=record.frame_count,
        recording_duration_seconds=record.recording_duration_seconds,
        avg_keypoint_confidence=record.avg_confidence,
        quality_flags=quality_flags,
        pose_model_version=record.pose_model_version,
        classifier_version=config.classifier_version,
        model_name=record.model_version,
        video_path=record.video_path,
        created_at=record.created_at,
    )


def _passes_filters(sample: DatasetSample, config: ExportConfig) -> bool:
    if config.tricks and sample.trick not in config.tricks:
        return False

    if sample.final_label == "invalid_recording":
        return False

    if sample.final_label == "ambiguous" and not config.include_ambiguous:
        return False

    if sample.final_label == "failed":
        if not config.include_hard_negatives:
            return False

    if config.exclude_malformed:
        if sample.quality_flags.get("unsupported_pose_schema"):
            return False
        if sample.frame_count == 0:
            return False

    if config.exclude_low_quality:
        if sample.quality_flags.get("low_average_confidence"):
            return False
        if sample.quality_flags.get("excessive_missing_frames"):
            return False
        if sample.quality_flags.get("insufficient_recording_duration"):
            return False

    return True


def run_export(source: DataSource, config: ExportConfig) -> Path:
    """
    Runs the full pipeline and writes the dataset to disk.
    Returns the path to the dataset directory.
    """
    # 1. Fetch
    raw_records = source.fetch(config)

    # 2. Build samples (anonymize dog_id, map labels)
    all_samples = [_build_sample(r, config) for r in raw_records]

    # 3. Filter
    samples = [s for s in all_samples if _passes_filters(s, config)]

    if not samples:
        raise ValueError(
            f"No samples passed the export filters. "
            f"Total fetched: {len(raw_records)}, after filtering: 0. "
            f"Check your filter configuration."
        )

    # 4. Grouped split
    splits = grouped_split(samples, config.train_ratio, config.val_ratio, config.test_ratio)

    # 5. Write output
    output_dir = Path(config.output_dir) / config.dataset_name
    sequences_dir = output_dir / "sequences"
    sequences_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: list[DatasetManifestEntry] = []

    for sample in samples:
        seq_filename = f"{sample.verification_id}.json"
        seq_path = sequences_dir / seq_filename
        seq_path.write_text(
            json.dumps(
                {
                    "verification_id": sample.verification_id,
                    "dog_id_hashed": sample.dog_id_hashed,
                    "trick": sample.trick,
                    "final_label": sample.final_label,
                    "is_hard_negative": sample.is_hard_negative,
                    "frame_count": sample.frame_count,
                    "recording_duration_seconds": sample.recording_duration_seconds,
                    "avg_keypoint_confidence": sample.avg_keypoint_confidence,
                    "quality_flags": sample.quality_flags,
                    "pose_model_version": sample.pose_model_version,
                    "classifier_version": sample.classifier_version,
                    "model_name": sample.model_name,
                    "video_path": sample.video_path,
                    "created_at": sample.created_at,
                    "pose_sequence": sample.pose_sequence,
                },
                indent=2,
            )
        )

        split = split_label(splits, sample.verification_id)
        manifest_entries.append(
            DatasetManifestEntry(
                verification_id=sample.verification_id,
                dog_id_hashed=sample.dog_id_hashed,
                trick=sample.trick,
                final_label=sample.final_label,
                is_hard_negative=sample.is_hard_negative,
                split=split,
                sequence_file=f"sequences/{seq_filename}",
                video_path=sample.video_path,
                avg_keypoint_confidence=sample.avg_keypoint_confidence,
                frame_count=sample.frame_count,
                pose_model_version=sample.pose_model_version,
                classifier_version=sample.classifier_version,
                created_at=sample.created_at,
            )
        )

    # manifest.jsonl
    manifest_path = output_dir / "manifest.jsonl"
    manifest_path.write_text(
        "\n".join(json.dumps(e.model_dump()) for e in manifest_entries) + "\n"
    )

    # splits.json
    (output_dir / "splits.json").write_text(
        json.dumps(splits.model_dump(), indent=2)
    )

    # dataset_summary.json
    summary = build_summary(samples, splits, config)
    (output_dir / "dataset_summary.json").write_text(
        json.dumps(summary.model_dump(), indent=2)
    )

    return output_dir
