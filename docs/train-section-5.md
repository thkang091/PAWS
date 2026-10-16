# Section 5 — short action examples

2026-10-01: all 15 Levels are connected. The three placeholders were filled
using the user's clarified scope: actual indoor potty footage, noticing an
accident, and three short cleanup / record / preparation examples.

| Lesson | L1 | L2 | L3 | L4 | L5 |
| --- | --- | --- | --- | --- | --- |
| 5-1 Indoor potty area | 02 | 05 | 02 | 03 | 02 |
| 5-2 Accident recovery | 07 | 03 | 04 | 06 | 08 + 09 + 10 |
| 5-3 Outdoor potty area | 01 | 02 | 03 | 04 | 01 |

IDs refer to scripts/training-section5-sources.json. All playback uses 0.6x,
silent video and clickable action captions. Each Level plays for less than
30 seconds. No talking-only explanations or long six-clip sequence is bound.

## Added footage

- **5-1 L2:** Zak George, AVCV8k3xvGY, 281.00–290.50. Indoor pad use,
  completion, then food reward. 9.5 seconds of source / 15.8 seconds at 0.6x.
  The puppy steps onto adjacent bedding before the reward; the captions describe
  completion-before-reward, not reward placement inside the pad area.
- **5-2 L1:** Zak George, t68E7g4D4dU, 115.05–117.30. Dog moves past an
  accident on the carpet and the camera shows the spot. 2.27 seconds of source /
  3.8 seconds at 0.6x. Calm response is a practice instruction; the clip does not
  claim to show a guardian's complete reaction.
- **5-2 L5:** last four seconds of wiping (03, 7.2–11.2), four seconds of
  writing (04, 2–6), then the familiar indoor route (06, full 6.83 seconds).
  14.83 seconds of source / 24.7 seconds at 0.6x. Separate examples from
  Samy & the Snow Dogs, Happy With Dogs and 랜선 볶음이; not one continuous event.
  Captions identify the transitions and distinguish route-arrival rewards from
  rewards after elimination. Cleaner use and logging details remain practice
  instructions; a short wipe is not the complete chemical-treatment time.

The new source excerpts live in assets/training/sources/section5. Their source
URLs and original intervals are in the inventory. Original library videos stay
unchanged. Reproduce the excerpts using scripts/extract-section5-additions.py
with --research-root <research3132>, --source <Actual>, and --ffmpeg <executable>.

## Other reference limits

5-1 L3/L5 reuse the familiar route as a practice reference; one cue and reduced
guidance are instructions. L4 shows another starting point, not a proven change
of rooms. 5-2 L2 uses the cleanup-only easier path; L3 shows logging and L4 the
next familiar route. 5-3 L3 is sniffing, not elimination; L4 shows general
distraction-distance practice. L5 is a short potty trip, not an entire walk.

## Maintenance and validation

- scripts/training_section5_content.py: bindings and timed action captions.
- scripts/training-section5-sources.json: inventory and excerpt provenance.
- scripts/build-section5-clips.py: shared 720p H.264 / 30fps / fast-start export.
- section5*.generated.*: generated captions, assets and coverage registration.
- trainingVideoSources.json: credits for the connected footage.

Run the builder with --source <Actual> --ffmpeg <executable>. It checks decoded
frame counts and cue boundaries. Regression checks require five Levels in each
lesson, playback under 30 seconds, no explanation files, and exactly three short
examples only in 5-2 L5. The shared builder accepts projectFile for reviewed
excerpts stored in the repository; other sections keep their existing paths.

Verification: TypeScript passed; 201 related Jest cases passed. All 15 Levels
passed browser playback checks for 0.6x, muted playback, duration, each caption
seek, completion, replay, and the persistent Continue state. The iOS development
bundle returned HTTP 200 and contains the three new bindings/captions. Native
phone playback was not directly inspected.
