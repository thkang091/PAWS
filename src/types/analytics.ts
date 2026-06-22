export type AnalyticsEventName =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_completed"
  | "plan_selected"
  | "training_session_started"
  | "training_session_completed"
  | "quest_completed"
  | "dog_moment_uploaded"
  | "streak_extended"
  | "care_event_created"
  | "weekly_plan_generated"
  | "weekly_plan_item_completed"
  | "avatar_item_purchased"
  | "avatar_item_equipped"
  | "game_entered"
  | "reward_requested"
  | "account_linked"
  | "subscription_started";

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsProvider = {
  track: (eventName: AnalyticsEventName, properties?: AnalyticsProperties) => Promise<void> | void;
};
