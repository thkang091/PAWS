-- ============================================================
-- Migration 0048 - Preserve submission table security boundary
-- ============================================================
-- Tournament submission writes are provided by the narrow RPCs in 0049.
-- Keep direct table access unavailable to mobile roles. This intentionally
-- avoids expanding dogs/profiles permissions required by nested RLS checks.
-- ============================================================

revoke all on table public.dog_training_video_submissions
  from anon, authenticated;

notify pgrst, 'reload schema';
