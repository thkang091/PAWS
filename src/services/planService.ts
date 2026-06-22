import { features } from "@/config/features";
import { getClientOrThrow, mapPlan, throwIfError } from "@/services/serviceUtils";
import type { SubscriptionPlan } from "@/types/domain";

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("subscription_plans").select("*").eq("is_active", true).order("is_paid").order("plan_type");
  throwIfError(error);
  return (data ?? []).map(mapPlan);
};

export const getCurrentPlanSelection = async (): Promise<string | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("user_plan_selections").select("plan_id").maybeSingle();
  throwIfError(error);
  return data?.plan_id ?? null;
};

export const selectPlan = async (plan: SubscriptionPlan): Promise<void> => {
  if (plan.isPaid && !features.paidPlansEnabled) {
    throw new Error("Billing configuration is required before paid plans can be selected.");
  }

  const client = getClientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { error } = await client
    .from("user_plan_selections")
    .upsert({ owner_id: ownerId, plan_id: plan.id, selected_at: new Date().toISOString() }, { onConflict: "owner_id" });
  throwIfError(error);
};
