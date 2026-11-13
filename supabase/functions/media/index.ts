import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { generate, geminiKey, textOf } from "../_shared/gemini.ts";
import { ENTRY_CHECK_VERSION, buildCheckRequest, criteriaFor, decideCheck, parseCheck, type Criterion } from "./entryCheck.ts";
import { stripJpegMetadata } from "./jpeg.ts";
import { cleanMp4 } from "./mp4.ts";
import {
  POSE_PROMPT_VERSION,
  POSE_SCHEMA_VERSION,
  POSE_THEMES,
  REFERENCE_CRITERIA,
  REFERENCE_PROMPT_VERSION,
  buildDiscoveryRequest,
  buildReferenceRequest,
  clampCount,
  extractImage,
  parseDiscovery,
  type BatchDifficulty,
  type PoseTheme,
} from "./poses.ts";

/**
 * Media tournaments (phase 4A) and Photo Pose discovery. The only writer of entries and reference images.
 *
 * Players
 *   POST { action: "submit", challengeId, dogId, uploadPath }   clean the uploaded photo, record the entry, run the check
 *   POST { action: "submit", challengeId, dogId, uploadPath, posterPath }  Dog Reels: a clip (.mp4, up to 15 s) and its
 *                                                               still frame (.jpg); both cleaned, the check reads the frame
 *   POST { action: "withdraw", submissionId }                   withdraw your entry and delete its photo
 *   POST { action: "gallery", challengeId }                     entries to vote on, as short signed links
 *   POST { action: "results", challengeId }                     final ranking once voting closes
 * Organizers
 *   POST { action: "queue" }                                    entries waiting for a moderator
 *   POST { action: "pose_generate", theme, difficulty, count }  ask Gemini for 5 to 10 pose ideas (never published)
 *   POST { action: "pose_reference_generate", conceptId }       draft an example photo with the image model
 *   POST { action: "pose_reference_upload", conceptId, uploadPath, license }  use a licensed photo instead
 *
 * Photos are stored only after their metadata (location included) is removed, and are only ever handed out as signed
 * links that expire. Votes, reports and moderation decisions are SQL functions the app calls directly; they enforce
 * their own rules.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ENTRIES = "media-entries";
const REFERENCES = "challenge-references";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_MS = 16_000;
const MIN_POSTER_SIDE = 240;
const MIN_SIDE = 480;
const LINK_SECONDS = 30 * 60;
const CHECK_MODEL = "gemini-2.5-flash";
const IDEA_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const BATCHES_PER_HOUR = 12;
const BATCH_CACHE_MS = 10 * 60_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
/** Never log photos, paths or anything a player wrote. */
const log = (event: string, detail: Record<string, unknown> = {}) => console.error(`[media] ${event}`, JSON.stringify(detail));

/** Error codes the SQL functions raise that the app knows how to explain. */
const KNOWN = new Set([
  "challenge_not_found", "entries_closed", "not_joined", "not_your_dog", "not_your_file", "entry_not_found", "entry_closed",
  "gallery_not_open", "results_not_ready", "not_an_organizer", "pose_not_found", "pose_locked", "not_signed_in", "not_a_video_challenge",
]);
const fromDb = (error: { message?: string } | null, fallback = "server_error") => {
  return [...KNOWN].find((k) => error?.message?.includes(k)) ?? fallback;
};

// Per-instance sliding window; a brake on bursts, not a quota.
const recent = new Map<string, number[]>();
const allowed = (key: string, perMinute: number) => {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= perMinute) return false;
  times.push(now);
  recent.set(key, times);
  return true;
};

const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Only the caller's own staging folder, and only a .jpg in it. */
const incomingPath = (userId: string, path: unknown) =>
  typeof path === "string" && new RegExp(`^${userId}/incoming/[A-Za-z0-9._-]{1,80}\\.jpe?g$`).test(path) ? path : null;

/** The caller's own staged clip (.mp4). */
const incomingVideoPath = (userId: string, path: unknown) =>
  typeof path === "string" && new RegExp(`^${userId}/incoming/[A-Za-z0-9._-]{1,80}\\.mp4$`).test(path) ? path : null;

