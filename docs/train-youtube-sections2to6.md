# Sections 2–6 original YouTube playback — 2026-10-04

Section 1's completed state was committed and pushed to GitHub **before** these
changes: [`ec5718f2bbdc13ed8c0f30ef1f636716c129a2e2`](https://github.com/thkang091/PAWS/commit/ec5718f2bbdc13ed8c0f30ef1f636716c129a2e2),
on `train` (`Checkpoint Section 1 YouTube training playback`). This is the
rollback baseline; these Sections 2–6 changes are separate from that checkpoint.

## Scope

| Section | Lessons | Internal clip levels converted |
| --- | ---: | ---: |
| 2 | 5 | 25 |
| 3 | 5 | 25 |
| 4 | 5 | 25 |
| 5 | 3 | 15 |
| 6 | 5 | 25 |
| Total | 23 | 115 |

All 28 existing lessons / 140 internal levels now resolve to the official
YouTube player. No acquired lesson remains on the bundled MP4 path. Historical
media files and their native registries remain on disk for provenance/rollback,
but are not imported by the runtime. Preparation and unlocked-library artwork
uses the existing JPGs, including reused poster aliases.

This changes the media mapping only. Existing lesson IDs, caption text/times,
preparation copy, three-clip rounds, Energy, two-question review quizzes,
Continue/Help behavior and completion unlocks remain as at the checkpoint.
There is no new free-viewing entry, Example tab or Next example button.

The same `YouTubeTrainingClip` and playback hook serve live training, quiz
rewatch, unlocked videos and development preview. Multiple original intervals
continue automatically within a clip. Captions can seek across originals;
Replay starts the first interval. Continue remains an explicit user action.
The Section 1 settings behavior and nearest supported 0.6x pace are unchanged
(all 59 tested originals supported and played at 0.5x). Original branding,
audio, advertising and framing remain under YouTube's player.

## Timing and provenance

`scripts/training-youtube-sources.json` records 106 acquired clip references,
their SHA-256 hashes, 30fps frame counts, original video IDs and intervals,
creator/title metadata and acquisition-record references. Those inputs expand
through existing coverage files into `sections2to6YouTube.generated.json`.
They do not change the curriculum or fill gaps with unrelated material.

- All 106 acquired files matched the recorded manifest hashes when generating
  and checking the mapping.
- 83 acquired clips were compared with previously retained originals at three
  positions per interval. Maximum time difference was one 30fps frame; maximum
  mean grayscale error was 1.34/255. The remaining 23 use acquisition records
  explicitly expressed in original YouTube time.
- `2-1/C05` and `2-4/C02` used local screen-recording time in their CSVs.
  Frame matching recovered their original start at **113.9667s** in Pupford
  `s0gz8sOZsWw`, instead of incorrectly embedding at 25.8s.
- `3-1/02`, `3-2/04`, and `6-1/01` each already contained two noncontiguous
  excerpts. Both intervals are retained. Existing caption offsets are mapped
  across the cut, with no retiming or new instructions.
- `5-2/04` and `5-2/09` previously rotated a tablet demonstration from
  `K5gCY0uMFp0`. The frame comparison accounts for that historical rotation;
  official playback shows the original camera orientation. Its recording
  action and original time ranges are unchanged.
- Export rounding differs from the original intervals by at most one 30fps
  frame. Clip offsets use existing frame counts so later captions stay aligned.
  The official player itself can seek near keyframes rather than exact frames.

Generate or verify without downloading/editing any footage:

```powershell
python -X utf8 scripts/build-training-youtube.py
python -X utf8 scripts/build-training-youtube.py --check --source 'C:/Users/Minjae/Desktop/PAWS_vid/Actual'
```

The generator also creates `trainingYouTubePosters.generated.ts`. It checks all
existing source boundaries, total durations, source bindings and poster files.

## Validation

- TypeScript: passed.
- 69 tests across YouTube mapping/controller, native-module compatibility,
  clip flow and round service: passed. Every caption in all 140 levels was
  checked for source-time round trips and correct interval selection.
- Public YouTube oEmbed metadata: 59/59 sources available; canonical channel
  names and titles were retained in the manifest.
- Actual browser embedding/playback: 59/59 unique originals played inside their
  selected intervals at 0.5x, using the production IFrame HTML in a temporary
  local audit harness. The harness muted audio for batch testing only. It did
  not change production player behavior. This is a source availability sample,
  not a full-length run of every one of the 115 clip sequences.
- Live development preview: source seeking and automatic continuation across
  the internal cut in 6-1 were verified against real media; Section 2 playback
  was observed at the mapped time and 0.5x. In 5-2's final sequence, selecting
  the recording caption opened `K5gCY0uMFp0`, playback automatically continued
  to `BMC7PcE2BvE` and stopped at 107.304s; Replay returned to the cleaning
  interval in `ijT16-8BPNQ` and the first caption. No extra example tabs appeared.
- Local iOS Hermes export: passed (5,622 modules). Asset map: **0 MP4s** and
  **108 distinct training JPGs** (shared images deduplicated).
- Metro iOS manifest and JavaScript bundle: HTTP 200 after conversion.

No database or native dependency changes. The existing development build 3
(with WebView) can load this change by reloading Metro. This turn did not
verify playback on the physical iPhone or Android emulator; device/network
restrictions and mobile YouTube behavior still need device testing.
