import { getTrainingPreparation } from '../services/trainingCurriculumService';
import { getClientOrThrow } from '../services/serviceUtils';

jest.mock('../services/serviceUtils', () => ({
  getClientOrThrow: jest.fn(), createIdempotencyKey: jest.fn(),
  throwIfError: (error: unknown) => { if (error) throw error; },
}));

const eq = jest.fn();
const single = jest.fn();
const from = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  const query = { select: jest.fn(), eq, single };
  query.select.mockReturnValue(query);
  eq.mockReturnValue(query);
  from.mockReturnValue(query);
  jest.mocked(getClientOrThrow).mockReturnValue({ from } as unknown as ReturnType<typeof getClientOrThrow>);
});

test('loads the skill-wide materials and safety stored on Level 1', async () => {
  single.mockResolvedValueOnce({ data: { id: 'first-level' }, error: null });
  single.mockResolvedValueOnce({ data: {
    materials: [{ label: 'Treats', detail: 'Small pieces' }],
    safety_copy: 'Start with the door closed.', primary_action: 'Continue', secondary_action: 'End lesson',
  }, error: null });
  const ready = await getTrainingPreparation('skill');
  expect(eq).toHaveBeenCalledWith('skill_id', 'skill');
  expect(eq).toHaveBeenCalledWith('stage_type', 'level');
  expect(eq).toHaveBeenCalledWith('level_number', 1);
  expect(eq).toHaveBeenCalledWith('level_id', 'first-level');
  expect(ready.materials[0].label).toBe('Treats');
  expect(ready.safetyCopy).toBe('Start with the door closed.');
});

test('a missing safety card fails explicitly instead of silently displaying empty preparation', async () => {
  single.mockResolvedValueOnce({ data: { id: 'first-level' }, error: null });
  single.mockResolvedValueOnce({ data: null, error: new Error('Ready card unavailable') });
  await expect(getTrainingPreparation('skill')).rejects.toThrow('Ready card unavailable');
});

test('1-3 uses Drop It preparation without changing remote curriculum', async () => {
  single.mockResolvedValueOnce({ data: { id: 'first-level', training_skills: { skill_code: '1-3' } }, error: null });
  const ready = await getTrainingPreparation('drop-it');
  expect(ready.materials.some(material => material.label === 'A safe toy')).toBe(true);
  expect(ready.safetyCopy).toContain('Never pry');
  expect(from).toHaveBeenCalledTimes(1);
});

test('6-3 prepares the approved managed-space routine for every entry level', async () => {
  single.mockResolvedValueOnce({ data: { id: 'first-level', training_skills: [{ skill_code: '6-3' }] }, error: null });
  const ready = await getTrainingPreparation('chewing');
  expect(ready.materials.some(material => material.label === 'A comfortable space')).toBe(true);
  expect(ready.safetyCopy).toContain('Supervise chewing');
  expect(from).toHaveBeenCalledTimes(1);
});
