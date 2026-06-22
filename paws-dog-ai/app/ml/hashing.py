"""
Content-hashing utilities for duplicate detection.

Three hash types are produced per submission:

  video_sha256
      SHA-256 of the raw video bytes.  Exact match only.  Used when
      raw video is retained.

  pose_exact_hash
      SHA-256 of a quantized, normalized pose sequence.  Coordinates are
      rounded to 2 decimal places so minor floating-point differences
      between two runs of the same recording do not break the match.
      Catches byte-for-byte replays of an identical recording.

  pose_simhash
      64-bit SimHash over the normalized keypoint positions weighted by
      confidence.  Near-duplicate pose sequences (same dog, same trick,
      slight camera shift) produce hashes with small Hamming distance.
      Threshold of <= 10 bits distinguishes near-duplicate from genuine
      novel attempt.

  frame_average_hashes
      List of 64-bit average-hash integers, one per selected RGB frame.
      Each hash encodes the luminance pattern of an 8x8 thumbnail.
      Near-duplicate frames score Hamming distance <= 10.

All functions are pure (no I/O, no DB calls) and work on plain Python
data structures so they are easy to test and call from async contexts.
"""

from __future__ import annotations

import hashlib
import struct


# ---------------------------------------------------------------------------
# Video hash
# ---------------------------------------------------------------------------

def sha256_bytes(data: bytes) -> str:
    """Return lowercase hex SHA-256 of arbitrary bytes."""
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Pose exact hash
# ---------------------------------------------------------------------------

# Canonical joint order used when serializing pose frames to ensure the hash
# is stable regardless of dict iteration order.
_CANONICAL_JOINTS = (
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "tail_base",
    "left_front_paw",
    "right_front_paw",
    "left_hind_paw",
    "right_hind_paw",
)


def pose_exact_hash(frames: list[dict]) -> str:
    """
    SHA-256 of a quantized pose sequence.

    Each frame is serialized as:
        frame_index | joint_name:x,y,conf | ...

    Coordinates are rounded to 2 decimal places; confidence to 2 decimal
    places.  Missing joints are written as zeroes so the length of the
    representation is constant across recordings of the same trick.

    Parameters
    ----------
    frames:
        List of frame dicts in the format stored in pose_sequences.frames:
        [{frame_index, timestamp_ms, keypoints: {name: {x, y, confidence}}}]
    """
    parts: list[str] = []
    for frame in frames:
        idx = frame.get("frame_index", 0)
        kps: dict = frame.get("keypoints") or {}
        joints: list[str] = []
        for name in _CANONICAL_JOINTS:
            kp = kps.get(name) or {}
            x = round(float(kp.get("x") or 0.0), 2)
            y = round(float(kp.get("y") or 0.0), 2)
            c = round(float(kp.get("confidence") or 0.0), 2)
            joints.append(f"{name}:{x:.2f},{y:.2f},{c:.2f}")
        parts.append(f"{idx}|{'|'.join(joints)}")
    payload = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ---------------------------------------------------------------------------
# Pose SimHash (near-duplicate)
# ---------------------------------------------------------------------------

_SIMHASH_BITS = 64


def pose_simhash(frames: list[dict]) -> str:
    """
    64-bit SimHash of normalized keypoint positions.

    For each visible joint in each frame, quantize (x, y) at three
    resolution levels and generate a feature token.  Each token is hashed
    with MD5; the resulting bit pattern votes +/- on 64 accumulator buckets
    weighted by the keypoint confidence.  The sign of each bucket becomes
    the corresponding SimHash bit.

    Near-duplicate pose sequences (same motion with small positional noise
    from a slightly different camera angle or minor re-encoding) produce
    hashes with Hamming distance <= 10.

    Returns a 16-character lowercase hex string representing the 64-bit hash.
    """
    v = [0.0] * _SIMHASH_BITS

    for frame in frames:
        kps: dict = frame.get("keypoints") or {}
        for name in sorted(kps.keys()):
            kp = kps.get(name) or {}
            x = float(kp.get("x") or 0.0)
            y = float(kp.get("y") or 0.0)
            conf = float(kp.get("confidence") or 0.0)
            if conf < 0.30:
                continue
            # Three quantization scales for locality sensitivity.
            for scale in (4, 8, 16):
                token = f"{name}:{int(x * scale)}:{int(y * scale)}"
                h = int(hashlib.md5(token.encode()).hexdigest(), 16)
                for bit in range(_SIMHASH_BITS):
                    weight = conf
                    if h & (1 << bit):
                        v[bit] += weight
                    else:
                        v[bit] -= weight

    result = 0
    for bit in range(_SIMHASH_BITS):
        if v[bit] >= 0.0:
            result |= 1 << bit

    return format(result, "016x")


def simhash_hamming_distance(h1: str, h2: str) -> int:
    """
    Bit-level Hamming distance between two SimHash hex strings.

    Parameters
    ----------
    h1, h2:
        16-character lowercase hex strings as returned by pose_simhash().
    """
    v1 = int(h1, 16)
    v2 = int(h2, 16)
    xor = v1 ^ v2
    # Kernighan's bit-count.
    count = 0
    while xor:
        xor &= xor - 1
        count += 1
    return count


# ---------------------------------------------------------------------------
# Frame average hash (perceptual)
# ---------------------------------------------------------------------------

def frame_average_hash(pixel_values: list[float]) -> int:
    """
    64-bit average hash of a greyscale 8x8 thumbnail.

    Each bit is 1 if the corresponding pixel is >= the mean pixel value,
    0 otherwise.  Near-duplicate frames (same scene with minor compression
    artefacts or slight crop) produce hashes with Hamming distance <= 10.

    Parameters
    ----------
    pixel_values:
        Exactly 64 floating-point values in [0, 255] representing the 8x8
        greyscale thumbnail, in row-major order.
    """
    if len(pixel_values) != 64:
        raise ValueError(
            f"frame_average_hash requires exactly 64 pixel values, got {len(pixel_values)}."
        )
    mean = sum(pixel_values) / 64.0
    result = 0
    for i, p in enumerate(pixel_values):
        if p >= mean:
            result |= 1 << i
    return result


def frame_hash_hamming_distance(h1: int, h2: int) -> int:
    """Bit-level Hamming distance between two 64-bit frame hashes."""
    xor = h1 ^ h2
    count = 0
    while xor:
        xor &= xor - 1
        count += 1
    return count


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def pack_frame_hashes(hashes: list[int]) -> list[str]:
    """Convert a list of 64-bit frame hash integers to hex strings for JSON storage."""
    return [format(h, "016x") for h in hashes]


def unpack_frame_hashes(hex_strings: list[str]) -> list[int]:
    """Convert hex strings back to 64-bit integers."""
    return [int(h, 16) for h in hex_strings]
