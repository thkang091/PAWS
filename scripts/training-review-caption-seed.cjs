// Build immutable migration seed data from the same captions shipped in the app.
// Usage: node scripts/training-review-caption-seed.cjs > new-caption-seed.sql
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const media = path.join(__dirname, '../src/features/train/media');
function constants(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(media, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', source)(exports);
  return exports;
}
const courses = {
  '1-1': constants('doorwayWaitLesson.ts').DOORWAY_WAIT_LESSONS,
  '1-2': constants('furnitureBoundaryLesson.ts').FURNITURE_BOUNDARY_LESSONS,
};
for (const file of ['basicRulesLessons', 'sections23Lessons', 'section4Lessons', 'section5Lessons', 'section6Lessons']) {
  Object.assign(courses, JSON.parse(fs.readFileSync(path.join(media, `${file}.generated.json`), 'utf8')));
}
const captions = Object.entries(courses).flatMap(([code, clips]) => clips.flatMap(clip =>
  clip.steps.flatMap(step => step.cues.map(cue => ({ ...cue, title: step.title })))
    .map((cue, index) => [code, clip.levelNumber, index, cue.title, cue.text, cue.at])));
// This one-caption clip teaches both noticing and responding calmly. A second
// quiz concept restates its existing instruction; it seeks the same moment.
captions.push(['5-2', 1, 1, 'Respond calmly to an accident', 'Stay calm and avoid scolding your dog.', 0]);
module.exports = { captions };
if (require.main === module) {
  console.log(`-- Generated from app action captions; no user data.
insert into training_private.training_review_captions(skill_code,level_number,cue_index,step_title,caption,cue_at)
select v->>0,(v->>1)::integer,(v->>2)::integer,v->>3,v->>4,(v->>5)::numeric
from jsonb_array_elements($captions$${JSON.stringify(captions)}$captions$::jsonb) v;`);
}
