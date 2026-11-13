import type { EntryStatus, MediaPhase } from "../../../supabase/functions/media/phase";
import type { PoseCategory, PoseDifficulty, PoseTheme } from "../../../supabase/functions/media/poses";
import type { HeldReason } from "../../../supabase/functions/media/entryCheck";

/** Every word the Photo Pose screens show, in one place. */

export const CATEGORY_LABEL: Record<PoseCategory, string> = { funny: "Funny", cute: "Cute", matching: "Matching", creative: "Creative", trick: "Trick" };
export const THEME_LABEL: Record<PoseTheme, string> = { mixed: "Mixed", ...CATEGORY_LABEL };
export const DIFFICULTY_LABEL: Record<PoseDifficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export const PHASE_LABEL: Record<MediaPhase, string> = {
  upcoming: "Coming up",
  registration: "Opens soon",
  entries: "Taking photos",
  voting: "Voting",
  completed: "Finished",
  cancelled: "Cancelled",
};

/** What happened to your entry, as a title and one line. */
export const ENTRY_TEXT: Record<Exclude<EntryStatus, "withdrawn">, { title: string; line: string }> = {
  checking: { title: "Checking your photo", line: "This usually takes a few seconds." },
  approved: { title: "You're in", line: "Your photo joins the gallery when voting opens." },
  held: { title: "We couldn't see everything", line: "Retake it, or ask a person to look." },
  pending_review: { title: "A person will check it", line: "You'll see it here once a moderator has looked." },
  rejected: { title: "Not accepted", line: "You can enter a new photo while entries are open." },
};

export const HELD_TEXT: Record<HeldReason, string> = {
  no_dog: "We couldn't spot your dog.",
  no_owner: "We couldn't spot you.",
  not_together: "You and your dog need to be in the same photo.",
};

/** For moderators: why the automatic check held a photo. */
export const HELD_FOR_MODERATOR: Record<HeldReason, string> = {
  no_dog: "no dog seen",
  no_owner: "no owner seen",
  not_together: "dog and owner not in the same photo",
};

export const REPORT_REASONS = [
  ["not_the_challenge", "Not this pose"],
  ["not_their_photo", "Not their photo"],
  ["unsafe_for_dog", "Unsafe for the dog"],
  ["inappropriate", "Inappropriate"],
  ["spam", "Spam"],
] as const;
export const REJECT_TEXT: Record<string, string> = Object.fromEntries(REPORT_REASONS);

const ERRORS: Record<string, string> = {
  not_deployed: "Photo Pose isn't switched on yet.",
  network: "No connection. Check your internet and try again.",
  timeout: "That took too long. Try again.",
  not_signed_in: "Sign in to take part.",
  not_joined: "Join the challenge first.",
  entries_closed: "Entries have closed.",
  voting_closed: "Voting has closed.",
  gallery_not_open: "The gallery opens when entries close.",
  results_not_ready: "Results come out when voting closes.",
  own_entry: "You can't vote for your own photo.",
  entry_not_found: "That photo isn't available any more.",
  review_already_requested: "You've already asked for a review.",
  unsupported_image: "That photo couldn't be read. Try another one.",
  image_too_small: "That photo is too small. Use one at least 480 pixels on each side.",
  image_too_large: "That photo is over 10 MB.",
  upload_failed: "The photo didn't upload. Try again.",
  upload_missing: "The photo didn't upload. Try again.",
  rate_limited: "Too many tries in a row. Wait a minute.",
  image_unavailable: "The image couldn't load.",
  not_an_organizer: "Only PAWS organizers can do this.",
  ai_unavailable: "Gemini isn't reachable right now. You can still write a pose yourself.",
  ai_busy: "Gemini is busy. Try again in a minute.",
  ai_bad_response: "Gemini's answer didn't match the pose format. Nothing was saved. Try again.",
  image_generation_unavailable: "No image came back. Upload a licensed photo instead.",
  license_required: "Say where the photo comes from and its licence.",
  pose_locked: "Published poses can't be changed.",
  pose_not_approved: "Approve the pose first.",
  reference_not_approved: "Approve a reference image first.",
  safety_unchecked: "Confirm you've read the safety notes first.",
  reason_required: "Pick a reason.",
  entries_window_invalid: "Leave at least an hour each for entries and voting.",
  ends_in_the_past: "The end date is in the past.",
};
export const poseError = (code: string | null | undefined) => (code && ERRORS[code]) || "Something went wrong. Try again.";

/** "3 min", "No props", "1 prop" */
export const minutesLabel = (m: number) => `${m} min`;
export const propsLabel = (objects: readonly string[]) => (objects.length === 0 ? "No props" : objects.length === 1 ? objects[0] : `${objects.length} props`);
export const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
