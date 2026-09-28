import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const VIDEO_BUCKET = "dog-activity-videos";

const MASTER_VLM_PROMPT = `You are PAWS Dog Training Video Verifier.

Evaluate exactly one submitted dog-training video against one activity-specific rubric and the submitted reference assets.

Accuracy is more important than forcing a PASS or FAIL.

Rules:

1. Judge only visible or audible evidence inside the submitted clip.
2. Compare required dog-profile photos and required object-reference photos against visible subjects and objects in the submitted video.
3. Do not assume that any random visible object is the correct target object.
4. If target-object identity cannot be matched confidently, return NEEDS_REVIEW.
5. Before scoring behavior, determine whether the clip is scorable.
6. If the dog, required body parts, owner, target object, destination, doorway threshold, start boundary, or end boundary is cropped, hidden, blurred, or too distant, return NEEDS_REVIEW.
7. If required audio is missing or unclear, return NEEDS_REVIEW.
8. If multiple dogs appear and the target dog is ambiguous, return NEEDS_REVIEW.
9. Missing evidence is never a FAIL.
10. Approximate completion is never a PASS.
11. PASS requires every required visible checkpoint criterion to be clearly satisfied.
12. FAIL is permitted only when the clip is fully scorable and at least one mandatory criterion is visibly contradicted.
13. Do not infer hidden actions, dog intent, owner intent, emotional state, comfort, fear, anxiety, pain, aggression, medical status, temperament, or long-term behavior improvement.
14. For alone-time activities, report only visible events. Never diagnose separation anxiety and never claim emotional comfort.
15. If clearly visible forcing, pushing, pulling, dragging, unsafe restraint, or unsafe setup occurs, report it.
16. Include timestamps for important visible or audible events.
17. Return strict JSON only.
18. The response must match the supplied schema.`;

type GeminiVerdict = {
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  summary: string;
  observedCheckpoints: string[];
  missingCheckpoints: string[];
  safetyFlags: string[];
};

function inferMimeType(path: string): string {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseGeminiText(raw: any): string {
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini response did not include candidate text.");
  const text = parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
  if (!text) throw new Error("Gemini response text was empty.");
  return text;
}

function parseVerdict(raw: unknown): GeminiVerdict {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") throw new Error("Gemini verdict is not an object.");
  const value = parsed as Record<string, unknown>;
  if (!["PASS", "FAIL", "NEEDS_REVIEW"].includes(String(value.verdict))) {
    throw new Error("Gemini verdict must be PASS, FAIL, or NEEDS_REVIEW.");
  }
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) {
    throw new Error("Gemini confidence must be a number from 0 to 1.");
  }
  const strings = (field: unknown): string[] =>
    Array.isArray(field) ? field.filter((item): item is string => typeof item === "string") : [];
  const missingCheckpoints = strings(value.missingCheckpoints);
  let verdict = value.verdict as GeminiVerdict["verdict"];
  if (missingCheckpoints.length > 0 && verdict === "FAIL") verdict = "NEEDS_REVIEW";
  return {
    verdict,
    confidence: value.confidence,
    summary: typeof value.summary === "string" ? value.summary : "",
    observedCheckpoints: strings(value.observedCheckpoints),
    missingCheckpoints,
    safetyFlags: strings(value.safetyFlags),
  };
}

