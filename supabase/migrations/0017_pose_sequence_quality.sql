-- Adds data-quality flags to pose_sequences.
-- quality_flags is a JSONB object matching the PoseQualityFlags schema:
-- {low_average_confidence, excessive_missing_frames, dog_partially_out_of_frame,
--  insufficient_recording_duration, inconsistent_frame_rate, unsupported_pose_schema}

alter table public.pose_sequences
    add column if not exists quality_flags jsonb not null default '{}'::jsonb;

create index if not exists pose_sequences_quality_flags_idx
    on public.pose_sequences using gin(quality_flags);
