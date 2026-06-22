"""
Duplicate detection service.

Computes submission hashes for a verification attempt, stores them, and
checks for exact or near-duplicate matches against prior submissions.

Three levels of matching:

  exact_video
      SHA-256 of the raw video bytes.  Catches byte-identical re-uploads.

  exact_pose / near_pose
      SHA-256 (exact) or SimHash Hamming distance (near) on the normalized
      pose sequence.  Catches replayed recordings and slight crop variants.

  cross_account_video / cross_account_pose
      The same video or pose hash submitted by a different user_id.  This
      is the strongest fraud indicator.

Hash computation is pure-function (in hashing.py).  All DB access is in
this file and is isolated behind try/except so callers never crash.
"""

from __future__ import annotations

from app.ml.hashing import (
    frame_hash_hamming_distance,
    pack_frame_hashes,
    pose_exact_hash,
    pose_simhash,
    sha256_bytes,
    simhash_hamming_distance,
    unpack_frame_hashes,
)
from app.models.anti_cheat_models import DuplicateMatch
from app.utils.logging import log_error, log_info

# Hamming distance thresholds for "near-duplicate" classification.
POSE_SIMHASH_NEAR_DUPLICATE_BITS = 10   # out of 64
FRAME_HASH_NEAR_DUPLICATE_BITS   = 10   # out of 64


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_hashes(
    frames: list[dict],
    video_bytes: bytes | None,
    selected_frame_pixel_lists: list[list[float]] | None,
) -> dict:
    """
    Compute all submission hashes for the given data.

    Parameters
    ----------
    frames:
        Pose sequence frames in the format stored in pose_sequences.frames.
    video_bytes:
        Raw video bytes, or None when raw video is not retained.
    selected_frame_pixel_lists:
        List of 64-float greyscale thumbnail pixel lists (one per selected
        RGB frame).  None or empty when no frames are available.

    Returns a dict suitable for inserting into submission_hashes.
    """
    from app.ml.hashing import frame_average_hash  # noqa: PLC0415

    hashes: dict = {
        "video_sha256": None,
        "frame_hashes": [],
        "pose_exact_hash": None,
        "pose_simhash": None,
    }

    if video_bytes:
        hashes["video_sha256"] = sha256_bytes(video_bytes)

    if frames:
        hashes["pose_exact_hash"] = pose_exact_hash(frames)
        hashes["pose_simhash"] = pose_simhash(frames)

    if selected_frame_pixel_lists:
        raw = []
        for pixels in selected_frame_pixel_lists:
            if len(pixels) == 64:
                raw.append(frame_average_hash(pixels))
        hashes["frame_hashes"] = pack_frame_hashes(raw)

    return hashes


def store_hashes(
    verification_id: str,
    user_id: str,
    dog_id: str,
    activity_id: str,
    hashes: dict,
) -> None:
    """
    Insert a submission_hashes row.  Silently ignores failures.
    """
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        client.table("submission_hashes").insert({
            "verification_id": verification_id,
            "user_id": user_id,
            "dog_id": dog_id,
            "activity_id": activity_id,
            "video_sha256": hashes.get("video_sha256"),
            "frame_hashes": hashes.get("frame_hashes") or [],
            "pose_exact_hash": hashes.get("pose_exact_hash"),
            "pose_simhash": hashes.get("pose_simhash"),
        }).execute()
        log_info(
            "duplicate_detection",
            "hashes_stored",
            verification_id=verification_id,
            has_video=hashes.get("video_sha256") is not None,
            has_pose=hashes.get("pose_exact_hash") is not None,
        )
    except Exception as exc:  # noqa: BLE001
        log_error(
            "duplicate_detection",
            "hash_store_failed",
            verification_id=verification_id,
            error=str(exc),
        )


