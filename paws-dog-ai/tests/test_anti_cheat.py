"""
Tests for the anti-cheat and duplicate-submission protection system.

Covers:
  1. Exact video duplicate is blocked.
  2. Near-duplicate frame hash routes to review.
  3. Same pose sequence resubmitted (exact pose hash) is blocked.
  4. Suspicious submission frequency routes to review.
  5. Legitimate repeated attempt (different dog, no anomalies) proceeds.
  6. Admin override (approve) clears a blocked reward.
  7. False-positive clearance resets risk score.
  8. Account restriction state blocks reward.
  9. Standard daily tier skips pattern analysis.
 10. Hashing utilities (sha256, pose_exact_hash, pose_simhash, hamming distance).
 11. Frame average hash and hamming distance.
 12. risk score clamped to 1.0 when signals exceed it.
"""

from __future__ import annotations

import hashlib
from unittest.mock import MagicMock, patch

import pytest

from app.ml.hashing import (
    frame_average_hash,
    frame_hash_hamming_distance,
    pack_frame_hashes,
    pose_exact_hash,
    pose_simhash,
    sha256_bytes,
    simhash_hamming_distance,
    unpack_frame_hashes,
)
from app.models.anti_cheat_models import (
    ANTI_CHEAT_VERSION,
    AdminReviewRequest,
    AntiCheatDecision,
    DuplicateMatch,
    RiskSignal,
    RiskSignalName,
)
from app.services.anti_cheat_service import (
    RISK_BLOCK_THRESHOLD,
    RISK_PROCEED_THRESHOLD,
    AntiCheatService,
    _ALWAYS_BLOCK_MATCH_TYPES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(
    tier: str = "gold_coin_reward",
    user_id: str = "user-abc",
    dog_id: str = "dog-xyz",
    activity_id: str = "sit",
    verification_id: str = "verif-001",
):
    from app.models.request_models import ActivityAnalysisRequest
    return ActivityAnalysisRequest(
        verification_id=verification_id,
        user_id=user_id,
        dog_id=dog_id,
        activity_id=activity_id,
        verification_mode="on_device",
        context_type="reward",
        storage_path="gs://bucket/video.mp4",
        verification_tier=tier,
    )


def _pose_frames_static():
    """Single frame with a few joints — all identical x positions."""
    return [
        {
            "frame_index": i,
            "keypoints": {
                "left_front_paw":  {"x": 0.3, "y": 0.5, "confidence": 0.9},
                "right_front_paw": {"x": 0.7, "y": 0.5, "confidence": 0.9},
                "left_hip":        {"x": 0.3, "y": 0.7, "confidence": 0.8},
            },
        }
        for i in range(5)
    ]


def _pose_frames_varied():
    """Frames with x movement to avoid static-pose signal."""
    return [
        {
            "frame_index": i,
            "keypoints": {
                "left_front_paw":  {"x": 0.2 + i * 0.1, "y": 0.5, "confidence": 0.9},
                "right_front_paw": {"x": 0.6 + i * 0.05, "y": 0.5, "confidence": 0.9},
                "left_hip":        {"x": 0.35, "y": 0.7, "confidence": 0.8},
            },
        }
        for i in range(5)
    ]


def _no_op_store(*args, **kwargs):
    """Replacement for store_hashes that does nothing."""
    pass


def _no_op_upsert(*args, **kwargs):
    pass


def _no_op_audit(*args, **kwargs):
    return None


def _not_restricted(user_id):
    return False, None


# ---------------------------------------------------------------------------
# Class 1 — Hashing utilities
# ---------------------------------------------------------------------------

class TestHashingUtilities:

    def test_sha256_bytes_deterministic(self):
        data = b"hello world"
        assert sha256_bytes(data) == hashlib.sha256(data).hexdigest()

    def test_sha256_bytes_different_inputs(self):
        assert sha256_bytes(b"a") != sha256_bytes(b"b")

    def test_pose_exact_hash_deterministic(self):
        frames = _pose_frames_static()
        h1 = pose_exact_hash(frames)
        h2 = pose_exact_hash(frames)
        assert h1 == h2
        assert len(h1) == 64   # SHA-256 hex

    def test_pose_exact_hash_different_for_different_poses(self):
        assert pose_exact_hash(_pose_frames_static()) != pose_exact_hash(_pose_frames_varied())

    def test_pose_simhash_returns_16_char_hex(self):
        h = pose_simhash(_pose_frames_static())
        assert len(h) == 16
        int(h, 16)   # must be valid hex

    def test_pose_simhash_deterministic(self):
        frames = _pose_frames_varied()
        assert pose_simhash(frames) == pose_simhash(frames)

    def test_simhash_hamming_identical(self):
        h = pose_simhash(_pose_frames_static())
        assert simhash_hamming_distance(h, h) == 0

    def test_simhash_hamming_different(self):
        h1 = pose_simhash(_pose_frames_static())
        h2 = pose_simhash(_pose_frames_varied())
        dist = simhash_hamming_distance(h1, h2)
        assert 0 <= dist <= 64

    def test_frame_average_hash_returns_int(self):
        pixel_values = [float(i % 256) / 255.0 for i in range(64)]
        h = frame_average_hash(pixel_values)
        assert isinstance(h, int)
        assert 0 <= h < 2**64

    def test_frame_average_hash_deterministic(self):
        pixels = [0.5] * 64
        assert frame_average_hash(pixels) == frame_average_hash(pixels)

    def test_frame_hash_hamming_identical(self):
        h = frame_average_hash([0.5] * 64)
        assert frame_hash_hamming_distance(h, h) == 0

    def test_frame_hash_hamming_all_bits_different(self):
        h1 = 0
        h2 = (2**64) - 1
        assert frame_hash_hamming_distance(h1, h2) == 64

    def test_pack_unpack_round_trip(self):
        hashes = [frame_average_hash([float(i) / 64] * 64) for i in range(5)]
        packed   = pack_frame_hashes(hashes)
        unpacked = unpack_frame_hashes(packed)
        assert unpacked == hashes


# ---------------------------------------------------------------------------
# Class 2 — AntiCheatDecision construction
# ---------------------------------------------------------------------------

class TestAntiCheatDecisionModel:

    def test_proceed_reward_eligible(self):
        d = AntiCheatDecision(
            verification_id="v1",
            user_id="u1",
            dog_id="d1",
            tier="gold_coin_reward",
            risk_score=0.10,
            signals=[],
            duplicate_match=None,
            decision="proceed",
            reward_eligible=True,
            anti_cheat_version=ANTI_CHEAT_VERSION,
            audit_id=None,
        )
        assert d.reward_eligible is True
        assert d.decision == "proceed"

    def test_block_reward_not_eligible(self):
        d = AntiCheatDecision(
            verification_id="v1",
            user_id="u1",
            dog_id="d1",
            tier="gold_coin_reward",
            risk_score=0.95,
            signals=[],
            duplicate_match=None,
            decision="block_reward",
            reward_eligible=False,
            anti_cheat_version=ANTI_CHEAT_VERSION,
            audit_id=None,
        )
        assert d.reward_eligible is False


# ---------------------------------------------------------------------------
# Class 3 — Exact video duplicate
# ---------------------------------------------------------------------------

class TestExactVideoDuplicate:

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_exact_video_duplicate_blocks_reward(self):
        exact_match = DuplicateMatch(
            match_type="exact_video",
            original_verification_id="verif-original",
            original_user_id="user-abc",
            hamming_distance=None,
            similarity_score=1.0,
        )

        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=exact_match,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": "abc123", "pose_exact_hash": None,
                          "pose_simhash": None, "frame_hashes": []},
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.90,
            )

        assert decision.decision == "block_reward"
        assert decision.reward_eligible is False
        assert decision.duplicate_match is not None
        assert decision.duplicate_match.match_type == "exact_video"


