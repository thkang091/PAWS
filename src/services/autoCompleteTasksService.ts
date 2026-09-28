import { createIdempotencyKey, getClientOrThrow } from "@/services/serviceUtils";

const TRAINING_QUEST_TEMPLATE_IDS = [
  "1d113670-52f6-410b-acfc-baeec17e19b0",
  "66fdfeda-9142-4b4f-a35f-756d7c828a1d",
  "6473fee8-2b93-4bf9-bc0b-a580809587ce",
  "16a4fc9b-3fad-4566-838f-87ac4bf153ae",
];

const DOG_MOMENT_QUEST_TEMPLATE_IDS = [
  "368d5ecd-dd97-47d0-9cdf-f52a862b6889",
];

const TRAINING_ROUTINE_KEYS = ["training_practice", "mental_stimulation"];

const todayKey = () => new Date().toISOString().slice(0, 10);

export const autoCompleteTrainingTasks = async (dogId: string): Promise<void> => {
  const client = getClientOrThrow();
  const date = todayKey();

  const { data: quests } = await client
    .from("daily_quests")
    .select("id")
    .eq("dog_id", dogId)
    .eq("quest_date", date)
    .eq("status", "active")
    .in("template_id", TRAINING_QUEST_TEMPLATE_IDS);

  for (const quest of (quests ?? [])) {
    await client.rpc("complete_daily_quest", {
      target_daily_quest_id: quest.id,
      request_key: createIdempotencyKey("quest"),
    });
  }

  const { data: routines } = await client
    .from("dog_care_routines")
    .select("id")
    .eq("dog_id", dogId)
    .in("routine_key", TRAINING_ROUTINE_KEYS);

  if (routines && routines.length > 0) {
    const routineIds = routines.map((r: { id: string }) => r.id);

    const { data: completions } = await client
      .from("dog_care_routine_completions")
      .select("care_routine_id")
      .eq("dog_id", dogId)
      .eq("completion_date", date)
      .in("care_routine_id", routineIds);

    const completedIds = new Set((completions ?? []).map((c: { care_routine_id: string }) => c.care_routine_id));

    for (const routine of routines) {
      const r = routine as { id: string };
      if (!completedIds.has(r.id)) {
        await client.rpc("complete_dog_care_routine", {
          target_routine_id: r.id,
          completion_date_value: date,
          request_key: createIdempotencyKey("care-routine"),
        });
      }
    }
  }
};

export const autoCompleteDogMomentTasks = async (dogId: string): Promise<void> => {
  const client = getClientOrThrow();
  const date = todayKey();

  const { data: quests } = await client
    .from("daily_quests")
    .select("id")
    .eq("dog_id", dogId)
    .eq("quest_date", date)
    .eq("status", "active")
    .in("template_id", DOG_MOMENT_QUEST_TEMPLATE_IDS);

  for (const quest of (quests ?? [])) {
    await client.rpc("complete_daily_quest", {
      target_daily_quest_id: quest.id,
      request_key: createIdempotencyKey("quest"),
    });
  }
};
