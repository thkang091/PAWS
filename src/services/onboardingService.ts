import { getClientOrThrow, mapDog, throwIfError } from "@/services/serviceUtils";
import { sectionNumberForFocus } from "@/constants/trainingCurriculumMapping";
import { saveDogTrainingPreferences } from "@/services/trainingCurriculumService";
import type { Dog, DogGender, EnergyLevel, ObedienceLevel, SelectedOwnerGoal } from "@/types/domain";

export type CreateDogProfileInput = {
  name: string;
  gender: DogGender;
  birthday: string | null;
  ageYears: number | null;
  breed: string;
  ownedSince: string | null;
  adoptionDate: string | null;
  obedienceLevel: ObedienceLevel;
  energyLevel: EnergyLevel;
  goalKeys: string[];
  existingSkillIds: string[];
  targetSkillIds: string[];
  concernKeys: string[];
  concernOtherNote: string | null;
  selectedTrainingGoals: SelectedOwnerGoal[];
  planPreferences?: {
    trainingExperience: string;
    dailyMinutes: number;
    motivation: string;
  };
};

const getErrorText = (error: unknown): string => {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }
  return String(error);
};

const isExistingDogError = (error: unknown): boolean =>
  /dog profile already exists|already exists for this MVP account/i.test(getErrorText(error));

const isMissingTrainingGoalTableError = (error: unknown): boolean =>
  /dog_selected_training_goals|dog_training_pain_points/i.test(getErrorText(error)) &&
  /schema cache|could not find the table|does not exist|PGRST205/i.test(getErrorText(error));

const getExistingDog = async (): Promise<Dog | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dogs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data ? mapDog(data) : null;
};

const saveSelectedTrainingGoals = async (dogId: string, goals: SelectedOwnerGoal[]): Promise<void> => {
  if (goals.length === 0) return;

  const client = getClientOrThrow();

  const { error: deletePainPointsError } = await client
    .from("dog_training_pain_points")
    .delete()
    .eq("dog_id", dogId);
  if (isMissingTrainingGoalTableError(deletePainPointsError)) {
    console.warn("Skipping selected training goal persistence because training-goal tables are missing.", deletePainPointsError);
    return;
  }
  throwIfError(deletePainPointsError);

  const { error: deleteGoalsError } = await client
    .from("dog_selected_training_goals")
    .delete()
    .eq("dog_id", dogId);
  if (isMissingTrainingGoalTableError(deleteGoalsError)) {
    console.warn("Skipping selected training goal persistence because training-goal tables are missing.", deleteGoalsError);
    return;
  }
  throwIfError(deleteGoalsError);

  const { error: goalsError } = await client
    .from("dog_selected_training_goals")
    .upsert(
      goals.map((g) => ({ dog_id: dogId, goal: g.goal, priority_rank: g.priorityRank })),
      { onConflict: "dog_id,goal" },
    );
  if (isMissingTrainingGoalTableError(goalsError)) {
    console.warn("Skipping selected training goal persistence because training-goal tables are missing.", goalsError);
    return;
  }
  throwIfError(goalsError);

  const painPointRows = goals.flatMap((g) =>
    g.selectedPainPoints.map((pp) => ({ dog_id: dogId, goal: g.goal, pain_point_key: pp })),
  );
  if (painPointRows.length > 0) {
    const { error: ppError } = await client
      .from("dog_training_pain_points")
      .upsert(painPointRows, { onConflict: "dog_id,goal,pain_point_key" });
    if (isMissingTrainingGoalTableError(ppError)) {
      console.warn("Skipping selected training pain-point persistence because dog_training_pain_points is missing.", ppError);
      return;
    }
    throwIfError(ppError);
  }
};

const savePlanPreferences = async (
  dogId: string,
  prefs: NonNullable<CreateDogProfileInput["planPreferences"]>,
  selectedTrainingGoals: SelectedOwnerGoal[],
): Promise<void> => {
  try {
    const client = getClientOrThrow();
    const focusGoal = selectedTrainingGoals[0]?.goal ?? null;
    const sectionNumber = focusGoal ? sectionNumberForFocus(focusGoal) : null;

    let preferredSectionId: string | null = null;
    if (sectionNumber !== null) {
      const { data, error } = await client
        .from("training_sections")
        .select("id")
        .eq("section_number", sectionNumber)
        .maybeSingle();
      if (!error && data) preferredSectionId = data.id as string;
    }

    await saveDogTrainingPreferences(dogId, {
      preferredSectionId,
      trainingExperience: prefs.trainingExperience,
      dailyMinutes: prefs.dailyMinutes,
      deliveryStyle: prefs.motivation,
      markOnboardingComplete: true,
    });
  } catch (error) {
    console.warn("Could not save training preferences.", error);
  }
};


export const createDogProfile = async (input: CreateDogProfileInput): Promise<Dog> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("create_dog_profile", {
    dog_name: input.name,
    dog_gender_value: input.gender,
    dog_birthday: input.birthday,
    dog_age_years: input.ageYears,
    dog_breed: input.breed,
    dog_owned_since: input.ownedSince,
    dog_adoption_date: input.adoptionDate,
    dog_obedience_level: input.obedienceLevel,
    dog_energy_level: input.energyLevel,
    goal_keys: input.goalKeys,
    existing_skill_ids: input.existingSkillIds,
    target_skill_ids: input.targetSkillIds,
    concern_keys: input.concernKeys,
    concern_other_note: input.concernOtherNote,
  });

  let dog: Dog;
  if (error && isExistingDogError(error)) {
    const existingDog = await getExistingDog();
    if (!existingDog) {
      throwIfError(error);
      throw new Error("Dog profile already exists, but the existing dog could not be loaded.");
    }
    dog = existingDog;
  } else {
    throwIfError(error);
    dog = mapDog(data);
  }

  const dogId = dog.id;
  await saveSelectedTrainingGoals(dogId, input.selectedTrainingGoals);
  if (input.planPreferences) {
    await savePlanPreferences(dogId, input.planPreferences, input.selectedTrainingGoals);
  }

  client.functions.invoke("generate-roadmap", { body: { dogId } }).catch(console.error);

  return dog;
};
