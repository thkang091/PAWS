import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  DUEL_HOURS,
  OBSERVATION_SCHEMA,
  REWARDS,
  RULES,
  better,
  checkClip,
  duelOutcome,
  judgeCombo,
  judgeSit,
  makeCode,
  makeDuelCode,
  makePlan,
  observerPrompt,
  parseObservation,
  readClipInfo,
  weekStart,
  weeklyTricks,
  type ArenaGame,
  type ArenaPlan,
  type Rng,
  type Trick,
  type Verdict,
} from "./logic.ts";

/**
 * Arena games. The only writer of arena_attempts and arena_duels.
 *
 * POST { action: "start", dogId, game, duelId? }        a new attempt: code word, plan, where to upload the clip
 * POST { action: "submit", attemptId, ext }             check and score the uploaded clip
 * POST { action: "share", attemptId, public }           show or hide this clip on the board
 * POST { action: "replay", attemptId }                  a short link to a clip the caller may watch
 * POST { action: "duel_create", dogId, game }           a duel with a code to share
 * POST { action: "duel_join", dogId, code }             join someone's duel
 * POST { action: "duels", dogId }                       this dog's duels, settling any that have ended
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("ARENA_GEMINI_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const GEMINI = "https://generativelanguage.googleapis.com";
const BUCKET = "arena-videos";
/** Above this the clip goes through Gemini's file upload instead of inline, which caps a request near 20 MB. */
const INLINE_LIMIT = 14 * 1024 * 1024;
/** Starts allowed per duel; the first scored attempt ends a player's turn. */
const DUEL_STARTS = 3;
/** Time to upload after the longest possible clip. */
const UPLOAD_GRACE_MS = 5 * 60_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
const log = (event: string, detail: Record<string, unknown> = {}) => console.error(`[arena] ${event}`, JSON.stringify(detail));

const rng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};

const isGame = (v: unknown): v is ArenaGame => v === "longest_sit" || v === "trick_combo";

type AttemptRow = {
  id: string;
  owner_id: string;
  dog_id: string;
  game: ArenaGame;
  duel_id: string | null;
  week_start: string;
  code_word: string;
  plan: ArenaPlan;
  status: string;
  started_at: string;
  expires_at: string;
  score_ms: number | null;
  reason: string | null;
  replay_public: boolean;
  storage_path: string | null;
  judged_at: string | null;
};

type DuelRow = {
  id: string;
  game: ArenaGame;
  code: string;
  host_owner_id: string;
  host_dog_id: string;
  guest_owner_id: string | null;
  guest_dog_id: string | null;
  tricks: Trick[] | null;
  status: "open" | "playing" | "done" | "expired";
  winner_dog_id: string | null;
  expires_at: string;
  settled_at: string | null;
  created_at: string;
};

const sha256 = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource)), (b) => b.toString(16).padStart(2, "0")).join("");

const base64 = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};

// ---------- Gemini ----------

/** Large clips go up through the Files API and are removed again after the read. */
const uploadToGemini = async (bytes: Uint8Array, mimeType: string) => {
  const start = await fetch(`${GEMINI}/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "arena-clip" } }),
  });
  const url = start.headers.get("x-goog-upload-url");
  if (!start.ok || !url) throw new Error(`gemini_upload_start_${start.status}`);
  const done = await fetch(url, {
    method: "POST",
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize", "Content-Length": String(bytes.byteLength) },
    body: bytes as unknown as BodyInit,
  });
  const file = (await done.json())?.file as { name: string; uri: string; state: string } | undefined;
  if (!done.ok || !file) throw new Error(`gemini_upload_${done.status}`);
  let state = file.state;
  for (let i = 0; state === "PROCESSING" && i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${GEMINI}/v1beta/${file.name}?key=${GEMINI_API_KEY}`);
    state = (await poll.json())?.state ?? "FAILED";
  }
  if (state !== "ACTIVE") throw new Error("gemini_file_not_ready");
  return file;
};

