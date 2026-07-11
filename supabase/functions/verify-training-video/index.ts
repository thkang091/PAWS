/**
 * verify-training-video — Supabase Edge Function
 *
 * Receives a training video submission, fetches the video and
 * reference photos from Supabase Storage, assembles the master
 * + activity-specific VLM prompts, calls Gemini 2.5 Flash, parses
 * and normalises the structured JSON response, stores it, then
 * issues idempotent rewards if the verdict is PASS.
 *
 * ── Security model ───────────────────────────────────────────
 * • GEMINI_API_KEY and GEMINI_MODEL are Supabase project secrets
 *   (set via `supabase secrets set`).  They are NEVER exposed to
 *   the mobile client via EXPO_PUBLIC_* variables.
 * • The function runs as service_role and is the only code path
 *   authorised to write dog_training_verification_results rows.
 * • The mobile client may only call this function with a valid
 *   JWT (authenticated user) and a submission_id that belongs to
 *   one of their dogs.
 *
 * DO NOT add placeholder verdicts, fake confidence scores, or
 * simulated PASS/FAIL values to this function.
 */

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_VLM_PROMPT } from "../../../src/data/masterPrompt.ts";

// ─── Environment ──────────────────────────────────────────────────────────────

/**
 * GEMINI_API_KEY and GEMINI_MODEL are Supabase project secrets.
 * Set them with:
 *   supabase secrets set GEMINI_API_KEY=<your-key>
 *   supabase secrets set GEMINI_MODEL=gemini-2.5-flash
 *
 * Never set these as EXPO_PUBLIC_* variables — that would expose
 * them to every mobile client.
 */
const GEMINI_API_KEY: string | undefined = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL: string = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY: string = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const VIDEO_BUCKET = "dog-activity-videos";
const REFERENCE_PHOTO_BUCKET = "dog-activity-photos";

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Request body ─────────────────────────────────────────────────────────────

interface VerifyRequest {
  submission_id: string;
  dog_id: string;
  activity_id: string;
  roadmap_day_id?: string | null;
  challenge_attempt_id?: string | null;
  tournament_attempt_id?: string | null;
}

type MinimalGeminiVerdict = {
  activityId: string;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  observations: string[];
  missingEvidence: string[];
  retryInstruction: string | null;
};

type StoredVerdict = MinimalGeminiVerdict & {
  rawGeminiResponse: unknown;
  latencyMs: number;
};