/** Downloads a staged upload and returns it without metadata, or an error code. */
const cleanUpload = async (admin: SupabaseClient, path: string, minSide = MIN_SIDE) => {
  const { data, error } = await admin.storage.from(ENTRIES).download(path);
  if (error || !data) return { error: "upload_missing" as const };
  if (data.size > MAX_BYTES) return { error: "image_too_large" as const };
  const cleaned = stripJpegMetadata(new Uint8Array(await data.arrayBuffer()));
  if (!cleaned) return { error: "unsupported_image" as const };
  if (Math.min(cleaned.info.width, cleaned.info.height) < minSide) return { error: "image_too_small" as const };
  return { cleaned };
};

/** Downloads a staged clip and returns it without metadata boxes, or an error code. */
const cleanVideo = async (admin: SupabaseClient, path: string) => {
  const { data, error } = await admin.storage.from(ENTRIES).download(path);
  if (error || !data) return { error: "upload_missing" as const };
  if (data.size > MAX_VIDEO_BYTES) return { error: "video_too_large" as const };
  const cleaned = cleanMp4(new Uint8Array(await data.arrayBuffer()));
  if (!cleaned) return { error: "unsupported_video" as const };
  if (cleaned.info.durationMs > MAX_VIDEO_MS) return { error: "video_too_long" as const };
  if (cleaned.info.durationMs < 1000) return { error: "video_too_short" as const };
  return { cleaned };
};

/** Runs the objective check on a photo. Any failure to get a usable answer leaves the decision to a person. */
const checkPhoto = async (criteria: Criterion[], image: { mimeType: string; base64: string }) => {
  if (!geminiKey()) return { status: "unavailable" as const, result: null, heldReason: null };
  const reply = await generate(CHECK_MODEL, buildCheckRequest(criteria, image), { timeoutMs: 25_000, retries: 1 });
  if (!reply.ok) {
    log("check_unavailable", { error: reply.error });
    return { status: "unavailable" as const, result: null, heldReason: null };
  }
  const result = parseCheck(textOf(reply.data), criteria);
  const decision = decideCheck(result, criteria);
  return { status: result ? decision.status : ("unclear" as const), result, heldReason: decision.heldReason };
};

type Instructions = { criteria?: Criterion[] };

const submit = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  if (!allowed(`submit:${userId}`, 6)) return fail("rate_limited", 429);
  const path = incomingPath(userId, body.uploadPath) ?? incomingVideoPath(userId, body.uploadPath);
  if (!path || typeof body.challengeId !== "string") return fail("bad_request");
  const dogId = typeof body.dogId === "string" ? body.dogId : null;

  const { data: challenge } = await admin.from("media_challenges").select("id, instructions, requires_owner, media_kind").eq("id", body.challengeId).maybeSingle();
  if (!challenge) return fail("challenge_not_found", 404);
  const c = challenge as { id: string; instructions: Instructions; requires_owner: boolean; media_kind: "photo" | "video" };
  if (c.media_kind === "video") return submitVideo(admin, userId, c, dogId, body);

  const up = await cleanUpload(admin, path);
  if ("error" in up) {
    await admin.storage.from(ENTRIES).remove([path]);
    return fail(up.error!);
  }
  const { cleaned } = up;
  const finalPath = `${userId}/${c.id}/${crypto.randomUUID()}.jpg`;
  const { error: putError } = await admin.storage.from(ENTRIES).upload(finalPath, cleaned.bytes, { contentType: "image/jpeg", upsert: false });
  await admin.storage.from(ENTRIES).remove([path]);
  if (putError) {
    log("store_failed", { message: putError.message });
    return fail("server_error", 500);
  }

  const { data: recorded, error } = await admin.rpc("record_media_submission", {
    p_challenge_id: c.id,
    p_user_id: userId,
    p_dog_id: dogId,
    p_media_path: finalPath,
    p_width: cleaned.info.width,
    p_height: cleaned.info.height,
    p_bytes: cleaned.bytes.length,
  });
  if (error) {
    await admin.storage.from(ENTRIES).remove([finalPath]);
    return fail(fromDb(error));
  }
  const rec = recorded as { submission: { id: string }; replacedPath: string | null };
  if (rec.replacedPath) await admin.storage.from(ENTRIES).remove([rec.replacedPath]);

  const criteria = criteriaFor(c.instructions?.criteria ?? [], c.requires_owner);
  const check = await checkPhoto(criteria, { mimeType: "image/jpeg", base64: toBase64(cleaned.bytes) });
  const { data: entry, error: applyError } = await admin.rpc("apply_media_check", {
    p_submission_id: rec.submission.id,
    p_check_status: check.status,
    p_result: check.result,
    p_version: ENTRY_CHECK_VERSION,
    p_held_reason: check.heldReason,
  });
  if (applyError) log("apply_check_failed", { message: applyError.message });
  const e = (entry ?? rec.submission) as { id: string; status: string; held_reason: string | null };
  return json({ ok: true, entry: { id: e.id, status: e.status, heldReason: e.held_reason ?? null }, removedMetadata: cleaned.removed });
};

