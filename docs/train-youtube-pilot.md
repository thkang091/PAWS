# 1-1 YouTube playback pilot — 2026-10-03

Lesson 1-1 (Wait at the Door), Levels 1–5, now streams the original through the
official YouTube IFrame Player API. Other lessons retain their current player.
No video downloads, offline fallback, custom overlays on the
YouTube player, autoplay, or rewards for playback completion are implemented.
Original audio, branding, controls and any YouTube advertising remain available.

## Source and timing

All levels use Pupford, **How to STOP Your Dog From Running Out the Front Door**:
https://www.youtube.com/watch?v=s0gz8sOZsWw

| Level | Original start (seconds) | Original end (seconds) | Original clock |
|---|---:|---:|---|
| 1 | 56.733333 | 64.300000 | 0:56.7–1:04.3 |
| 2 | 116.600000 | 121.066667 | 1:56.6–2:01.1 |
| 3 | 175.933333 | 181.400000 | 2:55.9–3:01.4 |
| 4 | 163.133333 | 169.600000 | 2:43.1–2:49.6 |
| 5 | 181.850000 | 189.150000 | 3:01.9–3:09.2 |

Each level uses one continuous original interval; no extra segment tabs are
necessary. The range map is `src/features/train/media/trainingYouTube.ts`.

The historical `PAWS_vid/Actual/1-1/manifest.json` timestamps for L1–4 are relative
to uploaded screen recordings, NOT YouTube. They must not be used as embed times.
To recover the original positions, the bundled clips were compared with the
previously retained `work/research3132/s0gz8sOZsWw/s0gz8sOZsWw.mp4` in the old
workspace. Every one-second sample was matched against original frames at 30fps.
L1 aligns within one frame to 56.733333, L2 to 116.6, L3 to 175.933333, L4 to
163.133333. Mean grayscale pixel errors were about 0.24–0.37/255 after scaling
to 48×27. L5 uses its original edit record 181.85–189.15, corroborated by frame
matching. Original footage no longer contains screen-recording buffering graphics.

PAWS cues retain their local clip offsets; source playback time is translated by
subtracting the selected start. Cue clicks and Replay load the same video with
both `startSeconds` and `endSeconds`, preserving the end boundary. YouTube may
seek near a keyframe; frame-exact start is not guaranteed by its player.
This is a source/playback conversion, not a revision of curriculum coverage.
Existing caveats in `doorwayWaitLesson.ts` still apply.

## Screens and behavior

- Live round, legacy lesson, refresher, library and development preview all use
  `YouTubeTrainingClip` for 1-1.
- Preparation follows the existing Start/Continue session flow. The full video
  library is available only after lesson completion; there is no separate
  pre-completion viewing entry point. Existing practice/round server rules remain unchanged.
- Watching never triggers Continue or an automatic progress mutation. Continue
  is an explicit user action and is not gated by video completion.
- Captions, navigation, source credit/link, loading/error messages and replay
  actions are outside the YouTube player. Minimum player dimensions are 200×200.
- The original link opens YouTube at the start time. External YouTube playback
  does not enforce PAWS's end time.
- On blur/background the player pauses; it does not automatically resume. Level
  changes replace the document and discard the previous player.
- Unavailable video, disabled embedding, missing client identity and network
  failures expose Retry and the original link. There is no extracted MP4 fallback.
- Historical MP4 files remain on disk for provenance and are not imported by the
  runtime. On 2026-10-04 the user requested restoring the original preparation
  artwork: a separate poster-only registry now supplies the five existing JPGs
  without importing the MP4 registry.

## Native setup

Added Expo-compatible `react-native-webview`. Existing development builds that
do not contain this native module must be rebuilt; an OTA JavaScript update alone
does not add a native module. iOS uses WKWebView; Android uses the OS WebView.
Inline playback is enabled. Native HTML `baseUrl` and API `origin` identify the
app using its configured bundle/package ID (`https://com.tminjae1124.paws` on
iOS, `https://com.example.paws` on Android). Web uses the actual web origin.
Referrer policy is `strict-origin-when-cross-origin`.

Official implementation references:
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://docs.expo.dev/versions/latest/sdk/webview/

## Validation

- TypeScript check passed.
- Four focused tests cover source-time mapping, malformed bridge messages,
  cue-without-autoplay, seek/replay end preservation and visibility cleanup.
- 205 existing clip/curriculum/refresher/round-service tests passed.
- Actual browser playback verified against YouTube (not a mocked stream): all
  five levels, official play controls, replay and caption seeking work. Observed
  stops were L1 64.305s, L2 121.075s, L3 181.410s, L4 169.604s,
  L5 189.153s (ENDED).
  A simulated embedding-disabled error displayed the fallback and Retry
  successfully loaded a fresh real player. 390×844 and 375×667 layouts checked.
  A YouTube teardown error on document removal was fixed by letting the host
  dispose the document, instead of calling `destroy()` during `pagehide`.
  Final playback/level-switch checks reported no browser errors. 1-2 still
  renders and plays through its existing native-video path.
- The initial iOS production JavaScript export succeeded (5,743 modules). Its asset map had
  zero doorway-wait MP4/poster entries, before the requested poster restoration;
  the ten furniture-boundary entries remained.
  This checks native bundling, not an Xcode binary build or iPhone playback.
- No iPhone or connected Android device was available. Native WebView playback,
  OS background behavior and real mobile ad flows still require device testing.

Preview without a training session: `/train/media-preview?skill=1-1` in a
development build. This route redirects to Train in production.