function inferMimeType(path: string, fallback: string): string {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

function splitBucketPath(storagePath: string, fallbackBucket: string): { bucket: string; path: string } {
  const [maybeBucket, ...rest] = storagePath.split("/");
  if (
    maybeBucket === VIDEO_BUCKET ||
    maybeBucket === REFERENCE_PHOTO_BUCKET
  ) {
    return { bucket: maybeBucket, path: rest.join("/") };
  }
  return { bucket: fallbackBucket, path: storagePath };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function downloadStorageObject(
  serviceClient: any,
  storagePath: string,
  fallbackBucket: string,
): Promise<{ bytes: Uint8Array; mimeType: string; bucket: string; path: string }> {
  const { bucket, path } = splitBucketPath(storagePath, fallbackBucket);
  const { data, error } = await serviceClient.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Storage download failed for ${bucket}/${path}: ${error?.message ?? "missing data"}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const mimeType = data.type || inferMimeType(path, fallbackBucket === VIDEO_BUCKET ? "video/mp4" : "image/jpeg");
  return { bytes, mimeType, bucket, path };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseGeminiText(raw: any): string {
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini response did not include candidate text.");
  const text = parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
  if (!text) throw new Error("Gemini response text was empty.");
  return text;
}

function parseStrictVerdict(raw: unknown, activityId: string): MinimalGeminiVerdict {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") throw new Error("Gemini verdict is not an object.");
  const value = parsed as Record<string, unknown>;
  if (value.activityId !== activityId) throw new Error("Gemini verdict activityId does not match request.");
  if (!["PASS", "FAIL", "NEEDS_REVIEW"].includes(String(value.verdict))) {
    throw new Error("Gemini verdict must be PASS, FAIL, or NEEDS_REVIEW.");
  }
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) {
    throw new Error("Gemini confidence must be a number from 0 to 1.");
  }
  if (!Array.isArray(value.observations) || value.observations.some((item) => typeof item !== "string")) {
    throw new Error("Gemini observations must be an array of strings.");
  }
  if (!Array.isArray(value.missingEvidence) || value.missingEvidence.some((item) => typeof item !== "string")) {
    throw new Error("Gemini missingEvidence must be an array of strings.");
  }
  if (value.retryInstruction !== null && typeof value.retryInstruction !== "string") {
    throw new Error("Gemini retryInstruction must be a string or null.");
  }
  if (value.missingEvidence.length > 0 && value.verdict === "FAIL") {
    return {
      activityId,
      verdict: "NEEDS_REVIEW",
      confidence: value.confidence,
      observations: value.observations as string[],
      missingEvidence: value.missingEvidence as string[],
      retryInstruction: (value.retryInstruction as string | null) ?? "Please record again with all required evidence visible.",
    };
  }
  return {
    activityId,
    verdict: value.verdict as MinimalGeminiVerdict["verdict"],
    confidence: value.confidence,
    observations: value.observations as string[],
    missingEvidence: value.missingEvidence as string[],
    retryInstruction: value.retryInstruction as string | null,
  };
}

async function callGemini({
  activity,
  video,
  referenceParts,
}: {
  activity: any;
  video: { bytes: Uint8Array; mimeType: string };
  referenceParts: { assetType: string; bytes: Uint8Array; mimeType: string }[];
}): Promise<StoredVerdict> {
  const geminiEndpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const started = Date.now();
  const schema = {
    type: "object",
    properties: {
      activityId: { type: "string" },
      verdict: { type: "string", enum: ["PASS", "FAIL", "NEEDS_REVIEW"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      observations: { type: "array", items: { type: "string" } },
      missingEvidence: { type: "array", items: { type: "string" } },
      retryInstruction: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: ["activityId", "verdict", "confidence", "observations", "missingEvidence", "retryInstruction"],
    additionalProperties: false,
  };
  const response = await fetch(geminiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: MASTER_VLM_PROMPT },
          { text: activity.vlm_prompt },
          {
            text:
              "Return only this strict JSON shape: " +
              "{\"activityId\":\"string\",\"verdict\":\"PASS | FAIL | NEEDS_REVIEW\",\"confidence\":0.0,\"observations\":[\"string\"],\"missingEvidence\":[\"string\"],\"retryInstruction\":\"string | null\"}. " +
              "Missing evidence is never FAIL. Owner confirmation is not evidence.",
          },
          { inlineData: { mimeType: video.mimeType, data: bytesToBase64(video.bytes) } },
          ...referenceParts.flatMap((ref) => [
            { text: `Reference photo for ${ref.assetType}` },
            { inlineData: { mimeType: ref.mimeType, data: bytesToBase64(ref.bytes) } },
          ]),
        ],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  const rawGeminiResponse = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(rawGeminiResponse)}`);
  }
  const verdict = parseStrictVerdict(parseGeminiText(rawGeminiResponse), activity.id);
  return {
    ...verdict,
    rawGeminiResponse,
    latencyMs: Date.now() - started,
  };
}

async function storeVerdict({
  serviceClient,
  submission,
  activity,
  promptVersion,
  referenceAssetPaths,
  result,
  isChallengeGame = false,
}: {
  serviceClient: any;
  submission: any;
  activity: any;
  promptVersion: number | null;
  referenceAssetPaths: string[];
  result: StoredVerdict;
  isChallengeGame?: boolean;
}): Promise<void> {
  const status = result.verdict === "PASS"
    ? "passed"
    : result.verdict === "FAIL"
      ? "failed"
      : "needs_review";
  const lowerVerdict = result.verdict.toLowerCase();
  // Training result/progress tables have training_catalog_activities foreign
  // keys. Challenge game IDs intentionally do not belong there; challenge and
  // tournament results are stored in their dedicated attempt tables instead.
  if (!isChallengeGame) {
    const { error: resultError } = await serviceClient
      .from("dog_training_verification_results")
      .upsert({
        submission_id: submission.id,
        dog_id: submission.dog_id,
        activity_id: activity.id,
        verdict: result.verdict,
        confidence: result.confidence,
        scorable: result.verdict !== "NEEDS_REVIEW",
        clip_quality: {
          missingEvidence: result.missingEvidence,
        },
        observed_events: result.observations.map((observation) => ({ observation })),
        satisfied_criteria: result.verdict === "PASS" ? activity.pass_criteria ?? [] : [],
        failed_criteria: result.verdict === "FAIL" ? activity.fail_criteria ?? [] : [],
        missing_evidence: result.missingEvidence,
        matched_reference_assets: [],
        pass_reason: result.verdict === "PASS" ? result.observations.join(" ") : null,
        fail_reason: result.verdict === "FAIL" ? result.observations.join(" ") : null,
        needs_human_review: result.verdict === "NEEDS_REVIEW",
        suggested_retry_instruction: result.retryInstruction,
        model_used: GEMINI_MODEL,
        vlm_latency_ms: result.latencyMs,
        prompt_version: promptVersion,
        model_identifier: GEMINI_MODEL,
        reference_asset_storage_paths: referenceAssetPaths,
        raw_gemini_response: result.rawGeminiResponse,
        reward_granted: false,
      }, { onConflict: "submission_id" });
    if (resultError) throw resultError;
  }

  const { error: submissionError } = await serviceClient
    .from("dog_training_video_submissions")
    .update({
      status,
      vlm_verdict: lowerVerdict,
      vlm_confidence: result.confidence,
      vlm_reasoning: result.observations.join(" "),
      vlm_latency_ms: result.latencyMs,
      model_identifier: GEMINI_MODEL,
      prompt_version: promptVersion,
      reference_asset_storage_paths: referenceAssetPaths,
      raw_gemini_response: result.rawGeminiResponse,
    })
    .eq("id", submission.id);
  if (submissionError) throw submissionError;

  if (isChallengeGame) return;

  const { data: currentProgress } = await serviceClient
    .from("dog_training_skill_progress")
    .select("attempts, passes, best_confidence, last_pass_at, is_mastered")
    .eq("dog_id", submission.dog_id)
    .eq("activity_id", activity.id)
    .maybeSingle();

  const nextAttempts = (currentProgress?.attempts ?? 0) + 1;
  const nextPasses = (currentProgress?.passes ?? 0) + (result.verdict === "PASS" ? 1 : 0);
  const bestConfidence = Math.max(Number(currentProgress?.best_confidence ?? 0), result.confidence);
  const nowIso = new Date().toISOString();
  const { error: progressError } = await serviceClient
    .from("dog_training_skill_progress")
    .upsert({
      dog_id: submission.dog_id,
      activity_id: activity.id,
      attempts: nextAttempts,
      passes: nextPasses,
      last_attempt_at: nowIso,
      last_pass_at: result.verdict === "PASS" ? nowIso : currentProgress?.last_pass_at ?? null,
      best_confidence: bestConfidence,
      is_mastered: result.verdict === "PASS" || Boolean(currentProgress?.is_mastered),
    }, { onConflict: "dog_id,activity_id" });
  if (progressError) throw progressError;

  // Skip training-specific rewards for challenge games — gold/xp granted by settle_challenge_game_attempt
  if (!isChallengeGame && result.verdict === "PASS") {
    if (activity.harder_activity_id) {
      const { error: unlockError } = await serviceClient
        .from("dog_training_skill_progress")
        .upsert({
          dog_id: submission.dog_id,
          activity_id: activity.harder_activity_id,
        }, { onConflict: "dog_id,activity_id" });
      if (unlockError) throw unlockError;
    }

    const { error: rewardError } = await serviceClient.rpc("grant_training_pass_reward", {
      p_submission_id: submission.id,
      p_dog_id: submission.dog_id,
      p_activity_id: activity.id,
      p_roadmap_day_id: submission.roadmap_day_id ?? null,
      p_xp: activity.xp_reward ?? 0,
      p_coins: activity.coin_reward ?? 0,
      p_stars: activity.stars_available ?? 0,
      p_idempotency_key: `training-pass:${submission.id}`,
    });
    if (rewardError) throw rewardError;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  // ── Preflight config check ───────────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    return json({
      error: "GEMINI_API_KEY is not configured. Run: supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-2.5-flash",
    }, 503);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid token." }, 401);

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: VerifyRequest;
  try {
    body = await req.json() as VerifyRequest;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const {
    submission_id,
    dog_id,
    activity_id,
    roadmap_day_id = null,
    challenge_attempt_id = null,
    tournament_attempt_id = null,
  } = body;
  if (!submission_id || !dog_id || !activity_id) {
    return json({ error: "submission_id, dog_id, and activity_id are required." }, 400);
  }
  if (challenge_attempt_id && tournament_attempt_id) {
    return json({ error: "A submission cannot be both a challenge and tournament attempt." }, 400);
  }

  // ── Service-role client (bypasses RLS for writes) ────────────────────────
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Ownership check ──────────────────────────────────────────────────────
  const { data: dog } = await serviceClient
    .from("dogs")
    .select("id")
    .eq("id", dog_id)
    .eq("owner_id", user.id)
    .single();
  if (!dog) return json({ error: "Dog not found or not owned by this user." }, 403);

  // ── Load submission ──────────────────────────────────────────────────────
  const { data: submission, error: subErr } = await serviceClient
    .from("dog_training_video_submissions")
    .select("*")
    .eq("id", submission_id)
    .eq("dog_id", dog_id)
    .single();
  if (subErr || !submission) return json({ error: "Submission not found." }, 404);
  if (!["pending", "processing"].includes(submission.status)) {
    return json({ error: `Submission is already in status: ${submission.status}` }, 409);
  }
  if (!submission.storage_path) return json({ error: "Submission has no uploaded video." }, 400);

  // Tournament context is accepted only when the secure mobile RPC has already
  // linked this exact owned submission to this exact active tournament entry.
  if (tournament_attempt_id) {
    const { data: tournamentAttempt, error: tournamentAttemptError } = await serviceClient
      .from("tournament_attempts")
      .select("id,tournament_id,dog_id,owner_id,submission_id,status")
      .eq("id", tournament_attempt_id)
      .eq("dog_id", dog_id)
      .eq("owner_id", user.id)
      .eq("submission_id", submission_id)
      .single();
    if (tournamentAttemptError || !tournamentAttempt) {
      return json({ error: "Tournament attempt context is invalid." }, 403);
    }
    if (tournamentAttempt.status !== "submitted") {
      return json({ error: `Tournament attempt is already in status: ${tournamentAttempt.status}` }, 409);
    }

    const { data: tournamentEvent } = await serviceClient
      .from("tournament_events")
      .select("challenge_game_id,status,starts_at,ends_at")
      .eq("id", tournamentAttempt.tournament_id)
      .single();
    const currentTime = new Date().toISOString();
    if (
      !tournamentEvent ||
      tournamentEvent.challenge_game_id !== activity_id ||
      tournamentEvent.status !== "active" ||
      currentTime < tournamentEvent.starts_at ||
      currentTime >= tournamentEvent.ends_at
    ) {
      return json({ error: "Tournament is not accepting this submission." }, 409);
    }
  }

  // ── Load activity (VLM prompt + recording requirements) ──────────────────
  // Try training catalog first; fall back to challenge_games for game submissions.
  let activity: any;
  let isChallengeGame = false;

  const { data: catalogActivity, error: actErr } = await serviceClient
    .from("training_catalog_activities")
    .select(
      "id, vlm_prompt, recommended_fps, min_clip_seconds, max_clip_seconds, " +
      "recording_requirements, required_reference_assets, " +
      "pass_criteria, fail_criteria, needs_review_criteria, " +
      "minimum_auto_pass_confidence, minimum_auto_fail_confidence, " +
      "verification_status, xp_reward, coin_reward, stars_available, harder_activity_id",
    )
    .eq("id", activity_id)
    .single();

  if (actErr || !catalogActivity) {
    // Not in catalog — try challenge_games
    const { data: cgRow, error: cgErr } = await serviceClient
      .from("challenge_games")
      .select("id, verifier_prompt, min_clip_seconds, max_clip_seconds, safety_notes")
      .eq("id", activity_id)
      .single();
    if (cgErr || !cgRow) return json({ error: "Activity not found in catalog or challenge games." }, 404);
    if (!cgRow.verifier_prompt?.trim()) return json({ error: "Challenge game has no verifier prompt." }, 400);
    isChallengeGame = true;
    activity = {
      id: cgRow.id,
      vlm_prompt: cgRow.verifier_prompt,
      min_clip_seconds: cgRow.min_clip_seconds,
      max_clip_seconds: cgRow.max_clip_seconds,
      required_reference_assets: ["DOG_PROFILE"],
      pass_criteria: [],
      fail_criteria: [],
      needs_review_criteria: [],
      xp_reward: 0,
      coin_reward: 0,
      stars_available: 0,
      harder_activity_id: null,
      verification_status: "ACTIVE",
      recommended_fps: 1,
      minimum_auto_pass_confidence: 0.7,
      minimum_auto_fail_confidence: 0.3,
      recording_requirements: {},
    };
  } else {
    activity = catalogActivity;
    if (activity.verification_status === "DISABLED") {
      return json({ error: "Activity is disabled and cannot be verified." }, 400);
    }
    if (!activity.vlm_prompt?.trim()) {
      return json({ error: "Activity has no VLM prompt. Cannot proceed." }, 400);
    }
  }

  // ── Resolve current prompt version ───────────────────────────────────────
  const { data: latestVersion } = await serviceClient
    .from("training_activity_versions")
    .select("version_number")
    .eq("activity_id", activity_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  const promptVersion: number | null = latestVersion?.version_number ?? null;

  // ── Load reference assets for this dog + activity ────────────────────────
  const requiredTypes: string[] = Array.isArray(activity.required_reference_assets)
    ? activity.required_reference_assets
    : [];
  const { data: referenceAssets } = await serviceClient
    .from("dog_training_reference_assets")
    .select("id, asset_type, storage_path")
    .eq("dog_id", dog_id)
    .in("asset_type", requiredTypes);
  const assetsByType = new Map<string, any[]>();
  for (const asset of referenceAssets ?? []) {
    const current = assetsByType.get(asset.asset_type) ?? [];
    current.push(asset);
    assetsByType.set(asset.asset_type, current);
  }
  const missingReferenceTypes = requiredTypes.filter((type) => (assetsByType.get(type)?.length ?? 0) === 0);
  const referenceAssetPaths: string[] = (referenceAssets ?? []).map((a: any) => a.storage_path);

  // ── Mark submission as processing ────────────────────────────────────────
  await serviceClient
    .from("dog_training_video_submissions")
    .update({
      status: "processing",
      model_identifier: GEMINI_MODEL,
      prompt_version: promptVersion,
      reference_asset_storage_paths: referenceAssetPaths,
    })
    .eq("id", submission_id);

  // ── Missing required reference photos are static missing evidence ────────
  // Do not call this a FAIL and do not fabricate semantic Gemini evidence.
  if (missingReferenceTypes.length > 0) {
    const result: StoredVerdict = {
      activityId: activity_id,
      verdict: "NEEDS_REVIEW",
      confidence: 1,
      observations: [],
      missingEvidence: missingReferenceTypes.map((type) => `Missing required reference photo: ${type}`),
      retryInstruction: "Upload the required dog/profile or target-object reference photos and try again.",
      rawGeminiResponse: { skipped: "missing_required_reference_assets", missingReferenceTypes },
      latencyMs: 0,
    };
    await storeVerdict({ serviceClient, submission, activity, promptVersion, referenceAssetPaths, result, isChallengeGame });
    if (tournament_attempt_id) {
      const { error: tournamentRecordError } = await serviceClient.rpc("record_tournament_verification", {
        target_attempt_id: tournament_attempt_id,
        target_submission_id: submission.id,
        verification_result_value: {
          verdict: result.verdict,
          confidence: result.confidence,
          observations: result.observations,
          missingEvidence: result.missingEvidence,
        },
        request_key: `verify:${tournament_attempt_id}:${submission.id}`,
      });
      if (tournamentRecordError) throw tournamentRecordError;
    }
    return json({ verdict: result.verdict, confidence: result.confidence, retryInstruction: result.retryInstruction });
  }

  try {
    const video = await downloadStorageObject(serviceClient, submission.storage_path, VIDEO_BUCKET);
    const submissionHash = await sha256Hex(video.bytes);
    await serviceClient
      .from("dog_training_video_submissions")
      .update({ submission_hash: submissionHash })
      .eq("id", submission_id);

    const referenceParts: { assetType: string; bytes: Uint8Array; mimeType: string }[] = [];
    for (const asset of referenceAssets ?? []) {
      const photo = await downloadStorageObject(serviceClient, asset.storage_path, REFERENCE_PHOTO_BUCKET);
      referenceParts.push({ assetType: asset.asset_type, bytes: photo.bytes, mimeType: photo.mimeType });
    }

    const result = await callGemini({
      activity,
      video: { bytes: video.bytes, mimeType: video.mimeType },
      referenceParts,
    });
    await storeVerdict({ serviceClient, submission, activity, promptVersion, referenceAssetPaths, result, isChallengeGame });

    // Settle the challenge attempt — grants gold coins and XP, updates attempt status
    if (isChallengeGame && challenge_attempt_id) {
      await serviceClient.rpc("settle_challenge_game_attempt", {
        target_attempt_id: challenge_attempt_id,
        storage_path_value: submission.storage_path,
        verification_result_value: {
          verdict: result.verdict,
          confidence: result.confidence,
          observations: result.observations,
          missingEvidence: result.missingEvidence,
        },
        technical_failure_value: false,
        request_key: `settle:${challenge_attempt_id}:${submission.id}`,
      });
    }

    if (isChallengeGame && tournament_attempt_id) {
      const { error: tournamentRecordError } = await serviceClient.rpc("record_tournament_verification", {
        target_attempt_id: tournament_attempt_id,
        target_submission_id: submission.id,
        verification_result_value: {
          verdict: result.verdict,
          confidence: result.confidence,
          observations: result.observations,
          missingEvidence: result.missingEvidence,
        },
        request_key: `verify:${tournament_attempt_id}:${submission.id}`,
      });
      if (tournamentRecordError) throw tournamentRecordError;
    }

    return json({
      activityId: result.activityId,
      verdict: result.verdict,
      confidence: result.confidence,
      observations: result.observations,
      missingEvidence: result.missingEvidence,
      retryInstruction: result.retryInstruction,
    });
  } catch (error) {
    await serviceClient
      .from("dog_training_video_submissions")
      .update({
        status: "error",
        model_identifier: GEMINI_MODEL,
        vlm_reasoning: error instanceof Error ? error.message : "Gemini verification failed.",
      })
      .eq("id", submission_id);
    if (tournament_attempt_id) {
      await serviceClient
        .from("tournament_attempts")
        .update({
          status: "pending_review",
          verdict: "NEEDS_REVIEW",
          review_notes: "Automated verification encountered a technical error.",
        })
        .eq("id", tournament_attempt_id)
        .eq("submission_id", submission_id)
        .eq("status", "submitted");
    }
    return json({ error: error instanceof Error ? error.message : "Gemini verification failed." }, 500);
  }
});
