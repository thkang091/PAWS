export type BreedExerciseData = {
  minutesMin: number;
  minutesMax: number;
  label: string;
  energyTier: "low" | "medium" | "high" | "very_high";
};

export const BREED_EXERCISE_DATA: Record<string, BreedExerciseData> = {
  // Very high energy
  border_collie: { minutesMin: 90, minutesMax: 120, label: "Border Collie", energyTier: "very_high" },
  australian_shepherd: { minutesMin: 90, minutesMax: 120, label: "Australian Shepherd", energyTier: "very_high" },
  siberian_husky: { minutesMin: 90, minutesMax: 120, label: "Siberian Husky", energyTier: "very_high" },
  malinois: { minutesMin: 90, minutesMax: 120, label: "Belgian Malinois", energyTier: "very_high" },
  jack_russell: { minutesMin: 60, minutesMax: 90, label: "Jack Russell Terrier", energyTier: "very_high" },
  weimaraner: { minutesMin: 90, minutesMax: 120, label: "Weimaraner", energyTier: "very_high" },
  dalmatian: { minutesMin: 60, minutesMax: 90, label: "Dalmatian", energyTier: "very_high" },
  // High energy
  golden_retriever: { minutesMin: 60, minutesMax: 90, label: "Golden Retriever", energyTier: "high" },
  labrador: { minutesMin: 60, minutesMax: 90, label: "Labrador Retriever", energyTier: "high" },
  german_shepherd: { minutesMin: 60, minutesMax: 90, label: "German Shepherd", energyTier: "high" },
  doberman: { minutesMin: 60, minutesMax: 90, label: "Doberman Pinscher", energyTier: "high" },
  boxer: { minutesMin: 60, minutesMax: 90, label: "Boxer", energyTier: "high" },
  rottweiler: { minutesMin: 60, minutesMax: 90, label: "Rottweiler", energyTier: "high" },
  vizsla: { minutesMin: 60, minutesMax: 90, label: "Vizsla", energyTier: "high" },
  standard_poodle: { minutesMin: 45, minutesMax: 60, label: "Standard Poodle", energyTier: "high" },
  // Medium energy
  beagle: { minutesMin: 45, minutesMax: 60, label: "Beagle", energyTier: "medium" },
  cocker_spaniel: { minutesMin: 30, minutesMax: 60, label: "Cocker Spaniel", energyTier: "medium" },
  bernese: { minutesMin: 30, minutesMax: 60, label: "Bernese Mountain Dog", energyTier: "medium" },
  great_dane: { minutesMin: 30, minutesMax: 60, label: "Great Dane", energyTier: "medium" },
  miniature_poodle: { minutesMin: 30, minutesMax: 45, label: "Miniature Poodle", energyTier: "medium" },
  schnauzer: { minutesMin: 30, minutesMax: 45, label: "Schnauzer", energyTier: "medium" },
  shiba_inu: { minutesMin: 45, minutesMax: 60, label: "Shiba Inu", energyTier: "medium" },
  corgi: { minutesMin: 45, minutesMax: 60, label: "Corgi", energyTier: "medium" },
  // Low energy
  bulldog: { minutesMin: 20, minutesMax: 40, label: "Bulldog", energyTier: "low" },
  basset_hound: { minutesMin: 30, minutesMax: 45, label: "Basset Hound", energyTier: "low" },
  shih_tzu: { minutesMin: 20, minutesMax: 30, label: "Shih Tzu", energyTier: "low" },
  chihuahua: { minutesMin: 20, minutesMax: 30, label: "Chihuahua", energyTier: "low" },
  pekingese: { minutesMin: 15, minutesMax: 30, label: "Pekingese", energyTier: "low" },
  maltese: { minutesMin: 20, minutesMax: 30, label: "Maltese", energyTier: "low" },
  french_bulldog: { minutesMin: 20, minutesMax: 30, label: "French Bulldog", energyTier: "low" },
  cavalier: { minutesMin: 30, minutesMax: 45, label: "Cavalier King Charles", energyTier: "low" },
  mixed: { minutesMin: 45, minutesMax: 60, label: "Mixed Breed", energyTier: "medium" },
};

export const DEFAULT_EXERCISE_MINUTES = 60;

export function getBreedExerciseGoal(breed: string): number {
  const normalized = breed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const entry = Object.entries(BREED_EXERCISE_DATA).find(([key]) =>
    normalized.includes(key) || key.includes(normalized.split("_")[0])
  );
  const data = entry?.[1];
  return data ? Math.round((data.minutesMin + data.minutesMax) / 2) : DEFAULT_EXERCISE_MINUTES;
}

