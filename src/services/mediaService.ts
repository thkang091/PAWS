import { getClientOrThrow } from "@/services/serviceUtils";
import type { Criterion, HeldReason } from "../../supabase/functions/media/entryCheck";
import type { EntryStatus, MediaPhase } from "../../supabase/functions/media/phase";
import type { BatchDifficulty, PoseCategory, PoseDifficulty, PoseTheme, Rejection } from "../../supabase/functions/media/poses";
import type { LibraryPose } from "@/features/photoPose/recommend";

export type { Criterion, EntryStatus, HeldReason, MediaPhase };

/**
 * Media tournaments (Photo Pose Challenge first). Reads and votes go straight to SQL functions that enforce their own
 * rules; anything touching photo files goes through the `media` edge function, which strips metadata and hands out
 * signed links. Nothing here sees another player's file path.
 */

export class MediaError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const reason = (message: string) => (/schema cache|could not find/i.test(message) ? "not_deployed" : (message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error"));

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw new MediaError(reason(error.message));
  return data as unknown as T;
};

const call = async <T>(body: Record<string, unknown>, timeout = 30_000): Promise<T> => {
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  const { data, error } = await client.functions.invoke("media", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) throw new MediaError(abort.signal.aborted ? "timeout" : "network");
    const payload = typeof context.json === "function" ? await context.json().catch(() => null) : null;
    throw new MediaError((payload?.error as string) ?? (context.status === 404 ? "not_deployed" : "server_error"));
  }
  if (!data?.ok) throw new MediaError((data?.error as string) ?? "server_error");
  return data as T;
};

// ---------- Challenges ----------

export type PoseInstructions = {
  conceptId?: string;
  category?: PoseCategory;
  difficulty?: PoseDifficulty;
  setupMinutes?: number;
  requiredObjects?: string[];
  dogRequirements?: string[];
  ownerPosition?: string;
  dogPosition?: string;
  cameraAngle?: string;
  framing?: string;
  steps?: string[];
  criteria?: Criterion[];
  safety?: string[];
};

export type MyEntry = {
  id: string;
  status: EntryStatus;
  heldReason: HeldReason | null;
  mediaPath: string;
  /** Dog Reels: the clip's still frame. */
  posterPath?: string | null;
  reviewRequested: boolean;
  rejectionReason: string | null;
  hiddenByReports: boolean;
};

export type MediaGame = "photo_pose" | "dog_reels" | "seasonal_selfie";

export type MediaChallenge = {
  challengeId: string;
  /** Which game the list came from (set by the app's hooks). */
  game?: MediaGame;
  tournamentId: string;
  name: string;
  mediaKind?: "photo" | "video";
  /** A friend battle: only its players see it; they get its code to invite more. */
  private?: boolean;
  inviteCode?: string | null;
  players?: number;
  title: string;
  brief: string;
  instructions: PoseInstructions;
  requiresOwner: boolean;
  referencePath: string | null;
  phase: MediaPhase;
  registrationOpensAt: string;
  startsAt: string;
  entriesCloseAt: string;
  endsAt: string;
  joined: boolean;
  entries: number;
  myEntry: MyEntry | null;
  myVote: string | null;
  serverNow: string;
};

export const listChallenges = (game: MediaGame = "photo_pose") => rpc<MediaChallenge[]>("media_challenge_list", { p_game: game });

/** A signed link to a reference image. Only works for images a published challenge or pose points at. */
export const referenceUrl = async (path: string) => {
  const { data, error } = await getClientOrThrow().storage.from("challenge-references").createSignedUrl(path, 3600);
  if (error || !data) throw new MediaError("image_unavailable");
  return data.signedUrl;
};

