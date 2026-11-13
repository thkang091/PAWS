# Photo Pose Challenge: media tournaments (phase 4A) and pose discovery

Players recreate a pose with their dog, send one photo, and vote for a favourite. Organizers use Gemini to brainstorm
pose ideas, review them, approve an example photo, and publish. Nothing here has been deployed.

## Timeline of a challenge

Registration, then **entries** (`starts_at` to `entries_close_at`), then **voting** (to `ends_at`), then results. All
on the server clock (`public.media_phase`; the same rule in `supabase/functions/media/phase.ts`). Entries and voting
each get at least an hour.

## Phase 4A: shared media tournament tables

`supabase/migrations/20261217120000_media_tournaments.sql`. Built for photos first; Match My Dog and Dog Reels can reuse
it (`media_kind` is `photo` or `video`).

| Table | What it holds | Who writes it |
| --- | --- | --- |
| `media_challenges` | One per tournament: title, brief, a copy of the instructions, reference image, entries close time | organizers (`create_media_challenge`, `publish_pose_challenge`) |
| `media_submissions` | One live entry per player per challenge; status, check result, review request, report count | only the `media` edge function (service role) |
| `media_votes` | One vote per player per challenge, movable while voting is open | `cast_media_vote`, `clear_media_vote` |
| `media_reports` | One report per player per entry | `report_media_submission` |
| `media_moderation_log` | Every decision on an entry, by a person or the automatic check | the functions above |

**Entry rules**

- Only players who joined the tournament can enter, with their own dog, while entries are open.
- A new photo replaces your live entry (a retake). Withdrawn and rejected entries make room for a new one.
- Entry statuses: `checking`, then `approved` (in the gallery), `held`, `pending_review`, `rejected` or `withdrawn`.

**Photo privacy**

- The app uploads only into the player's own `media-entries/{user}/incoming/` folder.
- The edge function strips EXIF, XMP and IPTC metadata (location, device, time), keeping only the orientation (`jpeg.ts`). Then it moves the photo to its final private path.
- Photos are only ever served as signed links that expire after 30 minutes.

**The automatic check (`entryCheck.ts`, `entry-check-v1`)**

- It asks Gemini only objective questions: is a dog visible, is a person visible, are both in one photo, is the pose's arrangement there. It never judges cuteness or quality.
- **Passed:** every answer is a confident yes (at least 0.8). The entry joins the gallery.
- **Held:** a required thing is confidently missing (no, at least 0.9). The player can retake or ask a person.
- **Moderator decides:** anything else, including a "no" on the pose itself, an unreadable answer, or no Gemini key.
- The check never rejects an entry.
- These thresholds are not calibrated on real photos yet.

**Moderation**

- Organizers approve or reject. A rejection needs a reason.
- Three reports hide an entry until a moderator looks.
- The owner can ask a person to look once, when the check held the entry or reports hid it.

**Voting**

- Players who joined vote for someone else's approved entry, while voting is open. Voting again moves your vote.
- The gallery is shuffled differently for each player and stays the same between visits, so the first photo has no edge.
- Vote counts stay hidden until voting closes.

**Results**

- `media_results`: most votes first, then the earlier entry. Only approved, unhidden entries count. Gemini plays no part.

## Pose discovery

`supabase/migrations/20261224120000_photo_poses.sql` and `supabase/functions/media/poses.ts`.

**`DogPhotoPoseDiscoveryService`**

- The app side is in `src/services/mediaService.ts`: brainstorm, create, revise, review, draft or upload a reference, review the reference, publish, retire, library.
- The server side is `poses.ts` with the `media` function's `pose_*` actions.
- Gemini is called through `supabase/functions/_shared/gemini.ts`, which the existing `gemini` function now shares. There is one key, `GEMINI_API_KEY`, on the server only. The image model is available to organizers only, never to the app's pass-through.

**Generating ideas**

- Organizers ask for 5 to 10 ideas by theme and difficulty.
- Gemini answers in JSON against `pose-concept-v1`, and every idea is validated field by field.
- **Safety screen:** an idea is rejected if it involves jumping, balancing, hind legs, lifting or holding the dog, restraints, raised surfaces, toxic foods, extra people or dangerous objects. It is flagged for the organizer if it involves costumes, accessories, water, furniture, tricks, hugs, face-to-face poses, weather, hard difficulty or a long setup.
- Repeats of each other or of anything already in the library (rejected ideas included) are dropped.
- Trend fields are always cleared, because PAWS has no authorized trend source. The app labels ideas "Viral-inspired, not a verified trend".
- Every idea starts as `suggested`.

