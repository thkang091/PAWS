import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";

const today = () => new Date().toISOString().slice(0, 10);

export type FeedingLogType = "meal" | "treat" | "water";

export type FeedingLog = {
  id: string;
  dogId: string;
  logType: FeedingLogType;
  logDate: string;
  mealName: string | null;
  amountGrams: number | null;
  note: string | null;
  createdAt: string;
};

const mapLog = (row: {
  id: string;
  dog_id: string;
  log_type: FeedingLogType;
  log_date: string;
  meal_name: string | null;
  amount_grams: number | null;
  note: string | null;
  created_at?: string;
}): FeedingLog => ({
  id: row.id,
  dogId: row.dog_id,
  logType: row.log_type,
  logDate: row.log_date,
  mealName: row.meal_name,
  amountGrams: row.amount_grams,
  note: row.note,
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const getTodayFeedingLogs = async (dogId: string): Promise<FeedingLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_feeding_logs")
    .select("*")
    .eq("dog_id", dogId)
    .eq("log_date", today())
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(mapLog);
};

export const logFeeding = async (
  dogId: string,
  input: { logType: FeedingLogType; mealName?: string | null; amountGrams?: number | null; note?: string | null },
): Promise<FeedingLog> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_feeding_logs")
    .insert({
      dog_id: dogId,
      owner_id: ownerId,
      log_type: input.logType,
      log_date: today(),
      meal_name: input.mealName ?? null,
      amount_grams: input.amountGrams ?? null,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  throwIfError(error);
  return mapLog(data);
};

export const deleteFeedingLog = async (logId: string): Promise<void> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("dog_feeding_logs").delete().eq("id", logId).select("id");
  throwIfError(error);
  if ((data ?? []).length === 0) throw new Error("Nothing was removed.");
};
