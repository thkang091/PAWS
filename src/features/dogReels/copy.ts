import type { EntryStatus, HeldReason } from "@/services/mediaService";
import { poseError } from "@/features/photoPose/copy";

/** Dog Reels: the words around a clip. Everything else (timing, phases) is shared with Photo Pose. */
export const CLIP_SECONDS = 15;

export const REEL_ENTRY_TEXT: Record<Exclude<EntryStatus, "withdrawn">, { title: string; line: string }> = {
  checking: { title: "Checking your clip", line: "This usually takes a few seconds." },
  approved: { title: "You're in", line: "Your clip joins the gallery when voting opens." },
  held: { title: "We couldn't spot your dog", line: "Film it again, or ask a person to look." },
  pending_review: { title: "A person will check it", line: "You'll see it here once a moderator has looked." },
  rejected: { title: "Not accepted", line: "You can film a new clip while entries are open." },
};

export const REEL_HELD_TEXT: Record<HeldReason, string> = {
  no_dog: "We couldn't spot your dog in the clip.",
  no_owner: "We couldn't spot you.",
  not_together: "You and your dog need to be in the same clip.",
};

const ERRORS: Record<string, string> = {
  not_deployed: "Dog Reels isn't switched on yet.",
  video_too_large: "That clip is too big. Film a shorter one.",
  video_too_long: "Clips can be up to 15 seconds.",
  video_too_short: "Film at least a second.",
  unsupported_video: "That clip couldn't be read. Film it again.",
  upload_failed: "The clip didn't upload. Try again.",
  upload_missing: "The clip didn't upload. Try again.",
  not_a_video_challenge: "This challenge takes photos, not clips.",
  camera_unavailable: "The camera isn't available on this device.",
  still_failed: "The camera couldn't take a still. Film it again.",
};
export const reelError = (code: string | null | undefined) => (code && ERRORS[code]) || poseError(code);