def check_duplicates(
    hashes: dict,
    user_id: str,
    activity_id: str,
    current_verification_id: str,
) -> DuplicateMatch | None:
    """
    Query submission_hashes for matching hashes and return the first match.

    Returns None when no duplicate is found or when the DB is unavailable.
    Exact matches are returned before near-duplicate matches.
    Cross-account matches (same hash, different user) are returned first.
    """
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()

        # --- 1. Exact video duplicate ---
        video_hash = hashes.get("video_sha256")
        if video_hash:
            rows = (
                client.table("submission_hashes")
                .select("verification_id, user_id")
                .eq("video_sha256", video_hash)
                .eq("activity_id", activity_id)
                .neq("verification_id", current_verification_id)
                .limit(1)
                .execute()
                .data or []
            )
            if rows:
                orig_user = rows[0]["user_id"]
                match_type = (
                    "cross_account_video" if orig_user != user_id else "exact_video"
                )
                return DuplicateMatch(
                    match_type=match_type,
                    original_verification_id=rows[0]["verification_id"],
                    original_user_id=orig_user,
                    hamming_distance=0,
                    similarity_score=1.0,
                )

        # --- 2. Exact pose duplicate ---
        exact_pose = hashes.get("pose_exact_hash")
        if exact_pose:
            rows = (
                client.table("submission_hashes")
                .select("verification_id, user_id")
                .eq("pose_exact_hash", exact_pose)
                .eq("activity_id", activity_id)
                .neq("verification_id", current_verification_id)
                .limit(1)
                .execute()
                .data or []
            )
            if rows:
                orig_user = rows[0]["user_id"]
                match_type = (
                    "cross_account_pose" if orig_user != user_id else "exact_pose"
                )
                return DuplicateMatch(
                    match_type=match_type,
                    original_verification_id=rows[0]["verification_id"],
                    original_user_id=orig_user,
                    hamming_distance=0,
                    similarity_score=1.0,
                )

        # --- 3. Near-duplicate pose (SimHash) ---
        sim_hash = hashes.get("pose_simhash")
        if sim_hash:
            match = _check_near_duplicate_pose(
                client, sim_hash, user_id, activity_id, current_verification_id
            )
            if match:
                return match

        # --- 4. Near-duplicate frame hashes ---
        frame_hashes = unpack_frame_hashes(hashes.get("frame_hashes") or [])
        if frame_hashes:
            match = _check_near_duplicate_frames(
                client, frame_hashes, user_id, activity_id, current_verification_id
            )
            if match:
                return match

        return None

    except Exception as exc:  # noqa: BLE001
        log_error(
            "duplicate_detection",
            "check_failed",
            current_verification_id=current_verification_id,
            error=str(exc),
        )
        return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _check_near_duplicate_pose(
    client,
    sim_hash: str,
    user_id: str,
    activity_id: str,
    current_verification_id: str,
) -> DuplicateMatch | None:
    """
    Fetch recent pose SimHashes for the same activity and check Hamming
    distance.  Returns the first match within the threshold.

    Scans only the most recent 500 hashes to bound the query cost.
    """
    rows = (
        client.table("submission_hashes")
        .select("verification_id, user_id, pose_simhash")
        .eq("activity_id", activity_id)
        .neq("verification_id", current_verification_id)
        .not_.is_("pose_simhash", "null")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data or []
    )
    for row in rows:
        other_hash = row.get("pose_simhash")
        if not other_hash:
            continue
        try:
            dist = simhash_hamming_distance(sim_hash, other_hash)
        except (ValueError, TypeError):
            continue
        if dist <= POSE_SIMHASH_NEAR_DUPLICATE_BITS:
            orig_user = row["user_id"]
            match_type = (
                "cross_account_pose" if orig_user != user_id else "near_pose"
            )
            similarity = 1.0 - dist / 64.0
            return DuplicateMatch(
                match_type=match_type,
                original_verification_id=row["verification_id"],
                original_user_id=orig_user,
                hamming_distance=dist,
                similarity_score=round(similarity, 4),
            )
    return None


def _check_near_duplicate_frames(
    client,
    frame_hashes: list[int],
    user_id: str,
    activity_id: str,
    current_verification_id: str,
) -> DuplicateMatch | None:
    """
    Fetch recent frame hash arrays and compare.  A submission is considered
    a near-duplicate frame match if >= 2 of its frames match within threshold.
    """
    rows = (
        client.table("submission_hashes")
        .select("verification_id, user_id, frame_hashes")
        .eq("activity_id", activity_id)
        .neq("verification_id", current_verification_id)
        .not_.is_("frame_hashes", "null")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
        .data or []
    )
    for row in rows:
        stored_raw = row.get("frame_hashes") or []
        if not stored_raw:
            continue
        try:
            stored = unpack_frame_hashes(stored_raw)
        except (ValueError, TypeError):
            continue

        matching_frames = 0
        for fh in frame_hashes:
            for sh in stored:
                if frame_hash_hamming_distance(fh, sh) <= FRAME_HASH_NEAR_DUPLICATE_BITS:
                    matching_frames += 1
                    break

        if matching_frames >= 2:
            orig_user = row["user_id"]
            match_type = (
                "cross_account_video" if orig_user != user_id else "near_video"
            )
            similarity = matching_frames / max(len(frame_hashes), 1)
            return DuplicateMatch(
                match_type=match_type,
                original_verification_id=row["verification_id"],
                original_user_id=orig_user,
                hamming_distance=None,
                similarity_score=round(similarity, 4),
            )
    return None
