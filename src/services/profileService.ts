import { mapDashboard, mapDog, getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { Dog, DogDashboard, Profile } from "@/types/domain";
import type { Database } from "@/types/database";

export const getCurrentProfile = async (): Promise<Profile | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("profiles").select("*").maybeSingle();
  throwIfError(error);

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    onboardingCompleted: data.onboarding_completed,
    tutorialCompleted: data.tutorial_completed,
  };
};


export const getCurrentDog = async (): Promise<Dog | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("dogs").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
  throwIfError(error);
  return data ? mapDog(data) : null;
};

export const updateTutorialCompleted = async (): Promise<void> => {
  const client = getClientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Authentication required.");
  }

  const { error } = await client.from("profiles").update({ tutorial_completed: true }).eq("id", userId);
  throwIfError(error);
};

export const getProfileDashboard = async (dogId: string): Promise<DogDashboard> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("get_profile_dashboard", { target_dog_id: dogId });
  throwIfError(error);
  return mapDashboard(data);
};

export const getDogRelationships = async (dogId: string) => {
  const client = getClientOrThrow();
  const [goals, existing, target, concerns] = await Promise.all([
    client.from("dog_goals").select("goal_key").eq("dog_id", dogId),
    client.from("dog_existing_skills").select("skill_id").eq("dog_id", dogId),
    client.from("dog_target_skills").select("skill_id").eq("dog_id", dogId),
    client.from("dog_behavioral_concerns").select("concern_key, custom_note").eq("dog_id", dogId),
  ]);
  throwIfError(goals.error);
  throwIfError(existing.error);
  throwIfError(target.error);
  throwIfError(concerns.error);

  return {
    goals: (goals.data ?? []).map((row) => row.goal_key),
    existingSkillIds: (existing.data ?? []).map((row) => row.skill_id),
    targetSkillIds: (target.data ?? []).map((row) => row.skill_id),
    concerns: (concerns.data ?? []).map((row) => ({
      key: row.concern_key,
      customNote: row.custom_note,
    })),
  };
};

export type DogProfileUpdate = Partial<Pick<Database["public"]["Tables"]["dogs"]["Update"], "name" | "breed" | "gender" | "birthday" | "age_years" | "owned_since" | "adoption_date" | "obedience_level" | "energy_level">> & {
  goalKeys: string[];
  existingSkillIds: string[];
  targetSkillIds: string[];
  concernKeys: string[];
  concernOtherNote: string | null;
};

export const updateDogProfile = async (dogId: string, values: DogProfileUpdate): Promise<Dog> => {
  const client = getClientOrThrow();
  const { goalKeys, existingSkillIds, targetSkillIds, concernKeys, concernOtherNote, ...dogValues } = values;
  const { data, error } = await client.from("dogs").update(dogValues).eq("id", dogId).select("*").single();
  throwIfError(error);

  await Promise.all([
    client.from("dog_goals").delete().eq("dog_id", dogId),
    client.from("dog_existing_skills").delete().eq("dog_id", dogId),
    client.from("dog_target_skills").delete().eq("dog_id", dogId),
    client.from("dog_behavioral_concerns").delete().eq("dog_id", dogId),
  ]);

  const concernRows = concernKeys.map((concern_key) => ({
    dog_id: dogId,
    concern_key,
    custom_note: concern_key === "other" ? concernOtherNote : null,
  }));

  await Promise.all([
    goalKeys.length > 0 ? client.from("dog_goals").insert(goalKeys.map((goal_key) => ({ dog_id: dogId, goal_key }))) : Promise.resolve(),
    existingSkillIds.length > 0 ? client.from("dog_existing_skills").insert(existingSkillIds.map((skill_id) => ({ dog_id: dogId, skill_id }))) : Promise.resolve(),
    targetSkillIds.length > 0 ? client.from("dog_target_skills").insert(targetSkillIds.map((skill_id) => ({ dog_id: dogId, skill_id }))) : Promise.resolve(),
    concernRows.length > 0 ? client.from("dog_behavioral_concerns").insert(concernRows) : Promise.resolve(),
  ]);

  return mapDog(data);
};

/** Just the basics that tailor care and training (breed, age); nothing else on the dog is touched. */
export const updateDogBasics = async (dogId: string, values: { breed?: string; age_years?: number; gender?: "male" | "female" }): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dogs").update(values).eq("id", dogId);
  throwIfError(error);
};
