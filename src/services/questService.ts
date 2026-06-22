import { createIdempotencyKey, getClientOrThrow, mapQuest, throwIfError } from "@/services/serviceUtils";
import type { DailyQuest } from "@/types/domain";
import type { DailyQuestRow, Json } from "@/types/database";

export const initializeDailyQuests = async (dogId: string, date: string): Promise<DailyQuest[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("initialize_daily_quests", {
    target_dog_id: dogId,
    requested_date: date,
  });
  throwIfError(error);
  return ((data ?? []) as DailyQuestRow[]).map((row) => mapQuest(row));
};

export const getDailyQuests = async (dogId: string, date: string): Promise<DailyQuest[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("daily_quests")
    .select("*, quest_templates(title, description, silver_reward, bond_xp_reward)")
    .eq("dog_id", dogId)
    .eq("quest_date", date)
    .order("created_at");
  throwIfError(error);
  return ((data ?? []) as unknown as Array<DailyQuestRow & { quest_templates?: { title: string; description: string; silver_reward: number; bond_xp_reward: number } | null }>).map(mapQuest);
};

type QuestCompleteJson = {
  quest: DailyQuestRow;
  silverEarned: number;
  xpEarned: number;
};

export const completeDailyQuest = async (dailyQuestId: string): Promise<QuestCompleteJson> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("complete_daily_quest", {
    target_daily_quest_id: dailyQuestId,
    request_key: createIdempotencyKey("quest"),
  });
  throwIfError(error);
  return data as Json as QuestCompleteJson;
};
