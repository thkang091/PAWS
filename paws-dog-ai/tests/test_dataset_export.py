"""
Tests for the training dataset export pipeline.

All tests run fully offline using InMemoryDataSource.
No Supabase connection or file I/O required for the logic tests.
The file-writing tests use tmp_path (pytest fixture).
"""

import json
from pathlib import Path

import pytest

from app.dataset.data_source import InMemoryDataSource
from app.dataset.dataset_exporter import _build_sample, _hash_dog_id, _passes_filters, run_export
from app.dataset.label_mapper import is_hard_negative, to_final_label
from app.dataset.splitter import grouped_split
from app.models.dataset_models import ExportConfig, SourceRecord


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_FRAME = {
    "frame_index": 0,
    "timestamp_ms": 0,
    "keypoints": {
        "nose": {"x": 100.0, "y": 100.0, "confidence": 0.90},
        "left_hip": {"x": 150.0, "y": 200.0, "confidence": 0.88},
    },
    "confidence": 0.89,
}

_CLEAN_FLAGS: dict = {
    "low_average_confidence": False,
    "excessive_missing_frames": False,
    "dog_partially_out_of_frame": False,
    "insufficient_recording_duration": False,
    "inconsistent_frame_rate": False,
    "unsupported_pose_schema": False,
}


def _record(
    verification_id: str = "ver-001",
    dog_id: str = "dog-001",
    trick: str = "sit",
    status: str = "passed",
    quality_flags: dict | None = None,
    frames: list | None = None,
    pose_model_version: str = "superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
    created_at: str = "2026-06-01T12:00:00Z",
) -> SourceRecord:
    return SourceRecord(
        verification_id=verification_id,
        dog_id=dog_id,
        trick=trick,
        status=status,
        confidence=0.85,
        failure_reason=None,
        recording_duration_seconds=3.0,
        inference_latency_ms=200,
        model_version="superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
        pose_model_version=pose_model_version,
        frames=frames if frames is not None else [_FRAME] * 30,
        avg_confidence=0.88,
        frame_count=len(frames) if frames is not None else 30,
        quality_flags=quality_flags if quality_flags is not None else dict(_CLEAN_FLAGS),
        video_path=None,
        created_at=created_at,
    )


def _default_config(**overrides) -> ExportConfig:
    base = dict(
        trick="sit",
        output_dir="training_data",
        dataset_name="test_export",
        dog_id_salt="test-salt",
        exclude_malformed=True,
        exclude_low_quality=True,
        include_ambiguous=False,
        include_hard_negatives=True,
        classifier_version="0.2.0",
    )
    base.update(overrides)
    return ExportConfig(**base)


# ---------------------------------------------------------------------------
# Label mapper
# ---------------------------------------------------------------------------


class TestLabelMapper:
    def test_passed_maps_to_passed(self):
        assert to_final_label("passed") == "passed"

    def test_failed_prefix_maps_to_failed(self):
        assert to_final_label("failed_no_valid_activity") == "failed"

    def test_retry_prefix_maps_to_invalid_recording(self):
        assert to_final_label("retry_dog_not_visible") == "invalid_recording"
        assert to_final_label("retry_low_confidence") == "invalid_recording"

    def test_error_maps_to_invalid_recording(self):
        assert to_final_label("error") == "invalid_recording"

    def test_unknown_status_maps_to_invalid_recording(self):
        assert to_final_label("something_new") == "invalid_recording"

    def test_hard_negative_requires_failed_label_and_clean_flags(self):
        assert is_hard_negative("failed", _CLEAN_FLAGS) is True
        assert is_hard_negative("passed", _CLEAN_FLAGS) is False
        dirty = {**_CLEAN_FLAGS, "low_average_confidence": True}
        assert is_hard_negative("failed", dirty) is False


# ---------------------------------------------------------------------------
# Privacy: dog_id hashing
# ---------------------------------------------------------------------------


class TestDogIdHashing:
    def test_hash_is_deterministic(self):
        h1 = _hash_dog_id("dog-abc", "salt-x")
        h2 = _hash_dog_id("dog-abc", "salt-x")
        assert h1 == h2

    def test_different_dogs_produce_different_hashes(self):
        assert _hash_dog_id("dog-001", "salt-x") != _hash_dog_id("dog-002", "salt-x")

    def test_different_salts_produce_different_hashes(self):
        assert _hash_dog_id("dog-001", "salt-a") != _hash_dog_id("dog-001", "salt-b")

    def test_hash_does_not_contain_original_dog_id(self):
        h = _hash_dog_id("dog-001", "test-salt")
        assert "dog-001" not in h


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


