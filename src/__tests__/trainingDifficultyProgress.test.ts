import { getAllSectionRoadmaps, getSectionRoadmap, getDogTrainingOverview } from '../services/trainingCurriculumService';
import { getClientOrThrow } from '../services/serviceUtils';
import { areLessonVideosUnlocked } from '../features/train/media/lessonVideoUnlock';

jest.mock('../services/serviceUtils', () => ({
  getClientOrThrow: jest.fn(), createIdempotencyKey: jest.fn(),
  throwIfError: (error: unknown) => { if (error) throw error; },
}));

const section = { id: 'section', section_number: 1, title: 'Rules', slug: 'rules' };
const skill = { id: 'skill', section_id: 'section', skill_code: '1-1', title: 'Wait', sort_order: 1 };
const progress = { skill_id: 'skill', current_level_number: 5, status: 'in_progress', checkpoint_status: 'not_eligible',
  level5_completed_at: '2026-10-06', training_skills: { ...skill, training_sections: { title: 'Rules' } } };
let pending: { training_levels: { skill_id: string } }[];
let difficultyError: Error | null;
const filters = jest.fn();

beforeEach(() => {
  pending = [{ training_levels: { skill_id: 'skill' } }];
  difficultyError = null;
  filters.mockClear();
  jest.mocked(getClientOrThrow).mockReturnValue({ from: (table: string) => {
    const data = table === 'training_sections' ? [section] : table === 'training_skills' ? [skill]
      : table === 'dog_training_skill_progress' ? [progress] : pending;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters(table, key, value); return query; },
      is: (key: string, value: unknown) => { filters(table, key, value); return query; },
      order: () => query,
      single: () => Promise.resolve({ data: data[0], error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: table === 'training_level_difficulties' ? difficultyError : null }).then(resolve),
    };
    return query;
  } } as unknown as ReturnType<typeof getClientOrThrow>);
});

test('roadmap, section and history all withhold completion while difficulty remains', async () => {
  const [roadmaps, roadmap, history] = await Promise.all([
    getAllSectionRoadmaps('dog'), getSectionRoadmap('dog','section'), getDogTrainingOverview('dog'),
  ]);
  for (const item of [roadmaps[0].nodes[0].progress, roadmap.nodes[0].progress, history[0].progress]) {
    expect(item?.needsReinforcement).toBe(true);
    expect(item?.level5CompletedAt).toBe('2026-10-06');
    expect(areLessonVideosUnlocked(item)).toBe(false);
  }
  expect(filters).toHaveBeenCalledWith('training_level_difficulties','dog_id','dog');
  expect(filters).toHaveBeenCalledWith('training_level_difficulties','resolved_at',null);
});

test('resolved or another lesson difficulty does not block this completed lesson', async () => {
  for (const rows of [[], [{ training_levels: { skill_id: 'another-skill' } }]]) {
    pending = rows;
    const [roadmap] = await getAllSectionRoadmaps('dog');
    expect(areLessonVideosUnlocked(roadmap.nodes[0].progress)).toBe(true);
  }
});

test('failed difficulty loading does not incorrectly show completed lessons', async () => {
  difficultyError = new Error('offline');
  await expect(getAllSectionRoadmaps('dog')).rejects.toThrow('offline');
});
