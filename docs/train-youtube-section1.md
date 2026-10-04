# Section 1 YouTube conversion — 2026-10-04

Section 1 (1-1–1-5), all 25 Levels, uses the official YouTube player. Existing
MP4 files are preserved but no longer imported by the Section 1 runtime. Artwork
has a separate poster-only registry. Sections 2–6 retain their current media.

## Playback and curriculum mapping

There are 51 selected intervals including the 5 existing 1-1 intervals. Each
former montage retains its original ordered footage and instructional cues.
Source intervals are internal playback details: the user sees one clip and its
captions, with no Example tabs or Next example action. This is not a change to
practice goals or coverage limitations.

Each interval has source start/end and an offset in the historical concatenated
lesson. Cue seeking and quiz review positions select the corresponding original
and translate that lesson time to source time. When an interval ends, the next
one plays automatically within the same clip. Replay starts from the first
interval. The final interval stops; only Continue performs the existing explicit
lesson action. Playback itself never completes a Level. Native controls remain
hidden by default and can be restored from YouTube
settings. Speed uses the closest supported rate to 0.6x (observed 0.5x).

The bridge announces ready after the initial CUED event, so initial cue loading
cannot overwrite a user's play request after a source change.

## Original-time recovery

Historical recording times were NOT used directly for 1-2 Lv1–3, 1-3, or 1-4
C06. Samples were compared to the original at 5fps, then refined at 30fps.
1-3 C04 also appears in the original introduction; the full lesson occurrence
near 582.73s was checked to preserve the tutorial sequence. Source frame matches
have roughly 0.7–1.7/255 mean absolute grayscale error at 48×27 resolution.
Existing original-time edit records supply the other mappings.

1-3's identified source is **Happy Hounds Dog Training**, not Zak George.
No replacement footage or new training claims have been introduced.

| Recording clip | Matched original start (s) | Mean match error /255 |
|---|---:|---:|
| 1-2-L1 | 216.200000 | 0.937 |
| 1-2-L2 | 432.666700 | 1.020 |
| 1-2-L3 | 250.600000 | 1.056 |
| 1-3-C01 | 312.700000 | 1.293 |
| 1-3-C02 | 377.233300 | 1.202 |
| 1-3-C03 | 474.700000 | 1.048 |
| 1-3-C04 | 582.733300 | 1.441 |
| 1-3-B01 | 439.700000 | 0.960 |
| 1-3-B02 | 533.100000 | 1.332 |
| 1-4-C06 | 385.666700 | 0.960 |

## Section 1 additions

1-1 intervals remain documented in `train-youtube-pilot.md`.

