// Build immutable migration seed data from the same captions shipped in the app.
// Usage: node scripts/training-review-caption-seed.cjs > new-caption-seed.sql
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const media = path.join(__dirname, '../src/features/train/media');
// Load the same pure media catalog as the app, including the focus selections.
const cache = new Map();
function load(file) {
  const filename = path.resolve(media, file.endsWith('.json') || file.endsWith('.ts') ? file : `${file}.ts`);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const exports = {}; cache.set(filename, exports);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'require', source)(exports, load);
  return exports;
}
const { getTrainingClipLessons } = load('trainingClipLessons');
const codes = [1, 2, 3, 4, 5, 6].flatMap(section => Array.from({ length: section === 5 ? 3 : 5 }, (_, i) => `${section}-${i+1}`));
const courses = Object.fromEntries(codes.map(code => [code, getTrainingClipLessons(code)]));
const captions = Object.entries(courses).flatMap(([code, clips]) => clips.flatMap(clip =>
  clip.steps.flatMap(step => step.cues.map(cue => ({ ...cue, title: step.title })))
    .map((cue, index) => [code, clip.levelNumber, cue.reviewIndex ?? index, cue.title, cue.text, cue.reviewAt ?? cue.at])));
// This one-caption clip teaches both noticing and responding calmly. A second
// quiz concept restates its existing instruction; it seeks the same moment.
captions.push(['5-2', 1, 1, 'Respond calmly to an accident', 'Stay calm and avoid scolding your dog.', 0]);
module.exports = { captions, courses, load };
if (require.main === module) {
  console.log(`-- Generated from app action captions; no user data.
insert into training_private.training_review_captions(skill_code,level_number,cue_index,step_title,caption,cue_at)
select v->>0,(v->>1)::integer,(v->>2)::integer,v->>3,v->>4,(v->>5)::numeric
from jsonb_array_elements($captions$${JSON.stringify(captions)}$captions$::jsonb) v;`);
}