export const BREED_STEPS_PER_MINUTE: Record<"low" | "medium" | "high" | "very_high", number> = {
  low: 55,
  medium: 70,
  high: 80,
  very_high: 95,
};

export function getBreedEnergyTier(breed: string): "low" | "medium" | "high" | "very_high" {
  const normalized = breed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const entry = Object.entries(BREED_EXERCISE_DATA).find(([key]) =>
    normalized.includes(key) || key.includes(normalized.split("_")[0])
  );
  return entry?.[1]?.energyTier ?? "medium";
}

export function getBreedDailyStepGoal(breed: string): number {
  const normalized = breed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const entry = Object.entries(BREED_EXERCISE_DATA).find(([key]) =>
    normalized.includes(key) || key.includes(normalized.split("_")[0])
  );
  const data = entry?.[1];
  if (!data) return 8000;
  const avgMin = (data.minutesMin + data.minutesMax) / 2;
  return Math.round((avgMin * BREED_STEPS_PER_MINUTE[data.energyTier]) / 500) * 500;
}

export type VaccineSchedule = {
  key: string;
  name: string;
  intervalMonths: number;
  required: boolean;
  description: string;
};

export const VACCINE_SCHEDULE: VaccineSchedule[] = [
  { key: "rabies", name: "Rabies", intervalMonths: 36, required: true, description: "Core vaccine. Required by law in most states." },
  { key: "dhpp", name: "DHPP (Distemper/Parvo)", intervalMonths: 36, required: true, description: "Core 4-in-1 — distemper, hepatitis, parvovirus, parainfluenza." },
  { key: "bordetella", name: "Bordetella (Kennel Cough)", intervalMonths: 12, required: false, description: "Recommended if your dog visits parks, groomers, or boarding." },
  { key: "leptospirosis", name: "Leptospirosis", intervalMonths: 12, required: false, description: "Recommended for dogs exposed to wildlife or standing water." },
  { key: "lyme", name: "Lyme Disease", intervalMonths: 12, required: false, description: "Recommended in tick-endemic regions." },
  { key: "influenza", name: "Canine Influenza", intervalMonths: 12, required: false, description: "Recommended for dogs in social environments." },
];

export type GroomingType = {
  key: string;
  label: string;
  icon: string;
  intervalDays: number;
  description: string;
};

export const GROOMING_TYPES: GroomingType[] = [
  { key: "bath", label: "Bath", icon: "water-outline", intervalDays: 21, description: "Every 3 weeks for most breeds." },
  { key: "nail_trim", label: "Nail trim", icon: "cut-outline", intervalDays: 21, description: "Every 3 weeks to prevent overgrowth." },
  { key: "ear_clean", label: "Ear clean", icon: "ear-outline", intervalDays: 14, description: "Every 2 weeks. Weekly for floppy-eared breeds." },
  { key: "teeth_brush", label: "Teeth brush", icon: "fitness-outline", intervalDays: 1, description: "Daily brushing prevents 80% of dental disease." },
  { key: "haircut", label: "Haircut", icon: "cut-outline", intervalDays: 42, description: "Every 6 weeks for long-coated breeds." },
  { key: "flea_tick", label: "Flea & tick treatment", icon: "bug-outline", intervalDays: 30, description: "Monthly preventative treatment." },
];

export const MEDICATION_FREQUENCIES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "as_needed", label: "As needed" },
];

export const ACTIVITY_TYPES = [
  { key: "walk", label: "Walk", icon: "walk-outline" },
  { key: "run", label: "Run", icon: "fitness-outline" },
  { key: "play", label: "Playtime", icon: "football-outline" },
  { key: "swim", label: "Swim", icon: "water-outline" },
  { key: "training", label: "Training session", icon: "barbell-outline" },
];

export function groomingDueDate(lastDoneDate: string, intervalDays: number): Date {
  const d = new Date(lastDoneDate);
  d.setDate(d.getDate() + intervalDays);
  return d;
}

export function isGroomingOverdue(lastDoneDate: string, intervalDays: number): boolean {
  return groomingDueDate(lastDoneDate, intervalDays) <= new Date();
}

export function daysUntilGrooming(lastDoneDate: string, intervalDays: number): number {
  const due = groomingDueDate(lastDoneDate, intervalDays);
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}
