# YouTube playback follow-up — 2026-10-06

All training YouTube embeds now start muted. The existing **YouTube settings**
action exposes YouTube's own volume controls; no extra training UI was added.
A viewer's mute/unmute choice survives source changes, replay, retries and
settings changes within the current level. Entering another level starts muted.

Previously, crossing source boundaries replaced the WebView/iframe document,
including loading the IFrame API and constructing a new player. Bootstrap props
now remain stable within a level. A play command supplies the next source and
range to the existing player's `loadVideoById` method. The document is recreated
only for level/context changes, retry, or creation-time control settings.
This removes repeated player initialization; fetching another YouTube video can
still buffer. This player change did not alter source selection or captions.
The subsequent [video curation](train-video-focus.md) reduces crowded levels to
one or two intervals while retaining this player behavior.

The shared browser/native controller retains configured end boundaries and the
nearest supported speed to 0.6x (currently 0.5x for the checked sources). Request
IDs plus source/time checks reject stale range events. Initial cue readiness
accepts late metadata, and polling recognizes playback that starts at an earlier
keyframe. An explicit play request overlapping the initial cue is completed once
with `playVideo` if YouTube leaves the requested range cued. This does not enable
initial autoplay. Leaving the screen pauses playback, including a late PLAYING event
while a source is loading; returning permits manual play without autoplay.

Validation:

- TypeScript check passed.
- 45 tests passed across training mappings, the player controller and native
  WebView availability. Regression cases cover four-source reuse, rapid seeks,
  stale/duplicate ending events, mute/rate retention, late metadata/keyframes,
  an immediate play request during initial cueing, and backgrounding during a load.
- In the actual shared training screen's browser preview, 1-5 L1 played all four
  sources through the same iframe, reached its final caption and stayed muted
  at 0.5x. Rapid caption changes also selected the expected source.
- YouTube's own unmute control, retention after reopening settings, and the next
  level's default mute were verified in the browser. A batch of 59 Sections 2–6
  originals exposed seven initial-cue races; those seven all played at 0.5x after
  the fix. The other 52 had already played during that batch.
- The iOS development manifest and freshly generated JavaScript bundle returned
  HTTP 200. These changes require a Reload, not a native build. Physical iPhone
  playback still needs device verification.

API reference: <https://developers.google.com/youtube/iframe_api_reference>
