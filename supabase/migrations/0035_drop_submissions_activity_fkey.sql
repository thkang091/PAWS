-- Allow activity_id to reference both training_catalog_activities and challenge_games
ALTER TABLE dog_training_video_submissions
  DROP CONSTRAINT IF EXISTS dog_training_video_submissions_activity_id_fkey;
