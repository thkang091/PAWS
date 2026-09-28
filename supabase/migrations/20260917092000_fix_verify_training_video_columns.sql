alter type submission_status add value if not exists 'error';

alter table dog_training_video_submissions
  add column if not exists confidence numeric,
  add column if not exists raw_gemini_response jsonb,
  add column if not exists observations jsonb;
