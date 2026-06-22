import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.classifiers.sit_classifier import SitClassifier
from app.models.pose_models import PoseSequence, VideoMetadata
from app.models.request_models import ActivityAnalysisRequest


EXPECTED_STATUS = {
    "positive": "passed",
    "negative": "failed_no_valid_activity",
    "retry_angle": "retry_camera_angle",
    "retry_visibility": "retry_dog_not_visible",
    "retry_multiple_dogs": "retry_multiple_dogs",
    "retry_low_confidence": "retry_low_confidence",
}


def empty_pose_sequence(video_path: Path) -> PoseSequence:
    return PoseSequence(
        model_name="validation_placeholder",
        metadata=VideoMetadata(duration_seconds=0, fps=30, width=0, height=0, frame_count=0),
        frames=[],
        average_confidence=0,
        required_keypoint_visibility_ratio=0,
        dog_frame_coverage_ratio=0,
        inference_available=False,
        inference_error=f"Validation inference adapter is not connected for {video_path.name}.",
    )


def main() -> None:
    base = ROOT / "validation_data" / "sit"
    classifier = SitClassifier()
    rows = []

    for label, expected_status in EXPECTED_STATUS.items():
        for video_path in sorted((base / label).glob("*")):
            if video_path.name.startswith(".") or video_path.suffix.lower() not in {".mp4", ".mov"}:
                continue
            request = ActivityAnalysisRequest(
                verification_id=f"validation-{video_path.stem}",
                user_id="validation",
                dog_id="validation",
                activity_id="sit",
                verification_mode="POSE_TEMPORAL",
                storage_path=str(video_path),
                context_type="training",
            )
            result = classifier.analyze_pose_sequence(request, empty_pose_sequence(video_path))
            rows.append({
                "video": str(video_path.relative_to(ROOT)),
                "label": label,
                "expected_status": expected_status,
                "predicted_status": result.status,
                "confidence": result.confidence_score,
                "correct": result.status == expected_status,
            })

    total = len(rows)
    correct = len([row for row in rows if row["correct"]])
    false_positives = len([row for row in rows if row["expected_status"] != "passed" and row["predicted_status"] == "passed"])
    false_negatives = len([row for row in rows if row["expected_status"] == "passed" and row["predicted_status"] != "passed"])
    retry_rows = [row for row in rows if row["expected_status"].startswith("retry_")]
    retry_correct = len([row for row in retry_rows if row["correct"]])
    confidences = [row["confidence"] for row in rows if isinstance(row["confidence"], int | float)]

    report = {
        "total_videos": total,
        "correct_results": correct,
        "incorrect_results": total - correct,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "retry_state_accuracy": retry_correct / len(retry_rows) if retry_rows else None,
        "average_confidence": sum(confidences) / len(confidences) if confidences else None,
        "per_video": rows,
        "note": "Connect this script to PoseInferenceService after DeepLabCut output parsing is mapped.",
    }

    report_path = ROOT / "validation_data" / "sit" / "validation_report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
