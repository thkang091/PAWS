import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";

const today = () => new Date().toISOString().slice(0, 10);

// ── Types ────────────────────────────────────────────────────────────────────

export type CareProfile = {
  id: string;
  dogId: string;
  dailyExerciseGoalMinutes: number;
  mealsPerDay: number;
  portionGramsPerMeal: number | null;
  foodBrand: string | null;
  onboardingCompleted: boolean;
};

export type Vaccination = {
  id: string;
  dogId: string;
  vaccineKey: string;
  vaccineName: string;
  dateGiven: string;
  nextDueDate: string | null;
  vetName: string | null;
  notes: string | null;
};

export type Medication = {
  id: string;
  dogId: string;
  medicationName: string;
  dosage: string | null;
  frequency: string;
  startDate: string;
  endDate: string | null;
  reminderTime: string | null;
  isActive: boolean;
  notes: string | null;
};

export type MedicationLog = {
  id: string;
  medicationId: string;
  dogId: string;
  givenDate: string;
};

export type ExerciseLog = {
  id: string;
  dogId: string;
  logDate: string;
  activityType: string;
  durationMinutes: number;
  distanceMiles: number | null;
  walkCount: number | null;
  notes: string | null;
};

export type GroomingLog = {
  id: string;
  dogId: string;
  groomingType: string;
  doneDate: string;
  nextDueDate: string | null;
  notes: string | null;
};

// ── Care Profile ─────────────────────────────────────────────────────────────

export const getCareProfile = async (dogId: string): Promise<CareProfile | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_care_profile")
    .select("*")
    .eq("dog_id", dogId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    dailyExerciseGoalMinutes: data.daily_exercise_goal_minutes as number,
    mealsPerDay: data.meals_per_day as number,
    portionGramsPerMeal: data.portion_grams_per_meal as number | null,
    foodBrand: data.food_brand as string | null,
    onboardingCompleted: data.onboarding_completed as boolean,
  };
};

export const upsertCareProfile = async (
  dogId: string,
  patch: Partial<Omit<CareProfile, "id" | "dogId">>,
): Promise<CareProfile> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_care_profile")
    .upsert({
      dog_id: dogId,
      owner_id: ownerId,
      daily_exercise_goal_minutes: patch.dailyExerciseGoalMinutes ?? 60,
      meals_per_day: patch.mealsPerDay ?? 2,
      portion_grams_per_meal: patch.portionGramsPerMeal ?? null,
      food_brand: patch.foodBrand ?? null,
      onboarding_completed: patch.onboardingCompleted ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "dog_id" })
    .select()
    .single();
  throwIfError(error);
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    dailyExerciseGoalMinutes: data.daily_exercise_goal_minutes as number,
    mealsPerDay: data.meals_per_day as number,
    portionGramsPerMeal: data.portion_grams_per_meal as number | null,
    foodBrand: data.food_brand as string | null,
    onboardingCompleted: data.onboarding_completed as boolean,
  };
};

// ── Vaccinations ─────────────────────────────────────────────────────────────

export const getVaccinations = async (dogId: string): Promise<Vaccination[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_vaccinations")
    .select("*")
    .eq("dog_id", dogId)
    .order("date_given", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dogId: r.dog_id as string,
    vaccineKey: r.vaccine_key as string,
    vaccineName: r.vaccine_name as string,
    dateGiven: r.date_given as string,
    nextDueDate: r.next_due_date as string | null,
    vetName: r.vet_name as string | null,
    notes: r.notes as string | null,
  }));
};

export const saveVaccination = async (
  dogId: string,
  input: { vaccineKey: string; vaccineName: string; dateGiven: string; nextDueDate?: string | null; vetName?: string | null; notes?: string | null },
): Promise<Vaccination> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_vaccinations")
    .insert({
      dog_id: dogId,
      owner_id: ownerId,
      vaccine_key: input.vaccineKey,
      vaccine_name: input.vaccineName,
      date_given: input.dateGiven,
      next_due_date: input.nextDueDate ?? null,
      vet_name: input.vetName ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  throwIfError(error);
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    vaccineKey: data.vaccine_key as string,
    vaccineName: data.vaccine_name as string,
    dateGiven: data.date_given as string,
    nextDueDate: data.next_due_date as string | null,
    vetName: data.vet_name as string | null,
    notes: data.notes as string | null,
  };
};

export const deleteVaccination = async (id: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_vaccinations").delete().eq("id", id);
  throwIfError(error);
};

// ── Medications ──────────────────────────────────────────────────────────────