/** A Dog Reels entry: the clip and its still frame, both cleaned; the check reads the frame (is a dog in it). */
const submitVideo = async (
  admin: SupabaseClient,
  userId: string,
  c: { id: string; instructions: Instructions; requires_owner: boolean },
  dogId: string | null,
  body: Record<string, unknown>,
) => {
  const clipPath = incomingVideoPath(userId, body.uploadPath);
  const framePath = incomingPath(userId, body.posterPath);
  if (!clipPath || !framePath) return fail("bad_request");
  const staged = [clipPath, framePath];
  const [video, frame] = await Promise.all([cleanVideo(admin, clipPath), cleanUpload(admin, framePath, MIN_POSTER_SIDE)]);
  if ("error" in video || "error" in frame) {
    await admin.storage.from(ENTRIES).remove(staged);
    return fail(("error" in video ? video.error : (frame as { error: string }).error)!);
  }
  const id = crypto.randomUUID();
  const finalClip = `${userId}/${c.id}/${id}.mp4`;
  const finalFrame = `${userId}/${c.id}/${id}.jpg`;
  const [putClip, putFrame] = await Promise.all([
    admin.storage.from(ENTRIES).upload(finalClip, video.cleaned.bytes, { contentType: "video/mp4", upsert: false }),
    admin.storage.from(ENTRIES).upload(finalFrame, frame.cleaned.bytes, { contentType: "image/jpeg", upsert: false }),
  ]);
  await admin.storage.from(ENTRIES).remove(staged);
  if (putClip.error || putFrame.error) {
    log("store_failed", { message: putClip.error?.message ?? putFrame.error?.message });
    await admin.storage.from(ENTRIES).remove([finalClip, finalFrame]);
    return fail("server_error", 500);
  }
  const { data: recorded, error } = await admin.rpc("record_media_video", {
    p_challenge_id: c.id,
    p_user_id: userId,
    p_dog_id: dogId,
    p_media_path: finalClip,
    p_poster_path: finalFrame,
    p_width: Math.max(1, video.cleaned.info.width || frame.cleaned.info.width),
    p_height: Math.max(1, video.cleaned.info.height || frame.cleaned.info.height),
    p_bytes: video.cleaned.bytes.length,
    p_duration_ms: Math.min(MAX_VIDEO_MS, video.cleaned.info.durationMs),
  });
  if (error) {
    await admin.storage.from(ENTRIES).remove([finalClip, finalFrame]);
    return fail(fromDb(error));
  }
  const rec = recorded as { submission: { id: string }; replacedPath: string | null; replacedPoster: string | null };
  const old = [rec.replacedPath, rec.replacedPoster].filter((p): p is string => typeof p === "string");
  if (old.length) await admin.storage.from(ENTRIES).remove(old);

  const criteria = criteriaFor(c.instructions?.criteria ?? [], false);
  const check = await checkPhoto(criteria, { mimeType: "image/jpeg", base64: toBase64(frame.cleaned.bytes) });
  const { data: entry, error: applyError } = await admin.rpc("apply_media_check", {
    p_submission_id: rec.submission.id,
    p_check_status: check.status,
    p_result: check.result,
    p_version: ENTRY_CHECK_VERSION,
    p_held_reason: check.heldReason,
  });
  if (applyError) log("apply_check_failed", { message: applyError.message });
  const e = (entry ?? rec.submission) as { id: string; status: string; held_reason: string | null };
  return json({ ok: true, entry: { id: e.id, status: e.status, heldReason: e.held_reason ?? null }, removedMetadata: video.cleaned.removed });
};

