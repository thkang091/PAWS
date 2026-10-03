import { getClientOrThrow, createIdempotencyKey } from "./serviceUtils";
import { getEffectiveLocalDate, mapTrainingSession } from "./trainingCurriculumService";
import type { TrainingSession, TrainingEnergy } from "@/types/domain";
import type { TrainingReviewQuestion, TrainingReviewAnswer } from "@/features/train/components/flow/TrainingReviewQuiz";

export type RoundQuestion = TrainingReviewQuestion & { skillCode: string };
export type TrainingRound = {
  id: string;
  status: "active" | "completed" | "ended";
  phase: "quiz" | "practice" | "complete";
  current_session_id: string;
  review_items: { eventId: string; question: RoundQuestion }[];
  answers: TrainingReviewAnswer[];
  quiz_cursor: number;
  acknowledged_at: string | null;
};
export type TrainingRoundContext = {
  round: TrainingRound | null;
  session: TrainingSession | null;
  levelId: string;
  unlocked: boolean;
  canResume: boolean;
  energy: TrainingEnergy;
};
export type RoundAction = "get" | "start" | "help" | "answer" | "advance_quiz" | "continue" | "ack" | "end";
export const newRoundKey = () => createIdempotencyKey("training-round");

export async function trainingRoundAction(dogId: string, skillId: string, action: RoundAction, payload: Record<string, unknown> = {}): Promise<TrainingRoundContext> {
  const { data, error } = await getClientOrThrow().rpc("training_round_action", {
    p_dog_id: dogId, p_skill_id: skillId, p_action: action,
    p_local_date: getEffectiveLocalDate(), p_payload: payload,
  });
  if (error) throw error;
  const result = data as Omit<TrainingRoundContext, "session"> & { session: Record<string, unknown> | null };
  return { ...result, session: result.session ? mapTrainingSession(result.session) : null };
}

/** Only a missing migration falls back to the previous working flow. Offline,
 * auth, and other failures must not silently start a different paid session. */
export async function getTrainingRoundContext(dogId: string, skillId: string): Promise<TrainingRoundContext | null> {
  try { return await trainingRoundAction(dogId, skillId, "get"); }
  catch (error) {
    if ((error as { code?: string }).code === "PGRST202") return null;
    throw error;
  }
}