export const getMedications = async (dogId: string): Promise<Medication[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_medications")
    .select("*")
    .eq("dog_id", dogId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dogId: r.dog_id as string,
    medicationName: r.medication_name as string,
    dosage: r.dosage as string | null,
    frequency: r.frequency as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string | null,
    reminderTime: r.reminder_time as string | null,
    isActive: r.is_active as boolean,
    notes: r.notes as string | null,
  }));
};

export const saveMedication = async (
  dogId: string,
  input: { medicationName: string; dosage?: string | null; frequency: string; startDate: string; endDate?: string | null; reminderTime?: string | null; notes?: string | null },
): Promise<Medication> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_medications")
    .insert({
      dog_id: dogId,
      owner_id: ownerId,
      medication_name: input.medicationName,
      dosage: input.dosage ?? null,
      frequency: input.frequency,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      reminder_time: input.reminderTime ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  throwIfError(error);
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    medicationName: data.medication_name as string,
    dosage: data.dosage as string | null,
    frequency: data.frequency as string,
    startDate: data.start_date as string,
    endDate: data.end_date as string | null,
    reminderTime: data.reminder_time as string | null,
    isActive: data.is_active as boolean,
    notes: data.notes as string | null,
  };
};

export const deleteMedication = async (id: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_medications").update({ is_active: false }).eq("id", id);
  throwIfError(error);
};

export const logMedicationGiven = async (
  dogId: string,
  medicationId: string,
): Promise<void> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  await client.from("dog_medication_logs").insert({
    medication_id: medicationId,
    dog_id: dogId,
    owner_id: ownerId,
    given_date: today(),
  });
};

export const getTodayMedicationLogs = async (dogId: string): Promise<MedicationLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_medication_logs")
    .select("*")
    .eq("dog_id", dogId)
    .eq("given_date", today());
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    medicationId: r.medication_id as string,
    dogId: r.dog_id as string,
    givenDate: r.given_date as string,
  }));
};

// ── Exercise ─────────────────────────────────────────────────────────────────

export const getTodayExerciseLogs = async (dogId: string): Promise<ExerciseLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_exercise_logs")
    .select("*")
    .eq("dog_id", dogId)
    .eq("log_date", today())
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dogId: r.dog_id as string,
    logDate: r.log_date as string,
    activityType: r.activity_type as string,
    durationMinutes: r.duration_minutes as number,
    distanceMiles: r.distance_miles as number | null,
    walkCount: r.walk_count as number | null,
    notes: r.notes as string | null,
  }));
};

export const logExercise = async (
  dogId: string,
  input: { activityType: string; durationMinutes: number; distanceMiles?: number | null; walkCount?: number | null; notes?: string | null },
): Promise<ExerciseLog> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_exercise_logs")
    .insert({
      dog_id: dogId,
      owner_id: ownerId,
      log_date: today(),
      activity_type: input.activityType,
      duration_minutes: input.durationMinutes,
      distance_miles: input.distanceMiles ?? null,
      walk_count: input.walkCount ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  throwIfError(error);
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    logDate: data.log_date as string,
    activityType: data.activity_type as string,
    durationMinutes: data.duration_minutes as number,
    distanceMiles: data.distance_miles as number | null,
    walkCount: data.walk_count as number | null,
    notes: data.notes as string | null,
  };
};

// ── Grooming ─────────────────────────────────────────────────────────────────

export const getGroomingLogs = async (dogId: string): Promise<GroomingLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_grooming_logs")
    .select("*")
    .eq("dog_id", dogId)
    .order("done_date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dogId: r.dog_id as string,
    groomingType: r.grooming_type as string,
    doneDate: r.done_date as string,
    nextDueDate: r.next_due_date as string | null,
    notes: r.notes as string | null,
  }));
};

export const logGrooming = async (
  dogId: string,
  input: { groomingType: string; doneDate?: string; nextDueDate?: string | null; notes?: string | null },
): Promise<GroomingLog> => {
  const client = getClientOrThrow();
  const { data: user } = await client.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("dog_grooming_logs")
    .insert({
      dog_id: dogId,
      owner_id: ownerId,
      grooming_type: input.groomingType,
      done_date: input.doneDate ?? today(),
      next_due_date: input.nextDueDate ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  throwIfError(error);
  return {
    id: data.id as string,
    dogId: data.dog_id as string,
    groomingType: data.grooming_type as string,
    doneDate: data.done_date as string,
    nextDueDate: data.next_due_date as string | null,
    notes: data.notes as string | null,
  };
};
