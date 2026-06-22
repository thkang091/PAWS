"""
Grouped train / val / test split by anonymized dog ID.

A dog must never appear in more than one split.
Splits are assigned deterministically by sorting dogs by their hashed ID
and assigning consecutive buckets according to the requested ratios.
"""

from app.models.dataset_models import DatasetSample, DatasetSplits


def grouped_split(
    samples: list[DatasetSample],
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
) -> DatasetSplits:
    if abs(train_ratio + val_ratio + test_ratio - 1.0) > 1e-6:
        raise ValueError(
            f"Ratios must sum to 1.0, got {train_ratio + val_ratio + test_ratio:.4f}"
        )

    # Collect unique dogs in deterministic order.
    dogs = sorted({s.dog_id_hashed for s in samples})
    n = len(dogs)

    train_end = int(round(n * train_ratio))
    val_end = train_end + int(round(n * val_ratio))

    train_dogs = set(dogs[:train_end])
    val_dogs = set(dogs[train_end:val_end])
    test_dogs = set(dogs[val_end:])

    train_ids: list[str] = []
    val_ids: list[str] = []
    test_ids: list[str] = []

    for sample in samples:
        if sample.dog_id_hashed in train_dogs:
            train_ids.append(sample.verification_id)
        elif sample.dog_id_hashed in val_dogs:
            val_ids.append(sample.verification_id)
        else:
            test_ids.append(sample.verification_id)

    return DatasetSplits(train=train_ids, val=val_ids, test=test_ids)


def split_label(splits: DatasetSplits, verification_id: str) -> str:
    if verification_id in splits.train:
        return "train"
    if verification_id in splits.val:
        return "val"
    return "test"
