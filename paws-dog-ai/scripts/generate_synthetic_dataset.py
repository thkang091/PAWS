"""
Generate a synthetic sit dataset for testing the training pipeline.

Produces the same directory structure as export_sit_dataset.py:
  <output_dir>/<dataset_name>/
    manifest.jsonl
    splits.json
    dataset_summary.json
    sequences/<verification_id>.json

Usage:

    python scripts/generate_synthetic_dataset.py
    python scripts/generate_synthetic_dataset.py --n-dogs 30 --samples-per-dog 5
    python scripts/generate_synthetic_dataset.py \\
        --output-dir training_data \\
        --dataset-name sit_dataset_v1 \\
        --n-dogs 40 \\
        --samples-per-dog 6

The generated sequences mimic real sit pose sequences:
  - Passed: hip Y coordinate rises over time (dog lowers hips = sit)
  - Failed: hip Y coordinate stays flat
  - Confidence and keypoint positions have Gaussian noise
"""

import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ml.preprocessing import KEYPOINT_ORDER

SALT = "paws-dataset-v1"


def _hash_dog_id(dog_id: str) -> str:
    return hashlib.sha256(f"{SALT}{dog_id}".encode()).hexdigest()[:16]


def _make_keypoint(
    name: str,
    x: float,
    y: float,
    confidence: float = 0.88,
    missing: bool = False,
) -> dict:
    if missing:
        return {"x": None, "y": None, "confidence": 0.0}
    return {
        "x": round(x + random.gauss(0, 2.0), 3),
        "y": round(y + random.gauss(0, 2.0), 3),
        "confidence": round(min(1.0, max(0.0, confidence + random.gauss(0, 0.04))), 3),
    }


def _generate_sit_sequence(
    n_frames: int = 45,
    label: str = "passed",
    base_confidence: float = 0.88,
    fps: float = 30.0,
) -> list[dict]:
    """
    Synthesize a pose sequence.

    passed: hips drop smoothly over first 60% of frames then stay low
    failed: hips stay roughly flat throughout
    """
    frames = []
    cx, cy = 320.0, 240.0   # image center

    # Rough anatomical layout (pixel offsets from center).
    base_positions = {
        "nose":            (0, -90),
        "left_shoulder":   (-30, -50),
        "right_shoulder":  (30, -50),
        "left_hip":        (-25, 0),
        "right_hip":       (25, 0),
        "tail_base":       (0, 20),
        "left_front_paw":  (-35, 60),
        "right_front_paw": (35, 60),
        "left_hind_paw":   (-30, 70),
        "right_hind_paw":  (30, 70),
    }

    for i in range(n_frames):
        t = i / n_frames

        # Hip drop: in a real sit, hips move down relative to shoulders.
        if label == "passed":
            hip_drop = 40.0 * min(t / 0.6, 1.0)   # drop 40px over first 60%
        else:
            hip_drop = random.gauss(0, 3.0)         # essentially flat

        keypoints = {}
        for name in KEYPOINT_ORDER:
            if name not in base_positions:
                keypoints[name] = _make_keypoint(name, cx, cy, base_confidence)
                continue
            dx, dy = base_positions[name]
            if "hip" in name or name == "tail_base":
                dy += hip_drop
            if "hind_paw" in name and label == "passed":
                # Hind paws tuck under when sitting.
                dy -= hip_drop * 0.4
            keypoints[name] = _make_keypoint(
                name, cx + dx, cy + dy, base_confidence
            )

        frame_conf = sum(kp["confidence"] for kp in keypoints.values() if kp["confidence"] > 0)
        frame_conf /= max(sum(1 for kp in keypoints.values() if kp["confidence"] > 0), 1)

        frames.append({
            "frame_index": i,
            "timestamp_ms": int(i / fps * 1000),
            "keypoints": keypoints,
            "confidence": round(frame_conf, 3),
        })

    return frames


