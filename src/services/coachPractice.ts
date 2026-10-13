import AsyncStorage from '@react-native-async-storage/async-storage';
import { getClientOrThrow } from './serviceUtils';
import { getEffectiveLocalDate } from './trainingCurriculumService';
import type { RoundQuestion } from './trainingRoundService';
import type { ChatTurn, CoachReply } from './trainerChat';

export type CoachPracticeContext = {
  dogId: string;
  skillId: string;
  roundId: string;
  sessionId: string;
  question: RoundQuestion;
};

// A step choice and its canned greeting are not a user/Coach exchange.
export function isCoachConversation(history: readonly (ChatTurn & { fromChoice?: boolean })[], reply: CoachReply) {
  return reply.state === 'ready' && reply.text.trim().length > 0
    && history.some(turn => turn.role === 'user' && !turn.fromChoice && (turn.text.trim().length > 0 || Boolean(turn.image)));
}

const key = (dogId: string) => `paws:coach-practice:v1:${dogId}`;
const locks = new Map<string, Promise<unknown>>();
async function serialized<T>(dogId: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(dogId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  locks.set(dogId, next);
  try { return await next; }
  finally { if (locks.get(dogId) === next) locks.delete(dogId); }
}
const read = async (dogId: string): Promise<CoachPracticeContext[]> => JSON.parse(await AsyncStorage.getItem(key(dogId)) ?? '[]');

async function flush(dogId: string) {
  const pending = await read(dogId);
  while (pending.length) {
    const item = pending[0];
    const { error } = await getClientOrThrow().rpc('training_round_action', {
      p_dog_id: dogId, p_skill_id: item.skillId, p_action: 'coach_reply', p_local_date: getEffectiveLocalDate(),
      p_payload: { roundId: item.roundId, sessionId: item.sessionId, question: item.question },
    });
    if (error) throw error;
    pending.shift();
    await AsyncStorage.setItem(key(dogId), JSON.stringify(pending));
  }
}

// Persist only lesson identifiers and an authored caption question, never chat
// text or attachments. Failed saves retry before the next training action.
export async function recordCoachConversation(context: CoachPracticeContext) {
  return serialized(context.dogId, async () => {
    const pending = await read(context.dogId);
    if (!pending.some(item => item.roundId === context.roundId && item.question.level === context.question.level)) {
      pending.push(context);
      await AsyncStorage.setItem(key(context.dogId), JSON.stringify(pending));
    }
    await flush(context.dogId);
  });
}

export async function flushCoachPractice(dogId: string) {
  return serialized(dogId, () => flush(dogId));
}
