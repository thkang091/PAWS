"""
PyTorch Dataset for exported PAWS pose sequences.

Loads from a dataset directory produced by the export pipeline:
  <dataset_dir>/
    manifest.jsonl
    sequences/<verification_id>.json
    splits.json

Label maps
----------
LABEL_MAP / LABEL_MAP_INV
    Binary pass/fail labels used for per-trick binary classifiers (e.g. the
    existing SitClassifier baseline).  The positive class (1) is "passed".

TRICK_LABEL_MAP / TRICK_LABEL_MAP_INV
    Multi-class labels for the generalized trick-detection model.
    Class 0 is always "no_action" so that the model can express "no trick
    was performed".  Tricks are numbered 1-N in alphabetical order of slug.

COMPLETION_LABEL_MAP
    Binary label for the "trick_completed" head in multi-task models.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.ml.preprocessing import (
    AGG_FEATURE_DIM,
    FRAME_DIM,
    PreprocessConfig,
    aggregate_features,
    preprocess_sequence,
)

# ---------------------------------------------------------------------------
# Label maps
# ---------------------------------------------------------------------------

# Binary pass/fail (used by the existing sit baseline and per-trick models).
LABEL_MAP: dict[str, int] = {"passed": 1, "failed": 0}
LABEL_MAP_INV: dict[int, str] = {v: k for k, v in LABEL_MAP.items()}

# Multi-class trick detection.  0 is reserved for "no_action".
TRICK_LABEL_MAP: dict[str, int] = {
    "no_action": 0,
    "down":      1,
    "paw":       2,
    "sit":       3,
    "spin":      4,
    "stand":     5,
    "stay":      6,
}
TRICK_LABEL_MAP_INV: dict[int, str] = {v: k for k, v in TRICK_LABEL_MAP.items()}

# Binary trick_completed label (used for multi-task heads).
COMPLETION_LABEL_MAP: dict[str, int] = {"passed": 1, "failed": 0}
COMPLETION_LABEL_MAP_INV: dict[int, str] = {v: k for k, v in COMPLETION_LABEL_MAP.items()}


def trick_to_label(trick: str) -> int:
    """Map a trick slug to its multi-class integer label (0 = no_action)."""
    return TRICK_LABEL_MAP.get(trick, 0)


def label_to_trick(label: int) -> str:
    """Map a multi-class integer label back to a trick slug."""
    return TRICK_LABEL_MAP_INV.get(label, "no_action")


# ---------------------------------------------------------------------------
# Dataset class
# ---------------------------------------------------------------------------


class TrickPoseDataset:
    """
    Iterable dataset that works as a drop-in for torch.utils.data.Dataset.
    Importing torch is deferred so this class can be instantiated for
    unit-testing preprocessing without torch installed.

    mode="sequence"   : returns (frames x FRAME_DIM) features — used by TCN
    mode="aggregate"  : returns (AGG_FEATURE_DIM,) features — used by MLP
    label_mode="binary"  : LABEL_MAP {"passed":1,"failed":0}
    label_mode="trick"   : TRICK_LABEL_MAP {"no_action":0,"sit":3,...}
    """

    def __init__(
        self,
        dataset_dir: str | Path,
        split: str,
        config: PreprocessConfig | None = None,
        mode: str = "sequence",       # "sequence" (TCN) or "aggregate" (MLP)
        label_mode: str = "binary",   # "binary" or "trick"
        tricks: list[str] | None = None,   # filter to specific tricks; None = all
    ) -> None:
        self._dir = Path(dataset_dir)
        self._split = split
        self._config = config or PreprocessConfig()
        self._mode = mode
        self._label_mode = label_mode
        self._tricks = set(tricks) if tricks else None
        self._items: list[dict] = []
        self._load()

    def _load(self) -> None:
        splits_path = self._dir / "splits.json"
        if not splits_path.exists():
            raise FileNotFoundError(f"splits.json not found in {self._dir}")

        splits = json.loads(splits_path.read_text())
        split_ids = set(splits.get(self._split, []))

        manifest_path = self._dir / "manifest.jsonl"
        for line in manifest_path.read_text().strip().splitlines():
            entry = json.loads(line)
            if entry["verification_id"] not in split_ids:
                continue

            trick = entry.get("trick", "sit")
            if self._tricks is not None and trick not in self._tricks:
                continue

            if self._label_mode == "binary":
                if entry["final_label"] not in LABEL_MAP:
                    continue   # skip ambiguous / invalid_recording
                label = LABEL_MAP[entry["final_label"]]
            else:
                # Multi-class: label is the trick class.
                # Ambiguous / invalid_recording items map to no_action (0).
                label = trick_to_label(trick) if entry["final_label"] == "passed" else 0

            seq_path = self._dir / entry["sequence_file"]
            if not seq_path.exists():
                continue
            seq_data = json.loads(seq_path.read_text())
            self._items.append({
                "verification_id": entry["verification_id"],
                "dog_id_hashed": entry["dog_id_hashed"],
                "trick": trick,
                "final_label": entry["final_label"],
                "label": label,
                "frames": seq_data.get("pose_sequence", []),
                "quality_flags": seq_data.get("quality_flags", {}),
                "pose_model_version": entry["pose_model_version"],
            })

    def __len__(self) -> int:
        return len(self._items)

    def get_numpy(self, index: int) -> tuple[np.ndarray, int, dict]:
        """Returns (features, label, meta) as numpy — no torch dependency."""
        item = self._items[index]
        frames = item["frames"]
        if self._mode == "aggregate":
            features = aggregate_features(frames, self._config)
            meta = {}
        else:
            features, meta = preprocess_sequence(frames, self._config)
        return features, item["label"], {**meta, **{k: item[k] for k in ("verification_id", "quality_flags")}}

    def __getitem__(self, index: int):
        """torch-compatible __getitem__ — requires torch."""
        import torch  # noqa: PLC0415
        features, label, _ = self.get_numpy(index)
        x = torch.from_numpy(features)
        if self._mode == "sequence":
            # TCN expects (channels, time) not (time, channels).
            x = x.permute(1, 0)   # (FRAME_DIM, seq_len)
        return x, torch.tensor(label, dtype=torch.long)

    @property
    def feature_dim(self) -> int:
        return AGG_FEATURE_DIM if self._mode == "aggregate" else FRAME_DIM

    @property
    def seq_len(self) -> int:
        return self._config.seq_len

    def class_weights(self) -> "torch.Tensor":
        """Returns class weights for imbalanced training (torch required)."""
        import torch  # noqa: PLC0415
        labels = [item["label"] for item in self._items]
        n = len(labels)
        n_pos = sum(labels)
        n_neg = n - n_pos
        if n_pos == 0 or n_neg == 0:
            return torch.ones(2)
        return torch.tensor([n / (2 * n_neg), n / (2 * n_pos)], dtype=torch.float32)


def make_dataloader(
    dataset: TrickPoseDataset,
    batch_size: int = 32,
    shuffle: bool = True,
):
    from torch.utils.data import DataLoader  # noqa: PLC0415
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle, num_workers=0)


# Backward-compatibility alias.  Existing training scripts that import
# SitPoseDataset continue to work without modification.
SitPoseDataset = TrickPoseDataset
