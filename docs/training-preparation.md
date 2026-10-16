# Training preparation

Curriculum lessons and the fallback lesson preview share `LessonPreparation`.
The lesson title appears on `LessonHero`; the sheet contains video credits, the
skill's one-line goal, and the Level 1 ready card's materials. There is no step
outline on this screen. Preparation remains visible before resuming any level.

`src/features/train/media/trainingVideoSources.json` records source credits for
the 28 connected lessons (sections 1 through 6). Credits apply to the whole
lesson, including clips from later levels, and creator names are deduplicated in
the UI. Any future lesson without connected media keeps a pending source label.

Attribution was checked on 2026-10-01 against the local `PAWS_vid/Actual`
catalog, per-lesson manifests and source lists (v2 for 1-4 and 2-1). The original
1-2 and 1-3 recording titles were additionally matched against YouTube's public
oEmbed metadata: `5kstTBK0ks8` (Zak George) and `4sDCPXcZkEM` (Happy Hounds Dog
Training). The old Emily Carter preview identity was sample content and is no
longer displayed as a video credit. Section 5 credits were added from the
2026-10-01 catalog. After the short-action correction, Section 5 credits only
include creators whose clips remain connected. The three remaining Levels were
filled with reviewed short excerpts; all 15 Section 5 Levels now have clips.
Zak George is credited for the added indoor potty and accident-discovery footage.

This is a client presentation change. It does not modify curriculum records,
progress, energy, or the clip playback flow.