| Lesson | Level | Example | Creator | Original | Start–end (s) | Lesson offset (s) |
|---|---:|---:|---|---|---|---:|
| 1-2 | 1 | 1 | Zak George | [Source](https://www.youtube.com/watch?v=5kstTBK0ks8) | 216.200–223.900 | 0.000 |
| 1-2 | 2 | 1 | Zak George | [Source](https://www.youtube.com/watch?v=5kstTBK0ks8) | 432.667–437.633 | 0.000 |
| 1-2 | 3 | 1 | Zak George | [Source](https://www.youtube.com/watch?v=5kstTBK0ks8) | 250.600–256.800 | 0.000 |
| 1-2 | 4 | 1 | Dogkind | [Source](https://www.youtube.com/watch?v=2O0T7FijIEE) | 1017.840–1037.473 | 0.000 |
| 1-2 | 5 | 1 | Dogkind | [Source](https://www.youtube.com/watch?v=2O0T7FijIEE) | 610.600–626.300 | 0.000 |
| 1-3 | 1 | 1 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 312.700–318.950 | 0.000 |
| 1-3 | 2 | 1 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 377.233–386.833 | 0.000 |
| 1-3 | 2 | 2 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 533.100–543.100 | 9.600 |
| 1-3 | 3 | 1 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 474.700–479.350 | 0.000 |
| 1-3 | 4 | 1 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 582.733–592.933 | 0.000 |
| 1-3 | 5 | 1 | Happy Hounds Dog Training | [Source](https://www.youtube.com/watch?v=4sDCPXcZkEM) | 439.700–449.800 | 0.000 |
| 1-4 | 1 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 151.500–162.100 | 0.000 |
| 1-4 | 1 | 2 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 175.200–181.800 | 10.600 |
| 1-4 | 2 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 181.800–190.850 | 0.000 |
| 1-4 | 2 | 2 | Zak George | [Source](https://www.youtube.com/watch?v=XY3Pl2Td-7I) | 218.750–229.100 | 9.067 |
| 1-4 | 2 | 3 | Zak George | [Source](https://www.youtube.com/watch?v=XY3Pl2Td-7I) | 192.800–196.550 | 19.433 |
| 1-4 | 3 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 203.650–211.200 | 0.000 |
| 1-4 | 3 | 2 | Zak George's Dog Training Revolution | [Source](https://www.youtube.com/watch?v=7vOXWCewEYM) | 385.667–400.217 | 7.567 |
| 1-4 | 3 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 247.300–265.150 | 22.133 |
| 1-4 | 4 | 1 | Zak George | [Source](https://www.youtube.com/watch?v=0c-IjjzmS0E) | 255.350–265.150 | 0.000 |
| 1-4 | 4 | 2 | Zak George | [Source](https://www.youtube.com/watch?v=0c-IjjzmS0E) | 275.000–280.700 | 9.800 |
| 1-4 | 4 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 203.650–211.200 | 15.500 |
| 1-4 | 4 | 4 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 211.200–219.650 | 23.067 |
| 1-4 | 4 | 5 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 247.300–265.150 | 31.533 |
| 1-4 | 5 | 1 | Zak George | [Source](https://www.youtube.com/watch?v=0c-IjjzmS0E) | 255.350–265.150 | 0.000 |
| 1-4 | 5 | 2 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 203.650–211.200 | 9.800 |
| 1-4 | 5 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 211.200–219.650 | 17.367 |
| 1-4 | 5 | 4 | Kikopup | [Source](https://www.youtube.com/watch?v=gZ0XEr4DGfs) | 247.300–265.150 | 25.833 |
| 1-5 | 1 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=yr1olzgidMw) | 75.900–80.400 | 0.000 |
| 1-5 | 1 | 2 | Zak George | [Source](https://www.youtube.com/watch?v=4wBApkKuEVI) | 955.700–960.400 | 4.500 |
| 1-5 | 1 | 3 | Cold Nose College, Space Coast, FLA | [Source](https://www.youtube.com/watch?v=RsqdKr_vzJY) | 42.000–44.800 | 9.200 |
| 1-5 | 1 | 4 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 179.300–181.800 | 12.000 |
| 1-5 | 2 | 1 | Cold Nose College, Space Coast, FLA | [Source](https://www.youtube.com/watch?v=RsqdKr_vzJY) | 75.000–78.350 | 0.000 |
| 1-5 | 2 | 2 | Cold Nose College, Space Coast, FLA | [Source](https://www.youtube.com/watch?v=RsqdKr_vzJY) | 105.000–109.800 | 3.367 |
| 1-5 | 2 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 179.300–181.800 | 8.167 |
| 1-5 | 3 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 175.200–181.800 | 0.000 |
| 1-5 | 3 | 2 | Cold Nose College, Space Coast, FLA | [Source](https://www.youtube.com/watch?v=RsqdKr_vzJY) | 105.000–109.800 | 6.600 |
| 1-5 | 3 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 181.800–189.200 | 11.400 |
| 1-5 | 3 | 4 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 179.300–181.800 | 18.800 |
| 1-5 | 4 | 1 | Kikopup | [Source](https://www.youtube.com/watch?v=bpzvqN9JNUA) | 249.150–251.800 | 0.000 |
| 1-5 | 4 | 2 | Cold Nose College, Space Coast, FLA | [Source](https://www.youtube.com/watch?v=RsqdKr_vzJY) | 105.000–109.800 | 2.667 |
| 1-5 | 4 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 181.800–189.200 | 7.467 |
| 1-5 | 4 | 4 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 179.300–181.800 | 14.867 |
| 1-5 | 5 | 1 | cold nose college | [Source](https://www.youtube.com/watch?v=mVvfY9BlMKA) | 7.500–17.100 | 0.000 |
| 1-5 | 5 | 2 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 181.800–189.200 | 9.600 |
| 1-5 | 5 | 3 | Kikopup | [Source](https://www.youtube.com/watch?v=U2c5EkytNU0) | 179.300–181.800 | 17.000 |

## Preparation artwork

Preparation frames fill the hero with cover sizing. Per-lesson horizontal focal
positions were selected by viewing each Section 1 poster and locating the dog.
No black containment area or reserved title strip remains. Images themselves
are unchanged; framing is applied by the UI.

## Verification

Type checking and the targeted player/bridge/mapping tests cover all 25 Levels,
51 contiguous lesson-time intervals, every cue, and cross-original review time
conversion. Browser verification records and frame-matching working files are
under `.expo/section1-youtube/`. Actual iPhone playback must be checked in the
existing development build; these changes require Reload, not a native build.

Local iOS Hermes export passed. Its asset map contains **0 Section 1 MP4s**,
24 distinct Section 1 poster assets (identical artwork is deduplicated), and
105 MP4 assets retained for the other sections.

Browser playback verification passed for all **46 newly mapped examples** in
1-2�1-5, checking source ID, start/end, playback state, 0.5x speed and absence
of a parent MP4 video element. The existing 1-1 unlocked-library playback was
also rechecked at 0.5x. Targeted Jest suites passed **13 tests**.
