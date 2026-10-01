# Rules & Boundaries: acquired footage for 1-3, 1-4, 1-5

All three courses have five bundled Level videos and action captions using the
same player, 0.6x speed, caption seeking, scrolling and completion latch as 1-1/1-2.
Caption times remain source-video seconds; speed changes do not change offsets.

## Source mapping

Source root: `C:/Users/Minjae/Desktop/PAWS_vid/Actual`.
Only acquired live-action footage is used. Existing edited demos' title cards
are replaced by the app's tappable action captions. Original baked-in source
graphics remain. Audio is omitted from these bundled exports.

| Course | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 |
| --- | --- | --- | --- | --- | --- |
| 1-3 Drop It | C01 | C02, B02 | C03 | C04 | B01 |
| 1-4 Start a Potty Routine (`v2`) | C01, C02 | C03, C10, C11 | C04, C06, C07 | C08, C09, C04, C05, C07 | C08, C04, C05, C07 |
| 1-5 Pause Unnecessary Barking | C01, C02, C03, C08 | C04, C05, C08 | C06, C05, C07, C08 | C09, C05, C07, C08 | C10, C07, C08 |

Every raw clip from these source manifests appears in at least one Level.
Separate demonstrations are identified in captions rather than presented as a
single continuous attempt. In 1-4 Levels 1–2, mat footage illustrates movement
to a location, not elimination; captions explicitly direct practice to the
potty area and do not require a sit/down. In 1-5, capturing calm, a quiet cue,
moving to a resting spot and release are distinct examples.

## App-only Drop It curriculum

`dropItContent.ts` replaces 1-3's roadmap/overview title, common preparation,
Level goals, help cards and checkpoint text. Existing skill, Level and card IDs
are preserved for progress and result reporting. No remote curriculum rows or
progress data are changed. Other clients still see the server's original 1-3
curriculum until a separate DB update is approved.

## Rebuilding

Run `python scripts/build-basic-rules-clips.py --source <Actual folder> --ffmpeg <executable>`.
The script reads the source manifests and writes the three asset directories,
`basicRulesLessons.generated.json` and `basicRulesAssets.generated.ts`.
It normalizes to 30 fps/1280×720, preserves aspect ratio and pads when necessary.
Tiny source container/video tail differences are filled with the last frame
before concatenation so caption offsets match the exported frame counts.
Edit captions and sequences in the builder, not only the generated JSON.

## Verification

Focused tests cover all cue ranges, five-Level registration, same-course
Continue, final-Level exit, preparation and app-only content identity handling.
The development media preview supports `?skill=1-3`, `1-4`, `1-5` and uses the
production playback hook and caption/timeline components without spending
Energy or recording training outcomes.

Final validation: TypeScript and 70 focused tests passed. Browser checks passed
for all 15 exported files at 0.6x, every caption seek, completion/replay latch and
next-Level navigation; decoded frame counts and player durations match the
generated timelines. Pixel 7 displayed the updated Drop It preparation and
played the new 1-5 footage through the shared native preview. Its existing
Energy balance was zero, so no live training outcomes were created for testing.