class TestFiltering:
    def test_clean_passed_sample_passes_default_filters(self):
        sample = _build_sample(_record(), _default_config())
        assert _passes_filters(sample, _default_config())

    def test_invalid_recording_always_excluded(self):
        sample = _build_sample(_record(status="retry_dog_not_visible"), _default_config())
        assert not _passes_filters(sample, _default_config())

    def test_wrong_trick_excluded(self):
        sample = _build_sample(_record(trick="down"), _default_config())
        assert not _passes_filters(sample, _default_config())

    def test_ambiguous_excluded_by_default(self):
        # Simulate an ambiguous status by patching label_mapper behavior via status.
        # There is no ambiguous status yet — test that the filter gate works.
        config = _default_config(include_ambiguous=False)
        sample = _build_sample(_record(status="passed"), config)
        sample.final_label = "ambiguous"
        assert not _passes_filters(sample, config)

    def test_ambiguous_included_when_flag_set(self):
        config = _default_config(include_ambiguous=True)
        sample = _build_sample(_record(status="passed"), config)
        sample.final_label = "ambiguous"
        assert _passes_filters(sample, config)

    def test_low_quality_excluded_when_flag_set(self):
        dirty_flags = {**_CLEAN_FLAGS, "low_average_confidence": True}
        sample = _build_sample(_record(status="passed", quality_flags=dirty_flags), _default_config())
        assert not _passes_filters(sample, _default_config(exclude_low_quality=True))

    def test_malformed_excluded_when_flag_set(self):
        bad_flags = {**_CLEAN_FLAGS, "unsupported_pose_schema": True}
        sample = _build_sample(_record(status="passed", quality_flags=bad_flags), _default_config())
        assert not _passes_filters(sample, _default_config(exclude_malformed=True))

    def test_zero_frame_sequence_excluded_as_malformed(self):
        sample = _build_sample(_record(status="passed", frames=[]), _default_config())
        assert not _passes_filters(sample, _default_config(exclude_malformed=True))

    def test_hard_negatives_excluded_when_flag_false(self):
        config = _default_config(include_hard_negatives=False)
        sample = _build_sample(_record(status="failed_no_valid_activity"), config)
        assert not _passes_filters(sample, config)

    def test_hard_negatives_included_when_flag_true(self):
        config = _default_config(include_hard_negatives=True)
        sample = _build_sample(_record(status="failed_no_valid_activity"), config)
        assert _passes_filters(sample, config)


# ---------------------------------------------------------------------------
# Grouped splitting — no dog may appear in more than one split
# ---------------------------------------------------------------------------


class TestGroupedSplit:
    def _samples_for_dogs(self, n_dogs: int, samples_per_dog: int = 3):
        config = _default_config()
        samples = []
        for d in range(n_dogs):
            for s in range(samples_per_dog):
                r = _record(
                    verification_id=f"ver-d{d}-s{s}",
                    dog_id=f"dog-{d:03d}",
                )
                samples.append(_build_sample(r, config))
        return samples

    def test_no_dog_appears_in_more_than_one_split(self):
        samples = self._samples_for_dogs(30)
        splits = grouped_split(samples, 0.70, 0.15, 0.15)

        train_set = set(splits.train)
        val_set = set(splits.val)
        test_set = set(splits.test)

        # Map verification_id -> dog_id_hashed
        id_to_dog = {s.verification_id: s.dog_id_hashed for s in samples}

        train_dogs = {id_to_dog[v] for v in train_set}
        val_dogs = {id_to_dog[v] for v in val_set}
        test_dogs = {id_to_dog[v] for v in test_set}

        assert train_dogs.isdisjoint(val_dogs), "Train and val share dogs"
        assert train_dogs.isdisjoint(test_dogs), "Train and test share dogs"
        assert val_dogs.isdisjoint(test_dogs), "Val and test share dogs"

    def test_split_is_deterministic(self):
        samples = self._samples_for_dogs(20)
        splits_a = grouped_split(samples, 0.70, 0.15, 0.15)
        splits_b = grouped_split(samples, 0.70, 0.15, 0.15)
        assert splits_a.train == splits_b.train
        assert splits_a.val == splits_b.val
        assert splits_a.test == splits_b.test

    def test_all_samples_are_assigned(self):
        samples = self._samples_for_dogs(10)
        splits = grouped_split(samples, 0.70, 0.15, 0.15)
        total = len(splits.train) + len(splits.val) + len(splits.test)
        assert total == len(samples)

    def test_ratios_must_sum_to_one(self):
        samples = self._samples_for_dogs(5)
        with pytest.raises(ValueError, match="sum to 1.0"):
            grouped_split(samples, 0.60, 0.20, 0.30)


# ---------------------------------------------------------------------------
# Full export pipeline — file output (uses pytest tmp_path)
# ---------------------------------------------------------------------------