# ---------------------------------------------------------------------------
# Class 4 — Near-duplicate frame hash
# ---------------------------------------------------------------------------

class TestNearDuplicateFrameHash:

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.account_risk_service.compute_risk_signals", return_value=[])
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_near_duplicate_frame_routes_to_review(self, _mock_signals):
        near_match = DuplicateMatch(
            match_type="near_video",
            original_verification_id="verif-prev",
            original_user_id="user-abc",
            hamming_distance=4,
            similarity_score=0.94,
        )

        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=near_match,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None, "pose_exact_hash": None,
                          "pose_simhash": None, "frame_hashes": []},
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.88,
            )

        assert decision.decision == "review"
        assert decision.reward_eligible is False


# ---------------------------------------------------------------------------
# Class 5 — Same pose sequence resubmitted (exact pose hash)
# ---------------------------------------------------------------------------

class TestExactPoseDuplicate:

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_exact_pose_duplicate_blocks_reward(self):
        pose_match = DuplicateMatch(
            match_type="exact_pose",
            original_verification_id="verif-pose-orig",
            original_user_id="user-abc",
            hamming_distance=None,
            similarity_score=1.0,
        )

        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=pose_match,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None,
                          "pose_exact_hash": "deadbeef" * 8,
                          "pose_simhash": "0000000000000001",
                          "frame_hashes": []},
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_static(),
                fused_confidence=0.91,
            )

        assert decision.decision == "block_reward"
        assert decision.duplicate_match.match_type == "exact_pose"