async function callGemini(verifierPrompt: string, video: { bytes: Uint8Array; mimeType: string }): Promise<{ verdict: GeminiVerdict; raw: unknown }> {
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const schema = {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["PASS", "FAIL", "NEEDS_REVIEW"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      summary: { type: "string" },
      observedCheckpoints: { type: "array", items: { type: "string" } },
      missingCheckpoints: { type: "array", items: { type: "string" } },
      safetyFlags: { type: "array", items: { type: "string" } },
    },
    required: ["verdict", "confidence", "summary", "observedCheckpoints", "missingCheckpoints", "safetyFlags"],
    additionalProperties: false,
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: MASTER_VLM_PROMPT },
          { text: verifierPrompt },
          { inlineData: { mimeType: video.mimeType, data: bytesToBase64(video.bytes) } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema },
    }),
  });
  const rawGeminiResponse = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(rawGeminiResponse).slice(0, 500)}`);
  }
  return { verdict: parseVerdict(parseGeminiText(rawGeminiResponse)), raw: rawGeminiResponse };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!GEMINI_API_KEY) {
    return json({ error: "GEMINI_API_KEY is not configured. Run: supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-2.5-flash" }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  let body: { submission_id?: string; dog_id?: string; activity_id?: string; challenge_attempt_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }
  const { submission_id, dog_id, activity_id, challenge_attempt_id } = body;
  if (!submission_id || !dog_id || !activity_id) {
    return json({ error: "submission_id, dog_id, and activity_id are required." }, 400);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: dog } = await adminClient
    .from("dogs")
    .select("id")
    .eq("id", dog_id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (!dog) return json({ error: "Dog not found or not owned by this user." }, 403);

  const { data: submission, error: subErr } = await adminClient
    .from("dog_training_video_submissions")
    .select("*")
    .eq("id", submission_id)
    .eq("dog_id", dog_id)
    .maybeSingle();
  if (subErr || !submission) return json({ error: "Submission not found." }, 404);
  if (!["pending", "processing"].includes(submission.status)) {
    return json({ error: `Submission is already in status: ${submission.status}` }, 409);
  }
  if (!submission.storage_path) return json({ error: "Submission has no uploaded video." }, 400);

  const { data: game, error: gameErr } = await adminClient
    .from("challenge_games")
    .select("id, verifier_prompt")
    .eq("id", activity_id)
    .eq("is_active", true)
    .maybeSingle();
  if (gameErr || !game) return json({ error: "Challenge game not found." }, 404);
  if (!game.verifier_prompt?.trim()) return json({ error: "Challenge game has no verifier prompt." }, 400);

  await adminClient
    .from("dog_training_video_submissions")
    .update({ status: "processing" })
    .eq("id", submission_id);

  try {
    const { data: videoData, error: downloadError } = await adminClient.storage
      .from(VIDEO_BUCKET)
      .download(submission.storage_path);
    if (downloadError || !videoData) {
      throw new Error(`Storage download failed: ${downloadError?.message ?? "missing data"}`);
    }
    const videoBytes = new Uint8Array(await videoData.arrayBuffer());
    const submissionHash = await sha256Hex(videoBytes);
    const mimeType = videoData.type || inferMimeType(submission.storage_path);

    const { verdict, raw } = await callGemini(game.verifier_prompt, { bytes: videoBytes, mimeType });

    await adminClient
      .from("dog_training_video_submissions")
      .update({
        submission_hash: submissionHash,
        confidence: verdict.confidence,
        raw_gemini_response: raw,
        observations: { observedCheckpoints: verdict.observedCheckpoints, safetyFlags: verdict.safetyFlags },
      })
      .eq("id", submission_id);

    const reviewerNote = [verdict.summary, ...verdict.safetyFlags].filter(Boolean).join(" ").slice(0, 2000) || null;
    const { error: approveError } = await adminClient.rpc("approve_challenge_submission", {
      target_submission_id: submission_id,
      verdict_value: verdict.verdict,
      reviewer_note_value: reviewerNote,
    });
    if (approveError) throw approveError;

    const retryInstruction = verdict.verdict === "NEEDS_REVIEW"
      ? (verdict.missingCheckpoints.join(" ") || "Please record again with all required evidence clearly visible.")
      : null;

    return json({
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      observations: [verdict.summary, ...verdict.observedCheckpoints].filter(Boolean),
      missingEvidence: verdict.missingCheckpoints,
      retryInstruction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini verification failed.";
    await adminClient
      .from("dog_training_video_submissions")
      .update({ status: "error", reviewer_note: message.slice(0, 2000) })
      .eq("id", submission_id);
    return json({ error: message }, 500);
  }
});
