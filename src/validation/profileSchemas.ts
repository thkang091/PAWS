import { onboardingSchema } from "@/validation/onboardingSchemas";
import { z } from "zod";

export const profileSchema = onboardingSchema.omit({ name: true }).extend({
  name: onboardingSchema.shape.name,
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
