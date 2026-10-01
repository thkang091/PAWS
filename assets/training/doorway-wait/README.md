# Doorway wait media pilot

Copied unchanged from `C:/Users/Minjae/Desktop/PAWS_vid/Actual/1-1/clips` on 2026-09-29.
The original library and its manifest remain the source provenance record.

| Bundled file | Original file | Coverage |
|---|---|---|
| level-1.mp4 | PAWS_1-1_L1_WaitingSpot_PARTIAL.mp4 | Waiting spot and reward example; does not demonstrate the guardian's small step toward the closed door |
| level-2.mp4 | PAWS_1-1_L2_HandleWait_CANDIDATE.mp4 | Handle movement and in-place reward; source loading graphic remains |
| level-3.mp4 | PAWS_1-1_L3_SmallDoorOpening_CANDIDATE.mp4 | Slight opening, reward while open, then closing; no release shown |
| level-4.mp4 | PAWS_1-1_L4_WiderDoorWait_PARTIAL.mp4 | Open-door wait; release and threshold crossing are not shown |
| level-5.mp4 | PAWS_1-1_Lv5_Wait_and_Leave_for_Walk_Pupford.mp4 | Leashed dog settles, waits at the open door, then leaves with the guardian; 7.266667 seconds |

Playback is muted. PAWS action captions are authored in
`src/features/train/media/doorwayWaitLesson.ts`, relative to each exported clip.
They describe visible actions and are not transcripts or claims of a complete
Level success demonstration. The original footage shows an elevated platform;
the app's practice instructions retain a floor mat and appropriate door setup.

These bundled files add approximately 23 MB to the project. The media requires
no storage upload or database migration. Only skill code `1-1`, Level 1–5,
selects this media; checkpoints and other skills keep their existing
media handling. Future hosted URLs can replace the bundled source mapping.

Level 5 was supplied separately after the original four-file manifest. Its MP4
is copied unchanged; its poster is extracted from a decoded frame at 2.4 seconds. All five
clips use 0.6x playback with caption times expressed in source-video seconds.

Development preview: `/train/media-preview`. This uses the same player hook and
caption component without starting a training session or consuming Energy.
