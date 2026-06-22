import { z } from "zod";

export const careEventSchema = z
  .object({
    eventType: z.enum(["walk", "vet", "grooming", "medication", "training", "playtime", "custom"]),
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().trim().nullable(),
    startTime: z.string().trim().min(1, "Start time is required."),
    endTime: z.string().trim().nullable(),
  })
  .refine((value) => !value.endTime || new Date(value.endTime) >= new Date(value.startTime), {
    message: "End time must be after the start time.",
    path: ["endTime"],
  });

export type CareEventFormValues = z.infer<typeof careEventSchema>;