/** Still frames for clip entries, keyed by entry id (photo entries have none). */
const postersOf = async (admin: SupabaseClient, ids: string[]) => {
  if (!ids.length) return new Map<string, string>();
  const { data } = await admin.from("media_submissions").select("id, poster_path").in("id", ids).not("poster_path", "is", null);
  return new Map(((data ?? []) as { id: string; poster_path: string }[]).map((r) => [r.id, r.poster_path]));
};

const withdraw = async (caller: SupabaseClient, admin: SupabaseClient, body: Record<string, unknown>) => {
  if (typeof body.submissionId !== "string") return fail("bad_request");
  const poster = (await postersOf(admin, [body.submissionId])).get(body.submissionId);
  const { data: path, error } = await caller.rpc("withdraw_media_submission", { p_submission_id: body.submissionId });
  if (error) return fail(fromDb(error));
  const gone = [path, poster].filter((p): p is string => typeof p === "string");
  if (gone.length) await admin.storage.from(ENTRIES).remove(gone);
  return json({ ok: true });
};

/** Signed links for a list of private paths, in the same order. Paths never leave the server. */
const sign = async (admin: SupabaseClient, bucket: string, paths: string[]) => {
  if (!paths.length) return [] as (string | null)[];
  const { data } = await admin.storage.from(bucket).createSignedUrls(paths, LINK_SECONDS);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => byPath.get(p) ?? null);
};

type GalleryRow = { submission_id: string; dog_name: string | null; media_path: string; width: number; height: number; is_mine: boolean; my_vote: boolean; votes: number | null };

const gallery = async (caller: SupabaseClient, admin: SupabaseClient, body: Record<string, unknown>) => {
  if (typeof body.challengeId !== "string") return fail("bad_request");
  const { data, error } = await caller.rpc("media_gallery", { p_challenge_id: body.challengeId });
  if (error) return fail(fromDb(error));
  const rows = ((data ?? []) as GalleryRow[]).slice(0, 300);
  const posters = await postersOf(admin, rows.map((r) => r.submission_id));
  const [urls, posterUrls] = await Promise.all([sign(admin, ENTRIES, rows.map((r) => r.media_path)), sign(admin, ENTRIES, rows.map((r) => posters.get(r.submission_id) ?? "")).catch(() => [])]);
  return json({
    ok: true,
    entries: rows.map((r, i) => ({ id: r.submission_id, dogName: r.dog_name, url: urls[i], posterUrl: posters.has(r.submission_id) ? (posterUrls[i] ?? null) : null, width: r.width, height: r.height, isMine: r.is_mine, myVote: r.my_vote, votes: r.votes })),
  });
};

type ResultRow = { rank: number; submission_id: string; dog_name: string | null; media_path: string; width: number; height: number; votes: number; is_mine: boolean };

const results = async (caller: SupabaseClient, admin: SupabaseClient, body: Record<string, unknown>) => {
  if (typeof body.challengeId !== "string") return fail("bad_request");
  const { data, error } = await caller.rpc("media_results", { p_challenge_id: body.challengeId });
  if (error) return fail(fromDb(error));
  const rows = (data ?? []) as ResultRow[];
  const shown = rows.filter((r) => r.rank <= 30 || r.is_mine);
  const posters = await postersOf(admin, shown.map((r) => r.submission_id));
  const [urls, posterUrls] = await Promise.all([sign(admin, ENTRIES, shown.map((r) => r.media_path)), sign(admin, ENTRIES, shown.map((r) => posters.get(r.submission_id) ?? "")).catch(() => [])]);
  return json({
    ok: true,
    total: rows.length,
    totalVotes: rows.reduce((n, r) => n + r.votes, 0),
    rows: shown.map((r, i) => ({ rank: r.rank, id: r.submission_id, dogName: r.dog_name, url: urls[i], posterUrl: posters.has(r.submission_id) ? (posterUrls[i] ?? null) : null, width: r.width, height: r.height, votes: r.votes, isMine: r.is_mine })),
  });
};

