import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { WeightLog } from "@/types/domain";

const mapWeight = (row: { id: string; dog_id: string; weight_value: number; weight_unit: "lb" | "kg"; recorded_at: string; note: string | null }): WeightLog => ({
  id: row.id,
  dogId: row.dog_id,
  weightValue: Number(row.weight_value),
  weightUnit: row.weight_unit,
  recordedAt: row.recorded_at,
  note: row.note,
});

export const getWeightLogs = async (dogId: string): Promise<WeightLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("dog_weight_logs").select("*").eq("dog_id", dogId).order("recorded_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as Array<{ id: string; dog_id: string; weight_value: number; weight_unit: "lb" | "kg"; recorded_at: string; note: string | null }>).map(mapWeight);
};

export const saveWeightLog = async ({ dogId, weightValue, weightUnit, recordedAt, note }: { dogId: string; weightValue: number; weightUnit: "lb" | "kg"; recordedAt: string; note: string | null }): Promise<WeightLog> => {
  const client = getClientOrThrow();
  const user = await client.auth.getUser();
  throwIfError(user.error);
  const ownerId = user.data.user?.id;
  if (!ownerId) throw new Error("Authentication required.");
  const { data, error } = await client.from("dog_weight_logs").insert({ dog_id: dogId, owner_id: ownerId, weight_value: weightValue, weight_unit: weightUnit, recorded_at: recordedAt, note }).select("*").single();
  throwIfError(error);
  return mapWeight(data);
};
