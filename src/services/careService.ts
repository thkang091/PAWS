import { createIdempotencyKey, getClientOrThrow, mapCareEvent, throwIfError } from "@/services/serviceUtils";
import type { CareEvent, CareEventType, CareRoutine, CareRoutineCompletion } from "@/types/domain";
import type { DogCareRoutineCompletionRow, DogCareRoutineRow, Json } from "@/types/database";

export type CareEventInput = {
  dogId: string;
  eventType: CareEventType;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes?: number | null;
  note?: string | null;
  attachmentPath?: string | null;
};

export type CareRoutineTemplate = {
  routineKey: string;
  title: string;
  description: string;
  iconKey: string;
  silverReward: number;
  sortOrder: number;
  reminderTime?: string | null;
};

export type CareRoutineDraft = CareRoutineTemplate;

export const defaultCareRoutineTemplates: CareRoutineTemplate[] = [
  { routineKey: "walk", title: "Go for a walk", description: "Walk 20 minutes", iconKey: "walk", silverReward: 10, sortOrder: 0 },
  { routineKey: "feeding", title: "Feed your dog", description: "Record a meal", iconKey: "bowl-mix", silverReward: 5, sortOrder: 1 },
  { routineKey: "water", title: "Hydrate your dog", description: "Refresh water intake", iconKey: "water", silverReward: 5, sortOrder: 2 },
  { routineKey: "mental_stimulation", title: "Mental stimulation", description: "Play or train for 15 minutes", iconKey: "brain", silverReward: 10, sortOrder: 3 },
  { routineKey: "training_practice", title: "Practice a training", description: "Complete any training session", iconKey: "star", silverReward: 10, sortOrder: 4 },
];

const mapCareRoutine = (row: DogCareRoutineRow): CareRoutine => ({
  id: row.id,
  dogId: row.dog_id,
  routineKey: row.routine_key,
  title: row.title,
  description: row.description,
  iconKey: row.icon_key,
  silverReward: row.silver_reward,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  reminderTime: row.reminder_time ?? null,
});

const mapCareRoutineCompletion = (row: DogCareRoutineCompletionRow): CareRoutineCompletion => ({
  id: row.id,
  routineId: row.routine_id,
  dogId: row.dog_id,
  completionDate: row.completion_date,
  silverAwarded: row.silver_awarded,
});

export const getCareEvents = async (dogId: string): Promise<CareEvent[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("care_events").select("*").eq("dog_id", dogId).order("start_time");
  throwIfError(error);
  return (data ?? []).map(mapCareEvent);
};

export const upsertCareEvent = async (input: CareEventInput, eventId?: string): Promise<CareEvent> => {
  const client = getClientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const payload = {
    dog_id: input.dogId,
    owner_id: ownerId,
    event_type: input.eventType,
    title: input.title,
    description: input.description,
    start_time: input.startTime,
    end_time: input.endTime,
    duration_minutes: input.durationMinutes ?? null,
    note: input.note ?? null,
    attachment_path: input.attachmentPath ?? null,
  };

  const request = eventId
    ? client.from("care_events").update(payload).eq("id", eventId).select("*").single()
    : client.from("care_events").insert(payload).select("*").single();
  const { data, error } = await request;
  throwIfError(error);
  return mapCareEvent(data);
};

export const deleteCareEvent = async (eventId: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("care_events").delete().eq("id", eventId);
  throwIfError(error);
};

export const getCareRoutines = async (dogId: string): Promise<CareRoutine[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_care_routines")
    .select("*")
    .eq("dog_id", dogId)
    .eq("is_active", true)
    .order("sort_order");
  throwIfError(error);
  return (data ?? []).map((row) => mapCareRoutine(row as DogCareRoutineRow));
};

export const saveCareRoutineSetup = async (dogId: string, routineDrafts: CareRoutineDraft[]): Promise<CareRoutine[]> => {
  const client = getClientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const selected = routineDrafts.map((draft, index) => ({
    ...draft,
    routineKey: draft.routineKey.trim(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    silverReward: Math.min(10, Math.max(5, Math.round(draft.silverReward))),
    sortOrder: index,
  })).filter((draft) => draft.routineKey.length > 0 && draft.title.length > 0);
  if (selected.length === 0) throw new Error("Choose at least one daily routine.");

  const deactivate = await client
    .from("dog_care_routines")
    .update({ is_active: false })
    .eq("dog_id", dogId)
    .not("routine_key", "in", `(${selected.map((item) => `"${item.routineKey}"`).join(",")})`);
  throwIfError(deactivate.error);

  const payload = selected.map((template) => ({
    dog_id: dogId,
    owner_id: ownerId,
    routine_key: template.routineKey,
    title: template.title,
    description: template.description,
    icon_key: template.iconKey,
    silver_reward: template.silverReward,
    sort_order: template.sortOrder,
    is_active: true,
    reminder_time: template.reminderTime ?? null,
  }));

  const { data, error } = await client
    .from("dog_care_routines")
    .upsert(payload, { onConflict: "dog_id,routine_key" })
    .select("*")
    .order("sort_order");
  throwIfError(error);
  return (data ?? []).map((row) => mapCareRoutine(row as DogCareRoutineRow));
};

export const getCareRoutineCompletions = async (dogId: string, completionDate: string): Promise<CareRoutineCompletion[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_care_routine_completions")
    .select("*")
    .eq("dog_id", dogId)
    .eq("completion_date", completionDate);
  throwIfError(error);
  return (data ?? []).map((row) => mapCareRoutineCompletion(row as DogCareRoutineCompletionRow));
};

export const completeCareRoutine = async (routineId: string, completionDate: string): Promise<{ completion: CareRoutineCompletion; silverEarned: number; alreadyCompleted: boolean }> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("complete_dog_care_routine", {
    target_routine_id: routineId,
    completion_date_value: completionDate,
    request_key: createIdempotencyKey("care-routine"),
  });
  throwIfError(error);
  const result = data as Json as {
    completion: DogCareRoutineCompletionRow;
    silver_earned: number;
    already_completed: boolean;
  };
  return {
    completion: mapCareRoutineCompletion(result.completion),
    silverEarned: result.silver_earned,
    alreadyCompleted: result.already_completed,
  };
};