**Retries, caching and limits**

- Two retries with backoff on rate limits and server errors.
- The same request within 10 minutes returns the same batch.
- At most 12 batches per organizer per hour.
- When Gemini is unreachable, organizers can write a pose by hand. It goes through the same validator and safety screen.

**Reference images**

- Drafted with `gemini-2.5-flash-image` if it returns an image. If it doesn't, the error says so and nothing is invented.
- Or uploaded with a stated source and licence. Uploads are stripped of metadata.
- Every reference is checked against the pose's criteria, plus "exactly one dog and one person, natural bodies". The organizer then approves or rejects it.

**Publishing**

- Needs an approved idea and an approved reference.
- Creates the tournament and its media challenge with a copy of the instructions, so later edits never change a running challenge. Published ideas are locked.
- Players can read published ideas and their references only.

**Recommendations (`src/features/photoPose/recommend.ts`)**

- Run on the phone from the database. No Gemini call, and no dog details are needed.
- Signals: the player's filters (vibe, no props, easy only), poses already entered, how recently a pose was published, and variety (each pick lowers the next pose of the same vibe).

## Screens

| Screen | File |
| --- | --- |
| Game home: this week's pose, more poses to try, past challenges, organizer tools | `app/game/tournament/photo-pose.tsx` |
| Pose: reference, steps, framing, what counts, safety, your entry | `app/game/tournament/pose.tsx` |
| Your photo: reference beside your photo, take, choose, crop, retake, send, outcome | `app/game/tournament/pose-submit.tsx` |
| Vote: shuffled grid, full-screen viewer, one movable vote, report | `app/game/tournament/pose-vote.tsx` |
| Results: winner, podium, everyone else, your place | `app/game/tournament/pose-results.tsx` |
| Pose studio (organizers): generate ideas, write one, review lists | `app/game/tournament/pose-studio.tsx` |
| Review pose (organizers): reference, edits, safety notes, approve, publish | `app/game/tournament/pose-concept.tsx` |
| Review photos (organizers): moderation queue | `app/game/tournament/pose-moderation.tsx` |

## Verification status

| Area | Status | Evidence |
| --- | --- | --- |
| Photo cleaning, check rules, timeline, ranking | Unit tested | `src/__tests__/mediaEntries.test.ts` (synthetic JPEG with GPS metadata plus a real repository JPEG) |
| Pose schema, invalid and unsafe ideas, repeats, trend fields, image extraction, edits, recommendations | Unit tested | `src/__tests__/poseDiscovery.test.ts` |
| Screen logic and copy (no em dashes) | Unit tested | `src/__tests__/photoPoseFlow.test.ts` |
| Entries, retakes, check outcomes, review requests, moderation, voting, reports, results, row level security, storage folders | Database tested | `supabase/tests/media_tournaments.sql` on PostgreSQL 17 + PostGIS 3.7 |
| Organizer-only ideas and publishing, unpublished ideas hidden, reference storage access, instruction copies, pose history | Database tested | `supabase/tests/photo_poses.sql` |
| All eight screens, empty, error and populated states | Simulator tested | iPhone 15 Pro. The populated states used a temporary on-phone preview with repository training photos, since removed; the error states are the real undeployed backend |
| `media` edge function, shared Gemini helper | Typechecked only | no Deno or Supabase runtime here; never executed |
| Gemini answers (ideas, entry checks, example photos) | NOT VERIFIED | no key locally; the image model's availability on the project's key is unknown |
| Check thresholds on real photos | NOT VERIFIED | needs real entries reviewed side by side with a person |
| Camera capture and upload | NOT VERIFIED | the simulator has no camera; library access was declined in review, so the error path was seen, not a real upload |
| Android | Not tested | no SDK on this machine |

## To switch it on (yours to run, with authorization)

1. Apply `20261217120000_media_tournaments.sql` and `20261224120000_photo_poses.sql` with `npx supabase@latest db push --project-ref ytitmpodghiehzlmrhte`.
2. Deploy the `media` function, and the `gemini` function again, because it now imports the shared helper.
3. Check that `GEMINI_API_KEY` is set as a function secret. Try one organizer batch and one example photo before announcing anything.
4. Withdrawn and rejected photos stay in storage until a purge job removes them. That job isn't written yet.
