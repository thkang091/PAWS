# Wait at the Door: clip and caption pilot

Implemented for Rules & boundaries, skill `1-1`, Levels 1–5. Checkpoints
retain their existing content.

- Original MP4s and posters are bundled under `assets/training/doorway-wait`.
- Source audio is muted. Short English action captions match the app language.
- Connected clips play at 0.6x speed. Caption timestamps stay in source-video
  time, keeping highlighting, scrolling, and seeking synchronized with playback.
- Captions are PAWS guidance based on the visible actions, not speech transcripts.
- Each training card starts the video automatically; captions and the thin
  timeline seek the actual player and playback continues through later steps.
- The active caption is highlighted and scrolled into view, including backward
  seeks. The existing footer restart control replays the clip.
- The media sheet shows only the title, current Step, captions, and timeline.
  Additional guidance, the separate playback panel, and play/pause buttons were
  removed. Continue becomes available at video completion, records success,
  and opens the next resolved Level video. Help records a not_yet attempt and
  opens the coach for the same Level; reopening help does not add failures.
- Session progress and rewards use the existing service. No DB migration or
  live data change was needed for this pilot.
- Level 1 and 4 clips remain partial examples; source coverage notes are kept
  in the media metadata rather than displayed in the training sheet.

The live integration is in `app/train/lesson/[skillId].tsx`. The development-only
`/train/media-preview` route uses the same player and caption components without
requiring a dog/session or spending Energy. It redirects to Train in production.

## Supporting browser fixes

`GoogleWalkMap.web.tsx` prevents the existing native-only maps import from
crashing every Expo web route. It displays a labelled schematic route overview;
the native map implementation is unchanged.

`patches/expo-video+56.1.4.patch` handles rejected HTML video play promises.
Expected AbortError from immediate pause, source changes, or rapid caption
navigation is handled; other play failures become player error events. The
existing patch-package postinstall applies this fix on a clean installation.

## Validation

- TypeScript check and six metadata/seek-boundary tests.
- Chromium using the actual Expo app and HTML video: muted, no native controls;
  forward seek to 4 seconds; backward seek to 1.5 seconds; pause at step boundary;
  whole-clip completion; replay; Level 1–4 source changes; rapid play/pause.
- The interaction run completed without browser runtime errors after the video
  cancellation patch. Screenshots were reviewed at a 430 × 932 viewport.
- The installed Android emulator development app was connected to Metro on port
  18941. Native caption seeking, step-boundary pause, Level 1/2 switching, and
  whole-clip completion were verified using the shared media preview screen.
- Android verification found an unmount cleanup calling an already released
  player. Focus handling now uses a navigation blur listener; Expo owns player
  disposal on unmount. TypeScript and all six tests passed after the fix.
- iOS playback and authenticated session settlement remain unverified. The
  emulator uses the running development server; no store release was published.

## Simplified player validation

- TypeScript and six metadata tests passed. Browser checks verified autoplay,
  continuous playback, timeline seeking, automatic forward/backward caption
  scrolling, and autoplay after switching Levels, without runtime errors.
- Verified the simplified UI in the emulator's actual active training session,
  including automatic playback, caption highlighting, timeline seek, and replay.
- Android reports idle at end-of-video. Seeking a loaded idle player now
  restarts it immediately, avoiding a wait for a ready event that never arrives.

## Continue and help flow

- Connected Levels use one video page per Level, bypassing duplicate orient,
  demo, and guardian screens. Existing server result/session APIs remain the
  authority for progress and rewards.
- Course entry consumes one Energy. Continue saves success, then calls
  continue_training_session to open the next resolved Level without additional
  Energy, including when the daily balance is zero. A separately started course
  visit still uses the normal entry charge; resuming an active session is free.
  Level 4 continues to Level 5. After Level 5, Continue records success and
  returns to the roadmap rather than reopening Level 5 while the later-day
  checkpoint is not yet due.
- Retrying a partially completed transition reads the persisted session first
  and the server creates a stable successor key to avoid duplicate settlement
  or sessions. UI actions are guarded while a request is pending.
- Help pins its Level context and records the first problem using not_yet.
  The existing additional-practice policy keeps the session active so Continue
  can subsequently finish it successfully.
- Twelve focused tests and TypeScript passed. Flow tests cover success/advance,
  transition retries, zero Energy, missing Level 5, repeated help, and failed
  saves. The emulator's preparation screen displays the replenished 3 Energy;
  no success/failure records were created merely for these tests.

## Server Energy policy verification

Migration `20260929165234_training_course_energy_continuation.sql` was applied
to the app's Supabase project. The public RPC uses security invoker; its guarded
implementation is in the unexposed training_private schema. Unauthenticated
execution is revoked, and ownership and completed-success checks are enforced.

A rolled-back transaction verified one entry charge, free transitions to Levels
2 and 3 with zero remaining Energy, retry deduplication, rejection of an active
parent, and rejection of another user's request. The caller cannot select an
arbitrary target Level. TypeScript and 12 focused tests passed.

The security advisor reported no findings for the new function. Existing public
RPC permission and anonymous-account warnings remain outside this change;
see the [function permission guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Actual Level 5 added

Added the user-supplied `PAWS_1-1_Lv5_Wait_and_Leave_for_Walk_Pupford.mp4`
from `PAWS_vid/Actual/1-1/clips`. The unchanged 7.266667-second clip shows the
leashed dog settling, waiting as the door opens, and departing with the guardian.
Five short action captions were checked against video frames; 0.6x playback
takes about 12.1 seconds. No AI-generated footage is used.

TypeScript and 15 focused tests passed, including Level 4 → 5, final-Level
completion, and no automatic checkpoint start. Chromium verified Level 5
autoplay at 0.6x, muted playback without native controls, caption auto-scroll,
completion, and backward caption seeking with no runtime errors.
The installed Android development app also loaded Level 5 through the shared
media preview and reached its final caption without logged playback errors.
The source and bundled MP4 SHA-256 hashes match. No training results were
created merely to verify the new media.

## Caption layout

The active clip screen uses a fixed video, a flexible caption sheet, and a footer
with the yellow seek bar immediately above Continue. Only the caption list
scrolls; its former 176-point height and 112-point trailing spacer are removed.
All cues stay visible when they fit. Auto-follow moves only when the active row
leaves the viewport and clamps to the actual content bounds, keeping earlier
captions visible at the end. Manual browsing suspends auto-follow for three
seconds; selecting a caption resumes it. Preview uses the same flexible guide.

Browser checks at 430 × 932 and 375 × 667 verified full-list and overflow layouts,
respectively, with no runtime errors.

## Common preparation gate

Every roadmap entry first shows the skill's common materials and safety card
(stored on Level 1), regardless of the resolved Level or existing active session.
Hydrating a session no longer opens the video: the user must press Continue.
The existing start RPC resumes an active session without another charge or
starts the server-resolved Level with the existing Energy rule. Preparation
uses a still image and never plays the instructional video. No DB policy changes.

The Level 5 poster was black; it is now extracted after seeking to a decoded
frame at 2.4 seconds. Wait at the Door preparation uses the Level 1 poster.