const observe = async (
  game: ArenaGame,
  codeWord: string,
  video: { bytes: Uint8Array; mimeType: string },
  reference: { bytes: Uint8Array; mimeType: string } | null,
) => {
  let fileName: string | null = null;
  // Tricks are short and quick, so the combo is read at 5 frames a second; a long sit at the default rate.
  const videoMetadata = game === "trick_combo" ? { fps: 5 } : { fps: 1 };
  let videoPart: Record<string, unknown>;
  if (video.bytes.byteLength > INLINE_LIMIT) {
    const file = await uploadToGemini(video.bytes, video.mimeType);
    fileName = file.name;
    videoPart = { file_data: { mime_type: video.mimeType, file_uri: file.uri }, video_metadata: videoMetadata };
  } else {
    videoPart = { inline_data: { mime_type: video.mimeType, data: base64(video.bytes) }, video_metadata: videoMetadata };
  }
  const parts: Record<string, unknown>[] = [{ text: observerPrompt(game, codeWord, Boolean(reference)) }];
  if (reference) parts.push({ text: "Reference photo of the dog:" }, { inline_data: { mime_type: reference.mimeType, data: base64(reference.bytes) } });
  parts.push({ text: "The clip:" }, videoPart);

  try {
    const res = await fetch(`${GEMINI}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: OBSERVATION_SCHEMA },
      }),
    });
    const raw = await res.json();
    if (!res.ok) throw new Error(`gemini_${res.status}`);
    const text = raw?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return parseObservation(JSON.parse(text));
  } finally {
    if (fileName) await fetch(`${GEMINI}/v1beta/${fileName}?key=${GEMINI_API_KEY}`, { method: "DELETE" }).catch(() => undefined);
  }
};

/** The dog's latest Dog Moment photo, when there is one, so Gemini can check it is the same dog. */
const referencePhoto = async (admin: SupabaseClient, dogId: string) => {
  const { data } = await admin.from("dog_moments").select("storage_path").eq("dog_id", dogId).order("moment_date", { ascending: false }).limit(1).maybeSingle();
  if (!data?.storage_path) return null;
  const { data: blob } = await admin.storage.from("dog-moments").download(data.storage_path);
  if (!blob || blob.size > 4 * 1024 * 1024) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || "image/jpeg" };
};

// ---------- Duels ----------

const bestScore = (game: ArenaGame, attempts: AttemptRow[]) =>
  attempts.reduce<number | null>((best, a) => (a.status === "scored" && a.score_ms != null && (best == null || better(game, a.score_ms, best)) ? a.score_ms : best), null);

/** A player's turn is over once they have a score, or have used every start with nothing still being judged. */
const turnOver = (game: ArenaGame, attempts: AttemptRow[]) =>
  bestScore(game, attempts) != null || (attempts.length >= DUEL_STARTS && attempts.every((a) => a.status !== "started" && a.status !== "judging"));

const pay = async (admin: SupabaseClient, dogId: string, amount: number, reason: string, key: string, sourceId: string) => {
  const { error } = await admin.rpc("apply_wallet_transaction", {
    p_dog_id: dogId,
    p_currency: "silver_coin",
    p_amount: amount,
    p_reason: reason,
    p_idempotency_key: key,
    p_source_entity_type: "arena",
    p_source_entity_id: sourceId,
  });
  if (error) log("pay_failed", { reason, message: error.message });
};

const settleDuel = async (admin: SupabaseClient, duel: DuelRow): Promise<DuelRow> => {
  if (duel.status === "done" || duel.status === "expired") return duel;
  const { data } = await admin.from("arena_attempts").select("*").eq("duel_id", duel.id);
  const attempts = (data ?? []) as AttemptRow[];
  const host = attempts.filter((a) => a.dog_id === duel.host_dog_id);
  const guest = attempts.filter((a) => a.dog_id === duel.guest_dog_id);
  const ended = Date.now() > Date.parse(duel.expires_at);
  const bothDone = duel.guest_dog_id != null && turnOver(duel.game, host) && turnOver(duel.game, guest);
  if (!ended && !bothDone) return duel;

  if (!duel.guest_dog_id) {
    const { data: row } = await admin.from("arena_duels").update({ status: "expired", settled_at: new Date().toISOString() }).eq("id", duel.id).neq("status", "expired").select().maybeSingle();
    return (row as DuelRow) ?? { ...duel, status: "expired" };
  }

  const hostBest = bestScore(duel.game, host);
  const guestBest = bestScore(duel.game, guest);
  const outcome = duelOutcome(duel.game, hostBest, guestBest).winner;
  const winner = outcome === "host" ? duel.host_dog_id : outcome === "guest" ? duel.guest_dog_id : null;
  const { data: row } = await admin
    .from("arena_duels")
    .update({ status: "done", winner_dog_id: winner, settled_at: new Date().toISOString() })
    .eq("id", duel.id)
    .eq("status", duel.status)
    .select()
    .maybeSingle();
  if (!row) return duel;

  // Coins only between two different people, so nobody farms them against their own second account.
  if (duel.guest_owner_id && duel.guest_owner_id !== duel.host_owner_id) {
    if (winner) await pay(admin, winner, REWARDS.duelWinSilver, "arena_duel_won", `arena_duel_win:${duel.id}`, duel.id);
    if (hostBest != null) await pay(admin, duel.host_dog_id, REWARDS.duelPlayedSilver, "arena_duel_played", `arena_duel_play:${duel.id}:${duel.host_dog_id}`, duel.id);
    if (guestBest != null) await pay(admin, duel.guest_dog_id, REWARDS.duelPlayedSilver, "arena_duel_played", `arena_duel_play:${duel.id}:${duel.guest_dog_id}`, duel.id);
  }
  return row as DuelRow;
};

const duelView = async (admin: SupabaseClient, duel: DuelRow, dogId: string) => {
  const mine = duel.host_dog_id === dogId ? "host" : "guest";
  const theirDog = mine === "host" ? duel.guest_dog_id : duel.host_dog_id;
  const { data } = await admin.from("arena_attempts").select("*").eq("duel_id", duel.id);
  const attempts = (data ?? []) as AttemptRow[];
  const own = attempts.filter((a) => a.dog_id === dogId);
  const theirs = attempts.filter((a) => a.dog_id === theirDog);
  const names = new Map<string, string>();
  const ids = [duel.host_dog_id, duel.guest_dog_id].filter(Boolean) as string[];
  const { data: dogs } = await admin.from("dogs").select("id, name").in("id", ids);
  (dogs ?? []).forEach((d: { id: string; name: string }) => names.set(d.id, d.name));
  const myBest = bestScore(duel.game, own);
  const theirBest = bestScore(duel.game, theirs);
  return {
    id: duel.id,
    game: duel.game,
    code: duel.code,
    role: mine,
    opponentName: theirDog ? names.get(theirDog) ?? null : null,
    status: duel.status,
    myScoreMs: myBest,
    theirScoreMs: theirBest,
    myStarts: own.length,
    startsAllowed: DUEL_STARTS,
    myTurnOpen: (duel.status === "open" || duel.status === "playing") && !turnOver(duel.game, own),
    theirTurnOver: theirDog ? turnOver(duel.game, theirs) : false,
    result: duel.status !== "done" ? null : duel.winner_dog_id == null ? "draw" : duel.winner_dog_id === dogId ? "won" : "lost",
    myAttemptId: own.find((a) => a.status === "scored" && a.score_ms === myBest)?.id ?? null,
    theirAttemptId: theirs.find((a) => a.status === "scored" && a.score_ms === theirBest)?.id ?? null,
    tricks: duel.tricks,
    expiresAt: duel.expires_at,
    createdAt: duel.created_at,
  };
};

// ---------- Actions ----------

const ownsDog = async (admin: SupabaseClient, userId: string, dogId: unknown) => {
  if (typeof dogId !== "string") return false;
  const { data } = await admin.from("dogs").select("id").eq("id", dogId).eq("owner_id", userId).maybeSingle();
  return Boolean(data);
};

const start = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const { dogId, game, duelId } = body;
  if (!isGame(game) || !(await ownsDog(admin, userId, dogId))) return fail("bad_request");
  const now = new Date();

  // Anything this dog left half done is closed, so only one attempt is ever open.
  await admin.from("arena_attempts").update({ status: "expired" }).eq("dog_id", dogId).eq("status", "started");

  let tricks: Trick[] = weeklyTricks(weekStart(now));
  if (typeof duelId === "string") {
    const { data } = await admin.from("arena_duels").select("*").eq("id", duelId).maybeSingle();
    const duel = data as DuelRow | null;
    if (!duel || duel.game !== game || (duel.host_dog_id !== dogId && duel.guest_dog_id !== dogId)) return fail("duel_not_found", 404);
    if (duel.status === "done" || duel.status === "expired" || Date.now() > Date.parse(duel.expires_at)) return fail("duel_over", 409);
    const { data: own } = await admin.from("arena_attempts").select("*").eq("duel_id", duelId).eq("dog_id", dogId);
    if (turnOver(game, (own ?? []) as AttemptRow[])) return fail("turn_over", 409);
    tricks = duel.tricks ?? tricks;
  } else {
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const { count } = await admin
      .from("arena_attempts")
      .select("id", { count: "exact", head: true })
      .eq("dog_id", dogId)
      .eq("game", game)
      .is("duel_id", null)
      .gte("started_at", midnight);
    if ((count ?? 0) >= RULES[game].triesPerDay) return fail("no_tries_left", 429);
  }

  const plan = makePlan(game, rng, tricks);
  const rules = RULES[game];
  const { data: row, error } = await admin
    .from("arena_attempts")
    .insert({
      owner_id: userId,
      dog_id: dogId,
      game,
      duel_id: typeof duelId === "string" ? duelId : null,
      week_start: weekStart(now),
      code_word: makeCode(rng),
      plan,
      expires_at: new Date(now.getTime() + rules.capMs + rules.setupMs + UPLOAD_GRACE_MS).toISOString(),
    })
    .select()
    .single();
  if (error || !row) {
    log("start_failed", { message: error?.message });
    return fail("start_failed", 500);
  }
  const attempt = row as AttemptRow;
  return json({
    ok: true,
    attempt: { id: attempt.id, game, codeWord: attempt.code_word, plan: attempt.plan, folder: userId, expiresAt: attempt.expires_at },
  });
};

const finish = async (admin: SupabaseClient, id: string, values: Record<string, unknown>) => {
  await admin.from("arena_attempts").update({ ...values, judged_at: new Date().toISOString() }).eq("id", id);
};

const submit = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const { attemptId, ext } = body;
  if (typeof attemptId !== "string" || (ext !== "mov" && ext !== "mp4")) return fail("bad_request");
  const { data } = await admin.from("arena_attempts").select("*").eq("id", attemptId).eq("owner_id", userId).maybeSingle();
  const attempt = data as AttemptRow | null;
  if (!attempt) return fail("attempt_not_found", 404);
  if (attempt.status !== "started") return fail("already_submitted", 409);
  const receivedAt = Date.now();
  if (receivedAt > Date.parse(attempt.expires_at)) {
    await finish(admin, attempt.id, { status: "expired", reason: "late" });
    return fail("attempt_expired", 410);
  }

  // Claim the attempt so a double tap cannot judge it twice.
  const { data: claimed } = await admin.from("arena_attempts").update({ status: "judging" }).eq("id", attempt.id).eq("status", "started").select("id");
  if (!claimed?.length) return fail("already_submitted", 409);
  const release = () => admin.from("arena_attempts").update({ status: "started" }).eq("id", attempt.id);

  const path = `${userId}/${attempt.id}.${ext}`;
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !blob) {
    await release();
    return fail("upload_missing", 400);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const clip = readClipInfo(bytes);
  const result = (verdict: Verdict, extra: Record<string, unknown> = {}) => ({ ...verdict, ...extra });

  const clipCheck = checkClip(clip, attempt.game, Date.parse(attempt.started_at), receivedAt);
  if (!clipCheck.ok) {
    await finish(admin, attempt.id, { status: "invalid", reason: clipCheck.reason, storage_path: path, clip_ms: clip?.durationMs ?? null });
    return json({ ok: true, result: result({ status: "invalid", scoreMs: null, reason: clipCheck.reason }) });
  }

  const hash = await sha256(bytes);
  const { error: hashError } = await admin.from("arena_attempts").update({ video_sha256: hash, storage_path: path, clip_ms: clip!.durationMs }).eq("id", attempt.id);
  if (hashError) {
    await finish(admin, attempt.id, { status: "invalid", reason: "duplicate_clip", storage_path: path });
    return json({ ok: true, result: result({ status: "invalid", scoreMs: null, reason: "duplicate_clip" }) });
  }

  if (!GEMINI_API_KEY) {
    await release();
    return fail("judge_unconfigured", 503);
  }

  let observation;
  try {
    const reference = await referencePhoto(admin, attempt.dog_id).catch(() => null);
    observation = await observe(attempt.game, attempt.code_word, { bytes, mimeType: ext === "mov" ? "video/quicktime" : "video/mp4" }, reference);
  } catch (error) {
    log("judge_failed", { message: error instanceof Error ? error.message : String(error) });
    // The clip stays uploaded; the player can send it again from the result screen while the attempt is open.
    await admin.from("arena_attempts").update({ status: "started", video_sha256: null }).eq("id", attempt.id);
    return fail("judge_unavailable", 503);
  }

  const plan = attempt.plan;
  const verdict = plan.kind === "longest_sit" ? judgeSit(plan, observation, clip!.durationMs) : judgeCombo(plan, observation);
  await finish(admin, attempt.id, {
    status: verdict.status,
    score_ms: verdict.scoreMs,
    reason: verdict.reason,
    confidence: observation.confidence,
    observation,
  });

  let personalBest = false;
  if (verdict.status === "scored" && verdict.scoreMs != null && !attempt.duel_id) {
    const { data: earlier } = await admin
      .from("arena_attempts")
      .select("score_ms")
      .eq("dog_id", attempt.dog_id)
      .eq("game", attempt.game)
      .eq("status", "scored")
      .neq("id", attempt.id);
    const prior = (earlier ?? []).map((r: { score_ms: number }) => r.score_ms);
    personalBest = prior.every((s) => better(attempt.game, verdict.scoreMs!, s));
    if (personalBest) await pay(admin, attempt.dog_id, REWARDS.personalBestSilver, "arena_personal_best", `arena_pb:${attempt.id}`, attempt.id);
  }

  let duel = null;
  if (attempt.duel_id) {
    const { data: duelRow } = await admin.from("arena_duels").select("*").eq("id", attempt.duel_id).maybeSingle();
    if (duelRow) duel = await duelView(admin, await settleDuel(admin, duelRow as DuelRow), attempt.dog_id);
  }

  let rank: number | null = null;
  if (verdict.status === "scored" && !attempt.duel_id) {
    const { data: board } = await admin.rpc("arena_board", { p_game: attempt.game, p_week: attempt.week_start, p_limit: 200 });
    rank = ((board ?? []) as { dog_id: string; rank: number }[]).find((r) => r.dog_id === attempt.dog_id)?.rank ?? null;
  }

  return json({
    ok: true,
    result: result(verdict, {
      attemptId: attempt.id,
      summary: observation.summary,
      personalBest,
      silver: personalBest ? REWARDS.personalBestSilver : 0,
      rank,
      duel,
    }),
  });
};

const share = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  if (typeof body.attemptId !== "string" || typeof body.public !== "boolean") return fail("bad_request");
  const { data } = await admin.from("arena_attempts").update({ replay_public: body.public }).eq("id", body.attemptId).eq("owner_id", userId).select("id");
  if (!data?.length) return fail("attempt_not_found", 404);
  return json({ ok: true });
};

const replay = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  if (typeof body.attemptId !== "string") return fail("bad_request");
  const { data } = await admin.from("arena_attempts").select("*").eq("id", body.attemptId).maybeSingle();
  const attempt = data as AttemptRow | null;
  if (!attempt?.storage_path) return fail("attempt_not_found", 404);
  let allowed = attempt.owner_id === userId || attempt.replay_public;
  if (!allowed && attempt.duel_id) {
    // Duel players can always watch each other's clips.
    const { data: duel } = await admin.from("arena_duels").select("host_owner_id, guest_owner_id").eq("id", attempt.duel_id).maybeSingle();
    allowed = duel?.host_owner_id === userId || duel?.guest_owner_id === userId;
  }
  if (!allowed) return fail("not_allowed", 403);
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(attempt.storage_path, 600);
  if (!signed?.signedUrl) return fail("replay_unavailable", 500);
  return json({ ok: true, url: signed.signedUrl });
};

const duelCreate = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const { dogId, game } = body;
  if (!isGame(game) || !(await ownsDog(admin, userId, dogId))) return fail("bad_request");
  const { count } = await admin.from("arena_duels").select("id", { count: "exact", head: true }).eq("host_dog_id", dogId).in("status", ["open", "playing"]);
  if ((count ?? 0) >= 5) return fail("too_many_duels", 429);
  const tricks = game === "trick_combo" ? weeklyTricks(weekStart(new Date())) : null;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin
      .from("arena_duels")
      .insert({
        game,
        code: makeDuelCode(rng),
        host_owner_id: userId,
        host_dog_id: dogId,
        tricks,
        expires_at: new Date(Date.now() + DUEL_HOURS * 3_600_000).toISOString(),
      })
      .select()
      .single();
    if (!error && data) return json({ ok: true, duel: await duelView(admin, data as DuelRow, dogId as string) });
    if (error && !/duplicate|unique/i.test(error.message)) {
      log("duel_create_failed", { message: error.message });
      break;
    }
  }
  return fail("duel_create_failed", 500);
};

const duelJoin = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const { dogId } = body;
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !(await ownsDog(admin, userId, dogId))) return fail("bad_code");
  const { data } = await admin.from("arena_duels").select("*").eq("code", code).maybeSingle();
  const duel = data as DuelRow | null;
  if (!duel) return fail("duel_not_found", 404);
  if (duel.host_owner_id === userId) return fail("own_duel", 409);
  if (duel.guest_dog_id === dogId) return json({ ok: true, duel: await duelView(admin, duel, dogId as string) });
  if (duel.status !== "open" || duel.guest_dog_id || Date.now() > Date.parse(duel.expires_at)) return fail("duel_closed", 409);
  const { data: joined } = await admin
    .from("arena_duels")
    .update({ guest_owner_id: userId, guest_dog_id: dogId, status: "playing" })
    .eq("id", duel.id)
    .eq("status", "open")
    .is("guest_dog_id", null)
    .select()
    .maybeSingle();
  if (!joined) return fail("duel_closed", 409);
  return json({ ok: true, duel: await duelView(admin, joined as DuelRow, dogId as string) });
};

const duels = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const { dogId } = body;
  if (!(await ownsDog(admin, userId, dogId))) return fail("bad_request");
  const { data } = await admin
    .from("arena_duels")
    .select("*")
    .or(`host_dog_id.eq.${dogId},guest_dog_id.eq.${dogId}`)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = await Promise.all(((data ?? []) as DuelRow[]).map((d) => settleDuel(admin, d)));
  return json({ ok: true, duels: await Promise.all(rows.map((d) => duelView(admin, d, dogId as string))) });
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
      case "start":
        return await start(admin, userId, body);
      case "submit":
        return await submit(admin, userId, body);
      case "share":
        return await share(admin, userId, body);
      case "replay":
        return await replay(admin, userId, body);
      case "duel_create":
        return await duelCreate(admin, userId, body);
      case "duel_join":
        return await duelJoin(admin, userId, body);
      case "duels":
        return await duels(admin, userId, body);
      default:
        return fail("unknown_action");
    }
  } catch (error) {
    log("unhandled", { action: body.action, message: error instanceof Error ? error.message : String(error) });
    return fail("server_error", 500);
  }
});
