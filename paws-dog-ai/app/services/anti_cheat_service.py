"""
Anti-cheat service.

Orchestrates duplicate detection, pattern analysis, and risk scoring for
every Gold Coin and tournament attempt.  Standard daily attempts receive a
lightweight check (exact video hash only).

Entry points
------------
  AntiCheatService.run_checks()
      Full pipeline.  Returns AntiCheatDecision.  Never raises.

  AntiCheatService.apply_admin_action()
      Apply an admin review action (approve, reject, warn, etc.) to an
      existing audit record.  Returns AdminReviewResponse.

Decision thresholds
-------------------
  RISK_PROCEED  < 0.35   — award eligible
  RISK_REVIEW   0.35-0.85 — route to manual review; no immediate reward
  RISK_BLOCK    >= 0.85   — block reward; admin review required

  Exact duplicate always blocks, regardless of risk score.
  Cross-account match always blocks.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.anti_cheat_models import (
    ANTI_CHEAT_VERSION,
    AdminActionType,
    AdminReviewRequest,
    AdminReviewResponse,
    AntiCheatDecision,
    AntiCheatDecisionType,
    DuplicateMatch,
    RestrictionState,
    RiskSignal,
    RiskSignalName,
)
from app.models.request_models import ActivityAnalysisRequest
from app.utils.logging import log_error, log_info, log_warn


# Risk score thresholds for automated decisions.
RISK_PROCEED_THRESHOLD = 0.35
RISK_BLOCK_THRESHOLD   = 0.85

# Duplicate match types that always block reward redemption.
_ALWAYS_BLOCK_MATCH_TYPES = frozenset({
    "exact_video",
    "cross_account_video",
    "exact_pose",
    "cross_account_pose",
})

# Tiers that receive full pattern analysis.
_HIGH_STAKES_TIERS = frozenset({"gold_coin_reward", "tournament"})


class AntiCheatService:

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_checks(
        self,
        request: ActivityAnalysisRequest,
        pose_frames: list[dict],
        fused_confidence: float,
        assistance_likelihood: float | None = None,
        multiple_dog_score: float | None = None,
        video_bytes: bytes | None = None,
        selected_frame_pixel_lists: list[list[float]] | None = None,
    ) -> AntiCheatDecision:
        """
        Run all anti-cheat checks and return a decision.

        Parameters
        ----------
        request:
            The original ActivityAnalysisRequest.
        pose_frames:
            Pose sequence frames as stored in pose_sequences.frames.
        fused_confidence:
            Final fused confidence from the hybrid pipeline.
        assistance_likelihood:
            From RGBVerificationResult, if available.
        multiple_dog_score:
            From RGBVerificationResult, if available.
        video_bytes:
            Raw video bytes if the service has access to them.
        selected_frame_pixel_lists:
            64-float greyscale thumbnails for perceptual frame hashing.
        """
        verification_id = request.verification_id
        user_id         = request.user_id
        dog_id          = request.dog_id
        tier            = request.verification_tier
        activity_id     = request.activity_id
        is_high_stakes  = tier in _HIGH_STAKES_TIERS

        log_info(
            "anti_cheat_service",
            "checks_started",
            verification_id=verification_id,
            tier=tier,
            is_high_stakes=is_high_stakes,
        )

        # --- 1. Compute and store hashes ---
        from app.services.duplicate_detection_service import (  # noqa: PLC0415
            check_duplicates,
            compute_hashes,
            store_hashes,
        )
        hashes = compute_hashes(
            frames=pose_frames,
            video_bytes=video_bytes,
            selected_frame_pixel_lists=selected_frame_pixel_lists,
        )

        # --- 2. Check for duplicates ---
        duplicate_match: DuplicateMatch | None = check_duplicates(
            hashes=hashes,
            user_id=user_id,
            activity_id=activity_id,
            current_verification_id=verification_id,
        )

        # --- 3. Compute risk signals ---
        signals: list[RiskSignal] = []

        if is_high_stakes:
            from app.services.account_risk_service import (  # noqa: PLC0415
                compute_risk_signals,
            )
            signals = compute_risk_signals(
                user_id=user_id,
                dog_id=dog_id,
                tier=tier,
                activity_id=activity_id,
                pose_classifier_confidence=fused_confidence,
                assistance_likelihood=assistance_likelihood,
                multiple_dog_score=multiple_dog_score,
                pose_frames=pose_frames,
                recording_metadata=request.recording_metadata,
                current_verification_id=verification_id,
            )

        # Add duplicate-based signal to list for audit transparency.
        if duplicate_match:
            match_signal = RiskSignal(
                signal_name=(
                    RiskSignalName.EXACT_DUPLICATE
                    if duplicate_match.match_type in ("exact_video", "exact_pose")
                    else RiskSignalName.NEAR_DUPLICATE_POSE
                ),
                score_contribution=1.0 if duplicate_match.match_type in _ALWAYS_BLOCK_MATCH_TYPES else 0.45,
                detail={
                    "match_type":    duplicate_match.match_type,
                    "original_vid":  duplicate_match.original_verification_id,
                    "hamming":       duplicate_match.hamming_distance,
                    "similarity":    duplicate_match.similarity_score,
                },
            )
            signals.insert(0, match_signal)

        # --- 4. Check account restriction ---
        from app.services.account_risk_service import is_reward_restricted  # noqa: PLC0415
        restricted, restriction_reason = is_reward_restricted(user_id)

        # --- 5. Risk score ---
        risk_score = min(1.0, sum(s.score_contribution for s in signals))

        # --- 6. Decision ---
        decision: AntiCheatDecisionType = self._make_decision(
            risk_score=risk_score,
            duplicate_match=duplicate_match,
            is_high_stakes=is_high_stakes,
            is_restricted=restricted,
        )

        reward_eligible = decision == "proceed" and not restricted

        log_info(
            "anti_cheat_service",
            "decision",
            verification_id=verification_id,
            risk_score=round(risk_score, 4),
            signal_count=len(signals),
            decision=decision,
            reward_eligible=reward_eligible,
            has_duplicate=duplicate_match is not None,
        )

        # --- 7. Persist hashes (after decision so duplicate check comes first) ---
        store_hashes(
            verification_id=verification_id,
            user_id=user_id,
            dog_id=dog_id,
            activity_id=activity_id,
            hashes=hashes,
        )

        # --- 8. Update account risk profile ---
        is_suspicious = decision in ("review", "block_reward")
        from app.services.account_risk_service import upsert_account_risk_profile  # noqa: PLC0415
        upsert_account_risk_profile(
            user_id=user_id,
            new_risk_score=risk_score,
            new_flags=[s.signal_name for s in signals],
            is_suspicious=is_suspicious,
        )

        # --- 9. Write audit record ---
        audit_id = self._write_audit(
            verification_id=verification_id,
            user_id=user_id,
            dog_id=dog_id,
            tier=tier,
            risk_score=risk_score,
            signals=signals,
            duplicate_match=duplicate_match,
            decision=decision,
            reward_eligible=reward_eligible,
        )

        return AntiCheatDecision(
            verification_id=verification_id,
            user_id=user_id,
            dog_id=dog_id,
            tier=tier,
            risk_score=round(risk_score, 4),
            signals=signals,
            duplicate_match=duplicate_match,
            decision=decision,
            reward_eligible=reward_eligible,
            anti_cheat_version=ANTI_CHEAT_VERSION,
            audit_id=audit_id,
        )

    def apply_admin_action(
        self,
        audit_id: str,
        req: AdminReviewRequest,
    ) -> AdminReviewResponse:
        """
        Apply an admin action to an anti-cheat audit record and update the
        account risk profile accordingly.  Raises KeyError if not found.
        """
        from datetime import timedelta  # noqa: PLC0415

        now = datetime.now(timezone.utc).isoformat()

        # Load current audit.
        row = self._load_audit(audit_id)
        if not row:
            raise KeyError(f"Anti-cheat audit {audit_id!r} not found.")

        user_id          = row["user_id"]
        previous_decision = row["decision"]
        new_decision = self._decision_after_action(req.action, previous_decision)

        # Determine new restriction state.
        new_restriction: RestrictionState = self._restriction_after_action(req.action)

        # Compute restriction expiry.
        restriction_expires_at: str | None = None
        if req.action == "restrict" and req.restriction_duration_days:
            from datetime import timezone as tz  # noqa: PLC0415
            expiry = datetime.now(tz.utc) + timedelta(days=req.restriction_duration_days)
            restriction_expires_at = expiry.isoformat()

        # Update audit record.
        try:
            from app.services.supabase_service import get_supabase  # noqa: PLC0415
            client = get_supabase()
            client.table("anti_cheat_audits").update({
                "reviewed_by":   req.reviewed_by,
                "reviewed_at":   now,
                "admin_action":  req.action,
                "admin_notes":   req.notes,
                "decision":      new_decision,
            }).eq("id", audit_id).execute()

            # Update account risk profile restriction state.
            if new_restriction != "none":
                client.table("account_risk_profiles").upsert({
                    "user_id":                  user_id,
                    "restriction_state":        new_restriction,
                    "restriction_expires_at":   restriction_expires_at,
                    "updated_at":               now,
                }, on_conflict="user_id").execute()
            elif req.action == "clear_false_positive":
                # Reset restriction state and lower risk score.
                client.table("account_risk_profiles").upsert({
                    "user_id":              user_id,
                    "restriction_state":    "none",
                    "risk_score":           0.0,
                    "consecutive_suspicious": 0,
                    "updated_at":           now,
                }, on_conflict="user_id").execute()

            # Log admin action.
            client.table("account_restriction_log").insert({
                "user_id":                   user_id,
                "action":                    req.action,
                "reason":                    req.reason,
                "restriction_duration_days": req.restriction_duration_days,
                "restriction_expires_at":    restriction_expires_at,
                "reviewed_by":               req.reviewed_by,
            }).execute()

        except Exception as exc:  # noqa: BLE001
            log_error(
                "anti_cheat_service",
                "admin_action_failed",
                audit_id=audit_id,
                error=str(exc),
            )
            raise

        log_info(
            "anti_cheat_service",
            "admin_action_applied",
            audit_id=audit_id,
            action=req.action,
            reviewed_by=req.reviewed_by,
            new_decision=new_decision,
        )

        return AdminReviewResponse(
            audit_id=audit_id,
            verification_id=row["verification_id"],
            user_id=user_id,
            previous_decision=previous_decision,
            new_decision=new_decision,
            action_applied=req.action,
            restriction_state=new_restriction if new_restriction != "none" else "none",
            reviewed_by=req.reviewed_by,
            reviewed_at=now,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_decision(
        risk_score: float,
        duplicate_match: DuplicateMatch | None,
        is_high_stakes: bool,
        is_restricted: bool,
    ) -> AntiCheatDecisionType:
        # Active restriction always blocks.
        if is_restricted:
            return "block_reward"

        # Definitive duplicate evidence always blocks.
        if duplicate_match and duplicate_match.match_type in _ALWAYS_BLOCK_MATCH_TYPES:
            return "block_reward"

        # Near-duplicate with cross-account also blocks.
        if duplicate_match and "cross_account" in duplicate_match.match_type:
            return "block_reward"

        # High aggregate risk score.
        if risk_score >= RISK_BLOCK_THRESHOLD:
            return "block_reward"

        # Route to review: lower threshold for high-stakes tiers.
        review_threshold = RISK_PROCEED_THRESHOLD if is_high_stakes else 0.50
        if risk_score >= review_threshold:
            return "review"

        # Near-duplicate (same account) always routes to review, not block.
        if duplicate_match:
            return "review"

        return "proceed"

    @staticmethod
    def _decision_after_action(action: AdminActionType, previous: str) -> str:
        if action == "approve":
            return "proceed"
        if action in ("reject", "block", "restrict"):
            return "block_reward"
        if action == "clear_false_positive":
            return "proceed"
        # warn / no change to decision.
        return previous

    @staticmethod
    def _restriction_after_action(action: AdminActionType) -> RestrictionState:
        return {
            "approve":             "none",
            "reject":              "none",
            "warn":                "warned",
            "restrict":            "restricted",
            "block":               "blocked",
            "clear_false_positive": "none",
        }.get(action, "none")

    @staticmethod
    def _write_audit(
        verification_id: str,
        user_id: str,
        dog_id: str,
        tier: str,
        risk_score: float,
        signals: list[RiskSignal],
        duplicate_match: DuplicateMatch | None,
        decision: str,
        reward_eligible: bool,
    ) -> str | None:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "verification_id":    verification_id,
            "user_id":            user_id,
            "dog_id":             dog_id,
            "tier":               tier,
            "risk_score":         round(risk_score, 6),
            "signals":            [s.model_dump() for s in signals],
            "duplicate_match":    duplicate_match.model_dump() if duplicate_match else None,
            "decision":           decision,
            "reward_eligible":    reward_eligible,
            "anti_cheat_version": ANTI_CHEAT_VERSION,
            "created_at":         now,
        }
        try:
            from app.services.supabase_service import get_supabase  # noqa: PLC0415
            client = get_supabase()
            result = client.table("anti_cheat_audits").insert(row).execute()
            inserted = (result.data or [{}])[0]
            return inserted.get("id")
        except Exception as exc:  # noqa: BLE001
            log_error(
                "anti_cheat_service",
                "audit_write_failed",
                verification_id=verification_id,
                error=str(exc),
            )
            return None

    @staticmethod
    def _load_audit(audit_id: str) -> dict | None:
        try:
            from app.services.supabase_service import get_supabase  # noqa: PLC0415
            rows = (
                get_supabase()
                .table("anti_cheat_audits")
                .select("*")
                .eq("id", audit_id)
                .limit(1)
                .execute()
                .data or []
            )
            return rows[0] if rows else None
        except Exception as exc:  # noqa: BLE001
            log_error("anti_cheat_service", "audit_load_failed", audit_id=audit_id, error=str(exc))
            return None
