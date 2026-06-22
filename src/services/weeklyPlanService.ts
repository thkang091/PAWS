import { createIdempotencyKey, getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { Json } from "@/types/database";
import type { WeeklyPlan, WeeklyPlanItem } from "@/types/domain";

type WeeklyPlanItemRow = {
  id: string;
  scheduled_date: string;
  item_type: WeeklyPlanItem["itemType"];
  title: string;
  description: string | null;
  skill_id: string | null;
  estimated_minutes: number | null;
  status: WeeklyPlanItem["status"];
  sort_order: number;
};

type WeeklyPlanJson = {
  plan: {
    id: string;
    dog_id: string;
    week_start_date: string;
    generated_reason: string;
  };
  items: WeeklyPlanItemRow[];
};

const mapItem = (row: WeeklyPlanItemRow): WeeklyPlanItem => ({
  id: row.id,
  scheduledDate: row.scheduled_date,
  itemType: row.item_type,
  title: row.title,
  description: row.description,
  skillId: row.skill_id,
  estimatedMinutes: row.estimated_minutes,
  status: row.status,
  sortOrder: row.sort_order,
});

const mapPlan = (value: Json): WeeklyPlan => {
  const data = value as WeeklyPlanJson;
  return {
    id: data.plan.id,
    dogId: data.plan.dog_id,
    weekStartDate: data.plan.week_start_date,
    generatedReason: data.plan.generated_reason,
    items: data.items.map(mapItem),
  };
};

export const weekStartKey = (date = new Date()): string => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy.toISOString().slice(0, 10);
};

export const generateWeeklyPlan = async (dogId: string, weekStart: string, regenerate = false): Promise<WeeklyPlan> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("generate_weekly_plan", {
    target_dog_id: dogId,
    week_start_date_value: weekStart,
    regenerate,
  });
  throwIfError(error);
  return mapPlan(data);
};

export const completeWeeklyPlanItem = async (itemId: string): Promise<WeeklyPlanItem> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("complete_weekly_plan_item", { target_item_id: itemId });
  throwIfError(error);
  return mapItem(data as WeeklyPlanItemRow);
};

export const createWeeklyPlanKey = (): string => createIdempotencyKey("weekly-plan");
