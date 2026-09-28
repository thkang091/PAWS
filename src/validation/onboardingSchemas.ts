import { z } from "zod";

import type { OwnerTrainingGoal } from "@/types/domain";

const OWNER_TRAINING_GOALS = [
  'BETTER_BEHAVIOR_AT_HOME',
  'SAFETY_AND_OBEDIENCE',
  'BETTER_WALKS',
  'COOL_TRICKS_AND_GAMES',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'CALM_ALONE_TIME',
  'RULES_AND_BOUNDARIES',
  'CLEAR_COMMUNICATION',
  'HANDLING_AND_GROOMING',
  'CALM_EVERYDAY_MANNERS',
  'PROBLEM_BEHAVIORS',
  'POTTY_AND_REAL_WORLD',
  'NOT_SURE_YET',
  'SOMETHING_ELSE',
  'DOING_WELL',
  'HEALTHY_HABITS',
  'SOCIAL_SKILLS',
] as const satisfies readonly OwnerTrainingGoal[];

const ownerTrainingGoalSchema = z.enum(OWNER_TRAINING_GOALS);

const selectedOwnerGoalSchema = z.object({
  goal: ownerTrainingGoalSchema,
  priorityRank: z.number().int().min(1).max(6),
  selectedPainPoints: z.array(z.string()),
});

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1, "Dog name is required."),
    gender: z.enum(["female", "male", "unknown"]),
    birthday: z.string().trim().nullable(),
    ageYears: z.number().min(0).max(30).nullable(),
    breed: z.string().trim().min(1, "Breed is required."),
    ownedSince: z.string().trim().nullable(),
    adoptionDate: z.string().trim().nullable(),
    obedienceLevel: z.enum(["beginner", "basic", "intermediate", "advanced"]),
    energyLevel: z.enum(["low", "moderate", "high", "very_high"]),
    goalKeys: z.array(z.string()),
    existingSkillIds: z.array(z.string()),
    targetSkillIds: z.array(z.string()),
    concernKeys: z.array(z.string()),
    concernOtherNote: z.string().trim().nullable(),
    selectedTrainingGoals: z
      .array(selectedOwnerGoalSchema)
      .min(1, "Choose at least one training goal.")
      .max(6, "You can select at most 6 training goals.")
      .refine(
        (goals) => new Set(goals.map((g) => g.goal)).size === goals.length,
        { message: "Each training goal may only be selected once." },
      )
      .refine(
        (goals) => {
          const ranks = goals.map((g) => g.priorityRank);
          return new Set(ranks).size === ranks.length;
        },
        { message: "Each selected goal must have a unique priority rank." },
      ),
  })
  .refine((value) => value.birthday || value.ageYears !== null, {
    message: "Add a birthday or approximate age.",
    path: ["birthday"],
  });

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export const onboardingFlowSchema = z.object({
  name: z.string().trim().min(1, "Add your dog's name."),
  ageBucket: z.enum(["puppy", "young_adult", "senior", "unsure"], {
    message: "Pick an age range.",
  }),
  together: z.enum(["just_home", "under_a_month", "a_few_months", "a_year_plus"], {
    message: "Tell us how long you have been together.",
  }),
  selectedTrainingGoals: z
    .array(selectedOwnerGoalSchema)
    .length(1, "Choose what to work on first."),
  experience: z.enum(["brand_new", "knows_basics", "experienced"], {
    message: "Tell us how much training experience you have.",
  }),
  dailyMinutes: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(15)], {
    message: "Pick how much time feels realistic.",
  }),
  motivation: z.enum(["treats", "toys", "play", "praise", "not_sure"], {
    message: "Pick what your dog works for.",
  }),
  obedienceLevel: z.enum(["beginner", "basic", "intermediate", "advanced"]),
  energyLevel: z.enum(["low", "moderate", "high", "very_high"]),
});

export type OnboardingFlowValues = z.infer<typeof onboardingFlowSchema>;

export const onboardingStageOneSchema = onboardingFlowSchema.pick({
  name: true,
  ageBucket: true,
  together: true,
});
