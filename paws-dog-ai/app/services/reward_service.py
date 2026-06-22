"""
Reward service.

Awards XP or Gold Coins after a verified pass, subject to anti-cheat
clearance.  The mobile client never awards directly — all reward logic
is server-side and idempotent.

The actual award RPC is called only when:
  1. The verification result is "passed".
  2. The anti-cheat decision is "proceed" (reward_eligible=True).
  3. The account is not under a reward restriction.
"""

from __future__ import annotations

from app.utils.logging import log_error, log_info, log_warn


def award_if_eligible(
    verification_id: str,
    reward_eligible: bool,
    restriction_reason: str | None = None,
) -> None:
    """
    Issue a reward for a verified pass attempt if all eligibility gates pass.

    Parameters
    ----------
    verification_id:
        The verification that passed.
    reward_eligible:
        From AntiCheatDecision.reward_eligible.
    restriction_reason:
        Set when the account has an active restriction; logged and skipped.
    """
    if not reward_eligible:
        log_warn(
            "reward_service",
            "reward_skipped",
            verification_id=verification_id,
            reason=restriction_reason or "anti_cheat_decision_not_proceed",
        )
        return

    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        client.rpc(
            "award_verification_reward",
            {"target_verification_id": verification_id},
        ).execute()
        log_info(
            "reward_service",
            "reward_issued",
            verification_id=verification_id,
        )
    except Exception as exc:  # noqa: BLE001
        # Reward failure must not surface as an HTTP error.
        log_error(
            "reward_service",
            "reward_rpc_failed",
            verification_id=verification_id,
            error=str(exc),
        )