const isOrganizer = async (caller: SupabaseClient) => {
  const { data } = await caller.rpc("is_tournament_organizer");
  return data === true;
};

const queue = async (admin: SupabaseClient) => {
  const { data } = await admin
    .from("media_submissions")
    .select("id, challenge_id, status, check_status, check_result, held_reason, review_requested_at, review_note, hidden_by_reports, report_count, media_path, poster_path, submitted_at, dog_id")
    .in("status", ["pending_review", "held"])
    .order("review_requested_at", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: true })
    .limit(50);
  const rows = (data ?? []) as {
    id: string; challenge_id: string; status: string; check_status: string; check_result: unknown; held_reason: string | null;
    review_requested_at: string | null; review_note: string | null; hidden_by_reports: boolean; report_count: number; media_path: string; poster_path: string | null; submitted_at: string; dog_id: string | null;
  }[];
  const challengeIds = [...new Set(rows.map((r) => r.challenge_id))];
  const ids = rows.map((r) => r.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: challenges }, { data: reports }, { data: dogs }] = await Promise.all([
    admin.from("media_challenges").select("id, title, instructions, reference_path, requires_owner").in("id", challengeIds.length ? challengeIds : none),
    admin.from("media_reports").select("submission_id, reason").in("submission_id", ids.length ? ids : none),
    admin.from("dogs").select("id, name").in("id", rows.map((r) => r.dog_id).filter((d): d is string => !!d).concat(none)),
  ]);
  const cs = (challenges ?? []) as { id: string; title: string; instructions: Instructions; reference_path: string | null; requires_owner: boolean }[];
  const refUrls = await sign(admin, REFERENCES, cs.map((c) => c.reference_path).filter((p): p is string => !!p));
  const refOf = new Map(cs.filter((c) => c.reference_path).map((c, i) => [c.id, refUrls[i]]));
  // Clips are reviewed by their still frame (and can be played from the link).
  const urls = await sign(admin, ENTRIES, rows.map((r) => r.poster_path ?? r.media_path));
  const reasonsOf = new Map<string, Record<string, number>>();
  ((reports ?? []) as { submission_id: string; reason: string }[]).forEach((r) => {
    const m = reasonsOf.get(r.submission_id) ?? {};
    m[r.reason] = (m[r.reason] ?? 0) + 1;
    reasonsOf.set(r.submission_id, m);
  });
  const dogName = new Map(((dogs ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));
  return json({
    ok: true,
    items: rows.map((r, i) => {
      const c = cs.find((x) => x.id === r.challenge_id);
      return {
        id: r.id,
        status: r.status,
        url: urls[i],
        dogName: r.dog_id ? dogName.get(r.dog_id) ?? null : null,
        submittedAt: r.submitted_at,
        checkStatus: r.check_status,
        check: r.check_result,
        heldReason: r.held_reason,
        reviewRequested: !!r.review_requested_at,
        reviewNote: r.review_note,
        hiddenByReports: r.hidden_by_reports,
        reports: reasonsOf.get(r.id) ?? {},
        challenge: c ? { id: c.id, title: c.title, referenceUrl: refOf.get(c.id) ?? null, criteria: criteriaFor(c.instructions?.criteria ?? [], c.requires_owner) } : null,
      };
    }),
  });
};

// ---------- Pose discovery ----------

const DIFFICULTIES: readonly BatchDifficulty[] = ["easy", "medium", "mixed"];