def _generate_dataset(
    n_dogs: int,
    samples_per_dog: int,
    output_dir: Path,
    dataset_name: str,
    train_ratio: float,
    val_ratio: float,
    rng_seed: int,
) -> None:
    random.seed(rng_seed)

    dataset_dir = output_dir / dataset_name
    sequences_dir = dataset_dir / "sequences"
    sequences_dir.mkdir(parents=True, exist_ok=True)

    # Assign dogs to splits deterministically.
    dogs = [f"dog-{i:04d}" for i in range(n_dogs)]
    dogs_sorted = sorted(dogs, key=lambda d: _hash_dog_id(d))
    train_end = int(round(n_dogs * train_ratio))
    val_end = train_end + int(round(n_dogs * val_ratio))
    dog_split = {}
    for d in dogs_sorted[:train_end]:
        dog_split[d] = "train"
    for d in dogs_sorted[train_end:val_end]:
        dog_split[d] = "val"
    for d in dogs_sorted[val_end:]:
        dog_split[d] = "test"

    manifest_entries = []
    splits: dict[str, list[str]] = {"train": [], "val": [], "test": []}

    for dog_id in dogs:
        for s in range(samples_per_dog):
            ver_id = f"ver-{dog_id}-{s:02d}"
            # Alternate passed/failed with slight passed-heavy imbalance.
            label = "passed" if s % 3 != 0 else "failed"
            conf = random.uniform(0.80, 0.94)
            n_frames = random.randint(35, 55)

            frames = _generate_sit_sequence(
                n_frames=n_frames,
                label=label,
                base_confidence=conf,
            )
            dog_id_hashed = _hash_dog_id(dog_id)
            split = dog_split[dog_id]

            seq_data = {
                "verification_id": ver_id,
                "dog_id_hashed": dog_id_hashed,
                "trick": "sit",
                "final_label": label,
                "is_hard_negative": label == "failed",
                "frame_count": n_frames,
                "recording_duration_seconds": round(n_frames / 30.0, 2),
                "avg_keypoint_confidence": round(conf, 3),
                "quality_flags": {
                    "low_average_confidence": conf < 0.55,
                    "excessive_missing_frames": False,
                    "dog_partially_out_of_frame": False,
                    "insufficient_recording_duration": n_frames < 6,
                    "inconsistent_frame_rate": False,
                    "unsupported_pose_schema": False,
                },
                "pose_model_version": "superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
                "classifier_version": "0.2.0",
                "model_name": "superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
                "video_path": None,
                "created_at": "2026-06-01T12:00:00Z",
                "pose_sequence": frames,
            }
            (sequences_dir / f"{ver_id}.json").write_text(json.dumps(seq_data, indent=2))

            manifest_entries.append({
                "verification_id": ver_id,
                "dog_id_hashed": dog_id_hashed,
                "trick": "sit",
                "final_label": label,
                "is_hard_negative": seq_data["is_hard_negative"],
                "split": split,
                "sequence_file": f"sequences/{ver_id}.json",
                "video_path": None,
                "avg_keypoint_confidence": round(conf, 3),
                "frame_count": n_frames,
                "pose_model_version": seq_data["pose_model_version"],
                "classifier_version": "0.2.0",
                "created_at": "2026-06-01T12:00:00Z",
            })
            splits[split].append(ver_id)

    (dataset_dir / "manifest.jsonl").write_text(
        "\n".join(json.dumps(e) for e in manifest_entries) + "\n"
    )
    (dataset_dir / "splits.json").write_text(json.dumps(splits, indent=2))

    total = len(manifest_entries)
    passed = sum(1 for e in manifest_entries if e["final_label"] == "passed")
    failed = total - passed

    summary = {
        "dataset_name": dataset_name,
        "trick": "sit",
        "total_samples": total,
        "passed_count": passed,
        "failed_count": failed,
        "ambiguous_count": 0,
        "invalid_recording_count": 0,
        "unique_dogs": n_dogs,
        "avg_frame_count": round(sum(
            json.loads((sequences_dir / f"{e['verification_id']}.json").read_text())["frame_count"]
            for e in manifest_entries
        ) / total, 2),
        "train_count": len(splits["train"]),
        "val_count": len(splits["val"]),
        "test_count": len(splits["test"]),
        "note": "Synthetic dataset generated by generate_synthetic_dataset.py",
    }
    (dataset_dir / "dataset_summary.json").write_text(json.dumps(summary, indent=2))

    print(f"Generated {total} samples across {n_dogs} dogs.")
    print(f"  Train: {len(splits['train'])}  Val: {len(splits['val'])}  Test: {len(splits['test'])}")
    print(f"  Passed: {passed}  Failed: {failed}")
    print(f"  Output: {dataset_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a synthetic sit dataset for training.")
    parser.add_argument("--output-dir", default="training_data")
    parser.add_argument("--dataset-name", default="sit_dataset_v1")
    parser.add_argument("--n-dogs", type=int, default=30)
    parser.add_argument("--samples-per-dog", type=int, default=5)
    parser.add_argument("--train-ratio", type=float, default=0.70)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    _generate_dataset(
        n_dogs=args.n_dogs,
        samples_per_dog=args.samples_per_dog,
        output_dir=Path(args.output_dir),
        dataset_name=args.dataset_name,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        rng_seed=args.seed,
    )


if __name__ == "__main__":
    main()