/** A signed link to one of your own photos. */
export const ownPhotoUrl = async (path: string) => {
  const { data, error } = await getClientOrThrow().storage.from("media-entries").createSignedUrl(path, 1800);
  if (error || !data) throw new MediaError("image_unavailable");
  return data.signedUrl;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Uploads a photo into your own staging folder. Only the edge function moves it anywhere others can see. */
export const stageUpload = async (uri: string) => {
  const client = getClientOrThrow();
  const { data: who } = await client.auth.getUser();
  if (!who.user) throw new MediaError("not_signed_in");
  const bytes = await (await fetch(uri)).arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new MediaError("image_too_large");
  const path = `${who.user.id}/incoming/${newId()}.jpg`;
  const { error } = await client.storage.from("media-entries").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new MediaError("upload_failed");
  return path;
};

/** Uploads a clip (and its still frame) into your own staging folder. */
const stageFile = async (uri: string, ext: "mp4" | "jpg", max: number, tooBig: string) => {
  const client = getClientOrThrow();
  const { data: who } = await client.auth.getUser();
  if (!who.user) throw new MediaError("not_signed_in");
  const bytes = await (await fetch(uri)).arrayBuffer();
  if (bytes.byteLength > max) throw new MediaError(tooBig);
  const path = `${who.user.id}/incoming/${newId()}.${ext}`;
  const { error } = await client.storage.from("media-entries").upload(path, bytes, { contentType: ext === "mp4" ? "video/mp4" : "image/jpeg", upsert: false });
  if (error) throw new MediaError("upload_failed");
  return path;
};

export type SubmitResult = { entry: { id: string; status: EntryStatus; heldReason: HeldReason | null } };

/** Dog Reels: sends a clip filmed in the app and its still frame. The server removes the files' metadata. */
export const submitReel = async (challengeId: string, dogId: string | null, videoUri: string, posterUri: string) => {
  const [uploadPath, posterPath] = await Promise.all([stageFile(videoUri, "mp4", 40 * 1024 * 1024, "video_too_large"), stageFile(posterUri, "jpg", 10 * 1024 * 1024, "image_too_large")]);
  return call<SubmitResult & { ok: true }>({ action: "submit", challengeId, dogId, uploadPath, posterPath }, 120_000);
};

// ---------- Friend battles ----------

export type FriendGame = "largest_country" | "photo_pose" | "dog_reels";
export type FriendBattle = { tournamentId: string; code: string; gameType: FriendGame; challengeId: string | null; endsAt: string };
/** A private copy of this week's game, three days long, with a code to invite friends. */
export const createFriendBattle = (game: FriendGame, dogId: string | null) => rpc<FriendBattle>("create_friend_battle", { p_game: game, p_dog_id: dogId });
export const joinFriendBattle = (code: string, dogId: string | null) => rpc<FriendBattle>("join_friend_battle", { p_code: code, p_dog_id: dogId });

export const submitEntry = async (challengeId: string, dogId: string | null, uri: string) => {
  const uploadPath = await stageUpload(uri);
  return call<SubmitResult & { ok: true }>({ action: "submit", challengeId, dogId, uploadPath }, 60_000);
};

export const withdrawEntry = (submissionId: string) => call({ action: "withdraw", submissionId });
export const requestReview = (submissionId: string, note?: string) => rpc("request_media_review", { p_submission_id: submissionId, p_note: note ?? null });

export const joinChallenge = (tournamentId: string, dogId: string | null) => rpc("join_tournament", { p_tournament_id: tournamentId, p_dog_id: dogId });

// ---------- Voting and results ----------

export type GalleryEntry = { id: string; dogName: string | null; url: string | null; posterUrl?: string | null; width: number; height: number; isMine: boolean; myVote: boolean; votes: number | null };

export const getGallery = (challengeId: string) => call<{ entries: GalleryEntry[] }>({ action: "gallery", challengeId }).then((r) => r.entries);
export const castVote = (submissionId: string) => rpc("cast_media_vote", { p_submission_id: submissionId });
export const clearVote = (challengeId: string) => rpc("clear_media_vote", { p_challenge_id: challengeId });

export type ReportReason = "not_the_challenge" | "inappropriate" | "not_their_photo" | "unsafe_for_dog" | "spam";
export const reportEntry = (submissionId: string, why: ReportReason) => rpc("report_media_submission", { p_submission_id: submissionId, p_reason: why, p_note: null });

export type ResultRow = { rank: number; id: string; dogName: string | null; url: string | null; posterUrl?: string | null; width: number; height: number; votes: number; isMine: boolean };
export const getResults = (challengeId: string) => call<{ total: number; totalVotes: number; rows: ResultRow[] }>({ action: "results", challengeId });

// ---------- Moderation (organizers) ----------

export type QueueItem = {
  id: string;
  status: "pending_review" | "held";
  url: string | null;
  dogName: string | null;
  submittedAt: string;
  checkStatus: "not_run" | "passed" | "failed" | "unclear" | "unavailable";
  check: { answers?: { id: string; answer: "yes" | "no" | "unclear"; confidence: number }[] } | null;
  heldReason: HeldReason | null;
  reviewRequested: boolean;
  reviewNote: string | null;
  hiddenByReports: boolean;
  reports: Partial<Record<ReportReason, number>>;
  challenge: { id: string; title: string; referenceUrl: string | null; criteria: Criterion[] } | null;
};

export const getQueue = () => call<{ items: QueueItem[] }>({ action: "queue" }).then((r) => r.items);
export const moderate = (submissionId: string, decision: "approve" | "reject", why?: ReportReason) =>
  rpc("moderate_media_submission", { p_submission_id: submissionId, p_decision: decision, p_reason: why ?? null });

// ---------- Pose ideas (organizers) ----------

export type ReviewStatus = "suggested" | "approved" | "rejected" | "published" | "retired";
export type ReferenceStatus = "none" | "pending" | "approved" | "rejected";

export type PoseConceptRow = {
  id: string;
  batch_id: string | null;
  title: string;
  description: string;
  category: PoseCategory;
  difficulty: PoseDifficulty;
  setup_minutes: number;
  required_objects: string[];
  dog_requirements: string[];
  owner_position: string;
  dog_position: string;
  camera_angle: string;
  framing: string;
  instructions: string[];
  objective_criteria: Criterion[];
  safety_notes: string[];
  safety_flags: string[];
  visual_reference_prompt: string;
  shareability: string;
  review_status: ReviewStatus;
  rejection_reason: string | null;
  reference_media_path: string | null;
  reference_source: "generated" | "uploaded" | null;
  reference_license: string | null;
  reference_status: ReferenceStatus;
  reference_check: { status?: string; answers?: { id: string; answer: string; confidence: number }[] | null; criteria?: Criterion[] } | null;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export const listConcepts = async () => {
  const { data, error } = await getClientOrThrow().from("photo_pose_concepts" as never).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new MediaError(reason(error.message));
  return (data ?? []) as unknown as PoseConceptRow[];
};

export const getConcept = async (id: string) => {
  const { data, error } = await getClientOrThrow().from("photo_pose_concepts" as never).select("*").eq("id", id).maybeSingle();
  if (error) throw new MediaError(reason(error.message));
  if (!data) throw new MediaError("pose_not_found");
  return data as unknown as PoseConceptRow;
};

export type GenerateResult = { cached: boolean; batchId: string; conceptIds: string[]; rejected: Rejection[] };

export const library = () => rpc<LibraryPose[]>("pose_library");

/**
 * DogPhotoPoseDiscoveryService: the app's side of pose discovery and curation. Gemini runs only on the server
 * (`media` function), only for organizers, and only ever produces suggestions. Players are served approved poses
 * from the database.
 */
export const DogPhotoPoseDiscoveryService = {
  /** Brainstorm 5 to 10 ideas for a theme. Repeating the same request within minutes returns the same batch. */
  brainstorm: (input: { theme: PoseTheme; difficulty: BatchDifficulty; count: number }) => call<GenerateResult & { ok: true }>({ action: "pose_generate", ...input }, 90_000),
  /** Write an idea by hand (or when Gemini is unavailable). */
  create: (concept: Record<string, unknown>) => rpc<PoseConceptRow>("create_pose_concept", { p_concept: concept }),
  revise: (id: string, patch: Record<string, unknown>) => rpc<PoseConceptRow>("update_pose_concept", { p_concept_id: id, p_patch: patch }),
  review: (id: string, decision: "approve" | "reject", opts: { reason?: string; safetyChecked?: boolean } = {}) =>
    rpc<PoseConceptRow>("review_pose_concept", { p_concept_id: id, p_decision: decision, p_reason: opts.reason ?? null, p_safety_checked: opts.safetyChecked ?? false }),
  /** Draft an example photo with the image model. Fails honestly when no image comes back. */
  draftReference: (id: string) => call<{ check: unknown }>({ action: "pose_reference_generate", conceptId: id }, 120_000),
  /** Use a licensed photo as the example. Its metadata is removed on the server. */
  uploadReference: async (id: string, uri: string, license: string) => {
    const uploadPath = await stageUpload(uri);
    return call<{ check: unknown }>({ action: "pose_reference_upload", conceptId: id, uploadPath, license }, 60_000);
  },
  reviewReference: (id: string, approve: boolean) => rpc<PoseConceptRow>("review_pose_reference", { p_concept_id: id, p_approve: approve }),
  publish: (id: string, t: { name: string; registrationOpensAt: string; startsAt: string; entriesCloseAt: string; endsAt: string }) =>
    rpc<{ id: string; tournament_id: string }>("publish_pose_challenge", {
      p_concept_id: id, p_name: t.name, p_registration_opens_at: t.registrationOpensAt, p_starts_at: t.startsAt, p_entries_close_at: t.entriesCloseAt, p_ends_at: t.endsAt,
    }),
  retire: (id: string) => rpc("retire_pose_concept", { p_concept_id: id }),
  /** Published poses for recommendations, with your history. */
  library,
};
