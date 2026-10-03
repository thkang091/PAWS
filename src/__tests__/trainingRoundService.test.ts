import { getTrainingRoundContext, trainingRoundAction } from '../services/trainingRoundService';
import { getClientOrThrow } from '../services/serviceUtils';
jest.mock('../services/serviceUtils', () => ({ getClientOrThrow: jest.fn(), createIdempotencyKey: () => 'new-round' }));
jest.mock('../services/trainingCurriculumService', () => ({ getEffectiveLocalDate: () => '2026-10-03', mapTrainingSession: (session: unknown) => session }));
const rpc = jest.fn();
beforeEach(() => { jest.resetAllMocks(); jest.mocked(getClientOrThrow).mockReturnValue({rpc} as never); });
test('only a missing migration falls back to the legacy flow', async () => {
  rpc.mockResolvedValue({error:{code:'PGRST202'}});
  await expect(getTrainingRoundContext('dog','skill')).resolves.toBeNull();
  for (const code of ['PGRST301','42501','NETWORK_ERROR']) {
    rpc.mockResolvedValue({error:{code}});
    await expect(getTrainingRoundContext('dog','skill')).rejects.toEqual({code});
  }
});
test('continue binds both round and session so a retry cannot advance its successor', async () => {
  rpc.mockResolvedValue({data:{round:{id:'r'},session:null,levelId:'l',unlocked:false}});
  await trainingRoundAction('dog','skill','continue',{roundId:'r',sessionId:'s'});
  expect(rpc).toHaveBeenCalledWith('training_round_action',{
    p_dog_id:'dog',p_skill_id:'skill',p_action:'continue',p_local_date:'2026-10-03',p_payload:{roundId:'r',sessionId:'s'},
  });
});
