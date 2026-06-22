import {
  createIdempotencyKey,
  getClientOrThrow,
  mapProgress,
  mapSkill,
  throwIfError,
} from "@/services/serviceUtils";
import type { DogStatus, TrainingProgress, TrainingSkill } from "@/types/domain";
import type { Json, TrainingProgressRow } from "@/types/database";

export type TrainingCompletionResult = {
  progress: TrainingProgress;
  silverEarned: number;
  xpEarned: number;
  status: DogStatus;
};

export const getTrainingSkills = async (): Promise<TrainingSkill[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("training_skills").select("*").eq("is_active", true).order("difficulty").order("name");
  throwIfError(error);
  return (data ?? []).map(mapSkill);
};

export const getTrainingProgress = async (dogId: string): Promise<TrainingProgress[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("dog_training_progress").select("*").eq("dog_id", dogId);
  throwIfError(error);
  return (data ?? []).map(mapProgress);
};

type CompletionJson = {
  progress: TrainingProgressRow;
  silverEarned: number;
  xpEarned: number;
  status: DogStatus;
};

export const completeTrainingSession = async (dogId: string, skillId: string): Promise<TrainingCompletionResult> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("complete_training_session", {
    target_dog_id: dogId,
    target_skill_id: skillId,
    request_key: createIdempotencyKey("training"),
  });
  throwIfError(error);
  const result = data as Json as CompletionJson;
  return {
    progress: mapProgress(result.progress),
    silverEarned: result.silverEarned,
    xpEarned: result.xpEarned,
    status: result.status,
  };
};
