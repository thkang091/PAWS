import { z } from "zod";

const ownerTrainingGoalSchema = z.enum([
  'BETTER_BEHAVIOR_AT_HOME',
  'SAFETY_AND_OBEDIENCE',
  'BETTER_WALKS',
  'COOL_TRICKS_AND_GAMES',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'CALM_ALONE_TIME',
]);

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
    // Legacy field kept for backward-compatibility with create_dog_profile RPC.
    goalKeys: z.array(z.string()),
    existingSkillIds: z.array(z.string()),
    targetSkillIds: z.array(z.string()),
    concernKeys: z.array(z.string()),
    concernOtherNote: z.string().trim().nullable(),
    // New personalized training goals (required for new onboarding flow).
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
