alter table activity_verifications
drop constraint if exists activity_verifications_status_check;

alter table activity_verifications
add constraint activity_verifications_status_check
check (status in (
  'pending',
  'uploading',
  'analyzing',
  'passed',
  'user_confirmed',
  'retry_camera_angle',
  'retry_dog_not_visible',
  'retry_multiple_dogs',
  'retry_object_not_visible',
  'retry_low_confidence',
  'retry_incomplete_activity',
  'retry_wrong_starting_pose',
  'failed_no_valid_activity',
  'unsupported_activity',
  'suspicious',
  'manual_review',
  'error'
));