class TestExportPipeline:
    def _multi_dog_records(self) -> list[SourceRecord]:
        records = []
        for dog_idx in range(10):
            for attempt in range(3):
                status = "passed" if attempt < 2 else "failed_no_valid_activity"
                records.append(_record(
                    verification_id=f"ver-{dog_idx:02d}-{attempt}",
                    dog_id=f"dog-{dog_idx:03d}",
                    status=status,
                ))
        return records

    def test_correct_export_format(self, tmp_path):
        config = _default_config(output_dir=str(tmp_path))
        source = InMemoryDataSource(self._multi_dog_records())
        output_dir = run_export(source, config)

        assert (output_dir / "manifest.jsonl").exists()
        assert (output_dir / "dataset_summary.json").exists()
        assert (output_dir / "splits.json").exists()
        assert (output_dir / "sequences").is_dir()

        # Every manifest entry should have a corresponding sequence file.
        manifest_lines = (output_dir / "manifest.jsonl").read_text().strip().splitlines()
        for line in manifest_lines:
            entry = json.loads(line)
            seq_path = output_dir / entry["sequence_file"]
            assert seq_path.exists(), f"Missing sequence file for {entry['verification_id']}"
            seq_data = json.loads(seq_path.read_text())
            assert "pose_sequence" in seq_data
            assert "final_label" in seq_data
            assert "dog_id_hashed" in seq_data
            assert "dog_id" not in seq_data  # raw dog_id must never appear

    def test_deterministic_output(self, tmp_path):
        config_a = _default_config(output_dir=str(tmp_path / "run_a"), dataset_name="ds_a")
        config_b = _default_config(output_dir=str(tmp_path / "run_b"), dataset_name="ds_a")
        records = self._multi_dog_records()
        run_export(InMemoryDataSource(records), config_a)
        run_export(InMemoryDataSource(records), config_b)

        manifest_a = sorted((tmp_path / "run_a" / "ds_a" / "manifest.jsonl").read_text().splitlines())
        manifest_b = sorted((tmp_path / "run_b" / "ds_a" / "manifest.jsonl").read_text().splitlines())
        assert manifest_a == manifest_b

    def test_grouped_splits_have_no_dog_overlap(self, tmp_path):
        config = _default_config(output_dir=str(tmp_path))
        source = InMemoryDataSource(self._multi_dog_records())
        output_dir = run_export(source, config)

        splits = json.loads((output_dir / "splits.json").read_text())
        manifest_lines = (output_dir / "manifest.jsonl").read_text().strip().splitlines()
        id_to_dog = {json.loads(l)["verification_id"]: json.loads(l)["dog_id_hashed"]
                     for l in manifest_lines}

        train_dogs = {id_to_dog[v] for v in splits["train"] if v in id_to_dog}
        val_dogs = {id_to_dog[v] for v in splits["val"] if v in id_to_dog}
        test_dogs = {id_to_dog[v] for v in splits["test"] if v in id_to_dog}

        assert train_dogs.isdisjoint(val_dogs)
        assert train_dogs.isdisjoint(test_dogs)
        assert val_dogs.isdisjoint(test_dogs)

    def test_malformed_sequences_handled_safely(self, tmp_path):
        records = self._multi_dog_records()
        # Add a record with 0 frames and unsupported schema flag.
        records.append(_record(
            verification_id="ver-malformed",
            dog_id="dog-malformed",
            status="passed",
            frames=[],
            quality_flags={**_CLEAN_FLAGS, "unsupported_pose_schema": True},
        ))
        config = _default_config(output_dir=str(tmp_path), exclude_malformed=True)
        output_dir = run_export(InMemoryDataSource(records), config)

        manifest = (output_dir / "manifest.jsonl").read_text()
        assert "ver-malformed" not in manifest

    def test_filtering_excludes_low_quality(self, tmp_path):
        records = self._multi_dog_records()
        records.append(_record(
            verification_id="ver-lowq",
            dog_id="dog-lowq",
            status="passed",
            quality_flags={**_CLEAN_FLAGS, "low_average_confidence": True},
        ))
        config = _default_config(output_dir=str(tmp_path), exclude_low_quality=True)
        output_dir = run_export(InMemoryDataSource(records), config)

        manifest = (output_dir / "manifest.jsonl").read_text()
        assert "ver-lowq" not in manifest

    def test_empty_after_filtering_raises(self, tmp_path):
        # All records are retry (invalid_recording) — should raise after filtering.
        records = [_record(status="retry_dog_not_visible", verification_id=f"v{i}", dog_id=f"d{i}")
                   for i in range(5)]
        config = _default_config(output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="No samples passed"):
            run_export(InMemoryDataSource(records), config)

    def test_dataset_summary_counts_are_correct(self, tmp_path):
        records = self._multi_dog_records()
        config = _default_config(output_dir=str(tmp_path))
        output_dir = run_export(InMemoryDataSource(records), config)

        summary = json.loads((output_dir / "dataset_summary.json").read_text())
        assert summary["total_samples"] == summary["passed_count"] + summary["failed_count"] + summary["ambiguous_count"]
        assert summary["train_count"] + summary["val_count"] + summary["test_count"] == summary["total_samples"]
        assert summary["unique_dogs"] > 0
