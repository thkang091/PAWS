"""
DataSource abstraction for the export pipeline.

  LocalFileDataSource  -- reads from a directory of JSON fixture files.
                          Each file is one SourceRecord (used in tests and
                          for exporting from local validation runs).

  SupabaseDataSource   -- joins pose_sequences + activity_verifications via
                          the Supabase service-role client.
                          Not exercised in unit tests (requires live DB).
"""

import json
from abc import ABC, abstractmethod
from pathlib import Path

from app.models.dataset_models import ExportConfig, SourceRecord


class DataSource(ABC):
    @abstractmethod
    def fetch(self, config: ExportConfig) -> list[SourceRecord]:
        """Return all source records matching the config filters."""
        raise NotImplementedError


class LocalFileDataSource(DataSource):
    """
    Reads SourceRecord JSON files from a local directory.
    Each file must contain a single JSON object matching the SourceRecord schema.
    Useful for local testing and for exporting from validation_data/.
    """

    def __init__(self, fixtures_dir: str | Path) -> None:
        self._dir = Path(fixtures_dir)

    def fetch(self, config: ExportConfig) -> list[SourceRecord]:
        records: list[SourceRecord] = []
        for path in sorted(self._dir.glob("*.json")):
            try:
                raw = json.loads(path.read_text())
                record = SourceRecord.model_validate(raw)
            except Exception:
                # Malformed fixture — skip and let the exporter's filter handle it.
                continue
            records.append(record)
        return records


class InMemoryDataSource(DataSource):
    """
    Accepts a list of SourceRecord objects directly.
    Used in tests to avoid file I/O.
    """

    def __init__(self, records: list[SourceRecord]) -> None:
        self._records = records

    def fetch(self, config: ExportConfig) -> list[SourceRecord]:
        return list(self._records)


class SupabaseDataSource(DataSource):
    """
    Queries Supabase for pose_sequences joined with activity_verifications.

    Not tested in unit tests — requires a live Supabase connection.
    """

    def fetch(self, config: ExportConfig) -> list[SourceRecord]:
        from app.services.supabase_service import get_supabase

        client = get_supabase()

        query = (
            client.table("pose_sequences")
            .select(
                "verification_id, dog_id, pose_model_version, avg_confidence, "
                "frame_count, inference_latency_ms, quality_flags, frames, created_at, "
                "activity_verifications(status, confidence_score, failure_reason, "
                "model_name, activity_id)"
            )
        )

        if config.min_date:
            query = query.gte("created_at", config.min_date)
        if config.max_date:
            query = query.lte("created_at", config.max_date + "T23:59:59Z")
        if config.pose_model_version:
            query = query.eq("pose_model_version", config.pose_model_version)

        response = query.execute()
        records: list[SourceRecord] = []

        for row in response.data or []:
            av = row.get("activity_verifications") or {}
            try:
                records.append(SourceRecord(
                    verification_id=row["verification_id"],
                    dog_id=row["dog_id"],
                    trick=av.get("activity_id", config.trick),
                    status=av.get("status", "error"),
                    confidence=av.get("confidence_score"),
                    failure_reason=av.get("failure_reason"),
                    recording_duration_seconds=None,
                    inference_latency_ms=row.get("inference_latency_ms"),
                    model_version=av.get("model_name"),
                    pose_model_version=row["pose_model_version"],
                    frames=row.get("frames", []),
                    avg_confidence=row.get("avg_confidence", 0.0),
                    frame_count=row.get("frame_count", 0),
                    quality_flags=row.get("quality_flags", {}),
                    video_path=None,
                    created_at=row["created_at"],
                ))
            except Exception:
                continue

        return records