This pilot does not establish App Store approval or finish the app-wide YouTube
policy/privacy review. Other lessons still use their existing media sources.

## Existing iPhone development build — 2026-10-04

Device logs confirmed `RNCWebViewModule could not be found` while importing
`YouTubeEmbed.tsx`, followed by Expo Router's `ErrorBoundary` undefined error.
The installed build 2 predates the new native dependency. A successful JS export
does not add native modules to that installed binary.

The native player now checks `TurboModuleRegistry.get` before loading the WebView
package. Missing-module clients retain working routes and can open the YouTube
original; they show a specific development-build update message. The general
loading timeout no longer overwrites this diagnostic. Two regression tests cover
old and rebuilt binaries; both pass along with the four YouTube controller tests
and TypeScript checks.

`app.json` is set to iOS build 3. The user explicitly approved EAS source
upload and the cloud development build on 2026-10-04, after the initial automatic
approval block. The build was submitted with local dotenv loading disabled:

```powershell
$env:EXPO_NO_DOTENV='1'
eas build --platform ios --profile development --non-interactive --no-wait
```

Build 3 completed successfully:
https://expo.dev/accounts/tminjae1124/projects/paws/builds/18920e7a-59e1-4f53-ad45-a884a7e37ba4

The downloaded IPA was independently checked: bundle `com.tminjae1124.paws`,
build 3, 20 binaries and 76 required `@rpath` references passed; ExpoModulesJSI
is present. Both `RNCWebViewModule` and `RNCWebViewImpl` are compiled into the
PAWS Mach-O executable. Actual iPhone installation/playback remains a user step.

EAS's non-blocking Expo Doctor step reported existing config/dependency warnings
(legacy `splash` field, missing direct `expo-font` dependency, SDK 56 Hermes
advisory, and Expo/notifications patch versions). The native build succeeded;
these warnings were not addressed as part of the WebView fix.

Install build 3 on the existing registered iPhone, then reconnect to
`npm run start:iphone`. Reloading the old development app alone cannot enable its
missing native WebView. For the import-failure cache, fully reload the JavaScript
bundle once to pick up the guarded import.

## Restore the established screen — 2026-10-04

`UnlockedLessonVideos` now opens `TrainingPracticeClip`, the same component used
by first-time training. The duplicate unlocked player was removed. Rewatching
keeps read-only callbacks and an immediately available "All videos" action;
there are no progress or Energy mutations. Both media providers use
`TrainingClipScreen` for the original headings, cues, timeline and round replay /
primary / help controls. The YouTube close button remains outside its player,
and the sheet does not overlap YouTube controls. Original preparation/library
posters are restored separately from video sources.

The official API's supported rates for this video were observed as
`[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]`. Exact 0.6x is unavailable, so the
closest supported pace, 0.5x, is selected. The controller reapplies it after
load/replay/cue seeking, which otherwise resets YouTube to 1x. A user-selected
rate from YouTube's own controls is respected and retained for subsequent
seeks/replays. No direct manipulation of YouTube's internal media element is used.
Actual browser playback and cue seeking both reported 0.5x. Caption timestamps
remain relative to source time, not wall time, so slowing playback preserves sync.

These are JavaScript and bundled-artwork changes; development build 3 can load
them from Metro without another native rebuild.

### Follow-up: replace only the video slot

Removed the YouTube-specific white header, source row during normal playback,
and square sheet styling. `TrainingClipScreen` now has one layout for both
providers, including the original dark close button, rounded sheet, headings,
captions and footer. The embed reserves room inside the video stage for the
close button and sheet edge; it remains at least 200px tall and is not obscured.
An external source link is shown if playback fails; normal playback retains
YouTube's own source links and controls.

The legacy lesson route no longer returns a separate YouTube screen either.
It keeps its existing hero, top bar, progress dots, caption sheet and actions,
substituting `YouTubeEmbed` at the `TrainingClipVideo` position. The shared
`useYouTubeTrainingPlayback` adapter supplies timing, seek, retry and pause to
both routes. Development preview screens are not used by the live route.

### Preparation framing and quieter playback

Preparation artwork uses contain sizing in an explicitly sized image container,
with space reserved below for the title. This keeps the full frame/dog visible
instead of cropping a landscape source to the portrait hero. Caption rows use
sequential numbers, and the lesson progress control selects instructions rather
than seconds; a drag commits only on release.

The embedded player defaults to documented `controls=0`, `fs=0` and
`iv_load_policy=3`. A "YouTube settings" button outside the player restores its
official controls for captions, speed, volume and fullscreen. Changing this
creation-time setting re-cues (pauses) at the current position and preserves the
selected playback speed. Press play or an instruction to resume. No iframe
content is cropped or covered to conceal branding, captions or ads.

Caption auto-enable is not forced. `cc_load_policy=1` forces captions ON; the
official parameter documentation does not provide a force-OFF value. Viewer
preferences may therefore still show captions. `unloadModule('captions')` and
undocumented empty-track tricks are not used. YouTube settings exposes the
native CC control when needed. YouTube title/recommendation overlays may remain.

Seeking deliberately retains `loadVideoById` with `endSeconds`: the documented
`seekTo` API invalidates `endSeconds`, so substituting it alone would let playback
continue outside the selected lesson segment. Source-relative cue timing,
segment endpoints and the 0.5x default remain unchanged.

References: https://developers.google.com/youtube/player_parameters and
https://developers.google.com/youtube/iframe_api_reference#Queueing_Functions