const poseGenerate = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const theme = POSE_THEMES.includes(body.theme as PoseTheme) ? (body.theme as PoseTheme) : null;
  const difficulty = DIFFICULTIES.includes(body.difficulty as BatchDifficulty) ? (body.difficulty as BatchDifficulty) : null;
  if (!theme || !difficulty) return fail("bad_request");
  const count = clampCount(Number(body.count));

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data: mine } = await admin.from("photo_pose_batches").select("id, theme, difficulty, requested, status, created_at").eq("created_by", userId).gte("created_at", hourAgo).order("created_at", { ascending: false });
  const batches = (mine ?? []) as { id: string; theme: string; difficulty: string; requested: number; status: string; created_at: string }[];
  // The same request a few minutes later returns the same ideas instead of paying for new ones.
  const cached = batches.find((b) => b.status === "done" && b.theme === theme && b.difficulty === difficulty && b.requested === count && Date.now() - Date.parse(b.created_at) < BATCH_CACHE_MS);
  if (cached) {
    const { data: ids } = await admin.from("photo_pose_concepts").select("id").eq("batch_id", cached.id);
    return json({ ok: true, cached: true, batchId: cached.id, conceptIds: ((ids ?? []) as { id: string }[]).map((r) => r.id), rejected: [] });
  }
  if (batches.length >= BATCHES_PER_HOUR) return fail("rate_limited", 429);
  if (!geminiKey()) return fail("ai_unavailable", 503);

  const { data: known } = await admin.from("photo_pose_concepts").select("title, fingerprint, dog_position, owner_position").order("created_at", { ascending: false }).limit(500);
  const knownPoses = ((known ?? []) as { title: string; fingerprint: string; dog_position: string; owner_position: string }[]).map((k) => ({
    title: k.title, fingerprint: k.fingerprint, dogPosition: k.dog_position, ownerPosition: k.owner_position,
  }));

  const record = (concepts: unknown[], rejected: unknown[], error: string | null) =>
    admin.rpc("record_pose_batch", {
      p_user_id: userId, p_theme: theme, p_difficulty: difficulty, p_requested: count, p_model: IDEA_MODEL,
      p_schema_version: POSE_SCHEMA_VERSION, p_prompt_version: POSE_PROMPT_VERSION, p_concepts: concepts, p_rejected: rejected, p_error: error,
    });

  const reply = await generate(IDEA_MODEL, buildDiscoveryRequest({ theme, difficulty, count, avoid: knownPoses.map((k) => k.title) }), { timeoutMs: 60_000, retries: 2 });
  if (!reply.ok) {
    await record([], [], reply.error);
    log("ideas_unavailable", { error: reply.error });
    return fail(reply.error === "rate_limited" ? "ai_busy" : "ai_unavailable", 503);
  }
  const parsed = parseDiscovery(textOf(reply.data), knownPoses, difficulty);
  if (!parsed.ok) {
    await record([], [], parsed.error);
    return fail("ai_bad_response", 502);
  }
  const { data: saved, error } = await record(parsed.accepted, parsed.rejected, null);
  if (error) {
    log("batch_record_failed", { message: error.message });
    return fail("server_error", 500);
  }
  const s = saved as { batchId: string; conceptIds: string[] };
  return json({ ok: true, cached: false, batchId: s.batchId, conceptIds: s.conceptIds, rejected: parsed.rejected });
};

type ConceptRow = {
  id: string; title: string; review_status: string; objective_criteria: Criterion[]; visual_reference_prompt: string;
  owner_position: string; dog_position: string; camera_angle: string; framing: string;
};

const loadConcept = async (admin: SupabaseClient, id: unknown) => {
  if (typeof id !== "string") return null;
  const { data } = await admin.from("photo_pose_concepts").select("id, title, review_status, objective_criteria, visual_reference_prompt, owner_position, dog_position, camera_angle, framing").eq("id", id).maybeSingle();
  return (data as ConceptRow | null) ?? null;
};

