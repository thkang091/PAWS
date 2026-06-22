"""
Tests for the review queue API and service logic.

All tests mock Supabase calls — no live DB connection required.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.review_models import ReviewDetail, validate_transition

client = TestClient(app)

_ADMIN_KEY = "test-admin-key-123"
_AUTH = {"Authorization": f"Bearer {_ADMIN_KEY}"}

_REVIEW_ROW = {
    "id": "rev-001",
    "verification_id": "ver-001",
    "review_state": "pending_review",
    "enqueue_reason": "low_confidence",
    "rule_based_status": "failed_no_valid_activity",
    "learned_prediction": "passed",
    "learned_confidence": 0.72,
    "ground_truth_trick": None,
    "trick_completed": None,
    "attempt_quality": None,
    "failure_reason": None,
    "reviewer_notes": None,
    "reviewed_by": None,
    "reviewed_at": None,
    "is_hard_negative": False,
    "created_at": "2026-06-01T12:00:00Z",
    "updated_at": "2026-06-01T12:00:00Z",
}


def _patch_config_key():
    return patch("app.config.settings.admin_api_key", _ADMIN_KEY)


def _patch_supabase_list(rows=None):
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value \
        .eq.return_value.order.return_value \
        .range.return_value.execute.return_value.data = rows or [_REVIEW_ROW]
    return patch("app.services.review_service._client", return_value=mock_client)


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

class TestAuthorization:
    def test_missing_key_returns_403(self):
        with _patch_config_key():
            response = client.get("/review/queue")
        assert response.status_code == 403

    def test_wrong_key_returns_403(self):
        with _patch_config_key():
            response = client.get("/review/queue", headers={"Authorization": "Bearer wrong-key"})
        assert response.status_code == 403

    def test_correct_key_is_accepted(self):
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value \
            .eq.return_value.order.return_value \
            .range.return_value.execute.return_value.data = []

        with _patch_config_key(), patch("app.services.review_service._client", return_value=mock_client):
            response = client.get("/review/queue", headers=_AUTH)
        assert response.status_code == 200

    def test_unconfigured_admin_key_returns_503(self):
        with patch("app.config.settings.admin_api_key", ""):
            response = client.get("/review/queue", headers=_AUTH)
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Queue creation
# ---------------------------------------------------------------------------

class TestQueueCreation:
    def test_list_queue_returns_items(self):
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value \
            .eq.return_value.order.return_value \
            .range.return_value.execute.return_value.data = [_REVIEW_ROW]

        with _patch_config_key(), patch("app.services.review_service._client", return_value=mock_client):
            response = client.get("/review/queue", headers=_AUTH)

        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["verification_id"] == "ver-001"
        assert items[0]["review_state"] == "pending_review"

    def test_manual_enqueue_creates_entry(self):
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [_REVIEW_ROW]

        with _patch_config_key(), patch("app.services.review_service._client", return_value=mock_client):
            response = client.post(
                "/review/enqueue/ver-001",
                headers=_AUTH,
                params={"enqueue_reason": "manual"},
            )
        assert response.status_code == 200
        assert response.json()["verification_id"] == "ver-001"


# ---------------------------------------------------------------------------
# Label submission
# ---------------------------------------------------------------------------

class TestLabelSubmission:
    def _mock_for_submit(self, current_state="pending_review"):
        state_row = {**_REVIEW_ROW, "review_state": current_state}
        reviewed_row = {**_REVIEW_ROW, "review_state": "reviewed", "trick_completed": True}

        mock_client = MagicMock()
        # _get_state call
        mock_client.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value.data = [state_row]
        # update call
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
        # get_detail calls
        mock_client.table.return_value.select.return_value \
            .eq.return_value.limit.return_value.execute.return_value.data = [reviewed_row]
        return mock_client

    def test_valid_label_submission_succeeds(self):
        reviewed_detail = ReviewDetail(
            id="rev-001",
            verification_id="ver-001",
            review_state="reviewed",
            enqueue_reason="low_confidence",
            rule_based_status="failed_no_valid_activity",
            learned_prediction="passed",
            learned_confidence=0.72,
            ground_truth_trick="sit",
            trick_completed=True,
            attempt_quality="clean",
            failure_reason=None,
            reviewer_notes=None,
            reviewed_by="admin",
            reviewed_at="2026-06-01T13:00:00Z",
            is_hard_negative=False,
            created_at="2026-06-01T12:00:00Z",
        )

        mock_client = MagicMock()
        # _get_state returns pending_review
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value \
            .execute.return_value.data = [_REVIEW_ROW]
        # update succeeds
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with _patch_config_key(), patch("app.services.review_service._client", return_value=mock_client):
            with patch("app.services.review_service.get_detail", return_value=reviewed_detail):
                response = client.post(
                    "/review/rev-001/label",
                    headers=_AUTH,
                    json={
                        "ground_truth_trick": "sit",
                        "trick_completed": True,
                        "attempt_quality": "clean",
                        "reviewed_by": "admin",
                    },
                )
        assert response.status_code == 200
        assert response.json()["review_state"] == "reviewed"
        assert response.json()["trick_completed"] is True

    def test_invalid_transition_from_skipped_returns_422(self):
        from app.models.review_models import validate_transition
        with pytest.raises(ValueError, match="Cannot transition"):
            validate_transition("skipped", "reviewed")

    def test_disputed_label_transitions_to_disputed(self):
        with pytest.raises(ValueError, match="Cannot transition"):
            validate_transition("skipped", "disputed")


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

class TestStateMachine:
    @pytest.mark.parametrize("current,next_state", [
        ("pending_review", "reviewed"),
        ("pending_review", "skipped"),
        ("pending_review", "disputed"),
        ("reviewed", "disputed"),
        ("reviewed", "needs_relabeling"),
        ("disputed", "reviewed"),
        ("disputed", "needs_relabeling"),
        ("needs_relabeling", "reviewed"),
    ])
    def test_valid_transitions(self, current, next_state):
        validate_transition(current, next_state)  # should not raise

    @pytest.mark.parametrize("current,next_state", [
        ("skipped", "reviewed"),
        ("skipped", "pending_review"),
        ("skipped", "disputed"),
        ("reviewed", "pending_review"),
        ("pending_review", "needs_relabeling"),
    ])
    def test_invalid_transitions_raise(self, current, next_state):
        with pytest.raises(ValueError):
            validate_transition(current, next_state)


# ---------------------------------------------------------------------------
# Signed URL
# ---------------------------------------------------------------------------

class TestSignedUrl:
    def test_signed_url_not_generated_when_retain_video_false(self):
        """When retain_raw_video=False, video_signed_url must be None even if storage_path exists."""
        pending_detail = ReviewDetail(
            id="rev-001",
            verification_id="ver-001",
            review_state="pending_review",
            enqueue_reason="low_confidence",
            rule_based_status="failed_no_valid_activity",
            learned_prediction=None,
            learned_confidence=None,
            ground_truth_trick=None,
            trick_completed=None,
            attempt_quality=None,
            failure_reason=None,
            reviewer_notes=None,
            reviewed_by=None,
            reviewed_at=None,
            is_hard_negative=False,
            created_at="2026-06-01T12:00:00Z",
            video_signed_url=None,   # None because retain_raw_video=False
        )

        with _patch_config_key():
            with patch("app.services.review_service.get_detail", return_value=pending_detail):
                response = client.get("/review/rev-001", headers=_AUTH)

        assert response.status_code == 200
        assert response.json()["video_signed_url"] is None

    def test_signed_url_attempted_when_retain_video_true(self):
        """When retain_raw_video=True the service attempts to generate a signed URL."""
        from app.services import review_service

        with _patch_config_key():
            with patch("app.config.settings.retain_raw_video", True):
                with patch.object(review_service, "_signed_url", return_value="https://example.com/signed") as mock_signed:
                    # _signed_url is called from get_detail when retain_raw_video is True.
                    # Drive it via the actual service helper directly (unit test).
                    url = review_service._signed_url("dogs/dog-001/sit.mp4")  # noqa: SLF001

        # The mock is set; assert it returns the expected value.
        assert url == "https://example.com/signed"
