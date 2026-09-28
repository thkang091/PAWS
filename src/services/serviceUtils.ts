import { getSupabaseClient } from "@/lib/supabase";
import { AppError, toAppError } from "@/lib/errors";
import type {
  CareEvent,
  Coupon,
  CouponPurchase,
  DailyQuest,
  Dog,
  DogDashboard,
  DogMoment,
  ChallengeGame,
  GameDefinition,
  GameEntry,
  GameInstance,
  SubscriptionPlan,
  TrainingProgress,
  TrainingSkill,
  WalletSummary,
} from "@/types/domain";
import type {
  CareEventRow,
  CouponPurchaseRow,
  CouponRow,
  DailyQuestRow,
  DogMomentRow,
  ChallengeGameRow,
  GameCatalogRow,
  GameEntryRow,
  GameInstanceRow,
  Json,
  SubscriptionPlanRow,
  TrainingProgressRow,
  TrainingSkillRow,
} from "@/types/database";
import type { Database } from "@/types/database";

export const getClientOrThrow = () => {
  const client = getSupabaseClient();

  if (!client) {
    throw new AppError("Supabase environment variables are missing.");
  }

  return client;
};

export const throwIfError = (error: unknown): void => {
  if (error) {
    throw toAppError(error);
  }
};

const jsonArrayToStrings = (value: Json): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const mapDog = (row: Database["public"]["Tables"]["dogs"]["Row"]): Dog => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  gender: row.gender,
  birthday: row.birthday,
  ageYears: row.age_years,
  breed: row.breed,
  ownedSince: row.owned_since,
  adoptionDate: row.adoption_date,
  obedienceLevel: row.obedience_level,
  energyLevel: row.energy_level,
  dogTag: row.dog_tag,
});

export const mapSkill = (row: TrainingSkillRow): TrainingSkill => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category,
  difficulty: row.difficulty,
  estimatedMinutes: row.estimated_minutes,
  description: row.description,
  instructions: jsonArrayToStrings(row.instructions),
  silverReward: row.silver_reward,
  bondXpReward: row.bond_xp_reward,
});

export const mapProgress = (row: TrainingProgressRow): TrainingProgress => ({
  id: row.id,
  dogId: row.dog_id,
  skillId: row.skill_id,
  sessionsCompleted: row.sessions_completed,
  completionPercentage: row.completion_percentage,
  completedAt: row.completed_at,
});

export const mapQuest = (row: DailyQuestRow & { quest_templates?: Partial<TrainingQuestTemplate> | null }): DailyQuest => ({
  id: row.id,
  dogId: row.dog_id,
  templateId: row.template_id,
  questDate: row.quest_date,
  status: row.status,
  title: row.quest_templates?.title,
  description: row.quest_templates?.description,
  silverReward: row.quest_templates?.silver_reward,
  bondXpReward: row.quest_templates?.bond_xp_reward,
});

type TrainingQuestTemplate = {
  title: string;
  description: string;
  silver_reward: number;
  bond_xp_reward: number;
};

export const mapMoment = (row: DogMomentRow, imageUrl?: string | null): DogMoment => ({
  id: row.id,
  dogId: row.dog_id,
  storagePath: row.storage_path,
  caption: row.caption,
  momentDate: row.moment_date,
  imageUrl,
});

export const mapCareEvent = (row: CareEventRow): CareEvent => ({
  id: row.id,
  dogId: row.dog_id,
  eventType: row.event_type,
  title: row.title,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
});

export const mapPlan = (row: SubscriptionPlanRow): SubscriptionPlan => ({
  id: row.id,
  planType: row.plan_type,
  name: row.name,
  description: row.description,
  priceDisplay: row.price_display,
  isPaid: row.is_paid,
  features: jsonArrayToStrings(row.features),
});

export const mapGameDefinition = (row: GameCatalogRow): GameDefinition => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  silverEntryCost: row.silver_entry_cost,
  goldPassReward: "gold_coin_pass_reward" in row ? Number(row.gold_coin_pass_reward ?? 0) : undefined,
  bonusXp: "bonus_xp" in row ? Number(row.bonus_xp ?? 0) : undefined,
  difficulty: "difficulty" in row ? row.difficulty as GameDefinition["difficulty"] : undefined,
});

export const mapChallengeGame = (row: ChallengeGameRow): ChallengeGame => ({
  id: row.id,
  category: row.category as ChallengeGame["category"],
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  difficulty: row.difficulty,
  recordingSetup: jsonArrayToStrings(row.recording_setup),
  userInstructions: jsonArrayToStrings(row.user_instructions),
  clipDurationSeconds: {
    min: row.min_clip_seconds,
    max: row.max_clip_seconds,
  },
  requiredMasteredActivityIds: jsonArrayToStrings(row.required_mastered_activity_ids),
  verifierPrompt: row.verifier_prompt,
  economy: {
    silverCoinEntryCost: row.silver_coin_entry_cost,
    goldCoinPassReward: row.gold_coin_pass_reward,
    bonusXp: row.bonus_xp,
  },
  maxStars: 3,
  safetyNotes: row.safety_notes ? jsonArrayToStrings(row.safety_notes) : [],
});

export const mapGameInstance = (row: GameInstanceRow): GameInstance => ({
  id: row.id,
  gameCatalogId: row.game_catalog_id,
  title: row.title,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  submissionDeadline: row.submission_deadline,
});

export const mapGameEntry = (row: GameEntryRow): GameEntry => ({
  id: row.id,
  gameInstanceId: row.game_instance_id,
  dogId: row.dog_id,
  status: row.status,
});

export const mapCoupon = (row: CouponRow): Coupon => ({
  id: row.id,
  title: row.title,
  description: row.description,
  goldCoinCost: row.gold_coin_cost,
  status: row.status,
  redemptionInstructions: row.redemption_instructions,
  expiresAt: row.expires_at ?? undefined,
});

export const mapCouponPurchase = (row: CouponPurchaseRow): CouponPurchase => ({
  id: row.id,
  couponId: row.coupon_id,
  dogId: row.dog_id,
  goldCoinCost: row.gold_coin_cost,
  status: row.status,
  createdAt: row.created_at,
});

type DashboardJson = {
  dog: Database["public"]["Tables"]["dogs"]["Row"];
  wallet: WalletSummary;
  bondXp: number;
  level: number;
  status: {
    focus: number;
    discipline: number;
    social: number;
    energy: number;
    intelligence: number;
  };
  streak: number;
  trainingSummary: {
    completedSkills: number;
    activeSkills: number;
  };
};

export const mapDashboard = (value: Json): DogDashboard => {
  const dashboard = value as DashboardJson;

  return {
    dog: mapDog(dashboard.dog),
    wallet: dashboard.wallet,
    bondXp: dashboard.bondXp,
    level: dashboard.level,
    status: dashboard.status,
    streak: dashboard.streak,
    trainingSummary: dashboard.trainingSummary,
  };
};

export const createIdempotencyKey = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
