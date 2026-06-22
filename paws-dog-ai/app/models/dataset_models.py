from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, field_validator


class ExportConfig(BaseModel):
    # tricks: list of trick slugs to include.  Defaults to ["sit"] for
    # backward compatibility with existing export scripts.
    tricks: list[str] = ["sit"]
    output_dir: str = "training_data"
    dataset_name: str = "trick_dataset_v1"
    dog_id_salt: str = "paws-dataset-v1"
    exclude_malformed: bool = True
    exclude_low_quality: bool = True
    include_ambiguous: bool = False
    include_hard_negatives: bool = True
    min_date: str | None = None   # ISO date string "YYYY-MM-DD"
    max_date: str | None = None
    pose_model_version: str | None = None
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    classifier_version: str = "unknown"

    @field_validator("tricks", mode="before")
    @classmethod
    def _coerce_single_trick(cls, v):
        # Accept a bare string for convenience: trick="sit" -> tricks=["sit"].
        if isinstance(v, str):
            return [v]
        return v

    @property
    def trick(self) -> str:
        """Single-trick accessor for backward compatibility."""
        return self.tricks[0] if self.tricks else "sit"


class SourceRecord(BaseModel):
    """Raw record as returned by a DataSource — contains real dog_id."""
    verification_id: str
    dog_id: str
    trick: str
    status: str
    confidence: float | None
    failure_reason: str | None
    recording_duration_seconds: float | None
    inference_latency_ms: int | None
    model_version: str | None
    pose_model_version: str
    frames: list[dict]
    avg_confidence: float
    frame_count: int
    quality_flags: dict
    video_path: str | None
    created_at: str


class DatasetSample(BaseModel):
    """One export-ready training sample. dog_id is anonymized."""
    verification_id: str
    dog_id_hashed: str
    # requested_trick: the trick the handler asked the dog to perform.
    trick: str                     # backward-compat alias for requested_trick
    requested_trick: str           # canonical multi-class field
    # detected_trick: the trick the classifier believes was performed.
    # None when produced by a binary rule-based classifier.
    detected_trick: str | None = None
    # trick_completed: whether the detected trick was performed correctly.
    trick_completed: bool | None = None
    final_label: str               # passed | failed | ambiguous | invalid_recording
    is_hard_negative: bool         # failed with no quality flags
    pose_sequence: list[dict]      # frames array as stored in Supabase
    frame_count: int
    recording_duration_seconds: float | None
    avg_keypoint_confidence: float
    quality_flags: dict
    pose_model_version: str
    classifier_version: str
    model_name: str | None
    video_path: str | None
    created_at: str


class DatasetManifestEntry(BaseModel):
    verification_id: str
    dog_id_hashed: str
    trick: str
    final_label: str
    is_hard_negative: bool
    split: str                     # train | val | test
    sequence_file: str             # relative path under sequences/
    video_path: str | None
    avg_keypoint_confidence: float
    frame_count: int
    pose_model_version: str
    classifier_version: str
    created_at: str


class QualityFlagBreakdown(BaseModel):
    low_average_confidence: int = 0
    excessive_missing_frames: int = 0
    dog_partially_out_of_frame: int = 0
    insufficient_recording_duration: int = 0
    inconsistent_frame_rate: int = 0
    unsupported_pose_schema: int = 0
    any_flag: int = 0


class DatasetSummary(BaseModel):
    dataset_name: str
    tricks: list[str]
    trick: str  # backward-compat: first trick in the list
    export_config: ExportConfig
    total_samples: int
    passed_count: int
    failed_count: int
    hard_negative_count: int
    ambiguous_count: int
    invalid_recording_count: int
    unique_dogs: int
    avg_frame_count: float
    avg_keypoint_confidence: float
    train_count: int
    val_count: int
    test_count: int
    pose_model_version_breakdown: dict[str, int]
    quality_flag_breakdown: QualityFlagBreakdown
    exported_at: str


class DatasetSplits(BaseModel):
    train: list[str]   # verification_ids
    val: list[str]
    test: list[str]
