import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Gemini, server side. The app sends the request body it would have sent to Google; this function checks who is
 * asking, adds the key from the GEMINI_API_KEY secret and forwards it. The key never ships in the app.
 * Only signed-in users (anonymous sessions count) can call it, only the models PAWS uses are allowed, and each user
 * gets a generous per-minute allowance so a leaked session cannot run up the bill.
 */
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const MODELS = new Set(["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]);
const MAX_BODY_BYTES = 12_000_000;
const TIMEOUT_MS = 45_000;
const PER_MINUTE = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

// Per-instance sliding window; instances are short-lived, so this is a brake, not a quota system.
const recent = new Map<string, number[]>();
const allowed = (userId: string) => {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= PER_MINUTE) return false;
  times.push(now);
  recent.set(userId, times);
  return true;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: { message: "method_not_allowed" } }, 405);
  if (!GEMINI_API_KEY) {
    console.error("[gemini] GEMINI_API_KEY is not set for this function.");
    return json({ error: { message: "unconfigured" } }, 503);
  }

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { message: "unauthorized" } }, 401);
  if (!allowed(userData.user.id)) return json({ error: { message: "rate_limited" } }, 429);

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return json({ error: { message: "too_large" } }, 413);

  let payload: { model?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: { message: "invalid_json_body" } }, 400);
  }
  const model = payload.model ?? "";
  if (!MODELS.has(model)) return json({ error: { message: "model_not_allowed" } }, 400);
  if (!payload.body || typeof payload.body !== "object") return json({ error: { message: "missing_body" } }, 400);

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(payload.body),
      signal: abort.signal,
    });
    // Pass Google's status and body through, so the app's existing error handling keeps working.
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error) {
    const detail = abort.signal.aborted ? "timed out" : error instanceof Error ? error.message : "network";
    console.error(`[gemini] upstream failed: ${detail}`);
    return json({ error: { message: detail } }, 504);
  } finally {
    clearTimeout(timer);
  }
});