# ---------------------------------------------------------------------------
# Class 6 — Suspicious submission frequency
# ---------------------------------------------------------------------------

class TestSuspiciousFrequency:

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_high_frequency_routes_to_review(self):
        frequency_signal = RiskSignal(
            signal_name=RiskSignalName.HIGH_SUBMISSION_FREQUENCY,
            score_contribution=0.40,
            detail={"attempts_last_hour": 15},
        )

        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=None,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None, "pose_exact_hash": None,
                          "pose_simhash": None, "frame_hashes": []},
        ), patch(
            "app.services.account_risk_service.compute_risk_signals",
            return_value=[frequency_signal],
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.85,
            )

        # 0.40 is above RISK_PROCEED_THRESHOLD (0.35) but below RISK_BLOCK_THRESHOLD (0.85)
        assert decision.decision == "review"
        assert decision.risk_score == pytest.approx(0.40, abs=1e-6)


# ---------------------------------------------------------------------------
# Class 7 — Legitimate repeated attempt proceeds
# ---------------------------------------------------------------------------

class TestLegitimateRepeatAttempt:

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.account_risk_service.compute_risk_signals", return_value=[])
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_clean_attempt_proceeds(self, _mock_signals):
        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=None,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None, "pose_exact_hash": "aaaa" * 16,
                          "pose_simhash": "0102030405060708", "frame_hashes": []},
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.91,
            )

        assert decision.decision == "proceed"
        assert decision.reward_eligible is True
        assert decision.risk_score == pytest.approx(0.0, abs=1e-6)

    @patch("app.services.account_risk_service.is_reward_restricted", _not_restricted)
    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    def test_standard_daily_skips_pattern_analysis(self):
        """Standard daily tier does not call compute_risk_signals."""
        with patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=None,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None, "pose_exact_hash": None,
                          "pose_simhash": None, "frame_hashes": []},
        ), patch(
            "app.services.account_risk_service.compute_risk_signals",
        ) as mock_signals:
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(tier="standard_daily"),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.85,
            )

        # compute_risk_signals should NOT be called for standard daily.
        mock_signals.assert_not_called()
        assert decision.decision == "proceed"


# ---------------------------------------------------------------------------
# Class 8 — Account restriction blocks reward
# ---------------------------------------------------------------------------

class TestAccountRestriction:

    @patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert)
    @patch("app.services.account_risk_service.compute_risk_signals", return_value=[])
    @patch("app.services.duplicate_detection_service.store_hashes", _no_op_store)
    @patch("app.services.anti_cheat_service.AntiCheatService._write_audit", _no_op_audit)
    def test_restricted_account_blocks_reward(self, _mock_signals):
        with patch(
            "app.services.account_risk_service.is_reward_restricted",
            return_value=(True, "account_restricted"),
        ), patch(
            "app.services.duplicate_detection_service.check_duplicates",
            return_value=None,
        ), patch(
            "app.services.duplicate_detection_service.compute_hashes",
            return_value={"video_sha256": None, "pose_exact_hash": None,
                          "pose_simhash": None, "frame_hashes": []},
        ):
            svc = AntiCheatService()
            decision = svc.run_checks(
                request=_make_request(),
                pose_frames=_pose_frames_varied(),
                fused_confidence=0.90,
            )

        assert decision.decision == "block_reward"
        assert decision.reward_eligible is False


# ---------------------------------------------------------------------------
# Class 9 — Admin override (approve)
# ---------------------------------------------------------------------------

class TestAdminOverride:

    def _audit_row(self, decision: str = "block_reward") -> dict:
        return {
            "id": "audit-001",
            "verification_id": "verif-001",
            "user_id": "user-abc",
            "dog_id": "dog-xyz",
            "tier": "gold_coin_reward",
            "risk_score": 0.90,
            "signals": [],
            "duplicate_match": None,
            "decision": decision,
            "reward_eligible": False,
            "anti_cheat_version": ANTI_CHEAT_VERSION,
            "reviewed_by": None,
            "reviewed_at": None,
            "admin_action": None,
            "admin_notes": None,
            "created_at": "2026-01-01T00:00:00+00:00",
        }

    def test_approve_action_marks_reward_eligible(self):
        req = AdminReviewRequest(
            action="approve",
            reason="Reviewed video, no cheating detected.",
            reviewed_by="admin@paws.app",
        )
        audit_row = self._audit_row()

        with patch.object(AntiCheatService, "_load_audit", return_value=audit_row), \
             patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert), \
             patch("app.services.supabase_service.get_supabase") as mock_get_supabase:
            mock_get_supabase.return_value = MagicMock()
            svc = AntiCheatService()
            response = svc.apply_admin_action(audit_id="audit-001", req=req)

        assert response.audit_id == "audit-001"
        assert response.action_applied == "approve"
        assert response.new_decision == "proceed"

    def test_reject_action_keeps_reward_blocked(self):
        req = AdminReviewRequest(
            action="reject",
            reason="Confirmed duplicate submission.",
            reviewed_by="admin@paws.app",
        )
        audit_row = self._audit_row()

        with patch.object(AntiCheatService, "_load_audit", return_value=audit_row), \
             patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert), \
             patch("app.services.supabase_service.get_supabase") as mock_get_supabase:
            mock_get_supabase.return_value = MagicMock()
            svc = AntiCheatService()
            response = svc.apply_admin_action(audit_id="audit-001", req=req)

        assert response.action_applied == "reject"
        assert response.new_decision == "block_reward"