/** Stores a reference image, checks it against the pose, and puts it up for the organizer's review. */
const storeReference = async (admin: SupabaseClient, concept: ConceptRow, image: { mimeType: string; bytes: Uint8Array }, source: "generated" | "uploaded", license: string | null) => {
  const ext = image.mimeType === "image/png" ? "png" : "jpg";
  const path = `concepts/${concept.id}/${crypto.randomUUID()}.${ext}`;
  const { error: putError } = await admin.storage.from(REFERENCES).upload(path, image.bytes, { contentType: image.mimeType, upsert: false });
  if (putError) {
    log("reference_store_failed", { message: putError.message });
    return fail("server_error", 500);
  }
  const criteria = [...criteriaFor(concept.objective_criteria ?? [], true), ...REFERENCE_CRITERIA];
  const check = await checkPhoto(criteria, { mimeType: image.mimeType, base64: toBase64(image.bytes) });
  const record = { version: ENTRY_CHECK_VERSION, promptVersion: REFERENCE_PROMPT_VERSION, status: check.status, answers: check.result?.answers ?? null, criteria };
  const { data, error } = await admin.rpc("set_pose_reference", { p_concept_id: concept.id, p_path: path, p_source: source, p_license: license, p_check: record });
  if (error) {
    await admin.storage.from(REFERENCES).remove([path]);
    return fail(fromDb(error));
  }
  const replaced = (data as { replacedPath?: string | null })?.replacedPath;
  if (replaced) await admin.storage.from(REFERENCES).remove([replaced]);
  return json({ ok: true, check: record });
};

const poseReferenceGenerate = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  if (!allowed(`refgen:${userId}`, 4)) return fail("rate_limited", 429);
  const concept = await loadConcept(admin, body.conceptId);
  if (!concept) return fail("pose_not_found", 404);
  if (!["suggested", "approved"].includes(concept.review_status)) return fail("pose_locked");
  if (!geminiKey()) return fail("image_generation_unavailable", 503);
  const reply = await generate(IMAGE_MODEL, buildReferenceRequest({
    title: concept.title, visualReferencePrompt: concept.visual_reference_prompt, ownerPosition: concept.owner_position,
    dogPosition: concept.dog_position, cameraAngle: concept.camera_angle, framing: concept.framing,
  }), { timeoutMs: 90_000, retries: 1 });
  const image = reply.ok ? extractImage(reply.data) : null;
  if (!image) {
    log("reference_generation_failed", { error: reply.ok ? "no_image" : reply.error });
    return fail("image_generation_unavailable", 503);
  }
  return storeReference(admin, concept, { mimeType: image.mimeType, bytes: fromBase64(image.base64) }, "generated", null);
};

const poseReferenceUpload = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const path = incomingPath(userId, body.uploadPath);
  const license = typeof body.license === "string" ? body.license.trim().slice(0, 200) : "";
  if (!path) return fail("bad_request");
  if (license.length < 3) return fail("license_required");
  const concept = await loadConcept(admin, body.conceptId);
  if (!concept) return fail("pose_not_found", 404);
  if (!["suggested", "approved"].includes(concept.review_status)) return fail("pose_locked");
  const up = await cleanUpload(admin, path);
  await admin.storage.from(ENTRIES).remove([path]);
  if ("error" in up) return fail(up.error!);
  return storeReference(admin, concept, { mimeType: "image/jpeg", bytes: up.cleaned.bytes }, "uploaded", license);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("unauthorized", 401);
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  const userId = who?.user?.id;
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    switch (body.action) {
      case "submit":
        return await submit(admin, userId, body);
      case "withdraw":
        return await withdraw(caller, admin, body);
      case "gallery":
        return await gallery(caller, admin, body);
      case "results":
        return await results(caller, admin, body);
    }
    if (!(await isOrganizer(caller))) return fail("not_an_organizer", 403);
    switch (body.action) {
      case "queue":
        return await queue(admin);
      case "pose_generate":
        return await poseGenerate(admin, userId, body);
      case "pose_reference_generate":
        return await poseReferenceGenerate(admin, userId, body);
      case "pose_reference_upload":
        return await poseReferenceUpload(admin, userId, body);
      default:
        return fail("unknown_action");
    }
  } catch (error) {
    log("unhandled", { action: body.action, message: error instanceof Error ? error.message : String(error) });
    return fail("server_error", 500);
  }
});
