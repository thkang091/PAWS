import { makeRefresherQuestion } from '../features/train/rounds/refresherQuestion';
import { getTrainingClipLessons } from '../features/train/media/trainingClipLessons';
const codes = Array.from({length:6},(_,i)=>Array.from({length:5},(_,j)=>`${i+1}-${j+1}`)).flat();
test('every available clip cue yields a targeted, seekable refresher with one correct answer', () => {
  let count=0;
  for (const code of codes) for (const clip of getTrainingClipLessons(code)) {
    for (const step of clip.steps) for (const cue of step.cues) {
      const q=makeRefresherQuestion(code,'Lesson',clip,cue.at);
      expect(q.options.find(o=>o.id===q.correctOptionId)?.label).toBe(cue.text);
      expect(new Set(q.options.map(o=>o.label)).size).toBe(3);
      expect(q.cueAt).toBe(cue.at);
      expect(q.cueAt).toBeLessThan(clip.duration);
      expect(q.prompt).toContain(step.title);
      expect(q.prompt).not.toMatch(/Level\s*\d|L[1-5]\b/);
      count++;
    }
  }
  expect(count).toBeGreaterThan(400);
});
test('same concept keeps a stable identity on help retry and correct option position varies', () => {
  const clips=getTrainingClipLessons('1-1');
  expect(makeRefresherQuestion('1-1','Door',clips[0],0).id).toBe(makeRefresherQuestion('1-1','Door',clips[0],0.1).id);
  expect(new Set(clips.map(clip=>makeRefresherQuestion('1-1','Door',clip,0).options.findIndex(o=>o.id==='0'))).size).toBe(3);
});