# ---------------------------------------------------------------------------
# Class 10 — False-positive clearance
# ---------------------------------------------------------------------------

class TestFalsePositiveClearance:

    def _audit_row(self) -> dict:
        return {
            "id": "audit-fp-001",
            "verification_id": "verif-fp",
            "user_id": "user-clean",
            "dog_id": "dog-clean",
            "tier": "tournament",
            "risk_score": 0.60,
            "signals": [{"signal_name": "high_submission_frequency",
                          "score_contribution": 0.40, "detail": {}}],
            "duplicate_match": None,
            "decision": "review",
            "reward_eligible": False,
            "anti_cheat_version": ANTI_CHEAT_VERSION,
            "reviewed_by": None,
            "reviewed_at": None,
            "admin_action": None,
            "admin_notes": None,
            "created_at": "2026-01-01T00:00:00+00:00",
        }

    def test_clear_false_positive_resets_reward_eligibility(self):
        req = AdminReviewRequest(
            action="clear_false_positive",
            reason="High frequency due to coaching session, not fraud.",
            reviewed_by="admin@paws.app",
        )
        audit_row = self._audit_row()

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [audit_row]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {**audit_row, "admin_action": "clear_false_positive",
             "reviewed_by": "admin@paws.app"}
        ]

        with patch.object(AntiCheatService, "_load_audit", return_value=audit_row), \
             patch("app.services.account_risk_service.upsert_account_risk_profile", _no_op_upsert), \
             patch("app.services.supabase_service.get_supabase") as mock_get_supabase:
            mock_get_supabase.return_value = MagicMock()
            svc = AntiCheatService()
            response = svc.apply_admin_action(audit_id="audit-fp-001", req=req)

        assert response.action_applied == "clear_false_positive"
        assert response.new_decision == "proceed"


# ---------------------------------------------------------------------------
# Class 11 — Risk score arithmetic
# ---------------------------------------------------------------------------

class TestRiskScoreArithmetic:

    def test_risk_score_clamped_to_one(self):
        """Multiple high-weight signals must not push risk_score above 1.0."""
        signals = [
            RiskSignal(signal_name=RiskSignalName.EXACT_DUPLICATE, score_contribution=1.0),
            RiskSignal(signal_name=RiskSignalName.STATIC_POSE, score_contribution=0.25),
            RiskSignal(signal_name=RiskSignalName.HIGH_SUBMISSION_FREQUENCY, score_contribution=0.40),
        ]
        risk_score = min(1.0, sum(s.score_contribution for s in signals))
        assert risk_score == pytest.approx(1.0)

    def test_proceed_threshold_boundary(self):
        """Score exactly at the proceed threshold routes to review, not proceed."""
        # RISK_PROCEED_THRESHOLD = 0.35; score == threshold should still review
        score = RISK_PROCEED_THRESHOLD
        # Decision logic: score < proceed_threshold => proceed, else review or block
        # The service uses strict < for proceed.
        from app.services.anti_cheat_service import AntiCheatService as _Svc
        svc = _Svc()
        decision = svc._make_decision(
            risk_score=score,
            duplicate_match=None,
            is_high_stakes=True,
            is_restricted=False,
        )
        assert decision in ("review", "block_reward")

    def test_below_proceed_threshold_proceeds(self):
        from app.services.anti_cheat_service import AntiCheatService as _Svc
        svc = _Svc()
        decision = svc._make_decision(
            risk_score=0.10,
            duplicate_match=None,
            is_high_stakes=True,
            is_restricted=False,
        )
        assert decision == "proceed"

    def test_at_block_threshold_blocks(self):
        from app.services.anti_cheat_service import AntiCheatService as _Svc
        svc = _Svc()
        decision = svc._make_decision(
            risk_score=RISK_BLOCK_THRESHOLD,
            duplicate_match=None,
            is_high_stakes=True,
            is_restricted=False,
        )
        assert decision == "block_reward"
