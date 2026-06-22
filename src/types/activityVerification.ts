export type ActivityCategory =
  | "STATIC_POSE"
  | "TRANSITION"
  | "DURATION"
  | "REPETITION"
  | "DISTANCE_OR_MOVEMENT"
  | "DAILY_ROUTINE"
  | "GAME";

export type VerificationMode =
  | "POSE_TEMPORAL"
  | "OBJECT_AND_POSE"
  | "TIMER_AND_POSE"
  | "MOTION_TRACKING"
  | "PHOTO_CONFIRMATION"
  | "USER_CONFIRMATION"
  | "OPTIONAL_VIDEO_CONFIRMATION"
  | "MANUAL_REVIEW_REQUIRED_FOR_TOP_SCORE";

export type VerificationTrustLevel =
  | "VERIFIED_AI"
  | "VERIFIED_SENSOR"
  | "VERIFIED_PHOTO"
  | "USER_CONFIRMED"
  | "MANUAL_REVIEWED";

export type RecordingType = "video" | "photo" | "sensor" | "confirmation";
export type ActivityDifficulty = "beginner" | "intermediate" | "advanced";
export type VerificationContextType = "training" | "daily_quest" | "routine" | "game" | "tournament";

export type ActivityVerificationStatus =
  | "pending"
  | "uploading"
  | "analyzing"
  | "passed"
  | "user_confirmed"
  | "retry_camera_angle"
  | "retry_dog_not_visible"
  | "retry_multiple_dogs"
  | "retry_object_not_visible"
  | "retry_low_confidence"
  | "retry_incomplete_activity"
  | "retry_wrong_starting_pose"
  | "failed_no_valid_activity"
  | "unsupported_activity"
  | "suspicious"
  | "manual_review"
  | "error";

export type QualityRequirements = {
  fullBodyVisible?: boolean;
  pawsVisible?: boolean;
  exactlyOneDog?: boolean;
  sufficientLighting?: boolean;
  cameraStable?: boolean;
  requiredObject?: string;
  recommendedCameraAngle?: "side" | "diagonal" | "side_or_diagonal" | "front" | "overhead";
};

export type RewardConfig = {
  xp: number;
  coins: number;
};

export type ActivityDefinition = {
  id: string;
  displayName: string;
  category: ActivityCategory;
  verificationMode: VerificationMode;
  trustLevel: VerificationTrustLevel;
  difficulty: ActivityDifficulty;
  recordingType: RecordingType;
  minimumDurationSeconds: number;
  maximumDurationSeconds: number;
  requiresInAppRecording: boolean;
  allowGalleryUploadForCasualMode: boolean;
  requiredStartingPose?: string;
  requiredEndingPose?: string;
  minimumStablePoseDurationMs?: number;
  minimumConfidence: number;
  rewardConfig: RewardConfig;
  qualityRequirements: QualityRequirements;
  instructions: string[];
  retryInstructions: string[];
};

export type ActivityVerification = {
  id: string;
  userId: string;
  dogId: string;
  activityId: string;
  activityCategory: ActivityCategory;
  verificationMode: VerificationMode;
  trustLevel: VerificationTrustLevel;
  contextType: VerificationContextType;
  sourceType: "in_app_video" | "in_app_photo" | "sensor_session" | "user_confirmation" | "backend_import";
  storagePath: string | null;
  status: ActivityVerificationStatus;
  confidenceScore: number | null;
  modelName: string | null;
  failureReason: string | null;
  retryGuidance: string | null;
  analysisSummary: Record<string, unknown> | null;
  createdAt: string;
};

export type ActivityAnalysisRequest = {
  verification_id: string;
  user_id: string;
  dog_id: string;
  activity_id: string;
  verification_mode: VerificationMode;
  storage_path: string | null;
  context_type: VerificationContextType;
  game_config?: {
    ranked: boolean;
    required_duration_ms: number | null;
    sequence: string[] | null;
  };
};

export type ActivityAnalysisResponse = {
  verification_id: string;
  activity_id: string;
  status: ActivityVerificationStatus;
  confidence_score: number | null;
  model_name: string | null;
  analysis_summary: Record<string, unknown> | null;
  failure_reason: string | null;
  retry_guidance: string | null;
};

export type DailyRoutineLog = {
  id: string;
  dogId: string;
  routineType: string;
  completionMethod: VerificationTrustLevel | "OPTIONAL_VIDEO_CONFIRMATION";
  completedAt: string;
  notes: string | null;
};

export type ActivityGameDefinition = {
  id: string;
  displayName: string;
  baseActivityId: string;
  scoringMethod: "LOWEST_TIME_MS" | "HIGHEST_DURATION_SECONDS" | "HIGHEST_REPETITIONS" | "COMPLETION_TIME_AND_ACCURACY";
  rankedEligible: boolean;
  requiresServerCountdown: boolean;
  requiresInAppRecording: boolean;
  requiresManualReviewForTopScores: boolean;
  minimumConfidence: number;
  antiCheatEnabled: boolean;
};

export type ActivityGameSession = {
  id: string;
  activityId: string;
  gameType: string;
  dogId: string;
  status: string;
  scoreValue: number | null;
  scoreUnit: string | null;
  rankEligible: boolean;
  suspicious: boolean;
  verificationId: string | null;
};
