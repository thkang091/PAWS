from datetime import datetime, timezone

from app.models.dataset_models import (
    DatasetSample,
    DatasetSplits,
    DatasetSummary,
    ExportConfig,
    QualityFlagBreakdown,
)


def build_summary(
    samples: list[DatasetSample],
    splits: DatasetSplits,
    config: ExportConfig,
) -> DatasetSummary:
    train_set = set(splits.train)
    val_set = set(splits.val)

    flag_counts = QualityFlagBreakdown()
    version_counts: dict[str, int] = {}

    for s in samples:
        flags = s.quality_flags
        if flags.get("low_average_confidence"):
            flag_counts.low_average_confidence += 1
        if flags.get("excessive_missing_frames"):
            flag_counts.excessive_missing_frames += 1
        if flags.get("dog_partially_out_of_frame"):
            flag_counts.dog_partially_out_of_frame += 1
        if flags.get("insufficient_recording_duration"):
            flag_counts.insufficient_recording_duration += 1
        if flags.get("inconsistent_frame_rate"):
            flag_counts.inconsistent_frame_rate += 1
        if flags.get("unsupported_pose_schema"):
            flag_counts.unsupported_pose_schema += 1
        if any(flags.values()):
            flag_counts.any_flag += 1

        version_counts[s.pose_model_version] = version_counts.get(s.pose_model_version, 0) + 1

    total = len(samples)
    avg_frames = sum(s.frame_count for s in samples) / total if total else 0.0
    avg_conf = sum(s.avg_keypoint_confidence for s in samples) / total if total else 0.0

    return DatasetSummary(
        dataset_name=config.dataset_name,
        tricks=config.tricks,
        trick=config.trick,
        export_config=config,
        total_samples=total,
        passed_count=sum(1 for s in samples if s.final_label == "passed"),
        failed_count=sum(1 for s in samples if s.final_label == "failed"),
        hard_negative_count=sum(1 for s in samples if s.is_hard_negative),
        ambiguous_count=sum(1 for s in samples if s.final_label == "ambiguous"),
        invalid_recording_count=sum(1 for s in samples if s.final_label == "invalid_recording"),
        unique_dogs=len({s.dog_id_hashed for s in samples}),
        avg_frame_count=round(avg_frames, 2),
        avg_keypoint_confidence=round(avg_conf, 4),
        train_count=len(splits.train),
        val_count=len(splits.val),
        test_count=len(splits.test),
        pose_model_version_breakdown=version_counts,
        quality_flag_breakdown=flag_counts,
        exported_at=datetime.now(timezone.utc).isoformat(),
    )
