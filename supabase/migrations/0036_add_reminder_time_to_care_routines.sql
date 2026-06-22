ALTER TABLE dog_care_routines
  ADD COLUMN IF NOT EXISTS reminder_time text DEFAULT NULL;
